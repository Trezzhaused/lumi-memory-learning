import asyncio
import json
import os
from typing import Any, AsyncIterator, Dict, List, Optional

from omni.audio_neural_codec import OmniAudioSynthesisNetwork
from omni.multi_format_writer import MultiFormatBinaryTransmuxer
from omni.voice_registry import VoiceProfileRegistry


class MasterBackendOrchestrator:
    """Coordinates deterministic audio synthesis, media chunking, and local artifact export."""

    def __init__(
        self,
        voice_registry: Optional[VoiceProfileRegistry] = None,
        audio_codec: Optional[OmniAudioSynthesisNetwork] = None,
        muxer: Optional[type] = None,
    ) -> None:
        self.voice_registry = voice_registry or VoiceProfileRegistry()
        self.audio_codec = audio_codec or OmniAudioSynthesisNetwork()
        self.muxer = muxer or MultiFormatBinaryTransmuxer

    def _token_to_latent(self, prompt_tokens: List[int]) -> List[float]:
        return [float(token % 17) / 17.0 for token in prompt_tokens]

    def _encode_frame_bytes(self, frame_index: int, prompt_tokens: List[int]) -> bytes:
        payload = f"frame:{frame_index}:tokens:{len(prompt_tokens)}".encode("utf-8")
        return payload

    def _encode_mesh_bytes(self, frame_index: int, prompt_tokens: List[int]) -> bytes:
        mesh_values = [float(frame_index + token % 7) / 7.0 for token in prompt_tokens[:10]]
        return json.dumps(mesh_values).encode("utf-8")

    def _encode_audio_bytes(self, audio_waveform: List[float], sample_rate: int = 16000) -> bytes:
        return self.muxer.build_wav_bytes(audio_waveform, sample_rate=sample_rate)

    def build_media_chunk(self, frame_index: int, prompt_tokens: List[int], voice_id: int = 0) -> Dict[str, Any]:
        voice_embedding = self.voice_registry.get_voice_embedding(voice_id)
        latent_state = self._token_to_latent(prompt_tokens)
        audio_waveform = self.audio_codec.forward(latent_state, voice_embedding=voice_embedding)
        return {
            "video_frame_bytes": self._encode_frame_bytes(frame_index, prompt_tokens),
            "audio_pcm_bytes": self._encode_audio_bytes(audio_waveform),
            "mesh_delta_bytes": self._encode_mesh_bytes(frame_index, prompt_tokens),
            "frame_index": frame_index,
        }

    async def stream_media_chunks_async(self, prompt_tokens: List[int], frames: int = 8, fps: int = 24, voice_id: int = 0) -> AsyncIterator[Dict[str, Any]]:
        for frame_index in range(frames):
            yield self.build_media_chunk(frame_index, prompt_tokens, voice_id=voice_id)
            if frame_index < frames - 1:
                await asyncio.sleep(1.0 / max(1, fps))

    def generate_media_bundle(
        self,
        prompt: str,
        output_dir: str = "outputs",
        voice_id: int = 0,
        frames: int = 8,
        fps: int = 24,
        sample_rate: int = 16000,
    ) -> Dict[str, str]:
        prompt_tokens = [ord(ch) % 97 for ch in prompt if ch.isalnum()]
        if not prompt_tokens:
            prompt_tokens = [42, 17, 9, 64]

        os.makedirs(output_dir, exist_ok=True)
        audio_waveform = self.audio_codec.forward(
            self._token_to_latent(prompt_tokens),
            voice_embedding=self.voice_registry.get_voice_embedding(voice_id),
        )
        audio_path = os.path.join(output_dir, "generated_audio.wav")
        manifest_path = os.path.join(output_dir, "media_manifest.json")
        self.muxer.write_wav_file(audio_waveform, audio_path, sample_rate=sample_rate)

        manifest = {
            "prompt": prompt,
            "voice_id": voice_id,
            "frames": frames,
            "fps": fps,
            "sample_rate": sample_rate,
            "audio_path": audio_path,
            "chunk_count": frames,
        }
        with open(manifest_path, "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=2)

        return {"audio_path": audio_path, "manifest_path": manifest_path}
