from typing import List

try:  # pragma: no cover - optional dependency
    import torch
except Exception:  # pragma: no cover - optional dependency
    torch = None


class CinematicCameraTokenizer:
    """Maps camera motion vectors into compact latent-style tokens for downstream generation."""

    def __init__(self, embed_dim: int = 768) -> None:
        self.embed_dim = embed_dim

    def forward(self, motion_vectors: List[List[List[float]]]) -> List[List[List[float]]]:
        if torch is not None and hasattr(motion_vectors, "shape"):
            motion_vectors = motion_vectors.detach().cpu().tolist()

        tokens: List[List[List[float]]] = []
        for frame_batch in motion_vectors:
            batch_tokens: List[List[float]] = []
            for motion in frame_batch:
                if len(motion) < 6:
                    motion = motion + [0.0] * (6 - len(motion))
                magnitude = sum(abs(value) for value in motion) / 6.0
                batch_tokens.append([
                    motion[0] * 0.5,
                    motion[1] * 0.5,
                    motion[2] * 0.25,
                    motion[3] * 0.25,
                    motion[4] * 0.25,
                    motion[5] * 0.25 + magnitude,
                ])
            tokens.append(batch_tokens)
        return tokens
