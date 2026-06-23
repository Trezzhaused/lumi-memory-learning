/**
 * Lumi Studio
 *
 * Orchestrates complex creative and development workflows for the
 * TrezzWorld platform (mirrors trezzworld-production-studio architecture):
 *   - Program & game scaffolding
 *   - Roblox game production & publishing
 *   - Multi-step creative projects (storyboard → frames → video)
 *   - Asset management across free cloud backends
 *   - Project templates for common Trezzhaus use-cases
 *
 * Roblox integration mirrors .env.example in trezzworld-production-studio:
 *   ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, ROBLOX_PLACE_ID
 */

import {generate, GenerationRequest, GenerationResult} from "./lumi-generators";
import {remember, recall, MemoryEntry} from "./lumi-memory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectType =
    | "game"
    | "web-app"
    | "api"
    | "cli-tool"
    | "discord-bot"
    | "animation"
    | "music-track"
    | "image-series";

export interface ProjectSpec {
    name: string;
    type: ProjectType;
    description: string;
    language?: string;
    framework?: string;
    /** Session ID for memory binding */
    sessionId: string;
}

export interface ProjectArtifact {
    name: string;
    role: "scaffold" | "code" | "image" | "audio" | "video" | "manifest";
    result: GenerationResult | {text: string};
}

export interface Project {
    id: string;
    spec: ProjectSpec;
    artifacts: ProjectArtifact[];
    createdAt: string;
    status: "building" | "complete" | "failed";
    error?: string;
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

const CODE_TEMPLATES: Record<ProjectType, string> = {
    "game": `Create a complete, playable {framework} game called "{name}".
Description: {description}
Include: game loop, player input, collision detection, score system, simple graphics, win/loss conditions.
Language: {language}. Output all necessary files as clearly commented code.`,

    "web-app": `Scaffold a production-ready {framework} web application called "{name}".
Description: {description}
Include: routing, state management, responsive layout, API client, error handling.
Language: {language}.`,

    "api": `Create a complete REST API called "{name}" using {framework}.
Description: {description}
Include: all routes, request validation, error handling, OpenAPI spec comments.
Language: {language}.`,

    "cli-tool": `Build a CLI tool named "{name}" with {framework}.
Description: {description}
Include: argument parsing, help text, progress indicators, error messages.
Language: {language}.`,

    "discord-bot": `Create a Discord bot called "{name}" using {framework}.
Description: {description}
Include: slash commands, event handlers, permission checks, error logging.
Language: {language}.`,

    "animation": `Generate a storyboard description for an animation called "{name}".
Description: {description}
Return a JSON array of scene objects: [{scene, duration, visualDescription, cameraAction}].`,

    "music-track": `Describe a {description} music track called "{name}" as a prompt for AI music generation.
Return a single descriptive sentence that captures the style, mood, instruments, and tempo.`,

    "image-series": `Create 4 detailed image generation prompts for an image series called "{name}".
Description: {description}
Return a JSON array of 4 strings, each a self-contained prompt for a diffusion model.`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fillTemplate(template: string, spec: ProjectSpec): string {
    return template
        .replace(/{name}/g, spec.name)
        .replace(/{description}/g, spec.description)
        .replace(/{language}/g, spec.language || "TypeScript")
        .replace(/{framework}/g, spec.framework || "vanilla");
}

function generateProjectId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Core project builder
// ---------------------------------------------------------------------------

export async function buildProject(spec: ProjectSpec): Promise<Project> {
    const project: Project = {
        id: generateProjectId(),
        spec,
        artifacts: [],
        createdAt: new Date().toISOString(),
        status: "building",
    };

    try {
        const template = CODE_TEMPLATES[spec.type] || CODE_TEMPLATES["web-app"];
        const prompt = fillTemplate(template, spec);

        if (["game", "web-app", "api", "cli-tool", "discord-bot"].includes(spec.type)) {
            // Code-based project
            const codeReq: GenerationRequest = {
                type: "code",
                prompt,
                language: spec.language || "TypeScript",
            };
            const codeResult = await generate(codeReq);
            project.artifacts.push({name: "scaffold", role: "scaffold", result: codeResult});

        } else if (spec.type === "animation") {
            // Generate storyboard, then key-frame images
            const storyReq: GenerationRequest = {
                type: "code", // using code gen to get structured JSON
                prompt,
                language: "JSON",
            };
            const storyResult = await generate(storyReq);
            project.artifacts.push({name: "storyboard", role: "code", result: storyResult});

            // Parse scenes and generate a cover image for the first scene
            try {
                const scenes: any[] = JSON.parse(
                    (storyResult.text || "[]").replace(/```json?/g, "").replace(/```/g, "").trim()
                );
                if (scenes.length > 0) {
                    const imgReq: GenerationRequest = {
                        type: "image",
                        prompt: scenes[0].visualDescription || spec.description,
                    };
                    const imgResult = await generate(imgReq);
                    project.artifacts.push({name: "cover-frame", role: "image", result: imgResult});
                }
            } catch {
                // storyboard parse failed – skip frame generation
            }

        } else if (spec.type === "music-track") {
            const descReq: GenerationRequest = {
                type: "code",
                prompt,
                language: "plain text",
            };
            const descResult = await generate(descReq);
            project.artifacts.push({name: "description", role: "code", result: descResult});

            // Generate actual audio from the described prompt
            const audioReq: GenerationRequest = {
                type: "audio",
                prompt: descResult.text || spec.description,
            };
            const audioResult = await generate(audioReq);
            project.artifacts.push({name: "track", role: "audio", result: audioResult});

        } else if (spec.type === "image-series") {
            const promptsReq: GenerationRequest = {
                type: "code",
                prompt,
                language: "JSON",
            };
            const promptsResult = await generate(promptsReq);
            project.artifacts.push({name: "prompts", role: "code", result: promptsResult});

            // Generate first image of the series
            try {
                const prompts: string[] = JSON.parse(
                    (promptsResult.text || "[]").replace(/```json?/g, "").replace(/```/g, "").trim()
                );
                if (prompts.length > 0) {
                    const imgReq: GenerationRequest = {type: "image", prompt: prompts[0]};
                    const imgResult = await generate(imgReq);
                    project.artifacts.push({name: "image-1", role: "image", result: imgResult});
                }
            } catch {
                // prompts parse failed
            }
        }

        project.status = "complete";

        // Persist project summary to Lumi's memory
        await remember(
            spec.sessionId,
            "assistant",
            `Project "${spec.name}" (${spec.type}) built successfully. ` +
            `Artifacts: ${project.artifacts.map(a => a.name).join(", ")}.`,
            ["project", spec.type, spec.name],
        );

    } catch (err: any) {
        project.status = "failed";
        project.error = err.message;
    }

    return project;
}

// ---------------------------------------------------------------------------
// Creative pipeline: text → image series
// ---------------------------------------------------------------------------

export async function imageSeriesPipeline(
    sessionId: string,
    concept: string,
    count = 4
): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];

