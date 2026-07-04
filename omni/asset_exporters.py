import os
from typing import Any

import cv2
import numpy as np
import scipy.io.wavfile as wavf
import torch


class AssetExporterEngine:
    """Converts continuous neural-network tensors into production-ready files."""

    @staticmethod
    def export_audio_wav(audio_tensor: torch.Tensor, output_path: str, sample_rate: int = 16000) -> None:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        audio_arr = audio_tensor.detach().cpu().squeeze().numpy()
        audio_arr = np.clip(audio_arr, -1.0, 1.0)
        audio_pcm = (audio_arr * 32767.0).astype(np.int16)
        wavf.write(output_path, sample_rate, audio_pcm)

    @staticmethod
    def export_mesh_obj(mesh_tensor: torch.Tensor, output_path: str) -> None:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        vertices = mesh_tensor.detach().cpu().numpy()
        with open(output_path, "w", encoding="utf-8") as handle:
            handle.write("# OmniModel Autonomous 3D Asset Export\n")
            for vertex in vertices:
                handle.write(f"v {vertex[0]:.4f} {vertex[1]:.4f} {vertex[2]:.4f}\n")
            for idx in range(1, len(vertices) - 2, 3):
                handle.write(f"f {idx} {idx + 1} {idx + 2}\n")

    @staticmethod
    def export_video_mp4(video_tensor: torch.Tensor, output_path: str, fps: int = 24) -> None:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        vid_arr = video_tensor.detach().cpu().squeeze().numpy()
        channels, total_frames, height, width = vid_arr.shape
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(output_path, fourcc, float(fps), (width, height))
        try:
            for frame_index in range(total_frames):
                frame = vid_arr[:, frame_index, :, :]
                frame = np.transpose(frame, (1, 2, 0))
                frame = np.clip(frame, 0.0, 1.0)
                frame = (frame * 255.0).astype(np.uint8)
                if channels == 3:
                    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                elif channels == 1:
                    frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
                writer.write(frame)
        finally:
            writer.release()
