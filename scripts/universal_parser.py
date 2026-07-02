import csv
import json
import os
import sys


def parse_incoming_file(file_path):
    if not os.path.exists(file_path):
        return {"status": "error", "message": "File path does not exist."}

    extension = os.path.splitext(file_path)[1].lower()
    extracted_text = ""

    try:
        if extension == ".pdf":
            try:
                from pypdf import PdfReader
            except Exception:
                return {
                    "status": "error",
                    "message": "PDF extraction requires the pypdf package.",
                }
            reader = PdfReader(file_path)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
        elif extension == ".csv":
            with open(file_path, mode="r", encoding="utf-8", errors="ignore") as handle:
                reader = csv.reader(handle)
                for row in reader:
                    extracted_text += " | ".join(row) + "\n"
        elif extension in [".txt", ".log", ".json", ".md", ".yaml", ".yml", ".xml"]:
            with open(file_path, mode="r", encoding="utf-8", errors="ignore") as handle:
                extracted_text = handle.read()
        else:
            return {"status": "ignored", "message": f"Extension {extension} not targeted for auto-ingestion."}

        chunk_size = 3000
        chunks = [extracted_text[i:i + chunk_size] for i in range(0, len(extracted_text), chunk_size)]
        return {
            "status": "success",
            "file_name": os.path.basename(file_path),
            "file_type": extension,
            "extracted_text": extracted_text,
            "total_chunks": len(chunks),
            "payload_segments": chunks,
        }
    except Exception as exc:  # pragma: no cover - defensive fallback
        return {"status": "error", "message": str(exc)}


if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(parse_incoming_file(sys.argv[1])))
