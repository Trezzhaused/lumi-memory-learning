import {Octokit} from "@octokit/core";
import express, {NextFunction, Request, Response} from "express";
import path from "node:path";
import {Webhook, WebhookUnbrandedRequiredHeaders, WebhookVerificationError} from "standardwebhooks"
import {RenderDeploy, RenderEvent, RenderService, WebhookPayload} from "./render";
import {
    acamMiddleware, acamContentGuard, defaultAcamConfig, auditLog,
    getRequestOrigin, isOriginAllowed,
} from "./lumi-acam";
import {remember, recall, forget, memoryStats, search as memSearch, getMemoryStorageStatus} from "./lumi-memory";
import {generate} from "./lumi-generators";
import {
    getChunk,
    getChunkStoreStats,
    ingestTextChunks,
    listChunks,
    runLocalIndexBenchmark,
    searchChunks,
    updateChunkQuarantine,
} from "./lumi-vector-store";
import {buildProject} from "./lumi-studio";
import {getArtifact, readArtifactBuffer, getArtifactStorageStatus, listArtifacts} from "./lumi-storage";
import {
    lumiChat, getChatHistory, getModelCascade, enhancePrompt,
    bootMission, getPipelineStatus, getMissionTimeline, listMissions, getLumiStatus, getFineTuneStatus, assembleFineTuneDataset,
    getOllamaStatus, conversationManager,
} from "./lumi";
import {converseSpeech, formatBraille, speakText, transcribeAudio} from "./lumi-speech";
import {buildPromptTrainer} from "./lumi-prompt-trainer";
import {buildTrainingResourceAnalysis} from "./lumi-training-resources";
import {auditQuestionPerformance, getSelfPacedQuestionBank, selectNextQuestionKL} from "./lumi-self-paced";

// ============================================================================
// App setup
// ============================================================================

const app = express();
const port = process.env.PORT || 3001;

app.use(express.static(path.join(process.cwd(), "public")));
app.use("/data/training-datasets", express.static(path.join(process.cwd(), "data", "training-datasets")));
app.use("/data/voxel51-dataset-zoo", express.static(path.join(process.cwd(), "data", "voxel51-dataset-zoo")));
app.use("/data/educational-datasets", express.static(path.join(process.cwd(), "data", "educational-datasets")));
app.use("/data/self-paced-learning", express.static(path.join(process.cwd(), "data", "self-paced-learning")));
    
