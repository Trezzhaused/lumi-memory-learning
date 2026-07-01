import {promises as fs} from "node:fs";
import path from "node:path";
import {GetObjectCommand, PutObjectCommand, S3Client} from "@aws-sdk/client-s3";

export interface StoredArtifact {
    id: string;
    kind: string;
    filename: string;
    mimeType: string;
    storage: "local" | "r2";
    size: number;
    path?: string;
    key?: string;
    url?: string;
    createdAt: string;
}

export interface ArtifactStorageStatus {
    backend: "local" | "r2";
    configured: boolean;
    bucket?: string;
}

interface StoreArtifactInput {
    kind: string;
    filename?: string;
    mimeType?: string;
    content?: string;
    buffer?: Buffer;
    sourceUrl?: string;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const ARTIFACTS_DIR = path.join(DATA_DIR, "artifacts");
const INDEX_DIR = path.join(ARTIFACTS_DIR, ".index");

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || "";
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || "";

function sanitizeName(value: string): string {
    const safe = value
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);
    return safe || "artifact";
}

function sanitizeRelativePath(value: string): string {
    return path.basename(value.replace(/[\\/]/g, "-"));
}

function resolveArtifactDir(kind: string): string {
    const baseDir = path.resolve(ARTIFACTS_DIR);
    const safeKind = sanitizeRelativePath(kind);
    const targetDir = path.resolve(baseDir, safeKind);
    if (targetDir !== baseDir && !targetDir.startsWith(baseDir + path.sep)) {
        throw new Error(`Invalid artifact directory: ${kind}`);
    }
    return targetDir;
}

function resolveMetadataPath(id: string): string {
    const baseDir = path.resolve(INDEX_DIR);
    const safeId = sanitizeRelativePath(id);
    const targetPath = path.resolve(baseDir, `${safeId}.json`);
    if (!targetPath.startsWith(baseDir + path.sep) && targetPath !== baseDir) {
        throw new Error(`Invalid artifact metadata id: ${id}`);
    }
    return targetPath;
}

function inferExtension(filename: string | undefined, mimeType: string | undefined): string {
    if (filename && /\.[a-z0-9]{1,8}$/i.test(filename)) {
        return "";
    }
    const byMime: Record<string, string> = {
        "text/markdown": ".md",
        "text/plain": ".txt",
        "application/json": ".json",
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "audio/mpeg": ".mp3",
        "audio/wav": ".wav",
        "audio/flac": ".flac",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
    };
    return byMime[mimeType || ""] || ".bin";
}

function buildFilename(input: StoreArtifactInput): string {
    const base = sanitizeName(input.filename || input.kind || "artifact");
    const ext = inferExtension(input.filename, input.mimeType);
    return `${base}${ext}`;
}

function getR2Config(): {client?: S3Client; bucket?: string; endpoint?: string; publicUrl?: string} {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
        return {};
    }
    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    // Cloudflare R2 uses the account-specific S3-compatible endpoint format below.
    const client = new S3Client({
        region: "auto",
        endpoint,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    });
    return {client, bucket: R2_BUCKET, endpoint, publicUrl: R2_PUBLIC_URL || ""};
}

export function getArtifactStorageStatus(): ArtifactStorageStatus {
    const {client, bucket} = getR2Config();
    return {
        backend: client && bucket ? "r2" : "local",
        configured: !!(client && bucket),
        bucket: bucket || undefined,
    };
}

export async function storeArtifact(input: StoreArtifactInput): Promise<StoredArtifact | null> {
    const createdAt = new Date().toISOString();
    const artifactId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filename = buildFilename(input);
    const mimeType = input.mimeType || "application/octet-stream";
    const kind = sanitizeName(input.kind);
    const safeFilename = sanitizeRelativePath(filename);
    const objectKey = `${kind}/${artifactId}-${safeFilename}`;
    const localDir = resolveArtifactDir(kind);
    await fs.mkdir(localDir, {recursive: true});
    await fs.mkdir(INDEX_DIR, {recursive: true});

    let buffer: Buffer;
    if (input.buffer) {
        buffer = input.buffer;
    } else if (input.content !== undefined) {
        buffer = Buffer.from(input.content, "utf8");
    } else if (input.sourceUrl) {
        const response = await fetch(input.sourceUrl);
        if (!response.ok) {
            throw new Error(`Failed to download artifact from ${input.sourceUrl}: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
    } else {
        throw new Error("Artifact content was not provided");
    }

    const localPath = path.join(localDir, `${artifactId}-${safeFilename}`);
    const {client, bucket, endpoint, publicUrl} = getR2Config();

    if (client && bucket) {
        try {
            await client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: objectKey,
                Body: buffer,
                ContentType: mimeType,
            }));
            const artifact: StoredArtifact = {
                id: artifactId,
                kind,
                filename,
                mimeType,
                storage: "r2",
                size: buffer.length,
                key: objectKey,
                url: publicUrl ? `${publicUrl}/${objectKey}` : `${endpoint}/${bucket}/${objectKey}`,
                createdAt,
            };
            await fs.writeFile(resolveMetadataPath(artifactId), JSON.stringify(artifact, null, 2));
            return artifact;
        } catch (error) {
            console.warn(`[Lumi Storage] R2 upload failed; falling back to local storage:`, error);
        }
    }

    await fs.writeFile(localPath, buffer);
    const artifact: StoredArtifact = {
        id: artifactId,
        kind,
        filename,
        mimeType,
        storage: "local",
        size: buffer.length,
        path: localPath,
        createdAt,
    };
    await fs.writeFile(resolveMetadataPath(artifactId), JSON.stringify(artifact, null, 2));
    return artifact;
}

export async function getArtifact(id: string): Promise<StoredArtifact | null> {
    const metadataPath = resolveMetadataPath(id);
    try {
        const metadata = await fs.readFile(metadataPath, "utf8");
        return JSON.parse(metadata) as StoredArtifact;
    } catch {
        return null;
    }
}

export async function readArtifactBuffer(id: string): Promise<{artifact: StoredArtifact; buffer: Buffer} | null> {
    const artifact = await getArtifact(id);
    if (!artifact) return null;
    if (artifact.storage === "local" && artifact.path) {
        const buffer = await fs.readFile(artifact.path);
        return {artifact, buffer};
    }
    if (artifact.storage === "r2" && artifact.key) {
        const {client, bucket} = getR2Config();
        if (!client || !bucket) return null;
        const response = await client.send(new GetObjectCommand({
            Bucket: bucket,
            Key: artifact.key,
        }));
        type S3BodyLike = {
            transformToByteArray?: () => Promise<Uint8Array>;
            transformToString?: () => Promise<string>;
        };
        const body = response.Body as S3BodyLike | undefined;
        if (!body?.transformToByteArray) {
            throw new Error("R2 artifact response did not expose a byte stream");
        }
        const bytes = await body.transformToByteArray();
        return {artifact, buffer: Buffer.from(bytes)};
    }
    return null;
}
