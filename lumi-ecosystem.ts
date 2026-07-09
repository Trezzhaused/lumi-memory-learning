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
    return path.resolve(repoPath);
}

export async function bootstrapEcosystem(targets: EcosystemBootstrapTarget[]): Promise<EcosystemBootstrapResult> {
    const repos = [] as EcosystemRepoBootstrapResult[];
    for (const target of targets) {
        const repoPath = normalizeRepoPath(target.repoPath);
        const errors: string[] = [];
        if (!existsSync(repoPath)) {
            errors.push(`repo path does not exist: ${repoPath}`);
            repos.push({
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
            });
            continue;
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
        repos.push({repoPath, ready, launchReadiness, knowledgeSummary, assets, errors});
    }

    return {
        overallReady: repos.every(repo => repo.ready),
        repos,
    };
}