app.use((req: Request, res: Response, next: NextFunction) => {
    const requestOrigin = getRequestOrigin(req.headers);
    const originAllowed = requestOrigin
        ? isOriginAllowed(requestOrigin, defaultAcamConfig.allowedOrigins)
        : true;

    if (requestOrigin && originAllowed) {
        res.setHeader("Access-Control-Allow-Origin", requestOrigin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Session-Id");
        res.setHeader("Access-Control-Expose-Headers", "Content-Type");
    }

    if (req.method === "OPTIONS") {
        if (!originAllowed) {
            res.status(403).json({error: "Origin not allowed"});
            return;
        }
        res.status(204).end();
        return;
    }

    next();
});

// Apply ACAM middleware globally (rate-limit + origin check)
app.use(acamMiddleware(defaultAcamConfig));

// JSON body parsing for all routes except /webhook (needs raw body)
app.use((req, res, next) => {
    if (req.path === "/webhook") return next();
    express.json()(req, res, next);
});

// ============================================================================
// Render Webhook (optional — only active when RENDER_WEBHOOK_SECRET is set)
// ============================================================================

const renderWebhookSecret = process.env.RENDER_WEBHOOK_SECRET || '';
// renderAPIURL is read from a trusted server-side environment variable.
// It is validated at startup to the expected Render API origin.
const RAW_RENDER_API_URL = process.env.RENDER_API_URL || "https://api.render.com/v1";
const RENDER_ALLOWED_HOSTS = ["api.render.com"];
function buildRenderApiUrl(path: string): string {
    // Enforce that RENDER_API_URL always points to an expected Render host
    try {
        const base = new URL(RAW_RENDER_API_URL);
        if (!RENDER_ALLOWED_HOSTS.includes(base.hostname)) {
            console.warn(`[Render] RENDER_API_URL host "${base.hostname}" is not in allow-list; using default.`);
            return `https://api.render.com/v1${path}`;
        }
    } catch {
        return `https://api.render.com/v1${path}`;
    }
    return `${RAW_RENDER_API_URL}${path}`;
}
const renderAPIToken = process.env.RENDER_API_KEY || '';
const githubAPIToken = process.env.GITHUB_API_TOKEN || '';
const githubOwnerName = process.env.GITHUB_OWNER_NAME || '';
const githubRepoName = process.env.GITHUB_REPO_NAME || '';
const githubWorkflowID = process.env.GITHUB_WORKFLOW_ID || 'example.yaml';

if (!renderWebhookSecret) {
    console.warn("[Render] RENDER_WEBHOOK_SECRET not set — /webhook endpoint disabled.");
}

const octokit = githubAPIToken ? new Octokit({auth: githubAPIToken}) : null;

app.post("/webhook", express.raw({type: 'application/json'}), (req: Request, res: Response, next: NextFunction) => {
    if (!renderWebhookSecret) {
        res.status(503).json({error: "Webhook not configured"});
        return;
    }
    try {
        validateWebhook(req);
    } catch (error) {
        return next(error);
    }
    const payload: WebhookPayload = JSON.parse(req.body);
    res.status(200).send({}).end();
    handleWebhook(payload);
});

// ============================================================================
// Health / root
// ============================================================================

app.get('/', (_req: Request, res: Response) => {
    res.json({
        name: "Lumi Intelligence Center",
        version: "1.0.0",
        platform: "Trezzhaus",
        studioUrl: "https://studio.trezzhaus.com",
        docs: "/api/lumi/status",
    });
});

// ============================================================================
// Lumi API  — mirrors TrezzWorld Production Studio AIModelBridge.ts endpoints
// ============================================================================

const lumiRouter = express.Router();
lumiRouter.use(acamContentGuard(defaultAcamConfig));

// POST /api/lumi/chat
lumiRouter.post("/chat", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = req.headers["x-session-id"] as string | undefined || "default";
        const result = await lumiChat(req.body, sessionId);
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/lumi/chat/history?limit=40&mission_id=xxx
lumiRouter.get("/chat/history", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = (req.query.mission_id as string) ||
                          (req.headers["x-session-id"] as string) || "default";
        const limit = parseInt(req.query.limit as string || "40", 10);
        const history = await getChatHistory(sessionId, limit);
        res.json({history});
    } catch (err) { next(err); }
});

// GET /api/lumi/models
lumiRouter.get("/models", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const cascade = await getModelCascade();
        res.json({cascade});
    } catch (err) { next(err); }
});

// POST /api/lumi/enhance-prompt
lumiRouter.post("/enhance-prompt", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {prompt, domain} = req.body;
        if (!prompt) { res.status(400).json({error: "prompt is required"}); return; }
        const result = await enhancePrompt(prompt, domain);
        res.json(result);
    } catch (err) { next(err); }
});

// POST /api/lumi/self-paced/select-next
lumiRouter.post("/self-paced/select-next", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body ?? {};
        const history = Array.isArray(body.history) ? body.history : [];
        const requestedCandidates = Array.isArray(body.candidates) ? body.candidates : [];
        const tierLevel = body.tierLevel ?? body.tier_level;
        const subject = body.subject;
        const topic = body.topic;
        const excludeIds = Array.isArray(body.excludeIds) ? body.excludeIds : [];
        const limit = typeof body.limit === "number" ? body.limit : undefined;
        const targetProportions = body.targetProportions ?? {};

        const bank = getSelfPacedQuestionBank();
        const sourceQuestions = requestedCandidates.length > 0 ? requestedCandidates : bank.questions;
        const filteredQuestions = sourceQuestions.filter((question: any) => {
            const questionTier = question.tier_level ?? question.tier_alignment?.tier_level ?? 3;
            const matchesTier = tierLevel == null || Number(questionTier) === Number(tierLevel);
            const matchesSubject = !subject || String(question.subject).toLowerCase() === String(subject).toLowerCase();
            const matchesTopic = !topic || String(question.topic).toLowerCase() === String(topic).toLowerCase();
            const questionId = typeof question.id === "string" ? question.id : typeof question.question_id === "string" ? question.question_id : undefined;
            const isExcluded = Boolean(questionId && excludeIds.includes(questionId));
            return matchesTier && matchesSubject && matchesTopic && !isExcluded;
        });

        const candidates = typeof limit === "number" ? filteredQuestions.slice(0, limit) : filteredQuestions;
        const selection = selectNextQuestionKL(candidates, history, {targetProportions});
        if (!selection.item) {
            res.status(404).json({error: "No questions available for the requested filters"});
            return;
        }

        res.json({
            selectedQuestion: selection.item,
            routing: {
                eapTheta: selection.eapTheta,
                klInformation: selection.klInformation,
                priorityScore: selection.priorityScore,
                exposureCounts: selection.exposureCounts,
            },
        });
    } catch (err) { next(err); }
});

