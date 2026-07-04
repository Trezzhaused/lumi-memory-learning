try:  # pragma: no cover - optional dependency
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
except Exception:  # pragma: no cover - optional dependency
    torch = None
    nn = None
    F = None


class OmniSpatioTemporalEncoder:
    def __init__(self, in_channels: int, patch_size: int, embed_dim: int):
        self.in_channels = in_channels
        self.patch_size = patch_size
        self.embed_dim = embed_dim
        self.proj = None
        if torch is not None and nn is not None:
            self.proj = nn.Conv3d(
                in_channels,
                embed_dim,
                kernel_size=(2, patch_size, patch_size),
                stride=(2, patch_size, patch_size),
            )

    def forward(self, x):
        if torch is None or self.proj is None:
            return x
        return self.proj(x).flatten(2).transpose(1, 2)


class OmniMeshEncoder:
    def __init__(self, coord_dim: int, embed_dim: int):
        self.coord_dim = coord_dim
        self.embed_dim = embed_dim
        self.net = None
        if torch is not None and nn is not None:
            self.net = nn.Sequential(
                nn.Linear(coord_dim, embed_dim),
                nn.LayerNorm(embed_dim),
                nn.GELU(),
                nn.Linear(embed_dim, embed_dim),
            )

    def forward(self, x):
        if torch is None or self.net is None:
            return x
        return self.net(x)


class OmniAudioEncoder:
    def __init__(self, stride: int, embed_dim: int):
        self.stride = stride
        self.embed_dim = embed_dim
        self.conv = None
        if torch is not None and nn is not None:
            self.conv = nn.Sequential(
                nn.Conv1d(1, embed_dim // 2, kernel_size=7, stride=stride, padding=3),
                nn.GELU(),
                nn.Conv1d(embed_dim // 2, embed_dim, kernel_size=3, stride=1, padding=1),
            )

    def forward(self, x):
        if torch is None or self.conv is None:
            return x
        return self.conv(x).transpose(1, 2)


class OmniAttentionBlock:
    def __init__(self, embed_dim: int, n_heads: int, dim_ff: int):
        self.embed_dim = embed_dim
        self.n_heads = n_heads
        self.dim_ff = dim_ff
        self.attn = None
        self.l1 = None
        self.l2 = None
        self.n1 = None
        self.n2 = None
        if torch is not None and nn is not None and F is not None:
            self.attn = nn.MultiheadAttention(embed_dim, n_heads, batch_first=True)
            self.l1 = nn.Linear(embed_dim, dim_ff)
            self.l2 = nn.Linear(dim_ff, embed_dim)
            self.n1 = nn.LayerNorm(embed_dim)
            self.n2 = nn.LayerNorm(embed_dim)

    def forward(self, x, mask=None):
        if torch is None or self.attn is None or self.l1 is None or self.l2 is None or self.n1 is None or self.n2 is None:
            return x
        attn_out, _ = self.attn(x, x, x, attn_mask=mask, need_weights=False)
        x = self.n1(x + attn_out)
        ff_out = self.l2(F.gelu(self.l1(x)))
        return self.n2(x + ff_out)


class AbsoluteOmniEngine:
    def __init__(self, vocab_size: int = 5000, embed_dim: int = 768, n_heads: int = 12, depth: int = 12, dim_ff: int = 3072):
        self.embed_dim = embed_dim
        self.text_enc = None
        self.vid_enc = None
        self.mesh_enc = None
        self.aud_enc = None
        self.blocks = []
        self.head_text = None
        self.head_vid = None
        self.head_mesh = None
        self.head_aud = None

        if torch is not None and nn is not None:
            self.text_enc = nn.Embedding(vocab_size, embed_dim)
            self.vid_enc = OmniSpatioTemporalEncoder(in_channels=3, patch_size=16, embed_dim=embed_dim)
            self.mesh_enc = OmniMeshEncoder(coord_dim=3, embed_dim=embed_dim)
            self.aud_enc = OmniAudioEncoder(stride=400, embed_dim=embed_dim)
            self.blocks = [OmniAttentionBlock(embed_dim, n_heads, dim_ff) for _ in range(depth)]
            self.head_text = nn.Linear(embed_dim, vocab_size)
            self.head_vid = nn.Linear(embed_dim, 3 * 16 * 16)
            self.head_mesh = nn.Linear(embed_dim, 3)
            self.head_aud = nn.Linear(embed_dim, 400)

    def __call__(self, text=None, vid=None, mesh=None, aud=None, mask=None):
        return self.forward(text=text, vid=vid, mesh=mesh, aud=aud, mask=mask)

    def forward(self, text=None, vid=None, mesh=None, aud=None, mask=None):
        if torch is None:
            return (text, vid, mesh, aud)

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
