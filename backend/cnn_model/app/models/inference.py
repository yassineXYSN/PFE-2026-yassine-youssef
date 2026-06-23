"""
models/inference.py — Inference API for all 5 job-market services
==================================================================
Loads trained models and exposes clean Python functions.

Services implemented
--------------------
1. skill_importance      → Which of my skills are most valued?
2. skill_liaison         → Which skills naturally go with mine?
3. upskilling            → What to learn to reach a target profile?
3b. explore_skills       → What to learn without a fixed target?
4. profile_recommendation → Which job profile fits me best?

Usage
-----
from models.inference import JobMarketAI

ai = JobMarketAI()          # loads from default paths
ai = JobMarketAI(device="cuda")

result = ai.profile_recommendation(["python", "pytorch", "docker"])
result = ai.skill_importance(["python", "sql", "tensorflow"])
result = ai.skill_liaison(["python", "pandas"])
result = ai.upskilling(["sql", "excel"], target_profile="data_engineer")
result = ai.explore_skills(["python", "numpy"])
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Optional

import torch
import torch.nn.functional as F

# Resolve project root so imports work wherever this module is loaded from
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))

from normalizer import normalize_skill_list, normalize_skill
from models.config import ModelConfig
from models.architecture import ProfileClassifier, SkillVAE


# ──────────────────────────────────────────────────────────────────────────────
# Helper types
# ──────────────────────────────────────────────────────────────────────────────

SkillScore   = dict  # {"skill": str, "score": float}
ProfileScore = dict  # {"profile": str, "confidence": float}


# ──────────────────────────────────────────────────────────────────────────────
# JobMarketAI — main inference class
# ──────────────────────────────────────────────────────────────────────────────


# ──────────────────────────────────────────────────────────────────────────────
# Skill taxonomy — (category, ecosystem) used for context-aware scoring
# ──────────────────────────────────────────────────────────────────────────────

SKILL_TAXONOMY: dict[str, tuple[str, str]] = {
    # Python ecosystem
    "python":           ("language",        "python"),
    "flask":            ("web_framework",   "python"),
    "fastapi":          ("web_framework",   "python"),
    "django":           ("web_framework",   "python"),
    "aiohttp":          ("web_framework",   "python"),
    "tornado":          ("web_framework",   "python"),
    "starlette":        ("web_framework",   "python"),
    "celery":           ("task_queue",      "python"),
    "sqlalchemy":       ("orm",             "python"),
    "pydantic":         ("validation",      "python"),
    "pytest":           ("testing",         "python"),
    "uvicorn":          ("server",          "python"),
    "gunicorn":         ("server",          "python"),
    # Data / ML
    "pandas":           ("data_processing", "ml"),
    "numpy":            ("data_processing", "ml"),
    "matplotlib":       ("data_viz",        "ml"),
    "seaborn":          ("data_viz",        "ml"),
    "jupyter":          ("dev_env",         "ml"),
    "scikit_learn":     ("ml_framework",    "ml"),
    "sklearn":          ("ml_framework",    "ml"),
    "pytorch":          ("dl_framework",    "ml"),
    "tensorflow":       ("dl_framework",    "ml"),
    "keras":            ("dl_framework",    "ml"),
    "mlflow":           ("mlops",           "ml"),
    "kubeflow":         ("mlops",           "ml"),
    "airflow":          ("orchestration",   "ml"),
    "spark":            ("big_data",        "ml"),
    "dbt":              ("data_transform",  "ml"),
    "scala":            ("language",        "ml"),
    # JVM ecosystem
    "java":             ("language",        "jvm"),
    "kotlin":           ("language",        "jvm"),
    "spring":           ("web_framework",   "jvm"),
    "spring_boot":      ("web_framework",   "jvm"),
    "hibernate":        ("orm",             "jvm"),
    "maven":            ("build",           "jvm"),
    "gradle":           ("build",           "jvm"),
    "junit":            ("testing",         "jvm"),
    # JavaScript ecosystem
    "javascript":       ("language",        "javascript"),
    "typescript":       ("language",        "javascript"),
    "nodejs":           ("runtime",         "javascript"),
    "node":             ("runtime",         "javascript"),
    "react":            ("frontend_fw",     "javascript"),
    "vue":              ("frontend_fw",     "javascript"),
    "angular":          ("frontend_fw",     "javascript"),
    "svelte":           ("frontend_fw",     "javascript"),
    "express":          ("web_framework",   "javascript"),
    "nextjs":           ("web_framework",   "javascript"),
    "nestjs":           ("web_framework",   "javascript"),
    "webpack":          ("bundler",         "javascript"),
    "jest":             ("testing",         "javascript"),
    "html":             ("markup",          "web"),
    "css":              ("styling",         "web"),
    "tailwind":         ("styling",         "web"),
    # SQL databases
    "sql":              ("database",        "sql_db"),
    "postgresql":       ("database",        "sql_db"),
    "mysql":            ("database",        "sql_db"),
    "sqlite":           ("database",        "sql_db"),
    "mariadb":          ("database",        "sql_db"),
    "mssql":            ("database",        "sql_db"),
    "oracle":           ("database",        "sql_db"),
    # NoSQL databases
    "mongodb":          ("database",        "nosql_db"),
    "redis":            ("database",        "nosql_db"),
    "cassandra":        ("database",        "nosql_db"),
    "elasticsearch":    ("database",        "nosql_db"),
    "dynamodb":         ("database",        "nosql_db"),
    "neo4j":            ("database",        "nosql_db"),
    "couchdb":          ("database",        "nosql_db"),
    "firebase":         ("database",        "nosql_db"),
    # DevOps / Cloud
    "docker":           ("containerization","devops"),
    "kubernetes":       ("orchestration",   "devops"),
    "aws":              ("cloud",           "devops"),
    "gcp":              ("cloud",           "devops"),
    "azure":            ("cloud",           "devops"),
    "terraform":        ("iac",             "devops"),
    "ansible":          ("iac",             "devops"),
    "puppet":           ("iac",             "devops"),
    "jenkins":          ("ci_cd",           "devops"),
    "github_actions":   ("ci_cd",           "devops"),
    "ci_cd":            ("ci_cd",           "devops"),
    "gitlab":           ("ci_cd",           "devops"),
    "linux":            ("os",              "devops"),
    "bash":             ("scripting",       "devops"),
    "shell":            ("scripting",       "devops"),
    "prometheus":       ("monitoring",      "devops"),
    "grafana":          ("monitoring",      "devops"),
    # Mobile
    "swift":            ("language",        "ios"),
    "ios":              ("platform",        "ios"),
    "xcode":            ("ide",             "ios"),
    "android":          ("platform",        "android"),
    "android_studio":   ("ide",             "android"),
    # General / cross-cutting
    "git":              ("vcs",             "general"),
    "rest_api":         ("api_style",       "general"),
    "graphql":          ("api_style",       "general"),
    "grpc":             ("api_style",       "general"),
    "microservices":    ("architecture",    "general"),
    "agile":            ("methodology",     "general"),
    "scrum":            ("methodology",     "general"),
}

# Maps ecosystem -> broad superdomain; skills in the same superdomain get a bonus
_SUPERDOMAIN: dict[str, str] = {
    "sql_db":     "databases",
    "nosql_db":   "databases",
    "python":     "backend",
    "jvm":        "backend",
    "javascript": "backend",
    "devops":     "infrastructure",
    "ios":        "mobile",
    "android":    "mobile",
    "ml":         "data_science",
}

class JobMarketAI:
    """
    Unified inference interface for all job-market services.

    Parameters
    ----------
    cfg     : ModelConfig — paths and hyperparameters.
              If None, uses defaults (loads from default paths).
    device  : "cuda" / "cpu" / "auto" (default: auto-detect)
    """

    def __init__(
        self,
        cfg: Optional[ModelConfig] = None,
        device: str = "auto",
    ):
        self.cfg = cfg or ModelConfig()

        if device == "auto":
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        # ── Load vocab ────────────────────────────────────────────────────────
        self.skill_vocab, self.profile_vocab = self._load_vocab()
        self.idx_to_skill   = {v: k for k, v in self.skill_vocab.items() if k != "<PAD>"}
        self.idx_to_profile = {v: k for k, v in self.profile_vocab.items()}
        self.n_skills   = len(self.skill_vocab) - 1
        self.n_profiles = len(self.profile_vocab)

        # ── Load models ───────────────────────────────────────────────────────
        self.clf = self._load_classifier()
        self.vae = self._load_vae()

        # Pre-compute skill embedding matrix for cosine-similarity services
        self._skill_emb_matrix: Optional[torch.Tensor] = None

    # ──────────────────────────────────────────────────────────────────────────
    # Internal loaders
    # ──────────────────────────────────────────────────────────────────────────

    def _load_vocab(self):
        sv = self.cfg.processed_dir / "skill_vocab.json"
        pv = self.cfg.processed_dir / "profile_vocab.json"
        if not sv.exists() or not pv.exists():
            raise FileNotFoundError(
                f"Vocab files not found in {self.cfg.processed_dir}. "
                "Run `python train.py --rebuild_vocab` first."
            )
        with sv.open(encoding="utf-8") as f:
            skill_vocab = json.load(f)
        with pv.open(encoding="utf-8") as f:
            profile_vocab = json.load(f)
        return skill_vocab, profile_vocab

    def _load_classifier(self) -> Optional[ProfileClassifier]:
        path = self.cfg.model_dir / "profile_classifier.pt"
        if not path.exists():
            print(f"[inference] ProfileClassifier not found at {path}. "
                  "Run train.py first.")
            return None
        ckpt = torch.load(path, map_location="cpu", weights_only=False)
        model = ProfileClassifier(
            vocab_size=ckpt["n_skills"],
            n_profiles=ckpt["n_profiles"],
            embed_dim=self.cfg.embed_dim,
            hidden_dim=self.cfg.hidden_dim,
            n_heads=self.cfg.n_heads,
            dropout=0.0,   # no dropout at inference
        )
        model.load_state_dict(ckpt["model"])
        model.to(self.device).eval()
        print(f"[inference] Classifier loaded from {path}")
        return model

    def _load_vae(self) -> Optional[SkillVAE]:
        path = self.cfg.model_dir / "skill_vae.pt"
        if not path.exists():
            print(f"[inference] SkillVAE not found at {path}. "
                  "Run train.py --phase 2 first.")
            return None
        ckpt = torch.load(path, map_location="cpu", weights_only=False)
        model = SkillVAE(
            n_skills=ckpt["n_skills"],
            n_profiles=ckpt["n_profiles"],
            hidden_dim=self.cfg.hidden_dim,
            latent_dim=self.cfg.latent_dim,
            dropout=0.0,
        )
        model.load_state_dict(ckpt["model"])
        model.to(self.device).eval()
        print(f"[inference] SkillVAE loaded from {path}")
        return model

    # ──────────────────────────────────────────────────────────────────────────
    # Shared encoding helpers
    # ──────────────────────────────────────────────────────────────────────────

    def _normalize_input(self, raw_skills: list[str]) -> list[str]:
        """Normalize raw skill list using normalizer.py."""
        return normalize_skill_list(raw_skills)

    def _encode_skills_sequence(
        self, skills: list[str]
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Convert skill list → (skill_indices, skill_lengths) tensors on device.
        Returns shape (1, max_len) and (1,).
        """
        indices = [
            self.skill_vocab[s]
            for s in skills
            if s in self.skill_vocab
        ]
        L = min(len(indices), self.cfg.max_skills_per_cv)
        padded = indices[:L] + [0] * (self.cfg.max_skills_per_cv - L)
        idx_t  = torch.tensor([padded], dtype=torch.long, device=self.device)
        len_t  = torch.tensor([L], dtype=torch.long, device=self.device)
        return idx_t, len_t

    def _encode_skills_onehot(self, skills: list[str]) -> torch.Tensor:
        """Convert skill list → multi-hot FloatTensor (1, n_skills) on device."""
        vec = torch.zeros(1, self.n_skills, device=self.device)
        for s in skills:
            if s in self.skill_vocab:
                idx = self.skill_vocab[s]
                if 1 <= idx <= self.n_skills:
                    vec[0, idx - 1] = 1.0
        return vec

    def _encode_profile_onehot(self, profile: str) -> torch.Tensor:
        """Convert profile name → one-hot FloatTensor (1, n_profiles) on device."""
        vec = torch.zeros(1, self.n_profiles, device=self.device)
        if profile in self.profile_vocab:
            vec[0, self.profile_vocab[profile]] = 1.0
        return vec

    def _get_skill_embedding_matrix(self) -> torch.Tensor:
        """
        Returns the (n_skills, embed_dim) embedding weight matrix from the classifier.
        Cached after first call.
        """
        if self._skill_emb_matrix is not None:
            return self._skill_emb_matrix
        if self.clf is None:
            raise RuntimeError("ProfileClassifier not loaded.")
        # Weight rows 1..n_skills (row 0 is PAD)
        W = self.clf.encoder.embedding.weight.data[1:].clone()  # (n_skills, D)
        self._skill_emb_matrix = F.normalize(W, dim=-1)
        return self._skill_emb_matrix

    # ──────────────────────────────────────────────────────────────────────────
    # Service 4 — profile_recommendation
    # ──────────────────────────────────────────────────────────────────────────

    @torch.no_grad()

    def _taxonomy_bonus(
        self,
        job_skill: str,
        cand_norm: list[str],
        same_category_bonus: float = 0.75,
        same_ecosystem_bonus: float = 0.45,
        same_superdomain_bonus: float = 0.30,
    ) -> tuple[float, str | None]:
        """
        Return (bonus_score, best_candidate_skill) from the skill taxonomy.

        Scoring tiers
        -------------
        same (category, ecosystem) e.g. flask -> fastapi   : 0.75
        same ecosystem, diff category e.g. python -> fastapi: 0.45
        same superdomain e.g. sql -> mongodb               : 0.30
        no overlap                                          : 0.00
        """
        job_entry = SKILL_TAXONOMY.get(job_skill)
        if job_entry is None:
            return 0.0, None

        job_cat, job_eco = job_entry
        job_super = _SUPERDOMAIN.get(job_eco)

        best_bonus: float = 0.0
        best_skill: str | None = None

        for cand_skill in cand_norm:
            if cand_skill == job_skill:
                continue  # exact matches handled elsewhere
            cand_entry = SKILL_TAXONOMY.get(cand_skill)
            if cand_entry is None:
                continue
            cand_cat, cand_eco = cand_entry
            cand_super = _SUPERDOMAIN.get(cand_eco)

            if cand_eco == job_eco and cand_cat == job_cat:
                bonus = same_category_bonus
            elif cand_eco == job_eco:
                bonus = same_ecosystem_bonus
            elif cand_super and cand_super == job_super:
                bonus = same_superdomain_bonus
            else:
                bonus = 0.0

            if bonus > best_bonus:
                best_bonus = bonus
                best_skill = cand_skill

        return round(best_bonus, 4), best_skill

    def profile_recommendation(
        self,
        skills: list[str],
        topk: Optional[int] = None,
    ) -> list[ProfileScore]:
        """
        Which job profile(s) best match this skill set?

        Parameters
        ----------
        skills : raw skill list (will be normalized automatically)
        topk   : number of profiles to return (default: cfg.topk_profiles)

        Returns
        -------
        List of {"profile": str, "confidence": float} sorted by confidence desc.
        """
        if self.clf is None:
            raise RuntimeError("ProfileClassifier not loaded.")
        topk = topk or self.cfg.topk_profiles

        normalized = self._normalize_input(skills)
        idx_t, len_t = self._encode_skills_sequence(normalized)

        logits, _, _ = self.clf(idx_t, len_t)
        probs = torch.softmax(logits.float(), dim=-1).squeeze(0)  # (n_profiles,)

        topk_vals, topk_idxs = probs.topk(min(topk, self.n_profiles))

        return [
            {
                "profile": self.idx_to_profile[i.item()],
                "confidence": round(v.item(), 4),
            }
            for v, i in zip(topk_vals, topk_idxs)
        ]

    # ──────────────────────────────────────────────────────────────────────────
    # Service 1 — skill_importance
    # ──────────────────────────────────────────────────────────────────────────

    @torch.no_grad()
    def skill_importance(
        self,
        skills: list[str],
    ) -> list[SkillScore]:
        """
        Which of my skills are most valued by the model?

        Uses the attention weights from SkillEncoder: the model's internal
        mechanism for deciding which skills to emphasise when classifying.

        Returns
        -------
        List of {"skill": str, "score": float} sorted by score desc,
        only for skills that are in the vocabulary.
        """
        if self.clf is None:
            raise RuntimeError("ProfileClassifier not loaded.")

        normalized = self._normalize_input(skills)
        in_vocab = [s for s in normalized if s in self.skill_vocab]
        if not in_vocab:
            return []

        idx_t, len_t = self._encode_skills_sequence(normalized)

        _, _, attn_w = self.clf(idx_t, len_t)
        # attn_w: (1, max_len)
        attn = attn_w.squeeze(0).cpu().float()        # (max_len,)

        # Map positions back to skill names (only for non-pad positions)
        L = len_t.item()
        # The padded index tensor
        padded = idx_t.squeeze(0).cpu().tolist()

        results = []
        for pos in range(L):
            vocab_idx = padded[pos]
            skill_name = self.idx_to_skill.get(vocab_idx, None)
            if skill_name:
                results.append({
                    "skill": skill_name,
                    "score": round(attn[pos].item(), 5),
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results

    # ──────────────────────────────────────────────────────────────────────────
    # Service 2 — skill_liaison
    # ──────────────────────────────────────────────────────────────────────────

    @torch.no_grad()
    def skill_liaison(
        self,
        skills: list[str],
        topk: Optional[int] = None,
    ) -> list[SkillScore]:
        """
        Which skills naturally co-occur with mine (nearest neighbours in embedding space)?

        Approach
        --------
        1. Look up each input skill's embedding
        2. Compute mean vector
        3. Find cosine-similar skills in the embedding matrix (excluding known skills)

        Returns
        -------
        List of {"skill": str, "score": float} sorted by cosine similarity desc.
        """
        if self.clf is None:
            raise RuntimeError("ProfileClassifier not loaded.")
        topk = topk or self.cfg.topk_liaison

        normalized = self._normalize_input(skills)
        in_vocab = [s for s in normalized if s in self.skill_vocab]
        if not in_vocab:
            return []

        W = self._get_skill_embedding_matrix()   # (n_skills, D)  L2-normalised

        # Mean of input skill embeddings
        idxs = [self.skill_vocab[s] - 1 for s in in_vocab]   # 0-based into W
        query = W[idxs].mean(dim=0, keepdim=True)              # (1, D)
        query = F.normalize(query, dim=-1)

        # Cosine similarity with all skills
        sims = (W @ query.T).squeeze(-1)          # (n_skills,)

        # Mask out input skills
        for idx in idxs:
            if 0 <= idx < sims.shape[0]:
                sims[idx] = -1.0

        topk_vals, topk_idxs = sims.topk(min(topk, sims.shape[0]))

        return [
            {
                "skill": self.idx_to_skill.get(i.item() + 1, f"skill_{i.item()}"),
                "score": round(v.item(), 4),
            }
            for v, i in zip(topk_vals, topk_idxs)
            if v.item() > 0.0
        ]

    # ──────────────────────────────────────────────────────────────────────────
    # Service 3 — upskilling
    # ──────────────────────────────────────────────────────────────────────────

    @torch.no_grad()
    def upskilling(
        self,
        skills: list[str],
        target_profile: str,
        topk: Optional[int] = None,
        threshold: float = 0.25,
    ) -> list[SkillScore]:
        """
        What skills should I learn to reach a target profile?

        Parameters
        ----------
        skills         : current skill list
        target_profile : e.g. "data_engineer", "ml_engineer"
        topk           : how many skills to recommend
        threshold      : minimum sigmoid score to include a skill

        Returns
        -------
        List of {"skill": str, "score": float} — skills to acquire, ranked by priority.
        """
        if self.vae is None:
            raise RuntimeError("SkillVAE not loaded.")
        topk = topk or self.cfg.topk_upskilling

        normalized = self._normalize_input(skills)
        onehot  = self._encode_skills_onehot(normalized)                    # (1, n_skills)
        profile = self._encode_profile_onehot(target_profile.lower())       # (1, n_profiles)

        skill_idxs, scores = self.vae.recommend_upskilling(
            onehot, profile, topk=topk, threshold=threshold
        )

        results = []
        for idx, score in zip(skill_idxs.tolist(), scores.tolist()):
            name = self.idx_to_skill.get(idx, None)
            if name:
                results.append({"skill": name, "score": round(score, 4)})

        return sorted(results, key=lambda x: x["score"], reverse=True)

    # ──────────────────────────────────────────────────────────────────────────
    # Service 3b — explore_skills
    # ──────────────────────────────────────────────────────────────────────────

    @torch.no_grad()
    def explore_skills(
        self,
        skills: list[str],
        topk: Optional[int] = None,
        n_samples: int = 10,
    ) -> list[SkillScore]:
        """
        What new skills could I learn? (no fixed target profile)

        Samples from the VAE prior and aggregates skill probabilities,
        giving diverse exploration suggestions.

        Returns
        -------
        List of {"skill": str, "score": float} sorted by score desc.
        """
        if self.vae is None:
            raise RuntimeError("SkillVAE not loaded.")
        topk = topk or self.cfg.topk_upskilling

        normalized = self._normalize_input(skills)
        onehot = self._encode_skills_onehot(normalized)   # (1, n_skills)

        skill_idxs, scores = self.vae.explore_skills(onehot, n_samples=n_samples, topk=topk)

        results = []
        for idx, score in zip(skill_idxs.tolist(), scores.tolist()):
            name = self.idx_to_skill.get(idx, None)
            if name:
                results.append({"skill": name, "score": round(score, 4)})

        return sorted(results, key=lambda x: x["score"], reverse=True)

    # ──────────────────────────────────────────────────────────────────────────
    # Convenience: run all services at once

    # ──────────────────────────────────────────────────────────────────────────
    # Service 5 -- job_match_score
    # ──────────────────────────────────────────────────────────────────────────

    @torch.no_grad()
    def job_match_score(
        self,
        candidate_skills: list[str],
        job_skills: list[str],
        similar_threshold: float = 0.25,
        learnable_threshold: float = 0.10,
        learnable_weight: float = 0.7,
    ) -> dict:
        """
        Score how well a candidate's skills match a job's requirements.

        Three-tier scoring per job skill
        ---------------------------------
        matched   : candidate already has the skill            -> score = 1.0
        similar   : cos_sim >= similar_threshold (default 0.25) -> score = cos_sim
        learnable : cos_sim >= learnable_threshold (default 0.10)-> score = cos_sim * learnable_weight
        missing   : cos_sim <  learnable_threshold              -> score = 0.0

        final_score = sum(importance * match_score) / sum(importance) * 100
        """
        if self.clf is None:
            raise RuntimeError("ProfileClassifier not loaded.")

        # ── 1. Normalize both lists ───────────────────────────────────────
        cand_norm = self._normalize_input(candidate_skills)
        job_norm  = self._normalize_input(job_skills)
        cand_set  = set(cand_norm)

        if not job_norm:
            return {
                "score": 0.0,
                "candidate_skills_normalized": cand_norm,
                "job_skills_normalized": [],
                "breakdown": [],
                "stats": {
                    "total_job_skills": 0,
                    "exact_matches": 0,
                    "similar_matches": 0,
                    "learnable_matches": 0,
                    "missing": 0,
                    "candidate_skills_count": len(cand_norm),
                },
            }

        # ── 2. Importance weights via skill_importance(job_skills) ────────
        importance_results = self.skill_importance(job_norm)
        importance_map = {r["skill"]: r["score"] for r in importance_results}

        fallback_weight = (
            min(importance_map.values()) * 0.5 if importance_map else 1e-4
        )
        total_weight = sum(
            importance_map.get(s, fallback_weight) for s in job_norm
        )
        if total_weight == 0:
            total_weight = float(max(len(job_norm), 1))

        # ── 3. Embedding matrix for cosine-similarity ─────────────────────
        W = self._get_skill_embedding_matrix()        # (n_skills, D), L2-normd

        cand_in_vocab = [s for s in cand_norm if s in self.skill_vocab]
        if cand_in_vocab:
            cand_idxs = [self.skill_vocab[s] - 1 for s in cand_in_vocab]
            cand_embs = W[cand_idxs]                  # (n_cand, D)
        else:
            cand_embs = None

        # ── 4. Per-skill scoring ──────────────────────────────────────────
        breakdown: list[dict] = []
        weighted_score = 0.0
        exact_count = similar_count = learnable_count = missing_count = 0

        # Refined thresholds for HR clarity
        SIMILAR_THR = 0.45  # Higher bar for "Proche"
        LEARNABLE_THR = 0.20 # Minimum bar to be considered "Apprenable"

        for skill in job_norm:
            w     = importance_map.get(skill, fallback_weight)
            w_pct = round(w / total_weight * 100, 2)
            
            job_entry = SKILL_TAXONOMY.get(skill)
            job_cat, job_eco = job_entry if job_entry else (None, None)

            if skill in cand_set:
                # ── Exact match ───────────────────────────────────────────
                match_score   = 1.0
                status        = "matched"
                best_match    = skill
                sim_value     = 1.0
                justification = "Maîtrise confirmée de cette compétence."
                exact_count  += 1

            else:
                # ── Candidate vs Job Skill comparison ─────────────────────
                best_match_name = None
                best_match_score = 0.0
                best_match_type = "none" # "emb" or "tax"

                # A. Try embedding similarity (vector distance)
                if cand_embs is not None and skill in self.skill_vocab:
                    job_idx  = self.skill_vocab[skill] - 1
                    job_emb  = W[job_idx]
                    sims     = cand_embs @ job_emb
                    
                    # Instead of just taking the max, let's boost same-category skills
                    for i, cand_skill in enumerate(cand_in_vocab):
                        raw_sim = sims[i].item()
                        boost = 1.0
                        
                        cand_entry = SKILL_TAXONOMY.get(cand_skill)
                        if cand_entry and job_entry:
                            c_cat, c_eco = cand_entry
                            if c_cat == job_cat: boost += 0.25 # Favor same category (e.g. database vs database)
                            if c_eco == job_eco: boost += 0.15 # Favor same ecosystem
                        
                        final_sim = raw_sim * boost
                        if final_sim > best_match_score:
                            best_match_score = final_sim
                            best_match_name = cand_skill
                            best_match_type = "emb"
                            actual_sim = raw_sim # Store raw for UI

                # B. Try taxonomy bonus (rule-based)
                tax_score, tax_match = self._taxonomy_bonus(skill, cand_norm)
                if tax_score > best_match_score:
                    best_match_score = tax_score
                    best_match_name = tax_match
                    best_match_type = "tax"
                    actual_sim = tax_score

                # ── Final Assessment ──────────────────────────────────────
                match_score = min(best_match_score, 1.0)
                best_match = best_match_name
                sim_value = actual_sim if best_match_name else 0.0

                if match_score >= SIMILAR_THR:
                    status = "similar"
                    label = "Équivalente" if job_cat == SKILL_TAXONOMY.get(best_match, (None,))[0] else "Proche"
                    justification = f"Compétence {label.lower()} via {best_match} ({int(sim_value*100)}%)."
                    similar_count += 1
                elif match_score >= LEARNABLE_THR:
                    status = "learnable"
                    justification = f"Apprenable rapidement grâce à {best_match}."
                    match_score = match_score * learnable_weight # Penalty for learning curve
                    learnable_count += 1
                else:
                    status = "missing"
                    justification = "Compétence absente du profil."
                    match_score = 0.0
                    missing_count += 1

            weighted_score += w * match_score
            breakdown.append({
                "skill":          skill,
                "status":         status,
                "importance":     round(w, 5),
                "importance_pct": w_pct,
                "match_score":    round(match_score, 4),
                "best_match":     best_match,
                "similarity":     sim_value,
                "justification":  justification
            })

        # ── 5. Final score ────────────────────────────────────────────────
        final_score = round(weighted_score / total_weight * 100, 1)

        _order = {"matched": 0, "similar": 1, "learnable": 2, "missing": 3}
        breakdown.sort(key=lambda x: (_order[x["status"]], -x["importance"]))

        return {
            "score":                       final_score,
            "candidate_skills_normalized": cand_norm,
            "job_skills_normalized":       job_norm,
            "breakdown":                   breakdown,
            "stats": {
                "total_job_skills":       len(job_norm),
                "exact_matches":          exact_count,
                "similar_matches":        similar_count,
                "learnable_matches":      learnable_count,
                "missing":                missing_count,
                "candidate_skills_count": len(cand_norm),
            },
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Convenience: run all services at once
    # ──────────────────────────────────────────────────────────────────────────

    @torch.no_grad()
    def full_analysis(
        self,
        skills: list[str],
        target_profile: Optional[str] = None,
    ) -> dict:
        """
        Run all available services on a skill list.

        Returns
        -------
        {
          "normalized_skills": [...],
          "profile_recommendation": [...],
          "skill_importance":       [...],
          "skill_liaison":          [...],
          "upskilling":             [...],   # only if target_profile given
          "explore_skills":         [...],
        }
        """
        normalized = self._normalize_input(skills)
        result = {
            "normalized_skills": normalized,
            "profile_recommendation": self.profile_recommendation(skills),
            "skill_importance":       self.skill_importance(skills),
            "skill_liaison":          self.skill_liaison(skills),
            "explore_skills":         self.explore_skills(skills),
        }
        if target_profile:
            result["upskilling"] = self.upskilling(skills, target_profile)
        return result
