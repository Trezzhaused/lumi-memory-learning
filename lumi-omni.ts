import {generate, type GenerationRequest, type GenerationResult} from "./lumi-generators";

export type OmniModality = "text" | "image" | "audio" | "video" | "document" | "code";

export interface OmniSharedState {
    style: string;
    mood: string;
    durationSeconds: number;
    bpm: number;
    fps: number;
    palette: string;
    sceneSummary: string;
    previousOutputs: Array<{modality: string; summary: string}>;
}

export interface OmniPlanStep {
    id: string;
    title: string;
    modality: OmniModality;
    prompt: string;
    outputHint: string;
}

export interface OmniMediaPlan {
    prompt: string;
    summary: string;
    sharedState: OmniSharedState;
    steps: OmniPlanStep[];
}

export interface OmniExecutionStepResult {
    id: string;
    title: string;
    modality: OmniModality;
    ok: boolean;
    backend: string;
    summary: string;
    artifactId?: string;
    artifactUrl?: string;
    error?: string;
}

export interface OmniExecutionResult {
    prompt: string;
    summary: string;
    sharedState: OmniSharedState;
    steps: OmniExecutionStepResult[];
    warnings: string[];
}

function normalizePrompt(prompt: string): string {
    return prompt.trim().replace(/\s+/g, " ");
}

function extractDurationSeconds(prompt: string): number {
    const normalized = prompt.toLowerCase();
    const minuteMatch = normalized.match(/(\d+)\s*(m|min|mins|minute|minutes)/i);
    if (minuteMatch) {
        return Math.max(2, Number(minuteMatch[1]) * 60);
    }
    const secondMatch = normalized.match(/(\d+)\s*(s|sec|secs|second|seconds)/i);
    if (secondMatch) {
        return Math.max(2, Number(secondMatch[1]));
    }
    return 8;
}

function extractBpm(prompt: string): number {
    const match = prompt.match(/(\d{2,3})\s*(bpm|beats per minute|tempo)/i);
    if (match) {
        return Math.max(60, Math.min(220, Number(match[1])));
    }
    return 120;
}

function inferStyle(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (/cinematic|film|movie|hollywood|dramatic/.test(lower)) return "cinematic";
    if (/anime|cartoon|stylized|2d|animation/.test(lower)) return "stylized animation";
    if (/3d|mesh|rig|render|blender/.test(lower)) return "3D rendered";
    if (/photoreal|realistic|photo|lifelike/.test(lower)) return "photorealistic";
    if (/cyberpunk|neon|futuristic|sci-fi/.test(lower)) return "cyberpunk";
    if (/retro|pixel|vintage|8-bit/.test(lower)) return "retro";
    if (/minimal|clean|modern/.test(lower)) return "minimal modern";
    return "high-concept";
}

function inferMood(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (/epic|grand|heroic/.test(lower)) return "epic";
    if (/dreamy|calm|peaceful|serene/.test(lower)) return "dreamy";
    if (/dark|gothic|tense|horror/.test(lower)) return "dark";
    if (/playful|fun|joyful|whimsical/.test(lower)) return "playful";
    if (/suspense|mysterious|mystery/.test(lower)) return "mysterious";
    return "balanced";
}

function inferPalette(style: string, mood: string): string {
    if (style.includes("cyberpunk")) return "electric cyan, magenta, and black";
    if (style.includes("cinematic")) return "desaturated gold and teal";
    if (style.includes("photorealistic")) return "natural daylight with subtle contrast";
    if (style.includes("retro")) return "sepia and muted cream";
    if (mood === "dark") return "deep indigo and ember";
    if (mood === "dreamy") return "pastel lavender and pearl";
    return "balanced high-contrast palette";
}

function inferSceneSummary(prompt: string): string {
    const normalized = normalizePrompt(prompt);
    if (normalized.length > 120) {
        return normalized.slice(0, 120) + "...";
    }
    return normalized;
}

function buildSharedState(prompt: string): OmniSharedState {
    const style = inferStyle(prompt);
    const mood = inferMood(prompt);
    return {
        style,
        mood,
        durationSeconds: extractDurationSeconds(prompt),
        bpm: extractBpm(prompt),
        fps: 24,
        palette: inferPalette(style, mood),
        sceneSummary: inferSceneSummary(prompt),
        previousOutputs: [],
    };
}

function hasVisualIntent(prompt: string): boolean {
    return /image|graphic|character|concept|poster|design|illustration|canvas|scene|visual|art|avatar|environment|style/.test(prompt);
}

function hasVideoIntent(prompt: string): boolean {
    return /video|cinema|film|movie|animation|clip|scene|motion|sequence|camera|shot/.test(prompt);
}

function hasAudioIntent(prompt: string): boolean {
    return /audio|music|sound|sfx|voice|score|beat|tempo|bpm|soundtrack/.test(prompt);
}

function has3DIntent(prompt: string): boolean {
    return /3d|three-dimensional|mesh|rig|model|blender|asset|character rig|environment model/.test(prompt);
}

