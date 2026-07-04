import torch
import torch.nn as nn
import torch.nn.functional as F


class OmniSpatioTemporalEncoder(nn.Module):
    def __init__(self, in_channels: int, patch_size: int, embed_dim: int):
        super().__init__()
        self.proj = nn.Conv3d(
            in_channels,
            embed_dim,
            kernel_size=(2, patch_size, patch_size),
            stride=(2, patch_size, patch_size),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.proj(x).flatten(2).transpose(1, 2)


class OmniMeshEncoder(nn.Module):
    def __init__(self, coord_dim: int, embed_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(coord_dim, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.GELU(),
            nn.Linear(embed_dim, embed_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class OmniAudioEncoder(nn.Module):
    def __init__(self, stride: int, embed_dim: int):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(1, embed_dim // 2, kernel_size=7, stride=stride, padding=3),
            nn.GELU(),
            nn.Conv1d(embed_dim // 2, embed_dim, kernel_size=3, stride=1, padding=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.conv(x).transpose(1, 2)


class OmniAttentionBlock(nn.Module):
    def __init__(self, embed_dim: int, n_heads: int, dim_ff: int):
        super().__init__()
        self.attn = nn.MultiheadAttention(embed_dim, n_heads, batch_first=True)
        self.l1 = nn.Linear(embed_dim, dim_ff)
        self.l2 = nn.Linear(dim_ff, embed_dim)
        self.n1 = nn.LayerNorm(embed_dim)
        self.n2 = nn.LayerNorm(embed_dim)

    def forward(self, x: torch.Tensor, mask: torch.Tensor | None = None) -> torch.Tensor:
        attn_out, _ = self.attn(x, x, x, attn_mask=mask, need_weights=False)
        x = self.n1(x + attn_out)
        ff_out = self.l2(F.gelu(self.l1(x)))
        return self.n2(x + ff_out)


class AbsoluteOmniEngine(nn.Module):
    def __init__(self, vocab_size: int = 5000, embed_dim: int = 768, n_heads: int = 12, depth: int = 12, dim_ff: int = 3072):
        super().__init__()
        self.embed_dim = embed_dim
        self.text_enc = nn.Embedding(vocab_size, embed_dim)
        self.vid_enc = OmniSpatioTemporalEncoder(in_channels=3, patch_size=16, embed_dim=embed_dim)
        self.mesh_enc = OmniMeshEncoder(coord_dim=3, embed_dim=embed_dim)
        self.aud_enc = OmniAudioEncoder(stride=400, embed_dim=embed_dim)
        self.blocks = nn.ModuleList([OmniAttentionBlock(embed_dim, n_heads, dim_ff) for _ in range(depth)])

        self.head_text = nn.Linear(embed_dim, vocab_size)
        self.head_vid = nn.Linear(embed_dim, 3 * 16 * 16)
        self.head_mesh = nn.Linear(embed_dim, 3)
        self.head_aud = nn.Linear(embed_dim, 400)

    def forward(self, text=None, vid=None, mesh=None, aud=None, mask=None):
        feats = []
        if text is not None:
            feats.append(self.text_enc(text))
        if vid is not None:
            feats.append(self.vid_enc(vid))
        if mesh is not None:
            feats.append(self.mesh_enc(mesh))
        if aud is not None:
            feats.append(self.aud_enc(aud))

        seq = torch.cat(feats, dim=1)
        for block in self.blocks:
            seq = block(seq, mask=mask)

        return self.head_text(seq), self.head_vid(seq), self.head_mesh(seq), self.head_aud(seq)