// POST /api/lumi/self-paced/audit-question
lumiRouter.post("/self-paced/audit-question", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body ?? {};
        const questionMetadata = body.questionMetadata ?? body.question;
        const studentResponses = Array.isArray(body.studentResponses) ? body.studentResponses : [];
        if (!questionMetadata) {
            res.status(400).json({error: "question is required"});
            return;
        }
        res.json(auditQuestionPerformance(questionMetadata, studentResponses));
    } catch (err) { next(err); }
});

// GET /api/lumi/finetune/status
lumiRouter.get("/finetune/status", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await getFineTuneStatus());
    } catch (err) { next(err); }
});

// POST /api/lumi/finetune/assemble
lumiRouter.post("/finetune/assemble", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await assembleFineTuneDataset());
    } catch (err) { next(err); }
});

// GET /api/lumi/status
lumiRouter.get("/status", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await getLumiStatus());
    } catch (err) { next(err); }
});

// GET /api/lumi/memory/stats
lumiRouter.get("/memory/stats", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await memoryStats());
    } catch (err) { next(err); }
});

// GET /api/lumi/storage
lumiRouter.get("/storage", (_req: Request, res: Response) => {
    res.json({
        artifacts: getArtifactStorageStatus(),
        memory: getMemoryStorageStatus(),
    });
});

// POST /api/lumi/vector-index/chunks
lumiRouter.post("/vector-index/chunks", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {text, source, sessionId, tags, maxChars, overlapChars, quarantine, provenance, importedBy} = req.body ?? {};
        if (!text || typeof text !== "string") {
            res.status(400).json({error: "text is required"});
            return;
        }
        const chunks = await ingestTextChunks({
            text,
            source,
            sessionId,
            tags: Array.isArray(tags) ? tags : undefined,
            maxChars: typeof maxChars === "number" ? maxChars : undefined,
            overlapChars: typeof overlapChars === "number" ? overlapChars : undefined,
            quarantine,
            provenance,
            importedBy,
        });
        res.json({chunks});
    } catch (err) { next(err); }
});

// POST /api/lumi/vector-index/search
lumiRouter.post("/vector-index/search", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {query, limit, includeQuarantined, source} = req.body ?? {};
        if (!query || typeof query !== "string") {
            res.status(400).json({error: "query is required"});
            return;
        }
        const results = await searchChunks(query, {
            limit: typeof limit === "number" ? limit : undefined,
            includeQuarantined: Boolean(includeQuarantined),
            source: typeof source === "string" ? source : undefined,
        });
        res.json({results});
    } catch (err) { next(err); }
});

// GET /api/lumi/vector-index/chunks
lumiRouter.get("/vector-index/chunks", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const chunks = await listChunks(20);
        res.json({chunks});
    } catch (err) { next(err); }
});

// GET /api/lumi/vector-index/chunks/:chunkId
lumiRouter.get("/vector-index/chunks/:chunkId", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const chunk = await getChunk(req.params.chunkId);
        if (!chunk) {
            res.status(404).json({error: "chunk not found"});
            return;
        }
        res.json({chunk});
    } catch (err) { next(err); }
});

// PATCH /api/lumi/vector-index/chunks/:chunkId/quarantine
lumiRouter.patch("/vector-index/chunks/:chunkId/quarantine", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {flagged, reason, flaggedAt, flaggedBy} = req.body ?? {};
        const chunk = await updateChunkQuarantine(req.params.chunkId, {
            flagged: Boolean(flagged),
            reason: typeof reason === "string" ? reason : undefined,
            flaggedAt: typeof flaggedAt === "string" ? flaggedAt : undefined,
            flaggedBy: typeof flaggedBy === "string" ? flaggedBy : undefined,
        }, typeof req.headers["x-session-id"] === "string" ? req.headers["x-session-id"] : "system");
        if (!chunk) {
            res.status(404).json({error: "chunk not found"});
            return;
        }
        res.json({chunk});
    } catch (err) { next(err); }
});

// GET /api/lumi/vector-index/stats
lumiRouter.get("/vector-index/stats", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await getChunkStoreStats());
    } catch (err) { next(err); }
});

// GET /api/lumi/benchmark/local-index
lumiRouter.get("/benchmark/local-index", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await runLocalIndexBenchmark());
    } catch (err) { next(err); }
});

