import os
import tempfile
import unittest

from omni.audio_visual_gates import AudioToVideoGatingMatrix
from omni.cluster_daemon import ClusterWatchdogDaemon
from omni.master_studio_orchestrator import AbsoluteStudioCore
from omni.studio_logger import DistributedStudioLogger
from omni.studio_supervisor import StudioSupervisorEngine


class OmniStudioModuleTests(unittest.TestCase):
    def test_audio_gating_accepts_lists(self) -> None:
        gate = AudioToVideoGatingMatrix(embed_dim=3, n_heads=1)
        camera_tokens = [[[0.2, -0.1, 0.3]]]
        audio_tokens = [[[0.5, 0.1, -0.2], [0.1, 0.2, 0.3]]]
        output = gate.forward(camera_tokens, audio_tokens)
        self.assertEqual(len(output), 1)
        self.assertEqual(len(output[0]), 1)
        self.assertEqual(len(output[0][0]), 3)

    def test_supervisor_creates_jobs(self) -> None:
        supervisor = StudioSupervisorEngine()
        supervisor.script_generator_agent("test concept", total_scenes=2)
        first_job = supervisor.get_next_job()
        second_job = supervisor.get_next_job()
        self.assertIsNotNone(first_job)
        self.assertIsNotNone(second_job)
        self.assertEqual(first_job["scene_index"], 0)
        self.assertEqual(second_job["scene_index"], 1)

    def test_logger_and_daemon_modules_load(self) -> None:
        logger = DistributedStudioLogger(host="127.0.0.1", port=0)
        self.assertEqual(logger.host, "127.0.0.1")
        ClusterWatchdogDaemon.force_vram_garbage_collection()
        orchestrator = AbsoluteStudioCore()
        self.assertIsNotNone(orchestrator.supervisor)


if __name__ == "__main__":
    unittest.main()
