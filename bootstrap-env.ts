import {existsSync, readFileSync} from "node:fs";
import path from "node:path";

export interface SharedEnvLoadResult {
    loadedFiles: string[];
    appliedEntries: string[];
    sourceFiles: string[];
    masterFileDir?: string;
}

function parseEnvFile(filePath: string): Record<string, string> {
    const parsed: Record<string, string> = {};
    const content = readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const normalized = line.startsWith("export ") ? line.slice(7) : line;
        const separatorIndex = normalized.indexOf("=");
        if (separatorIndex === -1) continue;
        const key = normalized.slice(0, separatorIndex).trim();
        const value = normalized.slice(separatorIndex + 1).trim();
        if (!key) continue;
        parsed[key] = value.replace(/^['\"]|['\"]$/g, "");
    }
    return parsed;
}

function resolveCandidatePaths(cwd: string): string[] {
    const root = path.resolve(cwd);
    const candidates = [
        path.join(root, ".env"),
        path.join(root, ".env.local"),
        path.join(root, ".env.shared"),
        path.join(root, ".env.master"),
        path.join(root, "Master-File", ".env"),
        path.join(root, "Master-File", ".env.shared"),
        path.join(root, "Master-File", ".env.master"),
        path.join(root, "..", "Master-File", ".env"),
        path.join(root, "..", "Master-File", ".env.shared"),
        path.join(root, "..", "Master-File", ".env.master"),
    ];
    const unique = [...new Set(candidates.filter(Boolean))];
    return unique.filter(candidate => existsSync(candidate));
}

export function loadSharedEnvFiles(cwd: string = process.cwd()): SharedEnvLoadResult {
    const loadedFiles: string[] = [];
    const appliedEntries: string[] = [];
    const candidateFiles = resolveCandidatePaths(cwd);
    const masterFileDir = candidateFiles.find(file => file.includes(`${path.sep}Master-File${path.sep}`))
        ? path.dirname(candidateFiles.find(file => file.includes(`${path.sep}Master-File${path.sep}`))!)
        : undefined;

    for (const filePath of candidateFiles) {
        const parsed = parseEnvFile(filePath);
        const entries = Object.entries(parsed);
        if (!entries.length) continue;
        loadedFiles.push(filePath);
        for (const [key, value] of entries) {
            if (process.env[key] === undefined || process.env[key] === "") {
                process.env[key] = value;
                appliedEntries.push(key);
            }
        }
    }

    return {loadedFiles, appliedEntries, sourceFiles: candidateFiles, masterFileDir};
}

export function getMasterFileDir(cwd: string = process.cwd()): string | undefined {
    const result = loadSharedEnvFiles(cwd);
    return result.masterFileDir;
}

export function getSharedEnvStatus(cwd: string = process.cwd()): SharedEnvLoadResult & {resolvedEnvPath?: string} {
    const result = loadSharedEnvFiles(cwd);
    return {
        ...result,
        resolvedEnvPath: result.loadedFiles[0],
    };
}

loadSharedEnvFiles();
