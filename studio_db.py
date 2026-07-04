import os
import sqlite3
import time
from typing import Any, Dict, List, Optional


class StudioDatabaseController:
    """Manages queueing and asset tracking for local studio jobs via SQLite."""

    def __init__(self, db_path: Optional[str] = None) -> None:
        self.db_path = os.path.abspath(db_path or os.getenv("STUDIO_DB_PATH", "studio_vault.db"))
        self._initialize_database_tables()

    def _get_connection(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize_database_tables(self) -> None:
        with self._get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS studio_jobs (
                    job_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    seed_concept TEXT NOT NULL,
                    status TEXT DEFAULT 'PENDING',
                    created_at REAL,
                    completed_at REAL
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS render_scenes (
                    scene_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id INTEGER,
                    scene_index INTEGER,
                    prompt_text TEXT,
                    voice_id INTEGER,
                    video_format TEXT,
                    status TEXT DEFAULT 'QUEUED',
                    video_file_path TEXT,
                    audio_file_path TEXT,
                    FOREIGN KEY(job_id) REFERENCES studio_jobs(job_id)
                )
                """
            )
            connection.commit()

    def create_new_studio_job(self, seed_concept: str) -> int:
        with self._get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(
                "INSERT INTO studio_jobs (seed_concept, created_at) VALUES (?, ?)",
                (seed_concept, time.time()),
            )
            return int(cursor.lastrowid)

    def add_scene_to_job(self, job_id: int, scene_idx: int, prompt: str, voice_id: int, fmt: str = "MP4") -> None:
        with self._get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(
                """
                INSERT INTO render_scenes (job_id, scene_index, prompt_text, voice_id, video_format)
                VALUES (?, ?, ?, ?, ?)
                """,
                (job_id, scene_idx, prompt, voice_id, fmt),
            )

    def fetch_next_queued_scene(self) -> Optional[Dict[str, Any]]:
        with self._get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(
                "SELECT * FROM render_scenes WHERE status = 'QUEUED' ORDER BY scene_id ASC LIMIT 1"
            )
            row = cursor.fetchone()
            return dict(row) if row else None

    def update_scene_status(self, scene_id: int, status: str, video_path: Optional[str] = None, audio_path: Optional[str] = None) -> None:
        with self._get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(
                """
                UPDATE render_scenes
                SET status = ?, video_file_path = ?, audio_file_path = ?
                WHERE scene_id = ?
                """,
                (status, video_path, audio_path, scene_id),
            )

    def get_all_completed_assets(self) -> List[Dict[str, Any]]:
        with self._get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(
                "SELECT * FROM render_scenes WHERE status = 'COMPLETED' ORDER BY scene_id DESC"
            )
            return [dict(row) for row in cursor.fetchall()]
