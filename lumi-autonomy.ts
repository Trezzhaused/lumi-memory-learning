import {spawn} from "node:child_process";
import {promises as fs} from "node:fs";
import path from "node:path";
import {auditLog} from "./lumi-acam";
import {lumiChat} from "./lumi";
import {remember} from "./lumi-memory";

export type AutonomyTaskStatus = "queued" | "running" | "completed" | "failed" | "blocked";
export type ToolTier = "read_only" | "safe_write" | "destructive" | "external_network" | "owner_only";

export interface ToolInvocation {
    name: string;
    args: Record<string, unknown>;
    tier?: ToolTier;
    requiresApproval?: boolean;
}

export interface AutonomyStep {
    id: string;
    description: string;
    tool?: ToolInvocation;
    expectedOutcome?: string;
    status: "pending" | "running" | "done" | "failed" | "blocked";
    attempts: number;
    startedAt?: string;
    completedAt?: string;
    output?: string;
    error?: string;
    policy?: {
        allowed: boolean;
        tier: ToolTier;
        reason?: string;
    };
}

export interface AutonomyCheckpoint {
    id: string;
    createdAt: string;
    summary: string;
    state: string;
}

export interface AutonomyTask {
    id: string;
    objective: string;
    status: AutonomyTaskStatus;
    createdAt: string;
    updatedAt: string;
    steps: AutonomyStep[];
    checkpoints: AutonomyCheckpoint[];
    lastError?: string;
    summary?: string;
    attempts: number;
    metadata?: Record<string, unknown>;
}

export interface AutonomyQueueState {
    tasks: AutonomyTask[];
    lastUpdated: string;
}

export interface QueuedAutonomyTaskRequest {
    objective: string;
    steps?: AutonomyStep[];
    metadata?: Record<string, unknown>;
}

export interface ToolExecutionResult {
    ok: boolean;
    output?: string;
    error?: string;
    stdout?: string;
    stderr?: string;
    artifactPath?: string;
    metadata?: Record<string, unknown>;
}

export interface AutonomyBenchmarkResult {
    objective: string;
    taskId: string;
    status: AutonomyTaskStatus;
    summary?: string;
}

function getDataDir(): string {
    return process.env.DATA_DIR || path.join(process.cwd(), ".data");
}

function getAutonomyStatePath(): string {
    return path.join(getDataDir(), "autonomy-state.json");
}

function generateId(prefix = "autonomy"): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getLoopIntervalMs(): number {
    const parsed = Number(process.env.LUMI_AUTONOMY_LOOP_MS || "7000");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 7000;
}

function canUseOwnerActions(): boolean {
    return process.env.LUMI_AUTONOMY_ALLOW_OWNER_ACTIONS === "true";
}

function canUseDestructiveActions(): boolean {
    return process.env.LUMI_AUTONOMY_ALLOW_DESTRUCTIVE === "true";
}

function canUseNetworkActions(): boolean {
    return process.env.LUMI_AUTONOMY_ALLOW_NETWORK === "true";
}

function normalizeTaskState(raw: Partial<AutonomyQueueState> | null | undefined): AutonomyQueueState {
    return {
        tasks: Array.isArray(raw?.tasks) ? raw.tasks as AutonomyTask[] : [],
        lastUpdated: raw?.lastUpdated || new Date().toISOString(),
    };
}

let autonomyState: AutonomyQueueState = {tasks: [], lastUpdated: new Date().toISOString()};
let loopTimer: NodeJS.Timeout | null = null;
let loopStarted = false;
let loopBusy = false;

async function ensureStateFile(): Promise<void> {
    const statePath = getAutonomyStatePath();
    await fs.mkdir(path.dirname(statePath), {recursive: true});
    try {
        await fs.access(statePath);
    } catch {
        await fs.writeFile(statePath, JSON.stringify(autonomyState, null, 2), "utf8");
    }
}

async function loadState(): Promise<AutonomyQueueState> {
    await ensureStateFile();
    const statePath = getAutonomyStatePath();
    try {
        const raw = await fs.readFile(statePath, "utf8");
        const parsed = JSON.parse(raw) as Partial<AutonomyQueueState>;
        autonomyState = normalizeTaskState(parsed);
        return autonomyState;
    } catch {
        autonomyState = {tasks: [], lastUpdated: new Date().toISOString()};
        return autonomyState;
    }
}

async function persistState(): Promise<void> {
    await ensureStateFile();
    autonomyState.lastUpdated = new Date().toISOString();
    const statePath = getAutonomyStatePath();
    await fs.writeFile(statePath, JSON.stringify(autonomyState, null, 2), "utf8");
}

function createCheckpoint(task: AutonomyTask, summary: string, state: string): AutonomyCheckpoint {
    return {
        id: generateId("checkpoint"),
        createdAt: new Date().toISOString(),
        summary,
        state,
    };
}

