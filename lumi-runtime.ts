export interface ProviderIssue {
    category: "missing_credentials" | "invalid_config" | "provider_unavailable" | "timeout" | "backend_error" | "unknown";
    provider: string;
    message: string;
    detail?: string;
    retryable: boolean;
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
