export interface PromptTrainerRequest {
    topic?: string;
    audience?: string;
    goal?: string;
    context?: string;
}

export interface PromptTrainerResult {
    title: string;
    objective: string;
    successMetrics: string[];
    promptTemplate: string;
    evaluationChecklist: string[];
    followUpQuestions: string[];
}

export function buildPromptTrainer(req: PromptTrainerRequest = {}): PromptTrainerResult {
    const topic = req.topic || "Developer productivity and AI platform adoption";
    const audience = req.audience || "engineering teams and product builders";
    const goal = req.goal || "help teams ship higher-quality AI apps faster with guardrails";
    const context = req.context || "Use natural language as the central interface, combine models, APIs, and workflows, and make evaluation and safety built-in.";

    return {
        title: `Prompt trainer for ${topic}`,
        objective: `Create a practical prompt-training brief for ${audience} so they can ${goal}.`,
        successMetrics: [
            "The prompt is specific about the business outcome.",
            "The prompt includes success criteria, constraints, and examples.",
            "The prompt asks for evaluation, guardrails, and iteration steps.",
            "The prompt can be reused across multiple teams and workflows.",
        ],
        promptTemplate: `You are an AI enablement coach for ${audience}.\n\nContext: ${context}\n\nGoal: ${goal}\n\nCreate a prompt that:\n1. Defines the task clearly.\n2. Specifies the audience and desired outcome.\n3. Includes quality criteria and guardrails.\n4. Asks for a concrete deliverable or workflow.\n5. Suggests how to evaluate success.`,
        evaluationChecklist: [
            "Does the prompt clearly state the business problem?",
            "Does it tell the model what good output looks like?",
            "Does it include constraints, tool usage, or compliance notes?",
            "Does it define how results should be tested or reviewed?",
        ],
        followUpQuestions: [
            "What domain expertise should the model assume?",
            "What outputs should be rejected or flagged?",
            "What examples or reference answers should be included?",
            "How should the system measure quality over time?",
        ],
    };
}
