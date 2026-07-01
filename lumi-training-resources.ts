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

export interface TrainingResourceAnalysisRequest {
    resources?: string[];
    goals?: string[];
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
];

export function buildTrainingResourceAnalysis(req: TrainingResourceAnalysisRequest = {}): TrainingResourceAnalysis {
    const selectedResources = req.resources && req.resources.length > 0
        ? DEFAULT_RESOURCES.filter(resource => req.resources!.includes(resource.id))
        : DEFAULT_RESOURCES;

    const goals = req.goals && req.goals.length > 0
        ? req.goals
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
    ];

    const priorityResources = selectedResources
        .filter(resource => resource.priority === "high")
        .map(resource => resource.name);

    const recommendedIngestionPlan = [
        `Start with broad text corpora (${selectedResources.filter(resource => ["redpajama", "openwebtext", "wikitext", "commoncrawl"].includes(resource.id)).map(resource => resource.name).join(", ")}) to improve natural language coverage and style diversity.`,
        `Add multimodal datasets (${selectedResources.filter(resource => ["openimages", "coco", "laion"].includes(resource.id)).map(resource => resource.name).join(", ")}) for image, caption, and retrieval-style understanding.`,
        `Incorporate simulation and control resources (${selectedResources.filter(resource => ["mujoco", "deepblue-datasets"].includes(resource.id)).map(resource => resource.name).join(", ")}) to teach embodied reasoning and physics-informed behavior.`,
        `Use the reasoning and model resources (${selectedResources.filter(resource => ["gpt-oss", "arc-reasoning", "intellek-learning"].includes(resource.id)).map(resource => resource.name).join(", ")}) to strengthen agentic behavior, local deployment knowledge, and benchmark-driven evaluation.`,
    ];

    const knowledgeBankSummary = [
        `Lumi should treat these resources as a layered training program for ${goals.join(", ")}.`,
        "The highest-value immediate path is to combine large-scale text corpora with multimodal datasets, then add simulation and reasoning benchmarks for capability growth.",
        "For production use, ingest only curated subsets first and keep provenance, licensing, and deduplication metadata attached to each dataset entry.",
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
        overview: "This resource set covers learning materials, open-weight models, web-scale corpora, multimodal datasets, robotics simulators, and reasoning benchmarks, giving Lumi a strong foundation for broader capabilities.",
        capabilityTargets,
        priorityResources,
        recommendedIngestionPlan,
        knowledgeBankSummary,
        aiMaturityFramework,
        resources: selectedResources,
    };
}
