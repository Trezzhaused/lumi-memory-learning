export interface ExternalBrowserSourceSelectorRecord {
    id?: string;
    sourceId?: string;
}

export type ExternalBrowserSourceSelector = string | ExternalBrowserSourceSelectorRecord | Array<string | ExternalBrowserSourceSelectorRecord>;

export interface ExternalBrowserSource {
    id: string;
    name: string;
    url: string;
    category: "research" | "chat" | "search";
    requiresBrowserAutomation: boolean;
    backend: "api" | "browser-automation" | "manual";
    availability: "ready" | "pending";
    notes: string;
    sessionHint: string;
}

export interface ExternalBrowserSourcePlan {
    requestedSources: string[];
    sources: ExternalBrowserSource[];
    automationConfigured: boolean;
    workflowNote: string;
    nextSteps: string[];
}

export interface ExternalBrowserSourceQueryResult {
    sourceId: string;
    ok: boolean;
    status: number;
    usedBackend: "proxy" | "manual";
    content?: string;
    error?: string;
}

export const DEFAULT_EXTERNAL_BROWSER_SOURCE_ID = "yuanbao";

const DEFAULT_EXTERNAL_SOURCES: ExternalBrowserSource[] = [
    {
        id: DEFAULT_EXTERNAL_BROWSER_SOURCE_ID,
        name: "Yuanbao (Tencent)",
        url: "https://www.yuanbao.tencent.com",
        category: "chat",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "A browser-based AI assistant surface that can be used for alternate ideation, research, and creative exploration; reinitialize from a fresh anonymous or non-persisted session when continuity limits or session state becomes inconsistent.",
        sessionHint: "Prefer a fresh anonymous or non-persisted browser session and reinitialize between runs if continuity is limited.",
    },
    {
        id: "qwen-agentworld-35b-a3b-gguf",
        name: "Qwen AgentWorld 35B A3B GGUF (Unsloth)",
        url: "https://huggingface.co/unsloth/Qwen-AgentWorld-35B-A3B-GGUF/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Agent-world and reasoning-oriented repository that can support prompt scaffolding and structured exploration for Lumi workflows.",
        sessionHint: "Open this repository when you want a more agentic reference while drafting a task for Lumi.",
    },
    {
        id: "qwen3.6-40b-claude-opus-deckard-heretic-uncensored-thinking",
        name: "Qwen3.6 40B Claude 4.6 Opus Deckard Heretic Uncensored Thinking (DavidAU)",
        url: "https://huggingface.co/DavidAU/Qwen3.6-40B-Claude-4.6-Opus-Deckard-Heretic-Uncensored-Thinking",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "User-preferred reference for Lumi workflows; useful for long-form reasoning, prompt refinement, and exploratory synthesis.",
        sessionHint: "Treat this as the preferred repository when you want a strong reasoning-oriented reference for Lumi conversations.",
    },
    {
        id: "gemma-4-31b-it-claude-opus-distill-v2-gguf",
        name: "Gemma 4 31B IT Claude Opus Distill v2 GGUF (TeichAI)",
        url: "https://huggingface.co/TeichAI/gemma-4-31B-it-Claude-Opus-Distill-v2-GGUF/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Distilled reasoning-style repository that can inform prompt upgrades and structured content generation workflows.",
        sessionHint: "Open this repo when the task benefits from a distilled instruction-following reference.",
    },
    {
        id: "gemma-4-e4b-it-the-deckard-expresso-universe-heretic-uncensored-thinking",
        name: "Gemma 4 E4B IT The DECKARD Expresso Universe HERETIC UNCENSORED Thinking (DavidAU)",
        url: "https://huggingface.co/DavidAU/gemma-4-E4B-it-The-DECKARD-Expresso-Universe-HERETIC-UNCENSORED-Thinking/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Alternative reasoning-heavy repository that can be used for prompt experimentation and creative synthesis loops.",
        sessionHint: "Use this repo as a comparison point when testing different reasoning styles or prompt variants.",
    },
    {
        id: "locateanything-3b",
        name: "LocateAnything 3B (NVIDIA)",
        url: "https://huggingface.co/nvidia/LocateAnything-3B/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Free Hugging Face repository for object localization and grounding; useful as a reference for browser-assisted image and video understanding workflows.",
        sessionHint: "Open the model card in a dedicated tab and keep the repository page handy while exploring image/video prompts.",
    },
    {
        id: "cosmos3-nano",
        name: "Cosmos3 Nano (NVIDIA)",
        url: "https://huggingface.co/nvidia/Cosmos3-Nano/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Compact multimodal generation repository for fast video-world-model experimentation and reference-based creative loops.",
        sessionHint: "Use a fresh browser session when switching between model repos to avoid stateful UI issues.",
    },
    {
        id: "cosmos-predict2-2b-video2world",
        name: "Cosmos Predict2 2B Video2World (NVIDIA)",
        url: "https://huggingface.co/nvidia/Cosmos-Predict2-2B-Video2World/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Video-to-world generation repository for building scene-consistent video workflows from prompts and references.",
        sessionHint: "Keep the repository open while drafting a prompt so you can compare the model's documented capabilities with the browser output.",
    },
    {
        id: "cosmos3-super-image2video",
        name: "Cosmos3 Super Image2Video (NVIDIA)",
        url: "https://huggingface.co/nvidia/Cosmos3-Super-Image2Video/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Image-conditioned video generation repository for converting still images into short clips with browser-based creative workflows.",
        sessionHint: "Use the repository as a reference when selecting image-to-video prompts and camera motion controls.",
    },
    {
        id: "nemotron-3-nano-omni-30b-a3b-reasoning-gguf",
        name: "Nemotron 3 Nano Omni 30B A3B Reasoning (NVIDIA, GGUF)",
        url: "https://huggingface.co/unsloth/NVIDIA-Nemotron-3-Nano-Omni-30B-A3B-Reasoning-GGUF",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Reasoning-focused multimodal repository that can act as a reference for prompt refinement, summarization, and structured generation tasks.",
        sessionHint: "Open the repository alongside a fresh chat tab so the prompt can be iterated against the documented model behavior.",
    },
    {
        id: "cosmos-transfer1-7b-4kupscaler",
        name: "Cosmos Transfer1 7B 4K Upscaler (NVIDIA)",
        url: "https://huggingface.co/nvidia/Cosmos-Transfer1-7B-4KUpscaler",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Super-resolution and upscaling repository for enhancing generated images and video clips in browser-based media pipelines.",
        sessionHint: "Use this model as a reference when the workflow needs a final polish pass for image or video outputs.",
    },
    {
        id: "nemotron-mini-4b-instruct",
        name: "Nemotron Mini 4B Instruct (NVIDIA)",
        url: "https://huggingface.co/nvidia/Nemotron-Mini-4B-Instruct",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Compact instruction-following text model repository useful for prompt drafting, editing, and structured content generation.",
        sessionHint: "Keep the inference card handy when refining system prompts or rewriting generated copy.",
    },
    {
        id: "acemath-7b-instruct",
        name: "AceMath 7B Instruct (NVIDIA)",
        url: "https://huggingface.co/nvidia/AceMath-7B-Instruct/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Math and reasoning-focused repository helpful for structured generation, planning, and evaluation steps.",
        sessionHint: "Open this repo when the goal includes step-by-step reasoning or formalized problem solving.",
    },
    {
        id: "magnum-v4-72b",
        name: "Magnum v4 72B (Anthracite)",
        url: "https://huggingface.co/anthracite-org/magnum-v4-72b",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Large language model repository for long-form text generation, summarization, and deeper reasoning tasks.",
        sessionHint: "Use this repo when the browser workflow needs richer long-form text or analytical synthesis.",
    },
    {
        id: "qwen2.5-72b-instruct",
        name: "Qwen2.5 72B Instruct (Alibaba)",
        url: "https://huggingface.co/Qwen/Qwen2.5-72B-Instruct/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "General-purpose instruction-following model repository for text generation, translation, and prompt refinement.",
        sessionHint: "Use this repo as a comparison reference when testing creative or instructional text workflows.",
    },
    {
        id: "mimo-audio-7b-instruct",
        name: "MiMo Audio 7B Instruct (Xiaomi)",
        url: "https://huggingface.co/XiaomiMiMo/MiMo-Audio-7B-Instruct/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Audio-focused multimodal repository for speech and sound generation tasks in browser-assisted media flows.",
        sessionHint: "Open this model card when the work includes voice, sound, or audio-directed generation.",
    },
    {
        id: "mythos-fast",
        name: "Mythos Fast (Shadow0482)",
        url: "https://huggingface.co/Shadow0482/mythos_fast/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Fast model repository that can serve as a lightweight reference for rapid text and media ideation loops.",
        sessionHint: "Use this repo when you want a quick reference while iterating on a browser-based creative prompt.",
    },
    {
        id: "mimo-v2.5-asr",
        name: "MiMo V2.5 ASR (Xiaomi)",
        url: "https://huggingface.co/XiaomiMiMo/MiMo-V2.5-ASR/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Automatic speech recognition repository for transcription-heavy workflows and voice-driven content pipelines.",
        sessionHint: "Use this repo when browser-based voice capture needs transcription, indexing, or captioning support.",
    },
    {
        id: "deephat-v1-7b",
        name: "DeepHat V1 7B (DeepHat)",
        url: "https://huggingface.co/DeepHat/DeepHat-V1-7B/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Text generation and reasoning repository that can support prompt refinement and content drafting steps.",
        sessionHint: "Keep this repository available when you need to cross-check prompt behavior or generation style.",
    },
    {
        id: "neutts-air",
        name: "Neutts Air (Neuphonic)",
        url: "https://huggingface.co/neuphonic/neutts-air/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Text-to-speech and speech synthesis repository for voice generation and audio workflow experimentation.",
        sessionHint: "Open this repo when the task involves voice, narration, or speech-style generation.",
    },
    {
        id: "secgpt",
        name: "SecGPT (Clouditera)",
        url: "https://huggingface.co/clouditera/secgpt",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Security-oriented reasoning and summarization repository that can inform safety-aware generation and policy checks.",
        sessionHint: "Use this repo when the workflow needs a safety-oriented reference for generated content or agent behavior.",
    },
    {
        id: "skyreels-v2-t2v-14b-540p",
        name: "SkyReels V2 T2V 14B 540P (Skywork)",
        url: "https://huggingface.co/Skywork/SkyReels-V2-T2V-14B-540P",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Video generation repository for text-to-video synthesis and prompt exploration in browser-based media flows.",
        sessionHint: "Keep this repository open while iterating on video prompts and scene descriptions.",
    },
    {
        id: "krea-2-turbo",
        name: "Krea 2 Turbo (Krea)",
        url: "https://huggingface.co/krea/Krea-2-Turbo/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Fast image and video generation repository for iterative creative workflows and browser-assisted media generation.",
        sessionHint: "Use this repo as a rapid reference when you need to iterate quickly on style, motion, or composition prompts.",
    },
    {
        id: "sunnyteacher16b-v2",
        name: "SunnyTeacher16B v2 (JCabs)",
        url: "https://huggingface.co/JCabs/SunnyTeacher16Bv2",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "K-12 teaching-oriented model repository for tutoring, lesson support, and educational prompt design.",
        sessionHint: "Use this repository when the workflow needs a classroom-friendly teaching reference.",
    },
    {
        id: "innospark3.0-9b-260630",
        name: "InnoSpark3.0 9B (SII Research)",
        url: "https://huggingface.co/sii-research/InnoSpark3.0-9B-260630/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "K-12 and STEM-oriented model repository for creative educational activities and classroom prompts.",
        sessionHint: "Open this repo when the use case involves project-based learning or student exploration.",
    },
    {
        id: "aryabhata-2.0",
        name: "Aryabhata 2.0 (PhysicsWallahAI)",
        url: "https://huggingface.co/PhysicsWallahAI/Aryabhata-2.0/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Educational model repository useful for tutoring, math explanations, and curriculum-oriented content generation.",
        sessionHint: "Use this repo as a reference when the task needs a structured STEM or math teaching perspective.",
    },
    {
        id: "safemathbot",
        name: "SafeMathBot (UF AICE Lab)",
        url: "https://huggingface.co/uf-aice-lab/SafeMathBot/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Math-focused educational repository for safe and guided problem solving in K-12 learning contexts.",
        sessionHint: "Open this repo when the workflow needs a math-specific teaching or tutoring reference.",
    },
    {
        id: "k-12bert",
        name: "K-12BERT (Vasu Goel)",
        url: "https://huggingface.co/vasugoel/K-12BERT/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Educational language model repository for reading, comprehension, and K-12 text analysis tasks.",
        sessionHint: "Use this repo when the workflow benefits from a school-focused language understanding reference.",
    },
    {
        id: "catholic-phi3-mini",
        name: "Catholic Phi3 Mini (KAkston)",
        url: "https://huggingface.co/KAkston/Catholic-Phi3-Mini/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Catholic school-oriented educational repository for faith-sensitive tutoring and classroom prompts.",
        sessionHint: "Use this repo when the workflow requires a religious-education-specific reference.",
    },
    {
        id: "pocket-tutor-minicpmv-socratic",
        name: "Pocket Tutor MiniCPMV Socratic (Build Small Hackathon)",
        url: "https://huggingface.co/build-small-hackathon/pocket-tutor-minicpmv-socratic/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Socratic tutoring repository that can support guided questioning and pedagogical interactions.",
        sessionHint: "Open this repo when the workflow needs a question-driven tutoring reference.",
    },
    {
        id: "gpt2-student-suggester",
        name: "GPT-2 Student Suggester (LyubomirT)",
        url: "https://huggingface.co/LyubomirT/gpt2-student-suggester/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Student support repository for suggestion-based educational assistance and study help.",
        sessionHint: "Use this repo when the workflow needs a lightweight student-support reference.",
    },
    {
        id: "modernbert-readability-grade-predictor",
        name: "ModernBERT Readability Grade Predictor (Kiddom)",
        url: "https://huggingface.co/kiddom/modernbert-readability-grade-predictor/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Readability and grade-level prediction repository for text adaptation and educational content analysis.",
        sessionHint: "Use this repo when the task involves leveling text for students or adjusting educational difficulty.",
    },
    {
        id: "xlent-asag",
        name: "XLENT ASAG (Kenzy Khaled)",
        url: "https://huggingface.co/kenzykhaled/XLENT_ASAG/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Automated short-answer grading repository for formative assessment and feedback scenarios.",
        sessionHint: "Open this repo when the workflow needs an assessment-oriented reference.",
    },
    {
        id: "dyslexia-friendly-text-simplifier",
        name: "Dyslexia-Friendly Text Simplifier (Elvis Bakunzi)",
        url: "https://huggingface.co/elvisbakunzi/dyslexia-friendly-text-simplifier/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Accessibility-oriented text simplification repository for dyslexia-friendly educational content support.",
        sessionHint: "Use this repo when the task needs simpler, more accessible language for students.",
    },
    {
        id: "educational-story-outcome-predictor",
        name: "Educational Story Outcome Predictor (Polkas)",
        url: "https://huggingface.co/polkas/educational-story-outcome-predictor/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Story outcome prediction repository for reading comprehension and narrative analysis education use cases.",
        sessionHint: "Open this repo when the task involves reading comprehension or narrative-based instruction.",
    },
    {
        id: "musicbot-emotion-classifier",
        name: "MusicBot Emotion Classifier (Nubiaebv)",
        url: "https://huggingface.co/nubiaebv/musicbot-emotion-classifier/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Emotion classification repository that can support music-based learning and affective educational experiences.",
        sessionHint: "Use this repo when the workflow includes music, emotion, or affective feedback scenarios.",
    },
    {
        id: "sharegpt-4o-image",
        name: "ShareGPT-4o-Image (Freedom Intelligence)",
        url: "https://github.com/FreedomIntelligence/ShareGPT-4o-Image",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Image-generation reference repository for prompt exploration, visual editing workflows, and multimodal creative experiments.",
        sessionHint: "Open this repository when the task involves image generation prompts, visual ideation, or creative media comparisons.",
    },
    {
        id: "uniworld-v1-nf4",
        name: "UniWorld V1 NF4 (wikeeyang)",
        url: "https://huggingface.co/wikeeyang/UniWorld-V1-NF4/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "World-model and multimodal reference repository for visual reasoning, scene understanding, and spatially grounded workflows.",
        sessionHint: "Use this repo when the workflow needs a world-model perspective for visual prompts or scene-based reasoning.",
    },
    {
        id: "qwen3-omni-30b-a3b-thinking-awq-8bit",
        name: "Qwen3 Omni 30B A3B Thinking AWQ 8bit (cyankiwi)",
        url: "https://huggingface.co/cyankiwi/Qwen3-Omni-30B-A3B-Thinking-AWQ-8bit/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Thinking-oriented multimodal repository for reasoning-heavy interactive, voice, and image-related exploration.",
        sessionHint: "Open this repo when the task benefits from a reasoning-focused multimodal reference.",
    },
    {
        id: "qwen2.5-omni-3b-gguf",
        name: "Qwen2.5 Omni 3B GGUF (aoiandroid)",
        url: "https://huggingface.co/aoiandroid/Qwen2.5-Omni-3B-GGUF/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Compact multimodal repository for speech, vision, and text workflows in lightweight browser-assisted experiments.",
        sessionHint: "Use this repo when the task needs a smaller multimodal reference for quick experiments.",
    },
    {
        id: "qwen3-omni-30b-a3b-instruct",
        name: "Qwen3 Omni 30B A3B Instruct (Alibaba)",
        url: "https://huggingface.co/Qwen/Qwen3-Omni-30B-A3B-Instruct/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Multimodal instruction-following repository for voice, text, and interactive educational experiences.",
        sessionHint: "Use this repo when the workflow needs a multimodal teaching or interaction reference.",
    },
    {
        id: "step-audio-2-mini",
        name: "Step Audio 2 Mini (stepfun-ai)",
        url: "https://huggingface.co/stepfun-ai/Step-Audio-2-mini/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Audio generation and speech-oriented repository for oral learning, narration, and accessibility experiences.",
        sessionHint: "Open this repo when the workflow includes audio narration or spoken educational content.",
    },
    {
        id: "anyrewardmodel",
        name: "AnyRewardModel (PKU Alignment)",
        url: "https://huggingface.co/PKU-Alignment/AnyRewardModel/tree/main",
        category: "research",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "Reward-model repository that can support evaluation, feedback, and improvement loops for educational agents.",
        sessionHint: "Use this repo when the workflow needs a reward or scoring reference for agent behavior.",
    },
];

