import {spawnSync} from "node:child_process";
import {promises as fs} from "node:fs";
import path from "node:path";
import {remember} from "./lumi-memory";
import {storeArtifact} from "./lumi-storage";

export type IngestionCategory = "Financials" | "Manuscripts" | "System_Logs" | "General_Reference";

export interface IngestionRequest {
    filename?: string;
    sourcePath?: string;
    sourceUrl?: string;
    url?: string;
    mimeType?: string;
    content?: string;
    contentBase64?: string;
    sessionId?: string;
}

export interface IngestionResult {
    status: "success" | "ignored" | "error";
    message?: string;
    filename: string;
    category: IngestionCategory;
    artifactId?: string;
    artifactPath?: string;
    extractedText?: string;
    totalChunks?: number;
    moved?: boolean;
    finalPath?: string;
    sourcePath?: string;
    graphStatus?: "ok" | "skipped" | "error";
    graphMessage?: string;
}

const INGESTION_ROOT = process.env.LUMI_INGESTION_ROOT || path.join(process.cwd(), ".data", "ingestion");
const INCOMING_DIR = path.join(INGESTION_ROOT, "incoming");
const CATEGORY_DIRS = ["Financials", "Manuscripts", "System_Logs", "General_Reference"] as const;
const CHUNK_SIZE = 3000;
const GRAPH_INJECTOR_SCRIPT = path.join(process.cwd(), "scripts", "graph_injector.py");

function sanitizeFilename(value: string): string {
    return value
        .replace(/[\\/]+/g, "-")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "uploaded-file";
}

function inferCategory(filename: string, text: string): IngestionCategory {
    const haystack = `${filename} ${text}`.toLowerCase();
    const financialMarkers = ["invoice", "ledger", "budget", "revenue", "expense", "profit", "pricing", "financial", "spreadsheet", "balance", "cost", "accounting", "csv", "statement"];
    const manuscriptMarkers = ["chapter", "manuscript", "novel", "story", "poem", "script", "copy", "draft", "essay", "book", "creative"];
    const systemMarkers = ["log", "error", "exception", "warning", "stack trace", "traceback", "debug", "server", "kernel", "diagnostic", "crash", "system"];

    if (financialMarkers.some((marker) => haystack.includes(marker))) return "Financials";
    if (manuscriptMarkers.some((marker) => haystack.includes(marker))) return "Manuscripts";
    if (systemMarkers.some((marker) => haystack.includes(marker))) return "System_Logs";
    return "General_Reference";
}

function chunkText(text: string, size = CHUNK_SIZE): string[] {
    if (!text) return [];
    return Array.from({length: Math.ceil(text.length / size)}, (_v, index) => text.slice(index * size, (index + 1) * size));
}

function stripHtmlText(value: string): string {
    const withoutScripts = value.replace(/<script[\s\S]*?<\/script>/gi, " ");
    const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, " ");
    return withoutStyles
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6]|tr|table)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)))
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function inferFilenameFromUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const pathnameBase = path.basename(parsed.pathname || "") || "remote-source";
        return decodeURIComponent(pathnameBase) || "remote-source";
    } catch {
        return "remote-source";
    }
}

