import gc
import subprocess
import sys
import time
from typing import Optional

try:  # pragma: no cover - optional dependency
    import torch
except Exception:  # pragma: no cover - optional dependency
    torch = None


class ClusterWatchdogDaemon:
    """Monitors the local production process and purges stale VRAM state when needed."""

    def __init__(self, managed_script_path: str) -> None:
        self.managed_script_path = managed_script_path

    @staticmethod
    def force_vram_garbage_collection() -> None:
        print("🧹 Running forced hardware VRAM purge sweep...")
        gc.collect()
        if torch is not None and torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
        print("✅ Unused GPU memory blocks released successfully.")

    def run_cluster_process_with_auto_restart(self, max_iterations: Optional[int] = 1) -> None:
        iterations = 0
        while True:
            print(f"\n🔄 Watchdog launching master production instance: {self.managed_script_path}")
            process = subprocess.Popen([sys.executable, self.managed_script_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            while True:
                poll = process.poll()
                if poll is not None:
                    if poll == 0:
                        print("🎉 Production task finished cleanly. Awaiting next queue cycle.")
                        return
                    print(f"🚨 CRITICAL SYSTEM FAULT: Cluster execution crashed with exit code {poll}.")
                    self.force_vram_garbage_collection()
                    print("Rebooting cluster from latest checkpoint in 5 seconds...")
                    time.sleep(5)
                    break
                time.sleep(2)
            iterations += 1
            if max_iterations is not None and iterations >= max_iterations:
                return
