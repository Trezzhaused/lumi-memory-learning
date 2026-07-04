import io
import os
import threading
import time
from typing import Optional, Tuple

try:  # pragma: no cover - optional dependency
    import boto3
except Exception:  # pragma: no cover - optional dependency
    boto3 = None

try:  # pragma: no cover - optional dependency
    import grpc
except Exception:  # pragma: no cover - optional dependency
    grpc = None

try:  # pragma: no cover - optional dependency
    import omni_stream_pb2  # type: ignore
    import omni_stream_pb2_grpc  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    omni_stream_pb2 = None
    omni_stream_pb2_grpc = None


class ClusterFaultToleranceEngine:
    """Provides checkpoint save/recovery hooks and optional cloud backup integration."""

    def __init__(self, r2_endpoint: str, r2_access_key: str, r2_secret_key: str, bucket_name: str) -> None:
        self.s3_client = None
        if boto3 is not None:
            self.s3_client = boto3.client(
                "s3",
                endpoint_url=r2_endpoint,
                aws_access_key_id=r2_access_key,
                aws_secret_access_key=r2_secret_key,
                region_name="auto",
            )
        self.bucket = bucket_name

    def save_checkpoint_to_cloud(self, model: object, epoch: int, step: int, path_key: str = "checkpoints/latest.pt") -> None:
        if self.s3_client is None:
            return
        buffer = io.BytesIO()
        state_dict = getattr(model, "module", model).state_dict()
        import torch

        torch.save({"epoch": epoch, "step": step, "model_state_dict": state_dict}, buffer)
        buffer.seek(0)
        self.s3_client.put_object(Bucket=self.bucket, Key=path_key, Body=buffer.read())

    def recover_latest_checkpoint(self, model: object, path_key: str = "checkpoints/latest.pt") -> Tuple[int, int]:
        if self.s3_client is None:
            return 0, 0
        try:
            obj = self.s3_client.get_object(Bucket=self.bucket, Key=path_key)
            buffer = io.BytesIO(obj["Body"].read())
            import torch

            checkpoint = torch.load(buffer, map_location="cpu")
            getattr(model, "module", model).load_state_dict(checkpoint["model_state_dict"])
            return checkpoint.get("epoch", 0), checkpoint.get("step", 0)
        except Exception:
            return 0, 0


def simulate_concurrent_load_worker(worker_id: int, target_host: str, token_payload: list) -> None:
    if grpc is None or omni_stream_pb2_grpc is None:
        return
    with grpc.insecure_channel(target_host) as channel:
        stub = omni_stream_pb2_grpc.OmniStreamingEngineStub(channel)
        req = omni_stream_pb2.GenerationRequest(prompt_tokens=token_payload, target_fps=24)
        try:
            start_time = time.time()
            chunks = stub.GenerateMediaStream(req)
            frame_count = 0
            for _ in chunks:
                frame_count += 1
            duration = time.time() - start_time
            print(f"[Stress Ingest Worker #{worker_id}] Stream closed. Rendered {frame_count} frames across {duration:.2f}s.")
        except Exception as exc:  # pragma: no cover - defensive benchmark path
            print(f"❌ Worker #{worker_id} crashed due to resource bottleneck: {exc}")


def run_production_stress_benchmark(target_host: str = "localhost:50051", total_concurrent_streams: int = 50) -> None:
    threads = []
    mock_tokens = [102, 45, 2309, 11]
    for worker_id in range(total_concurrent_streams):
        thread = threading.Thread(target=simulate_concurrent_load_worker, args=(worker_id, target_host, mock_tokens))
        thread.start()
        threads.append(thread)
    for thread in threads:
        thread.join()
