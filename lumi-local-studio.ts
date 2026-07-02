import {execFile} from "node:child_process";
import {existsSync, mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);

export interface LocalStudioScene {
    startBeat: number;
    endBeat: number;
    character: string;
    faceVideo: string;
    rvcModel?: string;
}

export interface LocalStudioSceneManifest {
    title?: string;
    scenes: LocalStudioScene[];
}

export interface RunLocalStudioRequest {
    title?: string;
    sceneManifest?: LocalStudioSceneManifest;
    audioPath?: string;
    outputDir?: string;
    useLocalModels?: boolean;
}

export interface LocalStudioResult {
    ok: boolean;
    status: "planned";
    outputDirectory: string;
    composeFile: string;
    planPath: string;
    sceneManifestPath: string;
    scriptPath: string;
    services: string[];
    steps: string[];
    notes: string[];
    localOnly: boolean;
    toolAvailability: Record<string, boolean>;
}

function ensureDirectory(targetDir: string): void {
    mkdirSync(targetDir, {recursive: true});
}

function writeJson(targetPath: string, payload: unknown): void {
    writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

function resolveWorkspacePath(inputPath: string, workspaceRoot: string): string {
    const resolvedRoot = path.resolve(workspaceRoot);
    const resolvedPath = path.resolve(resolvedRoot, inputPath);
    const relativePath = path.relative(resolvedRoot, resolvedPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(`Path must stay inside the workspace: ${inputPath}`);
    }

    return resolvedPath;
}

async function detectTool(tool: string): Promise<boolean> {
    try {
        await execFileAsync("which", [tool]);
        return true;
    } catch {
        return false;
    }
}

export async function runLocalStudioPipeline(req: RunLocalStudioRequest): Promise<LocalStudioResult> {
    const workspaceRoot = process.cwd();
    const outputDir = resolveWorkspacePath(req.outputDir || "output/local-studio", workspaceRoot);
    const composeFile = resolveWorkspacePath("docker/docker-compose.local-studio.yml", workspaceRoot);

    if (!existsSync(composeFile)) {
        throw new Error(`Local studio compose file not found: ${composeFile}`);
    }

    const manifest = req.sceneManifest || {title: req.title || "local-studio", scenes: []};
    if (!manifest.scenes || manifest.scenes.length === 0) {
        throw new Error("sceneManifest.scenes is required");
    }

    ensureDirectory(outputDir);

    const sceneManifestPath = path.join(outputDir, "scenes.json");
    const planPath = path.join(outputDir, "pipeline-plan.json");
    const scriptPath = path.join(outputDir, "run-local-studio.sh");

    const resolvedAudioPath = req.audioPath ? resolveWorkspacePath(req.audioPath, workspaceRoot) : "";
    const toolAvailability = {
        docker: await detectTool("docker"),
        ffmpeg: await detectTool("ffmpeg"),
        python3: await detectTool("python3"),
        python: await detectTool("python"),
    };

    const steps = [
        "Start the local studio stack with docker compose",
        "Validate scene manifests and local asset paths",
        "Run Whisper subtitles for the vocal track",
        "Run RVC voice conversion and lip-sync generation",
        "Assemble the final rendered MV",
    ];

    const notes = [
        "This pipeline is designed for fully local execution once Docker, ffmpeg, and the required model weights are available.",
        "The runtime will only create planning artifacts here if the required executables are missing.",
    ];

    if (resolvedAudioPath && !existsSync(resolvedAudioPath)) {
        notes.push(`Audio file not found at ${resolvedAudioPath}; the plan still documents the expected workflow.`);
    }

    if (!toolAvailability.docker) {
        notes.push("Docker CLI was not detected, so the compose stack is only prepared for manual startup.");
    }

    if (!toolAvailability.ffmpeg) {
        notes.push("ffmpeg was not detected, so the final assembly step must be run on a machine with ffmpeg installed.");
    }

    writeJson(sceneManifestPath, {
        title: req.title || manifest.title || "local-studio",
        scenes: manifest.scenes,
        audioPath: resolvedAudioPath || req.audioPath || null,
    });

    writeJson(planPath, {
        title: req.title || manifest.title || "local-studio",
        outputDirectory: outputDir,
        composeFile,
        services: ["redis", "comfyui", "rvc_server", "whisper", "webui"],
        steps,
        notes,
        localOnly: req.useLocalModels !== false,
        toolAvailability,
    });

    const shellScript = `#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT=${shellQuote(workspaceRoot)}
COMPOSE_FILE=${shellQuote(composeFile)}
OUTPUT_DIR=${shellQuote(outputDir)}

docker compose -f "$COMPOSE_FILE" up -d --build

echo "Local studio stack started"
echo "Scene manifest: $OUTPUT_DIR/scenes.json"
echo "Pipeline plan: $OUTPUT_DIR/pipeline-plan.json"
`;

    writeFileSync(scriptPath, shellScript, "utf8");
    try {
        await execFileAsync("chmod", ["+x", scriptPath]);
    } catch {
        // Ignore chmod failures on systems that do not support it.
    }

    return {
        ok: true,
        status: "planned",
        outputDirectory: outputDir,
        composeFile,
        planPath,
        sceneManifestPath,
        scriptPath,
        services: ["redis", "comfyui", "rvc_server", "whisper", "webui"],
        steps,
        notes,
        localOnly: req.useLocalModels !== false,
        toolAvailability,
    };
}
