/**
 * Lumi Media / Branding Pipeline
 *
 * Adds a self-contained, independence-first pipeline for turning a brand brief
 * into a structured media/branding package. The pipeline is designed to work
 * even when external image/video/audio providers are not configured by relying
 * on deterministic planning and asset-brief generation.
 */

import {remember} from "./lumi-memory";
import {generate, GenerationRequest, GenerationResult} from "./lumi-generators";

export interface MediaBrandingBrief {
    brandName?: string;
    description?: string;
    audience?: string;
    goals?: string[];
    tone?: string;
    visualStyle?: string;
    channels?: string[];
    deliverables?: string[];
    includeAssetGeneration?: boolean;
}

export interface BrandingAssetBrief {
    id: string;
    title: string;
    kind: "image" | "video" | "audio" | "document" | "text";
    prompt: string;
    notes?: string;
    status: "planned" | "generated";
    result?: GenerationResult;
    error?: string;
}

export interface MediaBrandingPipelineResult {
    brandName: string;
    summary: string;
    positioning: string;
    audience: string;
    tone: string;
    visualDirection: string;
    contentPillars: string[];
    channelPlan: Array<{channel: string; focus: string; hook: string}>;
    deliverables: BrandingAssetBrief[];
    generatedAt: string;
    mode: "local-template" | "generated";
}

function normalizeList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function normalizeText(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function buildContentPillars(goals: string[], description: string): string[] {
    const pillars = goals.length > 0 ? goals : [description];
    return pillars.map((goal, index) => `${index + 1}. ${goal}`);
}

function buildChannelPlan(channels: string[], brandName: string): Array<{channel: string; focus: string; hook: string}> {
    const resolvedChannels = channels.length > 0 ? channels : ["social", "launch", "email", "retention"];
    return resolvedChannels.map((channel, index) => ({
        channel,
        focus: `${brandName} messaging for ${channel}`,
        hook: `Use a ${index % 2 === 0 ? "confident" : "warm"} narrative to make the launch feel unmistakably ${brandName}.`,
    }));
}

function buildDeliverables(brief: MediaBrandingBrief): BrandingAssetBrief[] {
    const requested = brief.deliverables && brief.deliverables.length > 0
        ? brief.deliverables
        : ["brand manifesto", "hero image", "launch video", "intro audio"];

    const brandName = normalizeText(brief.brandName, "Independent Brand");
    const description = normalizeText(brief.description, "A new media experience built to feel premium, self-directed, and unmistakably ownable.");
    const audience = normalizeText(brief.audience, "early adopters and curious builders");
    const tone = normalizeText(brief.tone, "confident, clear, and cinematic");
    const visualStyle = normalizeText(brief.visualStyle, "clean gradients, bold motion, editorial composition");

    return requested.map((deliverable, index) => {
        const title = deliverable.trim();
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes("manifesto") || lowerTitle.includes("brand")) {
            return {
                id: `asset-${index + 1}`,
                title: "Brand manifesto",
                kind: "document",
                prompt: `Write a concise brand manifesto for ${brandName}. Emphasize ${description} and speak to ${audience} in a ${tone} voice.`,
                notes: "Use this as a launch document for positioning, narrative, and creative intent.",
                status: "planned",
            };
        }
        if (lowerTitle.includes("image") || lowerTitle.includes("hero")) {
            return {
                id: `asset-${index + 1}`,
                title: "Hero image",
                kind: "image",
                prompt: `Create a hero image concept for ${brandName}: ${description}. Visual direction: ${visualStyle}.`,
                notes: "Ideal for homepage, social covers, and launch graphics.",
                status: "planned",
            };
        }
        if (lowerTitle.includes("video") || lowerTitle.includes("motion")) {
            return {
                id: `asset-${index + 1}`,
                title: "Launch video",
                kind: "video",
                prompt: `Create a short launch video concept for ${brandName}. Highlight ${description} and speak to ${audience} with a ${tone} tone.`,
                notes: "Best used for launch trailers, announcement clips, and story-driven social content.",
                status: "planned",
            };
        }
        if (lowerTitle.includes("audio") || lowerTitle.includes("sound")) {
            return {
                id: `asset-${index + 1}`,
                title: "Intro audio",
                kind: "audio",
                prompt: `Create a short audio identity concept for ${brandName}: modern, memorable, and aligned with ${tone}.`,
                notes: "Perfect for intros, branded transitions, and sonic signatures.",
                status: "planned",
            };
        }
        return {
            id: `asset-${index + 1}`,
            title,
            kind: "text",
            prompt: `Draft a concise content brief for ${brandName}: ${description}`,
            notes: "Fallback asset brief generated from the brand brief.",
            status: "planned",
        };
    });
}

