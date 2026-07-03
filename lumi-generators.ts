/**
 * Lumi Generators
 *
 * Integrations with free-tier AI generation services:
 *   - Image: Hugging Face Inference API (FLUX.1-schnell / stable-diffusion)
 *   - Image: Stability AI (stable-diffusion-xl-1024-v1-0)
 *   - Video: FAL.ai (Wan 2.2 / Kling) — primary, mirrors Production Studio
 *   - Video: Hugging Face (Tencent HunyuanVideo) — fallback when FAL_KEY is unavailable
 *   - Video: Replicate (zeroscope) — fallback when FAL_KEY / HUGGINGFACE_API_KEY are unavailable
 *   - Audio: Hugging Face (musicgen-small)
 *   - Code: OpenRouter (routed to best available model)
 *
 * All generators return a base64-encoded result or a URL to the output,
 * depending on the backend.
 */

import {execFile} from "child_process";
import {promises as fs} from "fs";
import path from "path";
import {callOpenRouterChat} from "./openrouter";
import {callNvidiaChat, callNvidiaVideoGeneration, NvidiaVideoGenerationRequest} from "./nvidia";
import {generateVideoComfyUI} from "./comfyui";
import {storeArtifact, StoredArtifact} from "./lumi-storage";
import {fetchWithRetry} from "./lumi-runtime";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || "";
const STABILITY_API_KEY = process.env.STABILITY_API_KEY || "";
const FAL_API_KEY = process.env.FAL_KEY || "";
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

const HF_API_URL = "https://api-inference.huggingface.co/models";
const STABILITY_API_URL = "https://api.stability.ai/v1/generation";
const FAL_API_URL = "https://queue.fal.run";
const REPLICATE_API_URL = "https://api.replicate.com/v1";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
const MAX_HUNYUAN_VIDEO_FRAMES = 81;
const HUNYUAN_VIDEO_FPS = 8;
const BINARY_ARTIFACT_TYPES = ["image", "audio", "video"] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GeneratorType = "image" | "video" | "audio" | "code" | "3d" | "text" | "document";

export interface GenerationRequest {
    type: GeneratorType;
    prompt: string;
    negativePrompt?: string;
    style?: string;
    width?: number;
    height?: number;
    steps?: number;
    seed?: number;
    model?: string;
    language?: string; // for code generation
    duration?: number; // seconds, for audio/video
    imageBase64?: string;
    imageUrl?: string;
    imageMimeType?: string;
    provider?: "auto" | "fal" | "hunyuan" | "replicate" | "nvidia" | "comfyui";
}

export interface GenerationResult {
    type: GeneratorType;
    backend: string;
    model: string;
    /** Base64-encoded output (images / audio) */
    data?: string;
    mimeType?: string;
    /** URL to hosted output (video, replicate outputs) */
    url?: string;
    /** Generated text (code, text, document) */
    text?: string;
    prompt: string;
    createdAt: string;
    artifact?: StoredArtifact;
}

// ---------------------------------------------------------------------------
// Model name validation — prevents SSRF via crafted model identifiers
// ---------------------------------------------------------------------------

/**
 * Validate that a model identifier is safe to use as a URL path segment.
 * Accepts only alphanumeric characters, hyphens, underscores, dots, slashes,
 * and colons (e.g. "black-forest-labs/FLUX.1-schnell", "mistral:7b").
 * Rejects anything that looks like a URL, absolute path, or traversal attempt.
 */
function validateModelId(model: string): string {
    if (!/^[\w./:@-]{1,200}$/.test(model)) {
        throw new Error(`Invalid model identifier: "${model}"`);
    }
    // Reject anything that starts with a protocol or path traversal
    if (/^(https?|ftp):\/\//i.test(model) || model.includes("..")) {
        throw new Error(`Model identifier must not be a URL or contain path traversal: "${model}"`);
    }
    return model;
}

/**
 * Validate that a URL returned by an external API belongs to an expected host.
 * Used to guard against open-redirect and SSRF via API-returned callback URLs.
 */
function validateApiCallbackUrl(url: string, allowedHosts: string[]): string {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error(`Invalid callback URL: "${url}"`);
    }
    if (!allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
        throw new Error(`Callback URL host "${parsed.hostname}" is not in the allowed list`);
    }
    return url;
}

/**
 * Generate an image via the Hugging Face Inference API (free tier).
 * Uses FLUX.1-schnell by default — one of the fastest free models.
 */
