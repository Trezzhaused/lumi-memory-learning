export interface TrainingResource {
    id: string;
    name: string;
    url: string;
    category: "learning" | "model" | "dataset" | "benchmark" | "simulator";
    rationale: string;
    useCase: string;
    priority: "high" | "medium" | "low";
    notes: string;
}

export interface TrainingResourceAnalysis {
    generatedAt: string;
    overview: string;
    capabilityTargets: string[];
    priorityResources: string[];
    recommendedIngestionPlan: string[];
    knowledgeBankSummary: string;
    aiMaturityFramework: Array<{label: string; summary: string; useCase: string}>;
    resources: TrainingResource[];
}

export interface TrainingResourceSelectorRecord {
    id?: string;
    resourceId?: string;
}

export type TrainingResourceSelector = string | TrainingResourceSelectorRecord | Array<string | TrainingResourceSelectorRecord>;

export interface TrainingResourceAnalysisRequest {
    resources?: TrainingResourceSelector | null;
    goals?: string[] | string;
}

function normalizeTrainingResourceId(resourceId: unknown): string {
    if (typeof resourceId === "string") {
        return resourceId.trim().toLowerCase();
    }

    if (resourceId && typeof resourceId === "object") {
        const record = resourceId as Record<string, unknown>;
        const candidate = typeof record.id === "string"
            ? record.id
            : typeof record.resourceId === "string"
                ? record.resourceId
                : "";
        return candidate.trim().toLowerCase();
    }

    return "";
}

function normalizeTrainingResourceIds(resourceIds: unknown): string[] {
    const sourceValues = typeof resourceIds === "string"
        ? [resourceIds]
        : Array.isArray(resourceIds)
            ? resourceIds
            : resourceIds && typeof resourceIds === "object"
                ? [resourceIds]
                : [];

    return Array.from(new Set(
        sourceValues
            .map(resourceId => normalizeTrainingResourceId(resourceId))
            .filter(Boolean)
    ));
}

function normalizeGoals(goals: unknown): string[] {
    const sourceValues = typeof goals === "string"
        ? [goals]
        : Array.isArray(goals)
            ? goals
            : [];

    return sourceValues
        .map(goal => typeof goal === "string" ? goal.trim() : "")
        .filter(Boolean);
}

