try:  # pragma: no cover - optional dependency
    import torch
    import torch.nn as nn
except Exception:  # pragma: no cover - optional dependency
    torch = None
    nn = None


class OmniVectorLayoutDecoderHead:
    """A lightweight vector-layout head that emits SVG-compatible geometry targets."""

    def __init__(self, embed_dim: int = 768, hidden_dim: int = 256, max_output_shapes: int = 32):
        self.embed_dim = embed_dim
        self.hidden_dim = hidden_dim
        self.max_output_shapes = max_output_shapes
        self.attribute_regressor = None
        self.element_classifier = None

        if torch is not None and nn is not None:
            self.attribute_regressor = nn.Sequential(
                nn.Linear(embed_dim, hidden_dim),
                nn.GELU(),
                nn.Linear(hidden_dim, 8),
            )
            self.element_classifier = nn.Linear(embed_dim, 4)

    def to(self, device):
        return self

    def __call__(self, omni_sequence_tokens):
        return self.forward(omni_sequence_tokens)

    def forward(self, omni_sequence_tokens):
        if torch is None or self.attribute_regressor is None or self.element_classifier is None:
            return self._fallback_outputs(omni_sequence_tokens)

        x = omni_sequence_tokens[:, : self.max_output_shapes, :]
        logits = self.element_classifier(x)
        raw_attributes = self.attribute_regressor(x)
        coordinates = torch.sigmoid(raw_attributes[:, :, 1:])
        return logits, coordinates

    def _fallback_outputs(self, omni_sequence_tokens):
        if isinstance(omni_sequence_tokens, list):
            batch_size = len(omni_sequence_tokens)
            seq_len = len(omni_sequence_tokens[0]) if omni_sequence_tokens and omni_sequence_tokens[0] else 0
        else:
            batch_size = 1
            seq_len = 0

        tag_logits = []
        coordinate_maps = []
        for _ in range(batch_size):
            tag_logits.append([[0.0] * 4 for _ in range(min(self.max_output_shapes, max(seq_len, 1)))])
            coordinate_maps.append([[0.5] * 7 for _ in range(min(self.max_output_shapes, max(seq_len, 1)))])
        return tag_logits, coordinate_maps

    @staticmethod
    def _to_numpy(value):
        if torch is not None and hasattr(value, "detach"):
            value = value.detach()
        if torch is not None and hasattr(value, "cpu"):
            value = value.cpu()
        if hasattr(value, "numpy"):
            value = value.numpy()
        return value

    @staticmethod
    def _safe_float(value):
        if isinstance(value, (list, tuple)):
            if not value:
                return 0.0
            return float(value[0])
        return float(value)

    @classmethod
    def compile_tensors_to_valid_svg_string(cls, tag_logits, coordinate_tensor, width: int = 640, height: int = 480) -> str:
        tag_logits = cls._to_numpy(tag_logits)
        coordinate_tensor = cls._to_numpy(coordinate_tensor)
        if tag_logits is None or coordinate_tensor is None:
            return cls._empty_svg(width, height)

        if hasattr(tag_logits, "ndim") and tag_logits.ndim == 3:
            tag_logits = tag_logits[0]
        if hasattr(coordinate_tensor, "ndim") and coordinate_tensor.ndim == 3:
            coordinate_tensor = coordinate_tensor[0]

        if hasattr(tag_logits, "ndim") and tag_logits.ndim == 2:
            tag_logits = [tag_logits]
        if hasattr(coordinate_tensor, "ndim") and coordinate_tensor.ndim == 2:
            coordinate_tensor = [coordinate_tensor]

        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
            f'<rect width="{width}" height="{height}" fill="#ffffff" />',
        ]

        if not isinstance(tag_logits, list):
            tag_logits = list(tag_logits)
        if not isinstance(coordinate_tensor, list):
            coordinate_tensor = list(coordinate_tensor)

        if coordinate_tensor and not isinstance(coordinate_tensor[0], (list, tuple)):
            coordinate_tensor = [coordinate_tensor]
        if tag_logits and not isinstance(tag_logits[0], (list, tuple)):
            tag_logits = [tag_logits]

        for index, (shape_logits, attrs) in enumerate(zip(tag_logits, coordinate_tensor)):
            if not isinstance(shape_logits, (list, tuple)):
                shape_logits = [shape_logits]
            if not isinstance(attrs, (list, tuple)):
                attrs = [attrs]
            cls_id = int(max(range(len(shape_logits)), key=lambda i: cls._safe_float(shape_logits[i]))) if shape_logits else 0
            cls_id = min(3, max(0, cls_id))

            if len(attrs) >= 7:
                x = cls._scale_coord(attrs[0], width)
                y = cls._scale_coord(attrs[1], height)
                width_dim = max(8, cls._scale_coord(attrs[2] if len(attrs) > 2 else 0.25, width // 2))
                height_dim = max(8, cls._scale_coord(attrs[3] if len(attrs) > 3 else 0.25, height // 2))
                red = int(round(255 * cls._safe_float(attrs[4] if len(attrs) > 4 else 0.5)))
                green = int(round(255 * cls._safe_float(attrs[5] if len(attrs) > 5 else 0.5)))
                blue = int(round(255 * cls._safe_float(attrs[6] if len(attrs) > 6 else 0.5)))
            else:
                x = 16 + index * 24
                y = 16 + index * 12
                width_dim = min(120, width // 4)
                height_dim = min(120, height // 4)
                red = 64 + (index * 30) % 160
                green = 64 + (index * 20) % 160
                blue = 64 + (index * 10) % 160

            fill = f"rgb({red % 256},{green % 256},{blue % 256})"
            if cls_id == 0:
                parts.append(f'<rect x="{x}" y="{y}" width="{width_dim}" height="{height_dim}" fill="{fill}" />')
            elif cls_id == 1:
                radius = max(8, min(width_dim, height_dim) // 2)
                parts.append(f'<circle cx="{x + radius}" cy="{y + radius}" r="{radius}" fill="{fill}" />')
            elif cls_id == 2:
                parts.append(
                    f'<path d="M {x} {y} L {x + width_dim} {y + height_dim} L {x} {y + height_dim} Z" fill="{fill}" />'
                )
            else:
                parts.append(
                    f'<g><rect x="{x}" y="{y}" width="{width_dim}" height="{height_dim}" fill="{fill}" rx="12" ry="12" /></g>'
                )

        parts.append("</svg>")
        return "\n".join(parts)

    @staticmethod
    def _scale_coord(value, limit: int) -> int:
        numeric_value = float(value)
        numeric_value = max(0.0, min(1.0, numeric_value))
        return int(round(numeric_value * max(1, limit)))

    @staticmethod
    def _empty_svg(width: int, height: int) -> str:
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
            f'<rect width="{width}" height="{height}" fill="#ffffff" />'
            '<rect x="16" y="16" width="160" height="80" fill="#4f46e5" />'
            '</svg>'
        )


__all__ = ["OmniVectorLayoutDecoderHead"]
