import fs from "node:fs";
import path from "node:path";

export interface ProviderIssue {
    category: "missing_credentials" | "invalid_config" | "provider_unavailable" | "timeout" | "backend_error" | "unknown";
    provider: string;
    message: string;
    detail?: string;
    retryable: boolean;
}

export interface LoadedEnvironmentFile {
    path: string;
    entries: string[];
}

export interface RuntimeEnvironmentSummary {
    environment: string;
    ready: boolean;
    missingRequirements: string[];
    warnings: string[];
    bridge: {
        enabled: boolean;
        configured: boolean;
        mode: string;
    };
    storage: {
        backend: "local" | "r2";
        configured: boolean;
        reason: string;
    };
    providers: {
        openrouter: {configured: boolean; label: string};
        ollama: {configured: boolean; label: string};
        huggingface: {configured: boolean; label: string};
        fal: {configured: boolean; label: string};
        replicate: {configured: boolean; label: string};
        roblox: {configured: boolean; label: string};
        externalBrowser: {configured: boolean; label: string};
    };
    publicChat: {
        enabled: boolean;
    };
}

export interface RuntimeValidationResult {
    summary: RuntimeEnvironmentSummary;
    shouldExit: boolean;
}

function toBoolean(value: string | undefined): boolean {
    return value === "true";
}

function parseEnvValue(rawValue: string): string {
    const trimmed = rawValue.trim();
    if (!trimmed) return "";
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed.replace(/\s+#.*$/, "").trim();
}

function parseEnvFile(filePath: string): Record<string, string> {
    const contents = fs.readFileSync(filePath, "utf8");
    const entries: Record<string, string> = {};

    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        const normalizedLine = line.replace(/^export\s+/, "");
        const separatorIndex = normalizedLine.indexOf("=");
        if (separatorIndex === -1) continue;

        const key = normalizedLine.slice(0, separatorIndex).trim();
        const rawValue = normalizedLine.slice(separatorIndex + 1).trim();
        if (!key) continue;

        entries[key] = parseEnvValue(rawValue);
    }

    return entries;
}

export function loadEnvironmentFiles(baseDir: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): LoadedEnvironmentFile[] {
    const userProvidedKeys = new Set(Object.keys(env));
    const environment = (env.NODE_ENV || "development").toLowerCase();
    const fileNames = [".env", ".env.local"];

    if (environment === "production") {
        fileNames.push(".env.production", ".env.production.local");
    } else {
        fileNames.push(".env.development", ".env.development.local");
    }

    const loadedFiles: LoadedEnvironmentFile[] = [];
    for (const fileName of fileNames) {
        const filePath = path.join(baseDir, fileName);
        if (!fs.existsSync(filePath)) continue;

        const entries = parseEnvFile(filePath);
        for (const [key, value] of Object.entries(entries)) {
            if (!userProvidedKeys.has(key)) {
                env[key] = value;
            }
        }

        loadedFiles.push({
            path: filePath,
            entries: Object.keys(entries),
        });
    }

    return loadedFiles;
}

loadEnvironmentFiles(process.cwd(), process.env);

