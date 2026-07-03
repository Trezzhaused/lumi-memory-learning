export function extractNormalizedSelectorValue(value: unknown, aliases: string[]): string {
    // Recursively extract and normalize a selector value from strings, arrays, or nested objects.
    if (typeof value === "string") {
        return value.trim().toLowerCase();
    }

    if (Array.isArray(value)) {
        for (const entry of value) {
            const normalized = extractNormalizedSelectorValue(entry, aliases);
            if (normalized) return normalized;
        }
        return "";
    }

    if (!value || typeof value !== "object") {
        return "";
    }

    const record = value as Record<string, unknown>;
    for (const alias of aliases) {
        const candidate = record[alias];
        if (typeof candidate === "string") {
            const normalized = candidate.trim().toLowerCase();
            if (normalized) return normalized;
        }
    }

    for (const nestedValue of Object.values(record)) {
        if (nestedValue && typeof nestedValue === "object") {
            const normalized = extractNormalizedSelectorValue(nestedValue, aliases);
            if (normalized) return normalized;
        }
    }

    return "";
}
