import {ingestKnowledgeEntries} from "./lumi-memory";
import {buildTrainingResourceAnalysis, type TrainingResourceAnalysis} from "./lumi-training-resources";

export interface CurriculumPlanRequest {
    topic?: string;
    gradeBand?: string;
    subject?: string;
    standards?: string[];
    timeframe?: string;
    learnerProfile?: string;
    goal?: string;
}

export interface CurriculumPlanSummary {
    title: string;
    objective: string;
    learningGoals: string[];
    essentialQuestions: string[];
    unitSequence: Array<{title: string; focus: string; outcomes: string[]}>;
    assessmentIdeas: string[];
    differentiation: string[];
    resourceRecommendations: string[];
}

export interface AssessmentPlanRequest {
    topic?: string;
    gradeBand?: string;
    subject?: string;
    standards?: string[];
    objectives?: string[];
    duration?: string;
}

export interface AssessmentPlanSummary {
    title: string;
    standards: string[];
    objectives: string[];
    performanceTasks: string[];
    sampleItems: Array<{prompt: string; expectedEvidence: string; rubricFocus: string}>;
    rubric: string[];
}

export interface ResourceIngestionRequest {
    resources?: string[];
    goals?: string[];
    sessionId?: string;
}

export interface ResourceIngestionSummary {
    analysis: TrainingResourceAnalysis;
    entryCount: number;
    entryIds: string[];
}

function buildGradeBandLabel(gradeBand?: string): string {
    return gradeBand || "K-12";
}

function buildSubjectLabel(subject?: string): string {
    return subject || "interdisciplinary learning";
}

function buildDurationLabel(timeframe?: string): string {
    return timeframe || "one instructional unit";
}

export function buildCurriculumPlan(req: CurriculumPlanRequest = {}): CurriculumPlanSummary {
    const topic = req.topic || "student-centered project learning";
    const gradeBand = buildGradeBandLabel(req.gradeBand);
    const subject = buildSubjectLabel(req.subject);
    const timeframe = buildDurationLabel(req.timeframe);
    const goal = req.goal || "build a coherent, standards-aware learning experience";
    const learnerProfile = req.learnerProfile || "mixed readiness learners with access to collaboration and reflection";

    return {
        title: `${subject} curriculum plan for ${gradeBand}`,
        objective: `Design a classroom-ready ${timeframe} experience around ${topic} that helps learners ${goal}.`,
        learningGoals: [
            `Clarify what learners should know, do, and value by the end of the ${timeframe}.`,
            `Anchor the unit in explicit standards and evidence of mastery.`,
            `Connect the learning experience to authentic practice and student voice.`,
        ],
        essentialQuestions: [
            `How does ${topic} deepen understanding of ${subject} in real-world contexts?`,
            `What evidence best shows learner growth and agency?`,
            `How can instruction adapt for diverse readiness levels and interests?`,
        ],
        unitSequence: [
            {
                title: "Launch and narrative setup",
                focus: "Introduce the challenge, activate prior knowledge, and surface learner curiosity.",
                outcomes: ["Students can explain the purpose of the learning experience.", "Teachers can identify success criteria and common misconceptions."],
            },
            {
                title: "Core inquiry and guided practice",
                focus: "Develop concepts, model strategies, and offer scaffolded practice.",
                outcomes: ["Students can apply core concepts with support.", "Teachers can monitor progress and adjust instruction."],
            },
            {
                title: "Independent performance and reflection",
                focus: "Give learners time to demonstrate mastery and reflect on growth.",
                outcomes: ["Students can produce a portfolio artifact or performance task.", "Students can describe what they learned and what they will do next."],
            },
        ],
        assessmentIdeas: [
            "Use a short diagnostic entry task to confirm readiness and surface misconceptions.",
            "Collect formative evidence through collaborative work, quick writes, and exit tickets.",
            "End with a performance task that asks learners to apply the concept in a new context.",
        ],
        differentiation: [
            `Provide choice boards and tiered supports for a ${learnerProfile}.`,
            "Offer scaffolds such as sentence frames, exemplars, and small-group coaching.",
            "Use flexible pacing and multiple forms of demonstration for learners with different strengths.",
        ],
        resourceRecommendations: [
            "MIT Learn competency-based resources for outcome mapping and mastery evidence.",
            "MIT OpenCourseWare educator materials for activities and pacing ideas.",
            "Core Knowledge or OER resources for grade-band content support.",
        ],
    };
}

export function buildStandardsAlignedAssessment(req: AssessmentPlanRequest = {}): AssessmentPlanSummary {
    const gradeBand = buildGradeBandLabel(req.gradeBand);
    const subject = buildSubjectLabel(req.subject);
    const topic = req.topic || "concept application and explanation";
    const standards = req.standards && req.standards.length > 0 ? req.standards : ["Standards should be aligned to local curriculum expectations"];
    const objectives = req.objectives && req.objectives.length > 0
        ? req.objectives
        : [
            `Students can explain ${topic} in ${subject} using evidence.`,
            `Students can apply ${topic} to a novel scenario.`,
        ];
    const duration = req.duration || "one instructional cycle";

    return {
        title: `${subject} assessment blueprint for ${gradeBand}`,
        standards,
        objectives,
        performanceTasks: [
            `Create a short performance task for ${duration} that asks learners to apply ${topic} in a new context.`,
            `Include a brief reflection so learners can explain their reasoning and choices.`,
        ],
        sampleItems: [
            {
                prompt: `Explain how ${topic} connects to ${subject} using evidence from the unit.`,
                expectedEvidence: "A clear explanation with accurate terminology and relevant examples.",
                rubricFocus: "Understanding and explanation quality",
            },
            {
                prompt: `Apply ${topic} to a new scenario and justify your approach.`,
                expectedEvidence: "A reasoned response that shows transfer and problem solving.",
                rubricFocus: "Transfer and reasoning",
            },
        ],
        rubric: [
            "Accuracy and standards alignment",
            "Evidence of reasoning and explanation",
            "Quality of written or oral communication",
            "Use of feedback and revision",
        ],
    };
}

export async function ingestTrainingResourceCatalog(req: ResourceIngestionRequest = {}): Promise<ResourceIngestionSummary> {
    const analysis = buildTrainingResourceAnalysis({
        resources: req.resources,
        goals: req.goals,
    });
    const content = [
        analysis.overview,
        analysis.knowledgeBankSummary,
        `Recommended ingestion plan:\n${analysis.recommendedIngestionPlan.join("\n")}`,
        `Priority resources:\n${analysis.priorityResources.join("\n")}`,
    ].join("\n\n");
    const entries = await ingestKnowledgeEntries("training-resources-catalog", content, {
        sessionId: req.sessionId || "kcollege-resources",
        tags: ["kcollege", "training-resources", "resource-ingestion"],
        reviewStatus: "approved",
        confidence: "high",
        qualityScore: 0.92,
        sensitivity: "low",
        isSeedItem: true,
        provenance: {
            sourceType: "ingestion",
            owner: "trezzhaused",
            license: "shared-training-resources",
        },
    });

    return {
        analysis,
        entryCount: entries.length,
        entryIds: entries.map(entry => entry.id),
    };
}