function appendCheckpoint(task: AutonomyTask, summary: string, state: string): void {
    task.checkpoints.push(createCheckpoint(task, summary, state));
    if (task.checkpoints.length > 20) {
        task.checkpoints.splice(0, task.checkpoints.length - 20);
    }
}

function buildDefaultSteps(objective: string): AutonomyStep[] {
    const lower = objective.toLowerCase();
    const baseDescription = lower.includes("inspect") || lower.includes("review")
        ? `Inspect the repository and gather the context needed for: ${objective}`
        : `Inspect the repository and understand the work needed for: ${objective}`;
    return [
        {
            id: generateId("step"),
            description: baseDescription,
            tool: {
                name: "list_dir",
                args: {path: process.cwd()},
                tier: "read_only",
            },
            status: "pending",
            attempts: 0,
        },
        {
            id: generateId("step"),
            description: `Read the main project manifest to ground the execution for: ${objective}`,
            tool: {
                name: "read_file",
                args: {path: path.join(process.cwd(), "package.json")},
                tier: "read_only",
            },
            status: "pending",
            attempts: 0,
        },
        {
            id: generateId("step"),
            description: `Capture a concise summary and verification note for: ${objective}`,
            tool: {
                name: "run_command",
                args: {command: ["bash", "-lc", "pwd && ls -1"], cwd: process.cwd()},
                tier: "read_only",
            },
            status: "pending",
            attempts: 0,
        },
    ];
}

function evaluateToolPolicy(tool: ToolInvocation): {allowed: boolean; reason?: string; tier: ToolTier} {
    const tier = tool.tier || "read_only";
    if (tier === "read_only") {
        return {allowed: true, tier};
    }
    if (tier === "safe_write") {
        return {allowed: true, tier};
    }
    if (tier === "destructive") {
        return {
            allowed: canUseDestructiveActions(),
            reason: canUseDestructiveActions() ? undefined : "Destructive actions disabled by policy",
            tier,
        };
    }
    if (tier === "external_network") {
        return {
            allowed: canUseNetworkActions(),
            reason: canUseNetworkActions() ? undefined : "External network actions disabled by policy",
            tier,
        };
    }
    if (tier === "owner_only") {
        return {
            allowed: canUseOwnerActions(),
            reason: canUseOwnerActions() ? undefined : "Owner-only actions disabled by policy",
            tier,
        };
    }
    return {allowed: true, tier};
}

async function runCommandTool(tool: ToolInvocation): Promise<ToolExecutionResult> {
    const command = Array.isArray(tool.args.command) ? (tool.args.command as string[]) : [];
    const cwd = typeof tool.args.cwd === "string" ? tool.args.cwd : process.cwd();
    if (!command.length) {
        return {ok: false, error: "No command provided"};
    }

    const child = spawn(command[0], command.slice(1), {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });

    const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", resolve);
    });

    if (exitCode !== 0) {
        return {ok: false, stdout, stderr, error: `Command exited with ${exitCode}`};
    }

    return {ok: true, stdout, stderr};
}

async function readFileTool(tool: ToolInvocation): Promise<ToolExecutionResult> {
    const filePath = typeof tool.args.path === "string" ? tool.args.path : "";
    if (!filePath) return {ok: false, error: "No path provided"};
    const content = await fs.readFile(filePath, "utf8");
    return {ok: true, output: content.slice(0, 4000)};
}

async function writeFileTool(tool: ToolInvocation): Promise<ToolExecutionResult> {
    const filePath = typeof tool.args.path === "string" ? tool.args.path : "";
    const content = typeof tool.args.content === "string" ? tool.args.content : "";
    if (!filePath) return {ok: false, error: "No path provided"};
    await fs.mkdir(path.dirname(filePath), {recursive: true});
    await fs.writeFile(filePath, content, "utf8");
    return {ok: true, artifactPath: filePath, output: `Wrote ${filePath}`};
}

async function listDirTool(tool: ToolInvocation): Promise<ToolExecutionResult> {
    const dirPath = typeof tool.args.path === "string" ? tool.args.path : process.cwd();
    const entries = await fs.readdir(dirPath, {withFileTypes: true});
    const names = entries.map(entry => entry.name).sort();
    return {ok: true, output: names.join("\n")};
}

async function statPathTool(tool: ToolInvocation): Promise<ToolExecutionResult> {
    const filePath = typeof tool.args.path === "string" ? tool.args.path : "";
    if (!filePath) return {ok: false, error: "No path provided"};
    const stats = await fs.stat(filePath);
    return {ok: true, output: JSON.stringify({exists: true, size: stats.size, isFile: stats.isFile(), isDirectory: stats.isDirectory()}, null, 2)};
}

