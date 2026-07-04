import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, Optional

from omni.master_backend_orchestrator import MasterBackendOrchestrator

try:  # pragma: no cover - optional dependency
    import grpc
except Exception:  # pragma: no cover - optional dependency
    grpc = None

try:  # pragma: no cover - optional dependency
    import omni_stream_pb2  # type: ignore
    import omni_stream_pb2_grpc  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    omni_stream_pb2 = None
    omni_stream_pb2_grpc = None


@dataclass
class MediaStreamChunk:
    video_frame_bytes: bytes
    audio_pcm_bytes: bytes
    mesh_delta_bytes: bytes
    frame_index: int


class OmniStreamingService:
    """Adapts the orchestrator into a streaming interface suitable for gRPC or local testing."""

    def __init__(self, orchestrator: Optional[MasterBackendOrchestrator] = None) -> None:
        self.orchestrator = orchestrator or MasterBackendOrchestrator()

    async def generate_media_stream(self, request: Any, context: Any) -> AsyncIterator[MediaStreamChunk]:
        prompt_tokens = list(getattr(request, "prompt_tokens", []))
        target_fps = getattr(request, "target_fps", 24) or 24
        frame_count = getattr(request, "frame_count", 8) or 8
        voice_id = getattr(request, "voice_id", 0)

        async for chunk in self.orchestrator.stream_media_chunks_async(
            prompt_tokens=prompt_tokens,
            frames=frame_count,
            fps=target_fps,
            voice_id=voice_id,
        ):
            if omni_stream_pb2 is not None:
                yield omni_stream_pb2.MediaStreamChunk(
                    video_frame_bytes=chunk["video_frame_bytes"],
                    audio_pcm_bytes=chunk["audio_pcm_bytes"],
                    mesh_delta_bytes=chunk["mesh_delta_bytes"],
                    frame_index=chunk["frame_index"],
                )
            else:
                yield MediaStreamChunk(**chunk)


async def serve_grpc_system(host: str = "[::]:50051") -> None:
    logging.basicConfig(level=logging.INFO)
    if grpc is None or omni_stream_pb2_grpc is None:
        logging.warning("gRPC runtime is not installed; skipping server startup")
        return

    server = grpc.aio.server()
    omni_stream_pb2_grpc.add_OmniStreamingEngineServicer_to_server(OmniStreamingService(), server)
    listen_addr = server.add_insecure_port(host)
    if listen_addr == 0:
        raise RuntimeError("Could not bind gRPC server to requested address")
    logging.info("Omni media streaming server listening on %s", host)
    await server.start()
    await server.wait_for_termination()