const DEFAULT_RESOURCES: TrainingResource[] = [
    {
        id: "intellek-learning",
        name: "Intellek free AI learning resources",
        url: "https://intellek.io/blog/free-ai-learning-resources/",
        category: "learning",
        rationale: "A curated entry point for AI fundamentals, practical tutorials, and curriculum-style learning material.",
        useCase: "Use as the onboarding layer for Lumi's general AI education and for turning unfamiliar concepts into structured prompts.",
        priority: "high",
        notes: "Best for broadening the knowledge base and translating high-level AI topics into short training briefs.",
    },
    {
        id: "deepblue-datasets",
        name: "University of Michigan Deep Blue dataset archive",
        url: "https://deepblue.lib.umich.edu/data/concern/data_sets/gq67jr854",
        category: "dataset",
        rationale: "A research dataset repository that can hold specialized domain data, including robotics and scientific collections.",
        useCase: "Use as a source of niche training data for domain-specific knowledge and benchmark creation.",
        priority: "medium",
        notes: "Review licensing and metadata before ingestion; good candidate for curated, high-value subsets rather than bulk ingestion.",
    },
    {
        id: "mujoco",
        name: "MuJoCo",
        url: "https://github.com/google-deepmind/mujoco",
        category: "simulator",
        rationale: "A high-performance physics engine for robotics, biomechanics, graphics, and control tasks.",
        useCase: "Train Lumi on embodied AI, control loops, physics simulation, and robotics-oriented reasoning.",
        priority: "high",
        notes: "Excellent for teaching the system how to reason about physical constraints and simulation-based feedback.",
    },
    {
        id: "meta-ai-for-good",
        name: "Meta AI for Good datasets",
        url: "https://ai.meta.com/ai-for-good/datasets/",
        category: "dataset",
        rationale: "A focused collection of datasets that are useful for socially impactful AI projects and robustness evaluation.",
        useCase: "Support domain adaptation, fairness, and application-oriented training data selection.",
        priority: "medium",
        notes: "Most useful when Lumi is being tuned for specific mission domains rather than general chat.",
    },
    {
        id: "gpt-oss",
        name: "gpt-oss",
        url: "https://github.com/openai/gpt-oss",
        category: "model",
        rationale: "Open-weight models with strong reasoning and tool-use capabilities that are suitable for local experimentation and fine-tuning workflows.",
        useCase: "Use as a reference for open-weight model deployment, local inference, and agentic reasoning patterns.",
        priority: "high",
        notes: "Great for building a practical knowledge bank around open-weight serving, quantization, and tool-calling behavior.",
    },
    {
        id: "sharegpt-4o-image",
        name: "ShareGPT-4o-Image",
        url: "https://github.com/FreedomIntelligence/ShareGPT-4o-Image",
        category: "model",
        rationale: "A multimodal image-generation reference repository for prompt design, style control, and visual reasoning workflows.",
        useCase: "Use as a reference for image generation, prompting, and creative multimodal experimentation in Lumi workflows.",
        priority: "medium",
        notes: "Useful when the task needs visual generation references or image-focused prompt scaffolding.",
    },
    {
        id: "uniworld-v1-nf4",
        name: "UniWorld V1 NF4",
        url: "https://huggingface.co/wikeeyang/UniWorld-V1-NF4/tree/main",
        category: "model",
        rationale: "A world-model and multimodal reference repository that can inform visual reasoning and spatially grounded prompt design.",
        useCase: "Use when Lumi needs a world-model perspective for scene understanding, visual planning, or spatial reasoning prompts.",
        priority: "medium",
        notes: "Helpful for benchmarking multimodal reasoning and grounding workflows against a more structured model reference.",
    },
    {
        id: "qwen3-omni-30b-a3b-thinking-awq-8bit",
        name: "Qwen3 Omni 30B A3B Thinking AWQ 8bit",
        url: "https://huggingface.co/cyankiwi/Qwen3-Omni-30B-A3B-Thinking-AWQ-8bit/tree/main",
        category: "model",
        rationale: "A thinking-oriented multimodal repository that can support reasoning-heavy prompt design and interactive model comparisons.",
        useCase: "Use as a reference for multimodal reasoning, agentic prompt refinement, and voice/image-aware conversation workflows.",
        priority: "medium",
        notes: "Best suited for research-oriented tasks that benefit from a reasoning-first multimodal model reference.",
    },
    {
        id: "qwen2.5-omni-3b-gguf",
        name: "Qwen2.5 Omni 3B GGUF",
        url: "https://huggingface.co/aoiandroid/Qwen2.5-Omni-3B-GGUF/tree/main",
        category: "model",
        rationale: "A compact multimodal repository that can support lightweight experimentation with speech, vision, and text workflows.",
        useCase: "Use as a quick, smaller-scale reference for multimodal prompting and edge-friendly inference workflows.",
        priority: "medium",
        notes: "A good fit when the task needs a compact multimodal model with lower resource requirements.",
    },
    {
        id: "redpajama",
        name: "RedPajama data",
        url: "https://github.com/togethercomputer/RedPajama-Data",
        category: "dataset",
        rationale: "A large open corpus for language model pretraining and data quality filtering research.",
        useCase: "Use as a foundational text source to strengthen general language modeling and web-text coverage.",
        priority: "high",
        notes: "The dataset is large and benefits from curation, filtering, and quality scoring before full ingestion.",
    },
    {
        id: "openimages",
        name: "Open Images",
        url: "https://storage.googleapis.com/openimages/web/download_v7.html",
        category: "dataset",
        rationale: "A large-scale image dataset with object labels and bounding boxes useful for vision tasks.",
        useCase: "Support image understanding, object detection, and multimodal grounding experiments.",
        priority: "high",
        notes: "Valuable for vision-language training once the project expands beyond text-only capabilities.",
    },
    {
        id: "coco",
        name: "COCO dataset",
        url: "https://cocodataset.org/#home",
        category: "dataset",
        rationale: "One of the most widely used datasets for image captioning, segmentation, and object recognition research.",
        useCase: "Teach Lumi how to reason over scenes, captions, and visual relationships.",
        priority: "high",
        notes: "A strong baseline multimodal dataset for captions, segmentation, and localization tasks.",
    },
    {
        id: "laion",
        name: "LAION / KNN-LAION",
        url: "https://knn.laion.ai",
        category: "dataset",
        rationale: "Large-scale image-text data that is highly relevant for multimodal and contrastive learning research.",
        useCase: "Support image-text retrieval, multimodal alignment, and dataset exploration workflows.",
        priority: "medium",
        notes: "Useful when the team wants to build or evaluate dense retrieval and multimodal embeddings.",
    },
    {
        id: "openwebtext",
        name: "OpenWebText",
        url: "https://github.com/jcpeterson/openwebtext",
        category: "dataset",
        rationale: "An open recreation of the web text corpus used for early large language model pretraining.",
        useCase: "Boost web-style language modeling and improve exposure to natural internet text.",
        priority: "high",
        notes: "A simple, high-value source for broad text diversity and style variation.",
    },
    {
        id: "wikitext",
        name: "Salesforce Wikitext",
        url: "https://huggingface.co/datasets/Salesforce/wikitext",
        category: "dataset",
        rationale: "A high-quality, curated text benchmark and training corpus based on Wikipedia articles.",
        useCase: "Improve factual, structured, and encyclopedic language modeling.",
        priority: "high",
        notes: "Excellent for quality-focused training and for measuring perplexity on clean text.",
    },
    {
        id: "commoncrawl",
        name: "Common Crawl",
        url: "https://commoncrawl.org/",
        category: "dataset",
        rationale: "A massive web archive that provides broad linguistic diversity and long-tail content.",
        useCase: "Add scale and variety to large language model training pipelines.",
        priority: "high",
        notes: "Best used with filtering and deduplication to avoid low-quality or repetitive content.",
    },
    {
        id: "the-pile",
        name: "The Pile",
        url: "https://pile.eleuther.ai/",
        category: "dataset",
        rationale: "A mixed-domain text corpus used widely in language model pretraining and evaluation.",
        useCase: "Provide a balanced corpus for broad-domain training and experimentation.",
        priority: "medium",
        notes: "A good intermediate dataset when the team wants a broad but manageable mix of sources.",
    },
    {
        id: "arc-reasoning",
        name: "ARC AI2 reasoning challenge",
        url: "https://www.kaggle.com/datasets/jeromeblanchet/arc-ai2-reasoning-challenge",
        category: "benchmark",
        rationale: "A reasoning benchmark that tests multi-step science and commonsense reasoning.",
        useCase: "Evaluate and strengthen reasoning, abstraction, and explanation quality for Lumi.",
        priority: "high",
        notes: "Use as an eval set and a source of reasoning-style examples rather than a pure pretraining corpus.",
    },
    {
        id: "autogpt",
        name: "AutoGPT",
        url: "https://github.com/Significant-Gravitas/AutoGPT",
        category: "learning",
        rationale: "A classic autonomous-agent loop that repeatedly plans, acts, observes, and replans while using tools and shell commands.",
        useCase: "Use as a reference for long-horizon task decomposition, tool use, and self-directed execution loops in Lumi.",
        priority: "high",
        notes: "Useful for understanding the core reflexive workflow behind agentic systems and their failure modes.",
    },
    {
        id: "babyagi",
        name: "BabyAGI",
        url: "https://github.com/yoheinakajima/babyagi",
        category: "learning",
        rationale: "A minimal task-queue framework that turns agent work into prioritized sub-tasks and re-queues follow-ups.",
        useCase: "Teach Lumi how to break broad goals into executable work items and revisit them as context evolves.",
        priority: "high",
        notes: "Excellent for studying lightweight planning loops and task-store semantics without a large framework overhead.",
    },
    {
        id: "superagi",
        name: "SuperAGI",
        url: "https://github.com/TransformerOptimus/SuperAGI",
        category: "learning",
        rationale: "A production-oriented agent platform for coordinating multiple autonomous agents with dashboards, memory, and toolkits.",
        useCase: "Support Lumi's research into multi-agent orchestration, monitoring, and long-running execution pipelines.",
        priority: "medium",
        notes: "Best for architecture patterns rather than as a direct runtime dependency in the current stack.",
    },
    {
        id: "genericagent",
        name: "GenericAgent",
        url: "https://github.com/lsdefine/GenericAgent",
        category: "learning",
        rationale: "A compact self-evolving agent framework that crystallizes successful executions into reusable skills stored in layered memory.",
        useCase: "Use as a blueprint for Lumi's skill-growth, memory-backed self-improvement, and minimal-agent bootstrapping.",
        priority: "high",
        notes: "Especially relevant when Lumi needs a small but extensible system for turning experience into reusable capabilities.",
    },
    {
        id: "hermes-agent",
        name: "Hermes Agent",
        url: "https://github.com/NousResearch/hermes-agent",
        category: "learning",
        rationale: "A personal assistant framework with persistent cross-session memory and a built-in learning loop that creates skills from experience.",
        useCase: "Inform Lumi's long-term memory strategy, personal assistant behavior, and skill accumulation over time.",
        priority: "high",
        notes: "A strong reference for systems that learn from repeated use and retain prior improvements across sessions.",
    },
    {
        id: "the-swarm",
        name: "The Swarm",
        url: "https://github.com/Xzeroone/The_Swarm",
        category: "learning",
        rationale: "An offline-first, local-only agent that writes code, tests it, reflects on failures, and persists learned skills across sessions.",
        useCase: "Support Lumi's offline autonomy, self-coding loops, and local-only experimentation workflows.",
        priority: "high",
        notes: "Useful for understanding how to keep agent improvements reproducible without cloud dependencies.",
    },
    {
        id: "autoresearch",
        name: "Autoresearch",
        url: "https://github.com/karpathy/autoresearch",
        category: "learning",
        rationale: "A compact research-loop framework that lets an LLM modify code, run experiments, read results, and iterate autonomously.",
        useCase: "Help Lumi learn how to run repeatable experimentation cycles for model tuning, hyperparameter search, and self-guided research.",
        priority: "medium",
        notes: "Best used as a pattern for experiment-driven automation rather than full production orchestration.",
    },
    {
        id: "hyperagents",
        name: "HyperAgents",
        url: "https://github.com/facebookresearch/HyperAgents",
        category: "learning",
        rationale: "A hierarchical meta-agent architecture where a controller rewrites or improves the task agent's code over time.",
        useCase: "Inform Lumi's self-referential improvement loop, code mutation, and architecture-level adaptation strategies.",
        priority: "high",
        notes: "A cutting-edge reference for self-modifying agent designs and meta-learning control loops.",
    },
    {
        id: "metagpt",
        name: "MetaGPT",
        url: "https://github.com/geekan/MetaGPT",
        category: "learning",
        rationale: "A multi-agent framework in which specialized roles collaborate to produce software from a one-line requirement.",
        useCase: "Teach Lumi how role-specialized agents can coordinate and decompose software delivery tasks.",
        priority: "medium",
        notes: "Not a self-training system itself, but still highly relevant for studying autonomous multi-role orchestration.",
    },
    {
        id: "yuanbao",
        name: "Yuanbao (Tencent)",
        url: "https://www.yuanbao.tencent.com",
        category: "learning",
        rationale: "A web-based AI assistant surface that can serve as an additional brainstorming and research resource for creative, coding, and knowledge work.",
        useCase: "Use as a supplemental browser-based ideation and research resource when Lumi needs alternate perspectives or rapid idea generation.",
        priority: "medium",
        notes: "Treat this as a manual or browser-driven knowledge source rather than an API-backed provider; for repeated usage, start from a fresh anonymous or non-persisted session and reinitialize between runs if the platform limits continuity.",
    },
    {
        id: "nvidia-qwen3-6-27b-nvfp4",
        name: "NVIDIA Qwen3.6-27B-NVFP4",
        url: "https://huggingface.co/nvidia/Qwen3.6-27B-NVFP4/tree/main",
        category: "model",
        rationale: "A Hugging Face-hosted NVIDIA model card and repository reference for a quantized Qwen3.6-based model that can serve as a deployment and evaluation reference.",
        useCase: "Use as a supplemental model reference for local deployment planning, quantized inference research, and capability evaluation.",
        priority: "medium",
        notes: "Treat this as a documentation and repository reference rather than an API-backed provider; no direct API integration is required for Lumi's source catalog.",
    },
];

