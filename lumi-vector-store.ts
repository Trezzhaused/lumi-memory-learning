import {promises as fs} from "node:fs";
import path from "node:path";
import {auditLog, checkContentSafety} from "./lumi-acam";

export interface ChunkProvenance {
    source: string;
    importedAt: string;
    importedBy?: string;
    checksum?: string;
}

export interface ChunkQuarantineFlag {
    flagged: boolean;
    reason?: string;
    flaggedAt?: string;
    flaggedBy?: string;
}

export interface VectorChunk {
    id: string;
    text: string;
    source: string;
    chunkIndex: number;
    createdAt: string;
    updatedAt: string;
    metadata: {
        provenance?: ChunkProvenance;
        quarantine?: ChunkQuarantineFlag;
        tags: string[];
        sessionId?: string;
    };
    vector: Record<string, number>;
    tokenCount: number;
}

export interface ChunkStoreSnapshot {
    chunks: VectorChunk[];
    createdAt: string;
    updatedAt: string;
}

export interface ChunkStoreStats {
    totalChunks: number;
    quarantinedChunks: number;
    sources: string[];
    updatedAt: string;
}

export interface ChunkSearchResult {
    chunk: VectorChunk;
    score: number;
}

interface ChunkIngestionInput {
    text: string;
    source?: string;
    sessionId?: string;
    tags?: string[];
    maxChars?: number;
    overlapChars?: number;
    quarantine?: ChunkQuarantineFlag;
    provenance?: Partial<ChunkProvenance>;
    importedBy?: string;
}

interface ChunkSearchOptions {
    limit?: number;
    includeQuarantined?: boolean;
    source?: string;
}

interface BenchmarkDocument {
    id: string;
    text: string;
}

interface BenchmarkQuery {
    id: string;
    query: string;
    expectedIds: string[];
}

interface BenchmarkFixture {
    name: string;
    documents: BenchmarkDocument[];
    queries: BenchmarkQuery[];
}

type SparseVector = Record<string, number>;

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const CHUNK_STORE_PATH = path.join(DATA_DIR, "vector", "chunk-store.json");
const BENCHMARK_PATH = path.join(process.cwd(), "data", "benchmark", "local-index-benchmark.json");

function ensureAbsolutePath(targetPath: string): string {
    return path.resolve(targetPath);
}

function tokenize(text: string): string[] {
    return text.toLowerCase().match(/[a-z0-9]+/g) || [];
}

function toSparseVector(text: string): SparseVector {
    const tokens = tokenize(text);
    const counts = new Map<string, number>();
    for (const token of tokens) {
        counts.set(token, (counts.get(token) || 0) + 1);
    }
    const vector: SparseVector = {};
    const denominator = Math.max(tokens.length, 1);
    for (const [token, count] of counts.entries()) {
        vector[token] = count / denominator;
    }
    return vector;
}

