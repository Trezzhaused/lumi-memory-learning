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

// ---------------------------------------------------------------------------
// Types (superset of Studio lumi/Memory.ts)
// ---------------------------------------------------------------------------

/** Studio-compatible entry types */
export type MemoryType = "goal" | "task" | "context" | "knowledge" | "artifact";

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

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GIST_DESCRIPTION = "Lumi Memory \u2013 Trezzhaus AI";
const GIST_FILENAME = "lumi-memory.json";
const R2_MEMORY_KEY = process.env.CLOUDFLARE_R2_MEMORY_KEY || "lumi/memory/lumi-memory.json";
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || "";

let gistId: string | null = null;

const githubToken = process.env.GITHUB_API_TOKEN || "";
const memOctokit = githubToken ? new Octokit({auth: githubToken}) : null;

// In-process fallback store
const localStore: MemorySnapshot = {entries: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};

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
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isExpired(entry: MemoryEntry): boolean {
    if (!entry.expiresAt) return false;
    return new Date(entry.expiresAt) < new Date();
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
    ttlMs?: number
): Promise<MemoryEntry> {
    const snapshot = await getStore();
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
        id: generateId(),
        type,
        role,
        sessionId,
        key: `${sessionId}:${role}:${now}`,
        content,
        tags,
        createdAt: now,
        updatedAt: now,
        expiresAt: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : undefined,
    };
    snapshot.entries.push(entry);
    await persistStore(snapshot);
    return entry;
}

/**
 * Retrieve recent entries for a session (newest-first, expired excluded).
 */
export async function recall(
    sessionId: string,
    limit = 20,
    tags?: string[]
): Promise<MemoryEntry[]> {
    const snapshot = await getStore();
    let entries = snapshot.entries.filter(e => e.sessionId === sessionId && !isExpired(e));
    if (tags && tags.length > 0) {
        entries = entries.filter(e => tags.some(t => e.tags.includes(t)));
    }
    return entries.slice(-limit).reverse();
}

/**
 * Search across all sessions by content substring.
 */
export async function search(query: string, limit = 10): Promise<MemoryEntry[]> {
    const snapshot = await getStore();
    const q = query.toLowerCase();
    return snapshot.entries
        .filter(e => !isExpired(e) && e.content.toLowerCase().includes(q))
        .slice(-limit)
        .reverse();
}

/**
 * Find entries by Studio-compatible type tag.
 */
export async function findByType(type: MemoryType): Promise<MemoryEntry[]> {
    const snapshot = await getStore();
    return snapshot.entries.filter(e => e.type === type && !isExpired(e));
}

/**
 * Find entries by tag.
 */
export async function findByTag(tag: string): Promise<MemoryEntry[]> {
    const snapshot = await getStore();
    return snapshot.entries.filter(e => !isExpired(e) && e.tags.includes(tag));
}

/**
 * Clear all entries for a session.
 */
export async function forget(sessionId: string): Promise<void> {
    const snapshot = await getStore();
    snapshot.entries = snapshot.entries.filter(e => e.sessionId !== sessionId);
    await persistStore(snapshot);
}

/**
 * Return a Studio-compatible snapshot of all active memory.
 */
export async function snapshot(): Promise<MemorySnapshot> {
    const store = await getStore();
    return {
        entries: store.entries.filter(e => !isExpired(e)),
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
    storageBackend: string;
    updatedAt: string;
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
        storageBackend: memOctokit ? `github-gist${gistId ? `:${gistId}` : ""}` : "in-memory",
        updatedAt: snap.updatedAt,
    };
}
