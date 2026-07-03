/**
 * Recursively extract and normalize a value from a selector-like payload.
 * Aliases are treated case-insensitively and may be present in strings, arrays,
 * or nested objects so the selector can be supplied in a variety of shapes.
 */
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
    const aliasLookup = new Map(
        Object.entries(record).map(([key, nestedValue]) => [key.toLowerCase(), nestedValue])
    );

    for (const alias of aliases) {
        const candidate = aliasLookup.get(alias.toLowerCase());
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
