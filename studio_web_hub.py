import asyncio
import contextlib
import json
import os
import urllib.parse
from pathlib import Path
from typing import Optional

from omni.master_production_runner import CompleteAutonomousVideoProducer
from omni.studio_supervisor import StudioSupervisorEngine
from studio_db import StudioDatabaseController


class StudioWebHub:
    """Local asyncio-based web controller for the Omni studio pipeline."""

    def __init__(self, db_controller: Optional[StudioDatabaseController] = None, producer: Optional[CompleteAutonomousVideoProducer] = None, supervisor: Optional[StudioSupervisorEngine] = None) -> None:
        self.db = db_controller or StudioDatabaseController()
        self.producer = producer or CompleteAutonomousVideoProducer()
        self.supervisor = supervisor or StudioSupervisorEngine()
        self._stop_event = asyncio.Event()

    def build_home_page(self) -> str:
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Autonomous Omni-Studio Console</title>
            <style>
                body { font-family: -apple-system, sans-serif; background: #121214; color: #e1e1e6; padding: 40px; }
                .card { background: #1d1d22; padding: 24px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
                input[type="text"] { width: 70%; padding: 12px; background: #29292e; border: 1px solid #444; border-radius: 4px; color: #fff; }
                button { padding: 12px 24px; background: #4f46e5; border: none; border-radius: 4px; color: #fff; cursor: pointer; }
                video { width: 100%; max-width: 400px; border-radius: 6px; margin-top: 10px; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 20px; }
            </style>
        </head>
        <body>
            <h1>🎬 Autonomous Multi-Modal Studio Engine</h1>
            <div class="card">
                <h3>Spawn New Production Job</h3>
                <input type="text" id="concept" placeholder="Enter high-level prompt idea sequence...">
                <button onclick="submitJob()">Trigger Creation Pipeline</button>
            </div>
            <h2>🎥 Completed Native Assets</h2>
            <div class="grid" id="assets-grid"></div>
            <script>
                async function loadAssets() {
                    const res = await fetch('/api/assets');
                    const data = await res.json();
                    const grid = document.getElementById('assets-grid');
                    grid.innerHTML = '';
                    data.forEach(scene => {
                        grid.innerHTML += `
                            <div class="card">
                                <h4>Scene #${scene.scene_index} (Job ID: ${scene.job_id})</h4>
                                <p><em>${scene.prompt_text}</em></p>
                                <video controls src="/${scene.video_file_path}"></video>
                                <audio controls src="/${scene.audio_file_path}" style="width:100%; margin-top:10px;"></audio>
                            </div>
                        `;
                    });
                }
                async function submitJob() {
                    const concept = document.getElementById('concept').value;
                    if (!concept) return;
                    await fetch('/api/submit', { method: 'POST', body: JSON.stringify({ concept }) });
                    alert('Job committed to local SQLite database tracking states.');
                    document.getElementById('concept').value = '';
                    setTimeout(loadAssets, 2000);
                }
                setInterval(loadAssets, 5000);
                loadAssets();
            </script>
        </body>
        </html>
        """

    async def _send_json(self, writer: asyncio.StreamWriter, payload: object, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        writer.write(f"HTTP/1.1 {status} OK\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n".encode("ascii"))
        writer.write(body)
        await writer.drain()
        writer.close()
        await writer.wait_closed()

    async def _send_text(self, writer: asyncio.StreamWriter, body: str, content_type: str, status: int = 200) -> None:
        payload = body.encode("utf-8")
        writer.write(f"HTTP/1.1 {status} OK\r\nContent-Type: {content_type}\r\nContent-Length: {len(payload)}\r\nConnection: close\r\n\r\n".encode("ascii"))
        writer.write(payload)
        await writer.drain()
        writer.close()
        await writer.wait_closed()

    async def _send_file(self, writer: asyncio.StreamWriter, file_path: Path) -> None:
        if not file_path.exists() or not file_path.is_file():
            await self._send_text(writer, "Not Found", "text/plain; charset=utf-8", status=404)
            return
        body = file_path.read_bytes()
        content_type = "video/mp4" if file_path.suffix.lower() == ".mp4" else "audio/wav" if file_path.suffix.lower() == ".wav" else "application/octet-stream"
        writer.write(f"HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n".encode("ascii"))
        writer.write(body)
        await writer.drain()
        writer.close()
        await writer.wait_closed()

    async def _handle_request(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            request_line = await asyncio.wait_for(reader.readline(), timeout=2.0)
            if not request_line:
                return
            method, path, _ = request_line.decode("utf-8").split(" ", 2)
            parsed = urllib.parse.urlparse(path)
            if method == "GET" and parsed.path == "/api/assets":
                await self._send_json(writer, self.db.get_all_completed_assets())
                return
            if method == "GET" and parsed.path.startswith("/render_vault/"):
                relative_path = parsed.path.lstrip("/")
                asset_path = Path(relative_path)
                if asset_path.is_absolute() or ".." in asset_path.parts:
                    await self._send_text(writer, "Forbidden", "text/plain; charset=utf-8", status=403)
                    return
                await self._send_file(writer, asset_path)
                return
            if method == "GET" and parsed.path in {"/", "/index.html"}:
                await self._send_text(writer, self.build_home_page(), "text/html; charset=utf-8")
                return
            if method == "POST" and parsed.path == "/api/submit":
                body = b""
                while True:
                    line = await asyncio.wait_for(reader.readline(), timeout=2.0)
                    if line in {b"\r\n", b"\n", b""}:
                        break
                    if b"Content-Length:" in line:
                        content_length = int(line.decode("utf-8").split(":", 1)[1].strip())
                        body = await asyncio.wait_for(reader.readexactly(content_length), timeout=2.0)
                        break
                payload = json.loads(body.decode("utf-8"))
                concept = payload.get("concept", "Undefined project run")
                job_id = self.db.create_new_studio_job(concept)
                self.supervisor.script_generator_agent(seed_concept=concept, total_scenes=2)
                for _ in range(2):
                    job_manifest = self.supervisor.get_next_job()
                    if not job_manifest:
                        break
                    self.db.add_scene_to_job(
                        job_id,
                        scene_idx=int(job_manifest["scene_index"]),
                        prompt=str(job_manifest.get("prompt_text", concept)),
                        voice_id=int(job_manifest.get("voice_id", 0)),
                        fmt=str(job_manifest.get("format", "MP4")),
                    )
                await self._send_json(writer, {"status": "QUEUED", "job_id": job_id}, status=201)
                return
            await self._send_text(writer, "Not Found", "text/plain; charset=utf-8", status=404)
        except Exception as exc:  # pragma: no cover - defensive web path
            await self._send_text(writer, str(exc), "text/plain; charset=utf-8", status=500)
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    async def _background_render_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                task = self.db.fetch_next_queued_scene()
                if task:
                    scene_id = int(task["scene_id"])
                    prompt_text = str(task.get("prompt_text", ""))
                    prompt_tokens = [ord(char) % 97 for char in prompt_text if char.isalnum()]
                    if not prompt_tokens:
                        prompt_tokens = [42, 17, 9, 64]
                    prompt_tokens = (prompt_tokens + [0] * 32)[:32]
                    movie_path, audio_path = self.producer.produce_autonomous_movie(
                        prompt_tokens=prompt_tokens,
                        target_format=str(task.get("video_format", "MP4")).lower(),
                    )
                    self.db.update_scene_status(scene_id, status="COMPLETED", video_path=movie_path, audio_path=audio_path)
            except Exception as exc:  # pragma: no cover - defensive worker path
                print(f"Background worker error: {exc}")
            await asyncio.sleep(3.0)

    async def serve_forever(self, host: str = "127.0.0.1", port: int = 8080) -> None:
        server = await asyncio.start_server(self._handle_request, host, port)
        worker_task = asyncio.create_task(self._background_render_loop())
        try:
            async with server:
                await server.serve_forever()
        finally:
            self._stop_event.set()
            worker_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await worker_task
            server.close()
            await server.wait_closed()


def launch_local_studio_stack(port: int = 8080) -> None:
    hub = StudioWebHub()
    asyncio.run(hub.serve_forever(port=port))


if __name__ == "__main__":
    launch_local_studio_stack()
