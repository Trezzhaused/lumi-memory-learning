/**
 * Lumi – Core AI Module
 *
 * Primary intelligence layer for the Trezzhaus platform.
 * Architecture mirrors the TrezzWorld Production Studio (trezzworld-production-studio)
 * so the Studio's AIModelBridge can connect directly to this server.
 *
 * Exposes Studio-compatible API shapes:
 *   POST /api/lumi/chat
 *   GET  /api/lumi/chat/history
 *   GET  /api/lumi/models
 *   POST /api/lumi/enhance-prompt
 *   POST /api/studio/control-plane/boot
 *   GET  /api/pipeline/:id/status
 *   GET  /api/pipeline/missions
 *   GET  /api/ollama/status
 *
 * Model cascade (free-first, mirrors backend/ai_router.py strategy):
 *   1. Ollama (local, zero cost)
 *   2. OpenRouter free-tier models
 */

import {ConversationManager, ConversationSession, ConversationMessage} from "./lumi-conversation";
import {remember, recall, search as memSearch} from "./lumi-memory";
import {checkContentSafety, AcamConfig, defaultAcamConfig} from "./lumi-acam";
import {generate, GenerationRequest} from "./lumi-generators";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
export const OLLAMA_HOST = process.env.OLLAMA_HOST || "";

/** Default chat model – free tier on OpenRouter */
export const DEFAULT_CHAT_MODEL =
    process.env.LUMI_CHAT_MODEL || "mistralai/mistral-7b-instruct:free";

// ---------------------------------------------------------------------------
// Singleton conversation manager (session lifecycle)
// ---------------------------------------------------------------------------

export const conversationManager = new ConversationManager();

// ---------------------------------------------------------------------------
// Studio-compatible types (mirrors AIModelBridge.ts in trezzworld-production-studio)
// ---------------------------------------------------------------------------

export interface LumiChatRequest {
    message: string;
    history?: Array<{role: string; content: string}>;
    missionId?: string | null;
    useOllama?: boolean;
    ollamaModel?: string | null;
    domain?: string | null;
}

export interface LumiChatResponse {
    role: "assistant";
    content: string;
    model: string;
    ok: boolean;
}

export interface ModelCascadeEntry {
    id: string;
    provider: "openrouter" | "ollama";
    label: string;
    free: boolean;
    contextWindow?: number;
}

export interface PipelineJob {
    id: string;
    title: string;
    capability: string;
    status: "queued" | "running" | "done" | "warn" | "error";
    workerId: string;
    targetFiles: string[];
    output?: string;
    score?: number;
    error?: string;
    startedAt?: string;
    completedAt?: string;
}

export interface MissionStatus {
    id: string;
    prompt: string;
    status: "pending" | "running" | "completed" | "failed";
    createdAt: string;
    updatedAt: string;
    summary: string;
    jobs: PipelineJob[];
    progress: {
        total: number;
        completed: number;
        running: number;
        errored: number;
        percent: number;
    };
}

export interface MissionBootResult {
    missionId: string;
    objective: string;
    status: "executing";
    summary: string;
    plannerModel: string;
    executionQueue: Array<{
        jobId: string;
        name: string;
        capability: string;
        workerId: string;
        targetFiles: string[];
        status: string;
        stage: string;
    }>;
}

export interface PromptEnhanceResult {
    domain: string;
    detectedDomain: string;
    enhancedMessages: Array<{role: string; content: string}>;
    systemPromptPreview: string;
}

// ---------------------------------------------------------------------------
// Active mission store
// ---------------------------------------------------------------------------

const missions = new Map<string, MissionStatus>();

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Ollama helpers
// ---------------------------------------------------------------------------

async function ollamaChat(
    messages: Array<{role: string; content: string}>,
    model: string
): Promise<string> {
    if (!OLLAMA_HOST) throw new Error("Ollama host not configured");
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({model, messages, stream: false}),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const json: any = await res.json();
    return json.message?.content || "(no response)";
}

export async function getOllamaStatus(): Promise<{
    available: boolean;
    host: string;
    localModels: Array<{name: string}>;
    superGemmaReady: boolean;
    installHint: string;
}> {
    if (!OLLAMA_HOST) {
        return {
            available: false, host: "", localModels: [],
            superGemmaReady: false,
            installHint: "Set OLLAMA_HOST to enable local model support.",
        };
    }
    try {
        const res = await fetch(`${OLLAMA_HOST}/api/tags`);
        if (!res.ok) throw new Error("unreachable");
        const json: any = await res.json();
        const models: Array<{name: string}> = json.models || [];
        const superGemmaReady = models.some(m =>
            m.name.toLowerCase().includes("gemma") || m.name.toLowerCase().includes("mistral")
        );
        return {
            available: true, host: OLLAMA_HOST, localModels: models,
            superGemmaReady,
            installHint: "Ollama is running.",
        };
    } catch {
        return {
            available: false, host: OLLAMA_HOST, localModels: [],
            superGemmaReady: false,
            installHint: "Ollama host is configured but not reachable.",
        };
    }
}

