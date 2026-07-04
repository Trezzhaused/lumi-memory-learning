import math
from typing import Any, List, Sequence

try:  # pragma: no cover - optional dependency
    import torch
except Exception:  # pragma: no cover - optional dependency
    torch = None


class OmniAudioSynthesisNetwork:
    """Generates a deterministic audio waveform from latent state and optional voice conditioning."""

    def __init__(self, embed_dim: int = 768, audio_channels: int = 1, out_samples: int = 16000) -> None:
        self.embed_dim = embed_dim
        self.audio_channels = audio_channels
        self.out_samples = out_samples

    def _coerce_values(self, value: Any) -> List[float]:
        if value is None:
            return []
        if torch is not None and hasattr(value, "detach"):
            try:
                return [float(item) for item in value.detach().reshape(-1).tolist()]
            except Exception:
                pass
        if isinstance(value, (list, tuple)):
            values: List[float] = []
            for item in value:
                if isinstance(item, (list, tuple)):
                    values.extend(self._coerce_values(item))
                else:
                    values.append(float(item))
            return values
        return [float(value)]

    def forward(self, omni_latent_state: Any, voice_embedding: Any = None) -> List[float]:
        latent_values = self._coerce_values(omni_latent_state)
        voice_values = self._coerce_values(voice_embedding)

        latent_energy = sum(abs(value) for value in latent_values) / max(1, len(latent_values))
        voice_energy = sum(value for value in voice_values) / max(1, len(voice_values))

        waveform: List[float] = []
        for index in range(self.out_samples):
            phase = 2.0 * math.pi * index / max(1, self.out_samples)
            carrier = math.sin(phase * (1 + (index % 5))) * 0.6
            harmonic = math.cos(phase * 0.5 + latent_energy) * 0.25
            voice_bias = 0.15 * voice_energy
            sample = (carrier + harmonic + voice_bias) / (1.0 + abs(voice_energy) * 0.4)
            waveform.append(max(-1.0, min(1.0, sample)))
        return waveform
