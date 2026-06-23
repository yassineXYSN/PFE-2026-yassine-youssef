"""
models/architecture.py — Neural network architectures
======================================================

Three models, all sharing the same SkillEncoder backbone:

  ┌─────────────────────────────────────────────────────────┐
  │  SkillEncoder                                           │
  │  skill_indices (B, L) ──► Embedding(V, D)              │
  │                        ──► Attention pooling            │
  │                        ──► profile_vec  (B, D)          │
  │                            attn_weights (B, L)  ← Service 1 │
  └─────────────────────────────────────────────────────────┘

  ProfileClassifier = SkillEncoder + MLP head  (Service 4)
  SkillVAE          = Conditional VAE on multi-hot vectors (Services 3 & 3b)
"""

from __future__ import annotations

import math
from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _make_mlp(
    in_dim: int,
    hidden_dim: int,
    out_dim: int,
    n_layers: int = 2,
    dropout: float = 0.3,
    activate_last: bool = False,
) -> nn.Sequential:
    """Build a fully-connected MLP with GELU activations and LayerNorm."""
    layers: list[nn.Module] = []
    dims = [in_dim] + [hidden_dim] * (n_layers - 1) + [out_dim]
    for i in range(len(dims) - 1):
        layers.append(nn.Linear(dims[i], dims[i + 1]))
        if i < len(dims) - 2:
            layers += [nn.LayerNorm(dims[i + 1]), nn.GELU(), nn.Dropout(dropout)]
        elif activate_last:
            layers += [nn.LayerNorm(dims[i + 1]), nn.GELU(), nn.Dropout(dropout)]
    return nn.Sequential(*layers)


# ──────────────────────────────────────────────────────────────────────────────
# 1.  SkillEncoder — shared backbone
# ──────────────────────────────────────────────────────────────────────────────

