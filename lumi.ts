/**
 * Lumi — Core AI Module
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
import {remember, recall, search as memSearch, getMemoryStorageStatus} from "./lumi-memory";
import {checkContentSafety, AcamConfig, defaultAcamConfig} from "./lumi-acam";
import {generate, GenerationRequest} from "./lumi-generators";
import {getArtifactStorageStatus} from "./lumi-storage";
import {existsSync, mkdirSync, promises as fs, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {callOpenRouterChat} from "./openrouter";
import {buildExternalBrowserSourceContext, queryExternalBrowserSource} from "./lumi-external-sources";
import {buildTrainingResourceAnalysis} from "./lumi-training-resources";
import {isLocalToolExecutionEnabled, runWorkspaceCommand, writeWorkspaceFile} from "./lumi-tools";
import {callNvidiaChat} from "./nvidia";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
export const OLLAMA_HOST = process.env.OLLAMA_HOST || "";
export const NVIDIA_API_BASE = process.env.NVIDIA_API_BASE || process.env.NVIDIA_BASE_URL || "";
export const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
export const NVIDIA_CHAT_MODEL = process.env.NVIDIA_CHAT_MODEL || "";

/** Default chat model — free tier on OpenRouter */
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
    externalSources?: string[] | null;
}

export interface LumiChatResponse {
    role: "assistant";
    content: string;
    model: string;
    ok: boolean;
}

