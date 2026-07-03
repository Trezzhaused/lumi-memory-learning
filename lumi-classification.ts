export interface ClassificationRequest {
    text: string;
    labels?: string[] | string | null;
    model?: string;
}

export interface ClassificationResult {
    ok: boolean;
    model: string;
    labels: string[];
    probabilities: Record<string, number>;
    source: "huggingface" | "heuristic-fallback";
    error?: string;
}

function normalizeLabel(label: string): string {
    return label.trim().toLowerCase();
}

function normalizeProbabilities(rawProbabilities: Record<string, number>): Record<string, number> {
    const entries = Object.entries(rawProbabilities)
        .filter(([, score]) => Number.isFinite(score))
        .map(([label, score]) => [label, Math.max(0, score)] as const);

    if (!entries.length) {
        return {};
    }

    const total = entries.reduce((sum, [, score]) => sum + score, 0);
    if (!total) {
        return Object.fromEntries(entries.map(([label]) => [label, 0]));
    }

    return Object.fromEntries(entries.map(([label, score]) => [label, score / total]));
}

function normalizeLabels(labels: unknown): string[] {
    const rawValues = typeof labels === "string"
        ? [labels]
        : Array.isArray(labels)
            ? labels
            : [];

    return Array.from(new Set(
        rawValues
            .map(label => typeof label === "string" ? label.trim() : "")
            .filter(Boolean)
    ));
}

function buildHeuristicFallback(text: string, requestedLabels: string[]): ClassificationResult {
    const labels = requestedLabels.length ? requestedLabels : ["positive", "negative", "neutral"];
    const normalizedText = text.toLowerCase();
    const positiveWords = ["good", "great", "love", "excellent", "happy", "amazing", "awesome", "nice", "fantastic", "delight", "support"];
    const negativeWords = ["bad", "hate", "terrible", "awful", "sad", "broken", "issue", "problem", "fail", "poor", "worse", "worst"];
    const positiveScore = positiveWords.reduce((count, word) => count + (normalizedText.includes(word) ? 1 : 0), 0);
    const negativeScore = negativeWords.reduce((count, word) => count + (normalizedText.includes(word) ? 1 : 0), 0);

    const probabilities: Record<string, number> = {};
    const baseLabels = labels.map(label => normalizeLabel(label));
    const scoreByLabel = new Map<string, number>();

    for (const label of baseLabels) {
        if (label.includes("pos")) {
            scoreByLabel.set(label, positiveScore + 0.2);
        } else if (label.includes("neg")) {
            scoreByLabel.set(label, negativeScore + 0.2);
        } else if (label.includes("neutral") || label.includes("unknown")) {
            scoreByLabel.set(label, 0.2);
        } else {
            scoreByLabel.set(label, 0.1);
        }
    }

    const values = Array.from(scoreByLabel.values());
    const maxScore = Math.max(...values, 1);
    for (const label of baseLabels) {
        probabilities[label] = scoreByLabel.get(label)! / maxScore;
    }

    const labelsOrdered = Object.entries(probabilities)
        .sort((a, b) => b[1] - a[1])
        .map(([label]) => label);

    return {
        ok: true,
        model: process.env.HUGGINGFACE_CLASSIFICATION_MODEL || "heuristic-fallback",
        labels: labelsOrdered,
        probabilities: normalizeProbabilities(probabilities),
        source: "heuristic-fallback",
    };
}

function normalizeHuggingFaceResult(payload: unknown, requestedLabels: string[]): ClassificationResult {
    const entries = Array.isArray(payload) ? payload : [];
    const scoredEntries = entries.filter((entry): entry is {label?: string; score?: number} => Boolean(entry) && typeof entry === "object");
    const probabilities = Object.fromEntries(
        scoredEntries
            .map(entry => [normalizeLabel(entry.label || ""), Number(entry.score || 0)])
            .filter(([label]) => Boolean(label))
    );

    const normalizedProbabilities = normalizeProbabilities(probabilities);
    const labels = Object.entries(normalizedProbabilities)
        .sort((a, b) => b[1] - a[1])
        .map(([label]) => label);

    for (const requestedLabel of requestedLabels) {
        const normalizedRequestedLabel = normalizeLabel(requestedLabel);
        if (!normalizedRequestedLabel) continue;
        if (normalizedProbabilities[normalizedRequestedLabel] === undefined) {
            normalizedProbabilities[normalizedRequestedLabel] = 0;
        }
    }

    return {
        ok: true,
        model: process.env.HUGGINGFACE_CLASSIFICATION_MODEL || "huggingface",
        labels: labels.length ? labels : requestedLabels.map(normalizeLabel),
        probabilities: normalizeProbabilities(normalizedProbabilities),
        source: "huggingface",
    };
}

export async function classifyText(request: ClassificationRequest): Promise<ClassificationResult> {
    const text = (request.text || "").trim();
    if (!text) {
        return {
            ok: false,
            model: "",
            labels: [],
            probabilities: {},
            source: "heuristic-fallback",
            error: "Text input is required for classification.",
        };
    }

    const requestedLabels = normalizeLabels(request.labels);
    const model = request.model || process.env.HUGGINGFACE_CLASSIFICATION_MODEL || "distilbert-base-uncased-finetuned-sms-spam-detection";
    const apiKey = process.env.HUGGINGFACE_API_KEY || "";

    if (!apiKey) {
        return buildHeuristicFallback(text, requestedLabels);
    }

    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
            method: "POST",
            headers: {
                Authorization: "Bearer " + apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({inputs: text}),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                ok: false,
                model,
                labels: requestedLabels.map(normalizeLabel),
                probabilities: {},
                source: "heuristic-fallback",
                error: `Hugging Face classification failed: ${response.status} ${errorText}`
            };
        }

        const payload = await response.json();
        return normalizeHuggingFaceResult(payload, requestedLabels);
    } catch (error) {
        return {
            ok: false,
            model,
            labels: requestedLabels.map(normalizeLabel),
            probabilities: {},
            source: "heuristic-fallback",
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
