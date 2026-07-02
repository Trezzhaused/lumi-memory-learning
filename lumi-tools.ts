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
}

const DEFAULT_WORKSPACE_ROOT = process.cwd();
const TOOL_EXECUTION_ENABLED = process.env.LUMI_ALLOW_LOCAL_TOOL_EXECUTION === "true";
const TOOL_EXECUTION_ROOT = process.env.LUMI_WORKSPACE_DIR || DEFAULT_WORKSPACE_ROOT;
const ALLOWED_COMMANDS = new Set(["node", "npm", "pnpm", "python", "python3"]);

function resolveWorkspacePath(relativePath: string): string {
    const workspaceRoot = path.resolve(TOOL_EXECUTION_ROOT);
    const candidatePath = path.resolve(workspaceRoot, relativePath);
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

    return new Promise((resolve) => {
        const child = spawn(executable, args, {
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