    for (let i = 0; i < count; i++) {
        const req: GenerationRequest = {
            type: "image",
            prompt: `${concept}, variation ${i + 1} of ${count}, high quality, detailed`,
            seed: i * 1000,
        };
        const result = await generate(req);
        results.push(result);

        await remember(
            sessionId,
            "assistant",
            `Generated image ${i + 1}/${count} for concept: "${concept}"`,
            ["image-series", "generation"],
        );
    }

    return results;
}

// ---------------------------------------------------------------------------
// Recall project history
// ---------------------------------------------------------------------------

export async function listProjects(sessionId: string): Promise<MemoryEntry[]> {
    return recall(sessionId, 50, ["project"]);
}

// ---------------------------------------------------------------------------
// Roblox publishing (mirrors trezzworld-production-studio Roblox integration)
// ---------------------------------------------------------------------------

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || "";
const ROBLOX_UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID || "";
const ROBLOX_PLACE_ID = process.env.ROBLOX_PLACE_ID || "";
const ROBLOX_OPEN_CLOUD = "https://apis.roblox.com/universes/v1";

export interface RobloxPublishResult {
    universeId: string;
    placeId: string;
    versionNumber?: number;
    publishedAt: string;
}

/**
 * Publish a Luau script / place file to Roblox via Open Cloud API.
 * Requires ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, ROBLOX_PLACE_ID env vars.
 */
export async function publishToRoblox(
    luauContent: string,
    sessionId: string
): Promise<RobloxPublishResult> {
    if (!ROBLOX_API_KEY || !ROBLOX_UNIVERSE_ID || !ROBLOX_PLACE_ID) {
        throw new Error(
            "Roblox publishing requires ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, " +
            "and ROBLOX_PLACE_ID to be set."
        );
    }

    const res = await fetch(
        `${ROBLOX_OPEN_CLOUD}/${ROBLOX_UNIVERSE_ID}/places/${ROBLOX_PLACE_ID}/versions`,
        {
            method: "POST",
            headers: {
                "x-api-key": ROBLOX_API_KEY,
                "Content-Type": "application/octet-stream",
            },
            body: luauContent,
        }
    );

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Roblox publish failed (${res.status}): ${msg}`);
    }

    const json: any = await res.json();
    const result: RobloxPublishResult = {
        universeId: ROBLOX_UNIVERSE_ID,
        placeId: ROBLOX_PLACE_ID,
        versionNumber: json.versionNumber,
        publishedAt: new Date().toISOString(),
    };

    await remember(
        sessionId,
        "assistant",
        `Published Roblox place ${ROBLOX_PLACE_ID} (version ${result.versionNumber}).`,
        ["roblox", "publish"],
        "artifact"
    );

    return result;
}
