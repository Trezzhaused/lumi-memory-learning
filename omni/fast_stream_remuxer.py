import io
import struct
from typing import Any

try:  # pragma: no cover - optional dependency
    import torch
except Exception:  # pragma: no cover - optional dependency
    torch = None


class FastMemoryStreamRemuxer:
    """Assembles raw video frames into an in-memory byte stream."""

    @staticmethod
    def compile_raw_h265_stream(video_array: Any) -> bytes:
        if torch is not None:
            tensor = video_array
            if hasattr(tensor, "detach"):
                tensor = tensor.detach().cpu()
            if not isinstance(tensor, torch.Tensor):
                tensor = torch.as_tensor(tensor, dtype=torch.float32)

            if tensor.ndim != 4:
                raise ValueError(f"Expected video tensor with shape [C, F, H, W], got {tuple(tensor.shape)}")

            if tensor.shape[0] <= 4 and tensor.shape[1] >= 2 and tensor.shape[2] >= 2 and tensor.shape[3] >= 2:
                frames = tensor.shape[1]
                height = tensor.shape[2]
                width = tensor.shape[3]
            elif tensor.shape[-1] <= 4 and tensor.shape[0] >= 2 and tensor.shape[1] >= 2 and tensor.shape[2] >= 2:
                tensor = tensor.permute(3, 0, 1, 2).contiguous()
                frames = tensor.shape[1]
                height = tensor.shape[2]
                width = tensor.shape[3]
            else:
                raise ValueError(f"Unsupported video array shape {tuple(tensor.shape)}")

            buffer = io.BytesIO()
            for frame_idx in range(frames):
                frame_slice = tensor[:, frame_idx, :, :]
                frame_slice = torch.clamp(frame_slice, 0.0, 1.0).permute(1, 2, 0)
                frame_bytes = (frame_slice * 255.0).to(dtype=torch.uint8).contiguous().view(-1).tolist()
                byte_payload = bytes(frame_bytes)

                buffer.write(b"\x00\x00\x00\x01")
                buffer.write(struct.pack(">B", 42))
                buffer.write(struct.pack(">II", width, height))
                buffer.write(byte_payload)

            return buffer.getvalue()

        if not hasattr(video_array, "__iter__"):
            raise ValueError("video_array must be iterable when torch is unavailable")

        def flatten_values(values):
            if isinstance(values, (list, tuple)):
                for item in values:
                    yield from flatten_values(item)
            else:
                yield values

        frames = list(video_array)
        if not frames:
            return b""
        first_frame = frames[0]
        if not hasattr(first_frame, "__iter__"):
            raise ValueError("video_array must contain frames")
        height = len(first_frame)
        width = len(first_frame[0]) if height else 0
        buffer = io.BytesIO()
        for frame in frames:
            frame_bytes = bytearray()
            for value in flatten_values(frame):
                frame_bytes.append(int(max(0, min(255, value * 255))))
            buffer.write(b"\x00\x00\x00\x01")
            buffer.write(struct.pack(">B", 42))
            buffer.write(struct.pack(">II", width, height))
            buffer.write(frame_bytes)
        return buffer.getvalue()


__all__ = ["FastMemoryStreamRemuxer"]