function normalizeExternalSourceId(sourceId: unknown): string {
    if (typeof sourceId === "string") {
        return sourceId.trim().toLowerCase();
    }

    if (sourceId && typeof sourceId === "object") {
        const record = sourceId as Record<string, unknown>;
        const idCandidate = typeof record.id === "string" ? record.id.trim() : "";
        const sourceIdCandidate = typeof record.sourceId === "string" ? record.sourceId.trim() : "";
        const candidate = idCandidate || sourceIdCandidate;
        return candidate.toLowerCase();
    }

    return "";
}

function normalizeExternalSourceIds(sourceIds: unknown): string[] {
    const sourceValues = typeof sourceIds === "string"
        ? [sourceIds]
        : Array.isArray(sourceIds)
            ? sourceIds
            : sourceIds && typeof sourceIds === "object"
                ? [sourceIds]
                : [];

    return Array.from(new Set(
        sourceValues
            .map(sourceId => normalizeExternalSourceId(sourceId))
            .filter(Boolean)
    ));
}

function getSourceIdForError(sourceId: unknown): string {
    const normalizedSourceId = normalizeExternalSourceId(sourceId);
    return normalizedSourceId || (typeof sourceId === "string" ? sourceId : "");
}

function isKnownExternalSource(sourceId: unknown): boolean {
    const normalizedSourceId = normalizeExternalSourceId(sourceId);
    return DEFAULT_EXTERNAL_SOURCES.some(source => source.id === normalizedSourceId);
}

