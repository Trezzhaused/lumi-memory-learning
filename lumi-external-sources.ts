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

export const DEFAULT_EXTERNAL_BROWSER_SOURCE_ID = "yuanbao";

const DEFAULT_EXTERNAL_SOURCES: ExternalBrowserSource[] = [
    {
        id: DEFAULT_EXTERNAL_BROWSER_SOURCE_ID,
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

function normalizeExternalSourceId(sourceId: unknown): string {
    return typeof sourceId === "string" ? sourceId.trim().toLowerCase() : "";
}

function normalizeExternalSourceIds(sourceIds: unknown): string[] {
    const sourceValues = typeof sourceIds === "string"
        ? [sourceIds]
        : Array.isArray(sourceIds)
            ? sourceIds
            : [];

    return Array.from(new Set(
        sourceValues
            .map(sourceId => normalizeExternalSourceId(sourceId))
            .filter(Boolean)
    ));
}

function getSourceIdForError(sourceId: unknown): string {
    const normalizedSourceId = normalizeExternalSourceId(sourceId);
    return normalizedSourceId || (typeof sourceId === "string" ? sourceId : "");
}

function isKnownExternalSource(sourceId: unknown): boolean {
    const normalizedSourceId = normalizeExternalSourceId(sourceId);
    return DEFAULT_EXTERNAL_SOURCES.some(source => source.id === normalizedSourceId);
}

function hasExplicitExternalSourceSelection(requestedSources: unknown): boolean {
    if (requestedSources === undefined || requestedSources === null) return false;
    if (typeof requestedSources === "string") return requestedSources.trim() !== "";
    if (Array.isArray(requestedSources)) return requestedSources.some(sourceId => {
        if (typeof sourceId === "string") return sourceId.trim() !== "";
        return sourceId !== undefined && sourceId !== null;
    });
    return false;
}

function getKnownRequestedSources(requestedSources: unknown): string[] {
    return normalizeExternalSourceIds(requestedSources).filter(sourceId => isKnownExternalSource(sourceId));
}

function selectExternalSources(requestedSources: unknown): ExternalBrowserSource[] {
    const hasExplicitSelection = hasExplicitExternalSourceSelection(requestedSources);
    const knownRequestedSources = getKnownRequestedSources(requestedSources);

    if (!hasExplicitSelection) {
        return getExternalBrowserSources();
    }

    if (!knownRequestedSources.length) {
        return [];
    }

    return getExternalBrowserSources().filter(source => knownRequestedSources.includes(source.id));
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
    const normalizedSourceId = normalizeExternalSourceId(sourceId);
    if (!normalizedSourceId || !isKnownExternalSource(normalizedSourceId)) {
        return {
            sourceId: getSourceIdForError(sourceId),
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
            sourceId: normalizedSourceId,
            query,
            goal: options.goal,
            sessionMode: options.sessionMode,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        return {
            sourceId: normalizedSourceId,
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
            sourceId: normalizedSourceId,
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
        sourceId: normalizedSourceId,
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

export function buildExternalBrowserSourceContext(requestedSources: unknown = []): string | null {
    const selectedSources = selectExternalSources(requestedSources);

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
    requestedSources: unknown = [],
    options: {goal?: string; sessionMode?: string} = {}
): ExternalBrowserSourcePlan {
    const normalizedRequestedSources = getKnownRequestedSources(requestedSources);
    const sources = selectExternalSources(requestedSources);

    const automationConfigured = isAutomationConfigured();
    const workflowNote = automationConfigured
        ? "The configured browser automation layer is available, so these sources can be treated as active workflow inputs."
        : "No browser automation endpoint is configured yet; the workflow should treat these sources as manual or future-backed research steps.";

    return {
        requestedSources: normalizedRequestedSources.length ? normalizedRequestedSources : sources.map(source => source.id),
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