export function buildTrainingResourceAnalysis(req: TrainingResourceAnalysisRequest = {}): TrainingResourceAnalysis {
    const requestedResourceIds = normalizeTrainingResourceIds(req.resources);
    const selectedResources = requestedResourceIds.length > 0
        ? DEFAULT_RESOURCES.filter(resource => requestedResourceIds.includes(normalizeTrainingResourceId(resource.id)))
        : DEFAULT_RESOURCES;

    const normalizedGoals = normalizeGoals(req.goals);
    const goals = normalizedGoals.length > 0
        ? normalizedGoals
        : [
            "broaden Lumi's general knowledge",
            "support multimodal and robotics capabilities",
            "improve reasoning and evaluation quality",
        ];

    const capabilityTargets = [
        "General-purpose language understanding and text generation",
        "Vision-language grounding and multimodal retrieval",
        "Embodied reasoning via robotics and simulation",
        "Reasoning, planning, and benchmark-driven evaluation",
        "Self-directed task decomposition, tool use, and long-horizon autonomy",
        "Memory-backed skill growth and self-improving agent loops",
    ];

    const priorityResources = selectedResources
        .filter(resource => resource.priority === "high")
        .map(resource => resource.name);

    const recommendedIngestionPlan = [
        `Start with broad text corpora (${selectedResources.filter(resource => ["redpajama", "openwebtext", "wikitext", "commoncrawl"].includes(resource.id)).map(resource => resource.name).join(", ")}) to improve natural language coverage and style diversity.`,
        `Add multimodal datasets (${selectedResources.filter(resource => ["openimages", "coco", "laion"].includes(resource.id)).map(resource => resource.name).join(", ")}) for image, caption, and retrieval-style understanding.`,
        `Incorporate simulation and control resources (${selectedResources.filter(resource => ["mujoco", "deepblue-datasets"].includes(resource.id)).map(resource => resource.name).join(", ")}) to teach embodied reasoning and physics-informed behavior.`,
        `Study self-evolving agent frameworks (${selectedResources.filter(resource => ["autogpt", "babyagi", "genericagent", "hermes-agent", "the-swarm", "hyperagents"].includes(resource.id)).map(resource => resource.name).join(", ")}) to strengthen long-horizon autonomy, memory-backed skill growth, and self-referential improvement loops.`,
        `Review orchestration and collaboration patterns (${selectedResources.filter(resource => ["superagi", "metagpt", "autoresearch"].includes(resource.id)).map(resource => resource.name).join(", ")}) to improve multi-role execution, experiment-driven iteration, and monitoring for autonomous missions.`,
        `Use the reasoning and model resources (${selectedResources.filter(resource => ["gpt-oss", "arc-reasoning", "intellek-learning", "yuanbao"].includes(resource.id)).map(resource => resource.name).join(", ")}) to strengthen agentic behavior, local deployment knowledge, benchmark-driven evaluation, and alternate browser-based ideation.`,
    ];

    const knowledgeBankSummary = [
        `Lumi should treat these resources as a layered training program for ${goals.join(", ")}.`,
        "The highest-value immediate path is to combine large-scale text corpora with multimodal datasets, then add simulation, reasoning benchmarks, and self-evolving agent frameworks for capability growth.",
        "For production use, ingest only curated subsets first and keep provenance, licensing, and deduplication metadata attached to each dataset entry.",
        "Self-directed agent patterns should be treated as a second layer after core language and multimodal training, with safety, auditability, and memory constraints applied from the start.",
    ].join(" ");

    const aiMaturityFramework = [
        {
            label: "Artificial Narrow Intelligence (ANI)",
            summary: "Specialized AI that is excellent at defined tasks such as search, automation, classification, and workflow support.",
            useCase: "Best for immediate business impact and production-ready automation.",
        },
        {
            label: "Artificial General Intelligence (AGI)",
            summary: "A future class of AI that can transfer skills across domains, reason broadly, and adapt to new contexts.",
            useCase: "Best as a long-term roadmap for autonomous work across planning, research, and execution.",
        },
        {
            label: "Artificial Superintelligence (ASI)",
            summary: "A speculative layer of intelligence that would exceed human capabilities across most domains and require strict safety controls.",
            useCase: "Best treated as a governance and strategic planning horizon rather than an immediate implementation target.",
        },
    ];

    return {
        generatedAt: new Date().toISOString(),
        overview: "This resource set covers learning materials, open-weight models, web-scale corpora, multimodal datasets, robotics simulators, reasoning benchmarks, and self-evolving agent frameworks, giving Lumi a strong foundation for broader capabilities and long-horizon autonomy.",
        capabilityTargets,
        priorityResources,
        recommendedIngestionPlan,
        knowledgeBankSummary,
        aiMaturityFramework,
        resources: selectedResources,
    };
}