export async function generateImageHF(req: GenerationRequest): Promise<GenerationResult> {
    const model = validateModelId(req.model || "black-forest-labs/FLUX.1-schnell");
    const payload: Record<string, any> = {
        inputs: req.prompt,
        parameters: {
            width: req.width || 512,
            height: req.height || 512,
            num_inference_steps: req.steps || 4,
        },
    };
    if (req.negativePrompt) payload.parameters.negative_prompt = req.negativePrompt;
    if (req.seed !== undefined) payload.parameters.seed = req.seed;

    const res = await fetchWithRetry(`${HF_API_URL}/${model}`, {
        method: "POST",
        headers: {
            Authorization: "Bearer " + HF_API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    }, {provider: "huggingface", retries: 2, timeoutMs: 30_000});

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`HuggingFace image generation failed (${res.status}): ${msg}`);
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";

    return {
        type: "image",
        backend: "huggingface",
        model,
        data: base64,
        mimeType: contentType,
        prompt: req.prompt,
        createdAt: new Date().toISOString(),
    };
}

/**
 * Generate an image via Stability AI (free credits available).
 */
export async function generateImageStability(req: GenerationRequest): Promise<GenerationResult> {
    const model = validateModelId(req.model || "stable-diffusion-xl-1024-v1-0");
    const body: Record<string, any> = {
        text_prompts: [
            {text: req.prompt, weight: 1},
            ...(req.negativePrompt ? [{text: req.negativePrompt, weight: -1}] : []),
        ],
        cfg_scale: 7,
        width: req.width || 1024,
        height: req.height || 1024,
        steps: req.steps || 30,
        samples: 1,
    };
    if (req.seed !== undefined) body.seed = req.seed;
    if (req.style) body.style_preset = req.style;

    const res = await fetchWithRetry(
        `${STABILITY_API_URL}/${model}/text-to-image`,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                Authorization: "Bearer " + STABILITY_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        },
        {provider: "stability-ai", retries: 2, timeoutMs: 30_000}
    );

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Stability AI generation failed (${res.status}): ${msg}`);
    }

    const json: any = await res.json();
    const imageData: string = json.artifacts?.[0]?.base64;
    if (!imageData) throw new Error("Stability AI returned no image data");

    return {
        type: "image",
        backend: "stability-ai",
        model,
        data: imageData,
        mimeType: "image/png",
        prompt: req.prompt,
        createdAt: new Date().toISOString(),
    };
}

/**
 * Smart image generator: tries Stability AI first (if key available),
 * then falls back to Hugging Face.
 */
export async function generateImage(req: GenerationRequest): Promise<GenerationResult> {
    const attempts: Array<{provider: string; error: string}> = [];
    if (STABILITY_API_KEY) {
        try {
            return await generateImageStability(req);
        } catch (error) {
            attempts.push({provider: "stability-ai", error: error instanceof Error ? error.message : String(error)});
        }
    }
    if (HF_API_KEY) {
        try {
            return await generateImageHF(req);
        } catch (error) {
            attempts.push({provider: "huggingface", error: error instanceof Error ? error.message : String(error)});
        }
    }
    const detail = attempts.map(entry => `${entry.provider}: ${entry.error}`).join("; ");
    throw new Error(
        detail
            ? `No image generation backend succeeded. ${detail}`
            : "No image generation API key configured. Set STABILITY_API_KEY or HUGGINGFACE_API_KEY."
    );
}

export async function generateVideoNvidia(req: GenerationRequest): Promise<GenerationResult> {
    const apiBase = process.env.NVIDIA_API_BASE || process.env.NVIDIA_BASE_URL || "";
    if (!apiBase) {
        throw new Error("NVIDIA_API_BASE is not configured.");
    }

    const videoReq: NvidiaVideoGenerationRequest = {
        prompt: req.prompt,
        model: req.model,
        imageBase64: req.imageBase64,
        imageUrl: req.imageUrl,
        imageMimeType: req.imageMimeType,
        width: req.width,
        height: req.height,
        duration: req.duration,
    };
    const result = await callNvidiaVideoGeneration(videoReq);

    return {
        type: "video",
        backend: result.backend,
        model: result.model || req.model || process.env.NVIDIA_VIDEO_MODEL || process.env.NVIDIA_CHAT_MODEL || "",
        url: result.url,
        data: result.data,
        mimeType: result.mimeType,
        prompt: req.prompt,
        createdAt: result.createdAt,
    };
}

async function runLocalHunyuanVideo(req: GenerationRequest): Promise<GenerationResult | null> {
    const explicitScriptPath = process.env.HUNYUAN_VIDEO_SCRIPT_PATH?.trim();
    const defaultRepoRoot = process.env.HUNYUAN_VIDEO_REPO_PATH?.trim() || path.resolve(process.cwd(), "vendor", "hunyuan-video");
    const candidates = new Set<string>();

    if (explicitScriptPath) {
        candidates.add(path.resolve(explicitScriptPath));
    }

    if (defaultRepoRoot) {
        candidates.add(path.join(defaultRepoRoot, "scripts", "hunyuan_video_generate.py"));
        candidates.add(path.join(defaultRepoRoot, "hunyuan_video_generate.py"));
        candidates.add(path.join(defaultRepoRoot, "generate.py"));
        candidates.add(path.join(defaultRepoRoot, "run.py"));
        candidates.add(path.join(defaultRepoRoot, "infer.py"));
    }

    for (const candidate of candidates) {
        try {
            await fs.access(candidate);
            const outputDir = path.resolve(process.cwd(), process.env.HUNYUAN_VIDEO_OUTPUT_DIR || ".data/video");
            const outputPath = path.join(outputDir, `hunyuan-${Date.now()}.mp4`);
            await fs.mkdir(outputDir, {recursive: true});

            const pythonCommand = process.env.HUNYUAN_VIDEO_PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
            const args = [candidate, "--prompt", req.prompt, "--output", outputPath];
            if (req.negativePrompt) args.push("--negative-prompt", req.negativePrompt);
            if (req.width) args.push("--width", String(req.width));
            if (req.height) args.push("--height", String(req.height));
            if (req.duration) args.push("--duration", String(req.duration));
            if (req.seed !== undefined) args.push("--seed", String(req.seed));
            if (req.model) args.push("--model", req.model);

            await new Promise<void>((resolve, reject) => {
                execFile(pythonCommand, args, {maxBuffer: 10 * 1024 * 1024}, (error, _stdout, stderr) => {
                    if (error) {
                        reject(new Error(`Local HunyuanVideo script failed (${pythonCommand} ${args.join(" ")}): ${stderr || error.message}`));
                        return;
                    }
                    resolve();
                });
            });

            const outputExists = await fs.access(outputPath).then(() => true).catch(() => false);
            if (!outputExists) {
                throw new Error(`Local HunyuanVideo script did not produce ${outputPath}`);
            }
            const buffer = await fs.readFile(outputPath);
            return {
                type: "video",
                backend: "hunyuan-local",
                model: req.model || "local-hunyuan-video",
                data: buffer.toString("base64"),
                mimeType: "video/mp4",
                prompt: req.prompt,
                createdAt: new Date().toISOString(),
            };
        } catch (error) {
            if (candidate === explicitScriptPath) {
                throw error;
            }
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Video Generation — NVIDIA / Hugging Face / FAL.ai / Replicate
// ---------------------------------------------------------------------------

/**
 * Generate a video via the Hugging Face Inference API using Tencent HunyuanVideo.
 * This provides a Hugging Face-backed path for video generation when no FAL key is configured.
 */
export async function generateVideoHF(req: GenerationRequest): Promise<GenerationResult> {
    if (!HF_API_KEY) {
        throw new Error("HUGGINGFACE_API_KEY is not configured.");
    }

    const model = validateModelId(req.model || "tencent/HunyuanVideo");
    const payload: Record<string, any> = {
        inputs: req.prompt,
        parameters: {
            width: req.width || 720,
            height: req.height || 480,
            // Keep the Hugging Face request within a conservative frame budget for video generation.
            num_frames: Math.min((req.duration || 3) * HUNYUAN_VIDEO_FPS, MAX_HUNYUAN_VIDEO_FRAMES),
            num_inference_steps: req.steps || 30,
        },
    };

    const res = await fetchWithRetry(`${HF_API_URL}/${model}`, {
        method: "POST",
        headers: {
            Authorization: "Bearer " + HF_API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    }, {provider: "huggingface", retries: 2, timeoutMs: 30_000});

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`HuggingFace video generation failed (${res.status}): ${msg}`);
    }

    const contentType = res.headers.get("content-type") || "video/mp4";
    const buffer = Buffer.from(await res.arrayBuffer());

    return {
        type: "video",
        backend: "huggingface",
        model,
        data: buffer.toString("base64"),
        mimeType: contentType,
        prompt: req.prompt,
        createdAt: new Date().toISOString(),
    };
}

/**
 * Generate a video via FAL.ai (Wan 2.2 / Kling).
 * FAL provides a free tier and is the primary video backend used by
 * TrezzWorld Production Studio.
 */
export async function generateVideoFal(req: GenerationRequest): Promise<GenerationResult> {
    if (!FAL_API_KEY) throw new Error("FAL_KEY is not configured.");

    const model = validateModelId(req.model || "fal-ai/wan/t2v-14b");

    // Submit request — URL is built entirely from our validated constants + model id
    const submitRes = await fetchWithRetry(`${FAL_API_URL}/${model}`, {
        method: "POST",
        headers: {
            Authorization: "Key " + FAL_API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt: req.prompt,
            num_frames: Math.min((req.duration || 5) * 8, 81),
            resolution: `${req.width || 848}x${req.height || 480}`,
            num_inference_steps: req.steps || 30,
        }),
    }, {provider: "fal-ai", retries: 2, timeoutMs: 30_000});

    if (!submitRes.ok) {
        const msg = await submitRes.text();
        throw new Error(`FAL video submit failed (${submitRes.status}): ${msg}`);
    }

    const submitted: any = await submitRes.json();
    // Validate the request ID is a safe identifier (no path traversal)
    const rawId: string = submitted.request_id || submitted.id || "";
    if (!/^[\w-]{1,200}$/.test(rawId)) throw new Error("FAL returned an invalid request_id");
    const requestId = rawId;

    // All polling URLs are constructed from our constant base + validated segments
    const statusUrl = `${FAL_API_URL}/${model}/requests/${requestId}/status`;

    const FAL_ALLOWED_HOSTS = ["fal.run", "fal.ai", "fal.media"];

    // Poll until complete (max 300 s)
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 4000));
        const pollRes = await fetchWithRetry(statusUrl, {
            headers: {Authorization: "Key " + FAL_API_KEY},
        }, {provider: "fal-ai", retries: 1, timeoutMs: 15_000});
        if (!pollRes.ok) continue;
        const pollData: any = await pollRes.json();
        if (pollData.status === "COMPLETED" || pollData.status === "completed") {
            const resultRes = await fetchWithRetry(
                `${FAL_API_URL}/${model}/requests/${requestId}`,
                {headers: {Authorization: "Key " + FAL_API_KEY}},
                {provider: "fal-ai", retries: 1, timeoutMs: 15_000}
            );
            const result: any = await resultRes.json();
            const rawUrl: string = result.video?.url || result.output?.video?.url || "";
            // Validate that the output URL is from a trusted FAL domain
            const url = rawUrl ? validateApiCallbackUrl(rawUrl, FAL_ALLOWED_HOSTS) : "";
            return {
                type: "video",
                backend: "fal-ai",
                model,
                url,
                prompt: req.prompt,
                createdAt: new Date().toISOString(),
            };
        }
        if (pollData.status === "FAILED" || pollData.status === "failed") {
            throw new Error(`FAL video generation failed: ${JSON.stringify(pollData.error)}`);
        }
    }

    throw new Error("FAL video generation timed out after 300 s");
}

// ---------------------------------------------------------------------------
// Video Generation — Replicate (zeroscope_v2_xl, fallback)
// ---------------------------------------------------------------------------

export async function generateVideoReplicate(req: GenerationRequest): Promise<GenerationResult> {
    if (!REPLICATE_API_KEY) {
        throw new Error("REPLICATE_API_KEY is not configured.");
    }

    const model = validateModelId(
        req.model || "anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351"
    );

    const REPLICATE_ALLOWED_HOSTS = ["replicate.com", "replicate.delivery"];

    // Start the prediction — URL is our constant endpoint, no user data in host
    const startRes = await fetchWithRetry(`${REPLICATE_API_URL}/predictions`, {
        method: "POST",
        headers: {
            Authorization: `Token ${REPLICATE_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            version: model.includes(":") ? model.split(":")[1] : model,
            input: {
                prompt: req.prompt,
                num_frames: Math.min((req.duration || 3) * 8, 24),
                width: req.width || 576,
                height: req.height || 320,
                num_inference_steps: req.steps || 25,
            },
        }),
    }, {provider: "replicate", retries: 2, timeoutMs: 30_000});

    if (!startRes.ok) {
        const msg = await startRes.text();
        throw new Error(`Replicate video start failed (${startRes.status}): ${msg}`);
    }

    const prediction: any = await startRes.json();
    const rawPollUrl: string = prediction.urls?.get || "";
    if (!rawPollUrl) throw new Error("Replicate did not return a poll URL");
    // Validate the poll URL is on an expected Replicate domain
    const pollUrl = validateApiCallbackUrl(rawPollUrl, REPLICATE_ALLOWED_HOSTS);

    // Poll until complete (max 120 s)
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000));
        const pollRes = await fetchWithRetry(pollUrl, {
            headers: {Authorization: `Token ${REPLICATE_API_KEY}`},
        }, {provider: "replicate", retries: 1, timeoutMs: 15_000});
        const pollData: any = await pollRes.json();
        if (pollData.status === "succeeded") {
            const rawUrl: string = Array.isArray(pollData.output)
                ? pollData.output[0]
                : pollData.output;
            // Validate the output URL is on an expected Replicate domain
            const url = rawUrl ? validateApiCallbackUrl(rawUrl, REPLICATE_ALLOWED_HOSTS) : "";
            return {
                type: "video",
                backend: "replicate",
                model: model.split(":")[0],
                url,
                prompt: req.prompt,
                createdAt: new Date().toISOString(),
            };
        }
        if (pollData.status === "failed") {
            throw new Error(`Replicate video generation failed: ${pollData.error}`);
        }
    }

    throw new Error("Replicate video generation timed out after 120 s");
}

