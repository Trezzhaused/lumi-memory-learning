import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "data", "training-datasets");
const viewerOutputPath = path.join(repoRoot, "public", "dataset-viewer.html");
const catalogOutputPath = path.join(outputDir, "catalog.json");
const readmeOutputPath = path.join(outputDir, "README.md");
const userAgent = process.env.DATASET_FETCH_USER_AGENT || "Mozilla/5.0 (compatible; LumiDatasetFetcher/1.0; +https://github.com/Trezzhaused/lumi-memory-learning)";

const openImagesPageUrl = "https://storage.googleapis.com/openimages/web/download_v7.html";
const deepBluePageUrl = "https://deepblue.lib.umich.edu/data/concern/data_sets/gq67jr854";

const openImagesFallback = {
    id: "openimages",
    name: "Open Images",
    category: "dataset",
    sourceUrl: openImagesPageUrl,
    summary: "Google's large-scale image dataset for object detection, classification, segmentation, and multimodal grounding experiments.",
    description: "Open Images V7 is a large vision dataset with image-level labels, bounding boxes, relationships, and segmentation annotations suitable for training and benchmarking vision-language systems.",
    downloadTargets: [
        {name: "Open Images V7 download page", url: openImagesPageUrl, kind: "landing-page"},
        {name: "Open Images dataset repository", url: "https://github.com/cvdfoundation/open-images-dataset", kind: "repository"},
        {name: "Open Images training archive sample (train_0.tar.gz)", url: "https://storage.googleapis.com/open-images-dataset/tar/train_0.tar.gz", kind: "archive"},
        {name: "Open Images validation archive", url: "https://storage.googleapis.com/open-images-dataset/tar/validation.tar.gz", kind: "archive"},
    ],
    notes: [
        "The official download page is the canonical source for the latest archive layout.",
        "Archives are large, so the repository keeps a catalog and manifest rather than storing full image sets by default.",
    ],
};

const deepBlueFallback = {
    id: "deepblue",
    name: "Deep Blue data archive",
    category: "dataset",
    sourceUrl: deepBluePageUrl,
    summary: "University of Michigan's research data repository for curated datasets, documentation, and download links.",
    description: "Deep Blue Data is a preservation and discovery repository for research datasets spanning science, engineering, and social science. It is well suited for domain-specific training data and benchmark curation.",
    downloadTargets: [
        {name: "Deep Blue Data landing page", url: deepBluePageUrl, kind: "landing-page"},
        {name: "Deep Blue Data archive home", url: "https://deepblue.lib.umich.edu/data/", kind: "landing-page"},
    ],
    notes: [
        "The direct dataset landing page is preserved as the canonical link for each item.",
        "Review dataset-specific licenses and metadata before ingesting any archive into a training pipeline.",
    ],
};

const datasets = [
    await enrichDatasetManifest(openImagesFallback, openImagesPageUrl, /train_[a-z0-9._-]+\.tar\.gz|validation\.tar\.gz|test\.tar\.gz|\.zip/i),
    await enrichDatasetManifest(deepBlueFallback, deepBluePageUrl, /\.zip|\.tar|\.gz|\.csv|\.json|\.xlsx|\.pdf/i),
];

const catalog = {
    generatedAt: new Date().toISOString(),
    sourceUrls: [openImagesPageUrl, deepBluePageUrl],
    datasets,
};

await mkdir(outputDir, {recursive: true});
await writeFile(catalogOutputPath, JSON.stringify(catalog, null, 2) + "\n");
await writeFile(readmeOutputPath, buildReadme(catalog));
await writeFile(viewerOutputPath, buildViewerHtml());

console.log(`[training-datasets] wrote ${catalog.datasets.length} dataset manifests to ${path.relative(repoRoot, outputDir)}`);

async function enrichDatasetManifest(dataset, sourceUrl, regex) {
    const fetchedHtml = await tryFetchText(sourceUrl);
    const discoveredTargets = fetchedHtml
        ? extractDownloadTargets(fetchedHtml, regex)
        : [];

    return {
        ...dataset,
        downloadTargets: discoveredTargets.length > 0
            ? [
                ...dataset.downloadTargets.filter(target => target.kind === "landing-page" || target.kind === "repository"),
                ...discoveredTargets.slice(0, 8),
            ]
            : dataset.downloadTargets,
        fetchedAt: fetchedHtml ? new Date().toISOString() : null,
        fetchStatus: fetchedHtml ? "ok" : "fallback",
    };
}

async function tryFetchText(url) {
    try {
        const response = await fetch(url, {headers: {"User-Agent": userAgent}});
        if (!response.ok) {
            return null;
        }
        return await response.text();
    } catch {
        return null;
    }
}

