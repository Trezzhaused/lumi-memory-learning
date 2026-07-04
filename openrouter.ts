import {withRetry} from "./lumi-runtime";

type OpenRouterMessage = { role: string; content: string; reasoningDetails?: unknown[]; reasoning_details?: unknown[] };

export interface OpenRouterReasoningConfig {
    effort?: "low" | "medium" | "high" | "max" | "minimal" | "none" | "xhigh";
    summary?: "auto" | "concise" | "detailed";
}

export interface OpenRouterChatResult {
    text: string;
    reasoning?: string | null;
    reasoningDetails?: Array<unknown>;
}

function extractTextContent(value: unknown): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
        return value
            .map(item => {
                if (typeof item === "string") return item;
                if (item && typeof item === "object" && "text" in item && typeof (item as {text?: unknown}).text === "string") {
                    return (item as {text: string}).text;
                }
                return "";
            })
            .join("");
    }
    if (value && typeof value === "object" && "text" in value && typeof (value as {text?: unknown}).text === "string") {
        return (value as {text: string}).text;
    }
    return "";
}

function normalizeReasoningConfig(reasoning?: boolean | OpenRouterReasoningConfig): OpenRouterReasoningConfig | undefined {
    if (!reasoning) return undefined;
    if (reasoning === true) return {effort: "medium"};
    return reasoning;
}

function extractReasoningDetails(message: OpenRouterMessage): unknown[] | undefined {
    const details = message.reasoningDetails ?? message.reasoning_details;
    return Array.isArray(details) ? details : undefined;
}

function extractResponseReasoningDetails(responseMessage: any): unknown[] | undefined {
    const details = responseMessage?.reasoning_details ?? responseMessage?.reasoningDetails;
    return Array.isArray(details) ? details : undefined;
}

export async function callOpenRouterChat(
    messages: OpenRouterMessage[],
    model: string,
    options: {apiKey?: string; httpReferer?: string; appTitle?: string; appCategories?: string; reasoning?: boolean | OpenRouterReasoningConfig} = {},
): Promise<string> {
    return (await callOpenRouterChatDetailed(messages, model, options)).text;
}

export async function callOpenRouterChatDetailed(
    messages: OpenRouterMessage[],
    model: string,
    options: {apiKey?: string; httpReferer?: string; appTitle?: string; appCategories?: string; reasoning?: boolean | OpenRouterReasoningConfig} = {},
): Promise<OpenRouterChatResult> {
    const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY || "";
    if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    const {OpenRouter} = await import("@openrouter/sdk");
    const clientOptions = {
        apiKey,
        httpReferer: options.httpReferer || "https://trezzhaus.com",
        appTitle: options.appTitle || "Lumi — Trezzhaus AI",
        appCategories: options.appCategories || "cli-agent,cloud-agent",
    };
    const client = new OpenRouter(clientOptions);
    const reasoning = normalizeReasoningConfig(options.reasoning);

    const result = await withRetry(async () => client.chat.send({
        ...clientOptions,
        chatRequest: {
            model,
            messages: messages.map(message => {
                const reasoningDetails = extractReasoningDetails(message);
                return {
                    role: message.role as "user" | "assistant" | "system" | "developer" | "tool",
                    content: message.content,
                    ...(reasoningDetails ? {reasoning_details: reasoningDetails} : {}),
                };
            }) as any,
            stream: false,
            temperature: 0,
            seed: 42,
            ...(reasoning ? {reasoning} : {}),
        },
    }), {provider: "openrouter", retries: 2, timeoutMs: 20_000});

    const choice = result.choices?.[0];
    const responseMessage = choice?.message;
    return {
        text: extractTextContent(responseMessage?.content),
        reasoning: typeof responseMessage?.reasoning === "string" ? responseMessage.reasoning : null,
        reasoningDetails: extractResponseReasoningDetails(responseMessage),
    };
}