/**
 * Smart video generator: tries FAL.ai first (mirrors Production Studio),
 * then Hugging Face HunyuanVideo, then Replicate.
 */
export async function generateVideo(req: GenerationRequest): Promise<GenerationResult> {
    switch (req.provider) {
        case "fal":
            if (!FAL_API_KEY) throw new Error("FAL_KEY is not configured.");
            return generateVideoFal(req);
        case "hunyuan": {
            const localResult = await runLocalHunyuanVideo(req);
            if (localResult) return localResult;
            if (!HF_API_KEY) throw new Error("HUNYUAN_VIDEO_SCRIPT_PATH is not configured and HUGGINGFACE_API_KEY is not configured for HunyuanVideo.");
            return generateVideoHF(req);
        }
        case "replicate":
            if (!REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY is not configured.");
            return generateVideoReplicate(req);
        case "nvidia":
            return generateVideoNvidia(req);
        case "comfyui":
            return generateVideoComfyUI(req);
        case undefined:
        case "auto": {
            if (process.env.COMFYUI_BASE_URL) {
                try {
                    return await generateVideoComfyUI(req);
                } catch (error) {
                    console.warn("[Lumi Generators] ComfyUI video generation failed, falling back:", error);
                }
            }
            if (process.env.NVIDIA_API_BASE || process.env.NVIDIA_BASE_URL) {
                try {
                    return await generateVideoNvidia(req);
                } catch (error) {
                    console.warn("[Lumi Generators] NVIDIA video generation failed, falling back:", error);
                }
            }
            try {
                const localResult = await runLocalHunyuanVideo(req);
                if (localResult) return localResult;
            } catch (error) {
                console.warn("[Lumi Generators] Local HunyuanVideo checkout failed, falling back:", error);
            }
            if (FAL_API_KEY) return generateVideoFal(req);
            if (HF_API_KEY) return generateVideoHF(req);
            if (REPLICATE_API_KEY) return generateVideoReplicate(req);
            throw new Error(
                "No video generation API key configured. " +
                "Set COMFYUI_BASE_URL, NVIDIA_API_BASE (primary), FAL_KEY, HUGGINGFACE_API_KEY, or REPLICATE_API_KEY."
            );
        }
        default:
            throw new Error(`Unsupported video provider: ${req.provider}`);
    }
}

// ---------------------------------------------------------------------------
// Audio Generation (Hugging Face — facebook/musicgen-small)
// ---------------------------------------------------------------------------

export async function generateAudio(req: GenerationRequest): Promise<GenerationResult> {
    if (!HF_API_KEY) {
        return {
            type: "audio",
            backend: "unavailable",
            model: req.model || "facebook/musicgen-small",
            text: "Audio generation is not available yet because HUGGINGFACE_API_KEY is not configured. Configure a backend to generate audio assets.",
            prompt: req.prompt,
            createdAt: new Date().toISOString(),
        };
    }

    const model = validateModelId(req.model || "facebook/musicgen-small");
    const res = await fetchWithRetry(`${HF_API_URL}/${model}`, {
        method: "POST",
        headers: {
            Authorization: "Bearer " + HF_API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({inputs: req.prompt}),
    }, {provider: "huggingface", retries: 2, timeoutMs: 30_000});

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`HuggingFace audio generation failed (${res.status}): ${msg}`);
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
        type: "audio",
        backend: "huggingface",
        model,
        data: base64,
        mimeType: "audio/flac",
        prompt: req.prompt,
        createdAt: new Date().toISOString(),
    };
}

