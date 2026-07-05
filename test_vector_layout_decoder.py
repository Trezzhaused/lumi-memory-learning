import os
import unittest

try:  # pragma: no cover - optional dependency
    import torch
except Exception:  # pragma: no cover - optional dependency
    torch = None

from omni.master_production_runner import CompleteAutonomousVideoProducer
from omni.vector_layout_decoder import OmniVectorLayoutDecoderHead


class TestVectorLayoutDecoder(unittest.TestCase):
    def test_decoder_emits_valid_svg_markup(self) -> None:
        decoder = OmniVectorLayoutDecoderHead(embed_dim=32, max_output_shapes=4)
        if torch is not None:
            tag_logits = torch.randn(1, 4, 4)
            coordinate_tensor = torch.rand(1, 4, 7)
        else:
            tag_logits = [[0.0, 1.0, 0.0, 0.0] for _ in range(4)]
            coordinate_tensor = [[0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] for _ in range(4)]

        svg_markup = decoder.compile_tensors_to_valid_svg_string(tag_logits, coordinate_tensor)
        self.assertIn("<svg", svg_markup)
        self.assertIn("</svg>", svg_markup)
        self.assertIn("<rect", svg_markup)

    def test_producer_writes_layout_artifact(self) -> None:
        producer = CompleteAutonomousVideoProducer()
        movie_path, audio_path = producer.produce_autonomous_movie([1, 2, 3, 4], target_format="mp4")
        self.assertTrue(os.path.exists(movie_path))
        self.assertTrue(os.path.exists(audio_path))
        self.assertTrue(os.path.exists("render_vault/autonomous_layout.svg"))


if __name__ == "__main__":
    unittest.main()
