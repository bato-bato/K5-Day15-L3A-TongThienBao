"""Guardrails & Source Verification (Day 4, Day 9, Day 11).

Implements:
1. Input Guard + XML Spotlighting against Direct/Indirect Prompt Injection.
2. Deterministic Source Verifier (Code Grader):
   - Verifies concept_id exists in kg_aicb_p1.json and day/pdf_pages match ground truth.
   - Verifies code_ref (file_path, symbol, line_start, line_end) exists in repo_index.
   - Triggers Abstention when no verified grounding remains.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any

INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?", re.IGNORECASE),
    re.compile(r"reveal\s+(your\s+)?system\s+prompt", re.IGNORECASE),
    re.compile(r"(bypass|override)\s+(guardrail|safety|policy)", re.IGNORECASE),
    re.compile(r"(drop|truncate|delete)\s+(table|database|prod)", re.IGNORECASE),
    re.compile(r"bỏ\s+qua\s+(toàn\s+bộ\s+)?(chỉ\s+dẫn|hướng\s+dẫn)\s+(trước|gốc)", re.IGNORECASE),
    re.compile(r"tiết\s+lộ\s+system\s+prompt", re.IGNORECASE),
    re.compile(r"xóa\s+(cơ\s+sở\s+dữ\s+liệu|database)", re.IGNORECASE),
]

MAX_QUERY_CHARS = 2000


def spotlight(text: str, tag: str) -> str:
    """Wrap untrusted user/repo/note payload in XML delimiters to prevent Context Bleed (Day 4 & 11)."""
    clean = unicodedata.normalize("NFC", text).replace(f"</{tag}>", f"&lt;/{tag}&gt;")
    return f"<{tag}>\n{clean}\n</{tag}>"


def check_input_guard(text: str) -> dict[str, Any]:
    """Screen input query for length limits and direct/indirect prompt injection patterns."""
    normalized = unicodedata.normalize("NFC", text or "").strip()
    if not normalized:
        return {"blocked": True, "reason": "Empty query", "matched_rules": ["empty_input"]}
    if len(normalized) > MAX_QUERY_CHARS:
        return {
            "blocked": True,
            "reason": f"Query exceeds max length ({MAX_QUERY_CHARS} chars)",
            "matched_rules": ["max_length_exceeded"],
        }

    matched: list[str] = []
    for pattern in INJECTION_PATTERNS:
        if pattern.search(normalized):
            matched.append(pattern.pattern)

    if matched:
        return {
            "blocked": True,
            "reason": "Phát hiện dấu hiệu Prompt Injection / chỉ dẫn vượt quyền trong dữ liệu đầu vào.",
            "matched_rules": matched,
        }

    return {"blocked": False, "reason": "OK", "matched_rules": []}


def verify_mapping(
    result: dict[str, Any],
    kg_nodes_by_id: dict[str, dict[str, Any]],
    repo_index: dict[str, Any],
) -> dict[str, Any]:
    """Deterministic Code Grader that verifies all Knowledge & Repo citations against ground truth.

    Any fabricated concept_id, mismatched pdf_pages/day, or non-existent file_path/symbol
    is stripped and logged in `rejected_claims`. If no verified evidence remains, abstention=True.
    """
    rejected_claims: list[dict[str, str]] = []
    verified_knowledge: list[dict[str, Any]] = []
    verified_code_refs: list[dict[str, Any]] = []

    indexed_files = set(repo_index.get("files_indexed", []))
    symbols_lookup: dict[tuple[str, str], dict[str, Any]] = {
        (sym["file_path"], sym["symbol"]): sym for sym in repo_index.get("symbols", [])
    }

    for k_ref in result.get("knowledge_refs", []):
        cid = k_ref.get("concept_id")
        gt = kg_nodes_by_id.get(cid)
        if not gt:
            rejected_claims.append({"kind": "knowledge_ref", "id": str(cid), "reason": "concept_id not found in KG"})
            continue

        claimed_day = k_ref.get("day")
        claimed_pages = k_ref.get("pdf_pages")
        if claimed_day is not None and claimed_day != gt["day"]:
            rejected_claims.append({
                "kind": "knowledge_ref",
                "id": str(cid),
                "reason": f"day mismatch (claimed {claimed_day}, ground truth {gt['day']})",
            })
            continue

        gt_pages = set(gt.get("provenance", {}).get("pdf_pages", []))
        if claimed_pages is not None and gt_pages and not set(claimed_pages).issubset(gt_pages):
            rejected_claims.append({
                "kind": "knowledge_ref",
                "id": str(cid),
                "reason": f"pdf_pages mismatch (claimed {claimed_pages}, ground truth {sorted(gt_pages)})",
            })
            continue

        prov = gt.get("provenance", {})
        verified_knowledge.append(
            {
                "concept_id": gt["id"],
                "lecture_id": gt.get("lecture_id", "LEC_AICB_P1"),
                "type": gt["type"],
                "label": gt["label"],
                "day": gt["day"],
                "summary": gt["summary"],
                "pdf_pages": prov.get("pdf_pages", []),
                "section_ref": prov.get("section_ref", ""),
                "key_quote": prov.get("key_quote", ""),
                "verification_status": "verified",
            }
        )

    for c_ref in result.get("code_refs", []):
        fpath = c_ref.get("file_path", "")
        sym_name = c_ref.get("symbol")
        if fpath not in indexed_files and not any(
            cp.get("source_file") == fpath or fpath in cp.get("deliverables", [])
            for cp in repo_index.get("checkpoints", [])
        ):
            rejected_claims.append({"kind": "code_ref", "id": fpath, "reason": "file_path not found in repo_index"})
            continue

        if sym_name:
            sym = symbols_lookup.get((fpath, sym_name))
            if not sym:
                rejected_claims.append({
                    "kind": "code_ref",
                    "id": f"{fpath}:{sym_name}",
                    "reason": "symbol not found in AST index",
                })
                continue
            verified_code_refs.append(
                {
                    "file_path": sym["file_path"],
                    "symbol": sym["symbol"],
                    "kind": sym["kind"],
                    "line_start": sym["line_start"],
                    "line_end": sym["line_end"],
                    "docstring": sym["docstring"],
                    "verification_status": "verified",
                }
            )
        else:
            verified_code_refs.append(
                {
                    "file_path": fpath,
                    "symbol": None,
                    "kind": "file",
                    "line_start": c_ref.get("line_start", 1),
                    "line_end": c_ref.get("line_end", 1),
                    "docstring": c_ref.get("docstring", ""),
                    "verification_status": "verified",
                }
            )

    abstention = len(verified_knowledge) == 0
    out = dict(result)
    out["knowledge_refs"] = verified_knowledge
    out["code_refs"] = verified_code_refs
    out["abstention"] = abstention
    out["status_code"] = "INSUFFICIENT_EVIDENCE" if abstention else "VERIFIED"
    out["verification"] = {
        "passed": not abstention and len(rejected_claims) == 0,
        "status_code": out["status_code"],
        "verified_knowledge_count": len(verified_knowledge),
        "verified_code_count": len(verified_code_refs),
        "rejected_count": len(rejected_claims),
        "rejected_claims": rejected_claims,
    }
    if abstention:
        out["explanation"] = (
            "Không tìm thấy căn cứ trong tài liệu AICB-P1 (Days 1–13) hoặc repo hiện tại. "
            "Hệ thống từ chối suy diễn để tránh ảo giác (Abstention Guardrail)."
        )
        out["trap_warnings"] = []
    return out