export interface ModelCascadeEntry {
    id: string;
    provider: "openrouter" | "ollama" | "nvidia";
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

export interface MissionArtifactSummary {
    name: string;
    kind: string;
    artifactId?: string;
    downloadUrl?: string;
    status: "ready" | "failed";
}

export interface MissionEvent {
    id: string;
    type: "log" | "artifact" | "status";
    message: string;
    detail?: string;
    createdAt: string;
}

export interface MissionPlanStep {
    id: string;
    title: string;
    capability: string;
    status: "planned" | "running" | "done" | "blocked" | "retrying" | "failed";
    attempts: number;
    workerId: string;
    targetFiles: string[];
    notes?: string;
    lastResult?: string;
}

export interface MissionPolicy {
    maxSteps: number;
    maxAttempts: number;
    maxRuntimeMs: number;
    allowExternalResearch: boolean;
    allowLocalExecution: boolean;
    requiresApproval: boolean;
}

export interface MissionStatus {
    id: string;
    prompt: string;
    status: "pending" | "running" | "completed" | "failed" | "awaiting-approval" | "blocked" | "stalled" | "retrying";
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
    events: MissionEvent[];
    artifacts: MissionArtifactSummary[];
    plan: MissionPlanStep[];
    policy: MissionPolicy;
    startedAt?: string;
    completedAt?: string;
    lastHeartbeatAt?: string;
    learningSummary?: string;
}

export interface MissionBootResult {
    missionId: string;
    objective: string;
    status: "executing" | "awaiting-approval";
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
    streamUrl: string;
}

export interface PromptEnhanceResult {
    domain: string;
    detectedDomain: string;
    enhancedMessages: Array<{role: string; content: string}>;
    systemPromptPreview: string;
}

export interface FineTuneStatus {
    ready: boolean;
    seed_dataset: string | null;
    datasets: string[];
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
        const localModelReady = models.some(m =>
            m.name.toLowerCase().includes("gemma") || m.name.toLowerCase().includes("mistral")
        );
        return {
            available: true, host: OLLAMA_HOST, localModels: models,
            superGemmaReady: localModelReady,
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
    return callOpenRouterChat(messages, model, {
        apiKey: OPENROUTER_API_KEY,
        httpReferer: "https://trezzhaus.com",
        appTitle: "Lumi — Trezzhaus AI",
        appCategories: "cli-agent,cloud-agent",
    });
}

async function nvidiaChat(
    messages: Array<{role: string; content: string}>,
    model: string
): Promise<string> {
    if (!NVIDIA_API_BASE) {
        throw new Error("NVIDIA_API_BASE is not configured.");
    }
    return callNvidiaChat(messages, model, {
        apiKey: NVIDIA_API_KEY,
        apiBase: NVIDIA_API_BASE,
    });
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

const MODULE_SPECIALTIES: Record<string, {name: string; specialty: string; keywords: string[]}> = {
    chat: {name: "Chat", specialty: "Conversational orchestration, multi-model responses, and prompt refinement.", keywords: ["chat", "conversation", "history", "assistant"]},
    memory: {name: "Memory", specialty: "Persistent recall, prior solutions, and learned context retrieval.", keywords: ["memory", "recall", "remember", "learn", "knowledge"]},
    studio: {name: "Studio", specialty: "Mission planning, pipeline orchestration, and workflow assembly.", keywords: ["studio", "mission", "pipeline", "project", "workflow"]},
    video: {name: "Video", specialty: "Storyboard planning, video generation, rendering, and motion asset workflows.", keywords: ["video", "render", "movie", "animation", "scene", "clip"]},
    image: {name: "Image", specialty: "Image generation, concept art, visual design, and prompt crafting.", keywords: ["image", "art", "visual", "design", "prompt", "diffusion"]},
    audio: {name: "Audio", specialty: "Music, sound design, voice, and audio generation workflows.", keywords: ["audio", "music", "sound", "voice", "track"]},
    code: {name: "Code", specialty: "Production-ready code generation for TypeScript, Python, APIs, scripts, and Luau.", keywords: ["code", "typescript", "python", "script", "function", "class", "api", "luau"]},
    roblox: {name: "Roblox", specialty: "Luau scripting, Roblox gameplay logic, and Open Cloud publishing workflows.", keywords: ["roblox", "luau", "place", "universe", "baseplate", "avatar"]},
    acam: {name: "ACAM", specialty: "Security, safety, auth, rate limits, origins, and audit logging.", keywords: ["acam", "security", "auth", "rate limit", "origin", "audit", "safe"]},
};

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsKeyword(text: string, keyword: string): boolean {
    const normalizedText = text.toLowerCase();
    const normalizedKeyword = keyword.toLowerCase();
    if (normalizedKeyword.includes(" ")) {
        return normalizedText.includes(normalizedKeyword);
    }
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedKeyword)}($|[^a-z0-9])`).test(normalizedText);
}

function detectDomain(message: string): string {
    const lower = message.toLowerCase();
    if (/\b(roblox|luau|place|baseplate|studio)\b/.test(lower)) return "roblox";
    if (/\b(game|player|score|collision|spawn|level)\b/.test(lower)) return "game";
    if (/\b(code|function|class|api|typescript|python|script)\b/.test(lower)) return "code";
    if (/\b(image|draw|paint|music|audio|video|animate|render)\b/.test(lower)) return "creative";
    return "default";
}

function detectModuleFocus(message: string): string[] {
    return Object.entries(MODULE_SPECIALTIES)
        .filter(([, meta]) => meta.keywords.some(keyword => containsKeyword(message, keyword)))
        .map(([key]) => key);
}

async function getRelevantMemoryContext(message: string, limit = 3): Promise<string | null> {
    try {
        const results = await memSearch(message, limit);
        if (!results.length) return null;
        const snippets = results
            .slice(0, limit)
            .map(entry => `- [${entry.type}] ${entry.content.replace(/\s+/g, " ").slice(0, 140)}`);
        return `Relevant past memory:\n${snippets.join("\n")}`;
    } catch {
        return null;
    }
}

async function buildSystemPrompt(message: string, domain: string, externalSourceContext?: string | null): Promise<string> {
    const basePrompt = DOMAIN_SYSTEM_PROMPTS[domain] || DOMAIN_SYSTEM_PROMPTS.default;
    const moduleFocus = detectModuleFocus(message);
    const moduleContext = moduleFocus.length > 0
        ? moduleFocus.map(moduleKey => {
            const moduleSpec = MODULE_SPECIALTIES[moduleKey];
            return `${moduleSpec.name}: ${moduleSpec.specialty}`;
        }).join(" | ")
        : "General platform assistance across chat, memory, studio, generation, and security modules.";
    const memoryContext = await getRelevantMemoryContext(message);

    let prompt = `${basePrompt}\n\n`;
    prompt += `You are operating inside the Lumi Intelligence Center for Trezzhaus and TrezzWorld. `;
    prompt += `Your repository-aware specialty modules are: chat, memory, studio, video, image, audio, code, Roblox, and ACAM. `;
    prompt += `Current focus: ${moduleContext}.\n\n`;
    prompt += "When a request touches a module, tab, or workflow, use that module's specialty first and stay aligned with the repo's implemented capabilities. ";
    prompt += "If the user asks for anything that can be created autonomously, build it when possible, keep the experience safe, and persist helpful context to memory for future recall.";

    if (externalSourceContext) {
        prompt += `\n\n${externalSourceContext}`;
    }

    if (memoryContext) {
        prompt += `\n\n${memoryContext}`;
    }

    return prompt;
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
    const externalSourceContext = buildExternalBrowserSourceContext(req.externalSources || []);
    const systemPrompt = await buildSystemPrompt(req.message, domain, externalSourceContext);

    const messages: Array<{role: string; content: string}> = [
        {role: "system", content: systemPrompt},
        ...(req.history || []),
        {role: "user", content: req.message},
    ];

    // Persist to session if sessionId provided
    if (sessionId) {
        let session = conversationManager.get(sessionId);
        if (!session) session = conversationManager.create("Lumi Chat", {domain}, sessionId);
        conversationManager.addMessage(session.id, "user", req.message);
    }

    let responseText: string;
    let usedModel = DEFAULT_CHAT_MODEL;

    if (req.useOllama && OLLAMA_HOST) {
        usedModel = req.ollamaModel || "mistral";
        responseText = await ollamaChat(messages, usedModel);
    } else if (NVIDIA_API_BASE) {
        const nvidiaModel = NVIDIA_CHAT_MODEL || DEFAULT_CHAT_MODEL;
        try {
            responseText = await nvidiaChat(messages, nvidiaModel);
            usedModel = nvidiaModel;
        } catch (error) {
            console.warn("[Lumi] NVIDIA chat failed, falling back to OpenRouter:", error);
            responseText = await openRouterChat(messages, DEFAULT_CHAT_MODEL);
            usedModel = DEFAULT_CHAT_MODEL;
        }
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
        {id: "mistralai/devstral-small:free",      provider: "openrouter", label: "Devstral Small — Code (Free)", free: true, contextWindow: 32768},
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

    if (NVIDIA_API_BASE) {
        cascade.unshift({
            id: NVIDIA_CHAT_MODEL || "nvidia-local-model",
            provider: "nvidia",
            label: "NVIDIA NIM Chat (Configured)",
            free: true,
        });
    }

    return cascade;
}

// ---------------------------------------------------------------------------
// Prompt enhancement (domain-aware, Studio-compatible)
// ---------------------------------------------------------------------------

export async function enhancePrompt(
    prompt: string,
    domain?: string,
    externalSources?: string[]
): Promise<PromptEnhanceResult> {
    const detectedDomain = domain || detectDomain(prompt);
    const externalSourceContext = buildExternalBrowserSourceContext(externalSources || []);
    const systemPrompt = await buildSystemPrompt(prompt, detectedDomain, externalSourceContext);
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
// ---------------------------------------------------------------------------
// Mission / pipeline (Studio control-plane, Studio-compatible)
// ---------------------------------------------------------------------------

const missions = new Map<string, MissionStatus>();
const missionEvents = new Map<string, MissionEvent[]>();
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const FINETUNE_DIR = path.join(DATA_DIR, "finetune");
const MISSION_STORE_PATH = path.join(DATA_DIR, "missions", "missions.json");
const MISSION_STALLED_TIMEOUT_MS = Number(process.env.LUMI_MISSION_STALLED_TIMEOUT_MS || "30000");
const MISSION_WORKER_INTERVAL_MS = Number(process.env.LUMI_MISSION_WORKER_INTERVAL_MS || "2000");
let missionStoreLoaded = false;
let missionWorkerTimer: NodeJS.Timeout | null = null;
let missionWorkerBusy = false;

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emitMissionEvent(mission: MissionStatus, message: string, detail?: string, type: MissionEvent["type"] = "log"): void {
    const event: MissionEvent = {
        id: generateId(),
        type,
        message,
        detail,
        createdAt: new Date().toISOString(),
    };
    mission.events.push(event);
    missionEvents.set(mission.id, mission.events);
    mission.updatedAt = new Date().toISOString();
    persistMissionStore();
}

function captureMissionArtifact(mission: MissionStatus, artifact: MissionArtifactSummary): void {
    mission.artifacts.push(artifact);
    persistMissionStore();
}

function buildArtifactUrl(artifactId?: string): string | undefined {
    return artifactId ? `/api/lumi/artifacts/${artifactId}` : undefined;
}

function persistMissionStore(): void {
    try {
        mkdirSync(path.dirname(MISSION_STORE_PATH), {recursive: true});
        writeFileSync(MISSION_STORE_PATH, JSON.stringify([...missions.values()], null, 2), "utf8");
    } catch (error) {
        console.warn("[Lumi] Failed to persist mission store:", error);
    }
}

function ensureMissionStoreLoaded(): void {
    if (missionStoreLoaded) return;
    try {
        if (existsSync(MISSION_STORE_PATH)) {
            const raw = readFileSync(MISSION_STORE_PATH, "utf8");
            const parsed = JSON.parse(raw) as MissionStatus[];
            if (Array.isArray(parsed)) {
                parsed.forEach(mission => missions.set(mission.id, mission));
            }
        }
    } catch (error) {
        console.warn("[Lumi] Failed to load mission store:", error);
    }
    missionStoreLoaded = true;
}

function getMissionPolicy(prompt: string): MissionPolicy {
    return {
        maxSteps: Number(process.env.LUMI_MAX_MISSION_STEPS || "5"),
        maxAttempts: Number(process.env.LUMI_MAX_MISSION_ATTEMPTS || "2"),
        maxRuntimeMs: Number(process.env.LUMI_MISSION_MAX_RUNTIME_MS || "180000"),
        allowExternalResearch: process.env.LUMI_ALLOW_EXTERNAL_RESEARCH !== "false",
        allowLocalExecution: isLocalToolExecutionEnabled(),
        requiresApproval: /\b(deploy|publish|delete|remove|wipe|shutdown|execute|shell|secret|token|api key)\b/i.test(prompt),
    };
}

async function buildMissionPlan(prompt: string, policy: MissionPolicy): Promise<MissionPlanStep[]> {
    const planPrompt =
        `You are a mission planner. Decompose the following objective into ${Math.max(1, policy.maxSteps)} concrete jobs. ` +
        `For each job return JSON with fields: name, capability (one of: code, image, audio, video, document, search, build, text, roblox), ` +
        `workerId (agent name), targetFiles (array of filename strings). Return ONLY a JSON array, no markdown fences.\n\nObjective: ${prompt}`;

    let rawPlan = "[]";
    try {
        rawPlan = await openRouterChat(
            [{role: "system", content: "You are a JSON-only mission planner."},
             {role: "user", content: planPrompt}],
            DEFAULT_CHAT_MODEL
        );
    } catch {
        // fall through to a conservative fallback plan
    }

    let jobDefs: any[] = [];
    try {
        jobDefs = JSON.parse(rawPlan.replace(/```json?/g, "").replace(/```/g, "").trim());
        if (!Array.isArray(jobDefs)) jobDefs = [];
    } catch {
        jobDefs = [];
    }

    if (!jobDefs.length) {
        jobDefs = [
            {name: "Inspect the request", capability: "search", workerId: "lumi-core", targetFiles: []},
            {name: "Create a concrete deliverable", capability: "document", workerId: "lumi-core", targetFiles: []},
        ];
    }

    return jobDefs.slice(0, policy.maxSteps).map((job: any, index: number) => ({
        id: generateId(),
        title: job.name || `Task ${index + 1}`,
        capability: job.capability || "text",
        workerId: job.workerId || "lumi-core",
        targetFiles: Array.isArray(job.targetFiles) ? job.targetFiles : [],
        status: "planned",
        attempts: 0,
    }));
}

function recalculateMissionProgress(mission: MissionStatus): void {
    mission.progress.total = mission.plan.length;
    mission.progress.completed = mission.plan.filter(step => step.status === "done").length;
    mission.progress.running = mission.plan.filter(step => step.status === "running").length;
    mission.progress.errored = mission.plan.filter(step => step.status === "failed" || step.status === "blocked").length;
    mission.progress.percent = Math.round((mission.progress.completed / Math.max(1, mission.progress.total)) * 100);
}

async function recordMissionLearning(mission: MissionStatus, step: MissionPlanStep, output: string, decision: string): Promise<void> {
    const summary = `Mission ${mission.id} | decision=${decision} | step=${step.title} | outcome=${output.slice(0, 220)}`;
    mission.learningSummary = [mission.learningSummary, summary].filter(Boolean).join("\n\n");
    await remember(`mission:${mission.id}`, "assistant", summary, ["mission", "autonomy", step.capability], "knowledge");
    persistMissionStore();
}

async function evaluateMissionStep(mission: MissionStatus, step: MissionPlanStep, output: string): Promise<"continue" | "retry" | "branch" | "stop"> {
    const evaluationPrompt = `You are the mission evaluator. Decide the next action for this autonomous task. Reply with exactly one word: continue, retry, branch, or stop.\n\nMission objective: ${mission.prompt}\nStep: ${step.title}\nCapability: ${step.capability}\nOutput summary: ${output.slice(0, 400)}`;
    try {
        const response = await lumiChat({message: evaluationPrompt});
        const normalized = response.content.trim().toLowerCase();
        if (normalized.includes("retry")) return "retry";
        if (normalized.includes("branch")) return "branch";
        if (normalized.includes("stop")) return "stop";
        return "continue";
    } catch {
        return "continue";
    }
}

async function runMissionStep(mission: MissionStatus, step: MissionPlanStep): Promise<string> {
    const taskPrompt = `${mission.prompt}\n\nTask: ${step.title}`;
    let output = "";
    let artifactSummary: MissionArtifactSummary | undefined;

    if (step.capability === "code") {
        const result = await generate({type: "code", prompt: taskPrompt});
        output = result.text || "";
        artifactSummary = result.artifact ? {
            name: step.title,
            kind: "code",
            artifactId: result.artifact.id,
            downloadUrl: buildArtifactUrl(result.artifact.id),
            status: "ready",
        } : undefined;
    } else if (step.capability === "image") {
        const result = await generate({type: "image", prompt: taskPrompt});
        output = result.data ? `[image:base64:${result.mimeType}]` : result.url || "";
        artifactSummary = result.artifact ? {
            name: step.title,
            kind: "image",
            artifactId: result.artifact.id,
            downloadUrl: buildArtifactUrl(result.artifact.id),
            status: "ready",
        } : undefined;
    } else if (step.capability === "audio") {
        const result = await generate({type: "audio", prompt: taskPrompt});
        output = result.data ? `[audio:base64:audio/flac]` : "";
        artifactSummary = result.artifact ? {
            name: step.title,
            kind: "audio",
            artifactId: result.artifact.id,
            downloadUrl: buildArtifactUrl(result.artifact.id),
            status: "ready",
        } : undefined;
    } else if (step.capability === "video") {
        const result = await generate({type: "video", prompt: taskPrompt});
        output = result.url || result.text || "Video generation queued";
        artifactSummary = result.artifact ? {
            name: step.title,
            kind: "video",
            artifactId: result.artifact.id,
            downloadUrl: buildArtifactUrl(result.artifact.id),
            status: "ready",
        } : undefined;
    } else if (step.capability === "document") {
        const result = await generate({type: "document", prompt: taskPrompt});
        output = result.text || "";
        artifactSummary = result.artifact ? {
            name: step.title,
            kind: "document",
            artifactId: result.artifact.id,
            downloadUrl: buildArtifactUrl(result.artifact.id),
            status: "ready",
        } : undefined;
    } else if (step.capability === "build") {
        const result = await generate({type: "code", prompt: `Build a concise starter implementation for: ${taskPrompt}`});
        const workspaceFile = await writeWorkspaceFile(`.data/lumi-workspace/${step.id}-build.ts`, result.text || "");
        const buildCommand = isLocalToolExecutionEnabled()
            ? await runWorkspaceCommand("pnpm", ["run", "build"], {cwd: process.cwd()})
            : {ok: false, blocked: true, message: "Local tool execution disabled"};
        const buildSummary = buildCommand.ok
            ? `Build completed.\n${buildCommand.stdout}`
            : buildCommand.blocked
                ? buildCommand.message
                : `${buildCommand.message}\n${buildCommand.stderr}`;
        output = [result.text || "", workspaceFile.ok ? `Wrote workspace file ${workspaceFile.filePath}` : workspaceFile.message, buildSummary].filter(Boolean).join("\n\n");
        artifactSummary = result.artifact ? {
            name: step.title,
            kind: "build",
            artifactId: result.artifact.id,
            downloadUrl: buildArtifactUrl(result.artifact.id),
            status: "ready",
        } : undefined;
    } else if (step.capability === "search" || step.capability === "research") {
        const research = await lumiChat({message: `Research and summarize the following request. Provide practical next steps and references.\n\n${taskPrompt}`});
        const externalResearch = mission.policy.allowExternalResearch
            ? await queryExternalBrowserSource("yuanbao", taskPrompt, {goal: mission.prompt, sessionMode: "anonymous"})
            : {ok: false, error: "External research disabled by policy", content: ""};
        output = [research.content, externalResearch.ok && externalResearch.content ? `External source summary:\n${externalResearch.content}` : externalResearch.error || ""].filter(Boolean).join("\n\n");
    } else {
        const resp = await lumiChat({message: taskPrompt});
        output = resp.content;
    }

    if (artifactSummary) {
        captureMissionArtifact(mission, artifactSummary);
        emitMissionEvent(mission, `Artifact ready for ${step.title}`, artifactSummary.downloadUrl || "Artifact saved", "artifact");
    }

    return output;
}

export async function bootMission(prompt: string): Promise<MissionBootResult> {
    ensureMissionStoreLoaded();
    const missionId = generateId();
    const now = new Date().toISOString();
    const policy = getMissionPolicy(prompt);
    const plan = await buildMissionPlan(prompt, policy);
    const mission: MissionStatus = {
        id: missionId,
        prompt,
        status: policy.requiresApproval ? "awaiting-approval" : "pending",
        createdAt: now,
        updatedAt: now,
        summary: `Mission "${prompt.slice(0, 80)}" booted with ${plan.length} step(s).`,
        jobs: plan.map(step => ({
            id: step.id,
            title: step.title,
            capability: step.capability,
            status: "queued",
            workerId: step.workerId,
            targetFiles: step.targetFiles,
            startedAt: now,
        })),
        progress: {
            total: plan.length,
            completed: 0,
            running: 0,
            errored: 0,
            percent: 0,
        },
        events: [],
        artifacts: [],
        plan,
        policy,
        startedAt: now,
        lastHeartbeatAt: now,
    };

    missions.set(missionId, mission);
    persistMissionStore();
    emitMissionEvent(mission, "Mission booted", `Planning ${plan.length} work item(s).`, "status");
    if (!policy.requiresApproval) {
        void processMissionQueue();
    }

    return {
        missionId,
        objective: prompt,
        status: policy.requiresApproval ? "awaiting-approval" : "executing",
        summary: mission.summary,
        plannerModel: DEFAULT_CHAT_MODEL,
        executionQueue: plan.map(step => ({
            jobId: step.id,
            name: step.title,
            capability: step.capability,
            workerId: step.workerId,
            targetFiles: step.targetFiles,
            status: "queued",
            stage: "planned",
        })),
        streamUrl: `/api/lumi/missions/${missionId}/events`,
    };
}

export function approveMission(missionId: string): MissionStatus {
    ensureMissionStoreLoaded();
    const mission = missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);
    if (mission.status !== "awaiting-approval") return mission;
    mission.status = "pending";
    mission.updatedAt = new Date().toISOString();
    emitMissionEvent(mission, "Mission approved by supervisor", "Execution resumed.", "status");
    void processMissionQueue();
    return mission;
}

export function getMission(missionId: string): MissionStatus {
    ensureMissionStoreLoaded();
    const mission = missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);
    return { ...mission, jobs: mission.jobs.map(job => ({...job})), events: mission.events.map(event => ({...event})), artifacts: mission.artifacts.map(artifact => ({...artifact})), plan: mission.plan.map(step => ({...step})) };
}

async function processMissionQueue(): Promise<void> {
    if (missionWorkerBusy) return;
    missionWorkerBusy = true;
    try {
        ensureMissionStoreLoaded();

        const staleRunning = [...missions.values()].filter(mission => mission.status === "running");
        for (const mission of staleRunning) {
            const heartbeat = mission.lastHeartbeatAt ? new Date(mission.lastHeartbeatAt).getTime() : new Date(mission.updatedAt).getTime();
            if (Date.now() - heartbeat > MISSION_STALLED_TIMEOUT_MS) {
                mission.status = "stalled";
                mission.updatedAt = new Date().toISOString();
                emitMissionEvent(mission, "Mission stalled", "No heartbeat detected; resuming on the next worker cycle.", "status");
                await executeMissionAsync(mission);
                break;
            }
        }

        const queued = [...missions.values()]
            .filter(mission => mission.status === "pending" || mission.status === "stalled" || mission.status === "retrying")
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        for (const mission of queued) {
            if (mission.status === "running") continue;
            await executeMissionAsync(mission);
            break;
        }
    } finally {
        missionWorkerBusy = false;
    }
}

function startMissionWorker(): void {
    ensureMissionStoreLoaded();
    if (missionWorkerTimer) return;
    missionWorkerTimer = setInterval(() => {
        void processMissionQueue();
    }, MISSION_WORKER_INTERVAL_MS);
    void processMissionQueue();
}

export async function executeMissionAsync(mission: MissionStatus): Promise<void> {
    ensureMissionStoreLoaded();
    if (mission.status === "completed" || mission.status === "failed" || mission.status === "blocked" || mission.status === "awaiting-approval") return;

    mission.status = "running";
    mission.startedAt = mission.startedAt || new Date().toISOString();
    mission.lastHeartbeatAt = new Date().toISOString();
    mission.updatedAt = new Date().toISOString();
    emitMissionEvent(mission, "Mission running", "Planner/executor/evaluator loop engaged.", "status");
    const startedAtMs = Date.now();

    for (let index = 0; index < mission.plan.length; index += 1) {
        const step = mission.plan[index];
        if (step.status === "done") continue;
        if (Date.now() - startedAtMs > mission.policy.maxRuntimeMs) {
            mission.status = "stalled";
            emitMissionEvent(mission, "Mission timed out", "Runtime budget exhausted.", "status");
            break;
        }

        step.status = "running";
        const job = mission.jobs.find(candidate => candidate.id === step.id);
        if (job) {
            job.status = "running";
            job.startedAt = new Date().toISOString();
        }
        mission.lastHeartbeatAt = new Date().toISOString();
        mission.updatedAt = new Date().toISOString();
        persistMissionStore();
        emitMissionEvent(mission, `Starting task: ${step.title}`, `Capability: ${step.capability}`, "status");

        let output = "";
        try {
            output = await runMissionStep(mission, step);
        } catch (error: any) {
            output = `Error: ${error?.message || "unknown failure"}`;
            step.status = "failed";
            if (job) {
                job.status = "error";
                job.error = error?.message || "unknown failure";
                job.completedAt = new Date().toISOString();
            }
            emitMissionEvent(mission, `Task failed: ${step.title}`, error?.message || "unknown failure", "status");
            mission.lastHeartbeatAt = new Date().toISOString();
            mission.updatedAt = new Date().toISOString();
            persistMissionStore();
            await recordMissionLearning(mission, step, output, "retry");
            break;
        }

        step.attempts += 1;
        step.lastResult = output.slice(0, 220);
        const decision = await evaluateMissionStep(mission, step, output);
        if (decision === "retry") {
            step.status = step.attempts >= mission.policy.maxAttempts ? "failed" : "retrying";
            if (job) {
                job.status = step.status === "retrying" ? "queued" : "error";
            }
            mission.status = step.status === "retrying" ? "retrying" : "failed";
            emitMissionEvent(mission, `Retrying task: ${step.title}`, "Evaluator requested a retry.", "status");
            await recordMissionLearning(mission, step, output, decision);
            if (step.status === "retrying") {
                index -= 1;
                continue;
            }
            break;
        }
        if (decision === "branch") {
            step.status = "done";
            if (job) {
                job.status = "done";
                job.completedAt = new Date().toISOString();
            }
            const branchStep: MissionPlanStep = {
                id: generateId(),
                title: `Branch follow-up for ${step.title}`,
                capability: "document",
                status: "planned",
                attempts: 0,
                workerId: "lumi-core",
                targetFiles: [],
                notes: "Branch created by evaluator",
            };
            mission.plan.splice(index + 1, 0, branchStep);
            mission.jobs.push({
                id: branchStep.id,
                title: branchStep.title,
                capability: branchStep.capability,
                status: "queued",
                workerId: branchStep.workerId,
                targetFiles: branchStep.targetFiles,
            });
            emitMissionEvent(mission, `Branch created for ${step.title}`, "Evaluator requested follow-up work.", "status");
            await recordMissionLearning(mission, step, output, decision);
            continue;
        }
        if (decision === "stop") {
            step.status = "blocked";
            if (job) {
                job.status = "warn";
                job.completedAt = new Date().toISOString();
            }
            mission.status = "blocked";
            emitMissionEvent(mission, `Blocked task: ${step.title}`, "Evaluator requested a stop.", "status");
            await recordMissionLearning(mission, step, output, decision);
            break;
        }

        step.status = "done";
        if (job) {
            job.status = "done";
            job.output = output.slice(0, 500);
            job.completedAt = new Date().toISOString();
        }
        emitMissionEvent(mission, `Completed task: ${step.title}`, output.slice(0, 220), "log");
        mission.lastHeartbeatAt = new Date().toISOString();
        mission.updatedAt = new Date().toISOString();
        persistMissionStore();
        await recordMissionLearning(mission, step, output, "continue");
    }

    recalculateMissionProgress(mission);
    if (mission.status === "running") {
        const allDone = mission.plan.every(step => step.status === "done" || step.status === "failed" || step.status === "blocked");
        const anyPrecededByFailure = mission.plan.some(step => step.status === "failed" || step.status === "blocked");
        mission.status = !allDone ? "stalled" : anyPrecededByFailure ? "failed" : "completed";
        mission.completedAt = new Date().toISOString();
    }
    mission.updatedAt = new Date().toISOString();
    emitMissionEvent(mission, mission.status === "completed" ? "Mission completed" : mission.status === "failed" ? "Mission failed" : "Mission stopped", mission.summary, "status");
}

export function getPipelineStatus(missionId: string): MissionStatus {
    ensureMissionStoreLoaded();
    const mission = missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);
    return {
        ...mission,
        jobs: mission.jobs.map(job => ({...job})),
        events: mission.events.map(event => ({...event})),
        artifacts: mission.artifacts.map(artifact => ({...artifact})),
        plan: mission.plan.map(step => ({...step})),
    };
}

export function getMissionTimeline(missionId: string): {mission: MissionStatus; events: MissionEvent[]} {
    ensureMissionStoreLoaded();
    const mission = missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);
    return {
        mission: {
            ...mission,
            jobs: mission.jobs.map(job => ({...job})),
            events: mission.events.map(event => ({...event})),
            artifacts: mission.artifacts.map(artifact => ({...artifact})),
            plan: mission.plan.map(step => ({...step})),
        },
        events: mission.events.map(event => ({...event})),
    };
}

export function listMissions(): MissionStatus[] {
    ensureMissionStoreLoaded();
    return [...missions.values()].map(mission => ({
        ...mission,
        jobs: mission.jobs.map(job => ({...job})),
        events: mission.events.map(event => ({...event})),
        artifacts: mission.artifacts.map(artifact => ({...artifact})),
        plan: mission.plan.map(step => ({...step})),
    }));
}

startMissionWorker();

// ---------------------------------------------------------------------------
// Pipeline status (Studio-compatible)
// ---------------------------------------------------------------------------

async function listFineTuneDatasets(): Promise<string[]> {
    try {
        const entries = await fs.readdir(FINETUNE_DIR, {withFileTypes: true});
        return entries
            .filter(entry => entry.isFile() && entry.name.endsWith(".jsonl"))
            .map(entry => path.join(FINETUNE_DIR, entry.name))
            .sort();
    } catch {
        return [];
    }
}

export async function getFineTuneStatus(): Promise<FineTuneStatus> {
    const datasets = await listFineTuneDatasets();
    const latestDataset = datasets.length > 0 ? datasets[datasets.length - 1] : null;
    return {
        ready: datasets.length > 0,
        seed_dataset: latestDataset,
        datasets,
    };
}

export async function assembleFineTuneDataset(): Promise<{path: string; example_count: number}> {
    const examples = conversationManager
        .list()
        .map(session => ({
            messages: session.messages
                .filter(message => message.role === "user" || message.role === "assistant")
                .map(message => ({role: message.role, content: message.content})),
        }))
        .filter(example => example.messages.length >= 2);

    await fs.mkdir(FINETUNE_DIR, {recursive: true});

    const fineTuneDatasetPath = path.join(FINETUNE_DIR, `lumi-finetune-${Date.now()}.jsonl`);
    const fileContent = examples.map(example => JSON.stringify(example)).join("\n");
    await fs.writeFile(fineTuneDatasetPath, fileContent ? `${fileContent}\n` : "", "utf8");

    return {
        path: fineTuneDatasetPath,
        example_count: examples.length,
    };
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
    storage: {
        artifacts: {backend: string; configured: boolean; bucket?: string};
        memory: {backend: string; configured: boolean; bucket?: string; key?: string};
    };
    availableCapabilities: string[];
    acamEnabled: boolean;
    activeMissions: number;
    uptime: number;
}

export async function getLumiStatus(): Promise<LumiStatus> {
    const ollamaStatus = await getOllamaStatus();
    const artifactStorage = getArtifactStorageStatus();
    const memoryStorage = getMemoryStorageStatus();
    const capabilities: string[] = ["chat"];
    if (OPENROUTER_API_KEY) capabilities.push("multi-model-chat", "code-generation", "prompt-enhancement");
    if (process.env.HUGGINGFACE_API_KEY) capabilities.push("image-generation-hf", "audio-generation");
    if (process.env.STABILITY_API_KEY) capabilities.push("image-generation-stability");
    if (process.env.FAL_KEY) capabilities.push("video-generation-fal");
    if (process.env.REPLICATE_API_KEY) capabilities.push("video-generation-replicate");
    if (NVIDIA_API_BASE) capabilities.push("nvidia-chat", "video-generation-nvidia");
    if (ollamaStatus.available) capabilities.push("local-model-ollama");
    if (process.env.ROBLOX_API_KEY) capabilities.push("roblox-publishing");
    if (artifactStorage.configured) capabilities.push("artifact-storage-r2");

    return {
        name: "Lumi",
        version: "1.0.0",
        platform: "Trezzhaus",
        studioUrl: "https://studio.trezzhaus.com",
        openRouterConnected: !!OPENROUTER_API_KEY,
        ollamaConnected: ollamaStatus.available,
        memoryBackend: memoryStorage.backend,
        storage: {
            artifacts: {
                backend: artifactStorage.backend,
                configured: artifactStorage.configured,
                bucket: artifactStorage.bucket,
            },
            memory: {
                backend: memoryStorage.backend,
                configured: memoryStorage.configured,
                bucket: memoryStorage.bucket,
                key: memoryStorage.key,
            },
        },
        availableCapabilities: capabilities,
        acamEnabled: defaultAcamConfig.enabled,
        activeMissions: [...missions.values()].filter(m => m.status === "running").length,
        uptime: Math.floor((Date.now() - startTime) / 1000),
    };
}
