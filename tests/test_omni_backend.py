import json
import os
import tempfile
import unittest
import wave

from omni.audio_neural_codec import OmniAudioSynthesisNetwork
from omni.master_backend_orchestrator import MasterBackendOrchestrator
from omni.multi_format_writer import MultiFormatBinaryTransmuxer
from omni.voice_registry import VoiceProfileRegistry


class OmniBackendTests(unittest.TestCase):
    def test_voice_registry_generates_expected_embeddings(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            registry_path = os.path.join(tmpdir, "voice_registry.json")
            registry = VoiceProfileRegistry(embedding_dim=8, registry_path=registry_path)
            self.assertEqual(len(registry.voice_matrix), 1000)
            self.assertEqual(len(registry.voice_matrix[0]), 8)
            self.assertEqual(registry.get_voice_embedding(0)[0], registry.voice_matrix[0][0])

    def test_audio_codec_returns_expected_length(self) -> None:
        codec = OmniAudioSynthesisNetwork(out_samples=128)
        waveform = codec.forward([0.25, 0.5, 0.75], voice_embedding=[0.1, -0.2, 0.3])
        self.assertEqual(len(waveform), 128)
        self.assertTrue(all(-1.0 <= sample <= 1.0 for sample in waveform))

    def test_wav_writer_and_orchestrator_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = os.path.join(tmpdir, "generated.wav")
            MultiFormatBinaryTransmuxer.write_wav_file([0.0, 0.5, -0.5], audio_path, sample_rate=16000)
            with wave.open(audio_path, "rb") as handle:
                self.assertEqual(handle.getframerate(), 16000)
                self.assertEqual(handle.getnframes(), 3)

            orchestrator = MasterBackendOrchestrator()
            result = orchestrator.generate_media_bundle("Create a cinematic scene", output_dir=tmpdir, voice_id=1, frames=4, fps=24)
            self.assertTrue(os.path.exists(result["audio_path"]))
            self.assertTrue(os.path.exists(result["manifest_path"]))
            with open(result["manifest_path"], "r", encoding="utf-8") as handle:
                payload = json.load(handle)
            self.assertEqual(payload["frames"], 4)
            self.assertEqual(payload["fps"], 24)


if __name__ == "__main__":
    unittest.main()