// ---------------------------------------------------------------------------
// OpenRouter chat
// ---------------------------------------------------------------------------

async function openRouterChat(
    messages: Array<{role: string; content: string}>,
    model: string
): Promise<string> {
    if (!OPENROUTER_API_KEY) {
        return (
            "Hi, I'm Lumi! I'm not yet fully connected — please configure " +
            "OPENROUTER_API_KEY to activate my full intelligence. I'm here and ready to help!"
        );
    }
    const res = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: "Bearer " + OPENROUTER_API_KEY,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://trezzhaus.com",
            "X-Title": "Lumi \u2013 Trezzhaus AI",
        },
        body: JSON.stringify({model, messages}),
    });
    if (!res.ok) throw new Error(`OpenRouter error (${res.status}): ${await res.text()}`);
    const json: any = await res.json();
    return json.choices?.[0]?.message?.content || "(no response)";
}

// ---------------------------------------------------------------------------
// Lumi system prompt (domain-aware)
// ---------------------------------------------------------------------------

const DOMAIN_SYSTEM_PROMPTS: Record<string, string> = {
    default:
        "You are Lumi, the creative and highly capable AI assistant of the Trezzhaus platform. " +
        "You are warm, direct, and enthusiastic about building things — games, apps, art, music, code. " +
        "You work with ACAM to keep the environment safe. Always be helpful, honest, and creative.",
    code:
        "You are Lumi in developer mode. Write clean, production-ready, well-commented code. " +
        "Use TypeScript by default unless specified. Return only the code.",
    game:
        "You are Lumi in game-designer mode. Design complete, playable games with clear mechanics, " +
        "code structure, and creative flair tailored to the Trezzhaus platform.",
    creative:
        "You are Lumi in creative-studio mode. Generate vivid, detailed prompts and descriptions " +
        "for images, videos, music, and animations.",
    roblox:
        "You are Lumi in Roblox-developer mode. Write Luau scripts, design game mechanics, " +
        "and structure Roblox experiences using best practices for the Roblox platform.",
};

function detectDomain(message: string): string {
    const lower = message.toLowerCase();
    if (/\b(roblox|luau|place|baseplate|studio)\b/.test(lower)) return "roblox";
    if (/\b(game|player|score|collision|spawn|level)\b/.test(lower)) return "game";
    if (/\b(code|function|class|api|typescript|python|script)\b/.test(lower)) return "code";
    if (/\b(image|draw|paint|music|audio|video|animate|render)\b/.test(lower)) return "creative";
    return "default";
}

// ---------------------------------------------------------------------------
// Core chat function (Studio-compatible)
// ---------------------------------------------------------------------------

export async function lumiChat(
    req: LumiChatRequest,
    sessionId?: string,
    acamConfig: AcamConfig = defaultAcamConfig
): Promise<LumiChatResponse> {
    const safety = checkContentSafety(req.message, acamConfig);
    if (!safety.safe) throw new Error(`ACAM: ${safety.reason}`);

    const domain = req.domain || detectDomain(req.message);
    const systemPrompt = DOMAIN_SYSTEM_PROMPTS[domain] || DOMAIN_SYSTEM_PROMPTS.default;

    const messages: Array<{role: string; content: string}> = [
        {role: "system", content: systemPrompt},
        ...(req.history || []),
        {role: "user", content: req.message},
    ];

    // Persist to session if sessionId provided
    if (sessionId) {
        let session = conversationManager.get(sessionId);
        if (!session) session = conversationManager.create("Lumi Chat", {domain});
        conversationManager.addMessage(session.id, "user", req.message);
    }

    let responseText: string;
    let usedModel = DEFAULT_CHAT_MODEL;

    if (req.useOllama && OLLAMA_HOST) {
        usedModel = req.ollamaModel || "mistral";
        responseText = await ollamaChat(messages, usedModel);
    } else {
        responseText = await openRouterChat(messages, usedModel);
    }

    if (sessionId) {
        let session = conversationManager.get(sessionId);
        if (session) conversationManager.addMessage(session.id, "assistant", responseText);
        await remember(sessionId, "user", req.message, ["chat", domain]);
        await remember(sessionId, "assistant", responseText, ["chat", domain]);
    }

    return {role: "assistant", content: responseText, model: usedModel, ok: true};
}

