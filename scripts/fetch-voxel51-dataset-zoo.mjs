import {access, mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "data", "voxel51-dataset-zoo");
const imageDir = path.join(outputDir, "images");

// Primary source for the built-in Voxel51 Dataset Zoo documentation.
const docUrl = process.env.VOXEL51_DATASET_ZOO_URL || "https://raw.githubusercontent.com/voxel51/voxel51-docs/main/docs/data/dataset_zoo/datasets.md";
const detailFields = ["Dataset name", "Dataset source", "Dataset size", "Tags", "Supported splits"];
const detailFieldHandlers = {
    "Dataset name": (section, value) => { section.datasetName = value; },
    "Dataset source": (section, value) => { section.source = value; },
    "Dataset size": (section, value) => { section.size = value; },
    "Tags": (section, value) => { section.tags = value.split(",").map(item => item.trim()).filter(Boolean); },
    "Supported splits": (section, value) => { section.supportedSplits = value.split(",").map(item => item.trim()).filter(Boolean); },
};
const docsResponse = await fetch(docUrl);
if (!docsResponse.ok) {
    throw new Error(`Failed to fetch Voxel51 docs: ${docsResponse.status} ${docsResponse.statusText}`);
}
const markdown = await docsResponse.text();

await mkdir(imageDir, {recursive: true});

const datasetSections = parseDatasetSections(markdown);
const datasets = [];

for (const section of datasetSections) {
    const imageUrls = Array.from(new Set(section.imageUrls));
    const savedImages = [];

    for (const imageUrl of imageUrls) {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            console.warn(`[voxel51-zoo] failed to download image (${imageResponse.status} ${imageResponse.statusText}): ${imageUrl}`);
            continue;
        }
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        const filename = path.basename(new URL(imageUrl).pathname);
        // Keep the image filename deterministic while avoiding empty or malformed names.
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_");
        const baseFilename = safeFilename || "image";
        const imagePath = await getUniqueImagePath(imageDir, baseFilename);
        await writeFile(imagePath, buffer);
        savedImages.push({
            sourceUrl: imageUrl,
            localPath: path.relative(repoRoot, imagePath).split(path.sep).join("/"),
        });
    }

    datasets.push({
        id: slugify(section.name),
        name: section.name,
        summary: section.summary,
        datasetName: section.datasetName,
        source: section.source,
        size: section.size,
        tags: section.tags,
        supportedSplits: section.supportedSplits,
        notes: section.notes,
        imageUrls: imageUrls,
        images: savedImages,
        sourceUrl: section.sourceUrl,
    });
}

await writeFile(
    path.join(outputDir, "datasets.json"),
    JSON.stringify({
        generatedAt: new Date().toISOString(),
        sourceUrl: docUrl,
        datasets,
    }, null, 2) + "\n"
);

await writeFile(
    path.join(outputDir, "README.md"),
    buildReadme(datasets, docUrl)
);

async function getUniqueImagePath(imageDir, baseFilename) {
    const extension = path.extname(baseFilename);
    const stem = path.basename(baseFilename, extension);
    let candidate = path.join(imageDir, baseFilename);
    let counter = 1;

    while (true) {
        try {
            await access(candidate);
            const nextName = `${stem}-${counter}${extension}`;
            candidate = path.join(imageDir, nextName);
            counter += 1;
        } catch {
            return candidate;
        }
    }
}

function parseDatasetSections(markdown) {
    const lines = markdown.split(/\r?\n/);
    const sections = [];
    const detailPattern = new RegExp(`^-\\s+(${detailFields.join("|")}):\\s*(.+)$`);
    let current = null;

    for (const line of lines) {
        const headingMatch = line.match(/^##\s+(.+?)\s*(?:\[¶\]\(.*\))?\s*$/);
        if (headingMatch) {
            if (current) {
                sections.push(finalizeSection(current));
            }
            current = {
                name: headingMatch[1].trim(),
                summary: "",
                datasetName: "",
                source: "",
                size: "",
                tags: [],
                supportedSplits: [],
                notes: [],
                imageUrls: [],
                sourceUrl: "",
                paragraphs: [],
            };
            continue;
        }

        if (!current) {
            continue;
        }

        if (isLikelyParagraph(line)) {
            const paragraph = line.trim();
            if (paragraph) {
                current.paragraphs.push(paragraph);
            }
            continue;
        }

        const detailMatch = line.match(detailPattern);
        if (detailMatch) {
            const [, label, value] = detailMatch;
            const normalizedValue = normalizeMarkup(value);
            const handler = detailFieldHandlers[label];
            if (handler) {
                handler(current, normalizedValue);
            }
            continue;
        }

        const noteMatch = line.match(/^-\s+(.+)$/);
        if (noteMatch && !line.startsWith("- Dataset") && !current.notes.includes(noteMatch[1])) {
            current.notes.push(noteMatch[1]);
            continue;
        }

        const imageMatch = line.match(/!\[[^\]]*\]\(([^)]+)\)/);
        if (imageMatch) {
            current.imageUrls.push(resolveImageUrl(imageMatch[1], docUrl));
            continue;
        }
    }

    if (current) {
        sections.push(finalizeSection(current));
    }

    return sections.filter(section => section.name && section.name !== "Built-In Zoo Datasets");
}

function finalizeSection(section) {
    const summary = section.paragraphs.join(" ").trim() || section.summary || "";
    const normalizedNotes = section.notes
        .map(item => normalizeMarkup(item))
        .filter(Boolean);
    return {
        ...section,
        summary,
        notes: normalizedNotes,
        sourceUrl: `https://docs.voxel51.com/user_guide/dataset_zoo/datasets.html#${buildDocAnchor(section.name)}`,
    };
}

function buildDocAnchor(value) {
    return slugify(value);
}

function isLikelyParagraph(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("**")) return false;
    if (trimmed.startsWith("![")) return false;
    if (trimmed.startsWith("-")) return false;
    return !trimmed.startsWith("Note") && !trimmed.startsWith("##");
}

function normalizeMarkup(value) {
    return value
        .replace(/`/g, "")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
}

function resolveImageUrl(imagePath, baseUrl) {
    return new URL(imagePath, baseUrl).toString();
}

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function buildReadme(datasets, docUrl) {
    const headers = [
        "# Voxel51 Dataset Zoo catalog",
        "",
        "This directory stores a machine-readable catalog of the built-in Voxel51 FiftyOne Dataset Zoo datasets, plus preview images downloaded from the official docs source.",
        "",
        "## Source",
        "",
        `- Official docs: ${docUrl}`,
        "",
        "## Datasets",
        "",
        ...datasets.map(dataset => `- **${dataset.name}** — ${dataset.summary || "No summary available."} (${dataset.images.length} image${dataset.images.length === 1 ? "" : "s"})`),
    ];

    return headers.join("\n") + "\n";
}
