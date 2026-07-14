import {existsSync} from "node:fs";
import path from "node:path";
import {bootstrapLaunchAssets, getLaunchReadiness} from "./lumi-launch";
import {ingestRepositoryKnowledge} from "./lumi-memory";

export interface EcosystemBootstrapTarget {
    repoPath: string;
    includePaths?: string[];
    sessionId?: string;
    tags?: string[];
}

export interface EcosystemRepoBootstrapResult {
    repoPath: string;
    ready: boolean;
    launchReadiness: Awaited<ReturnType<typeof getLaunchReadiness>>;
    knowledgeSummary: Awaited<ReturnType<typeof ingestRepositoryKnowledge>>;
    assets: Awaited<ReturnType<typeof bootstrapLaunchAssets>>;
    errors: string[];
}

export interface EcosystemBootstrapResult {
    overallReady: boolean;
    repos: EcosystemRepoBootstrapResult[];
}

function normalizeRepoPath(repoPath: string): string {
    if (!repoPath || repoPath.includes("\0")) {
        throw new Error("repo path is required");
    }
    const workspaceRoot = path.resolve(process.cwd(), "..");
    const normalizedEntry = repoPath.replace(/\\/g, "/").trim();
    if (!normalizedEntry) {
        throw new Error("repo path is required");
    }
    const isAbsolute = path.isAbsolute(normalizedEntry);
    const resolved = isAbsolute
        ? path.resolve(normalizedEntry)
        : path.resolve(process.cwd(), ...normalizedEntry.split("/").filter(segment => segment !== "." && segment !== ""));
    const relativeToWorkspace = path.relative(workspaceRoot, resolved);
    if (relativeToWorkspace.startsWith("..") || path.isAbsolute(relativeToWorkspace)) {
        throw new Error("repo path must stay within the workspace root");
    }
    if (!isAbsolute && normalizedEntry.split("/").some(segment => segment === ".." || segment === "")) {
        throw new Error("repo path must not contain traversal segments");
    }
    return resolved;
}

async function bootstrapSingleRepo(target: EcosystemBootstrapTarget): Promise<EcosystemRepoBootstrapResult> {
    const repoPath = normalizeRepoPath(target.repoPath);
    const errors: string[] = [];
    if (!existsSync(repoPath)) {
        errors.push(`repo path does not exist: ${repoPath}`);
        return {
            repoPath,
            ready: false,
            launchReadiness: {
                env: {loadedFiles: [], appliedEntries: [], sourceFiles: [], masterFileDir: undefined},
                assets: {
                    seedCorpusLoaded: false,
                    trainingManifestReady: false,
                    evaluationSetDefined: false,
                    ingestedEntryCount: 0,
                    assetFilesFound: [],
                },
                healthChecks: {chat: false, memory: false, storage: false},
                ready: false,
            },
            knowledgeSummary: {
                rootDir: repoPath,
                includedPaths: target.includePaths || [],
                scannedFiles: [],
                ingestedFiles: [],
                skippedFiles: [],
                totalChunks: 0,
                totalEntries: 0,
                sessionId: target.sessionId || `ecosystem:${path.basename(repoPath)}`,
            },
            assets: {
                seedCorpusLoaded: false,
                trainingManifestReady: false,
                evaluationSetDefined: false,
                ingestedEntryCount: 0,
                assetFilesFound: [],
            },
            errors,
        };
    }

    const launchReadiness = await getLaunchReadiness(repoPath);
    const assets = await bootstrapLaunchAssets(repoPath);
    const knowledgeSummary = await ingestRepositoryKnowledge({
        rootDir: repoPath,
        includePaths: target.includePaths,
        sessionId: target.sessionId || `ecosystem:${path.basename(repoPath)}`,
        tags: [...(target.tags || []), "ecosystem-bootstrap", "shared-runtime"],
        reviewStatus: "approved",
        confidence: "high",
        sensitivity: "low",
        qualityScore: 0.9,
        isSeedItem: true,
    });

    const ready = Boolean(launchReadiness.ready && assets.seedCorpusLoaded && assets.trainingManifestReady && assets.evaluationSetDefined && knowledgeSummary.totalEntries > 0);
    return {repoPath, ready, launchReadiness, knowledgeSummary, assets, errors};
}

export async function bootstrapEcosystem(targets: EcosystemBootstrapTarget[]): Promise<EcosystemBootstrapResult> {
    const concurrencyLimit = Number(process.env.LUMI_ECOSYSTEM_CONCURRENCY || "4");
    const safeConcurrency = Number.isFinite(concurrencyLimit) && concurrencyLimit > 0 ? Math.floor(concurrencyLimit) : 4;
    const repos: EcosystemRepoBootstrapResult[] = [];

    for (let index = 0; index < targets.length; index += safeConcurrency) {
        const batch = targets.slice(index, index + safeConcurrency);
        const batchResults = await Promise.all(batch.map(target => bootstrapSingleRepo(target)));
        repos.push(...batchResults);
    }

    return {
        overallReady: repos.every(repo => repo.ready),
        repos,
    };
}
