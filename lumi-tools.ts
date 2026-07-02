import {promises as fs} from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";

export interface LocalExecutionResult {
    ok: boolean;
    blocked: boolean;
    message: string;
    stdout?: string;
    stderr?: string;
    filePath?: string;
    command?: string;
    requiresApproval?: boolean;
}

export type ToolExecutionSource = "local" | "cloud" | "browser";

export interface RuntimeActionRequest {
    action: string;
    parameters?: Record<string, unknown>;
    source?: ToolExecutionSource;
    sessionId?: string;
}

export interface RuntimeActionPolicy {
    allowed: boolean;
    blocked: boolean;
    requiresApproval: boolean;
    reason?: string;
}

export interface RemoteOwnerRuntimeStatus {
    enabled: boolean;
    endpointConfigured: boolean;
    tokenConfigured: boolean;
}

const DEFAULT_WORKSPACE_ROOT = process.cwd();
const TOOL_EXECUTION_ENABLED = process.env.LUMI_ALLOW_LOCAL_TOOL_EXECUTION === "true";
const TOOL_EXECUTION_ROOT = process.env.LUMI_WORKSPACE_DIR || DEFAULT_WORKSPACE_ROOT;
const ALLOWED_COMMANDS = new Set((process.env.LUMI_ALLOWED_TOOL_COMMANDS || "node,npm,pnpm,python,python3").split(",").map(value => value.trim()).filter(Boolean));
const EXECUTABLES = new Map<string, string>([
    ["node", process.execPath],
    ["npm", "npm"],
    ["pnpm", "pnpm"],
    ["python", "python"],
    ["python3", "python3"],
]);
const CLOUD_TOOL_REQUESTS_ENABLED = process.env.LUMI_ALLOW_CLOUD_TOOL_REQUESTS === "true";
const REMOTE_OWNER_RUNTIME_URL = process.env.LUMI_REMOTE_OWNER_RUNTIME_URL || "";
const REMOTE_OWNER_RUNTIME_TOKEN = process.env.LUMI_REMOTE_OWNER_RUNTIME_TOKEN || "";
const ALLOWED_ACTIONS = new Set(["write-file", "run-command", "run-example-script", "remote-owner-runtime"]);