function buildLocalGenerationFallback(prompt: string, type: "text" | "document" | "code"): string {
    const briefPrompt = (prompt || "").trim().replace(/\s+/g, " ").slice(0, 180);
    if (type === "code") {
        return `// Local fallback generated by Lumi\n// Request: ${briefPrompt || "implement the requested feature"}\nexport function localFallback() {\n  return \"Implemented with local fallback\";\n}\n`;
    }
    if (type === "document") {
        return `# Local fallback document\n\nRequest: ${briefPrompt || "Create a document"}\n\n- Summary: captured locally and ready for refinement.\n- Next step: expand the outline with more detail.\n`;
    }
    return `Local fallback draft for: ${briefPrompt || "your request"}\n\nThis response was generated without a remote provider so you can keep working locally. Add more context to refine the output.`;
}

async function callFreeChat(
    messages: Array<{role: string; content: string}>,
    model: string,
    options: {fallbackKind?: "text" | "document" | "code"} = {}
): Promise<{text: string; backend: string}> {
    const attempts: Array<{provider: string; error: string}> = [];

    if (OPENROUTER_API_KEY) {
        try {
            return {
                text: await callOpenRouterChat(
                    messages,
                    model,
                    {
                        apiKey: OPENROUTER_API_KEY,
                        httpReferer: "https://trezzhaus.com",
                        appTitle: "Lumi — Trezzhaus AI",
                        appCategories: "cli-agent,cloud-agent",
                    }
                ),
                backend: "openrouter",
            };
        } catch (error) {
            attempts.push({provider: "openrouter", error: error instanceof Error ? error.message : String(error)});
        }
    }

    if (process.env.NVIDIA_API_BASE || process.env.NVIDIA_BASE_URL) {
        try {
            return {
                text: await callNvidiaChat(messages, model, {
                    apiKey: process.env.NVIDIA_API_KEY || "",
                    apiBase: process.env.NVIDIA_API_BASE || process.env.NVIDIA_BASE_URL || "",
                }),
                backend: "nvidia",
            };
        } catch (error) {
            attempts.push({provider: "nvidia", error: error instanceof Error ? error.message : String(error)});
        }
    }

    const detail = attempts.map(entry => `${entry.provider}: ${entry.error}`).join("; ");
    const fallbackPrompt = messages[messages.length - 1]?.content || "";
    return {
        text: detail
            ? `Lumi is running in fallback mode because the primary chat providers failed: ${detail}`
            : (options.fallbackKind
                ? buildLocalGenerationFallback(fallbackPrompt, options.fallbackKind)
                : "Lumi is running in fallback mode because no free chat provider is configured. Configure OPENROUTER_API_KEY or NVIDIA_API_BASE for full chat responses."),
        backend: "fallback",
    };
}