class SkillEncoder(nn.Module):
    """
    Encode a bag of skills into a fixed-size profile vector.

    Architecture
    ------------
    skill_indices (B, L)
        └─ Embedding (V, embed_dim)  [V includes PAD=0]
        └─ Dropout
        └─ Multi-head self-attention pooling
               query = learned token   (embed_dim)
               key/value = skill embeds
        └─ LayerNorm + Residual FC
        └─ profile_vec (B, embed_dim)

    Outputs
    -------
    profile_vec   : (B, embed_dim)   — context-aware candidate representation
    attn_weights  : (B, L)           — attention per skill ← skill importance proxy
    skill_embeds  : (B, L, embed_dim)— raw skill embeddings (before pooling)
    """

    def __init__(self, vocab_size: int, embed_dim: int, n_heads: int = 4, dropout: float = 0.3):
        super().__init__()
        self.embed_dim = embed_dim

        # +1 for PAD token at index 0 (embedding is zero-padded by default)
        self.embedding = nn.Embedding(vocab_size + 1, embed_dim, padding_idx=0)
        nn.init.normal_(self.embedding.weight, std=1.0 / math.sqrt(embed_dim))
        # Reset PAD row to zero
        with torch.no_grad():
            self.embedding.weight[0].fill_(0.0)

        self.emb_drop  = nn.Dropout(dropout)

        # Learned query for attention pooling
        self.query_vec = nn.Parameter(torch.randn(embed_dim) * 0.02)

        # Multi-head attention (query dim = embed_dim, key/val from embeddings)
        self.attn = nn.MultiheadAttention(
            embed_dim=embed_dim,
            num_heads=n_heads,
            dropout=dropout,
            batch_first=True,
        )

        self.norm1 = nn.LayerNorm(embed_dim)
        self.proj  = nn.Sequential(
            nn.Linear(embed_dim, embed_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(embed_dim, embed_dim),
        )
        self.norm2 = nn.LayerNorm(embed_dim)

    def forward(
        self,
        skill_indices: torch.Tensor,    # (B, L)
        skill_lengths: Optional[torch.Tensor] = None,  # (B,) actual lengths
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:

        B, L = skill_indices.shape
        device = skill_indices.device

        # ── Embed ──────────────────────────────────────────────────────────
        x = self.embedding(skill_indices)       # (B, L, D)
        x = self.emb_drop(x)

        # ── Build key-padding mask (True = position is PAD, ignored) ───────
        if skill_lengths is not None:
            # lengths-based mask
            row_ids = torch.arange(L, device=device).unsqueeze(0).expand(B, -1)  # (B, L)
            key_padding_mask = row_ids >= skill_lengths.unsqueeze(1)              # (B, L)
        else:
            key_padding_mask = (skill_indices == 0)                               # (B, L)

        # ── Attention pooling ─────────────────────────────────────────────
        # query shape: (B, 1, D)
        q = self.query_vec.unsqueeze(0).unsqueeze(0).expand(B, 1, -1)

        pooled, attn_weights = self.attn(
            query=q,
            key=x,
            value=x,
            key_padding_mask=key_padding_mask,
            need_weights=True,
            average_attn_weights=True,
        )
        # pooled:       (B, 1, D)
        # attn_weights: (B, 1, L)  — one scalar per skill

        pooled = pooled.squeeze(1)             # (B, D)
        attn_w = attn_weights.squeeze(1)       # (B, L)

        # ── Residual + norm ───────────────────────────────────────────────
        pooled = self.norm1(pooled)
        profile_vec = self.norm2(pooled + self.proj(pooled))

        return profile_vec, attn_w, x          # (B,D), (B,L), (B,L,D)


# ──────────────────────────────────────────────────────────────────────────────
# 2.  ProfileClassifier — Service 4
# ──────────────────────────────────────────────────────────────────────────────

class ProfileClassifier(nn.Module):
    """
    Multi-class classifier: skills → job profile.

    Architecture
    ------------
    skill_indices → SkillEncoder → profile_vec (D)
                 → FC(D, H) → GELU → Dropout
                 → FC(H, H//2) → GELU → Dropout
                 → FC(H//2, n_profiles)
                 → logits (B, n_profiles)

    Usage
    -----
    logits, profile_vec, attn_weights = model(skill_indices, skill_lengths)
    loss = F.cross_entropy(logits, labels, weight=class_weights)
    """

    def __init__(
        self,
        vocab_size:  int,
        n_profiles:  int,
        embed_dim:   int = 128,
        hidden_dim:  int = 512,
        n_heads:     int = 4,
        dropout:     float = 0.3,
    ):
        super().__init__()
        self.encoder = SkillEncoder(vocab_size, embed_dim, n_heads, dropout)
        self.head = _make_mlp(
            in_dim=embed_dim,
            hidden_dim=hidden_dim,
            out_dim=n_profiles,
            n_layers=3,
            dropout=dropout,
        )
        self._init_head()

    def _init_head(self):
        for m in self.head.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(
        self,
        skill_indices: torch.Tensor,              # (B, L)
        skill_lengths: Optional[torch.Tensor] = None,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Returns
        -------
        logits       : (B, n_profiles)
        profile_vec  : (B, embed_dim)
        attn_weights : (B, L)  — skill importance scores
        """
        profile_vec, attn_w, _ = self.encoder(skill_indices, skill_lengths)
        logits = self.head(profile_vec)
        return logits, profile_vec, attn_w


# ──────────────────────────────────────────────────────────────────────────────
# 3.  SkillVAE — Services 3 (upskilling) & 3b (explore_skills)
# ──────────────────────────────────────────────────────────────────────────────

class SkillVAE(nn.Module):
    """
    Conditional Variational Autoencoder over skill multi-hot vectors.

    Input
    -----
    skill_onehot   : (B, n_skills)  — candidate's current skills
    profile_onehot : (B, n_profiles) — optional target profile condition

    Encoder  → μ, log_σ²  (latent_dim)
    Decoder  → reconstructed multi-hot logits  (n_skills)

    Training
    --------
    loss = BCE(recon, target) + β * KL(q || N(0,I))

    Usage
    -----
    Service 3 (upskilling):
      Condition on target profile, decode, diff = decode - current_skills
    Service 3b (explore_skills):
      Sample from prior, decode, return high-scoring skills not yet held
    """

    def __init__(
        self,
        n_skills:    int,
        n_profiles:  int,
        hidden_dim:  int = 512,
        latent_dim:  int = 64,
        dropout:     float = 0.3,
    ):
        super().__init__()
        self.n_skills   = n_skills
        self.n_profiles = n_profiles
        self.latent_dim = latent_dim

        input_dim = n_skills + n_profiles   # concatenated

        # ── Encoder ───────────────────────────────────────────────────────────
        self.encoder_net = _make_mlp(
            in_dim=input_dim,
            hidden_dim=hidden_dim,
            out_dim=hidden_dim // 2,
            n_layers=3,
            dropout=dropout,
            activate_last=True,
        )
        self.fc_mu     = nn.Linear(hidden_dim // 2, latent_dim)
        self.fc_logvar = nn.Linear(hidden_dim // 2, latent_dim)

        # ── Decoder ───────────────────────────────────────────────────────────
        # Also conditioned on the profile (injected at latent level)
        self.decoder_net = _make_mlp(
            in_dim=latent_dim + n_profiles,
            hidden_dim=hidden_dim,
            out_dim=n_skills,
            n_layers=3,
            dropout=dropout,
        )

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    # ── Encoder ───────────────────────────────────────────────────────────────

    def encode(
        self,
        skill_onehot:   torch.Tensor,   # (B, n_skills)
        profile_onehot: torch.Tensor,   # (B, n_profiles)
    ) -> tuple[torch.Tensor, torch.Tensor]:
        x = torch.cat([skill_onehot, profile_onehot], dim=-1)   # (B, n_skills+n_profiles)
        h = self.encoder_net(x)
        return self.fc_mu(h), self.fc_logvar(h)                  # (B, L), (B, L)

    # ── Reparameterization ────────────────────────────────────────────────────

    @staticmethod
    def reparameterize(mu: torch.Tensor, logvar: torch.Tensor) -> torch.Tensor:
        if not torch.is_grad_enabled():
            return mu                            # deterministic at inference
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    # ── Decoder ───────────────────────────────────────────────────────────────

    def decode(
        self,
        z:              torch.Tensor,   # (B, latent_dim)
        profile_onehot: torch.Tensor,   # (B, n_profiles)
    ) -> torch.Tensor:                  # (B, n_skills)  raw logits
        x = torch.cat([z, profile_onehot], dim=-1)
        return self.decoder_net(x)

    # ── Forward (training) ────────────────────────────────────────────────────

    def forward(
        self,
        skill_onehot:   torch.Tensor,   # (B, n_skills)   — current skills
        profile_onehot: torch.Tensor,   # (B, n_profiles)  — target profile
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Returns
        -------
        recon_logits : (B, n_skills)   — raw decoder output
        mu           : (B, latent_dim)
        logvar       : (B, latent_dim)
        """
        mu, logvar = self.encode(skill_onehot, profile_onehot)
        z = self.reparameterize(mu, logvar)
        recon_logits = self.decode(z, profile_onehot)
        return recon_logits, mu, logvar

    # ── Loss ──────────────────────────────────────────────────────────────────

    @staticmethod
    def vae_loss(
        recon_logits: torch.Tensor,   # (B, n_skills)
        target_onehot: torch.Tensor,  # (B, n_skills)
        mu:           torch.Tensor,
        logvar:       torch.Tensor,
        beta:         float = 1.0,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Returns total, recon_loss, kl_loss (all scalars).
        target_onehot: the *target* profile's multi-hot vector (what we want to reconstruct).
        """
        # Binary cross-entropy on each skill independently (multi-label)
        recon = F.binary_cross_entropy_with_logits(
            recon_logits, target_onehot, reduction="mean"
        )
        # KL divergence against N(0, I)
        kl = -0.5 * torch.mean(1 + logvar - mu.pow(2) - logvar.exp())
        return recon + beta * kl, recon, kl

    # ── Inference helpers ─────────────────────────────────────────────────────

    @torch.no_grad()
    def recommend_upskilling(
        self,
        skill_onehot:   torch.Tensor,   # (1, n_skills)
        profile_onehot: torch.Tensor,   # (1, n_profiles)
        topk:           int = 8,
        threshold:      float = 0.3,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Recommend skills to acquire to reach the target profile.

        Returns
        -------
        skill_indices : (topk,)   indices into vocab (1-based)
        scores        : (topk,)   sigmoid probability scores
        """
        recon_logits, _, _ = self.forward(skill_onehot, profile_onehot)
        probs = torch.sigmoid(recon_logits.squeeze(0))          # (n_skills,)

        # Zero out already-known skills
        already = skill_onehot.squeeze(0).bool()
        probs[already] = 0.0

        # Rank
        topk_scores, topk_indices = probs.topk(min(topk, probs.shape[0]))
        mask = topk_scores >= threshold
        return topk_indices[mask] + 1, topk_scores[mask]        # +1 to get 1-based vocab idx

    @torch.no_grad()
    def explore_skills(
        self,
        skill_onehot: torch.Tensor,     # (1, n_skills)
        n_samples:    int = 10,
        topk:         int = 8,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Explore adjacent skills without a fixed target profile.
        Sample multiple points from the posterior distribution to explore.

        Returns
        -------
        skill_indices : (topk,)   1-based vocab indices
        scores        : (topk,)   aggregated probability scores
        """
        n_skills = skill_onehot.shape[1]
        device   = skill_onehot.device

        # Uniform profile condition (no preference)
        flat_profile = torch.ones(1, self.n_profiles, device=device) / self.n_profiles

        # Get latent distribution for current skills
        mu, logvar = self.encode(skill_onehot, flat_profile)
        std = torch.exp(0.5 * logvar)

        # Sample from posterior
        agg = torch.zeros(n_skills, device=device)
        for _ in range(n_samples):
            eps = torch.randn_like(std)
            z = mu + eps * std
            logits = self.decode(z, flat_profile)
            agg += torch.sigmoid(logits.squeeze(0))
        agg /= n_samples

        # Remove already-known skills
        agg[skill_onehot.squeeze(0).bool()] = 0.0

        topk_scores, topk_indices = agg.topk(min(topk, n_skills))
        return topk_indices + 1, topk_scores                    # 1-based
