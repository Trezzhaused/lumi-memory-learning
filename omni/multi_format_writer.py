import os
import struct
from typing import Iterable, List, Sequence


class MultiFormatBinaryTransmuxer:
    """Writes raw PCM/audio payloads to a simple WAV container without external tools."""

    @staticmethod
    def _coerce_samples(audio_arr: Iterable[float]) -> List[int]:
        return [int(round(max(-32768, min(32767, sample * 32767.0)))) for sample in audio_arr]

    @staticmethod
    def build_wav_bytes(audio_arr: Iterable[float], sample_rate: int = 16000) -> bytes:
        pcm_samples = MultiFormatBinaryTransmuxer._coerce_samples(audio_arr)
        data_size = len(pcm_samples) * 2
        header = bytearray()
        header.extend(b"RIFF")
        header.extend(struct.pack("<I", 36 + data_size))
        header.extend(b"WAVE")
        header.extend(b"fmt ")
        header.extend(struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16))
        header.extend(b"data")
        header.extend(struct.pack("<I", data_size))
        header.extend(struct.pack("<%dh" % len(pcm_samples), *pcm_samples))
        return bytes(header)

    @staticmethod
    def write_wav_file(audio_arr: Iterable[float], output_path: str, sample_rate: int = 16000) -> str:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        wav_bytes = MultiFormatBinaryTransmuxer.build_wav_bytes(audio_arr, sample_rate=sample_rate)
        with open(output_path, "wb") as handle:
            handle.write(wav_bytes)
        return output_path
