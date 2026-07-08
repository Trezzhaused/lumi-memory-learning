const fs = require("node:fs");
const path = require("node:path");

(async () => {
    const catalogPath = path.resolve(__dirname, "..", "data", "voxel51", "dataset-zoo-catalog.json");
    const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    const {remember} = require("../dist/lumi-memory.js");
    const sessionId = "voxel51-zoo";

    const summaryText = [
        `Voxel51 Dataset Zoo catalog loaded with ${catalog.length} datasets.`,
        `The catalog covers image, video, classification, detection, segmentation, and multimodal vision datasets that are useful for training and evaluation.`,
        `Each entry includes tags, source links, exemplar images, and dataset details for later retrieval and prompt-based training.`,
    ].join(" ");

    await remember(sessionId, "assistant", summaryText, ["voxel51", "dataset-zoo", "training", "vision"], "knowledge");

    for (const entry of catalog.slice(0, 80)) {
        const detailText = [
            entry.name,
            entry.description || "Dataset entry from the Voxel51 Dataset Zoo.",
            `Tags: ${entry.tags.join(", ") || "none"}`,
            `Source: ${entry.source || "unlisted"}`,
            `Size: ${entry.size || "unknown"}`,
            `Splits: ${entry.splits || "unknown"}`,
            `Images: ${entry.images.join(", ") || "none"}`,
        ].join(" | ");
        await remember(sessionId, "assistant", detailText, ["voxel51", "dataset-zoo", "training", "vision", entry.slug], "knowledge");
    }

    console.log(`Seeded Lumi memory with ${catalog.length} Voxel51 dataset entries.`);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
