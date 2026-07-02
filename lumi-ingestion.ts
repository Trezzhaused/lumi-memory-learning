import {spawnSync} from "node:child_process";
import {promises as fs} from "node:fs";
import path from "node:path";
import {remember} from "./lumi-memory";
import {storeArtifact} from "./lumi-storage";

export type IngestionCategory = "Financials" | "Manuscripts" | "System_Logs" | "General_Reference";

export interface IngestionRequest {
    filename?: string;
    sourcePath?: string;
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
}

const INGESTION_ROOT = process.env.LUMI_INGESTION_ROOT || path.join(process.cwd(), ".data", "ingestion");
const INCOMING_DIR = path.join(INGESTION_ROOT, "incoming");
const CATEGORY_DIRS = ["Financials", "Manuscripts", "System_Logs", "General_Reference"] as const;
const CHUNK_SIZE = 3000;

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

function resolvePythonBin(): string {
    return process.env.PYTHON_BIN || process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
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
    } else if (payload.contentBase64) {
        buffer = Buffer.from(payload.contentBase64, "base64");
        sourceFilePath = await writeTemporaryFile(buffer, filename);
    } else if (payload.content !== undefined) {
        buffer = Buffer.from(payload.content, "utf8");
        sourceFilePath = await writeTemporaryFile(buffer, filename);
    } else {
        return {status: "error", message: "No file content or source path was provided.", filename, category: "General_Reference"};
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
    await remember(sessionId, "assistant", `[ingestion] ${safeName}: ${extractedText.slice(0, 4000)}`, ["ingestion", category.toLowerCase()], "knowledge");

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
