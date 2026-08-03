import torch
import torch.nn as nn

class PatchEmbedding(nn.Module):
    """Splits image into patches and projects them into embedding vector space."""
    def __init__(self, in_channels=3, patch_size=16, emb_size=768, img_size=224):
        super().__init__()
        self.patch_size = patch_size
        self.n_patches = (img_size // patch_size) ** 2
        self.projection = nn.Conv2d(in_channels, emb_size, kernel_size=patch_size, stride=patch_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, C, H, W) -> (B, emb_size, H/P, W/P)
        x = self.projection(x)
        x = x.flatten(2)       # (B, emb_size, N)
        x = x.transpose(1, 2)  # (B, N, emb_size)
        return x


class MultiHeadAttention(nn.Module):
    """Multi-Head Self-Attention (MHSA) module."""
    def __init__(self, emb_size=768, num_heads=12, dropout=0.1):
        super().__init__()
        self.emb_size = emb_size
        self.num_heads = num_heads
        self.head_dim = emb_size // num_heads
        assert self.head_dim * num_heads == emb_size, "emb_size must be divisible by num_heads"
        
        self.qkv = nn.Linear(emb_size, emb_size * 3)
        self.att_drop = nn.Dropout(dropout)
        self.projection = nn.Linear(emb_size, emb_size)
        self.drop = nn.Dropout(dropout)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, N, D = x.shape
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim).permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]  # (B, num_heads, N, head_dim)
        
        scale = self.head_dim ** -0.5
        energy = torch.matmul(q, k.transpose(-2, -1)) * scale  # (B, num_heads, N, N)
        attn = torch.softmax(energy, dim=-1)
        attn = self.att_drop(attn)
        
        out = torch.matmul(attn, v)  # (B, num_heads, N, head_dim)
        out = out.permute(0, 2, 1, 3).reshape(B, N, D)
        out = self.projection(out)
        out = self.drop(out)
        return out


class MLPBlock(nn.Module):
    """Feed-forward Multi-Layer Perceptron (MLP) block."""
    def __init__(self, emb_size=768, expansion=4, dropout=0.1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(emb_size, expansion * emb_size),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(expansion * emb_size, emb_size),
            nn.Dropout(dropout)
        )
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class TransformerBlock(nn.Module):
    """Transformer Encoder Block with Pre-LayerNorm."""
    def __init__(self, emb_size=768, num_heads=12, expansion=4, dropout=0.1):
        super().__init__()
        self.norm1 = nn.LayerNorm(emb_size)
        self.attn = MultiHeadAttention(emb_size, num_heads, dropout=dropout)
        self.norm2 = nn.LayerNorm(emb_size)
        self.mlp = MLPBlock(emb_size, expansion, dropout=dropout)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.norm1(x))
        x = x + self.mlp(self.norm2(x))
        return x


class VisionTransformer(nn.Module):
    """Vision Transformer (ViT) Architecture for Image Classification."""
    def __init__(
        self, 
        img_size=224, 
        patch_size=16, 
        in_channels=3, 
        num_classes=4,
        emb_size=768, 
        depth=12, 
        num_heads=12, 
        expansion=4, 
        dropout=0.1
    ):
        super().__init__()
        self.patch_embed = PatchEmbedding(in_channels, patch_size, emb_size, img_size)
        num_patches = self.patch_embed.n_patches
        
        # Learnable [CLS] token & position embeddings
        self.cls_token = nn.Parameter(torch.zeros(1, 1, emb_size))
        self.pos_embed = nn.Parameter(torch.randn(1, num_patches + 1, emb_size))
        self.pos_drop = nn.Dropout(dropout)
        
        # Stacked Transformer Encoder blocks
        self.blocks = nn.ModuleList([
            TransformerBlock(emb_size, num_heads, expansion, dropout)
            for _ in range(depth)
        ])
        
        self.norm = nn.LayerNorm(emb_size)
        self.head = nn.Linear(emb_size, num_classes)

        self._init_weights()

    def _init_weights(self):
        nn.init.trunc_normal_(self.pos_embed, std=0.02)
        nn.init.trunc_normal_(self.cls_token, std=0.02)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B = x.shape[0]
        x = self.patch_embed(x)  # (B, N, D)
        
        # Prepend [CLS] token
        cls_tokens = self.cls_token.expand(B, -1, -1)
        x = torch.cat((cls_tokens, x), dim=1)  # (B, N+1, D)
        
        # Add positional embeddings
        x = x + self.pos_embed
        x = self.pos_drop(x)
        
        # Pass through Transformer blocks
        for block in self.blocks:
            x = block(x)
            
        x = self.norm(x)
        cls_out = x[:, 0]  # Take [CLS] output
        logits = self.head(cls_out)
        return logits