// ---------------------------------------------------------------------------
// Chat history (Studio-compatible)
// ---------------------------------------------------------------------------

export async function getChatHistory(
    sessionId: string,
    limit = 40
): Promise<Array<{role: string; content: string}>> {
    const entries = await recall(sessionId, limit, ["chat"]);
    return entries.slice().reverse().map(e => ({role: e.role, content: e.content}));
}

// ---------------------------------------------------------------------------
// Model cascade info (Studio-compatible)
// ---------------------------------------------------------------------------

export async function getModelCascade(): Promise<ModelCascadeEntry[]> {
    const cascade: ModelCascadeEntry[] = [
        {id: "mistralai/mistral-7b-instruct:free", provider: "openrouter", label: "Mistral 7B (Free)", free: true, contextWindow: 32768},
        {id: "mistralai/devstral-small:free",      provider: "openrouter", label: "Devstral Small – Code (Free)", free: true, contextWindow: 32768},
        {id: "google/gemma-3-4b-it:free",          provider: "openrouter", label: "Gemma 3 4B (Free)", free: true, contextWindow: 8192},
        {id: "meta-llama/llama-3.2-3b-instruct:free", provider: "openrouter", label: "Llama 3.2 3B (Free)", free: true, contextWindow: 131072},
        {id: "deepseek/deepseek-r1:free",          provider: "openrouter", label: "DeepSeek R1 (Free)", free: true, contextWindow: 65536},
        {id: "nousresearch/hermes-3-llama-3.1-405b:free", provider: "openrouter", label: "Hermes 3 405B (Free)", free: true, contextWindow: 131072},
    ];

    if (OLLAMA_HOST) {
        const status = await getOllamaStatus();
        for (const m of status.localModels) {
            cascade.unshift({id: m.name, provider: "ollama", label: `${m.name} (Local)`, free: true});
        }
    }

    return cascade;
}

// ---------------------------------------------------------------------------
// Prompt enhancement (domain-aware, Studio-compatible)
// ---------------------------------------------------------------------------

export async function enhancePrompt(
    prompt: string,
    domain?: string
): Promise<PromptEnhanceResult> {
    const detectedDomain = domain || detectDomain(prompt);
    const systemPrompt = DOMAIN_SYSTEM_PROMPTS[detectedDomain] || DOMAIN_SYSTEM_PROMPTS.default;
    return {
        domain: detectedDomain,
        detectedDomain,
        enhancedMessages: [
            {role: "system", content: systemPrompt},
            {role: "user",   content: prompt},
        ],
        systemPromptPreview: systemPrompt.slice(0, 200),
    };
}

// ---------------------------------------------------------------------------
// Mission / pipeline (Studio control-plane, Studio-compatible)
// ---------------------------------------------------------------------------

export async function bootMission(prompt: string): Promise<MissionBootResult> {
    const missionId = generateId();
    const now = new Date().toISOString();

    // Decompose the prompt into capability jobs using Lumi's intelligence
    const planPrompt =
        `You are a mission planner. Decompose the following objective into 3-5 concrete jobs. ` +
        `For each job return JSON with fields: name, capability (one of: code, image, audio, video, text, roblox), ` +
        `workerId (agent name), targetFiles (array of filename strings). ` +
        `Return ONLY a JSON array, no markdown fences.\n\nObjective: ${prompt}`;

    let rawPlan = "[]";
    try {
        rawPlan = await openRouterChat(
            [{role: "system", content: "You are a JSON-only mission planner."},
             {role: "user", content: planPrompt}],
            DEFAULT_CHAT_MODEL
        );
    } catch { /* fall through to empty plan */ }

    let jobDefs: any[] = [];
    try {
        jobDefs = JSON.parse(rawPlan.replace(/```json?/g, "").replace(/```/g, "").trim());
        if (!Array.isArray(jobDefs)) jobDefs = [];
    } catch { jobDefs = []; }

    const executionQueue = jobDefs.slice(0, 5).map((j: any, i: number) => ({
        jobId: generateId(),
        name: j.name || `Task ${i + 1}`,
        capability: j.capability || "text",
        workerId: j.workerId || "lumi-core",
        targetFiles: Array.isArray(j.targetFiles) ? j.targetFiles : [],
        status: "queued",
        stage: "planned",
    }));

    const mission: MissionStatus = {
        id: missionId,
        prompt,
        status: "running",
        createdAt: now,
        updatedAt: now,
        summary: `Mission "${prompt.slice(0, 80)}" booted with ${executionQueue.length} job(s).`,
        jobs: executionQueue.map(q => ({
            id: q.jobId,
            title: q.name,
            capability: q.capability,
            status: "queued",
            workerId: q.workerId,
            targetFiles: q.targetFiles,
            startedAt: now,
        })),
        progress: {
            total: executionQueue.length,
            completed: 0,
            running: executionQueue.length,
            errored: 0,
            percent: 0,
        },
    };

    missions.set(missionId, mission);

    // Execute jobs asynchronously
    executeMissionAsync(mission).catch(err =>
        console.error(`[Lumi] Mission ${missionId} error:`, err)
    );

    return {
        missionId,
        objective: prompt,
        status: "executing",
        summary: mission.summary,
        plannerModel: DEFAULT_CHAT_MODEL,
        executionQueue,
    };
}

