import os
import shutil
import tempfile
import unittest

from omni.cinematic_motion import CinematicCameraTokenizer
from omni.consistency_engine import SpatioTemporalConsistencyCache
from omni.hyperparameter_orchestrator import AutonomousGridOrchestrator
from omni.master_production_runner import CompleteAutonomousVideoProducer


class OmniProductionTests(unittest.TestCase):
    def test_camera_tokenizer_builds_motion_tokens(self) -> None:
        tokenizer = CinematicCameraTokenizer(embed_dim=8)
        tokens = tokenizer.forward([[[0.1, -0.2, 0.3, 0.4, -0.5, 0.6]]])
        self.assertEqual(len(tokens), 1)
        self.assertEqual(len(tokens[0][0]), 6)

    def test_consistency_cache_tracks_history(self) -> None:
        cache = SpatioTemporalConsistencyCache(cache_size=2)
        first = cache.update_and_get_context([[[0.1, 0.2]]])
        second = cache.update_and_get_context([[[0.3, 0.4]]])
        third = cache.update_and_get_context([[[0.5, 0.6]]])
        self.assertEqual(len(first), 1)
        self.assertEqual(len(second), 2)
        self.assertEqual(len(third), 2)

    def test_grid_orchestrator_writes_configs(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            orchestrator = AutonomousGridOrchestrator(configs_base_dir=tmpdir)
            paths = orchestrator.generate_search_matrix()
            self.assertEqual(len(paths), 12)
            self.assertTrue(os.path.exists(paths[0]))

    def test_production_runner_writes_assets(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            prev = os.getcwd()
            os.chdir(tmpdir)
            try:
                runner = CompleteAutonomousVideoProducer()
                movie_path, audio_path = runner.produce_autonomous_movie([101, 202, 303], target_format="mp4")
                self.assertTrue(os.path.exists(movie_path))
                self.assertTrue(os.path.exists(audio_path))
            finally:
                os.chdir(prev)


if __name__ == "__main__":
    unittest.main()
