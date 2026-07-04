import math

try:  # pragma: no cover - optional dependency
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
except Exception:  # pragma: no cover - optional dependency
    torch = None
    nn = None
    F = None


class FlashBlockSparseAttention:
    """A lightweight block-sparse attention implementation for long sequences."""

    def __init__(self, embed_dim: int = 768, num_heads: int = 8, block_size: int = 64) -> None:
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        self.block_size = block_size
        self.head_dim = embed_dim // num_heads
        self.q_proj = None
        self.k_proj = None
        self.v_proj = None
        self.out_proj = None

        if torch is not None and nn is not None and F is not None:
            self.q_proj = nn.Linear(embed_dim, embed_dim)
            self.k_proj = nn.Linear(embed_dim, embed_dim)
            self.v_proj = nn.Linear(embed_dim, embed_dim)
            self.out_proj = nn.Linear(embed_dim, embed_dim)

    def to(self, device):
        return self

    def __call__(self, x):
        return self.forward(x)

    def forward(self, x):
        if torch is None or nn is None or F is None:
            return x

        if x.dim() != 3:
            raise ValueError(f"Expected tensor with shape [B, L, D], got {tuple(x.shape)}")

        batch_size, seq_len, embed_dim = x.shape
        if embed_dim != self.embed_dim:
            raise ValueError(f"Expected embed dim {self.embed_dim}, got {embed_dim}")

        q = self.q_proj(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)

        pad_len = (self.block_size - (seq_len % self.block_size)) % self.block_size
        if pad_len > 0:
            q = F.pad(q, (0, 0, 0, pad_len))
            k = F.pad(k, (0, 0, 0, pad_len))
            v = F.pad(v, (0, 0, 0, pad_len))
            padded_len = seq_len + pad_len
        else:
            padded_len = seq_len

        num_blocks = padded_len // self.block_size
        q_blocks = q.reshape(batch_size, self.num_heads, num_blocks, self.block_size, self.head_dim)
        k_blocks = k.reshape(batch_size, self.num_heads, num_blocks, self.block_size, self.head_dim)
        v_blocks = v.reshape(batch_size, self.num_heads, num_blocks, self.block_size, self.head_dim)

        attn_scores = torch.matmul(q_blocks, k_blocks.transpose(-1, -2)) / math.sqrt(self.head_dim)
        attn_weights = torch.softmax(attn_scores, dim=-1)
        output_blocks = torch.matmul(attn_weights, v_blocks)

        output = output_blocks.reshape(batch_size, self.num_heads, padded_len, self.head_dim)
        output = output.transpose(1, 2).contiguous().view(batch_size, padded_len, embed_dim)
        if pad_len > 0:
            output = output[:, :seq_len, :]
        return self.out_proj(output)


__all__ = ["FlashBlockSparseAttention"]
