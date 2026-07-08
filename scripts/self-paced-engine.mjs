import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data", "self-paced-learning");
const alignmentPath = path.join(dataDir, "tier-alignment.json");
const questionsPath = path.join(dataDir, "questions.jsonl");

const tierAlignment = JSON.parse(await readFile(alignmentPath, "utf8"));
const questions = (await readFile(questionsPath, "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

class IRTEngine {
  constructor(initialAbility = 0.0, learningRate = 0.4) {
    this.theta = initialAbility;
    this.learningRate = learningRate;
  }

  calculateProbability(questionDifficulty) {
    const exponent = Math.max(-20, Math.min(20, -(this.theta - questionDifficulty)));
    return 1 / (1 + Math.exp(exponent));
  }

  updateStudentAbility(questionDifficulty, wasCorrect) {
    const actualScore = wasCorrect ? 1.0 : 0.0;
    const expectedScore = this.calculateProbability(questionDifficulty);
    this.theta += this.learningRate * (actualScore - expectedScore);
    this.theta = Math.max(-4.0, Math.min(4.0, this.theta));
    return this.theta;
  }
}

class SelfPacedEngine {
  constructor({userAge, initialTier = null, questions = [], alignment = []}) {
    this.userAge = userAge;
    this.questions = questions;
    this.alignment = alignment;
    this.currentTier = initialTier ?? this.inferTierFromAge(userAge);
    this.scoreHistory = [];
    this.irt = new IRTEngine();
  }

  inferTierFromAge(age) {
    if (age < 8) return 1;
    if (age < 11) return 2;
    if (age < 14) return 3;
    if (age < 17) return 4;
    if (age < 18) return 5;
    return 6;
  }

  getApplicableQuestions() {
    return this.questions.filter((question) => {
      const questionTier = question.tier_alignment?.tier_level ?? question.tier_level;
      const minimumAge = question.tier_alignment?.recommended_age_range?.[0] ?? question.self_paced_metadata?.estimated_age_min ?? 0;
      return questionTier === this.currentTier || (this.userAge >= minimumAge && questionTier <= this.currentTier);
    });
  }

  selectNextQuestion() {
    const candidates = this.getApplicableQuestions();
    if (candidates.length === 0) {
      return null;
    }

    const targetDifficulty = Math.max(0.2, Math.min(0.8, 0.5 + this.irt.theta * 0.1));
    return candidates
      .map((question) => ({
        ...question,
        distance: Math.abs(question.self_paced_metadata.difficulty_rating - targetDifficulty),
      }))
      .sort((left, right) => left.distance - right.distance)[0];
  }

  evaluateAnswer(question, userSelection) {
    const normalizedResponse = String(userSelection).trim().toUpperCase();
    const isCorrect = normalizedResponse === question.correct_option.toUpperCase();
    this.scoreHistory.push(isCorrect);

    const questionDifficulty = question.self_paced_metadata.difficulty_rating;
    this.irt.updateStudentAbility(questionDifficulty, isCorrect);

    if (this.scoreHistory.length >= 2) {
      const recent = this.scoreHistory.slice(-2);
      if (recent.every(Boolean) && this.currentTier < 6) {
        this.currentTier += 1;
        this.scoreHistory = [];
        console.log(`[adaptive] level up -> tier ${this.currentTier}`);
      } else if (!recent.every(Boolean) && this.currentTier > 1) {
        this.currentTier -= 1;
        this.scoreHistory = [];
        console.log(`[adaptive] pacing assist -> tier ${this.currentTier}`);
      }
    }

    return {
      isCorrect,
      theta: this.irt.theta,
      currentTier: this.currentTier,
    };
  }
}

const engine = new SelfPacedEngine({
  userAge: Number.parseInt(process.env.SELF_PACED_USER_AGE || "25", 10),
  initialTier: Number.parseInt(process.env.SELF_PACED_INITIAL_TIER || "3", 10),
  questions,
  alignment: tierAlignment,
});

const question = engine.selectNextQuestion();
if (!question) {
  console.error("No applicable questions were found for the current tier.");
  process.exit(1);
}

console.log(`[router] age=${engine.userAge} initialTier=${engine.currentTier}`);
console.log(`[router] serving ${question.question_id} (${question.subject}: ${question.topic})`);
console.log(`[router] prompt: ${question.question_text}`);
console.log(`[router] options: ${JSON.stringify(question.options)}`);

const firstResult = engine.evaluateAnswer(question, "B");
console.log(`[result] first answer ${firstResult.isCorrect ? "correct" : "incorrect"} -> theta=${firstResult.theta.toFixed(2)} tier=${firstResult.currentTier}`);

const followUpQuestion = engine.selectNextQuestion();
if (followUpQuestion) {
  console.log(`[router] next suggestion ${followUpQuestion.question_id} (${followUpQuestion.subject}: ${followUpQuestion.topic})`);
  const secondResult = engine.evaluateAnswer(followUpQuestion, "B");
  console.log(`[result] second answer ${secondResult.isCorrect ? "correct" : "incorrect"} -> theta=${secondResult.theta.toFixed(2)} tier=${secondResult.currentTier}`);
}
