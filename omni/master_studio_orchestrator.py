import asyncio
import threading
import time
from typing import Dict, Optional

from omni.cluster_daemon import ClusterWatchdogDaemon
from omni.master_production_runner import CompleteAutonomousVideoProducer
from omni.studio_logger import DistributedStudioLogger, send_node_log
from omni.studio_supervisor import StudioSupervisorEngine


class AbsoluteStudioCore:
    """Coordinates script generation, live logging, and media rendering into a single pipeline."""

    def __init__(self) -> None:
        self.supervisor = StudioSupervisorEngine()
        self.logger_aggregator = DistributedStudioLogger()
        self.producer = CompleteAutonomousVideoProducer()

    def run_logger_thread(self) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self.logger_aggregator.start_aggregator_server())

    def start_studio_pipeline(self, primary_idea: str) -> None:
        print("=================================================================")
        print("⚡ ACTIVATING COMPLETE AUTONOMOUS DIGITAL PRODUCTION STUDIO CORE ⚡")
        print("=================================================================")

        log_thread = threading.Thread(target=self.run_logger_thread, daemon=True)
        log_thread.start()
        time.sleep(1)

        self.supervisor.script_generator_agent(seed_concept=primary_idea, total_scenes=3)
        while True:
            job = self.supervisor.get_next_job()
            if job is None:
                print("\n🏁 Production queue empty. All cinematic tasks compiled.")
                break

            scene_idx = job["scene_index"]
            send_node_log("127.0.0.1", 9001, node_id=1, level="INFO", message=f"Commencing processing cycle for Scene {scene_idx}")
            try:
                movie_out, audio_out = self.producer.produce_autonomous_movie(prompt_tokens=list(job.get("text_tokens", [])), target_format=str(job.get("format", "mp4")))
                print(f"🎬 Scene {scene_idx} successfully exported:")
                print(f"  -> Video file path: {movie_out}")
                print(f"  -> Audio file path: {audio_out}")
            except Exception as exc:
                send_node_log("127.0.0.1", 9001, node_id=1, level="ERROR", message=f"Failed compilation target on scene {scene_idx}: {exc}")
                ClusterWatchdogDaemon.force_vram_garbage_collection()


if __name__ == "__main__":
    studio = AbsoluteStudioCore()
    film_idea = "A lonely deep-space satellite discovers an uncharted biological planet"
    studio.start_studio_pipeline(primary_idea=film_idea)
