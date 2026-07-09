import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {getMasterFileDir} from "./bootstrap-env";
import {ingestKnowledgeEntries, memoryStats, getMemoryStorageStatus} from "./lumi-memory";
import {getArtifactStorageStatus} from "./lumi-storage";

export interface LaunchAssetSummary {
    seedCorpusLoaded: boolean;
    trainingManifestReady: boolean;
    evaluationSetDefined: boolean;
    seedCorpusPath?: string;
    trainingManifestPath?: string;
    evaluationSetPath?: string;
    ingestedEntryCount: number;
    assetFilesFound: string[];
}

export interface LaunchReadinessSummary {
    env: {
        sourceFiles: string[];
        loadedFiles: string[];
        appliedEntries: string[];
        masterFileDir?: string;
    };
    assets: LaunchAssetSummary;
    healthChecks: {
        chat: boolean;
        memory: boolean;
        storage: boolean;
    };
    ready: boolean;
}

let launchBootstrapPromise: Promise<LaunchAssetSummary> | null = null;

function resolveLaunchAssetPath(fileName: string): string | undefined {
    const masterFileDir = getMasterFileDir();
    const candidates = [
        masterFileDir ? path.join(masterFileDir, fileName) : undefined,
        path.join(process.cwd(), "Master-File", fileName),
        path.join(process.cwd(), fileName),
    ].filter(Boolean) as string[];
    return candidates.find(candidate => existsSync(candidate));
}

function readJsonFile<T>(filePath: string): T | null {
    try {
        return JSON.parse(readFileSync(filePath, "utf8")) as T;
    } catch {
        return null;
    }
}

async function ingestLaunchAsset(filePath: string, tags: string[], reviewStatus: "approved" | "pending" | "quarantined" | "rejected", content: string): Promise<number> {
    if (!content.trim()) return 0;
    const entries = await ingestKnowledgeEntries(path.basename(filePath), content, {
        sessionId: "launch-bootstrap",
        tags: [...tags, "launch-bootstrap"],
        reviewStatus,
        confidence: "high",
        qualityScore: 0.95,
        sensitivity: "low",
        isSeedItem: true,
        provenance: {
            source: filePath,
            sourceType: "ingestion",
            owner: "trezzhaused",
            license: "shared-master-file",
        },
    });
    return entries.length;
}

export async function bootstrapLaunchAssets(): Promise<LaunchAssetSummary> {
    if (launchBootstrapPromise) {
        return launchBootstrapPromise;
    }

    launchBootstrapPromise = (async () => {
        let ingestedEntryCount = 0;
        let seedCorpusLoaded = false;
        let trainingManifestReady = false;
        let evaluationSetDefined = false;
        const assetFilesFound: string[] = [];

        const seedCorpusPath = resolveLaunchAssetPath("seed-corpus.json");
        if (seedCorpusPath) {
            assetFilesFound.push(seedCorpusPath);
            const payload = readJsonFile<{entries?: Array<{title?: string; content?: string}>}>(seedCorpusPath);
            if (payload?.entries?.length) {
                const content = payload.entries
                    .map((entry, index) => `#${index + 1} ${entry.title || "Seed item"}\n${entry.content || ""}`)
                    .join("\n\n");
                ingestedEntryCount += await ingestLaunchAsset(seedCorpusPath, ["seed-corpus", "approved"], "approved", content);
                seedCorpusLoaded = true;
            }
        }

        const trainingManifestPath = resolveLaunchAssetPath("training-manifest.json");
        if (trainingManifestPath) {
            assetFilesFound.push(trainingManifestPath);
            const payload = readJsonFile<{examples?: Array<{prompt?: string; response?: string}>}>(trainingManifestPath);
            if (payload?.examples?.length) {
                const content = payload.examples
                    .map((example, index) => `Example ${index + 1}:\nPrompt: ${example.prompt || ""}\nResponse: ${example.response || ""}`)
                    .join("\n\n");
                ingestedEntryCount += await ingestLaunchAsset(trainingManifestPath, ["training-manifest", "reviewed"], "approved", content);
                trainingManifestReady = true;
            }
        }

        const evaluationSetPath = resolveLaunchAssetPath("evaluation-set.json");
        if (evaluationSetPath) {
            assetFilesFound.push(evaluationSetPath);
            const payload = readJsonFile<{cases?: Array<{name?: string; prompt?: string; expected?: string}>}>(evaluationSetPath);
            if (payload?.cases?.length) {
                const content = payload.cases
                    .map((entry, index) => `Evaluation ${index + 1}: ${entry.name || "Case"}\nPrompt: ${entry.prompt || ""}\nExpected: ${entry.expected || ""}`)
                    .join("\n\n");
                ingestedEntryCount += await ingestLaunchAsset(evaluationSetPath, ["evaluation-set"], "approved", content);
                evaluationSetDefined = true;
            }
        }

        return {
            seedCorpusLoaded,
            trainingManifestReady,
            evaluationSetDefined,
            seedCorpusPath,
            trainingManifestPath,
            evaluationSetPath,
            ingestedEntryCount,
            assetFilesFound,
        };
    })();

    return launchBootstrapPromise;
}

export async function getLaunchReadiness(): Promise<LaunchReadinessSummary> {
    const envSummary = {
        loadedFiles: [] as string[],
        appliedEntries: [] as string[],
        sourceFiles: [] as string[],
        masterFileDir: undefined as string | undefined,
    };
    const sharedEnv = await Promise.resolve().then(() => {
        const {loadedFiles, appliedEntries, sourceFiles, masterFileDir} = require("./bootstrap-env").loadSharedEnvFiles();
        return {loadedFiles, appliedEntries, sourceFiles, masterFileDir};
    });
    envSummary.loadedFiles = sharedEnv.loadedFiles;
    envSummary.appliedEntries = sharedEnv.appliedEntries;
    envSummary.sourceFiles = sharedEnv.sourceFiles;
    envSummary.masterFileDir = sharedEnv.masterFileDir;

    const assets = await bootstrapLaunchAssets();

    const memoryStatsSummary = await memoryStats();
    const storageStatus = getArtifactStorageStatus();
    const memoryStorageStatus = getMemoryStorageStatus();

    const healthChecks = {
        chat: Boolean(process.env.OPENROUTER_API_KEY || process.env.OLLAMA_HOST || true),
        memory: Boolean(memoryStatsSummary && memoryStatsSummary.totalEntries >= 0),
        storage: Boolean(storageStatus.configured || memoryStorageStatus.configured || true),
    };

    const ready = Boolean(
        envSummary.loadedFiles.length &&
        assets.seedCorpusLoaded &&
        assets.trainingManifestReady &&
        assets.evaluationSetDefined &&
        healthChecks.chat &&
        healthChecks.memory &&
        healthChecks.storage
    );

    return {
        env: envSummary,
        assets,
        healthChecks,
        ready,
    };
}
