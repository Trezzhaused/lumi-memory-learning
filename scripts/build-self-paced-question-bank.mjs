import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "data", "self-paced-learning");
const alignmentOutputPath = path.join(outputDir, "tier-alignment.json");
const questionsOutputPath = path.join(outputDir, "questions.jsonl");
const readmeOutputPath = path.join(outputDir, "README.md");

const tierAlignment = [
  {
    tier_level: 1,
    grade_equivalent: "Kindergarten - Grade 2",
    estimated_age_min: 5,
    estimated_age_max: 7,
    focus: "Visual matching, single-step arithmetic, basic phonics",
  },
  {
    tier_level: 2,
    grade_equivalent: "Grade 3 - Grade 5",
    estimated_age_min: 8,
    estimated_age_max: 10,
    focus: "Multi-step word problems, reading comprehension, basic science facts",
  },
  {
    tier_level: 3,
    grade_equivalent: "Grade 6 - Grade 8",
    estimated_age_min: 11,
    estimated_age_max: 13,
    focus: "Rational numbers, introductory algebra, multi-variable logic, textual analysis",
  },
  {
    tier_level: 4,
    grade_equivalent: "Grade 9 - Grade 10",
    estimated_age_min: 14,
    estimated_age_max: 16,
    focus: "Secondary algebra, data interpretation, chemistry and physics concepts",
  },
  {
    tier_level: 5,
    grade_equivalent: "Grade 11 - Grade 12",
    estimated_age_min: 17,
    estimated_age_max: 18,
    focus: "Calculus preparation, critical rhetorical analysis, advanced synthesis",
  },
  {
    tier_level: 6,
    grade_equivalent: "College Undergraduate",
    estimated_age_min: 18,
    estimated_age_max: 99,
    focus: "Domain-specific expertise, deep theoretical proof, research evaluation",
  },
];

