"""Hybrid Semantic Search Engine (Dense Cosine Top-K + FTS5 BM25 RRF) for Level 2 & Level 3 GraphRAG.

Supports:
- Zero-key offline NFC-normalized TF-IDF + char n-gram 512-dim dense L2-normalized vectors
- Optional remote OpenAI-compatible embeddings when USE_REMOTE_EMBEDDINGS=1 and API key is set
- Reciprocal Rank Fusion (RRF) combining Vector Cosine similarity and SQLite FTS5 BM25
- Strict relevance gating so out-of-scope queries abstain cleanly
"""
from __future__ import annotations

import hashlib
import math
import os
import re
import unicodedata
from typing import Any

import httpx
import numpy as np

from graph_db import fts_search_graph_nodes, get_all_graph_nodes
from kg_builder import nfc

VECTOR_DIM = 1024
STOPWORDS = {
    "là", "gì", "của", "và", "cho", "trong", "khi", "nào", "thế", "như", "có", "không",
    "để", "với", "hướng", "dẫn", "cách", "làm", "sao", "những", "các", "này", "đó",
    "được", "bị", "về", "từ", "tới", "đến", "nên", "cần", "phải", "theo", "trên", "dưới",
    "the", "and", "for", "how", "what", "why", "with", "from", "into", "that", "this",
}

_CACHE: dict[str, Any] = {"signature": None, "nodes": [], "matrix": None}


def invalidate_semantic_cache() -> None:
    """Clear the cached embedding matrix so newly ingested lectures are indexed immediately."""
    _CACHE["signature"] = None
    _CACHE["nodes"] = []
    _CACHE["matrix"] = None