export function buildRuntimeConfigurationSummary(env: NodeJS.ProcessEnv = process.env): RuntimeEnvironmentSummary {
    const environment = (env.NODE_ENV || "development").toLowerCase();
    const isProduction = environment === "production";
    const localToolExecution = toBoolean(env.LUMI_ALLOW_LOCAL_TOOL_EXECUTION) || (isProduction && !env.LUMI_ALLOW_LOCAL_TOOL_EXECUTION);
    const cloudToolRequests = toBoolean(env.LUMI_ALLOW_CLOUD_TOOL_REQUESTS);
    const bridgeEnabled = localToolExecution || cloudToolRequests;
    const missingRequirements: string[] = [];
    const warnings: string[] = [];

    if (bridgeEnabled && !env.LUMI_BRIDGE_SECRET?.trim()) {
        missingRequirements.push("LUMI_BRIDGE_SECRET");
    }
    if (!bridgeEnabled) {
        warnings.push("Bridge execution is disabled; set LUMI_ALLOW_LOCAL_TOOL_EXECUTION=true and LUMI_BRIDGE_SECRET for secure owner-side actions.");
    }

    const openrouterConfigured = Boolean(env.OPENROUTER_API_KEY?.trim());
    const ollamaConfigured = Boolean(env.OLLAMA_HOST?.trim() && env.OLLAMA_HOST !== "http://127.0.0.1:11434");
    const huggingfaceConfigured = Boolean(env.HUGGINGFACE_API_KEY?.trim());
    const falConfigured = Boolean(env.FAL_KEY?.trim());
    const replicateConfigured = Boolean(env.REPLICATE_API_KEY?.trim());
    const robloxConfigured = Boolean(env.ROBLOX_API_KEY?.trim() && env.ROBLOX_UNIVERSE_ID?.trim() && env.ROBLOX_PLACE_ID?.trim());
    const externalBrowserConfigured = Boolean(env.EXTERNAL_BROWSER_PROXY_URL?.trim() || env.EXTERNAL_BROWSER_API_URL?.trim());

    if (!openrouterConfigured && !ollamaConfigured) {
        warnings.push("No chat provider API is configured; Lumi will use its built-in fallback path.");
    }
    if (!huggingfaceConfigured && !falConfigured && !replicateConfigured) {
        warnings.push("No media generation provider is configured; image/video/audio features will remain unavailable until credentials are added.");
    }
    if (!robloxConfigured) {
        warnings.push("Roblox publishing credentials are not configured; publishing stays disabled.");
    }
    if (!externalBrowserConfigured) {
        warnings.push("No external browser automation endpoint is configured; browser-based research stays workflow-only.");
    }

    const r2Configured = Boolean(
        env.CLOUDFLARE_R2_ACCOUNT_ID?.trim()
        && env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim()
        && env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim()
        && env.CLOUDFLARE_R2_BUCKET?.trim(),
    );
    const storage = r2Configured
        ? {backend: "r2" as const, configured: true, reason: "R2 credentials are configured."}
        : {backend: "local" as const, configured: false, reason: "R2 credentials are missing; local filesystem storage will be used."};

    return {
        environment,
        ready: missingRequirements.length === 0,
        missingRequirements,
        warnings,
        bridge: {
            enabled: bridgeEnabled,
            configured: Boolean(env.LUMI_BRIDGE_SECRET?.trim()),
            mode: bridgeEnabled ? "secure-bridge" : "disabled",
        },
        storage,
        providers: {
            openrouter: {configured: openrouterConfigured, label: openrouterConfigured ? "configured" : "missing"},
            ollama: {configured: ollamaConfigured, label: ollamaConfigured ? "configured" : "missing"},
            huggingface: {configured: huggingfaceConfigured, label: huggingfaceConfigured ? "configured" : "missing"},
            fal: {configured: falConfigured, label: falConfigured ? "configured" : "missing"},
            replicate: {configured: replicateConfigured, label: replicateConfigured ? "configured" : "missing"},
            roblox: {configured: robloxConfigured, label: robloxConfigured ? "configured" : "missing"},
            externalBrowser: {configured: externalBrowserConfigured, label: externalBrowserConfigured ? "configured" : "missing"},
        },
        publicChat: {enabled: true},
    };
}

export function validateRuntimeConfiguration(env: NodeJS.ProcessEnv = process.env): RuntimeValidationResult {
    const summary = buildRuntimeConfigurationSummary(env);
    const failFast = env.LUMI_FAIL_FAST === "true" || (env.NODE_ENV || "development").toLowerCase() === "production";
    return {
        summary,
        shouldExit: failFast && summary.missingRequirements.length > 0,
    };
}