// ---------------------------------------------------------------------------
// Text Generation (OpenRouter — plain text)
// ---------------------------------------------------------------------------

export async function generateText(req: GenerationRequest): Promise<GenerationResult> {
    const model = validateModelId(req.model || "mistralai/mistral-7b-instruct:free");
    const systemPrompt =
        `You are Lumi, a polished writing assistant for the Trezzhaus platform. ` +
        `Write concise, high-quality text for the user's request. ` +
        `Return only the requested text, no markdown fences.`;

    const response = await callFreeChat(
        [
            {role: "system", content: systemPrompt},
            {role: "user", content: req.prompt},
        ],
        model,
        {fallbackKind: "text"},
    );

    return {
        type: "text",
        backend: response.backend,
        model,
        text: response.text,
        prompt: req.prompt,
        createdAt: new Date().toISOString(),
    };
}

// ---------------------------------------------------------------------------
// Document Generation (OpenRouter — markdown documents)
// ---------------------------------------------------------------------------

export async function generateDocument(req: GenerationRequest): Promise<GenerationResult> {
    const model = validateModelId(req.model || "mistralai/devstral-small:free");
    const systemPrompt =
        `You are Lumi, an expert document writer for the Trezzhaus platform. ` +
        `Create a polished Markdown document that fulfills the request. ` +
        `Return only the Markdown document, no markdown fences.`;

    const response = await callFreeChat(
        [
            {role: "system", content: systemPrompt},
            {role: "user", content: req.prompt},
        ],
        model,
        {fallbackKind: "document"},
    );

    return {
        type: "document",
        backend: response.backend,
        model,
        text: response.text,
        prompt: req.prompt,
        createdAt: new Date().toISOString(),
    };
}