// GET /api/lumi/memory/:sessionId
lumiRouter.get("/memory/:sessionId", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entries = await recall(req.params.sessionId, 50);
        res.json({entries});
    } catch (err) { next(err); }
});

// DELETE /api/lumi/memory/:sessionId
lumiRouter.delete("/memory/:sessionId", async (req: Request, res: Response, next: NextFunction) => {
    try {
        await forget(req.params.sessionId);
        res.json({ok: true});
    } catch (err) { next(err); }
});

// POST /api/lumi/memory/search
lumiRouter.post("/memory/search", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {query, limit} = req.body;
        if (!query) { res.status(400).json({error: "query is required"}); return; }
        const results = await memSearch(query, limit || 10);
        res.json({results});
    } catch (err) { next(err); }
});

// POST /api/lumi/generate  (image / video / audio / code / text / document)
lumiRouter.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await generate(req.body);
        res.json(result);
    } catch (err) { next(err); }
});

// POST /api/lumi/speech/transcribe
lumiRouter.post("/speech/transcribe", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {audioBase64, mimeType} = req.body;
        if (!audioBase64) {
            res.status(400).json({error: "audioBase64 is required"});
            return;
        }
        const result = await transcribeAudio(audioBase64, mimeType || "audio/webm");
        res.json(result);
    } catch (err) { next(err); }
});

// POST /api/lumi/speech/speak
lumiRouter.post("/speech/speak", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {text, voice, format} = req.body;
        if (!text) {
            res.status(400).json({error: "text is required"});
            return;
        }
        const result = await speakText(text, {voice, format});
        res.json(result);
    } catch (err) { next(err); }
});

// POST /api/lumi/speech/converse
lumiRouter.post("/speech/converse", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {audioBase64, mimeType, domain, missionId} = req.body;
        if (!audioBase64) {
            res.status(400).json({error: "audioBase64 is required"});
            return;
        }
        const sessionId = (req.headers["x-session-id"] as string | undefined) || "default";
        const result = await converseSpeech(audioBase64, mimeType || "audio/webm", sessionId, {domain, missionId});
        res.json(result);
    } catch (err) { next(err); }
});

// POST /api/lumi/speech/braille
lumiRouter.post("/speech/braille", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {text} = req.body;
        if (!text) {
            res.status(400).json({error: "text is required"});
            return;
        }
        res.json({text, braille: formatBraille(text)});
    } catch (err) { next(err); }
});

// POST /api/lumi/training-resources
lumiRouter.post("/training-resources", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = (req.headers["x-session-id"] as string | undefined) || "default";
        const analysis = buildTrainingResourceAnalysis(req.body);
        const summary = [
            analysis.overview,
            analysis.knowledgeBankSummary,
            `Priority resources: ${analysis.priorityResources.join(", ")}`,
        ].join("\n\n");
        await remember(sessionId, "assistant", summary, ["training", "knowledge-bank", "resources"], "knowledge");
        res.json(analysis);
    } catch (err) { next(err); }
});

// POST /api/lumi/mission/boot
lumiRouter.post("/mission/boot", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {prompt} = req.body;
        if (!prompt) { res.status(400).json({error: "prompt is required"}); return; }
        const result = await bootMission(prompt);
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/lumi/missions/:missionId/events
lumiRouter.get("/missions/:missionId/events", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timeline = getMissionTimeline(req.params.missionId);
        res.json(timeline);
    } catch (err) { next(err); }
});

// POST /api/lumi/prompt-trainer
lumiRouter.post("/prompt-trainer", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = buildPromptTrainer(req.body);
        res.json(result);
    } catch (err) { next(err); }
});

// GET /api/lumi/artifacts
lumiRouter.get("/artifacts", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const artifacts = await listArtifacts(50);
        res.json({artifacts});
    } catch (err) { next(err); }
});

// GET /api/lumi/artifacts/:artifactId
lumiRouter.get("/artifacts/:artifactId", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const artifact = await getArtifact(req.params.artifactId);
        if (!artifact) {
            res.status(404).json({error: "artifact not found"});
            return;
        }
        if (artifact.storage === "r2" && artifact.url) {
            res.redirect(artifact.url);
            return;
        }
        const content = await readArtifactBuffer(req.params.artifactId);
        if (!content) {
            res.status(404).json({error: "artifact not found"});
            return;
        }
        res.setHeader("Content-Type", artifact.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${artifact.filename}"`);
        res.send(content.buffer);
    } catch (err) { next(err); }
});

