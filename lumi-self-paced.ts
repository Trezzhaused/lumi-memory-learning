import {readFileSync} from "node:fs";
import path from "node:path";

export interface AdaptiveAttempt {
  a?: number;
  b?: number;
  c?: number;
  isCorrect?: boolean | number;
  topic?: string;
  [key: string]: unknown;
}

export interface AdaptiveQuestion {
  id?: string;
  question_id?: string;
  topic?: string;
  subject?: string;
  tier_level?: number;
  tier_alignment?: {
    tier_level?: number;
    recommended_age_range?: [number, number];
  };
  self_paced_metadata?: {
    difficulty_rating?: number;
    estimated_time_to_solve_seconds?: number;
  };
  a?: number;
  b?: number;
  c?: number;
  [key: string]: unknown;
}

export interface StudentResponse {
  student_theta?: number;
  theta?: number;
  is_correct?: boolean | number;
  isCorrect?: boolean | number;
}

interface SelfPacedBank {
  questions: AdaptiveQuestion[];
  tierAlignment: Record<string, unknown>;
}

interface SelectionOptions {
  targetProportions?: Record<string, number>;
}

interface QuestionSelectionResult {
  item: AdaptiveQuestion | null;
  klInformation: number;
  priorityScore: number;
  eapTheta: number;
  posterior: number[];
  exposureCounts: Record<string, number>;
}

const DEFAULT_NODES = Array.from({length: 40}, (_value, index) => -4.0 + (index * 8.0) / 39.0);
const DEFAULT_PRIOR = DEFAULT_NODES.map((node) => (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-(node * node) / 2.0));

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function clampProbability(value: number): number {
  return Math.min(0.999, Math.max(0.001, value));
}

export function get3plProbability(theta: number, a: number, b: number, c: number): number {
  const kernel = Math.max(-20.0, Math.min(20.0, -a * (theta - b)));
  return c + (1.0 - c) * (1.0 / (1.0 + Math.exp(kernel)));
}

function normalizeQuestion(question: AdaptiveQuestion, index: number): AdaptiveQuestion {
  const tierLevel = toNumber(question.tier_level, toNumber(question.tier_alignment?.tier_level, 3));
  const difficulty = toNumber(question.self_paced_metadata?.difficulty_rating, 0.5);
  const topic = typeof question.topic === "string" ? question.topic : "General";
  const a = toNumber(question.a, 1.1 + Math.min(0.4, Math.max(0.2, difficulty * 0.2)) + (tierLevel - 1) * 0.03);
  const b = toNumber(question.b, difficulty * 2.0 - 1.0);
  const c = toNumber(question.c, 0.2);
  const resolvedId = typeof question.id === "string"
    ? question.id
    : typeof question.question_id === "string"
      ? question.question_id
      : `question_${index + 1}`;

  return {
    ...question,
    id: resolvedId,
    question_id: resolvedId,
    topic,
    a,
    b,
    c,
    tier_level: tierLevel,
  };
}

function parseQuestionBank(): SelfPacedBank {
  const repoRoot = process.cwd();
  const dataDir = path.join(repoRoot, "data", "self-paced-learning");
  const questionsPath = path.join(dataDir, "questions.jsonl");
  const alignmentPath = path.join(dataDir, "tier-alignment.json");

  let questions: AdaptiveQuestion[] = [];
  let tierAlignment: Record<string, unknown> = {};

  try {
    const questionsContent = readFileSync(questionsPath, "utf8");
    questions = questionsContent
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => normalizeQuestion(JSON.parse(line) as AdaptiveQuestion, index));
  } catch (error) {
    console.warn(`[self-paced] unable to read question bank: ${(error as Error).message}`);
  }

  try {
    const alignmentContent = readFileSync(alignmentPath, "utf8");
    tierAlignment = JSON.parse(alignmentContent) as Record<string, unknown>;
  } catch (error) {
    console.warn(`[self-paced] unable to read tier alignment: ${(error as Error).message}`);
  }

  return {questions, tierAlignment};
}

