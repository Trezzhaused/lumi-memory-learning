import unittest

try:  # pragma: no cover - optional dependency
    import torch
except Exception:  # pragma: no cover - optional dependency
    torch = None

from audio_visual_gates import AudioToVideoGatingMatrix
from fast_stream_remuxer import FastMemoryStreamRemuxer
from omni_model_core import AbsoluteOmniEngine
from optimized_attention import FlashBlockSparseAttention


class TestAutonomousStudioBackend(unittest.TestCase):
    def setUp(self) -> None:
        self.device = "cpu"
        self.embed_dim = 768
        self.batch_size = 1

    def _make_input(self, seq_len: int):
        if torch is not None:
            return torch.randn(self.batch_size, seq_len, self.embed_dim, device=self.device)
        return [[[0.0 for _ in range(self.embed_dim)] for _ in range(seq_len)] for _ in range(self.batch_size)]

    def _make_camera_tokens(self, video_frames: int):
        if torch is not None:
            return torch.randn(self.batch_size, video_frames, self.embed_dim, device=self.device)
        return [[[0.0 for _ in range(self.embed_dim)] for _ in range(video_frames)] for _ in range(self.batch_size)]

    def _make_audio_tokens(self, audio_tokens: int):
        if torch is not None:
            return torch.randn(self.batch_size, audio_tokens, self.embed_dim, device=self.device)
        return [[[0.0 for _ in range(self.embed_dim)] for _ in range(audio_tokens)] for _ in range(self.batch_size)]

    def test_flash_block_sparse_attention_dimensions(self) -> None:
        seq_len = 128
        attention_module = FlashBlockSparseAttention(embed_dim=self.embed_dim, block_size=64)
        mock_input = self._make_input(seq_len)
        output = attention_module(mock_input)
        if torch is not None and hasattr(output, "shape"):
            self.assertEqual(output.shape, (self.batch_size, seq_len, self.embed_dim))
        else:
            self.assertEqual(len(output), self.batch_size)
            self.assertEqual(len(output[0]), seq_len)
            self.assertEqual(len(output[0][0]), self.embed_dim)

    def test_audio_to_video_gating_matrix_sync(self) -> None:
        video_frames = 8
        audio_tokens = 40
        gating_gate = AudioToVideoGatingMatrix(embed_dim=self.embed_dim, n_heads=8)
        mock_camera_tokens = self._make_camera_tokens(video_frames)
        mock_audio_tokens = self._make_audio_tokens(audio_tokens)
        modulated_camera = gating_gate(mock_camera_tokens, mock_audio_tokens)
        if torch is not None and hasattr(modulated_camera, "shape"):
            self.assertEqual(modulated_camera.shape, (self.batch_size, video_frames, self.embed_dim))
        else:
            self.assertEqual(len(modulated_camera), self.batch_size)
            self.assertEqual(len(modulated_camera[0]), video_frames)
            self.assertEqual(len(modulated_camera[0][0]), self.embed_dim)

    def test_pure_byte_memory_remuxer(self) -> None:
        if torch is not None:
            mock_video_array = torch.rand(3, 4, 64, 64, dtype=torch.float32)
        else:
            mock_video_array = [[[ [0.0 for _ in range(64)] for _ in range(64)] for _ in range(4)] for _ in range(3)]
        byte_stream = FastMemoryStreamRemuxer.compile_raw_h265_stream(mock_video_array)
        self.assertGreater(len(byte_stream), 0)
        self.assertIsInstance(byte_stream, bytes)
        self.assertTrue(byte_stream.startswith(b"\x00\x00\x00\x01"))

    def test_absolute_omni_engine_builds_outputs(self) -> None:
        model = AbsoluteOmniEngine(embed_dim=32, n_heads=1, depth=1, dim_ff=64)
        if torch is not None:
            text = torch.randint(0, 10, (1, 4))
            vid = torch.randn(1, 3, 3, 16, 16)
            mesh = torch.randn(1, 3, 3)
            aud = torch.randn(1, 1, 4000)
        else:
            text = [[0, 1, 2, 3]]
            vid = [[[ [0.0 for _ in range(16)] for _ in range(16)] for _ in range(3)] for _ in range(1)]
            mesh = [[[0.0, 0.0, 0.0]]]
            aud = [[[0.0 for _ in range(4000)]]]
        outputs = model(text=text, vid=vid, mesh=mesh, aud=aud)
        self.assertEqual(len(outputs), 4)


if __name__ == "__main__":
    unittest.main()