// POST /api/lumi/project  (scaffold a full project)
lumiRouter.post("/project", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = req.headers["x-session-id"] as string | undefined || "default";
        const spec = {...req.body, sessionId};
        const project = await buildProject(spec);
        res.json(project);
    } catch (err) { next(err); }
});

// GET /api/lumi/audit?limit=100
lumiRouter.get("/audit", (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string || "100", 10);
    res.json({entries: auditLog.query({limit})});
});

// GET /api/lumi/conversations
lumiRouter.get("/conversations", (_req: Request, res: Response) => {
    res.json({sessions: conversationManager.list()});
});

app.use("/api/lumi", lumiRouter);

// ============================================================================
// Studio control-plane  — mirrors AIModelBridge bootMission / pipeline
// ============================================================================

const studioRouter = express.Router();
studioRouter.use(express.json());

// POST /api/studio/control-plane/boot
studioRouter.post("/control-plane/boot", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {prompt} = req.body;
        if (!prompt) { res.status(400).json({error: "prompt is required"}); return; }
        const result = await bootMission(prompt);
        res.json(result);
    } catch (err) { next(err); }
});

app.use("/api/studio", studioRouter);

// ============================================================================
// Pipeline  — mirrors AIModelBridge getPipelineStatus / listMissions
// ============================================================================

const pipelineRouter = express.Router();

// GET /api/pipeline/missions
pipelineRouter.get("/missions", (_req: Request, res: Response) => {
    res.json({missions: listMissions()});
});

// GET /api/pipeline/:id/status
pipelineRouter.get("/:id/status", (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(getPipelineStatus(req.params.id));
    } catch (err) { next(err); }
});

app.use("/api/pipeline", pipelineRouter);

// ============================================================================
// Video jobs  — mirrors AIModelBridge video endpoints
// ============================================================================

interface VideoJob {
    jobId: string;
    concept: string;
    durationSeconds: number;
    style: string;
    resolution: string;
    fps: number;
    status: "queued" | "generating_storyboard" | "rendering" | "encoding" | "done" | "error";
    progress: number;
    message: string;
    outputPath: string | null;
    downloadReady: boolean;
    error: string | null;
    createdAt: number;
}

const videoJobs = new Map<string, VideoJob>();

const videoRouter = express.Router();
videoRouter.use(express.json());

// POST /api/video/create
videoRouter.post("/create", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            concept, durationSeconds = 60, style = "cinematic",
            resolution = "1080p", fps = 24,
        } = req.body;
        if (!concept) { res.status(400).json({error: "concept is required"}); return; }

        const jobId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const job: VideoJob = {
            jobId, concept, durationSeconds, style, resolution, fps,
            status: "queued", progress: 0,
            message: "Video job queued",
            outputPath: null, downloadReady: false,
            error: null, createdAt: Date.now(),
        };
        videoJobs.set(jobId, job);

        // Kick off async generation
        runVideoJobAsync(job).catch(err => console.error("[Video] Job error:", err));

        res.json(job);
    } catch (err) { next(err); }
});

// GET /api/video/jobs
videoRouter.get("/jobs", (_req: Request, res: Response) => {
    res.json({jobs: [...videoJobs.values()]});
});

// GET /api/video/:id/status
videoRouter.get("/:id/status", (req: Request, res: Response) => {
    const job = videoJobs.get(req.params.id);
    if (!job) { res.status(404).json({error: "Video job not found"}); return; }
    res.json(job);
});

// GET /api/video/:id/download  (redirects to URL when ready)
videoRouter.get("/:id/download", (req: Request, res: Response) => {
    const job = videoJobs.get(req.params.id);
    if (!job) { res.status(404).json({error: "Video job not found"}); return; }
    if (!job.downloadReady || !job.outputPath) {
        res.status(202).json({error: "Video not ready yet", status: job.status, progress: job.progress});
        return;
    }
    res.redirect(302, job.outputPath);
});

app.use("/api/video", videoRouter);

async function runVideoJobAsync(job: VideoJob): Promise<void> {
    job.status = "generating_storyboard";
    job.progress = 10;
    job.message = "Generating storyboard...";
    try {
        job.status = "rendering";
        job.progress = 30;
        job.message = "Rendering frames...";

        const result = await generate({
            type: "video",
            prompt: `${job.concept}, ${job.style} style, ${job.fps}fps`,
            duration: job.durationSeconds,
        });

        job.status = "done";
        job.progress = 100;
        job.outputPath = result.url || null;
        job.downloadReady = !!result.url;
        job.message = "Video ready";
    } catch (err: any) {
        job.status = "error";
        job.error = err.message;
        job.message = `Error: ${err.message}`;
    }
}

