#!/usr/bin/env python3
import json
import posixpath
import re
from pathlib import Path
from typing import Any

import requests

REPO_URL = "https://raw.githubusercontent.com/voxel51/voxel51-docs/main/docs/data/dataset_zoo/datasets.md"
RAW_BASE = "https://raw.githubusercontent.com/voxel51/voxel51-docs/main/"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "data" / "voxel51"
IMAGES_DIR = OUTPUT_DIR / "images"
CATALOG_PATH = OUTPUT_DIR / "dataset-zoo-catalog.json"
SUMMARY_PATH = OUTPUT_DIR / "dataset-zoo-summary.md"


def download_text(url: str) -> str:
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return response.text


def download_binary(url: str, destination: Path) -> Path:
    if destination.exists():
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    destination.write_bytes(response.content)
    return destination


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "dataset"


def parse_dataset_sections(markdown: str) -> list[tuple[str, str]]:
    pattern = re.compile(r"^##\s+(.*)$", re.MULTILINE)
    matches = list(pattern.finditer(markdown))
    sections: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        heading = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        content = markdown[start:end]
        sections.append((heading, content))
    return sections


def extract_details(section_content: str) -> dict[str, str]:
    details: dict[str, str] = {}
    for line in section_content.splitlines():
        stripped = line.strip()
        if stripped.startswith("- Dataset name:"):
            details["dataset_name"] = re.sub(r"[`*]", "", stripped.split(":", 1)[1]).strip()
        elif stripped.startswith("- Dataset source:"):
            source_match = re.search(r"\[(.*?)\]\((.*?)\)", stripped)
            details["source"] = source_match.group(2) if source_match else stripped.split(":", 1)[1].strip()
        elif stripped.startswith("- Dataset size:"):
            details["size"] = stripped.split(":", 1)[1].strip()
        elif stripped.startswith("- Tags:"):
            tags_raw = stripped.split(":", 1)[1].strip()
            details["tags"] = tags_raw.strip("`")
        elif stripped.startswith("- Supported splits:"):
            details["splits"] = stripped.split(":", 1)[1].strip()
    return details


def extract_description(section_content: str) -> str:
    pre_details = section_content.split("**Details**", 1)[0]
    cleaned = re.sub(r"!\[[^\]]*\]\(([^)]+)\)", "", pre_details)
    cleaned = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", cleaned)
    cleaned = re.sub(r"[`*_#]", "", cleaned)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", cleaned) if p.strip()]
    if not paragraphs:
        return ""
    description = re.sub(r"\s+", " ", paragraphs[0]).strip()
    return description[:800]


def extract_images(section_content: str) -> list[str]:
    image_refs = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", section_content)
    resolved: list[str] = []
    for ref in image_refs:
        ref = ref.strip()
        if not ref:
            continue
        if ref.startswith("http"):
            resolved.append(ref)
            continue
        normalized = posixpath.normpath(posixpath.join("docs/data/dataset_zoo", ref))
        resolved.append(f"{RAW_BASE}{normalized}")
    return resolved


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    markdown = download_text(REPO_URL)
    sections = parse_dataset_sections(markdown)

    catalog: list[dict[str, Any]] = []
    for heading, section_content in sections:
        details = extract_details(section_content)
        description = extract_description(section_content)
        image_urls = extract_images(section_content)
        image_files: list[str] = []
        for image_url in image_urls:
            filename = Path(image_url.split("/")[-1]).name
            destination = IMAGES_DIR / filename
            try:
                download_binary(image_url, destination)
                image_files.append(destination.name)
            except Exception as exc:  # pragma: no cover - network/network errors can happen
                print(f"Skipping image {image_url}: {exc}")

        dataset_name = details.get("dataset_name") or heading
        tags = [tag.strip() for tag in details.get("tags", "").split(",") if tag.strip()]
        catalog.append({
            "name": dataset_name,
            "slug": slugify(dataset_name),
            "heading": heading,
            "description": description,
            "source": details.get("source", ""),
            "size": details.get("size", ""),
            "tags": tags,
            "splits": details.get("splits", ""),
            "images": image_files,
        })

    CATALOG_PATH.write_text(json.dumps(catalog, indent=2), encoding="utf-8")

    summary_lines = [
        "# Voxel51 Dataset Zoo Catalog",
        "",
        f"Captured {len(catalog)} datasets from {REPO_URL}",
        "",
        "## Dataset summary",
        "",
    ]
    for entry in catalog:
        summary_lines.append(f"- {entry['name']} ({', '.join(entry['tags']) or 'untagged'})")
    SUMMARY_PATH.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")

    print(f"Wrote {CATALOG_PATH} and {SUMMARY_PATH}")
    print(f"Downloaded {sum(len(entry['images']) for entry in catalog)} images to {IMAGES_DIR}")


if __name__ == "__main__":
    main()