function extractDownloadTargets(html, filenamePattern) {
    const urls = Array.from(new Set(
        Array.from(html.matchAll(/https?:\/\/[^\s"'<>]+/g), match => match[0])
    ));

    return urls
        .filter(url => filenamePattern.test(url))
        .slice(0, 10)
        .map(url => ({
            name: getFriendlyTargetName(url),
            url,
            kind: "archive",
        }));
}

function getFriendlyTargetName(url) {
    const parsed = new URL(url);
    const basename = path.basename(parsed.pathname);
    return basename || parsed.hostname;
}

function buildReadme(catalog) {
    const lines = [
        "# Training dataset catalogs",
        "",
        "This directory contains machine-readable manifests for external training resources that Lumi can use as a starting point for multimodal and domain-specific learning.",
        "",
        "## Included datasets",
        "",
        ...catalog.datasets.map(dataset => `- **${dataset.name}** — ${dataset.summary}`),
        "",
        "## Source URLs",
        "",
        ...catalog.sourceUrls.map(url => `- ${url}`),
        "",
        "## Viewer",
        "",
        "Open `public/dataset-viewer.html` in a browser or run the app and visit `/dataset-viewer.html` to browse the catalogs.",
        "",
    ];
    return lines.join("\n") + "\n";
}

function buildViewerHtml() {
    const lines = [
        "<!doctype html>",
        "<html lang=\"en\">",
        "  <head>",
        "    <meta charset=\"utf-8\">",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
        "    <title>Lumi dataset viewer</title>",
        "    <style>",
        "      :root { color-scheme: dark; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif; }",
        "      body { margin: 0; background: #07111c; color: #f5f7fa; }",
        "      main { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 3rem; }",
        "      h1 { margin-bottom: 0.5rem; }",
        "      p { color: #c6d2df; line-height: 1.6; }",
        "      .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin-top: 1.5rem; }",
        "      .card { background: rgba(9, 20, 32, 0.95); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1rem 1.2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }",
        "      .tag { display: inline-block; padding: 0.2rem 0.55rem; margin-right: 0.45rem; border-radius: 999px; background: rgba(58, 123, 213, 0.2); color: #8bc5ff; font-size: 0.85rem; }",
        "      .meta { font-size: 0.95rem; color: #9eb3c4; margin-bottom: 0.7rem; }",
        "      ul { padding-left: 1rem; color: #d3e2ef; }",
        "      a { color: #8bc5ff; }",
        "      code { background: rgba(255,255,255,0.06); padding: 0.15rem 0.35rem; border-radius: 4px; }",
        "      button { margin-top: 0.5rem; padding: 0.5rem 0.8rem; border: 0; border-radius: 8px; background: #2f6edb; color: white; cursor: pointer; }",
        "    </style>",
        "  </head>",
        "  <body>",
        "    <main>",
        "      <h1>Lumi dataset viewer</h1>",
        "      <p>This page browses the curated training datasets catalog generated for Lumi. It is intentionally lightweight so it can be opened locally or served from the app.</p>",
        "      <div id=\"status\">Loading catalogs…</div>",
        "      <div id=\"datasets\" class=\"grid\"></div>",
        "    </main>",
        "    <script>",
        "      async function loadCatalog() {",
        "        const statusEl = document.getElementById('status');",
        "        const datasetsEl = document.getElementById('datasets');",
        "        try {",
        "          const response = await fetch('/data/training-datasets/catalog.json');",
        "          if (!response.ok) throw new Error('Could not load catalog');",
        "          const catalog = await response.json();",
        "          statusEl.textContent = `Loaded ${catalog.datasets.length} dataset entry${catalog.datasets.length === 1 ? '' : 'ies'} from ${new Date(catalog.generatedAt).toLocaleString()}`;",
        "          datasetsEl.innerHTML = catalog.datasets.map(dataset => `",
        "            <article class=\"card\">",
        "              <h2>${dataset.name}</h2>",
        "              <p class=\"meta\"><span class=\"tag\">${dataset.category}</span><span class=\"tag\">${dataset.fetchStatus || 'ready'}</span></p>",
        "              <p>${dataset.description}</p>",
        "              <p><strong>Source:</strong> <a href=\"${dataset.sourceUrl}\" target=\"_blank\" rel=\"noreferrer\">${dataset.sourceUrl}</a></p>",
        "              <p><strong>Summary:</strong> ${dataset.summary}</p>",
        "              <ul>",
        "                ${dataset.downloadTargets.map(target => `<li><a href=\"${target.url}\" target=\"_blank\" rel=\"noreferrer\">${target.name}</a> <code>${target.kind}</code></li>`).join('')}",
        "              </ul>",
        "              ${dataset.notes && dataset.notes.length ? `<ul>${dataset.notes.map(note => `<li>${note}</li>`).join('')}</ul>` : ''}",
        "            </article>",
        "          `).join('');",
        "        } catch (error) {",
        "          statusEl.innerHTML = `<strong>Unable to load catalog:</strong> ${error.message}`;",
        "        }",
        "      }",
        "      loadCatalog();",
        "    </script>",
        "  </body>",
        "</html>",
        "",
    ];
    return lines.join("\n");
}