function cosineSimilarity(left: SparseVector, right: SparseVector): number {
    const terms = new Set([...Object.keys(left), ...Object.keys(right)]);
    let dotProduct = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (const term of terms) {
        const leftValue = left[term] || 0;
        const rightValue = right[term] || 0;
        dotProduct += leftValue * rightValue;
        leftNorm += leftValue * leftValue;
        rightNorm += rightValue * rightValue;
    }
    if (leftNorm === 0 || rightNorm === 0) return 0;
    return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

function chunkText(text: string, maxChars = 1200, overlapChars = 80): string[] {
    const normalized = normalizeText(text);
    if (!normalized) return [];
    const chunks: string[] = [];
    let start = 0;
    while (start < normalized.length) {
        let end = Math.min(normalized.length, start + maxChars);
        if (end < normalized.length) {
            const breakIndex = normalized.lastIndexOf(" ", end);
            end = breakIndex > start ? breakIndex : end;
        }
        const chunk = normalized.slice(start, end).trim();
        if (chunk) chunks.push(chunk);
        if (end >= normalized.length) break;
        start = Math.max(start + 1, end - overlapChars);
    }
    return chunks;
}

function createChecksum(text: string): string {
    return Buffer.from(text).toString("base64").slice(0, 24);
}

async function loadSnapshot(): Promise<ChunkStoreSnapshot> {
    try {
        const raw = await fs.readFile(ensureAbsolutePath(CHUNK_STORE_PATH), "utf8");
        return JSON.parse(raw) as ChunkStoreSnapshot;
    } catch {
        return {
            chunks: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }
}

async function persistSnapshot(snapshot: ChunkStoreSnapshot): Promise<void> {
    const targetPath = ensureAbsolutePath(CHUNK_STORE_PATH);
    await fs.mkdir(path.dirname(targetPath), {recursive: true});
    await fs.writeFile(targetPath, JSON.stringify(snapshot, null, 2));
}

function buildDefaultQuarantineFlag(input: ChunkIngestionInput): ChunkQuarantineFlag {
    if (input.quarantine) {
        return input.quarantine;
    }
    const safety = checkContentSafety(input.text);
    return {
        flagged: !safety.safe,
        reason: safety.safe ? undefined : safety.reason,
        flaggedAt: safety.safe ? undefined : new Date().toISOString(),
        flaggedBy: input.importedBy || input.provenance?.importedBy || "system",
    };
}

export async function ingestTextChunks(input: ChunkIngestionInput): Promise<VectorChunk[]> {
    const snapshot = await loadSnapshot();
    const now = new Date().toISOString();
    const source = input.source || input.provenance?.source || "unknown";
    const quarantine = buildDefaultQuarantineFlag(input);
    const chunks = chunkText(input.text, input.maxChars || 1200, input.overlapChars || 80);
    const entries: VectorChunk[] = chunks.map((text, index) => {
        const chunkId = `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const tokens = tokenize(text);
        return {
            id: chunkId,
            text,
            source,
            chunkIndex: index,
            createdAt: now,
            updatedAt: now,
            metadata: {
                provenance: {
                    source,
                    importedAt: now,
                    importedBy: input.importedBy || input.provenance?.importedBy || "system",
                    checksum: createChecksum(text),
                },
                quarantine: quarantine.flagged ? quarantine : undefined,
                tags: input.tags || [],
                sessionId: input.sessionId,
            },
            vector: toSparseVector(text),
            tokenCount: tokens.length,
        };
    });

    snapshot.chunks.push(...entries);
    snapshot.updatedAt = now;
    await persistSnapshot(snapshot);

    const userId = input.importedBy || input.provenance?.importedBy || "system";
    auditLog.log(userId, "create", {
        resource: "vector-chunk",
        details: {
            source,
            chunkCount: entries.length,
            quarantined: entries.some(entry => entry.metadata.quarantine?.flagged),
        },
        success: true,
    });

    return entries;
}

export async function searchChunks(query: string, options: ChunkSearchOptions = {}): Promise<ChunkSearchResult[]> {
    const snapshot = await loadSnapshot();
    const queryVector = toSparseVector(query);
    const results = snapshot.chunks
        .filter(chunk => options.includeQuarantined || !chunk.metadata.quarantine?.flagged)
        .filter(chunk => !options.source || chunk.source === options.source)
        .map(chunk => ({
            chunk,
            score: cosineSimilarity(chunk.vector, queryVector),
        }))
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score);

    return results.slice(0, options.limit || 10);
}

export async function getChunk(chunkId: string): Promise<VectorChunk | null> {
    const snapshot = await loadSnapshot();
    return snapshot.chunks.find(chunk => chunk.id === chunkId) || null;
}

export async function listChunks(limit = 20): Promise<VectorChunk[]> {
    const snapshot = await loadSnapshot();
    return snapshot.chunks.slice(-limit).reverse();
}

export async function updateChunkQuarantine(
    chunkId: string,
    quarantine: ChunkQuarantineFlag,
    userId = "system",
): Promise<VectorChunk | null> {
    const snapshot = await loadSnapshot();
    const chunk = snapshot.chunks.find(entry => entry.id === chunkId);
    if (!chunk) return null;
    const now = new Date().toISOString();
    chunk.metadata.quarantine = {
        ...quarantine,
        flaggedAt: quarantine.flaggedAt || now,
        flaggedBy: quarantine.flaggedBy || userId,
    };
    chunk.updatedAt = now;
    snapshot.updatedAt = now;
    await persistSnapshot(snapshot);

    auditLog.log(userId, "quarantine", {
        resource: `vector-chunk:${chunkId}`,
        details: {flagged: quarantine.flagged, reason: quarantine.reason},
        success: true,
    });

    return chunk;
}

export async function getChunkStoreStats(): Promise<ChunkStoreStats> {
    const snapshot = await loadSnapshot();
    const sources = Array.from(new Set(snapshot.chunks.map(chunk => chunk.source)))
        .sort((left, right) => left.localeCompare(right));
    return {
        totalChunks: snapshot.chunks.length,
        quarantinedChunks: snapshot.chunks.filter(chunk => chunk.metadata.quarantine?.flagged).length,
        sources,
        updatedAt: snapshot.updatedAt,
    };
}

export async function runLocalIndexBenchmark(): Promise<{
    benchmarkName: string;
    totalQueries: number;
    passed: number;
    results: Array<{
        queryId: string;
        query: string;
        topMatches: string[];
        expectedIds: string[];
        passed: boolean;
    }>;
}> {
    const fixtureContent = await fs.readFile(ensureAbsolutePath(BENCHMARK_PATH), "utf8");
    const fixture = JSON.parse(fixtureContent) as BenchmarkFixture;
    const documents = fixture.documents.map((document, index) => ({
        id: document.id,
        text: document.text,
        source: `benchmark:${index}`,
        chunkIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
            provenance: {source: `benchmark:${index}`, importedAt: new Date().toISOString()},
            tags: ["benchmark"],
        },
        vector: toSparseVector(document.text),
        tokenCount: tokenize(document.text).length,
    }));

    const results = fixture.queries.map(query => {
        const ranked = documents
            .map(document => ({
                document,
                score: cosineSimilarity(document.vector, toSparseVector(query.query)),
            }))
            .filter(result => result.score > 0)
            .sort((a, b) => b.score - a.score);
        const topMatches = ranked.slice(0, 3).map(result => result.document.id);
        return {
            queryId: query.id,
            query: query.query,
            topMatches,
            expectedIds: query.expectedIds,
            passed: topMatches.some(id => query.expectedIds.includes(id)),
        };
    });

    return {
        benchmarkName: fixture.name,
        totalQueries: results.length,
        passed: results.filter(result => result.passed).length,
        results,
    };
}
