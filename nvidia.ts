import {fetchWithRetry} from "./lumi-runtime";

type NvidiaMessage = { role: string; content: string };

export interface NvidiaChatOptions {
    apiKey?: string;
    apiBase?: string;
    model?: string;
}

export interface NvidiaVideoGenerationRequest {
    prompt: string;
    model?: string;
    imageBase64?: string;
    imageUrl?: string;
    imageMimeType?: string;
    width?: number;
    height?: number;
    duration?: number;
}

export interface NvidiaVideoGenerationResult {
    type: "video";
    backend: string;
    model: string;
    url?: string;
    data?: string;
    mimeType?: string;
    prompt: string;
    createdAt: string;
}

function normalizeNvidiaBase(apiBase?: string): string {
    const base = (apiBase || process.env.NVIDIA_API_BASE || process.env.NVIDIA_BASE_URL || "").trim();
    if (!base) throw new Error("NVIDIA_API_BASE is not configured.");
    const withoutTrailingSlash = base.endsWith("/") ? base.slice(0, -1) : base;
    return withoutTrailingSlash.endsWith("/v1") ? withoutTrailingSlash : `${withoutTrailingSlash}/v1`;
}

function buildNvidiaUrl(apiBase: string, path: string): string {
    const normalizedBase = normalizeNvidiaBase(apiBase);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
}

function extractTextContent(value: unknown): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
        return value.map(item => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && "text" in item && typeof (item as {text?: unknown}).text === "string") {
                return (item as {text: string}).text;
            }
            return "";
        }).join("");
    }
    if (value && typeof value === "object" && "text" in value && typeof (value as {text?: unknown}).text === "string") {
        return (value as {text: string}).text;
    }
    return "";
}

function validateApiCallbackUrl(url: string, allowedHosts: string[]): string {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error(`Invalid callback URL: "${url}"`);
    }
    const hostname = parsed.hostname.toLowerCase();
    const allowed = allowedHosts.some(host => hostname === host || hostname.endsWith(`.${host}`));
    if (!allowed) {
        throw new Error(`Callback URL host "${hostname}" is not in the allowed list`);
    }
    return url;
}

function extractCandidateUrl(value: unknown): string | undefined {
    if (typeof value === "string") {
        return value.startsWith("http://") || value.startsWith("https://") ? value : undefined;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const url = extractCandidateUrl(item);
            if (url) return url;
        }
        return undefined;
    }
    if (value && typeof value === "object") {
        const candidateKeys = ["url", "href", "video", "output", "data", "result", "content", "file", "files", "video_url", "output_url"];
        for (const key of candidateKeys) {
            if (key in value) {
                const url = extractCandidateUrl((value as Record<string, unknown>)[key]);
                if (url) return url;
            }
        }
    }
    return undefined;
}

function extractCandidateData(value: unknown): string | undefined {
    if (typeof value === "string") {
        return value.length > 200 ? value : undefined;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const data = extractCandidateData(item);
            if (data) return data;
        }
        return undefined;
    }
    if (value && typeof value === "object") {
        const candidateKeys = ["data", "content", "result", "output", "video", "file", "files"];
        for (const key of candidateKeys) {
            if (key in value) {
                const data = extractCandidateData((value as Record<string, unknown>)[key]);
                if (data) return data;
            }
        }
    }
    return undefined;
}

export async function callNvidiaChat(
    messages: NvidiaMessage[],
    model: string,
    options: NvidiaChatOptions = {},
): Promise<string> {
    const apiBase = options.apiBase || process.env.NVIDIA_API_BASE || process.env.NVIDIA_BASE_URL || "";
    const apiKey = options.apiKey || process.env.NVIDIA_API_KEY || "";
    const url = buildNvidiaUrl(apiBase, "/chat/completions");
    const headers: Record<string, string> = {"Content-Type": "application/json"};
    if (apiKey) headers.Authorization = "Bearer " + apiKey;

    const response = await fetchWithRetry(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
            model: options.model || model || process.env.NVIDIA_CHAT_MODEL || "",
            messages: messages.map(message => ({role: message.role, content: message.content})),
            stream: false,
            temperature: 0,
            seed: 42,
        }),
    }, {provider: "nvidia", retries: 2, timeoutMs: 20_000});

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`NVIDIA chat failed (${response.status}): ${text}`);
    }

    const json: any = await response.json();
    const choice = json.choices?.[0];
    return extractTextContent(choice?.message?.content);
}

export async function callNvidiaVideoGeneration(
    req: NvidiaVideoGenerationRequest,
    options: NvidiaChatOptions = {},
): Promise<NvidiaVideoGenerationResult> {
    const apiBase = options.apiBase || process.env.NVIDIA_API_BASE || process.env.NVIDIA_BASE_URL || "";
    const apiKey = options.apiKey || process.env.NVIDIA_API_KEY || "";
    const model = req.model || process.env.NVIDIA_VIDEO_MODEL || process.env.NVIDIA_CHAT_MODEL || "";
    const headers: Record<string, string> = {"Content-Type": "application/json"};
    if (apiKey) headers.Authorization = "Bearer " + apiKey;

    const payload: Record<string, any> = {
        model,
        prompt: req.prompt,
        width: req.width,
        height: req.height,
        duration: req.duration,
    };
    if (req.imageBase64) payload.image = req.imageBase64;
    if (req.imageUrl) payload.image_url = req.imageUrl;
    if (req.imageMimeType) payload.image_mime_type = req.imageMimeType;

    const endpoint = process.env.NVIDIA_VIDEO_PATH || "/video/generations";
    const url = buildNvidiaUrl(apiBase, endpoint);
    const response = await fetchWithRetry(url, {method: "POST", headers, body: JSON.stringify(payload)}, {provider: "nvidia", retries: 2, timeoutMs: 20_000});

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`NVIDIA video generation failed (${response.status}): ${text}`);
    }

    const json: any = await response.json();
    const maybeUrl = extractCandidateUrl(json);
    if (maybeUrl) {
        const allowedHosts = (process.env.NVIDIA_ALLOWED_HOSTS || "nvidia.com,localhost,127.0.0.1")
            .split(",")
            .map(host => host.trim().toLowerCase())
            .filter(Boolean);
        const url = validateApiCallbackUrl(maybeUrl, allowedHosts);
        return {
            type: "video",
            backend: "nvidia",
            model,
            url,
            prompt: req.prompt,
            createdAt: new Date().toISOString(),
        };
    }

    const rawData = extractCandidateData(json);
    if (rawData) {
        return {
            type: "video",
            backend: "nvidia",
            model,
            data: rawData,
            mimeType: json.mime_type || json.mimeType || "video/mp4",
            prompt: req.prompt,
            createdAt: new Date().toISOString(),
        };
    }

    throw new Error(`NVIDIA video generation returned an unsupported payload: ${JSON.stringify(json)}`);
}
