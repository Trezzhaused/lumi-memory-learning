export interface ExternalBrowserSource {
    id: string;
    name: string;
    url: string;
    category: "research" | "chat" | "search";
    requiresBrowserAutomation: boolean;
    backend: "api" | "browser-automation" | "manual";
    availability: "ready" | "pending";
    notes: string;
    sessionHint: string;
}

export interface ExternalBrowserSourcePlan {
    requestedSources: string[];
    sources: ExternalBrowserSource[];
    automationConfigured: boolean;
    workflowNote: string;
    nextSteps: string[];
}

export interface ExternalBrowserSourceQueryResult {
    sourceId: string;
    ok: boolean;
    status: number;
    usedBackend: "proxy" | "manual";
    content?: string;
    error?: string;
}

const DEFAULT_EXTERNAL_SOURCES: ExternalBrowserSource[] = [
    {
        id: "yuanbao",
        name: "Yuanbao (Tencent)",
        url: "https://www.yuanbao.tencent.com",
        category: "chat",
        requiresBrowserAutomation: true,
        backend: "browser-automation",
        availability: "pending",
        notes: "A browser-based AI assistant surface that can be used for alternate ideation, research, and creative exploration.",
        sessionHint: "Prefer a fresh anonymous or non-persisted browser session and reinitialize between runs if continuity is limited.",
    },
];

function isKnownExternalSource(sourceId: string): boolean {
    return DEFAULT_EXTERNAL_SOURCES.some(source => source.id === sourceId);
}

function isAutomationConfigured(): boolean {
    return Boolean(
        process.env.EXTERNAL_BROWSER_PROXY_URL ||
        process.env.EXTERNAL_BROWSER_API_URL ||
        process.env.EXTERNAL_BROWSER_API_KEY
    );
}

function getAutomationEndpoint(): string | null {
    const raw = process.env.EXTERNAL_BROWSER_PROXY_URL || process.env.EXTERNAL_BROWSER_API_URL || "";
    if (!raw) return null;
    try {
        const parsed = new URL(raw);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported protocol");
        return parsed.toString();
    } catch {
        return null;
    }
}

export async function queryExternalBrowserSource(
    sourceId: string,
    query: string,
    options: {goal?: string; sessionMode?: string} = {}
): Promise<ExternalBrowserSourceQueryResult> {
    const normalizedSourceId = typeof sourceId === "string" ? sourceId.trim() : "";
    if (!normalizedSourceId || !isKnownExternalSource(normalizedSourceId)) {
        return {
            sourceId: normalizedSourceId || (typeof sourceId === "string" ? sourceId : ""),
            ok: false,
            status: 404,
            usedBackend: "manual",
            error: `Unknown external browser source: ${normalizedSourceId || "<empty>"}`,
        };
    }

    const endpoint = getAutomationEndpoint();
    if (!endpoint) {
        return {
            sourceId: normalizedSourceId,
            ok: false,
            status: 503,
            usedBackend: "manual",
            error: "No browser automation endpoint is configured. Set EXTERNAL_BROWSER_PROXY_URL or EXTERNAL_BROWSER_API_URL.",
        };
    }

    const headers: Record<string, string> = {"Content-Type": "application/json"};
    const apiKey = process.env.EXTERNAL_BROWSER_API_KEY;
    if (apiKey) headers.Authorization = "Bearer " + apiKey;

    const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
            sourceId,
            query,
            goal: options.goal,
            sessionMode: options.sessionMode,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        return {
            sourceId,
            ok: false,
            status: response.status,
            usedBackend: "proxy",
            error: errorText || `Automation request failed with status ${response.status}`,
        };
    }

    let payload: any;
    try {
        payload = await response.json();
    } catch (error) {
        return {
            sourceId,
            ok: false,
            status: response.status,
            usedBackend: "proxy",
            error: `Automation response was not valid JSON: ${error instanceof Error ? error.message : "unknown error"}`,
        };
    }

    const content = typeof payload?.content === "string"
        ? payload.content
        : typeof payload?.text === "string"
            ? payload.text
            : typeof payload?.result === "string"
                ? payload.result
                : "";

    return {
        sourceId,
        ok: true,
        status: response.status,
        usedBackend: "proxy",
        content: content || undefined,
    };
}

export function getExternalBrowserSources(): ExternalBrowserSource[] {
    const automationConfigured = isAutomationConfigured();
    return DEFAULT_EXTERNAL_SOURCES.map(source => ({
        ...source,
        availability: automationConfigured ? "ready" : source.availability,
    }));
}

export function buildExternalBrowserSourceContext(requestedSources: string[] = []): string | null {
    const selectedSources = getExternalBrowserSources().filter(source => {
        if (!requestedSources.length) return true;
        return requestedSources.includes(source.id);
    });

    if (!selectedSources.length) return null;

    const sourceLines = selectedSources.map(source => {
        const backendLabel = source.backend === "browser-automation"
            ? "browser automation"
            : source.backend === "api"
                ? "API"
                : "manual browser workflow";
        return `- ${source.name} (${source.url}) — ${backendLabel}; ${source.notes}`;
    }).join("\n");

    return [
        "External browser-based source workflow:",
        sourceLines,
        "When a request references these sources, treat them as supplemental research or ideation tools. If automation is not configured, note the source as a manual browser step rather than an integrated API call.",
    ].join("\n");
}

export function planExternalBrowserSources(
    requestedSources: string[] = [],
    options: {goal?: string; sessionMode?: string} = {}
): ExternalBrowserSourcePlan {
    const sources = getExternalBrowserSources().filter(source => {
        if (!requestedSources.length) return true;
        return requestedSources.includes(source.id);
    });

    const automationConfigured = isAutomationConfigured();
    const workflowNote = automationConfigured
        ? "The configured browser automation layer is available, so these sources can be treated as active workflow inputs."
        : "No browser automation endpoint is configured yet; the workflow should treat these sources as manual or future-backed research steps.";

    return {
        requestedSources: requestedSources.length ? requestedSources : sources.map(source => source.id),
        sources,
        automationConfigured,
        workflowNote,
        nextSteps: [
            options.goal ? `Frame the task around: ${options.goal}` : "Frame the task clearly before using an external source.",
            automationConfigured
                ? "Use the configured browser automation hook for live retrieval and synthesis."
                : "Add EXTERNAL_BROWSER_PROXY_URL or EXTERNAL_BROWSER_API_URL to enable live browser-backed retrieval.",
            options.sessionMode === "anonymous"
                ? "Open the source from an anonymous or fresh session and reset it between runs if the provider enforces session limits."
                : "If the source is rate-limited, reinitialize from a fresh anonymous or non-persisted session between runs.",
        ],
    };
}