let cachedBank: SelfPacedBank | null = null;

export function getSelfPacedQuestionBank(): SelfPacedBank {
  if (!cachedBank) {
    cachedBank = parseQuestionBank();
  }
  return cachedBank;
}

export function estimateAbility(history: AdaptiveAttempt[]): {eapTheta: number; posterior: number[]; normalizedPosterior: number[]} {
  const nodes = DEFAULT_NODES;
  const prior = DEFAULT_PRIOR;
  const likelihoods = nodes.map(() => 1.0);

  for (const attempt of history) {
    const a = toNumber(attempt.a, 1.0);
    const b = toNumber(attempt.b, 0.0);
    const c = toNumber(attempt.c, 0.2);
    const isCorrect = typeof attempt.isCorrect === "number" ? attempt.isCorrect : attempt.isCorrect ? 1 : 0;

    for (const [index, node] of nodes.entries()) {
      const p = get3plProbability(node, a, b, c);
      likelihoods[index] *= (p ** isCorrect) * ((1.0 - p) ** (1.0 - isCorrect));
    }
  }

  const posterior = nodes.map((node, index) => likelihoods[index] * prior[index]);
  const sumPosterior = posterior.reduce((sum, value) => sum + value, 0.0);

  if (sumPosterior <= 0.0) {
    return {
      eapTheta: 0.0,
      posterior,
      normalizedPosterior: prior.map((value) => value / prior.reduce((sum, entry) => sum + entry, 0.0)),
    };
  }

  const normalizedPosterior = posterior.map((value) => value / sumPosterior);
  const eapTheta = nodes.reduce((sum, node, index) => sum + (node * normalizedPosterior[index]), 0.0);

  return {eapTheta, posterior, normalizedPosterior};
}

export function selectNextQuestionKL(
  candidateQuestions: AdaptiveQuestion[],
  history: AdaptiveAttempt[],
  options: SelectionOptions = {},
): QuestionSelectionResult {
  const {targetProportions = {}} = options;
  const {eapTheta, normalizedPosterior} = estimateAbility(history);
  const exposureCounts: Record<string, number> = {};
  const totalAdministered = history.length;

  for (const attempt of history) {
    const topic = typeof attempt.topic === "string" ? attempt.topic : "General";
    exposureCounts[topic] = (exposureCounts[topic] ?? 0) + 1;
  }

  let bestItem: AdaptiveQuestion | null = null;
  let maxPriorityScore = Number.NEGATIVE_INFINITY;
  let maxKlInformation = Number.NEGATIVE_INFINITY;

  for (const question of candidateQuestions) {
    const normalizedQuestion = normalizeQuestion(question, 0);
    const a = toNumber(normalizedQuestion.a, 1.0);
    const b = toNumber(normalizedQuestion.b, 0.0);
    const c = toNumber(normalizedQuestion.c, 0.2);
    const pAtEap = clampProbability(get3plProbability(eapTheta, a, b, c));

    let klInformation = 0.0;
    for (const [index, node] of DEFAULT_NODES.entries()) {
      const pAtNode = clampProbability(get3plProbability(node, a, b, c));
      const klDivergence = (pAtEap * Math.log(pAtEap / pAtNode)) + ((1.0 - pAtEap) * Math.log((1.0 - pAtEap) / (1.0 - pAtNode)));
      klInformation += klDivergence * normalizedPosterior[index];
    }

    const topic = typeof normalizedQuestion.topic === "string" ? normalizedQuestion.topic : "General";
    const targetProp = targetProportions[topic] ?? 0.25;
    const actualCount = exposureCounts[topic] ?? 0;
    const actualProp = totalAdministered > 0 ? actualCount / totalAdministered : targetProp;
    const balancingMultiplier = Math.exp(targetProp - actualProp);
    const priorityScore = klInformation * balancingMultiplier;

    if (priorityScore > maxPriorityScore) {
      maxPriorityScore = priorityScore;
      maxKlInformation = klInformation;
      bestItem = normalizedQuestion;
    }
  }

  return {
    item: bestItem,
    klInformation: maxKlInformation,
    priorityScore: maxPriorityScore,
    eapTheta,
    posterior: [],
    exposureCounts,
  };
}

