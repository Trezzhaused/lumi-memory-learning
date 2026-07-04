import os
from typing import Dict

import torch
import torch.distributed as dist
import torch.nn.functional as F
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader

from omni.cloudflare_r2_io import CloudflareR2StreamDataset
from omni.omni_model_core import AbsoluteOmniEngine


def setup_distributed() -> int:
    dist.init_process_group(backend=os.getenv("DIST_BACKEND", "nccl"))
    local_rank = int(os.environ.get("LOCAL_RANK", "0"))
    torch.cuda.set_device(local_rank)
    return local_rank


def train_engine() -> None:
    local_rank = setup_distributed()
    dataset = CloudflareR2StreamDataset(
        endpoint_url=os.getenv("CLOUDFLARE_R2_ENDPOINT_URL", ""),
        access_key=os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID", ""),
        secret_key=os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", ""),
        bucket_name=os.getenv("CLOUDFLARE_R2_BUCKET", ""),
        manifest_key=os.getenv("CLOUDFLARE_R2_MANIFEST_KEY", "training_manifest.json"),
    )
    dataloader = DataLoader(dataset, batch_size=int(os.getenv("TRAIN_BATCH_SIZE", "4")), num_workers=int(os.getenv("TRAIN_NUM_WORKERS", "2")), pin_memory=True)

    model = AbsoluteOmniEngine().to(local_rank)
    model = DDP(model, device_ids=[local_rank], output_device=local_rank)
    optimizer = torch.optim.AdamW(model.parameters(), lr=float(os.getenv("TRAIN_LR", "5e-5")), weight_decay=0.01)

    model.train()
    for epoch in range(int(os.getenv("TRAIN_EPOCHS", "10"))):
        for step, batch in enumerate(dataloader):
            text = batch["text"].to(local_rank)
            vid = batch["video"].to(local_rank)
            mesh = batch["mesh"].to(local_rank)
            aud = batch["audio"].to(local_rank)

            optimizer.zero_grad(set_to_none=True)
            pred_t, pred_v, pred_m, pred_a = model(text, vid, mesh, aud)

            loss_t = F.cross_entropy(pred_t[:, : text.size(1)], text)
            loss_v = F.mse_loss(pred_v, torch.zeros_like(pred_v))
            loss = loss_t + loss_v

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            if local_rank == 0 and step % 10 == 0:
                print(f"Epoch: {epoch} | Step: {step} | Total Unified Cross-Modal Loss: {loss.item():.4f}")

    dist.destroy_process_group()


if __name__ == "__main__":
    train_engine()