def tokenize_text(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFC", text or "").lower()
    tokens = re.findall(r"[0-9a-zA-ZÀ-ỹ_]+", normalized)
    filtered = [t for t in tokens if len(t) >= 2 and t not in STOPWORDS]
    return filtered or tokens


def _hash_bucket(feature: str, dim: int = VECTOR_DIM) -> tuple[int, float]:
    digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
    val = int.from_bytes(digest, "little")
    idx = val % dim
    sign = 1.0 if ((val >> 16) & 1) == 0 else -1.0
    return idx, sign


def _featurize(text: str, idf: dict[str, float] | None = None) -> np.ndarray:
    vec = np.zeros(VECTOR_DIM, dtype=np.float32)
    tokens = tokenize_text(text)
    if not tokens:
        return vec

    for tok in tokens:
        weight = (idf.get(tok, 1.5) if idf else 1.5) * 1.4
        idx, sign = _hash_bucket(f"w:{tok}")
        vec[idx] += sign * weight
        # Character 3-grams and 4-grams for longer compound/technical tokens
        if len(tok) >= 5:
            for n in (3, 4):
                for i in range(len(tok) - n + 1):
                    gram = tok[i : i + n]
                    g_idx, g_sign = _hash_bucket(f"c{n}:{gram}")
                    vec[g_idx] += g_sign * 0.25

    norm = float(np.linalg.norm(vec))
    if norm > 1e-8:
        vec /= norm
    return vec


def _maybe_remote_embed(texts: list[str]) -> np.ndarray | None:
    if os.environ.get("USE_REMOTE_EMBEDDINGS") != "1":
        return None
    api_key = os.environ.get("EMBEDDING_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
    try:
        resp = httpx.post(
            f"{base_url}/embeddings",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": model, "input": texts},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()["data"]
        mat = np.array([item["embedding"] for item in data], dtype=np.float32)
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        norms[norms < 1e-8] = 1.0
        return mat / norms
    except Exception:
        return None


def _ensure_index() -> tuple[list[dict[str, Any]], np.ndarray, dict[str, float]]:
    nodes = get_all_graph_nodes()
    sig = hashlib.sha256(
        "|".join(f"{n['id']}:{n['sha256']}" for n in sorted(nodes, key=lambda x: x["id"])).encode("utf-8")
    ).hexdigest()

    if _CACHE["signature"] == sig and _CACHE["matrix"] is not None:
        return _CACHE["nodes"], _CACHE["matrix"], _CACHE["idf"]

    doc_texts = [
        f"{n['id']} {n['label']} {n['label']} {' '.join(n.get('keywords', []))} {n['summary']} {n['provenance'].get('section_ref', '')}"
        for n in nodes
    ]

    # Compute IDF across all graph nodes
    df: dict[str, int] = {}
    for txt in doc_texts:
        for tok in set(tokenize_text(txt)):
            df[tok] = df.get(tok, 0) + 1
    total_docs = max(1, len(doc_texts))
    idf = {tok: math.log((total_docs + 1) / (freq + 1)) + 1.0 for tok, freq in df.items()}

    remote_mat = _maybe_remote_embed(doc_texts)
    if remote_mat is not None and remote_mat.shape[0] == len(nodes):
        matrix = remote_mat
    else:
        matrix = np.vstack([_featurize(txt, idf=idf) for txt in doc_texts]) if nodes else np.zeros((0, VECTOR_DIM), dtype=np.float32)

    _CACHE["signature"] = sig
    _CACHE["nodes"] = nodes
    _CACHE["matrix"] = matrix
    _CACHE["idf"] = idf
    return nodes, matrix, idf


def _count_token_hits(node: dict[str, Any], tokens: list[str]) -> int:
    haystack = (
        f"{node['id']} {node['label']} {node['summary']} "
        f"{' '.join(node.get('keywords', []))} {node['provenance'].get('section_ref', '')}"
    ).lower()
    haystack_words = set(re.findall(r"[0-9a-zA-ZÀ-ỹ_]+", haystack))
    return sum(1 for tok in tokens if tok in haystack_words or (len(tok) >= 5 and tok in haystack))


def hybrid_search(
    query: str,
    day: int | None = None,
    node_kinds: list[str] | None = None,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """Run Cosine Top-K + FTS5 BM25 RRF fusion over all Graph DB nodes."""
    clean_q = nfc(query)
    if not clean_q:
        return []
    tokens = tokenize_text(clean_q)
    if not tokens:
        return []

    nodes, matrix, idf = _ensure_index()
    if not nodes:
        return []

    # Query vector (remote if configured and matrix dimensions match, else local)
    q_vec: np.ndarray | None = None
    if matrix.shape[1] != VECTOR_DIM:
        remote_q = _maybe_remote_embed([clean_q])
        if remote_q is not None:
            q_vec = remote_q[0]
    if q_vec is None:
        if matrix.shape[1] != VECTOR_DIM:
            # Fallback to local matrix if remote dim mismatched
            matrix = np.vstack([
                _featurize(
                    f"{n['id']} {n['label']} {' '.join(n.get('keywords', []))} {n['summary']}",
                    idf=idf,
                )
                for n in nodes
            ])
        q_vec = _featurize(clean_q, idf=idf)

    cos_scores = matrix @ q_vec

    # Filter eligible indices by day and node_kinds
    allowed_kinds = set(node_kinds) if node_kinds else None
    vec_candidates: list[tuple[int, float]] = []
    for idx, node in enumerate(nodes):
        if day is not None and node["day"] not in (day, 0):
            continue
        if allowed_kinds and node["node_kind"] not in allowed_kinds:
            continue
        score = float(cos_scores[idx])
        if score >= 0.08:
            vec_candidates.append((idx, score))
    vec_candidates.sort(key=lambda item: item[1], reverse=True)

    vec_rank_by_id: dict[str, int] = {}
    cos_by_id: dict[str, float] = {}
    for rank, (idx, score) in enumerate(vec_candidates[: max(top_k * 4, 20)], start=1):
        nid = nodes[idx]["id"]
        vec_rank_by_id[nid] = rank
        cos_by_id[nid] = round(score, 4)

    # FTS5 BM25 search
    fts_hits = fts_search_graph_nodes(tokens, day=day, node_kinds=node_kinds, limit=max(top_k * 4, 20))
    fts_rank_by_id: dict[str, int] = {}
    min_hits = 2 if len(tokens) >= 4 else 1
    filtered_fts_rank = 0
    for hit in fts_hits:
        if _count_token_hits(hit, tokens) >= min_hits:
            filtered_fts_rank += 1
            fts_rank_by_id[hit["id"]] = filtered_fts_rank

    # Fuse via Reciprocal Rank Fusion (RRF k=60)
    node_by_id = {n["id"]: n for n in nodes}
    candidate_ids = set(vec_rank_by_id.keys()) | set(fts_rank_by_id.keys())
    scored: list[tuple[float, dict[str, Any]]] = []

    for nid in candidate_ids:
        node = node_by_id.get(nid)
        if not node:
            continue
        c_score = cos_by_id.get(nid, 0.0)
        v_rank = vec_rank_by_id.get(nid)
        f_rank = fts_rank_by_id.get(nid)
        token_hits = _count_token_hits(node, tokens)

        # Strict anti-noise gate so unrelated out-of-scope queries abstain cleanly
        if f_rank is None and (c_score < 0.24 or token_hits < min_hits):
            continue

        rrf = 0.0
        if v_rank is not None:
            rrf += 1.0 / (60.0 + v_rank)
        if f_rank is not None:
            rrf += 1.2 / (60.0 + f_rank)

        enriched = dict(node)
        enriched["cosine_score"] = c_score
        enriched["fts_rank"] = f_rank
        enriched["rrf_score"] = round(rrf, 6)
        scored.append((rrf, enriched))

    scored.sort(key=lambda item: (item[0], item[1]["cosine_score"]), reverse=True)
    return [item[1] for item in scored[:top_k]]
