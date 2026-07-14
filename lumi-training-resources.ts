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

export interface ResourcePromptPattern {
    name: string;
    useCase: string;
    promptTemplate: string;
    instructionSet: string[];
}

export interface TrainingResourceAnalysis {
    generatedAt: string;
    overview: string;
    capabilityTargets: string[];
    priorityResources: string[];
    recommendedIngestionPlan: string[];
    knowledgeBankSummary: string;
    promptPatterns: ResourcePromptPattern[];
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
        id: "awesome-courses",
        name: "Awesome CS Courses",
        url: "https://github.com/prakhar1989/awesome-courses",
        category: "learning",
        rationale: "A curated catalog of free university-quality computer science courses with lectures, notes, assignments, and exams that can inform curriculum design and topic sequencing.",
        useCase: "Use for education-game content planning, technical skill progression, and discovery of strong course modules that can be adapted into game-based learning paths.",
        priority: "high",
        notes: "Especially useful for building structured learning journeys in systems, AI, ML, security, graphics, and theory topics.",
    },
    {
        id: "a-to-z-students",
        name: "A to Z Resources for Students",
        url: "https://github.com/dipakkr/A-to-Z-Resources-for-Students.git",
        category: "learning",
        rationale: "A broad collection of student-facing educational resources, roadmaps, and study-path references that can support curriculum scaffolding and enrichment planning.",
        useCase: "Use to help Lumi assemble curriculum-aligned learning paths, student study guides, and enrichment resources for broader education workflows.",
        priority: "high",
        notes: "Especially useful for expanding student-facing reference materials and surfacing well-organized study pathways.",
    },
    {
        id: "awesome-claude-code-subagents",
        name: "Awesome Claude Code Subagents",
        url: "https://github.com/VoltAgent/awesome-claude-code-subagents.git",
        category: "learning",
        rationale: "A curated catalog of sub-agent patterns and implementations that can inform agent orchestration, delegation, and tool-use decomposition.",
        useCase: "Use to guide Lumi's agentic design, multi-agent workflows, and policy-checked task decomposition for systems work.",
        priority: "high",
        notes: "Useful for planning delegated specialist agents and modular tool orchestration.",
    },
    {
        id: "awesome-agent-skills",
        name: "Awesome Agent Skills",
        url: "https://github.com/VoltAgent/awesome-agent-skills.git",
        category: "learning",
        rationale: "A catalog of reusable agent capabilities and skills that can be mapped into task-specific competencies and prompt templates.",
        useCase: "Use to help Lumi build skill libraries, specialist prompts, and modular capabilities for curriculum and system workflows.",
        priority: "high",
        notes: "A strong fit for skill discovery, capability composition, and reusable agent behaviors.",
    },
    {
        id: "awesome-deep-learning",
        name: "Awesome Deep Learning",
        url: "https://github.com/ChristosChristofidis/awesome-deep-learning.git",
        category: "learning",
        rationale: "A curated reference for deep-learning topics, papers, tools, and tutorials that supports curriculum design and technical capability planning.",
        useCase: "Use to expand Lumi's deep-learning education pathways, model-selection discussions, and research-oriented lesson planning.",
        priority: "high",
        notes: "Good for building a structured roadmap around neural networks, optimization, and applied machine learning.",
    },
    {
        id: "awesome-stock-resources",
        name: "Awesome Stock Resources",
        url: "https://github.com/neutraltone/awesome-stock-resources.git",
        category: "learning",
        rationale: "A curated collection of stock-image and media asset sources that helps with visual-content planning and multimodal projects.",
        useCase: "Use to support image sourcing, educational media curation, and visual design workflows for lessons, UI mockups, and content production.",
        priority: "medium",
        notes: "Useful for multimodal and media-rich educational content planning.",
    },
    {
        id: "awesome-math",
        name: "Awesome Math",
        url: "https://github.com/rossant/awesome-math.git",
        category: "learning",
        rationale: "A curated list of mathematics resources, tutorials, and references that can strengthen math curriculum planning, reasoning exercises, and quantitative skill pathways.",
        useCase: "Use to support Lumi's math education workflows, problem-generation ideas, and structured learning paths across foundational and advanced mathematics.",
        priority: "high",
        notes: "Especially useful for sequencing math topics and aligning practice content with learner level.",
    },
    {
        id: "system-prompts-leaks",
        name: "System Prompts Leaks",
        url: "https://github.com/asgeirtj/system_prompts_leaks",
        category: "benchmark",
        rationale: "A public collection of documented system prompts for major AI assistants that can be used to study prompt structure, tool-use behavior, and guardrail patterns for red-team evaluation.",
        useCase: "Use for adversarial prompt analysis, prompt-hardening experiments, and stress-testing Lumi's safety and routing behavior in a controlled research setting.",
        priority: "medium",
        notes: "Best used as a red-team reference and evaluation resource, not as general educational content or a production prompt source.",
    },
    {
        id: "gobooks",
        name: "GoBooks",
        url: "https://github.com/dariubs/GoBooks",
        category: "learning",
        rationale: "A curated collection of Go books and learning resources for beginners through advanced developers that can support structured programming curricula and self-paced learning paths.",
        useCase: "Use to support Lumi's Go-language education workflows, book-based curriculum sequencing, and beginner-to-advanced skill progression planning.",
        priority: "high",
        notes: "Especially useful for technical education and programming pathways; review the repository's curated recommendations and any external book-link context before publishing a lesson plan.",
    },
    {
        id: "mit-learn-competency-based",
        name: "MIT Learn competency-based education materials",
        url: "https://learn.mit.edu/search?resource=2764&resource_title=competency-based-education",
        category: "learning",
        rationale: "MIT Learn's competency-based education materials offer a strong reference for designing learner-centered pathways, assessment structures, and implementation guidance.",
        useCase: "Use to help Lumi reason about competency maps, standards-aligned curriculum design, and evidence-based instructional planning for K-12 settings.",
        priority: "high",
        notes: "Particularly useful for curriculum designers who want to connect learning goals, performance evidence, and student agency.",
    },
    {
        id: "mit-ocw-educators",
        name: "MIT OpenCourseWare for educators",
        url: "https://learn.mit.edu/c/unit/ocw",
        category: "learning",
        rationale: "MIT OpenCourseWare gives Lumi access to free, openly licensed course content that can be adapted into lesson plans, project-based learning units, and teacher-facing materials.",
        useCase: "Use when designing enrichment modules, classroom-ready activities, or cross-disciplinary K-12 learning experiences.",
        priority: "high",
        notes: "Best applied as a source of structured content and pedagogical patterns rather than as a complete curriculum package.",
    },
    {
        id: "mit-open-learning-k12",
        name: "MIT Open Learning K-12 teacher resources",
        url: "https://openlearning.mit.edu/news/free-mit-courses-and-resources-help-k-12-teachers-make-school-year-success",
        category: "learning",
        rationale: "MIT Open Learning highlights free courses and resources that support K-12 teachers with practical instructional strategies and professional development content.",
        useCase: "Support Lumi in generating teacher-friendly curriculum briefs, pacing suggestions, and classroom resource recommendations for K-12 environments.",
        priority: "medium",
        notes: "Useful for framing how educators can adapt MIT content for everyday classroom use and school-year planning.",
    },
    {
        id: "valdosta-k12-oer",
        name: "Valdosta State K-12 Open Educational Resources",
        url: "https://libguides.valdosta.edu/K-12_oers",
        category: "learning",
        rationale: "A curated gateway to open textbooks, lesson modules, and teacher support materials that can be reused or adapted for K-12 classrooms.",
        useCase: "Use to help Lumi surface openly licensed curriculum materials, classroom resources, and teacher-facing support for K-12 instruction.",
        priority: "high",
        notes: "Especially useful for OER discovery, low-cost curriculum planning, and finding open textbook alternatives.",
    },
    {
        id: "coreknowledge-free-curriculum",
        name: "Core Knowledge free curriculum",
        url: "https://www.coreknowledge.org/download-free-curriculum/",
        category: "learning",
        rationale: "Core Knowledge offers free, content-rich curriculum resources organized by grade and subject, with a strong emphasis on coherent scope and sequence.",
        useCase: "Support Lumi in generating grade-level learning sequences, coherent K-8 unit plans, and content-rich curriculum structures.",
        priority: "high",
        notes: "Strong fit for curriculum design workflows that need a logical progression of knowledge across grades and subjects.",
    },
    {
        id: "k12-kgraph-dataset",
        name: "K12-KGraph curriculum-aligned benchmark dataset",
        url: "https://github.com/haolpku/K12-Dataset",
        category: "dataset",
        rationale: "K12-KGraph is a curriculum-aligned knowledge graph and benchmark built from official K-12 textbooks, with question and training data for curriculum cognition tasks.",
        useCase: "Use as a benchmark source for educational QA, curriculum-aware question generation, and evaluation of K-12 reasoning and structure understanding.",
        priority: "high",
        notes: "A powerful resource for building benchmark-style educational datasets. Review the repository LICENSE file and any dataset card before deployment.",
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
        id: "awesome-ai-agents",
        name: "Awesome AI Agents",
        url: "https://github.com/e2b-dev/awesome-ai-agents.git",
        category: "learning",
        rationale: "A curated catalog of open-source AI agent projects, frameworks, and examples that can be evaluated before relying on proprietary or paid services.",
        useCase: "Use as the first-stop reference for discovering free open-source agents, agent architectures, tool-use patterns, and implementation examples that fit Lumi's local-first roadmap.",
        priority: "high",
        notes: "Best used as a discovery layer for open-source agents and agentic workflows; prioritize this before Claude/GPT/paid services for experimentation and adaptation.",
    },
    {
        id: "awesome-generative-ai",
        name: "Awesome Generative AI",
        url: "https://github.com/steven2358/awesome-generative-ai.git",
        category: "learning",
        rationale: "A curated catalog of generative-AI projects, papers, tools, and references that helps with model and workflow discovery for creative and production use cases.",
        useCase: "Use to broaden Lumi's generative-AI education, tool discovery, and prompt-driven content workflows for education programs, creator tooling, and product prototyping.",
        priority: "high",
        notes: "Useful as a discovery layer for generative-AI ecosystems, emerging techniques, and practical examples that can be adapted into training material.",
    },
    {
        id: "awesome-nano-banana-pro-prompts",
        name: "Awesome Nano Banana Pro Prompts",
        url: "https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts.git",
        category: "learning",
        rationale: "A prompt catalog useful for experimenting with instruction design, multimodal generation, and richer prompt patterns in creative and educational workflows.",
        useCase: "Use to help Lumi generate stronger multimodal prompts, evaluate prompt libraries, and shape education or creator-facing workflows around visual generation.",
        priority: "medium",
        notes: "Best suited for prompt-library expansion and multimodal experimentation rather than core curriculum planning.",
    },
    {
        id: "mind-expanding-books",
        name: "Mind Expanding Books",
        url: "https://github.com/hackerkid/Mind-Expanding-Books.git",
        category: "learning",
        rationale: "A curated reading list for broadening knowledge across science, technology, philosophy, and creativity, which helps with enrichment and self-directed learning programs.",
        useCase: "Use to support Lumi's reading-path planning, enrichment programs, and human-centered learning experiences that benefit from curated book recommendations.",
        priority: "medium",
        notes: "A good fit for building a humanistic or enrichment layer around technical education and personal-growth programs.",
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
        "K-12 curriculum design, competency-based assessment, educator-facing lesson planning, and curriculum-aware question generation",
    ];

    const priorityResources = selectedResources
        .filter(resource => resource.priority === "high")
        .map(resource => resource.name);

    const recommendedIngestionPlan = [
        `Start with broad text corpora (${selectedResources.filter(resource => ["redpajama", "openwebtext", "wikitext", "commoncrawl"].includes(resource.id)).map(resource => resource.name).join(", ")}) to improve natural language coverage and style diversity.`,
        `Add multimodal datasets (${selectedResources.filter(resource => ["openimages", "coco", "laion"].includes(resource.id)).map(resource => resource.name).join(", ")}) for image, caption, and retrieval-style understanding.`,
        `Incorporate simulation and control resources (${selectedResources.filter(resource => ["mujoco", "deepblue-datasets"].includes(resource.id)).map(resource => resource.name).join(", ")}) to teach embodied reasoning and physics-informed behavior.`,
        `Use the MIT educator resources (${selectedResources.filter(resource => ["mit-learn-competency-based", "mit-ocw-educators", "mit-open-learning-k12"].includes(resource.id)).map(resource => resource.name).join(", ")}) to build K-12 curriculum planning, competency-based assessment, and teacher-facing lesson design support.`,
        `Use the programming-language learning resources (${selectedResources.filter(resource => ["gobooks", "awesome-courses", "intellek-learning"].includes(resource.id)).map(resource => resource.name).join(", ")}) to build coding-curriculum pathways, progression maps, and project-based learning sequences.`,
        `Use the K-12 curriculum resources (${selectedResources.filter(resource => ["valdosta-k12-oer", "coreknowledge-free-curriculum", "k12-kgraph-dataset"].includes(resource.id)).map(resource => resource.name).join(", ")}) to strengthen OER discovery, curriculum sequencing, and curriculum-aware question generation.`,
        `Use the open-source agent catalog (${selectedResources.filter(resource => ["awesome-ai-agents", "gpt-oss", "intellek-learning"].includes(resource.id)).map(resource => resource.name).join(", ")}) to prioritize free agent implementations, local-first architectures, and benchmarked agent behavior before paying for proprietary services.`,
        `Use the generative-AI and prompt resources (${selectedResources.filter(resource => ["awesome-generative-ai", "awesome-nano-banana-pro-prompts"].includes(resource.id)).map(resource => resource.name).join(", ")}) to broaden prompt engineering, multimodal content creation, and creator-focused workflow design.`,
        `Use the student-facing and domain-resource collections (${selectedResources.filter(resource => ["a-to-z-students", "awesome-math", "awesome-deep-learning"].includes(resource.id)).map(resource => resource.name).join(", ")}) to broaden education pathways, structured study guides, and domain-specific technical lesson planning.`,
        `Use the sub-agent and skill catalogs (${selectedResources.filter(resource => ["awesome-claude-code-subagents", "awesome-agent-skills"].includes(resource.id)).map(resource => resource.name).join(", ")}) to structure delegation patterns, reusable skills, and modular agent workflows.`,
        `Use the visual media catalog (${selectedResources.filter(resource => ["awesome-stock-resources"].includes(resource.id)).map(resource => resource.name).join(", ")}) when the curriculum or interface needs stock imagery or other multimodal assets.`,
        `Use the culture and enrichment resources (${selectedResources.filter(resource => ["mind-expanding-books"].includes(resource.id)).map(resource => resource.name).join(", ")}) to add reading paths, interdisciplinary inspiration, and broader self-directed learning options.`,
        `Use the reasoning and model resources (${selectedResources.filter(resource => ["gpt-oss", "arc-reasoning", "intellek-learning"].includes(resource.id)).map(resource => resource.name).join(", ")}) to strengthen agentic behavior, local deployment knowledge, and benchmark-driven evaluation.`,
    ];

    const knowledgeBankSummary = [
        `Lumi should treat these resources as a layered training program for ${goals.join(", ")}.`,
        "For K-12 resources, confirm licensing, provenance, and adaptation constraints before using them in a published workflow or retraining pass.",
        "The highest-value immediate path is to combine large-scale text corpora with multimodal datasets, then add simulation and reasoning benchmarks for capability growth.",
        "MIT-based educator materials are especially useful for K-12 curriculum planning, competency-based education, and teacher-facing resource curation.",
        "Open educational resources, curriculum sequencing frameworks, and curriculum-aligned benchmark datasets provide strong support for curriculum design and curriculum-aware question generation.",
        "GoBooks should be used as a structured programming-education reference for Go-language curriculum design, reading paths, and skill progression.",
        "Student-facing study collections, math resources, and deep-learning references are useful for expanding curriculum scaffolds, enrichment pathways, and domain-specific lesson planning.",
        "The open-source agent catalog and sub-agent/skill catalogs should be prioritized as a discovery layer for free agent implementations, tool-use patterns, reusable capabilities, and local-first architectures before moving to Claude, GPT, or paid services.",
        "Generative-AI and prompt-resource collections should be used to expand prompt engineering, multimodal content creation, and creator-facing education workflows without relying solely on proprietary tooling.",
        "Mind-expanding book lists add an enrichment layer for reading pathways, interdisciplinary inspiration, and self-directed learning experiences.",
        "stock-image collections support image-rich educational assets and visual media planning for multimodal learning experiences.",
        "For production use, ingest only curated subsets first and keep provenance, licensing, and deduplication metadata attached to each dataset entry.",
    ].join(" ");

    const promptPatterns: ResourcePromptPattern[] = [
        {
            name: "K-12 curriculum planner",
            useCase: "Use this pattern when Lumi needs to turn the curated K-12 resources into a standards-aware curriculum, unit, or lesson plan.",
            promptTemplate: [
                "You are Lumi acting as a K-12 curriculum planner.",
                "First confirm the grade band, subject, standards, timeframe, and learner profile.",
                "Use MIT Learn competency-based education materials to define outcomes, evidence of mastery, and learner agency.",
                "Use MIT OpenCourseWare educator content and MIT Open Learning K-12 teacher resources to shape pacing, activities, and teacher supports.",
                "Use Valdosta State K-12 OER, Core Knowledge, and the K12-KGraph benchmark dataset to find open materials, scope-and-sequence patterns, and curriculum-aware question ideas.",
                "Deliver a concise plan with learning goals, essential questions, unit sequence, assessment ideas, differentiation, and a short list of cited resources.",
            ].join("\n"),
            instructionSet: [
                "Start by confirming the grade band, subject, standards, and duration.",
                "Translate the request into measurable learning outcomes and evidence of mastery.",
                "Select one or two high-value resources from the curated set for each planning layer.",
                "Keep the output classroom-ready and note where local standards or district policy may require adaptation.",
                "End with a short reflection on how the plan can be differentiated for diverse learners.",
            ],
        },
    ];

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
        overview: [
            "This resource set covers learning materials, open-weight models, web-scale corpora, multimodal datasets, robotics simulators, reasoning benchmarks, free/open-source agent catalogs, curated programming-learning resources such as GoBooks, student-facing and curriculum resources, sub-agent and skill catalogs, deep-learning references, stock-media libraries, mathematics resources, and generative-AI/prompt and enrichment collections.",
            "It also incorporates MIT educator resources and K-12 OER, curriculum, and benchmark datasets for curriculum design and educational QA, giving Lumi a strong foundation for broader capabilities.",
        ].join(" "),
        capabilityTargets,
        priorityResources,
        recommendedIngestionPlan,
        knowledgeBankSummary,
        promptPatterns,
        aiMaturityFramework,
        resources: selectedResources,
    };
}