// ============================================================================
// Ollama status  — mirrors AIModelBridge getOllamaStatus
// ============================================================================

app.get("/api/ollama/status", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await getOllamaStatus());
    } catch (err) { next(err); }
});

// ============================================================================
// Global error handler
// ============================================================================

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    if (err instanceof WebhookVerificationError) {
        res.status(400).json({error: "Webhook verification failed"});
    } else {
        res.status(500).json({error: err.message || "Internal server error"});
    }
});

// ============================================================================
// Server startup
// ============================================================================

const server = app.listen(port, () =>
    console.log(`[Lumi] Intelligence Center listening on port ${port}`)
);

// ============================================================================
// Render Webhook helpers (unchanged from original)
// ============================================================================

function validateWebhook(req: Request) {
    const headers: WebhookUnbrandedRequiredHeaders = {
        "webhook-id": req.header("webhook-id") || "",
        "webhook-timestamp": req.header("webhook-timestamp") || "",
        "webhook-signature": req.header("webhook-signature") || ""
    };
    const wh = new Webhook(renderWebhookSecret);
    wh.verify(req.body, headers);
}

async function handleWebhook(payload: WebhookPayload) {
    try {
        switch (payload.type) {
            case "deploy_ended": {
                console.log("handling deploy_ended event");
                const event = await fetchEventInfo(payload);
                if (event.details.status != 2) {
                    console.log(`deploy ended for service ${payload.data.serviceId} with unsuccessful status`);
                    return;
                }
                const deploy = await fetchDeployInfo(payload.data.serviceId, event.details.deployId);
                if (!deploy.commit) {
                    console.log(`ignoring deploy success for image backed service: ${payload.data.serviceId}`);
                    return;
                }
                const service = await fetchServiceInfo(payload);
                if (!service.repo.includes(`${githubOwnerName}/${githubRepoName}`)) {
                    console.log(`ignoring deploy success for another service: ${service.name}`);
                    return;
                }
                console.log(`triggering github workflow for ${githubOwnerName}/${githubRepoName} for ${service.name}`);
                await triggerWorkflow(service.id, service.branch);
                return;
            }
            default:
                console.log(`unhandled webhook type ${payload.type} for service ${payload.data.serviceId}`);
        }
    } catch (error) {
        console.error(error);
    }
}

async function triggerWorkflow(serviceID: string, branch: string) {
    if (!octokit) { console.error("GitHub token not configured, cannot trigger workflow"); return; }
    await octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
        owner: githubOwnerName,
        repo: githubRepoName,
        workflow_id: githubWorkflowID,
        ref: branch,
        inputs: {serviceID},
        headers: {'X-GitHub-Api-Version': '2022-11-28'}
    });
}

async function fetchEventInfo(payload: WebhookPayload): Promise<RenderEvent> {
    const url = buildRenderApiUrl(`/events/${payload.data.id}`);
    console.log(`fetching event info at ${url}`);
    const res = await fetch(url, {
        method: "GET",
        headers: {accept: "application/json", authorization: "Bearer " + renderAPIToken},
    });
    if (res.ok) return res.json() as Promise<RenderEvent>;
    throw new Error(`unable to fetch event info; received code ${res.status.toString()}`);
}

async function fetchDeployInfo(serviceId: string, deployId: string): Promise<RenderDeploy> {
    const res = await fetch(buildRenderApiUrl(`/services/${serviceId}/deploys/${deployId}`), {
        method: "get",
        headers: {"Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + renderAPIToken},
    });
    if (res.ok) return res.json() as Promise<RenderDeploy>;
    throw new Error(`unable to fetch deploy info; received code :${res.status.toString()}`);
}

async function fetchServiceInfo(payload: WebhookPayload): Promise<RenderService> {
    const res = await fetch(buildRenderApiUrl(`/services/${payload.data.serviceId}`), {
        method: "get",
        headers: {"Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + renderAPIToken},
    });
    if (res.ok) return res.json() as Promise<RenderService>;
    throw new Error(`unable to fetch service info; received code :${res.status.toString()}`);
}

process.on('SIGTERM', () => {
    console.debug('SIGTERM signal received: closing HTTP server');
    server.close(() => { console.debug('HTTP server closed'); });
});