async function deleteFileTool(tool: ToolInvocation): Promise<ToolExecutionResult> {
    const filePath = typeof tool.args.path === "string" ? tool.args.path : "";
    if (!filePath) return {ok: false, error: "No path provided"};
    await fs.unlink(filePath);
    return {ok: true, output: `Deleted ${filePath}`};
}

async function fetchUrlTool(tool: ToolInvocation): Promise<ToolExecutionResult> {
    const url = typeof tool.args.url === "string" ? tool.args.url : "";
    if (!url) return {ok: false, error: "No URL provided"};
    const response = await fetch(url);
    const text = await response.text();
    return {ok: response.ok, output: text.slice(0, 4000), error: response.ok ? undefined : `HTTP ${response.status}`};
}

async function executeTool(tool: ToolInvocation): Promise<ToolExecutionResult> {
    const policy = evaluateToolPolicy(tool);
    if (!policy.allowed) {
        return {ok: false, error: policy.reason || "Tool execution denied", metadata: {tier: policy.tier}};
    }

    switch (tool.name) {
        case "list_dir":
            return listDirTool(tool);
        case "read_file":
            return readFileTool(tool);
        case "write_file":
            return writeFileTool(tool);
        case "run_command":
            return runCommandTool(tool);
        case "delete_file":
            return deleteFileTool(tool);
        case "stat_path":
            return statPathTool(tool);
        case "fetch_url":
            return fetchUrlTool(tool);
        default:
            return {ok: false, error: `Unsupported tool: ${tool.name}`};
    }
}

function summarizeStep(step: AutonomyStep): string {
    return [step.description, step.output, step.error].filter(Boolean).join("\n");
}

async function evaluateMissionCompletion(task: AutonomyTask): Promise<{completed: boolean; confidence: number; summary: string}> {
    const context = task.steps
        .filter(step => step.status === "done")
        .map(summarizeStep)
        .join("\n\n");
    const prompt = `You are an autonomy evaluator. Determine whether the following objective is complete based on the recorded steps and outputs. Respond with JSON: {"completed": true|false, "confidence": 0.0-1.0, "summary": "..."}\n\nObjective: ${task.objective}\n\nContext:\n${context || "No execution output recorded."}`;

    try {
        const response = await lumiChat({message: prompt});
        const cleaned = response.content.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as {completed?: boolean; confidence?: number; summary?: string};
        if (typeof parsed.completed === "boolean") {
            return {
                completed: parsed.completed,
                confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
                summary: parsed.summary || response.content,
            };
        }
    } catch {
        // fall back to heuristics below
    }

    const completedByHeuristics = task.steps.some(step => step.status === "done") && task.steps.every(step => step.status === "done" || step.status === "blocked");
    return {
        completed: completedByHeuristics,
        confidence: completedByHeuristics ? 0.65 : 0.3,
        summary: completedByHeuristics ? "Execution completed without a blocking error." : "Execution did not reach a clear success state.",
    };
}

async function recordOutcomeMemory(task: AutonomyTask): Promise<void> {
    const qualityScore = task.status === "completed" ? 0.93 : task.status === "blocked" ? 0.68 : 0.55;
    const summary = `Autonomy task ${task.id}: ${task.objective}\nStatus: ${task.status}\nSummary: ${task.summary || "No summary recorded"}`;
    await remember(
        task.id,
        "assistant",
        summary,
        ["autonomy", task.status, "outcome"],
        "knowledge",
        undefined,
        {
            reviewStatus: "approved",
            confidence: task.status === "completed" ? "high" : "medium",
            qualityScore,
            sensitivity: "low",
            provenance: {source: "autonomy-runtime", sourceType: "mission", sourceId: task.id},
        },
    );
}

async function persistTask(task: AutonomyTask): Promise<void> {
    task.updatedAt = new Date().toISOString();
    const taskIndex = autonomyState.tasks.findIndex(entry => entry.id === task.id);
    if (taskIndex >= 0) {
        autonomyState.tasks[taskIndex] = task;
    } else {
        autonomyState.tasks.push(task);
    }
    await persistState();
}