function buildStepPrompt(step: OmniPlanStep, prompt: string, sharedState: OmniSharedState): string {
    const base = normalizePrompt(prompt);
    switch (step.modality) {
        case "document":
            return `Create a concise production brief for: ${base}. Keep it actionable, structured, and ready for downstream generation. Style: ${sharedState.style}. Mood: ${sharedState.mood}. Palette: ${sharedState.palette}.`;
        case "image":
            return `Create a high-quality visual concept prompt for: ${base}. Emphasize style ${sharedState.style}, mood ${sharedState.mood}, palette ${sharedState.palette}, and scene ${sharedState.sceneSummary}.`;
        case "audio":
            return `Create an audio direction prompt for: ${base}. Use a ${sharedState.bpm} BPM tempo, a ${sharedState.durationSeconds}-second pacing, and a ${sharedState.mood} emotional tone.`;
        case "video":
            return `Create a video scene prompt for: ${base}. Use ${sharedState.style} visual language, ${sharedState.fps} fps pacing, and a ${sharedState.durationSeconds}-second timeline that syncs with the shared audio plan.`;
        case "code":
            return `Generate a small implementation scaffold for: ${base}.`;
        default:
            return `Create a short text artifact for: ${base}.`;
    }
}

function summarizeResult(result: GenerationResult): string {
    if (result.text) {
        return result.text.replace(/\s+/g, " ").slice(0, 180);
    }
    if (result.url) {
        return `Generated artifact from ${result.backend}: ${result.url}`;
    }
    if (result.artifact?.path) {
        return `Stored artifact at ${result.artifact.path}`;
    }
    return `Generated via ${result.backend}`;
}

export function buildOmniMediaPlan(prompt: string): OmniMediaPlan {
    const normalized = normalizePrompt(prompt);
    const sharedState = buildSharedState(normalized);
    const steps: OmniPlanStep[] = [];

    steps.push({
        id: "brief",
        title: "Creative brief",
        modality: "document",
        prompt: buildStepPrompt({id: "brief", title: "Creative brief", modality: "document", prompt: "", outputHint: "A structured brief"}, normalized, sharedState),
        outputHint: "A structured brief for the full production pipeline",
    });

    if (hasVisualIntent(normalized)) {
        steps.push({
            id: "visual",
            title: "Visual concept",
            modality: "image",
            prompt: buildStepPrompt({id: "visual", title: "Visual concept", modality: "image", prompt: "", outputHint: "An image prompt"}, normalized, sharedState),
            outputHint: "An image prompt or concept frame for the scene",
        });
    }

    if (has3DIntent(normalized)) {
        steps.push({
            id: "asset",
            title: "3D asset spec",
            modality: "document",
            prompt: buildStepPrompt({id: "asset", title: "3D asset spec", modality: "document", prompt: "", outputHint: "A 3D asset spec"}, normalized, sharedState),
            outputHint: "A 3D asset spec with rigging and render notes",
        });
    }

    if (hasAudioIntent(normalized)) {
        steps.push({
            id: "audio",
            title: "Audio and SFX",
            modality: "audio",
            prompt: buildStepPrompt({id: "audio", title: "Audio and SFX", modality: "audio", prompt: "", outputHint: "An audio prompt"}, normalized, sharedState),
            outputHint: "An audio prompt or soundtrack direction",
        });
    }

    if (hasVideoIntent(normalized) || hasVisualIntent(normalized)) {
        steps.push({
            id: "video",
            title: "Video scene",
            modality: "video",
            prompt: buildStepPrompt({id: "video", title: "Video scene", modality: "video", prompt: "", outputHint: "A video prompt"}, normalized, sharedState),
            outputHint: "A video prompt or scene storyboard",
        });
    }

    const summary = `Multimodal workflow for ${normalized.slice(0, 80)}${normalized.length > 80 ? "..." : ""}`;
    return {prompt: normalized, summary, sharedState, steps};
}

function toGenerationRequest(step: OmniPlanStep, prompt: string): GenerationRequest {
    switch (step.modality) {
        case "image":
            return {type: "image", prompt, style: "cinematic"};
        case "audio":
            return {type: "audio", prompt, duration: 8};
        case "video":
            return {type: "video", prompt, duration: 8};
        case "code":
            return {type: "code", prompt, language: "typescript"};
        case "text":
            return {type: "text", prompt};
        default:
            return {type: "document", prompt};
    }
}

export async function executeOmniMediaPlan(plan: OmniMediaPlan): Promise<OmniExecutionResult> {
    const steps: OmniExecutionStepResult[] = [];
    const warnings: string[] = [];
    const sharedState = {...plan.sharedState, previousOutputs: [] as Array<{modality: string; summary: string}>};

    for (const step of plan.steps) {
        const request = toGenerationRequest(step, step.prompt);
        try {
            const result = await generate(request);
            const summary = summarizeResult(result);
            sharedState.previousOutputs.push({modality: step.modality, summary});
            steps.push({
                id: step.id,
                title: step.title,
                modality: step.modality,
                ok: true,
                backend: result.backend,
                summary,
                artifactId: result.artifact?.id,
                artifactUrl: result.artifact?.url,
            });
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            warnings.push(`${step.title}: ${detail}`);
            steps.push({
                id: step.id,
                title: step.title,
                modality: step.modality,
                ok: false,
                backend: "unavailable",
                summary: detail,
                error: detail,
            });
        }
    }

    return {
        prompt: plan.prompt,
        summary: plan.summary,
        sharedState,
        steps,
        warnings,
    };
}