function resolveWorkspacePath(relativePath: string): string {
    if (!relativePath || relativePath.includes("\0")) {
        throw new Error(`Invalid workspace path: ${relativePath}`);
    }

    const normalizedPath = relativePath.replace(/\\/g, "/").trim();
    if (!normalizedPath || normalizedPath.startsWith("/") || normalizedPath.startsWith("./") || normalizedPath === ".") {
        throw new Error(`Invalid workspace path: ${relativePath}`);
    }

    const segments = normalizedPath.split("/").filter(Boolean);
    if (segments.some(segment => segment === "." || segment === "..")) {
        throw new Error(`Refusing to write outside workspace root: ${relativePath}`);
    }

    const safeSegments = segments.map(segment => path.basename(segment));
    const workspaceRoot = path.resolve(TOOL_EXECUTION_ROOT);
    const candidatePath = path.resolve(workspaceRoot, ...safeSegments);
    const relative = path.relative(workspaceRoot, candidatePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Refusing to write outside workspace root: ${relativePath}`);
    }
    return candidatePath;
}

function normalizeCommand(command: string): string {
    const normalized = command.trim();
    if (!normalized) throw new Error("Command is empty");
    return normalized;
}

export function isLocalToolExecutionEnabled(): boolean {
    return TOOL_EXECUTION_ENABLED;
}

export function getRemoteOwnerRuntimeStatus(): RemoteOwnerRuntimeStatus {
    return {
        enabled: Boolean(REMOTE_OWNER_RUNTIME_URL),
        endpointConfigured: Boolean(REMOTE_OWNER_RUNTIME_URL),
        tokenConfigured: Boolean(REMOTE_OWNER_RUNTIME_TOKEN),
    };
}

export function getExecutionPolicySnapshot(): {localToolExecutionEnabled: boolean; cloudToolRequestsEnabled: boolean; allowedCommands: string[]; remoteOwnerRuntime: RemoteOwnerRuntimeStatus} {
    return {
        localToolExecutionEnabled: TOOL_EXECUTION_ENABLED,
        cloudToolRequestsEnabled: CLOUD_TOOL_REQUESTS_ENABLED,
        allowedCommands: [...ALLOWED_COMMANDS],
        remoteOwnerRuntime: getRemoteOwnerRuntimeStatus(),
    };
}

export function evaluateToolExecutionPolicy(action: string, source: ToolExecutionSource = "local"): RuntimeActionPolicy {
    const normalizedAction = action.trim();
    if (!normalizedAction) {
        return {allowed: false, blocked: true, requiresApproval: true, reason: "Action is required."};
    }

    if (!ALLOWED_ACTIONS.has(normalizedAction)) {
        return {allowed: false, blocked: true, requiresApproval: true, reason: `Action ${normalizedAction} is not allow-listed.`};
    }

    if (!TOOL_EXECUTION_ENABLED) {
        return {allowed: false, blocked: true, requiresApproval: true, reason: "Local tool execution is disabled. Set LUMI_ALLOW_LOCAL_TOOL_EXECUTION=true to enable it."};
    }

    if (source !== "local" && !CLOUD_TOOL_REQUESTS_ENABLED) {
        return {allowed: false, blocked: true, requiresApproval: true, reason: "Cloud/browser tool requests are disabled. Set LUMI_ALLOW_CLOUD_TOOL_REQUESTS=true to enable them."};
    }

    return {
        allowed: true,
        blocked: false,
        requiresApproval: source !== "local",
    };
}

export async function writeWorkspaceFile(relativePath: string, content: string): Promise<LocalExecutionResult> {
    if (!TOOL_EXECUTION_ENABLED) {
        return {
            ok: false,
            blocked: true,
            message: "Local tool execution is disabled. Set LUMI_ALLOW_LOCAL_TOOL_EXECUTION=true to enable it.",
        };
    }

    try {
        const absolutePath = resolveWorkspacePath(relativePath);
        await fs.mkdir(path.dirname(absolutePath), {recursive: true});
        await fs.writeFile(absolutePath, content, "utf8");
        return {
            ok: true,
            blocked: false,
            message: `Wrote workspace file ${relativePath}`,
            filePath: absolutePath,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown file write error";
        return {
            ok: false,
            blocked: false,
            message,
        };
    }
}

export async function runWorkspaceCommand(command: string, args: string[] = [], options: {cwd?: string} = {}): Promise<LocalExecutionResult> {
    if (!TOOL_EXECUTION_ENABLED) {
        return {
            ok: false,
            blocked: true,
            message: "Local tool execution is disabled. Set LUMI_ALLOW_LOCAL_TOOL_EXECUTION=true to enable it.",
        };
    }

    const executable = normalizeCommand(command);
    const executableName = path.basename(executable);
    if (!ALLOWED_COMMANDS.has(executableName)) {
        return {
            ok: false,
            blocked: false,
            message: `Command ${executable} is not in the allow-list for local tool execution.`,
        };
    }

    const resolvedExecutable = EXECUTABLES.get(executableName);
    if (!resolvedExecutable) {
        return {
            ok: false,
            blocked: false,
            message: `Command ${executable} is not supported for local tool execution.`,
        };
    }

    return new Promise((resolve) => {
        const child = spawn(resolvedExecutable, args, {
            cwd: options.cwd || TOOL_EXECUTION_ROOT,
            stdio: ["ignore", "pipe", "pipe"],
            shell: false,
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", chunk => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", chunk => {
            stderr += chunk.toString();
        });

        child.on("error", (error) => {
            resolve({
                ok: false,
                blocked: false,
                message: error.message,
                stdout,
                stderr,
                command: `${executable} ${args.join(" ")}`,
            });
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve({
                    ok: true,
                    blocked: false,
                    message: `Command completed successfully (${executable})`,
                    stdout,
                    stderr,
                    command: `${executable} ${args.join(" ")}`,
                });
            } else {
                resolve({
                    ok: false,
                    blocked: false,
                    message: `Command exited with code ${code}`,
                    stdout,
                    stderr,
                    command: `${executable} ${args.join(" ")}`,
                });
            }
        });
    });
}

export async function runExampleScript(scriptName: string, options: {cwd?: string; args?: string[]} = {}): Promise<LocalExecutionResult> {
    if (!TOOL_EXECUTION_ENABLED) {
        return {
            ok: false,
            blocked: true,
            message: "Local tool execution is disabled. Set LUMI_ALLOW_LOCAL_TOOL_EXECUTION=true to enable it.",
        };
    }

    const normalizedScriptName = path.basename(scriptName || "");
    if (!normalizedScriptName || !normalizedScriptName.endsWith(".py")) {
        return {ok: false, blocked: true, message: "scriptName must be a .py file."};
    }

    const examplesRoot = path.resolve(TOOL_EXECUTION_ROOT, ".data", "examples");
    const candidateScriptPath = path.resolve(examplesRoot, normalizedScriptName);
    const relativeToExamples = path.relative(examplesRoot, candidateScriptPath);
    if (relativeToExamples.startsWith("..") || path.isAbsolute(relativeToExamples)) {
        return {ok: false, blocked: true, message: "scriptName resolves outside of the example bundle."};
    }

    try {
        await fs.access(candidateScriptPath);
    } catch {
        return {ok: false, blocked: true, message: `Example script ${normalizedScriptName} does not exist.`};
    }

    return runWorkspaceCommand("python", [candidateScriptPath, ...(options.args || [])], {cwd: options.cwd || TOOL_EXECUTION_ROOT});
}

export async function dispatchToRemoteOwnerRuntime(request: RuntimeActionRequest): Promise<LocalExecutionResult> {
    if (!REMOTE_OWNER_RUNTIME_URL) {
        return {
            ok: false,
            blocked: true,
            message: "Remote owner runtime is not configured. Set LUMI_REMOTE_OWNER_RUNTIME_URL to enable it.",
            requiresApproval: true,
        };
    }

    const headers: Record<string, string> = {
        "content-type": "application/json",
    };
    if (REMOTE_OWNER_RUNTIME_TOKEN) {
        headers.authorization = "Bearer " + REMOTE_OWNER_RUNTIME_TOKEN;
    }

    try {
        const response = await fetch(REMOTE_OWNER_RUNTIME_URL, {
            method: "POST",
            headers,
            body: JSON.stringify({
                action: request.action,
                parameters: request.parameters || {},
                source: request.source || "cloud",
                sessionId: request.sessionId,
            }),
        });
        const responseText = await response.text();
        let parsedResponse: unknown = responseText;
        if (responseText) {
            try {
                parsedResponse = JSON.parse(responseText);
            } catch {
                // Keep the raw response text when the connector does not return JSON.
            }
        }

        if (!response.ok) {
            const detail = typeof parsedResponse === "object" && parsedResponse !== null && "error" in parsedResponse
                ? String((parsedResponse as {error?: unknown}).error)
                : undefined;
            return {
                ok: false,
                blocked: false,
                message: detail || `Remote owner runtime returned HTTP ${response.status}`,
                requiresApproval: false,
            };
        }

        const message = typeof parsedResponse === "object" && parsedResponse !== null && "message" in parsedResponse
            ? String((parsedResponse as {message?: unknown}).message)
            : "Remote owner runtime accepted the request.";
        return {
            ok: true,
            blocked: false,
            message,
            requiresApproval: false,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown remote owner runtime failure";
        return {
            ok: false,
            blocked: false,
            message,
            requiresApproval: false,
        };
    }
}

export async function executeApprovedAction(request: RuntimeActionRequest): Promise<LocalExecutionResult> {
    const policy = evaluateToolExecutionPolicy(request.action, request.source || "local");
    if (!policy.allowed) {
        return {
            ok: false,
            blocked: true,
            message: policy.reason || "Action denied by policy.",
            requiresApproval: policy.requiresApproval,
        };
    }

    if (request.action === "remote-owner-runtime") {
        return dispatchToRemoteOwnerRuntime(request);
    }

    if (request.action === "write-file") {
        const relativePath = typeof request.parameters?.relativePath === "string"
            ? request.parameters.relativePath
            : "";
        const content = typeof request.parameters?.content === "string"
            ? request.parameters.content
            : "";
        if (!relativePath) {
            return {ok: false, blocked: true, message: "relativePath is required for write-file actions."};
        }
        return writeWorkspaceFile(relativePath, content);
    }

    if (request.action === "run-command") {
        const command = typeof request.parameters?.command === "string"
            ? request.parameters.command
            : "";
        const args = Array.isArray(request.parameters?.args) && request.parameters.args.every(item => typeof item === "string")
            ? request.parameters.args
            : [];
        if (!command) {
            return {ok: false, blocked: true, message: "command is required for run-command actions."};
        }
        return runWorkspaceCommand(command, args, {cwd: typeof request.parameters?.cwd === "string" ? request.parameters.cwd : undefined});
    }

    if (request.action === "run-example-script") {
        const scriptName = typeof request.parameters?.scriptName === "string"
            ? request.parameters.scriptName
            : "";
        const args = Array.isArray(request.parameters?.args) && request.parameters.args.every(item => typeof item === "string")
            ? request.parameters.args
            : [];
        if (!scriptName) {
            return {ok: false, blocked: true, message: "scriptName is required for run-example-script actions."};
        }
        return runExampleScript(scriptName, {cwd: typeof request.parameters?.cwd === "string" ? request.parameters.cwd : undefined, args});
    }

    return {ok: false, blocked: true, message: `Unsupported action: ${request.action}`};
}