async function processTask(task: AutonomyTask): Promise<void> {
    if (task.status === "completed" || task.status === "blocked" || task.status === "failed") {
        return;
    }

    task.status = "running";
    task.attempts += 1;
    task.updatedAt = new Date().toISOString();
    appendCheckpoint(task, `Started execution for ${task.objective}`, "running");
    await persistTask(task);

    for (const step of task.steps) {
        if (step.status === "done") continue;
        step.status = "running";
        step.startedAt = new Date().toISOString();
        step.attempts += 1;
        step.policy = evaluateToolPolicy(step.tool || {name: "noop", args: {}, tier: "read_only"});
        if (!step.policy.allowed) {
            step.status = "blocked";
            step.error = step.policy.reason || "Tool execution denied";
            task.lastError = step.error;
            task.status = "blocked";
            task.summary = `Blocked on step: ${step.description}`;
            appendCheckpoint(task, `Blocked on tool policy for ${step.description}`, "blocked");
            await persistTask(task);
            return;
        }

        try {
            const result = await executeTool(step.tool || {name: "noop", args: {}, tier: "read_only"});
            step.output = result.output || result.stdout || "";
            if (result.stderr) step.output = `${step.output}\n${result.stderr}`.trim();
            if (result.ok) {
                step.status = "done";
                step.completedAt = new Date().toISOString();
                appendCheckpoint(task, `Completed step: ${step.description}`, "running");
                await persistTask(task);
            } else {
                step.status = "failed";
                step.error = result.error || "Tool execution failed";
                task.lastError = step.error;
                appendCheckpoint(task, `Tool failed for step: ${step.description}`, "running");
                await persistTask(task);
                break;
            }
        } catch (error: any) {
            step.status = "failed";
            step.error = error?.message || String(error);
            task.lastError = step.error;
            appendCheckpoint(task, `Tool error for step: ${step.description}`, "running");
            await persistTask(task);
            break;
        }
    }

    if (task.steps.every(step => step.status === "done")) {
        const evaluation = await evaluateMissionCompletion(task);
        task.status = evaluation.completed ? "completed" : "failed";
        task.summary = evaluation.summary;
        appendCheckpoint(task, `Autonomy evaluation: ${evaluation.summary}`, task.status);
        await persistTask(task);
        await recordOutcomeMemory(task);
        return;
    }

    if (task.status !== "blocked") {
        task.status = "failed";
        task.summary = task.lastError || "Autonomy task stopped with unresolved steps";
        appendCheckpoint(task, task.summary, "failed");
        await persistTask(task);
        await recordOutcomeMemory(task);
    }
}

async function processQueue(): Promise<void> {
    if (loopBusy) return;
    loopBusy = true;
    try {
        await loadState();
        const queuedTasks = autonomyState.tasks.filter(task => task.status === "queued");
        for (const task of queuedTasks) {
            await processTask(task);
        }
    } finally {
        loopBusy = false;
        await persistState();
    }
}

export async function queueAutonomyTask(request: QueuedAutonomyTaskRequest): Promise<AutonomyTask> {
    await loadState();
    const task: AutonomyTask = {
        id: generateId(),
        objective: request.objective,
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: (request.steps && request.steps.length > 0 ? request.steps : buildDefaultSteps(request.objective)).map(step => ({...step})),
        checkpoints: [],
        attempts: 0,
        metadata: request.metadata,
    };
    autonomyState.tasks.push(task);
    await persistState();
    auditLog.log("autonomy-runtime", "create", {resource: task.id, details: {objective: request.objective}, success: true});
    return task;
}

export async function getAutonomyTask(taskId: string): Promise<AutonomyTask | null> {
    await loadState();
    return autonomyState.tasks.find(task => task.id === taskId) || null;
}

export async function listAutonomyTasks(): Promise<AutonomyTask[]> {
    await loadState();
    return [...autonomyState.tasks].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function startAutonomyLoop(): Promise<void> {
    if (loopStarted) return;
    loopStarted = true;
    await loadState();
    loopTimer = setInterval(() => {
        void processQueue().catch(error => console.error("[LumiAutonomy] loop error:", error));
    }, getLoopIntervalMs());
}

export async function stopAutonomyLoop(): Promise<void> {
    if (loopTimer) {
        clearInterval(loopTimer);
        loopTimer = null;
    }
    loopStarted = false;
}

export async function runAutonomyBenchmark(): Promise<AutonomyBenchmarkResult[]> {
    const benchmarkTasks = [
        {
            objective: "Inspect the repository roots and summarize the top-level files.",
            steps: [
                {
                    id: generateId("step"),
                    description: "List the repository root contents",
                    tool: {name: "list_dir", args: {path: process.cwd()}, tier: "read_only"},
                    status: "pending" as const,
                    attempts: 0,
                },
                {
                    id: generateId("step"),
                    description: "Read the package manifest",
                    tool: {name: "read_file", args: {path: path.join(process.cwd(), "package.json")}, tier: "read_only"},
                    status: "pending" as const,
                    attempts: 0,
                },
            ],
        },
    ];

    const results: AutonomyBenchmarkResult[] = [];
    for (const benchmarkTask of benchmarkTasks) {
        const queuedTask = await queueAutonomyTask(benchmarkTask);
        await processTask(queuedTask);
        results.push({
            objective: benchmarkTask.objective,
            taskId: queuedTask.id,
            status: queuedTask.status,
            summary: queuedTask.summary,
        });
    }
    return results;
}

void startAutonomyLoop().catch(error => console.error("[LumiAutonomy] startup error:", error));
