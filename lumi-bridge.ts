export type LumiRuntimeMode = "local" | "online" | "auto";
export type LumiProvider = "ollama" | "openrouter";

export interface LumiRuntimeSelection {
    mode: LumiRuntimeMode;
    provider: LumiProvider | "unavailable";
    available: boolean;
    fallbackUsed: boolean;
    reason?: string;
}

export interface LumiBridgeContract {
    name: string;
    version: string;
    repositories: {
        "lumi-memory-learning": {
            role: "master";
            repo: string;
            purpose: string;
        };
        "trezzworld-production-studio": {
            role: "studio";
            repo: string;
            purpose: string;
        };
    };
    endpoints: {
        chat: string;
        history: string;
        status: string;
        models: string;
        contract: string;
        creationBuild: string;
        creationPublish: string;
        creationDispatch: string;
    };
    providers: {
        local: {
            name: string;
            envVar: string;
            defaultModel: string;
        };
        online: {
            name: string;
            envVar: string;
            defaultModel: string;
        };
    };
    defaults: {
        runtimeMode: LumiRuntimeMode;
        defaultModel: string;
    };
}

export const LUMI_BRIDGE_CONTRACT: LumiBridgeContract = {
    name: "lumi-bridge",
    version: "1.0.0",
    repositories: {
        "lumi-memory-learning": {
            role: "master",
            repo: "Trezzhaused/lumi-memory-learning",
            purpose: "Shared runtime, bridge contract, and local/online orchestration for Lumi.",
        },
        "trezzworld-production-studio": {
            role: "studio",
            repo: "Trezzhaused/trezzworld-production-studio",
            purpose: "Studio-side consumer that can use Lumi's shared API contract and runtime hints.",
        },
    },
    endpoints: {
        chat: "/api/lumi/chat",
        history: "/api/lumi/chat/history",
        status: "/api/lumi/status",
        models: "/api/lumi/models",
        contract: "/api/lumi/bridge/contract",
        creationBuild: "/api/lumi/creation/build",
        creationPublish: "/api/lumi/creation/publish",
        creationDispatch: "/api/lumi/creation/dispatch",
    },
    providers: {
        local: {
            name: "Ollama",
            envVar: "OLLAMA_HOST",
            defaultModel: "mistral",
        },
        online: {
            name: "OpenRouter",
            envVar: "OPENROUTER_API_KEY",
            defaultModel: "mistralai/mistral-7b-instruct:free",
        },
    },
    defaults: {
        runtimeMode: "auto",
        defaultModel: "mistralai/mistral-7b-instruct:free",
    },
};

export function getBridgeContract(): LumiBridgeContract {
    return LUMI_BRIDGE_CONTRACT;
}

export function resolveRuntimeProvider(
    options: {
        useOllama?: boolean;
        mode?: LumiRuntimeMode | null;
        provider?: LumiProvider | null;
    },
    config: {
        ollamaHost?: string;
        openRouterApiKey?: string;
        defaultMode?: LumiRuntimeMode;
    }
): LumiRuntimeSelection {
    const normalizedMode = options.mode || config.defaultMode || "auto";
    const explicitProvider = options.provider;

    const hasOllama = Boolean(config.ollamaHost);
    const hasOpenRouter = Boolean(config.openRouterApiKey);

    if (explicitProvider === "ollama") {
        if (hasOllama) {
            return {mode: "local", provider: "ollama", available: true, fallbackUsed: false};
        }
        if (hasOpenRouter) {
            return {
                mode: "local",
                provider: "openrouter",
                available: true,
                fallbackUsed: true,
                reason: "Ollama was requested but is unavailable; using OpenRouter as a fallback.",
            };
        }
        return {mode: "local", provider: "unavailable", available: false, fallbackUsed: false, reason: "No local or online provider is configured."};
    }

    if (explicitProvider === "openrouter") {
        if (hasOpenRouter) {
            return {mode: "online", provider: "openrouter", available: true, fallbackUsed: false};
        }
        if (hasOllama) {
            return {
                mode: "online",
                provider: "ollama",
                available: true,
                fallbackUsed: true,
                reason: "OpenRouter was requested but is unavailable; using Ollama as a fallback.",
            };
        }
        return {mode: "online", provider: "unavailable", available: false, fallbackUsed: false, reason: "No local or online provider is configured."};
    }

    if (options.useOllama === true) {
        if (hasOllama) {
            return {mode: "local", provider: "ollama", available: true, fallbackUsed: false};
        }
        if (hasOpenRouter) {
            return {
                mode: "local",
                provider: "openrouter",
                available: true,
                fallbackUsed: true,
                reason: "Local mode was requested but is unavailable; using OpenRouter as a fallback.",
            };
        }
        return {mode: "local", provider: "unavailable", available: false, fallbackUsed: false, reason: "No local or online provider is configured."};
    }

    if (options.useOllama === false) {
        if (hasOpenRouter) {
            return {mode: "online", provider: "openrouter", available: true, fallbackUsed: false};
        }
        if (hasOllama) {
            return {
                mode: "online",
                provider: "ollama",
                available: true,
                fallbackUsed: true,
                reason: "Online mode was requested but is unavailable; using Ollama as a fallback.",
            };
        }
        return {mode: "online", provider: "unavailable", available: false, fallbackUsed: false, reason: "No local or online provider is configured."};
    }

    if (normalizedMode === "local") {
        if (hasOllama) {
            return {mode: "local", provider: "ollama", available: true, fallbackUsed: false};
        }
        if (hasOpenRouter) {
            return {
                mode: "local",
                provider: "openrouter",
                available: true,
                fallbackUsed: true,
                reason: "Local mode was requested but is unavailable; using OpenRouter as a fallback.",
            };
        }
        return {mode: "local", provider: "unavailable", available: false, fallbackUsed: false, reason: "No local or online provider is configured."};
    }

    if (normalizedMode === "online") {
        if (hasOpenRouter) {
            return {mode: "online", provider: "openrouter", available: true, fallbackUsed: false};
        }
        if (hasOllama) {
            return {
                mode: "online",
                provider: "ollama",
                available: true,
                fallbackUsed: true,
                reason: "Online mode was requested but is unavailable; using Ollama as a fallback.",
            };
        }
        return {mode: "online", provider: "unavailable", available: false, fallbackUsed: false, reason: "No local or online provider is configured."};
    }

    if (hasOllama) {
        return {mode: "auto", provider: "ollama", available: true, fallbackUsed: false};
    }

    if (hasOpenRouter) {
        return {mode: "auto", provider: "openrouter", available: true, fallbackUsed: false};
    }

    return {mode: "auto", provider: "unavailable", available: false, fallbackUsed: false, reason: "No local or online provider is configured."};
}