async function maybeGenerateDocumentAsset(prompt: string, kind: BrandingAssetBrief["kind"]): Promise<GenerationResult | undefined> {
    if (kind !== "document" && kind !== "text") {
        return undefined;
    }
    const req: GenerationRequest = {
        type: kind === "document" ? "document" : "text",
        prompt,
    };
    try {
        return await generate(req);
    } catch {
        return undefined;
    }
}

async function maybeGenerateAsset(asset: BrandingAssetBrief): Promise<BrandingAssetBrief> {
    if (!asset.prompt) return asset;
    try {
        const generated = await maybeGenerateDocumentAsset(asset.prompt, asset.kind);
        if (generated) {
            return {...asset, status: "generated", result: generated};
        }
    } catch {
        // Fall back to the planned output if generation is unavailable.
    }
    return asset;
}

export async function buildMediaBrandingPipeline(
    brief: MediaBrandingBrief,
    options?: {sessionId?: string; generateAssets?: boolean}
): Promise<MediaBrandingPipelineResult> {
    const brandName = normalizeText(brief.brandName, "Independent Brand");
    const description = normalizeText(brief.description, "A new media experience that feels premium, self-directed, and unmistakably ownable.");
    const audience = normalizeText(brief.audience, "early adopters and curious builders");
    const tone = normalizeText(brief.tone, "confident, clear, and cinematic");
    const visualStyle = normalizeText(brief.visualStyle, "clean gradients, bold motion, editorial composition");
    const goals = normalizeList(brief.goals);
    const channels = normalizeList(brief.channels);
    const deliverables = buildDeliverables(brief);

    const resolvedDeliverables = options?.generateAssets
        ? await Promise.all(deliverables.map(maybeGenerateAsset))
        : deliverables;

    const contentPillars = buildContentPillars(goals, description);
    const channelPlan = buildChannelPlan(channels, brandName);
    const result: MediaBrandingPipelineResult = {
        brandName,
        summary: `${brandName} is positioned as a self-directed, premium media brand for ${audience}. The core story is ${description}`,
        positioning: `${brandName} should feel like an independent media system that owns its voice, visuals, and launch rhythm rather than borrowing from a generic template.`,
        audience,
        tone,
        visualDirection: visualStyle,
        contentPillars,
        channelPlan,
        deliverables: resolvedDeliverables,
        generatedAt: new Date().toISOString(),
        mode: resolvedDeliverables.some(asset => asset.status === "generated") ? "generated" : "local-template",
    };

    if (options?.sessionId) {
        await remember(
            options.sessionId,
            "assistant",
            JSON.stringify(result),
            ["media", "branding", brandName.toLowerCase()],
            "knowledge"
        );
    }

    return result;
}

export async function buildBrandingMediaPipeline(
    brief: MediaBrandingBrief,
    options?: {sessionId?: string; generateAssets?: boolean}
): Promise<MediaBrandingPipelineResult> {
    return buildMediaBrandingPipeline(brief, options);
}

export async function buildFullIndependenceMediaBrandingPipeline(
    brief: MediaBrandingBrief,
    options?: {sessionId?: string; generateAssets?: boolean}
): Promise<MediaBrandingPipelineResult> {
    return buildMediaBrandingPipeline(brief, options);
}

export async function executeMediaBrandingPipeline(
    brief: MediaBrandingBrief,
    options?: {sessionId?: string; generateAssets?: boolean}
): Promise<MediaBrandingPipelineResult> {
    return buildMediaBrandingPipeline(brief, options);
}