async function executeMissionAsync(mission: MissionStatus): Promise<void> {
    for (const job of mission.jobs) {
        try {
            job.status = "running";
            mission.updatedAt = new Date().toISOString();

            let output = "";
            if (job.capability === "code") {
                const result = await generate({type: "code", prompt: `${mission.prompt} — ${job.title}`});
                output = result.text || "";
            } else if (job.capability === "image") {
                const result = await generate({type: "image", prompt: `${mission.prompt} — ${job.title}`});
                output = result.data ? `[image:base64:${result.mimeType}]` : result.url || "";
            } else if (job.capability === "audio") {
                const result = await generate({type: "audio", prompt: `${mission.prompt} — ${job.title}`});
                output = result.data ? `[audio:base64:audio/flac]` : "";
            } else {
                // Text task: ask Lumi
                const resp = await lumiChat({message: `${mission.prompt}\n\nTask: ${job.title}`});
                output = resp.content;
            }

            job.output = output;
            job.status = "done";
            job.completedAt = new Date().toISOString();
            mission.progress.completed += 1;
            mission.progress.running -= 1;
            mission.progress.percent = Math.round(
                (mission.progress.completed / mission.progress.total) * 100
            );
        } catch (err: any) {
            job.status = "error";
            job.error = err.message;
            job.completedAt = new Date().toISOString();
            mission.progress.errored += 1;
            mission.progress.running -= 1;
        }
        mission.updatedAt = new Date().toISOString();
    }

    const allDone = mission.jobs.every(j => j.status === "done" || j.status === "error");
    const anyError = mission.jobs.some(j => j.status === "error");
    mission.status = !allDone ? "running" : anyError ? "failed" : "completed";
    mission.updatedAt = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Pipeline status (Studio-compatible)
// ---------------------------------------------------------------------------

export function getPipelineStatus(missionId: string): MissionStatus {
    const m = missions.get(missionId);
    if (!m) throw new Error(`Mission not found: ${missionId}`);
    return {...m, jobs: m.jobs.map(j => ({...j}))};
}

export function listMissions(): MissionStatus[] {
    return [...missions.values()].map(m => ({...m, jobs: m.jobs.map(j => ({...j}))}));
}

// ---------------------------------------------------------------------------
// Status report
// ---------------------------------------------------------------------------

const startTime = Date.now();

export interface LumiStatus {
    name: string;
    version: string;
    platform: string;
    studioUrl: string;
    openRouterConnected: boolean;
    ollamaConnected: boolean;
    memoryBackend: string;
    availableCapabilities: string[];
    acamEnabled: boolean;
    activeMissions: number;
    uptime: number;
}

export async function getLumiStatus(): Promise<LumiStatus> {
    const ollamaStatus = await getOllamaStatus();
    const capabilities: string[] = ["chat"];
    if (OPENROUTER_API_KEY) capabilities.push("multi-model-chat", "code-generation", "prompt-enhancement");
    if (process.env.HUGGINGFACE_API_KEY) capabilities.push("image-generation-hf", "audio-generation");
    if (process.env.STABILITY_API_KEY) capabilities.push("image-generation-stability");
    if (process.env.FAL_KEY) capabilities.push("video-generation-fal");
    if (process.env.REPLICATE_API_KEY) capabilities.push("video-generation-replicate");
    if (ollamaStatus.available) capabilities.push("local-model-ollama");
    if (process.env.ROBLOX_API_KEY) capabilities.push("roblox-publishing");

    return {
        name: "Lumi",
        version: "1.0.0",
        platform: "Trezzhaus",
        studioUrl: "https://studio.trezzhaus.com",
        openRouterConnected: !!OPENROUTER_API_KEY,
        ollamaConnected: ollamaStatus.available,
        memoryBackend: process.env.GITHUB_API_TOKEN ? "github-gists" : "in-memory",
        availableCapabilities: capabilities,
        acamEnabled: defaultAcamConfig.enabled,
        activeMissions: [...missions.values()].filter(m => m.status === "running").length,
        uptime: Math.floor((Date.now() - startTime) / 1000),
    };
}