const questions = [
  {
    question_id: "T3_MATH_001",
    subject: "Mathematics",
    topic: "Expressions & Equations",
    tier_level: 3,
    tier_alignment: {
      tier_level: 3,
      grade_equivalent: "Grade 7",
      recommended_age_range: [11, 14],
    },
    self_paced_metadata: {
      difficulty_rating: 0.35,
      estimated_time_to_solve_seconds: 90,
      prerequisite_skills: ["arithmetic_operations", "basic_equation_solving"],
    },
    question_text: "Solve for x: 4x + 12 = 36",
    type: "multiple_choice",
    options: {
      A: "x = 4",
      B: "x = 6",
      C: "x = 8",
      D: "x = 12",
    },
    correct_option: "B",
    hints: [
      "Subtract 12 from both sides of the equation first.",
      "Divide the remaining value by 4.",
    ],
    detailed_explanation: "Subtract 12 from both sides: 4x = 24. Divide by 4: x = 6.",
    skill_tags: ["algebra", "equations", "linear_reasoning"],
  },
  {
    question_id: "T3_MATH_002",
    subject: "Mathematics",
    topic: "Ratios & Proportions",
    tier_level: 3,
    tier_alignment: {
      tier_level: 3,
      grade_equivalent: "Grade 7",
      recommended_age_range: [11, 14],
    },
    self_paced_metadata: {
      difficulty_rating: 0.4,
      estimated_time_to_solve_seconds: 120,
      prerequisite_skills: ["unit_rate", "multiplication"],
    },
    question_text: "A car travels 150 miles in 3 hours. At this constant speed, how many miles will it travel in 5 hours?",
    type: "multiple_choice",
    options: {
      A: "200 miles",
      B: "225 miles",
      C: "250 miles",
      D: "300 miles",
    },
    correct_option: "C",
    hints: [
      "Find the unit rate by dividing miles by hours.",
      "Multiply that unit speed by 5 hours.",
    ],
    detailed_explanation: "Unit rate = 150 miles / 3 hours = 50 mph. In 5 hours: 50 * 5 = 250 miles.",
    skill_tags: ["ratios", "proportions", "rate_reasoning"],
  },
  {
    question_id: "T3_MATH_003",
    subject: "Mathematics",
    topic: "The Number System",
    tier_level: 3,
    tier_alignment: {
      tier_level: 3,
      grade_equivalent: "Grade 7",
      recommended_age_range: [11, 14],
    },
    self_paced_metadata: {
      difficulty_rating: 0.45,
      estimated_time_to_solve_seconds: 100,
      prerequisite_skills: ["order_of_operations", "integer_arithmetic"],
    },
    question_text: "Evaluate the expression: -8 + 15 / (-3)",
    type: "multiple_choice",
    options: {
      A: "-13",
      B: "-3",
      C: "3",
      D: "13",
    },
    correct_option: "A",
    hints: [
      "Follow the order of operations (PEMDAS). Do division before addition.",
      "Remember that a positive divided by a negative results in a negative number.",
    ],
    detailed_explanation: "First perform division: 15 / (-3) = -5. Then add: -8 + (-5) = -13.",
    skill_tags: ["integers", "order_of_operations"],
  },
  {
    question_id: "T3_SCI_001",
    subject: "Science",
    topic: "Physical Science (Chemistry)",
    tier_level: 3,
    tier_alignment: {
      tier_level: 3,
      grade_equivalent: "Grade 7",
      recommended_age_range: [11, 14],
    },
    self_paced_metadata: {
      difficulty_rating: 0.32,
      estimated_time_to_solve_seconds: 80,
      prerequisite_skills: ["states_of_matter", "particle_models"],
    },
    question_text: "Which state of matter has a definite volume but takes the shape of its container?",
    type: "multiple_choice",
    options: {
      A: "Solid",
      B: "Liquid",
      C: "Gas",
      D: "Plasma",
    },
    correct_option: "B",
    hints: ["Think about water moving from a glass to a bowl."],
    detailed_explanation: "Liquids have particles that slide past each other, giving them a fixed volume but fluid shape.",
    skill_tags: ["chemistry", "states_of_matter"],
  },
  {
    question_id: "T3_SCI_002",
    subject: "Science",
    topic: "Life Science (Biology)",
    tier_level: 3,
    tier_alignment: {
      tier_level: 3,
      grade_equivalent: "Grade 7",
      recommended_age_range: [11, 14],
    },
    self_paced_metadata: {
      difficulty_rating: 0.4,
      estimated_time_to_solve_seconds: 90,
      prerequisite_skills: ["cell_structure", "energy_transfer"],
    },
    question_text: "What organelle is known as the powerhouse of the cell because it produces energy (ATP)?",
    type: "multiple_choice",
    options: {
      A: "Nucleus",
      B: "Chloroplast",
      C: "Mitochondrion",
      D: "Ribosome",
    },
    correct_option: "C",
    hints: ["This structure handles cellular respiration."],
    detailed_explanation: "Mitochondria convert nutrients into adenosine triphosphate (ATP) to power cellular activity.",
    skill_tags: ["biology", "cells"],
  },
  {
    question_id: "T3_ELA_001",
    subject: "English Language Arts",
    topic: "Grammar & Mechanics",
    tier_level: 3,
    tier_alignment: {
      tier_level: 3,
      grade_equivalent: "Grade 6",
      recommended_age_range: [11, 14],
    },
    self_paced_metadata: {
      difficulty_rating: 0.3,
      estimated_time_to_solve_seconds: 70,
      prerequisite_skills: ["sentence_structure", "conjunctions"],
    },
    question_text: "Identify the conjunction in this sentence: 'We wanted to go to the park, but it started raining.'",
    type: "multiple_choice",
    options: {
      A: "wanted",
      B: "to",
      C: "but",
      D: "raining",
    },
    correct_option: "C",
    hints: ["Look for the word connecting the two independent clauses."],
    detailed_explanation: "'But' is a coordinating conjunction linking two complete statements.",
    skill_tags: ["grammar", "conjunctions"],
  },
  {
    question_id: "T3_ELA_002",
    subject: "English Language Arts",
    topic: "Reading Comprehension",
    tier_level: 3,
    tier_alignment: {
      tier_level: 3,
      grade_equivalent: "Grade 7",
      recommended_age_range: [11, 14],
    },
    self_paced_metadata: {
      difficulty_rating: 0.45,
      estimated_time_to_solve_seconds: 100,
      prerequisite_skills: ["figurative_language", "textual_analysis"],
    },
    question_text: "Read the sentence: 'The sky was an ink-black blanket keeping the valley in darkness.' What figurative language device is used?",
    type: "multiple_choice",
    options: {
      A: "Simile",
      B: "Metaphor",
      C: "Personification",
      D: "Hyperbole",
    },
    correct_option: "B",
    hints: ["The sky is directly equated to a blanket without using 'like' or 'as'."],
    detailed_explanation: "Directly identifying one object as another is a metaphor.",
    skill_tags: ["literary_analysis", "metaphor"],
  },
  {
    question_id: "T3_ELA_003",
    subject: "English Language Arts",
    topic: "Vocabulary in Context",
    tier_level: 3,
    tier_alignment: {
      tier_level: 3,
      grade_equivalent: "Grade 7",
      recommended_age_range: [11, 14],
    },
    self_paced_metadata: {
      difficulty_rating: 0.5,
      estimated_time_to_solve_seconds: 85,
      prerequisite_skills: ["context_clues", "vocabulary"],
    },
    question_text: "What does the word 'benevolent' mean in this context: 'The benevolent neighbor organized a free food drive for families in need.'?",
    type: "multiple_choice",
    options: {
      A: "Hostile",
      B: "Wealthy",
      C: "Kind and generous",
      D: "Quiet",
    },
    correct_option: "C",
    hints: ["Look at the action: hosting a free food drive to assist others."],
    detailed_explanation: "'Benevolent' denotes a well-meaning, charitable nature.",
    skill_tags: ["vocabulary", "context_clues"],
  },
  {
    question_id: "T4_MATH_001",
    subject: "Mathematics",
    topic: "Algebra",
    tier_level: 4,
    tier_alignment: {
      tier_level: 4,
      grade_equivalent: "Grade 9",
      recommended_age_range: [14, 16],
    },
    self_paced_metadata: {
      difficulty_rating: 0.62,
      estimated_time_to_solve_seconds: 110,
      prerequisite_skills: ["linear_equations", "variables"],
    },
    question_text: "Solve for x: 2x + 5 = 17",
    type: "multiple_choice",
    options: {
      A: "x = 6",
      B: "x = 7",
      C: "x = 8",
      D: "x = 9",
    },
    correct_option: "B",
    hints: ["Subtract 5 from both sides first."],
    detailed_explanation: "2x + 5 = 17 => 2x = 12 => x = 6.",
    skill_tags: ["algebra", "equations"],
  },
  {
    question_id: "Q601",
    subject: "Mathematics",
    topic: "Calculus",
    tier_level: 6,
    tier_alignment: {
      tier_level: 6,
      grade_equivalent: "College Undergraduate",
      recommended_age_range: [18, 99],
    },
    self_paced_metadata: {
      difficulty_rating: 0.82,
      estimated_time_to_solve_seconds: 180,
      prerequisite_skills: ["power_rule", "polynomial_differentiation"],
    },
    question_text: "What is the derivative of x^2?",
    type: "multiple_choice",
    options: {
      A: "x",
      B: "2x",
      C: "2",
      D: "x^3",
    },
    correct_option: "B",
    hints: ["Apply the power rule to the exponent."],
    detailed_explanation: "The derivative of x^2 is 2x.",
    skill_tags: ["calculus", "differentiation"],
  },
];

await mkdir(outputDir, {recursive: true});
await writeFile(alignmentOutputPath, JSON.stringify(tierAlignment, null, 2) + "\n");
await writeFile(questionsOutputPath, questions.map(item => JSON.stringify(item)).join("\n") + "\n");
await writeFile(readmeOutputPath, buildReadme());

console.log(`[self-paced] wrote ${questions.length} questions and ${tierAlignment.length} tier definitions to ${path.relative(repoRoot, outputDir)}`);

function buildReadme() {
  const lines = [
    "# Self-paced learning data",
    "",
    "This directory stores a lightweight question bank and tier-alignment matrix for the adaptive self-paced course engine.",
    "",
    "## Files",
    "",
    "- `tier-alignment.json` — canonical mapping from age and tier to curricular focus.",
    "- `questions.jsonl` — JSONL question bank with self-paced metadata and hints.",
    "",
    "## Usage",
    "",
    "Run `node scripts/self-paced-engine.mjs` to simulate question routing and adaptation using the generated question bank.",
    "",
  ];
  return lines.join("\n");
}
