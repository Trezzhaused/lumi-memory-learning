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

function getRobloxConfig(): {apiKey: string; universeId: string; placeId: string} {
    return {
        apiKey: process.env.ROBLOX_API_KEY || "",
        universeId: process.env.ROBLOX_UNIVERSE_ID || "",
        placeId: process.env.ROBLOX_PLACE_ID || "",
    };
}

export type ProjectType =
    | "game"
    | "web-app"
    | "api"
    | "cli-tool"
    | "discord-bot"
    | "animation"
    | "music-track"
    | "image-series"
    | "trezzblox-world";

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

export type CreationFlowMode = "full" | "storyboard" | "assets" | "publish";

export interface TrezzbloxAssetRecommendation {
    id: string;
    name: string;
    kind: "character" | "environment" | "prop" | "npc" | "effect" | "system";
    description: string;
    trezzbloxClass: string;
    tags: string[];
}

export interface CreationStage {
    id: string;
    title: string;
    summary: string;
    content: string;
    status: "complete" | "ready" | "pending";
}

export interface CreationBundle {
    id: string;
    prompt: string;
    title: string;
    createdAt: string;
    mode: CreationFlowMode;
    stages: CreationStage[];
    assets: TrezzbloxAssetRecommendation[];
    scripts: Array<{name: string; language: "luau" | "json" | "typescript"; content: string}>;
    publish: {
        target: "roblox";
        approved: boolean;
        status: "ready" | "simulated" | "skipped" | "failed";
        message: string;
    };
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

