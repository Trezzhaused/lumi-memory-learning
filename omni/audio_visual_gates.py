import math
from typing import Any, List, Sequence

try:  # pragma: no cover - optional dependency
    import torch
except Exception:  # pragma: no cover - optional dependency
    torch = None


class AudioToVideoGatingMatrix:
    """Applies deterministic cross-modal gating from audio context to camera motion tokens."""

    def __init__(self, embed_dim: int = 768, n_heads: int = 8) -> None:
        self.embed_dim = embed_dim
        self.n_heads = n_heads

    @staticmethod
    def _gelu(value: float) -> float:
        return 0.5 * value * (1.0 + math.tanh(math.sqrt(2.0 / math.pi) * (value + 0.044715 * value * value * value)))

    def _project_audio(self, token: Sequence[float]) -> List[float]:
        values = [float(value) for value in token]
        if not values:
            return []
        projected: List[float] = []
        for output_idx in range(len(values)):
            weight = ((output_idx % 5) - 2) * 0.125
            contribution = sum((index + 1) * weight * value for index, value in enumerate(values)) / max(1, len(values))
            projected.append(self._gelu(contribution))
        return projected

    def _softmax(self, values: Sequence[float]) -> List[float]:
        if not values:
            return []
        max_value = max(values)
        exps = [math.exp(value - max_value) for value in values]
        total = sum(exps)
        return [value / total for value in exps] if total else [1.0 / len(values)] * len(values)

    def _cross_attention_context(self, camera_tokens: Sequence[Sequence[float]], audio_features: Sequence[Sequence[float]]) -> List[float]:
        if not camera_tokens or not audio_features:
            return []
        scores = []
        for audio_token in audio_features:
            score = sum(cam * audio for cam, audio in zip(camera_tokens[0], audio_token)) / max(1, len(camera_tokens[0]))
            scores.append(score)
        weights = self._softmax(scores)
        context = [0.0 for _ in camera_tokens[0]]
        for weight, audio_token in zip(weights, audio_features):
            for index, value in enumerate(audio_token):
                context[index] += weight * value
        return context

    def _gate_projection(self, context: Sequence[float]) -> List[float]:
        if not context:
            return []
        mean_value = sum(context) / len(context)
        gate_value = 1.0 + 0.5 * (1.0 / (1.0 + math.exp(-mean_value)))
        return [gate_value for _ in context]

    def _layer_norm(self, values: Sequence[float]) -> List[float]:
        if not values:
            return []
        mean_value = sum(values) / len(values)
        variance = sum((value - mean_value) ** 2 for value in values) / len(values)
        std = math.sqrt(variance + 1e-6)
        return [(value - mean_value) / std for value in values]

    def _project_torch(self, tensor: Any) -> Any:
        if torch is None or not hasattr(tensor, "detach"):
            return tensor
        projected = tensor.float().reshape(-1, tensor.shape[-1])
        weights = torch.linspace(-0.25, 0.25, steps=projected.shape[-1], device=tensor.device, dtype=tensor.dtype)
        projected = projected * weights
        return projected.reshape(tensor.shape)

    def _apply_torch_gating(self, camera_tokens: Any, audio_features: Any) -> Any:
        if torch is None or not hasattr(camera_tokens, "shape"):
            return None
        camera_tokens = camera_tokens.to(dtype=torch.float32)
        audio_features = audio_features.to(dtype=torch.float32)
        attn_context = []
        for batch_index in range(camera_tokens.size(0)):
            batch_frames = []
            for frame_index in range(camera_tokens.size(1)):
                frame_query = camera_tokens[batch_index, frame_index]
                frame_scores = []
                for audio_token in audio_features[batch_index]:
                    frame_scores.append(torch.dot(frame_query, audio_token))
                weights = torch.softmax(torch.stack(frame_scores), dim=0)
                context = torch.zeros_like(frame_query)
                for weight, audio_token in zip(weights, audio_features[batch_index]):
                    context += weight * audio_token
                batch_frames.append(context)
            attn_context.append(torch.stack(batch_frames))
        attn_context_tensor = torch.stack(attn_context)
        gating = torch.sigmoid(attn_context_tensor.mean(dim=-1, keepdim=True)) * 2.0
        modulated = camera_tokens * gating
        residual = modulated + camera_tokens
        return torch.nn.functional.layer_norm(residual, residual.shape[-1:])

    def __call__(self, camera_motion_tokens: Any, raw_audio_tokens: Any) -> Any:
        return self.forward(camera_motion_tokens, raw_audio_tokens)

    def forward(self, camera_motion_tokens: Any, raw_audio_tokens: Any) -> Any:
        if torch is not None and hasattr(camera_motion_tokens, "shape") and hasattr(raw_audio_tokens, "shape"):
            return self._apply_torch_gating(camera_motion_tokens, raw_audio_tokens)

        if not camera_motion_tokens:
            return []
        if isinstance(camera_motion_tokens[0], (list, tuple)) and len(camera_motion_tokens[0]) > 0 and isinstance(camera_motion_tokens[0][0], (list, tuple)):
            batch_output = []
            for batch_index, batch_tokens in enumerate(camera_motion_tokens):
                frame_output = []
                for frame_tokens in batch_tokens:
                    audio_features = [self._project_audio(audio_token) for audio_token in raw_audio_tokens[batch_index]]
                    context = self._cross_attention_context([frame_tokens], audio_features)
                    gate_values = self._gate_projection(context)
                    modulated = [value * gate for value, gate in zip(frame_tokens, gate_values)] if gate_values else list(frame_tokens)
                    normalized = self._layer_norm([value + gate for value, gate in zip(modulated, frame_tokens)])
                    frame_output.append(normalized)
                batch_output.append(frame_output)
            return batch_output

        frame_output = []
        for frame_tokens in camera_motion_tokens:
            audio_features = [self._project_audio(audio_token) for audio_token in raw_audio_tokens]
            context = self._cross_attention_context([frame_tokens], audio_features)
            gate_values = self._gate_projection(context)
            modulated = [value * gate for value, gate in zip(frame_tokens, gate_values)] if gate_values else list(frame_tokens)
            normalized = self._layer_norm([value + gate for value, gate in zip(modulated, frame_tokens)])
            frame_output.append(normalized)
        return frame_output
