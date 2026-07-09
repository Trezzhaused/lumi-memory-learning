import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {getMasterFileDir, loadSharedEnvFiles} from "./bootstrap-env";
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

const launchBootstrapPromises = new Map<string, Promise<LaunchAssetSummary>>();

function normalizeLaunchCwd(cwd: string = process.cwd()): string {
    return path.resolve(cwd);
}

function resolveLaunchAssetPath(fileName: string, cwd: string = process.cwd()): string | undefined {
    const normalizedCwd = normalizeLaunchCwd(cwd);
    const masterFileDir = getMasterFileDir(normalizedCwd);
    const candidates = [
        masterFileDir ? path.join(masterFileDir, fileName) : undefined,
        path.join(normalizedCwd, "Master-File", fileName),
        path.join(normalizedCwd, fileName),
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

async function checkOllamaAvailability(): Promise<{available: boolean; host: string; modelCount: number}> {
    const ollamaHost = process.env.OLLAMA_HOST || "";
    if (!ollamaHost) {
        return {available: false, host: "", modelCount: 0};
    }
    try {
        const response = await fetch(`${ollamaHost}/api/tags`);
        if (!response.ok) return {available: false, host: ollamaHost, modelCount: 0};
        const payload = await response.json() as {models?: Array<{name: string}>};
        return {available: true, host: ollamaHost, modelCount: payload.models?.length || 0};
    } catch {
        return {available: false, host: ollamaHost, modelCount: 0};
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

export async function bootstrapLaunchAssets(cwd: string = process.cwd()): Promise<LaunchAssetSummary> {
    const normalizedCwd = normalizeLaunchCwd(cwd);
    const existingPromise = launchBootstrapPromises.get(normalizedCwd);
    if (existingPromise) {
        return existingPromise;
    }

    const bootstrapPromise = (async () => {
        let ingestedEntryCount = 0;
        let seedCorpusLoaded = false;
        let trainingManifestReady = false;
        let evaluationSetDefined = false;
        const assetFilesFound: string[] = [];

        const seedCorpusPath = resolveLaunchAssetPath("seed-corpus.json", normalizedCwd);
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

        const trainingManifestPath = resolveLaunchAssetPath("training-manifest.json", normalizedCwd);
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

        const evaluationSetPath = resolveLaunchAssetPath("evaluation-set.json", normalizedCwd);
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

    launchBootstrapPromises.set(normalizedCwd, bootstrapPromise);
    return bootstrapPromise;
}

export async function getLaunchReadiness(cwd: string = process.cwd()): Promise<LaunchReadinessSummary> {
    const envSummary = {
        loadedFiles: [] as string[],
        appliedEntries: [] as string[],
        sourceFiles: [] as string[],
        masterFileDir: undefined as string | undefined,
    };
    const sharedEnv = await Promise.resolve().then(() => {
        const {loadedFiles, appliedEntries, sourceFiles, masterFileDir} = loadSharedEnvFiles(cwd);
        return {loadedFiles, appliedEntries, sourceFiles, masterFileDir};
    });
    envSummary.loadedFiles = sharedEnv.loadedFiles;
    envSummary.appliedEntries = sharedEnv.appliedEntries;
    envSummary.sourceFiles = sharedEnv.sourceFiles;
    envSummary.masterFileDir = sharedEnv.masterFileDir;

    const assets = await bootstrapLaunchAssets(cwd);

    const memoryStatsSummary = await memoryStats();
    const storageStatus = getArtifactStorageStatus();
    const memoryStorageStatus = getMemoryStorageStatus();
    const ollamaHealth = await checkOllamaAvailability();

    const healthChecks = {
        chat: Boolean(process.env.OPENROUTER_API_KEY || ollamaHealth.available),
        memory: Boolean(memoryStatsSummary && memoryStatsSummary.totalEntries >= 0 && memoryStorageStatus.backend),
        storage: Boolean(storageStatus.configured || memoryStorageStatus.configured || Boolean(process.env.DATA_DIR)),
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
