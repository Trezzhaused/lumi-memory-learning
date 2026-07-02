type OpenRouterMessage = { role: string; content: string };

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

export async function callOpenRouterChat(
    messages: OpenRouterMessage[],
    model: string,
    options: {apiKey?: string; httpReferer?: string; appTitle?: string; appCategories?: string} = {},
): Promise<string> {
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

    const result = await client.chat.send({
        ...clientOptions,
        chatRequest: {
            model,
            messages: messages.map(message => ({
                role: message.role as "user" | "assistant" | "system" | "developer" | "tool",
                content: message.content,
            })) as any,
            stream: false,
            temperature: 0,
            seed: 42,
        },
    });

    const choice = result.choices?.[0];
    return extractTextContent(choice?.message?.content);
}