// ---------------------------------------------------------------------------
// Code Generation (OpenRouter — routed to best free model)
// ---------------------------------------------------------------------------

export async function generateCode(req: GenerationRequest): Promise<GenerationResult> {
    const model = validateModelId(req.model || "mistralai/devstral-small:free");
    const systemPrompt =
        `You are Lumi, an expert programmer for the Trezzhaus platform. ` +
        `Write clean, complete, well-commented ${req.language || "TypeScript"} code. ` +
        `Return ONLY the code, no markdown fences.`;

    const response = await callFreeChat(
        [
            {role: "system", content: systemPrompt},
            {role: "user", content: req.prompt},
        ],
        model,
        {fallbackKind: "code"},
    );

    return {
        type: "code",
        backend: response.backend,
        model,
        text: response.text,
        prompt: req.prompt,
        createdAt: new Date().toISOString(),
    };
}

function getDefaultMimeType(type: GenerationResult["type"]): string {
    switch (type) {
        case "image": return "image/png";
        case "audio": return "audio/flac";
        case "video": return "video/mp4";
        default: return "application/octet-stream";
    }
}

function isBinaryArtifactType(type: GenerationResult["type"] | string): boolean {
    return BINARY_ARTIFACT_TYPES.some((artifactType) => artifactType === type);
}