    "trezzblox-world": `Create a TrezzBlox-ready world build plan called "{name}".
Description: {description}
Return a structured plan with world concept, character roster, environment assets, gameplay systems, scripts, and export notes.`,
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

function extractKeywords(prompt: string): string[] {
    return prompt.toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .filter(tag => !["build", "create", "a", "an", "the", "with", "and", "for", "into", "that", "this"].includes(tag))
        .slice(0, 10);
}

function titleFromPrompt(prompt: string): string {
    const cleaned = prompt.trim().replace(/\s+/g, " ");
    return cleaned.length > 64 ? `${cleaned.slice(0, 61)}...` : cleaned;
}

async function generateText(prompt: string, fallback: string): Promise<string> {
    try {
        const result = await generate({type: "text", prompt, language: "plain text"});
        return (result.text || fallback).trim() || fallback;
    } catch {
        return fallback;
    }
}

function makeStage(id: string, title: string, summary: string, content: string): CreationStage {
    return {id, title, summary, content, status: "complete"};
}

function buildAssetRegistry(prompt: string): TrezzbloxAssetRecommendation[] {
    const keywords = extractKeywords(prompt);
    const assets: TrezzbloxAssetRecommendation[] = [];

    if (keywords.some(keyword => keyword.includes("character") || keyword.includes("character") || keyword.includes("hero") || keyword.includes("npc"))) {
        assets.push({
            id: "asset-character",
            name: "Hero Character Rig",
            kind: "character",
            description: "A stylized humanoid rig with expressive animation hooks and a combat-ready idle cycle.",
            trezzbloxClass: "CharacterRig",
            tags: ["stylized", "humanoid", "animated"],
        });
    }

    if (keywords.some(keyword => keyword.includes("world") || keyword.includes("environment") || keyword.includes("landscape") || keyword.includes("map"))) {
        assets.push({
            id: "asset-environment",
            name: "Procedural World Tiles",
            kind: "environment",
            description: "A set of modular terrain tiles and atmospheric props for open-world traversal.",
            trezzbloxClass: "EnvironmentTile",
            tags: ["terrain", "modular", "world"],
        });
    }

    if (keywords.some(keyword => keyword.includes("quest") || keyword.includes("gameplay") || keyword.includes("combat") || keyword.includes("system"))) {
        assets.push({
            id: "asset-system",
            name: "Quest and Combat Systems",
            kind: "system",
            description: "A reusable quest state machine and combat flow system for live encounters.",
            trezzbloxClass: "GameSystem",
            tags: ["quest", "combat", "systems"],
        });
    }

    if (keywords.some(keyword => keyword.includes("pokemon") || keyword.includes("creature") || keyword.includes("pet"))) {
        assets.push({
            id: "asset-companion",
            name: "Companion Creature",
            kind: "npc",
            description: "A companion creature with creature-like movement, reactions, and battle flair.",
            trezzbloxClass: "CompanionNpc",
            tags: ["creature", "companion", "animated"],
        });
    }

    if (assets.length === 0) {
        assets.push({
            id: "asset-prop",
            name: "Starter Prop Kit",
            kind: "prop",
            description: "A fallback asset pack for world decoration and interaction hooks.",
            trezzbloxClass: "PropPack",
            tags: ["starter", "modular"],
        });
    }

    return assets;
}

function buildScripts(prompt: string, assets: TrezzbloxAssetRecommendation[]): CreationBundle["scripts"] {
    const title = titleFromPrompt(prompt);
    return [
        {
            name: "WorldManifest.json",
            language: "json",
            content: JSON.stringify({
                title,
                assets: assets.map(asset => ({name: asset.name, class: asset.trezzbloxClass, tags: asset.tags})),
                workflow: ["concept", "storyboard", "design", "assets", "publish"],
            }, null, 2),
        },
        {
            name: "WorldController.luau",
            language: "luau",
            content: `-- Generated Luau scaffold for ${title}\nlocal world = {}\nworld.title = "${title}"\nworld.assets = {${assets.map(asset => `"${asset.trezzbloxClass}"`).join(", ")}}\nreturn world\n`,
        },
    ];
}

async function buildTrezzbloxWorldFlow(spec: ProjectSpec, mode: CreationFlowMode = "full"): Promise<CreationBundle> {
    const prompt = `${spec.name}: ${spec.description}`;
    const title = titleFromPrompt(prompt);
    const concept = await generateText(
        `Create a concise concept for a TrezzBlox-ready game world based on: ${prompt}`,
        `A stylized fantasy sandbox where players explore a living world with expressive NPCs, modular terrain, and combat-ready systems.`
    );
    const storyboard = await generateText(
        `Create a three-scene storyboard for this world: ${prompt}`,
        `Scene 1: Arrival in a glowing frontier city. Scene 2: Exploration of a ruined biome. Scene 3: Final raid against a creature guardian.`
    );
    const designSpec = await generateText(
        `Create a compact design specification for a TrezzBlox project based on: ${prompt}`,
        `The experience should balance exploration, customizable companions, and a modular world-building loop.`
    );
    const assets = buildAssetRegistry(prompt);
    const scripts = buildScripts(prompt, assets);

    const stages: CreationStage[] = [
        makeStage("prompt", "Prompt captured", "The game brief is ready for the studio flow.", prompt),
        makeStage("concept", "World concept", concept, concept),
        makeStage("storyboard", "Storyboard draft", storyboard, storyboard),
        makeStage("design", "Design spec", designSpec, designSpec),
        makeStage("assets", "Asset manifest", `Generated ${assets.length} TrezzBlox-ready assets.`, assets.map(asset => `${asset.name} (${asset.trezzbloxClass})`).join("\n")),
        makeStage("scripts", "Scripts & bundles", `Generated ${scripts.length} delivery files.`, scripts.map(script => `${script.name} (${script.language})`).join("\n")),
    ];

    const publish = {
        target: "roblox" as const,
        approved: false,
        status: process.env.LUMI_CREATION_TEST_MODE === "true" ? "simulated" as const : "ready" as const,
        message: process.env.LUMI_CREATION_TEST_MODE === "true"
            ? "Publish is being simulated for test/dev mode."
            : "Publish is ready once approval is granted.",
    };

    const fullBundle: CreationBundle = {
        id: generateProjectId(),
        prompt,
        title,
        createdAt: new Date().toISOString(),
        mode,
        stages: mode === "storyboard"
            ? stages.slice(0, 3)
            : mode === "assets"
                ? stages.slice(0, 5)
                : stages,
        assets,
        scripts,
        publish,
    };

    if (mode === "publish") {
        fullBundle.publish.status = process.env.LUMI_CREATION_TEST_MODE === "true" ? "simulated" : "ready";
    }

    return fullBundle;
}

export async function buildTrezzbloxWorldBundle(spec: ProjectSpec, mode: CreationFlowMode = "full"): Promise<CreationBundle> {
    return buildTrezzbloxWorldFlow(spec, mode);
}

export async function publishCreationBundle(bundle: CreationBundle, sessionId: string): Promise<CreationBundle["publish"]> {
    if (process.env.LUMI_CREATION_TEST_MODE === "true") {
        return {
            target: "roblox",
            approved: true,
            status: "simulated",
            message: `Simulated Roblox publish for ${bundle.title}.`,
        };
    }

    if (process.env.LUMI_CREATION_APPROVAL_REQUIRED === "true" && !bundle.publish.approved) {
        return {
            target: "roblox",
            approved: false,
            status: "skipped",
            message: "Publishing requires explicit approval.",
        };
    }

    try {
        const script = bundle.scripts.find(entry => entry.language === "luau");
        if (!script) {
            throw new Error("No Luau script available to publish.");
        }
        const result = await publishToRoblox(script.content, sessionId);
        return {
            target: "roblox",
            approved: true,
            status: "ready",
            message: `Roblox publish succeeded (version ${result.versionNumber || "unknown"}).`,
        };
    } catch (error: any) {
        return {
            target: "roblox",
            approved: false,
            status: "failed",
            message: error?.message || "Roblox publish failed.",
        };
    }
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

        if (spec.type === "trezzblox-world") {
            const bundle = await buildTrezzbloxWorldBundle(spec, "full");
            project.artifacts.push({name: "world-concept", role: "manifest", result: {text: JSON.stringify(bundle.stages.slice(0, 4), null, 2)}});
            project.artifacts.push({name: "asset-manifest", role: "manifest", result: {text: JSON.stringify(bundle.assets, null, 2)}});
            project.artifacts.push({name: "scripts", role: "code", result: {text: bundle.scripts.map(script => `// ${script.name}\n${script.content}`).join("\n\n")}});

        } else if (["game", "web-app", "api", "cli-tool", "discord-bot"].includes(spec.type)) {
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
    const {apiKey, universeId, placeId} = getRobloxConfig();
    if (!apiKey || !universeId || !placeId) {
        throw new Error(
            "Roblox publishing requires ROBLOX_API_KEY, ROBLOX_UNIVERSE_ID, " +
            "and ROBLOX_PLACE_ID to be set."
        );
    }

    const res = await fetch(
        `${ROBLOX_OPEN_CLOUD}/${universeId}/places/${placeId}/versions`,
        {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
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
        universeId,
        placeId,
        versionNumber: json.versionNumber,
        publishedAt: new Date().toISOString(),
    };

    await remember(
        sessionId,
        "assistant",
        `Published Roblox place ${placeId} (version ${result.versionNumber}).`,
        ["roblox", "publish"],
        "artifact"
    );

    return result;
}