async function fetchRemoteText(url: string): Promise<{content: string; filename: string; mimeType: string}> {
    const response = await fetch(url, {headers: {"User-Agent": "Lumi/1.0"}});
    if (!response.ok) {
        throw new Error(`Remote fetch failed with status ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "text/plain";
    const rawText = await response.text();
    const normalizedText = contentType.toLowerCase().includes("html")
        ? stripHtmlText(rawText)
        : rawText;

    return {
        content: normalizedText || rawText,
        filename: inferFilenameFromUrl(url),
        mimeType: contentType,
    };
}

function resolvePythonBin(): string {
    return process.env.PYTHON_BIN || process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
}

/**
 * Optional graph-memory side effects are enabled by default for ingested files.
 * Set LUMI_ENABLE_GRAPH=false to opt out, or ensure the Neo4j-backed injector is
 * configured before using the feature.
 */
async function injectGraphRelationship(entityA: string, relType: string, entityB: string): Promise<{status: "ok" | "skipped" | "error"; message: string}> {
    if (process.env.LUMI_ENABLE_GRAPH === "false") {
        return {status: "skipped", message: "Graph injection disabled by configuration."};
    }

    const pythonBin = resolvePythonBin();
    const result = spawnSync(pythonBin, [GRAPH_INJECTOR_SCRIPT, entityA, relType, entityB], {encoding: "utf8"});
    if (result.error) {
        return {status: "error", message: `Graph injector could not be launched: ${result.error.message}`};
    }
    if (result.status !== 0 && !result.stdout) {
        return {status: "error", message: result.stderr || "Graph injection failed without output."};
    }
    if (!result.stdout) {
        return {status: "error", message: result.stderr || "Graph injection failed without output."};
    }

    try {
        const parsed = JSON.parse(result.stdout) as {status?: string; message?: string};
        if (parsed?.status === "success") {
            return {status: "ok", message: parsed.message || "Graph injection completed."};
        }
        return {status: parsed?.status === "error" ? "error" : "skipped", message: parsed?.message || "Graph injection failed."};
    } catch {
        return {status: "error", message: `Graph injector returned unexpected output: ${result.stderr || result.stdout}`};
    }
}

async function ensureWorkspaceDirs(): Promise<void> {
    await fs.mkdir(INCOMING_DIR, {recursive: true});
    await Promise.all(CATEGORY_DIRS.map((category) => fs.mkdir(path.join(INGESTION_ROOT, category), {recursive: true})));
}

async function writeTemporaryFile(buffer: Buffer, filename: string): Promise<string> {
    await ensureWorkspaceDirs();
    const safeName = sanitizeFilename(filename || "uploaded-file");
    const targetPath = path.join(INCOMING_DIR, safeName);
    await fs.writeFile(targetPath, buffer);
    return targetPath;
}

async function extractTextFromFile(filePath: string, mimeType?: string): Promise<string> {
    const extension = path.extname(filePath).toLowerCase();
    const fileBuffer = await fs.readFile(filePath);
    const text = fileBuffer.toString("utf8");

    if (extension === ".csv") {
        return text
            .split(/\r?\n/)
            .map((row) => row.split(",").join(" | "))
            .join("\n");
    }

    if ([".txt", ".md", ".json", ".log", ".yaml", ".yml", ".xml"].includes(extension)) {
        return text;
    }

    if (extension === ".pdf") {
        const parserScript = path.join(process.cwd(), "scripts", "universal_parser.py");
        const pythonBin = resolvePythonBin();
        const result = spawnSync(pythonBin, [parserScript, filePath], {encoding: "utf8"});
        if (result.status === 0 && result.stdout) {
            try {
                const parsed = JSON.parse(result.stdout) as {status?: string; extracted_text?: string; message?: string};
                if (parsed?.status === "success") {
                    return parsed.extracted_text || "";
                }
                if (parsed?.message) {
                    return parsed.message;
                }
            } catch {
                // fall through to the generic fallback below
            }
        }
        return `PDF text extraction was unavailable for ${path.basename(filePath)}. ${mimeType || "binary content"}`;
    }

    return text || `Unsupported file type ${extension || mimeType || "unknown"}`;
}

async function relocateFile(sourcePath: string, category: IngestionCategory): Promise<string> {
    const categoryDir = path.join(INGESTION_ROOT, category);
    const destinationPath = path.join(categoryDir, path.basename(sourcePath));
    await fs.mkdir(categoryDir, {recursive: true});
    await fs.rename(sourcePath, destinationPath);
    return destinationPath;
}

export async function ingestFile(payload: IngestionRequest): Promise<IngestionResult> {
    const sessionId = payload.sessionId || "ingestion";
    const sourcePath = payload.sourcePath ? path.resolve(payload.sourcePath) : undefined;
    let buffer: Buffer;
    let sourceFilePath: string;
    let filename = payload.filename || "uploaded-file";

    await ensureWorkspaceDirs();

    if (sourcePath) {
        const resolvedSource = path.resolve(sourcePath);
        const stats = await fs.stat(resolvedSource).catch(() => null);
        if (!stats || !stats.isFile()) {
            return {status: "error", message: `Source file ${resolvedSource} does not exist.`, filename, category: "General_Reference"};
        }
        buffer = await fs.readFile(resolvedSource);
        sourceFilePath = resolvedSource;
        filename = path.basename(resolvedSource);
    } else if (payload.sourceUrl || payload.url) {
        const sourceUrl = payload.sourceUrl || payload.url || "";
        try {
            const remote = await fetchRemoteText(sourceUrl);
            buffer = Buffer.from(remote.content, "utf8");
            sourceFilePath = await writeTemporaryFile(buffer, remote.filename || filename);
            filename = remote.filename || filename;
            payload.mimeType = remote.mimeType || payload.mimeType;
        } catch (error) {
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Unable to fetch remote URL content.",
                filename,
                category: "General_Reference",
            };
        }
    } else if (payload.contentBase64) {
        buffer = Buffer.from(payload.contentBase64, "base64");
        sourceFilePath = await writeTemporaryFile(buffer, filename);
    } else if (payload.content !== undefined) {
        buffer = Buffer.from(payload.content, "utf8");
        sourceFilePath = await writeTemporaryFile(buffer, filename);
    } else {
        return {status: "error", message: "No file content, source path, or source URL was provided.", filename, category: "General_Reference"};
    }

    const safeName = sanitizeFilename(filename);
    const extractedText = await extractTextFromFile(sourceFilePath, payload.mimeType);
    const category = inferCategory(safeName, extractedText);
    const artifact = await storeArtifact({
        kind: "ingestion",
        filename: safeName,
        mimeType: payload.mimeType || "application/octet-stream",
        buffer,
    });

    const chunks = chunkText(extractedText);
    const ingestedSummary = payload.sourceUrl || payload.url
        ? `[ingestion-url] ${safeName}: ${extractedText.slice(0, 4000)}`
        : `[ingestion] ${safeName}: ${extractedText.slice(0, 4000)}`;
    await remember(sessionId, "assistant", ingestedSummary, ["ingestion", category.toLowerCase(), "url"], "knowledge");
    const graphResult = await injectGraphRelationship(safeName, "CLASSIFIED_AS", category);

    let finalPath: string | undefined;
    let moved = false;

    try {
        finalPath = await relocateFile(sourceFilePath, category);
        moved = true;
    } catch {
        finalPath = sourceFilePath;
    }

    return {
        status: "success",
        filename: safeName,
        category,
        artifactId: artifact?.id,
        artifactPath: artifact?.path,
        extractedText,
        totalChunks: chunks.length,
        moved,
        finalPath,
        sourcePath: sourceFilePath,
        graphStatus: graphResult.status,
        graphMessage: graphResult.message,
    };
}

export async function generateUserGuide(outputPath?: string): Promise<{status: string; artifactId?: string; artifactPath?: string; message: string}> {
    const targetPath = outputPath || path.join(INGESTION_ROOT, "guide", "Sovereign_AI_Master_Guide.pdf");
    await fs.mkdir(path.dirname(targetPath), {recursive: true});

    const pythonBin = resolvePythonBin();
    const scriptPath = path.join(process.cwd(), "scripts", "generate_user_guide.py");
    const result = spawnSync(pythonBin, [scriptPath, targetPath], {encoding: "utf8"});
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || "Failed to generate the user guide PDF.");
    }

    const artifact = await storeArtifact({
        kind: "guide",
        filename: path.basename(targetPath),
        mimeType: "application/pdf",
        buffer: await fs.readFile(targetPath),
    });

    return {
        status: "success",
        artifactId: artifact?.id,
        artifactPath: artifact?.path,
        message: `Generated user guide at ${targetPath}`,
    };
}