export function auditQuestionPerformance(questionMetadata: AdaptiveQuestion | string, studentResponses: StudentResponse[]): Record<string, unknown> {
  if (studentResponses.length < 5) {
    return {
      status: "INSUFFICIENT_DATA",
      action_required: false,
    };
  }

  const resolvedQuestion = typeof questionMetadata === "string"
    ? getSelfPacedQuestionBank().questions.find((question) => question.id === questionMetadata || question.question_id === questionMetadata)
    : questionMetadata;

  if (!resolvedQuestion) {
    return {
      status: "QUESTION_NOT_FOUND",
      action_required: false,
    };
  }

  const normalizedQuestion = normalizeQuestion(resolvedQuestion, 0);
  const scores = studentResponses.map((entry) => {
    const raw = entry.is_correct ?? entry.isCorrect;
    return raw ? 1 : 0;
  });
  const thetas = studentResponses.map((entry) => toNumber(entry.student_theta ?? entry.theta, 0.0));
  const correctThetas = thetas.filter((_theta, index) => scores[index] === 1);
  const incorrectThetas = thetas.filter((_theta, index) => scores[index] === 0);

  const averageThetaCorrect = correctThetas.length > 0 ? correctThetas.reduce((sum, value) => sum + value, 0.0) / correctThetas.length : 0.0;
  const averageThetaIncorrect = incorrectThetas.length > 0 ? incorrectThetas.reduce((sum, value) => sum + value, 0.0) / incorrectThetas.length : 0.0;
  const scoreCount = scores.reduce<number>((sum, value) => sum + value, 0);
  const pCorrect = scoreCount / scores.length;
  const standardDeviation = Math.sqrt(thetas.reduce((sum, value) => sum + (value - (thetas.reduce((acc, entry) => acc + entry, 0.0) / thetas.length)) ** 2, 0.0) / thetas.length) || 1.0;
  const rPointBiserial = ((averageThetaCorrect - averageThetaIncorrect) / standardDeviation) * Math.sqrt(pCorrect * (1.0 - pCorrect));

  const squaredResiduals: number[] = [];
  const variances: number[] = [];
  const a = toNumber(normalizedQuestion.a, 1.0);
  const b = toNumber(normalizedQuestion.b, 0.0);
  const c = toNumber(normalizedQuestion.c, 0.2);

  for (const response of studentResponses) {
    const studentTheta = toNumber(response.student_theta ?? response.theta, 0.0);
    const expectedP = get3plProbability(studentTheta, a, b, c);
    const actualY = ((response.is_correct ?? response.isCorrect) ? 1 : 0) as number;
    const residualSq = (actualY - expectedP) ** 2;
    const itemVariance = expectedP * (1.0 - expectedP);
    squaredResiduals.push(residualSq);
    variances.push(itemVariance);
  }

  const outfitMsq = variances.length > 0 ? (squaredResiduals.reduce((sum, value) => sum + value, 0.0) / squaredResiduals.length) / (variances.reduce((sum, value) => sum + value, 0.0) / variances.length) : 1.0;

  const flags: string[] = [];
  if (rPointBiserial < 0.15) {
    flags.push("NEGATIVE_OR_LOW_DISCRIMINATION (Potential incorrect answer key)");
  }
  if (outfitMsq > 1.40) {
    flags.push("HIGH_OUTFIT_MISFIT (Highly unpredictable answer patterns detected)");
  } else if (outfitMsq < 0.60) {
    flags.push("OVERFIT (Suspiciously predictable patterns)");
  }

  return {
    question_id: normalizedQuestion.id,
    total_sample_size: studentResponses.length,
    point_biserial_correlation: Number(rPointBiserial.toFixed(3)),
    outfit_mean_square: Number(outfitMsq.toFixed(3)),
    flags,
    action_required: flags.length > 0,
  };
}
