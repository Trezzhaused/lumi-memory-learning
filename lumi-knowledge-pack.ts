export interface EmbeddedKnowledgeItem {
    id: string;
    title: string;
    summary: string;
    tags: string[];
}

const EMBEDDED_KNOWLEDGE_ITEMS: EmbeddedKnowledgeItem[] = [
    {
        id: "video",
        title: "Video generation and media production",
        summary: "Lumi can plan storyboards, shot lists, cinematic prompts, editing workflows, and video-generation pipelines for short-form and polished media projects.",
        tags: ["video", "film", "animation", "storyboard", "render"],
    },
    {
        id: "audio",
        title: "Audio generation and voice workflows",
        summary: "Lumi can draft voiceover scripts, music prompts, sound design concepts, and speech/voice-enabled experiences for games, training, and media.",
        tags: ["audio", "music", "voice", "speech", "sound"],
    },
    {
        id: "skills",
        title: "Skills, learning loops, and reusable capabilities",
        summary: "Lumi can structure skills, learning loops, reusable workflows, tutoring flows, and capability growth plans that turn prior experience into repeatable behavior.",
        tags: ["skills", "learning", "workflow", "capabilities", "education"],
    },
    {
        id: "k12-qa",
        title: "K-12 Q&A and educational support",
        summary: "Lumi can answer questions in a student-friendly way, explain concepts clearly, tailor content for K-12 learners, and support classroom-style Q&A.",
        tags: ["k12", "education", "qa", "student", "classroom"],
    },
    {
        id: "dod-aftc",
        title: "DoD / AFTC training systems and serious games",
        summary: "Lumi can support training-system design, mission-based scenarios, serious-game concepts, defense and aviation training flows, and simulation-friendly game ideas.",
        tags: ["dod", "aftc", "training", "game", "simulation", "defense"],
    },
];

export function buildEmbeddedKnowledgeContext(): string {
    const lines = [
        "Embedded capability pack for Lumi:",
        ...EMBEDDED_KNOWLEDGE_ITEMS.map(item => `- ${item.title}: ${item.summary}`),
        "When the user asks for any of these areas, treat them as first-class capabilities and respond with actionable guidance, implementation ideas, or content plans.",
    ];

    return lines.join("\n");
}