async function persistGenerationResult(result: GenerationResult): Promise<GenerationResult> {
    try {
        if (isBinaryArtifactType(result.type) && result.data) {
            const artifact = await storeArtifact({
                kind: result.type,
                filename: `${result.type}-${Date.now()}`,
                mimeType: result.mimeType || getDefaultMimeType(result.type),
                buffer: Buffer.from(result.data, "base64"),
            });
            return {
                ...result,
                artifact: artifact || undefined,
            };
        }

        if (result.type === "video" && result.url) {
            const artifact = await storeArtifact({
                kind: "video",
                filename: `video-${Date.now()}`,
                mimeType: result.mimeType || "video/mp4",
                sourceUrl: result.url,
            });
            return {
                ...result,
                artifact: artifact || undefined,
            };
        }

        if ((result.type === "text" || result.type === "document" || result.type === "code") && result.text) {
            const mimeType = result.type === "document" ? "text/markdown" : "text/plain";
            const artifact = await storeArtifact({
                kind: result.type,
                filename: `${result.type}-${Date.now()}`,
                mimeType,
                content: result.text,
            });
            return {
                ...result,
                artifact: artifact || undefined,
            };
        }
    } catch (error) {
        console.warn("[Lumi Generators] Failed to persist generated artifact:", error);
    }

    return result;
}

// ---------------------------------------------------------------------------
// Dispatch helper
// ---------------------------------------------------------------------------

export async function generate(req: GenerationRequest): Promise<GenerationResult> {
    let result: GenerationResult | undefined;
    switch (req.type) {
        case "image": result = await generateImage(req); break;
        case "video": result = await generateVideo(req); break;
        case "audio": result = await generateAudio(req); break;
        case "code":  result = await generateCode(req); break;
        case "text": result = await generateText(req); break;
        case "document": result = await generateDocument(req); break;
        default:
            throw new Error(`Unsupported generation type: ${req.type}`);
    }
    if (!result) {
        throw new Error(`Unsupported generation type: ${req.type}`);
    }
    return persistGenerationResult(result);
}
