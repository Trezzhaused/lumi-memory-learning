import json
import math
import os
import random
from typing import List


class VoiceProfileRegistry:
    """Manages a deterministic local registry of voice embeddings."""

    def __init__(self, embedding_dim: int = 512, registry_path: str = "configs/voice_registry.json") -> None:
        self.embedding_dim = embedding_dim
        self.registry_path = registry_path
        self.total_voices = 1000
        self.voice_matrix = self._load_or_generate_registry()

    def _load_or_generate_registry(self) -> List[List[float]]:
        if os.path.exists(self.registry_path):
            with open(self.registry_path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
            return [list(map(float, vector)) for vector in data["embeddings"]]

        rng = random.Random(42)
        embeddings: List[List[float]] = []
        for _ in range(self.total_voices):
            vector = [rng.gauss(0.0, 1.0) for _ in range(self.embedding_dim)]
            norm = math.sqrt(sum(value * value for value in vector))
            if norm == 0.0:
                continue
            embeddings.append([value / norm for value in vector])

        os.makedirs(os.path.dirname(self.registry_path) or ".", exist_ok=True)
        with open(self.registry_path, "w", encoding="utf-8") as handle:
            json.dump({"embeddings": embeddings}, handle)
        return embeddings

    def get_voice_embedding(self, voice_id: int) -> List[float]:
        if not 0 <= voice_id < self.total_voices:
            raise ValueError(f"Voice Identity {voice_id} out of available register bounds (0-999).")
        return self.voice_matrix[voice_id]
