import os
import sys
import time

import requests

WATCH_DIRECTORY = os.environ.get("LUMI_INGESTION_ROOT", os.path.join(os.getcwd(), ".data", "ingestion", "incoming"))
WEBHOOK_URL = os.environ.get("LUMI_INGESTION_WEBHOOK_URL", "http://localhost:3001/api/lumi/ingestion/process")


class FileHandler:
    def on_created(self, event):
        if event.is_directory or event.src_path.endswith(".lock") or event.src_path.endswith(".tmp"):
            return
        filename = os.path.basename(event.src_path)
        print(f"Detected new file: {filename}")
        try:
            requests.post(WEBHOOK_URL, json={"filename": filename, "sourcePath": event.src_path}, timeout=10)
        except Exception as exc:  # pragma: no cover - defensive fallback
            print(f"Watcher dispatch failed: {exc}")


if __name__ == "__main__":
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler
    except Exception as exc:
        print(f"watchdog is not installed: {exc}")
        sys.exit(1)

    class WatcherHandler(FileSystemEventHandler, FileHandler):
        pass

    os.makedirs(WATCH_DIRECTORY, exist_ok=True)
    event_handler = WatcherHandler()
    observer = Observer()
    observer.schedule(event_handler, path=WATCH_DIRECTORY, recursive=False)
    observer.start()
    print(f"Watcher active on {WATCH_DIRECTORY}")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
