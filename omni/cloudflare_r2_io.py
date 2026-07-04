import io
import json
import os
from typing import Any, Dict, Iterator

import boto3
import torch
from torch.utils.data import IterableDataset


class CloudflareR2StreamDataset(IterableDataset):
    """Streams interleaved multimodal tensor chunks from Cloudflare R2."""

    def __init__(
        self,
        endpoint_url: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
        bucket_name: str | None = None,
        manifest_key: str | None = None,
    ):
        super().__init__()
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint_url or os.getenv("CLOUDFLARE_R2_ENDPOINT_URL", ""),
            aws_access_key_id=access_key or os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID", ""),
            aws_secret_access_key=secret_key or os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", ""),
            region_name="auto",
        )
        self.bucket = bucket_name or os.getenv("CLOUDFLARE_R2_BUCKET", "")
        self.manifest = self._load_manifest(manifest_key or os.getenv("CLOUDFLARE_R2_MANIFEST_KEY", "training_manifest.json"))

    def _load_manifest(self, key: str) -> Dict[str, Any]:
        response = self.s3_client.get_object(Bucket=self.bucket, Key=key)
        return json.loads(response["Body"].read().decode("utf-8"))

    def __iter__(self) -> Iterator[Dict[str, torch.Tensor]]:
        for item in self.manifest.get("dataset_chunks", []):
            try:
                obj = self.s3_client.get_object(Bucket=self.bucket, Key=item["file_key"])
                buffer = io.BytesIO(obj["Body"].read())
                data = torch.load(buffer, map_location="cpu")
                yield {
                    "text": data["text_tokens"].long(),
                    "video": data["video_tensor"].float(),
                    "mesh": data["mesh_coords"].float(),
                    "audio": data["audio_waveform"].float(),
                }
            except Exception as exc:  # pragma: no cover - defensive streaming path
                print(f"Error streaming bucket key {item.get('file_key', 'unknown')}: {exc}")
                continue
