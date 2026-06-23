/**
 * Lumi Generators
 *
 * Integrations with free-tier AI generation services:
 *   - Image: Hugging Face Inference API (FLUX.1-schnell / stable-diffusion)
 *   - Image: Stability AI (stable-diffusion-xl-1024-v1-0)
 *   - Video: FAL.ai (Wan 2.2 / Kling) — primary, mirrors Production Studio
 *   - Video: Replicate (zeroscope) — fallback when FAL_KEY not set
 *   - Audio: Hugging Face (musicgen-small)
 *   - Code: OpenRouter (routed to best available model)
 *
 * All generators return a base64-encoded result or a URL to the output,
 * depending on the backend.
 */

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GeneratorType = "image" | "video" | "audio" | "code" | "3d";

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
    /** Generated text (code) */
    text?: string;
    prompt: string;
    createdAt: string;
}

// ---------------------------------------------------------------------------
// Image Generation
// ---------------------------------------------------------------------------

/**
 * Generate an image via the Hugging Face Inference API (free tier).
 * Uses FLUX.1-schnell by default – one of the fastest free models.
 */
export async function generateImageHF(req: GenerationRequest): Promise<GenerationResult> {
    const model = req.model || "black-forest-labs/FLUX.1-schnell";
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

    const res = await fetch(`${HF_API_URL}/${model}`, {
        method: "POST",
        headers: {
            Authorization: "Bearer " + HF_API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

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
    const model = req.model || "stable-diffusion-xl-1024-v1-0";
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

    const res = await fetch(
        `${STABILITY_API_URL}/${model}/text-to-image`,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                Authorization: "Bearer " + STABILITY_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        }
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
    if (STABILITY_API_KEY) {
        return generateImageStability(req);
    }
    if (HF_API_KEY) {
        return generateImageHF(req);
    }
    throw new Error(
        "No image generation API key configured. " +
        "Set STABILITY_API_KEY or HUGGINGFACE_API_KEY."
    );
}

// ---------------------------------------------------------------------------
// Video Generation — FAL.ai (primary, mirrors Production Studio)
// ---------------------------------------------------------------------------

/**
 * Generate a video via FAL.ai (Wan 2.2 / Kling).
 * FAL provides a free tier and is the primary video backend used by
 * TrezzWorld Production Studio.
 */
export async function generateVideoFal(req: GenerationRequest): Promise<GenerationResult> {
    if (!FAL_API_KEY) throw new Error("FAL_KEY is not configured.");

    const model = req.model || "fal-ai/wan/t2v-14b";

    // Submit request
    const submitRes = await fetch(`${FAL_API_URL}/${model}`, {
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
    });

    if (!submitRes.ok) {
        const msg = await submitRes.text();
        throw new Error(`FAL video submit failed (${submitRes.status}): ${msg}`);
    }

    const submitted: any = await submitRes.json();
    const requestId: string = submitted.request_id || submitted.id;
    if (!requestId) throw new Error("FAL did not return a request_id");

    const statusUrl = `${FAL_API_URL}/${model}/requests/${requestId}/status`;

    // Poll until complete (max 300 s)
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 4000));
        const pollRes = await fetch(statusUrl, {
            headers: {Authorization: "Key " + FAL_API_KEY},
        });
        if (!pollRes.ok) continue;
        const pollData: any = await pollRes.json();
        if (pollData.status === "COMPLETED" || pollData.status === "completed") {
            const resultRes = await fetch(
                `${FAL_API_URL}/${model}/requests/${requestId}`,
                {headers: {Authorization: "Key " + FAL_API_KEY}}
            );
            const result: any = await resultRes.json();
            const url: string = result.video?.url || result.output?.video?.url || "";
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

    const model = req.model || "anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351";

    // Start the prediction
    const startRes = await fetch(`${REPLICATE_API_URL}/predictions`, {
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
    });

    if (!startRes.ok) {
        const msg = await startRes.text();
        throw new Error(`Replicate video start failed (${startRes.status}): ${msg}`);
    }

    const prediction: any = await startRes.json();
    const pollUrl = prediction.urls?.get;
    if (!pollUrl) throw new Error("Replicate did not return a poll URL");

    // Poll until complete (max 120 s)
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000));
        const pollRes = await fetch(pollUrl, {
            headers: {Authorization: `Token ${REPLICATE_API_KEY}`},
        });
        const pollData: any = await pollRes.json();
        if (pollData.status === "succeeded") {
            const url: string = Array.isArray(pollData.output)
                ? pollData.output[0]
                : pollData.output;
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
 * then falls back to Replicate.
 */
export async function generateVideo(req: GenerationRequest): Promise<GenerationResult> {
    if (FAL_API_KEY) return generateVideoFal(req);
    if (REPLICATE_API_KEY) return generateVideoReplicate(req);
    throw new Error(
        "No video generation API key configured. " +
        "Set FAL_KEY (primary) or REPLICATE_API_KEY (fallback)."
    );
}

// ---------------------------------------------------------------------------
// Audio Generation (Hugging Face – facebook/musicgen-small)
// ---------------------------------------------------------------------------

export async function generateAudio(req: GenerationRequest): Promise<GenerationResult> {
    if (!HF_API_KEY) {
        throw new Error("HUGGINGFACE_API_KEY is not configured.");
    }

    const model = req.model || "facebook/musicgen-small";
    const res = await fetch(`${HF_API_URL}/${model}`, {
        method: "POST",
        headers: {
            Authorization: "Bearer " + HF_API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({inputs: req.prompt}),
    });

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

// ---------------------------------------------------------------------------
// Code Generation (OpenRouter – routed to best free model)
// ---------------------------------------------------------------------------

export async function generateCode(req: GenerationRequest): Promise<GenerationResult> {
    if (!OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    const model = req.model || "mistralai/devstral-small:free";
    const systemPrompt =
        `You are Lumi, an expert programmer for the Trezzhaus platform. ` +
        `Write clean, complete, well-commented ${req.language || "TypeScript"} code. ` +
        `Return ONLY the code, no markdown fences.`;

    const res = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: "Bearer " + OPENROUTER_API_KEY,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://trezzhaus.com",
            "X-Title": "Lumi \u2013 Trezzhaus AI",
        },
        body: JSON.stringify({
            model,
            messages: [
                {role: "system", content: systemPrompt},
                {role: "user", content: req.prompt},
            ],
        }),
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(`OpenRouter code generation failed (${res.status}): ${msg}`);
    }

    const json: any = await res.json();
    const text: string = json.choices?.[0]?.message?.content || "";

    return {
        type: "code",
        backend: "openrouter",
        model,
        text,
        prompt: req.prompt,
        createdAt: new Date().toISOString(),
    };
}

// ---------------------------------------------------------------------------
// Dispatch helper
// ---------------------------------------------------------------------------

export async function generate(req: GenerationRequest): Promise<GenerationResult> {
    switch (req.type) {
        case "image": return generateImage(req);
        case "video": return generateVideo(req);
        case "audio": return generateAudio(req);
        case "code":  return generateCode(req);
        default:
            throw new Error(`Unsupported generation type: ${req.type}`);
    }
}
