/**
 * Recursively extract and normalize a value from a selector-like payload.
 * Aliases are treated case-insensitively and may be present in strings, arrays,
 * or nested objects so the selector can be supplied in a variety of shapes.
 */
function normalizeSelectorKey(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normalizeSelectorStringValue(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const withoutFragment = trimmed.split("?")[0].split("#")[0] || trimmed;
    let cleaned = withoutFragment.trim();
    if (cleaned.startsWith("https://")) {
        cleaned = cleaned.slice(8);
    } else if (cleaned.startsWith("http://")) {
        cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith("www.")) {
        cleaned = cleaned.slice(4);
    }
    while (cleaned.endsWith("/")) {
        cleaned = cleaned.slice(0, -1);
    }
    const normalized = cleaned.toLowerCase();
    if (!normalized) return "";

    if (normalized.startsWith("github:")) return normalized;
    if (normalized.startsWith("huggingface:")) return normalized;

    const parts = normalized.split("/").filter(Boolean);
    if (parts[0] === "github.com" && parts[1] && parts[2]) {
        return `github:${parts[1]}/${parts[2]}`;
    }

    if (parts[0] === "huggingface.co" && parts[1] && parts[2]) {
        return `huggingface:${parts[1]}/${parts[2]}`;
    }

    if (parts.length === 2 && !parts[0].includes(".") && !parts[1].includes(".")) {
        return `${parts[0]}/${parts[1]}`;
    }

    return normalized;
}

function normalizeSelectorCandidate(candidate: unknown, aliases: string[]): string {
    if (typeof candidate === "string") {
        return normalizeSelectorStringValue(candidate);
    }

    if (typeof candidate === "number" || typeof candidate === "boolean") {
        return String(candidate).trim().toLowerCase();
    }

    if (Array.isArray(candidate)) {
        for (const entry of candidate) {
            const normalized = normalizeSelectorCandidate(entry, aliases);
            if (normalized) return normalized;
        }
        return "";
    }

    if (!candidate || typeof candidate !== "object") {
        return "";
    }

    const record = candidate as Record<string, unknown>;
    const aliasLookup = new Map(
        Object.entries(record).map(([key, nestedValue]) => [normalizeSelectorKey(key), nestedValue])
    );

    for (const alias of aliases) {
        const nestedCandidate = aliasLookup.get(normalizeSelectorKey(alias));
        const normalized = normalizeSelectorCandidate(nestedCandidate, aliases);
        if (normalized) return normalized;
    }

    for (const nestedValue of Object.values(record)) {
        const normalized = normalizeSelectorCandidate(nestedValue, aliases);
        if (normalized) return normalized;
    }

    return "";
}

export function extractNormalizedSelectorValue(value: unknown, aliases: string[]): string {
    return normalizeSelectorCandidate(value, aliases);
}
