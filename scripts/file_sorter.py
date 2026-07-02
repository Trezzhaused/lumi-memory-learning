import json
import os
import shutil
import sys


VALID_CATEGORIES = ["Financials", "Manuscripts", "System_Logs", "General_Reference"]


def relocate_file(source_path, category):
    if not os.path.exists(source_path):
        return {"status": "error", "message": f"Source file {source_path} not found."}

    target_category = category if category in VALID_CATEGORIES else "General_Reference"
    base_dir = os.environ.get("LUMI_INGESTION_ROOT", os.path.join(os.getcwd(), ".data", "ingestion"))
    destination_dir = os.path.join(base_dir, target_category)
    os.makedirs(destination_dir, exist_ok=True)
    destination_path = os.path.join(destination_dir, os.path.basename(source_path))

    shutil.move(source_path, destination_path)
    return {
        "status": "success",
        "moved_file": os.path.basename(source_path),
        "target_folder": target_category,
        "final_path": destination_path,
    }


if __name__ == "__main__":
    if len(sys.argv) > 2:
        print(json.dumps(relocate_file(sys.argv[1], sys.argv[2])))
