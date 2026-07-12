/**
 * Lumi Memory System
 *
 * Persistent memory and learning layer for Lumi.
 * Types are aligned with TrezzWorld Production Studio (lumi/Memory.ts)
 * so knowledge objects are structurally compatible.
 *
 * Storage backends (priority order):
 *   1. GitHub Gists  – free, version-controlled cloud storage.
 *   2. In-process Map – fallback when no GitHub token is configured.
 *
 * Extended vs. Studio baseline:
 *   - Adds `role`, `sessionId`, `tags`, `expiresAt` for chat-history use.
 *   - Retains Studio's `type` field: 'goal'|'task'|'context'|'knowledge'|'artifact'.
 */

import {GetObjectCommand, PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {Octokit} from "@octokit/core";
import {randomUUID} from "node:crypto";
import {promises as fs} from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types (superset of Studio lumi/Memory.ts)
// ---------------------------------------------------------------------------

/** Studio-compatible entry types */
export type MemoryType = "goal" | "task" | "context" | "knowledge" | "artifact";
export type MemoryReviewStatus = "approved" | "pending" | "quarantined" | "rejected";
export type MemoryConfidence = "high" | "medium" | "low";
export type MemorySensitivity = "low" | "medium" | "high";

export interface MemoryProvenance {
    source?: string;
    sourceType?: "manual" | "chat" | "ingestion" | "mission";
    sourceId?: string;
    owner?: string;
    license?: string;
    importedAt?: string;
}

export interface MemoryEntry {
    id: string;
    /** Studio-compatible type tag */
    type: MemoryType;
    /** Conversation role for chat entries */
    role: "user" | "assistant" | "system";
    /** Session that owns this entry */
    sessionId: string;
    /** Arbitrary key (mirrors Studio Memory.key) */
    key: string;
    /** The stored value (for chat entries this is the message text) */
    content: string;
    value?: unknown;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
    provenance?: MemoryProvenance;
    reviewStatus?: MemoryReviewStatus;
    confidence?: MemoryConfidence;
    sensitivity?: MemorySensitivity;
    qualityScore?: number;
    lastReviewedAt?: string;
    reviewedBy?: string;
    score?: number;
    effectiveConfidence?: MemoryConfidence;
    quarantineReason?: string;
    seedItem?: boolean;
}

/** Studio-compatible snapshot */
export interface MemorySnapshot {
    entries: MemoryEntry[];
    createdAt: string;
    updatedAt: string;
}

export interface MemoryStorageStatus {
    backend: "r2" | "github-gists" | "in-memory";
    configured: boolean;
    bucket?: string;
    key?: string;
}

export interface MemoryWriteOptions {
    tags?: string[];
    type?: MemoryType;
    ttlMs?: number;
    provenance?: MemoryProvenance;
    reviewStatus?: MemoryReviewStatus;
    confidence?: MemoryConfidence;
    sensitivity?: MemorySensitivity;
    qualityScore?: number;
    reviewedBy?: string;
    isSeedItem?: boolean;
}

export interface MemorySearchOptions {
    includeQuarantined?: boolean;
    minConfidence?: MemoryConfidence;
    tags?: string[];
    maxSensitivity?: MemorySensitivity;
    includeSensitive?: boolean;
}

export interface MemoryRecallOptions {
    tags?: string[];
    maxSensitivity?: MemorySensitivity;
    includeSensitive?: boolean;
    includeQuarantined?: boolean;
}

export interface MemoryAuditEvent {
    id: string;
    type: string;
    severity: "info" | "warning" | "critical";
    summary: string;
    detail?: string;
    sessionId?: string;
    createdAt: string;
}

export interface RetrievalTelemetryEvent {
    id: string;
    query: string;
    outcome: "useful" | "not-useful" | "uncertain";
    confidence?: MemoryConfidence;
    resultCount: number;
    entryIds: string[];
    createdAt: string;
    seedItemHits: number;
}

export interface MemoryObservabilitySnapshot {
    memory: {
        totalEntries: number;
        activeSessions: number;
        byType: Record<MemoryType, number>;
        quarantined: number;
        pendingReview: number;
        storageBackend: string;
        updatedAt: string;
        seedItems: number;
        sensitiveEntries: number;
    };
    telemetry: {
        totalRetrievals: number;
        usefulRetrievals: number;
        uncertainRetrievals: number;
        lowConfidenceRetrievals: number;
        seedItemHits: number;
    };
    evaluation: {
        generatedAt: string;
        retrievalUsefulness: number;
        quarantineRate: number;
        seedItemHitRate: number;
        reviewBacklog: number;
        totalEntries: number;
        quarantined: number;
        pendingReview: number;
        totalRetrievals: number;
        usefulRetrievals: number;
        uncertainRetrievals: number;
        lowConfidenceRetrievals: number;
        seedItemHits: number;
    };
    audit: MemoryAuditEvent[];
}

export interface AdaptiveLearningEvaluationSummary {
    generatedAt: string;
    retrievalUsefulness: number;
    quarantineRate: number;
    seedItemHitRate: number;
    reviewBacklog: number;
    totalEntries: number;
    quarantined: number;
    pendingReview: number;
    totalRetrievals: number;
    usefulRetrievals: number;
    uncertainRetrievals: number;
    lowConfidenceRetrievals: number;
    seedItemHits: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GIST_DESCRIPTION = "Lumi Memory – Trezzhaus AI";
const GIST_FILENAME = "lumi-memory.json";
const R2_MEMORY_KEY = process.env.CLOUDFLARE_R2_MEMORY_KEY || "lumi/memory/lumi-memory.json";
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || "";
// Keep empty-query matches visible enough to still sort by quality when no search terms are provided.
const EMPTY_QUERY_SCORE = 0.2;
// Only keep candidates whose relevance score is above this threshold.
const MATCH_THRESHOLD = 0.2;
// Baseline relevance for a match before weighting exact/overlapping terms and entry quality.
const BASE_MATCH_SCORE = 0.35;
// Weight for partial keyword overlap versus exact phrase matches.
const OVERLAP_WEIGHT = 0.5;
const EXACT_MATCH_WEIGHT = 0.15;
// Let higher-quality and seed-calibrated items rank above weaker matches.
const QUALITY_WEIGHT = 0.2;
const SEED_ITEM_BOOST = 0.08;
const MAX_KNOWLEDGE_FILE_BYTES = 200 * 1024;
const MAX_INGESTED_FILES_PER_REQUEST = 200;
const MAX_AUDIT_TRAIL_SIZE = 200;
const TEXT_FILE_EXTENSIONS = new Set([".md", ".txt", ".json", ".jsonl", ".yaml", ".yml", ".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".py", ".csv", ".xml", ".ini", ".toml", ".env.example"]);
const DEFAULT_IGNORED_DIRS = new Set(["node_modules", ".git", ".data", "dist", "coverage", "build"]);
const DEFAULT_IGNORED_FILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "Cargo.lock"]);

let gistId: string | null = null;

const githubToken = process.env.GITHUB_API_TOKEN || "";
const memOctokit = githubToken ? new Octokit({auth: githubToken}) : null;

// In-process fallback store
const localStore: MemorySnapshot = {entries: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
const auditTrail: MemoryAuditEvent[] = [];
const retrievalTelemetry: RetrievalTelemetryEvent[] = [];

export interface RepositoryKnowledgeIngestionResult {
    rootDir: string;
    includedPaths: string[];
    scannedFiles: string[];
    ingestedFiles: string[];
    skippedFiles: string[];
    totalChunks: number;
    totalEntries: number;
    sessionId: string;
}

function isTextFileCandidate(filePath: string): boolean {
    const normalizedPath = filePath.toLowerCase();
    const basename = path.basename(normalizedPath);
    if (basename.startsWith(".env")) return false;
    if (DEFAULT_IGNORED_FILES.has(basename)) return false;
    const extension = path.extname(normalizedPath);
    if (!extension) return false;
    return TEXT_FILE_EXTENSIONS.has(extension);
}

function resolveKnowledgePath(rootDir: string, entry: string): string | null {
    if (!entry || entry.includes("\0")) return null;
    const normalizedRoot = path.resolve(rootDir || process.cwd());
    const normalizedEntry = entry.replace(/\\/g, "/").trim();
    if (!normalizedEntry || normalizedEntry === "." || normalizedEntry === "./") return normalizedRoot;
    if (normalizedEntry.startsWith("/")) return null;
    const segments = normalizedEntry.split("/").filter(segment => segment && segment !== ".");
    if (segments.some(segment => segment === ".." || segment === "")) return null;
    const candidate = path.resolve(normalizedRoot, ...segments);
    const relativePath = path.relative(normalizedRoot, candidate);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;
    return candidate;
}

function isWithinRoot(rootDir: string, candidatePath: string): boolean {
    const normalizedRoot = path.resolve(rootDir || process.cwd());
    const normalizedCandidate = path.resolve(candidatePath);
    const relativePath = path.relative(normalizedRoot, normalizedCandidate);
    return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function toRelativeKnowledgePath(rootDir: string, filePath: string): string {
    return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function getRequestedKnowledgePaths(rootDir: string, includePaths?: string[]): string[] {
    const normalizedRoot = path.resolve(rootDir || process.cwd());
    const rawPaths = includePaths && includePaths.length > 0
        ? includePaths
        : (process.env.LUMI_KNOWLEDGE_PATHS || ".")
            .split(",")
            .map(entry => entry.trim())
            .filter(Boolean);

    return rawPaths.map(entry => {
        const resolved = resolveKnowledgePath(normalizedRoot, entry);
        if (!resolved) return entry;
        const relative = path.relative(normalizedRoot, resolved);
        return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative.split(path.sep).join("/") : ".";
    });
}

async function collectKnowledgeFiles(rootDir: string, includePaths: string[] = []): Promise<string[]> {
    const normalizedRoot = path.resolve(rootDir || process.cwd());
    const requestedPaths = getRequestedKnowledgePaths(normalizedRoot, includePaths);

    const discovered = new Set<string>();
    for (const entry of requestedPaths) {
        const candidate = resolveKnowledgePath(normalizedRoot, entry);
        if (!candidate || !isWithinRoot(normalizedRoot, candidate)) continue;
        try {
            const safeCandidate = path.resolve(candidate);
            const stats = await fs.stat(safeCandidate);
            if (stats.isDirectory()) {
                const stack = [safeCandidate];
                while (stack.length > 0) {
                    const currentDir = path.resolve(stack.pop()!);
                    if (!isWithinRoot(normalizedRoot, currentDir)) continue;
                    const items = await fs.readdir(currentDir, {withFileTypes: true});
                    for (const item of items) {
                        const fullPath = path.resolve(currentDir, item.name);
                        const relativePath = path.relative(normalizedRoot, fullPath);
                        const segments = relativePath.split(path.sep);
                        if (segments.some(segment => DEFAULT_IGNORED_DIRS.has(segment))) continue;
                        if (item.isDirectory()) {
                            stack.push(fullPath);
                        } else if (item.isFile() && isTextFileCandidate(fullPath)) {
                            discovered.add(fullPath);
                        }
                    }
                }
            } else if (stats.isFile() && isTextFileCandidate(safeCandidate)) {
                discovered.add(safeCandidate);
            }
        } catch {
            // Skip inaccessible/absent paths.
        }
    }
    return Array.from(discovered).sort();
}

function buildKnowledgeContent(filePath: string, rootDir: string, content: string): string {
    const relativePath = toRelativeKnowledgePath(rootDir, filePath);
    return `Source file: ${relativePath}\n\n${content}`;
}

function getR2Config(): {client?: S3Client; bucket?: string} {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
        return {};
    }
    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const client = new S3Client({
        region: "auto",
        endpoint,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    });
    return {client, bucket: R2_BUCKET};
}

export function getMemoryStorageStatus(): MemoryStorageStatus {
    const {client, bucket} = getR2Config();
    if (client && bucket) {
        return {backend: "r2", configured: true, bucket, key: R2_MEMORY_KEY};
    }
    return {
        backend: memOctokit ? "github-gists" : "in-memory",
        configured: !!memOctokit,
        bucket: bucket || undefined,
        key: R2_MEMORY_KEY,
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
    return `mem_${randomUUID().replace(/-/g, "")}`;
}

function isExpired(entry: MemoryEntry): boolean {
    if (!entry.expiresAt) return false;
    return new Date(entry.expiresAt) < new Date();
}

function buildDefaultProvenance(options: MemoryWriteOptions | undefined): MemoryProvenance | undefined {
    if (!options?.provenance && !options?.reviewedBy) return undefined;
    return {
        ...options?.provenance,
        importedAt: options?.provenance?.importedAt || new Date().toISOString(),
    };
}

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

function buildEntryTags(baseTags: string[], seedItem: boolean): string[] {
    const extraTags = seedItem ? ["seed-item"] : [];
    return Array.from(new Set([...baseTags, ...extraTags]));
}

function chunkText(value: string, chunkSize = 400): string[] {
    const normalized = normalizeWhitespace(value);
    if (!normalized) return [];
    const paragraphs = normalized
        .split(/\n+/)
        .map(part => part.trim())
        .filter(Boolean);

    const chunks: string[] = [];
    let current = "";
    for (const paragraph of paragraphs) {
        if (!current) {
            current = paragraph;
            continue;
        }
        if ((current + " " + paragraph).length <= chunkSize) {
            current = `${current} ${paragraph}`;
        } else {
            chunks.push(current);
            current = paragraph;
        }
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [normalized.slice(0, chunkSize)];
}

function computeMatchScore(query: string, entry: MemoryEntry): number {
    const q = normalizeWhitespace(query).toLowerCase();
    // Return a small neutral score for empty queries so the caller can still rank by quality
    // after the normal relevance calculation instead of dropping all results.
    if (!q) return EMPTY_QUERY_SCORE;
    const content = entry.content.toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const matchedTerms = terms.filter(term => content.includes(term)).length;
    const overlap = terms.length > 0 ? matchedTerms / terms.length : 0;
    const exact = content.includes(q) ? 1 : 0;
    const base = BASE_MATCH_SCORE + overlap * OVERLAP_WEIGHT + exact * EXACT_MATCH_WEIGHT;
    const qualityBoost = (entry.qualityScore || 0.6) * QUALITY_WEIGHT;
    const seedBoost = entry.seedItem ? SEED_ITEM_BOOST : 0;
    return Math.min(1, base + qualityBoost + seedBoost);
}

function deriveEffectiveConfidence(entry: MemoryEntry): MemoryConfidence {
    if (entry.reviewStatus === "quarantined") return "low";
    if (entry.confidence) return entry.confidence;
    if ((entry.qualityScore || 0.6) >= 0.8) return "high";
    if ((entry.qualityScore || 0.6) >= 0.45) return "medium";
    return "low";
}

function meetsMinimumConfidence(entry: MemoryEntry, minConfidence?: MemoryConfidence): boolean {
    if (!minConfidence) return true;
    const confidenceOrder: MemoryConfidence[] = ["low", "medium", "high"];
    const entryConfidence = deriveEffectiveConfidence(entry);
    return confidenceOrder.indexOf(entryConfidence) >= confidenceOrder.indexOf(minConfidence);
}

function getSensitivityRank(value?: MemorySensitivity): number {
    switch (value) {
        case "medium": return 1;
        case "high": return 2;
        default: return 0;
    }
}

function shouldExposeEntry(entry: MemoryEntry, options: MemorySearchOptions | MemoryRecallOptions = {}): boolean {
    if (entry.reviewStatus === "quarantined" && !options.includeQuarantined) return false;
    const maxSensitivity = options.maxSensitivity ?? (options.includeSensitive ? "high" : "medium");
    const entrySensitivity = entry.sensitivity || "low";
    if (getSensitivityRank(entrySensitivity) > getSensitivityRank(maxSensitivity)) return false;
    return true;
}

function recordAuditEvent(type: string, summary: string, detail?: string, sessionId?: string, severity: MemoryAuditEvent["severity"] = "info"): void {
    auditTrail.push({
        id: generateId(),
        type,
        severity,
        summary,
        detail,
        sessionId,
        createdAt: new Date().toISOString(),
    });
    if (auditTrail.length > MAX_AUDIT_TRAIL_SIZE) {
        auditTrail.splice(0, auditTrail.length - MAX_AUDIT_TRAIL_SIZE);
    }
}

function recordRetrievalOutcome(query: string, outcome: RetrievalTelemetryEvent["outcome"], confidence: MemoryConfidence | undefined, resultCount: number, entryIds: string[], seedItemHits = 0): void {
    retrievalTelemetry.push({
        id: generateId(),
        query: query.slice(0, 180),
        outcome,
        confidence,
        resultCount,
        entryIds,
        createdAt: new Date().toISOString(),
        seedItemHits,
    });
    if (retrievalTelemetry.length > MAX_AUDIT_TRAIL_SIZE) {
        retrievalTelemetry.splice(0, retrievalTelemetry.length - MAX_AUDIT_TRAIL_SIZE);
    }
}

// ---------------------------------------------------------------------------
// GitHub Gist persistence
// ---------------------------------------------------------------------------

type S3BodyLike = {
    transformToByteArray?: () => Promise<Uint8Array>;
    transformToString?: () => Promise<string>;
};

async function loadFromR2(): Promise<MemorySnapshot | null> {
    const {client, bucket} = getR2Config();
    if (!client || !bucket) return null;
    try {
        const response = await client.send(new GetObjectCommand({Bucket: bucket, Key: R2_MEMORY_KEY}));
        const body = response.Body as S3BodyLike | undefined;
        const raw = body?.transformToString
            ? await body.transformToString()
            : undefined;
        if (!raw) return null;
        return JSON.parse(raw) as MemorySnapshot;
    } catch (error: any) {
        if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) return null;
        console.error("[LumiMemory] Failed to load from R2:", error);
        return null;
    }
}

async function saveToR2(snapshot: MemorySnapshot): Promise<void> {
    const {client, bucket} = getR2Config();
    if (!client || !bucket) return;
    const content = JSON.stringify(snapshot, null, 2);
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: R2_MEMORY_KEY,
        Body: Buffer.from(content, "utf8"),
        ContentType: "application/json",
    }));
}

async function loadFromGist(): Promise<MemorySnapshot> {
    if (!memOctokit) return localStore;
    try {
        if (!gistId) {
            const res = await memOctokit.request("GET /gists", {
                headers: {"X-GitHub-Api-Version": "2022-11-28"},
            });
            const existing = (res.data as any[]).find(
                (g: any) => g.description === GIST_DESCRIPTION
            );
            if (existing) gistId = existing.id;
        }
        if (gistId) {
            const res = await memOctokit.request("GET /gists/{gist_id}", {
                gist_id: gistId,
                headers: {"X-GitHub-Api-Version": "2022-11-28"},
            });
            const raw = (res.data as any).files?.[GIST_FILENAME]?.content;
            if (raw) return JSON.parse(raw) as MemorySnapshot;
        }
    } catch (err) {
        console.error("[LumiMemory] Failed to load from Gist:", err);
    }
    return {entries: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
}

async function saveToGist(snapshot: MemorySnapshot): Promise<void> {
    if (!memOctokit) return;
    const content = JSON.stringify(snapshot, null, 2);
    try {
        if (gistId) {
            await memOctokit.request("PATCH /gists/{gist_id}", {
                gist_id: gistId,
                files: {[GIST_FILENAME]: {content}},
                headers: {"X-GitHub-Api-Version": "2022-11-28"},
            });
        } else {
            const res = await memOctokit.request("POST /gists", {
                description: GIST_DESCRIPTION,
                public: false,
                files: {[GIST_FILENAME]: {content}},
                headers: {"X-GitHub-Api-Version": "2022-11-28"},
            });
            gistId = (res.data as any).id;
        }
    } catch (err) {
        console.error("[LumiMemory] Failed to save to Gist:", err);
    }
}

async function getStore(): Promise<MemorySnapshot> {
    const fromR2 = await loadFromR2();
    if (fromR2) return fromR2;
    return memOctokit ? loadFromGist() : localStore;
}

async function persistStore(snapshot: MemorySnapshot): Promise<void> {
    snapshot.updatedAt = new Date().toISOString();
    try {
        await saveToR2(snapshot);
        return;
    } catch (error) {
        console.warn("[LumiMemory] Failed to save to R2, trying gist fallback:", error);
    }
    if (memOctokit) {
        await saveToGist(snapshot);
    } else {
        localStore.entries = snapshot.entries;
        localStore.updatedAt = snapshot.updatedAt;
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Store a message/knowledge entry in memory.
 */
export async function remember(
    sessionId: string,
    role: MemoryEntry["role"],
    content: string,
    tags: string[] = [],
    type: MemoryType = "context",
    ttlMs?: number,
    options: MemoryWriteOptions = {}
): Promise<MemoryEntry> {
    const snapshot = await getStore();
    const now = new Date().toISOString();
    const requestedTags = Array.from(new Set([...(options.tags || tags)]));
    const seedItem = options.isSeedItem ?? requestedTags.includes("seed-item");
    const entry: MemoryEntry = {
        id: generateId(),
        type: options.type || type,
        role,
        sessionId,
        key: `${sessionId}:${role}:${now}`,
        content,
        tags: buildEntryTags(requestedTags, seedItem),
        createdAt: now,
        updatedAt: now,
        expiresAt: (options.ttlMs ?? ttlMs) ? new Date(Date.now() + (options.ttlMs ?? ttlMs ?? 0)).toISOString() : undefined,
        provenance: buildDefaultProvenance(options),
        reviewStatus: options.reviewStatus || "approved",
        confidence: options.confidence || (seedItem ? "high" : "medium"),
        sensitivity: options.sensitivity || "low",
        qualityScore: Math.min(1, options.qualityScore ?? (seedItem ? 0.92 : 0.7)),
        reviewedBy: options.reviewedBy,
        seedItem,
    };
    entry.effectiveConfidence = deriveEffectiveConfidence(entry);
    snapshot.entries.push(entry);
    await persistStore(snapshot);
    recordAuditEvent("memory.write", seedItem ? "Stored a seed-calibrated memory entry" : "Stored a new memory entry", content.slice(0, 180), sessionId);
    return entry;
}

/**
 * Retrieve recent entries for a session (newest-first, expired excluded).
 */
export async function recall(
    sessionId: string,
    limit = 20,
    tags?: string[],
    options: MemoryRecallOptions = {}
): Promise<MemoryEntry[]> {
    const snapshot = await getStore();
    let entries = snapshot.entries.filter(e => e.sessionId === sessionId && !isExpired(e));
    entries = entries.filter(e => shouldExposeEntry(e, options));
    if (tags && tags.length > 0) {
        entries = entries.filter(e => tags.some(t => e.tags.includes(t)));
    }
    return entries.slice(-limit).reverse();
}

/**
 * Search across all sessions by content substring.
 */
export async function search(query: string, limit = 10, options: MemorySearchOptions = {}): Promise<MemoryEntry[]> {
    const snapshot = await getStore();
    const q = normalizeWhitespace(query);
    const candidateEntries = snapshot.entries.filter(e => !isExpired(e) && shouldExposeEntry(e, options));
    const results = candidateEntries
        .filter(e => meetsMinimumConfidence(e, options.minConfidence))
        .map(entry => ({...entry, score: computeMatchScore(q, entry), effectiveConfidence: deriveEffectiveConfidence(entry)}))
        .filter(entry => (entry.score || 0) > MATCH_THRESHOLD)
        .filter(entry => !options.tags || options.tags.length === 0 || options.tags.some(tag => entry.tags.includes(tag)))
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);

    const seedItemHits = results.filter(entry => entry.seedItem).length;
    recordRetrievalOutcome(q, results.length > 0 ? "useful" : "uncertain", results[0]?.effectiveConfidence, results.length, results.map(entry => entry.id), seedItemHits);
    recordAuditEvent("memory.search", `Searched memory for "${q.slice(0, 80)}"`, `${results.length} result(s)`, undefined, results.some(r => r.effectiveConfidence === "low") ? "warning" : "info");
    return results;
}

/**
 * Find entries by Studio-compatible type tag.
 */
export async function findByType(type: MemoryType): Promise<MemoryEntry[]> {
    const snapshot = await getStore();
    return snapshot.entries.filter(e => e.type === type && !isExpired(e) && shouldExposeEntry(e, {maxSensitivity: "medium"}));
}

/**
 * Find entries by tag.
 */
export async function findByTag(tag: string): Promise<MemoryEntry[]> {
    const snapshot = await getStore();
    return snapshot.entries.filter(e => !isExpired(e) && shouldExposeEntry(e, {maxSensitivity: "medium"}) && e.tags.includes(tag));
}

/**
 * Quarantine an entry for review.
 */
export async function quarantineMemoryEntry(id: string, reason?: string): Promise<MemoryEntry | null> {
    const snapshot = await getStore();
    const entry = snapshot.entries.find(e => e.id === id);
    if (!entry) return null;
    entry.reviewStatus = "quarantined";
    entry.quarantineReason = reason || "No reason provided";
    entry.confidence = "low";
    entry.effectiveConfidence = "low";
    entry.lastReviewedAt = new Date().toISOString();
    entry.reviewedBy = entry.reviewedBy || "system";
    await persistStore(snapshot);
    recordAuditEvent("memory.quarantine", `Quarantined memory entry ${id}`, entry.quarantineReason, entry.sessionId, "warning");
    return entry;
}

/**
 * Review or approve an entry.
 */
export async function reviewMemoryEntry(id: string, status: MemoryReviewStatus, reviewer?: string, confidence?: MemoryConfidence, qualityScore?: number): Promise<MemoryEntry | null> {
    const snapshot = await getStore();
    const entry = snapshot.entries.find(e => e.id === id);
    if (!entry) return null;
    entry.reviewStatus = status;
    entry.reviewedBy = reviewer || entry.reviewedBy || "system";
    entry.lastReviewedAt = new Date().toISOString();
    if (status !== "quarantined") {
        entry.quarantineReason = undefined;
    }
    if (confidence) entry.confidence = confidence;
    if (qualityScore !== undefined) entry.qualityScore = qualityScore;
    entry.effectiveConfidence = deriveEffectiveConfidence(entry);
    await persistStore(snapshot);
    recordAuditEvent("memory.review", `Reviewed memory entry ${id}`, `status=${status}`, entry.sessionId, status === "quarantined" ? "warning" : "info");
    return entry;
}

/**
 * Ingest content into a structured knowledge bank.
 */
export async function ingestKnowledgeEntries(
    source: string,
    content: string,
    options: MemoryWriteOptions & {sessionId?: string; chunkSize?: number; tags?: string[]} = {}
): Promise<MemoryEntry[]> {
    const snapshot = await getStore();
    const entries: MemoryEntry[] = [];
    const sessionId = options.sessionId || "knowledge-bank";
    const chunks = chunkText(content, options.chunkSize || 400);
    const requestedTags = Array.from(new Set([...(options.tags || [])]));
    const isSeedItem = options.isSeedItem ?? requestedTags.includes("seed-item");
    let knowledgeEntryCount = snapshot.entries.filter(e => e.sessionId === sessionId).length;
    for (const chunk of chunks) {
        knowledgeEntryCount += 1;
        const entry: MemoryEntry = {
            id: generateId(),
            type: "knowledge",
            role: "system",
            sessionId,
            key: `${sessionId}:knowledge:${knowledgeEntryCount}`,
            content: chunk,
            tags: buildEntryTags(["knowledge-bank", ...requestedTags, ...(source ? [`source:${source}`] : [])], isSeedItem),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            provenance: {
                source,
                sourceType: "ingestion",
                importedAt: new Date().toISOString(),
                license: options.provenance?.license,
                owner: options.provenance?.owner,
            },
            reviewStatus: options.reviewStatus || (isSeedItem ? "approved" : "pending"),
            confidence: options.confidence || (isSeedItem ? "high" : "medium"),
            sensitivity: options.sensitivity || "low",
            qualityScore: Math.min(1, options.qualityScore ?? (isSeedItem ? 0.92 : 0.65)),
            reviewedBy: options.reviewedBy,
            seedItem: isSeedItem,
        };
        entry.effectiveConfidence = deriveEffectiveConfidence(entry);
        snapshot.entries.push(entry);
        entries.push(entry);
    }
    await persistStore(snapshot);
    recordAuditEvent("memory.ingest", isSeedItem ? `Seed-calibrated knowledge ingest for ${source}` : `Ingested knowledge source ${source}`, `${entries.length} chunk(s)`, sessionId);
    return entries;
}

/**
 * Clear all entries for a session.
 */
export async function ingestRepositoryKnowledge(
    options: {
        rootDir?: string;
        includePaths?: string[];
        sessionId?: string;
        tags?: string[];
        reviewStatus?: MemoryReviewStatus;
        confidence?: MemoryConfidence;
        sensitivity?: MemorySensitivity;
        qualityScore?: number;
        isSeedItem?: boolean;
    } = {}
): Promise<RepositoryKnowledgeIngestionResult> {
    const normalizedRoot = path.resolve(options.rootDir || process.cwd());
    const includePaths = options.includePaths && options.includePaths.length > 0
        ? options.includePaths
        : (process.env.LUMI_KNOWLEDGE_PATHS || ".")
            .split(",")
            .map(entry => entry.trim())
            .filter(Boolean);
    const scannedFiles = await collectKnowledgeFiles(normalizedRoot, includePaths);
    const filesToProcess = scannedFiles.slice(0, MAX_INGESTED_FILES_PER_REQUEST);
    const skippedFiles: string[] = scannedFiles.length > MAX_INGESTED_FILES_PER_REQUEST
        ? scannedFiles.slice(MAX_INGESTED_FILES_PER_REQUEST).map(file => toRelativeKnowledgePath(normalizedRoot, file))
        : [];
    const ingestedFiles: string[] = [];
    let totalChunks = 0;
    let totalEntries = 0;

    for (const filePath of filesToProcess) {
        try {
            const stats = await fs.stat(filePath);
            if (stats.size > MAX_KNOWLEDGE_FILE_BYTES) {
                skippedFiles.push(toRelativeKnowledgePath(normalizedRoot, filePath));
                continue;
            }
            const content = await fs.readFile(filePath, "utf8");
            if (!content.trim()) {
                skippedFiles.push(toRelativeKnowledgePath(normalizedRoot, filePath));
                continue;
            }
            const relativePath = toRelativeKnowledgePath(normalizedRoot, filePath);
            const entries = await ingestKnowledgeEntries(relativePath, buildKnowledgeContent(filePath, normalizedRoot, content), {
                sessionId: options.sessionId || "knowledge-bank",
                tags: [...(options.tags || []), "repo-knowledge"],
                reviewStatus: options.reviewStatus,
                confidence: options.confidence,
                sensitivity: options.sensitivity,
                qualityScore: options.qualityScore,
                isSeedItem: options.isSeedItem,
                provenance: {sourceType: "ingestion", owner: "system", license: "repo-local"},
            });
            ingestedFiles.push(relativePath);
            totalChunks += entries.length;
            totalEntries += entries.length;
        } catch {
            skippedFiles.push(toRelativeKnowledgePath(normalizedRoot, filePath));
        }
    }

    return {
        rootDir: normalizedRoot,
        includedPaths: includePaths,
        scannedFiles,
        ingestedFiles,
        skippedFiles,
        totalChunks,
        totalEntries,
        sessionId: options.sessionId || "knowledge-bank",
    };
}

export async function forget(sessionId: string): Promise<void> {
    const snapshot = await getStore();
    snapshot.entries = snapshot.entries.filter(e => e.sessionId !== sessionId);
    await persistStore(snapshot);
    recordAuditEvent("memory.forget", `Cleared memory for session ${sessionId}`, undefined, sessionId, "warning");
}

/**
 * Prune expired or low-quality entries.
 */
export async function cleanupMemoryEntries(maxAgeDays = 30, minQuality = 0.2): Promise<{removed: number; quarantined: number}> {
    const snapshot = await getStore();
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
    let removed = 0;
    let quarantined = 0;
    const filtered = snapshot.entries.filter(entry => {
        const stale = !!entry.expiresAt && new Date(entry.expiresAt) < new Date();
        const lowQuality = (entry.qualityScore ?? 0.6) <= minQuality;
        const old = !!entry.createdAt && entry.createdAt < cutoff;
        if (stale || (lowQuality && old)) {
            removed += 1;
            return false;
        }
        if (lowQuality) {
            entry.reviewStatus = "quarantined";
            entry.quarantineReason = "low-quality";
            entry.confidence = "low";
            entry.effectiveConfidence = "low";
            quarantined += 1;
        }
        return true;
    });
    snapshot.entries = filtered;
    await persistStore(snapshot);
    recordAuditEvent("memory.cleanup", `Cleaned memory store`, `${removed} removed, ${quarantined} quarantined`, undefined, "info");
    return {removed, quarantined};
}

/**
 * Record retrieval feedback to support calibration.
 */
export async function recordRetrievalFeedback(query: string, entryIds: string[], outcome: RetrievalTelemetryEvent["outcome"], confidence?: MemoryConfidence): Promise<RetrievalTelemetryEvent> {
    const snapshot = await getStore();
    const seedItemHits = snapshot.entries.filter(entry => entryIds.includes(entry.id) && entry.seedItem).length;
    const event: RetrievalTelemetryEvent = {
        id: generateId(),
        query: query.slice(0, 180),
        outcome,
        confidence,
        resultCount: entryIds.length,
        entryIds,
        createdAt: new Date().toISOString(),
        seedItemHits,
    };
    retrievalTelemetry.push(event);
    if (retrievalTelemetry.length > MAX_AUDIT_TRAIL_SIZE) retrievalTelemetry.splice(0, retrievalTelemetry.length - MAX_AUDIT_TRAIL_SIZE);
    recordAuditEvent("memory.feedback", `Recorded retrieval feedback: ${outcome}`, query.slice(0, 120), undefined, outcome === "not-useful" ? "warning" : "info");
    return event;
}

/**
 * Return a Studio-compatible snapshot of all active memory.
 */
export async function snapshot(): Promise<MemorySnapshot> {
    const store = await getStore();
    return {
        entries: store.entries.filter(e => !isExpired(e) && shouldExposeEntry(e, {maxSensitivity: "medium"})),
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
    };
}

/**
 * Aggregate statistics about the memory store.
 */
export async function memoryStats(): Promise<{
    totalEntries: number;
    activeSessions: number;
    byType: Record<MemoryType, number>;
    quarantined: number;
    pendingReview: number;
    storageBackend: string;
    updatedAt: string;
    seedItems: number;
    sensitiveEntries: number;
}> {
    const snap = await getStore();
    const active = snap.entries.filter(e => !isExpired(e));
    const sessions = new Set(active.map(e => e.sessionId));
    const byType: Record<MemoryType, number> = {goal: 0, task: 0, context: 0, knowledge: 0, artifact: 0};
    for (const e of active) byType[e.type] = (byType[e.type] || 0) + 1;
    return {
        totalEntries: active.length,
        activeSessions: sessions.size,
        byType,
        quarantined: active.filter(e => e.reviewStatus === "quarantined").length,
        pendingReview: active.filter(e => e.reviewStatus === "pending").length,
        storageBackend: memOctokit ? `github-gist${gistId ? `:${gistId}` : ""}` : "in-memory",
        updatedAt: snap.updatedAt,
        seedItems: active.filter(e => e.seedItem).length,
        sensitiveEntries: active.filter(e => e.sensitivity === "high").length,
    };
}

export function getAuditTrail(limit = 50): MemoryAuditEvent[] {
    return auditTrail.slice(-limit).reverse();
}

export function getTelemetrySnapshot(): {totalRetrievals: number; usefulRetrievals: number; uncertainRetrievals: number; lowConfidenceRetrievals: number; seedItemHits: number} {
    const totalRetrievals = retrievalTelemetry.length;
    const usefulRetrievals = retrievalTelemetry.filter(event => event.outcome === "useful").length;
    const uncertainRetrievals = retrievalTelemetry.filter(event => event.outcome === "uncertain").length;
    const lowConfidenceRetrievals = retrievalTelemetry.filter(event => event.confidence === "low").length;
    const seedItemHits = retrievalTelemetry.reduce((sum, event) => sum + (event.seedItemHits || 0), 0);
    return {totalRetrievals, usefulRetrievals, uncertainRetrievals, lowConfidenceRetrievals, seedItemHits};
}

export async function getAdaptiveLearningEvaluationSummary(): Promise<AdaptiveLearningEvaluationSummary> {
    const stats = await memoryStats();
    const telemetry = getTelemetrySnapshot();
    const totalEntries = stats.totalEntries;
    const retrievalUsefulness = telemetry.totalRetrievals > 0 ? telemetry.usefulRetrievals / telemetry.totalRetrievals : 0;
    const quarantineRate = totalEntries > 0 ? stats.quarantined / totalEntries : 0;
    const seedItemHitRate = telemetry.totalRetrievals > 0 ? telemetry.seedItemHits / telemetry.totalRetrievals : 0;
    return {
        generatedAt: new Date().toISOString(),
        retrievalUsefulness,
        quarantineRate,
        seedItemHitRate,
        reviewBacklog: stats.pendingReview,
        totalEntries,
        quarantined: stats.quarantined,
        pendingReview: stats.pendingReview,
        totalRetrievals: telemetry.totalRetrievals,
        usefulRetrievals: telemetry.usefulRetrievals,
        uncertainRetrievals: telemetry.uncertainRetrievals,
        lowConfidenceRetrievals: telemetry.lowConfidenceRetrievals,
        seedItemHits: telemetry.seedItemHits,
    };
}

export async function getObservabilitySnapshot(): Promise<MemoryObservabilitySnapshot> {
    const stats = await memoryStats();
    const evaluation = await getAdaptiveLearningEvaluationSummary();
    return {
        memory: {
            totalEntries: stats.totalEntries,
            activeSessions: stats.activeSessions,
            byType: stats.byType,
            quarantined: stats.quarantined,
            pendingReview: stats.pendingReview,
            storageBackend: stats.storageBackend,
            updatedAt: stats.updatedAt,
            seedItems: stats.seedItems,
            sensitiveEntries: stats.sensitiveEntries,
        },
        telemetry: getTelemetrySnapshot(),
        evaluation,
        audit: getAuditTrail(20),
    };
}
