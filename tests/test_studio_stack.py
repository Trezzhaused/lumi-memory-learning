import os
import tempfile
import unittest

from studio_db import StudioDatabaseController
from studio_web_hub import StudioWebHub


class StudioStackTests(unittest.TestCase):
    def test_database_tracks_jobs_and_assets(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "studio.db")
            db = StudioDatabaseController(db_path=db_path)
            job_id = db.create_new_studio_job("Cyberpunk drone race")
            db.add_scene_to_job(job_id, 0, "Scene 0 prompt", 7, "MP4")

            queued_scene = db.fetch_next_queued_scene()
            self.assertIsNotNone(queued_scene)
            self.assertEqual(queued_scene["job_id"], job_id)

            db.update_scene_status(queued_scene["scene_id"], "COMPLETED", "render_vault/out.mp4", "render_vault/out.wav")
            completed_assets = db.get_all_completed_assets()
            self.assertEqual(len(completed_assets), 1)
            self.assertEqual(completed_assets[0]["video_file_path"], "render_vault/out.mp4")

    def test_web_hub_builds_dashboard_page(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db = StudioDatabaseController(db_path=os.path.join(tmpdir, "studio.db"))
            hub = StudioWebHub(db_controller=db)
            html = hub.build_home_page()
            self.assertIn("Autonomous Multi-Modal Studio Engine", html)
            self.assertIn("/api/submit", html)


if __name__ == "__main__":
    unittest.main()