function hasExplicitExternalSourceSelection(requestedSources: unknown): boolean {
    if (requestedSources === undefined || requestedSources === null) return false;
    if (typeof requestedSources === "string") return requestedSources.trim() !== "";
    if (Array.isArray(requestedSources)) return requestedSources.some(sourceId => {
        if (typeof sourceId === "string") return sourceId.trim() !== "";
        return sourceId !== undefined && sourceId !== null;
    });
    return normalizeExternalSourceId(requestedSources) !== "";
}

function getKnownRequestedSources(requestedSources: unknown): string[] {
    return normalizeExternalSourceIds(requestedSources).filter(sourceId => isKnownExternalSource(sourceId));
}

function safeParseJson(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function extractStringValue(value: unknown, candidateKeys: string[]): string {
    if (typeof value === "string") {
        return value.trim();
    }

    if (Array.isArray(value)) {
        for (const entry of value) {
            const extracted = extractStringValue(entry, candidateKeys);
            if (extracted) return extracted;
        }
        return "";
    }

    if (!value || typeof value !== "object") {
        return "";
    }

    const record = value as Record<string, unknown>;
    for (const [key, nestedValue] of Object.entries(record)) {
        if (candidateKeys.some(candidateKey => candidateKey.toLowerCase() === key.toLowerCase())) {
            const extracted = extractStringValue(nestedValue, candidateKeys);
            if (extracted) return extracted;
        }
    }

    for (const nestedValue of Object.values(record)) {
        if (nestedValue && typeof nestedValue === "object") {
            const extracted = extractStringValue(nestedValue, candidateKeys);
            if (extracted) return extracted;
        }
    }

    return "";
}

function selectExternalSources(requestedSources: unknown): ExternalBrowserSource[] {
    const hasExplicitSelection = hasExplicitExternalSourceSelection(requestedSources);
    const knownRequestedSources = getKnownRequestedSources(requestedSources);

    if (!hasExplicitSelection) {
        return getExternalBrowserSources();
    }

    if (!knownRequestedSources.length) {
        return [];
    }

    const sources = getExternalBrowserSources();
    const sourcesById = new Map(sources.map(source => [source.id, source]));
    return knownRequestedSources
        .map(sourceId => sourcesById.get(sourceId))
        .filter((source): source is ExternalBrowserSource => Boolean(source));
}

function isAutomationConfigured(): boolean {
    return Boolean(
        process.env.EXTERNAL_BROWSER_PROXY_URL ||
        process.env.EXTERNAL_BROWSER_API_URL ||
        process.env.EXTERNAL_BROWSER_API_KEY
    );
}

function getAutomationEndpoint(): string | null {
    const raw = process.env.EXTERNAL_BROWSER_PROXY_URL || process.env.EXTERNAL_BROWSER_API_URL || "";
    if (!raw) return null;
    try {
        const parsed = new URL(raw);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported protocol");
        return parsed.toString();
    } catch {
        return null;
    }
}

export async function queryExternalBrowserSource(
    sourceId: string,
    query: string,
    options: {goal?: string; sessionMode?: string} = {}
): Promise<ExternalBrowserSourceQueryResult> {
    const normalizedSourceId = normalizeExternalSourceId(sourceId);
    if (!normalizedSourceId || !isKnownExternalSource(normalizedSourceId)) {
        return {
            sourceId: getSourceIdForError(sourceId),
            ok: false,
            status: 404,
            usedBackend: "manual",
            error: `Unknown external browser source: ${normalizedSourceId || "<empty>"}`,
        };
    }

    const endpoint = getAutomationEndpoint();
    if (!endpoint) {
        return {
            sourceId: normalizedSourceId,
            ok: false,
            status: 503,
            usedBackend: "manual",
            error: "No browser automation endpoint is configured. Set EXTERNAL_BROWSER_PROXY_URL or EXTERNAL_BROWSER_API_URL.",
        };
    }

    const headers: Record<string, string> = {"Content-Type": "application/json"};
    const apiKey = process.env.EXTERNAL_BROWSER_API_KEY;
    if (apiKey) headers.Authorization = "Bearer " + apiKey;

    let response: Response | null = null;
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({
                sourceId: normalizedSourceId,
                query,
                goal: options.goal,
                sessionMode: options.sessionMode,
            }),
        });
    } catch (error) {
        return {
            sourceId: normalizedSourceId,
            ok: false,
            status: 502,
            usedBackend: "proxy",
            error: `Automation request failed while contacting the configured browser automation endpoint: ${error instanceof Error ? error.message : "unknown error"}`,
        };
    }

    let bodyText = "";
    try {
        bodyText = await response.text();
    } catch {
        bodyText = "";
    }

    if (!response.ok) {
        const parsedBody = bodyText ? safeParseJson(bodyText) : null;
        const errorMessage = extractStringValue(parsedBody, ["error", "message", "detail"])
            || extractStringValue(bodyText, ["error", "message", "detail"])
            || `Automation request failed with status ${response.status}`;
        return {
            sourceId: normalizedSourceId,
            ok: false,
            status: response.status,
            usedBackend: "proxy",
            error: errorMessage,
        };
    }

    let payload: any;
    try {
        payload = bodyText ? JSON.parse(bodyText) : null;
    } catch (error) {
        return {
            sourceId: normalizedSourceId,
            ok: false,
            status: response.status,
            usedBackend: "proxy",
            error: `Automation response was not valid JSON: ${error instanceof Error ? error.message : "unknown error"}`,
        };
    }

    const errorMessage = extractStringValue(payload, ["error", "message", "detail"]);
    const content = extractStringValue(payload, ["content", "text", "result", "output", "answer"]);

    if (errorMessage || payload?.ok === false || payload?.success === false) {
        return {
            sourceId: normalizedSourceId,
            ok: false,
            status: typeof payload?.status === "number" ? payload.status : response.status,
            usedBackend: "proxy",
            error: errorMessage || "Automation endpoint returned an error payload",
        };
    }

    return {
        sourceId: normalizedSourceId,
        ok: true,
        status: response.status,
        usedBackend: "proxy",
        content: content || undefined,
    };
}