export function formatRuntimeSummary(summary: RuntimeEnvironmentSummary): string {
    const providerSummary = [
        `openrouter=${summary.providers.openrouter.label}`,
        `ollama=${summary.providers.ollama.label}`,
        `huggingface=${summary.providers.huggingface.label}`,
        `fal=${summary.providers.fal.label}`,
        `replicate=${summary.providers.replicate.label}`,
        `roblox=${summary.providers.roblox.label}`,
        `browser=${summary.providers.externalBrowser.label}`,
    ].join(", ");

    const lines = [
        `environment=${summary.environment}`,
        `ready=${summary.ready ? "yes" : "no"}`,
        `bridge=${summary.bridge.enabled ? (summary.bridge.configured ? "enabled" : "missing-secret") : "disabled"}`,
        `storage=${summary.storage.backend}`,
        `providers=${providerSummary}`,
    ];

    if (summary.missingRequirements.length) {
        lines.push(`missing=${summary.missingRequirements.join(", ")}`);
    }
    if (summary.warnings.length) {
        lines.push(`warnings=${summary.warnings.join(" | ")}`);
    }

    return lines.join("\n");
}

function normalizeMessage(value: unknown): string {
    if (value instanceof Error) return value.message;
    if (typeof value === "string") return value;
    if (typeof value === "object" && value && "message" in value && typeof (value as {message?: unknown}).message === "string") {
        return (value as {message: string}).message;
    }
    return "Unknown provider failure";
}

export function classifyProviderError(error: unknown, provider: string): ProviderIssue {
    const message = normalizeMessage(error).toLowerCase();
    if (message.includes("not configured") || message.includes("missing") || message.includes("api key")) {
        return {category: "missing_credentials", provider, message: "Provider is not configured.", detail: normalizeMessage(error), retryable: false};
    }
    if (message.includes("invalid") || message.includes("bad request") || message.includes("model") && message.includes("not found")) {
        return {category: "invalid_config", provider, message: "Provider configuration is invalid.", detail: normalizeMessage(error), retryable: false};
    }
    if (message.includes("timeout") || message.includes("timed out")) {
        return {category: "timeout", provider, message: "Provider request timed out.", detail: normalizeMessage(error), retryable: true};
    }
    if (message.includes("fetch") || message.includes("network") || message.includes("unreachable") || message.includes("econnrefused")) {
        return {category: "provider_unavailable", provider, message: "Provider is temporarily unavailable.", detail: normalizeMessage(error), retryable: true};
    }
    return {category: "backend_error", provider, message: "Provider returned an upstream error.", detail: normalizeMessage(error), retryable: true};
}

export function formatProviderError(error: unknown, provider: string): string {
    const issue = classifyProviderError(error, provider);
    const detail = issue.detail ? ` (${issue.detail})` : "";
    return `[${provider}] ${issue.message}${detail}`;
}

export async function withRetry<T>(operation: () => Promise<T>, options: {provider: string; retries?: number; timeoutMs?: number} = {provider: "provider"}): Promise<T> {
    const retries = options.retries ?? 2;
    const timeoutMs = options.timeoutMs ?? 20_000;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await runWithTimeout(operation, timeoutMs);
        } catch (error) {
            lastError = error;
            const issue = classifyProviderError(error, options.provider);
            if (attempt >= retries || !issue.retryable) {
                throw new Error(formatProviderError(error, options.provider));
            }
            await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        }
    }

    throw lastError instanceof Error ? lastError : new Error(formatProviderError(lastError, options.provider));
}

async function runWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
        timer.unref?.();
    });

    return Promise.race([operation(), timeout]);
}

export async function fetchWithRetry(input: string | URL | Request, init?: RequestInit, options: {provider: string; retries?: number; timeoutMs?: number} = {provider: "provider"}): Promise<Response> {
    const retries = options.retries ?? 2;
    const timeoutMs = options.timeoutMs ?? 20_000;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const response = await runWithTimeout(() => fetch(input, init), timeoutMs);
            if (response.ok || response.status < 500) {
                return response;
            }
            const body = await response.text();
            throw new Error(`HTTP ${response.status}: ${body || response.statusText}`);
        } catch (error) {
            lastError = error;
            const issue = classifyProviderError(error, options.provider);
            if (attempt >= retries || !issue.retryable) {
                throw new Error(formatProviderError(error, options.provider));
            }
            await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        }
    }

    throw lastError instanceof Error ? lastError : new Error(formatProviderError(lastError, options.provider));
}