export function getExternalBrowserSources(): ExternalBrowserSource[] {
    const automationConfigured = isAutomationConfigured();
    return DEFAULT_EXTERNAL_SOURCES.map(source => ({
        ...source,
        availability: automationConfigured ? "ready" : source.availability,
    }));
}

export function buildExternalBrowserSourceContext(requestedSources: ExternalBrowserSourceSelector | null | undefined = []): string | null {
    const selectedSources = selectExternalSources(requestedSources);

    if (!selectedSources.length) return null;

    const sourceLines = selectedSources.map(source => {
        const backendLabel = source.backend === "browser-automation"
            ? "browser automation"
            : source.backend === "api"
                ? "API"
                : "manual browser workflow";
        return `- ${source.name} (${source.url}) — ${backendLabel}; ${source.notes}`;
    }).join("\n");

    return [
        "External browser-based source workflow:",
        sourceLines,
        "When a request references these sources, treat them as supplemental research or ideation tools. If automation is not configured, note the source as a manual browser step rather than an integrated API call.",
    ].join("\n");
}

export function planExternalBrowserSources(
    requestedSources: ExternalBrowserSourceSelector | null | undefined = [],
    options: {goal?: string; sessionMode?: string} = {}
): ExternalBrowserSourcePlan {
    const normalizedRequestedSources = getKnownRequestedSources(requestedSources);
    const sources = selectExternalSources(requestedSources);

    const automationConfigured = isAutomationConfigured();
    const workflowNote = automationConfigured
        ? "The configured browser automation layer is available, so these sources can be treated as active workflow inputs."
        : "No browser automation endpoint is configured yet; the workflow should treat these sources as manual or future-backed research steps.";

    return {
        requestedSources: normalizedRequestedSources.length ? normalizedRequestedSources : sources.map(source => source.id),
        sources,
        automationConfigured,
        workflowNote,
        nextSteps: [
            options.goal ? `Frame the task around: ${options.goal}` : "Frame the task clearly before using an external source.",
            automationConfigured
                ? "Use the configured browser automation hook for live retrieval and synthesis."
                : "Add EXTERNAL_BROWSER_PROXY_URL or EXTERNAL_BROWSER_API_URL to enable live browser-backed retrieval.",
            options.sessionMode === "anonymous"
                ? "Open the source from an anonymous or fresh session and reset it between runs if the provider enforces session limits."
                : "If the source is rate-limited, reinitialize from a fresh anonymous or non-persisted session between runs.",
        ],
    };
}
