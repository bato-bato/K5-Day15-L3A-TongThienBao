"""AI Lecture-to-Lab Mapper (Level 1 Direct, Level 2 Hybrid, Level 3 GraphRAG).

Implements:
- Level 1: Direct lexical/rule + optional LLM JSON mapping
- Level 2: Hybrid Semantic Search Top-5 (Cosine + FTS5 RRF) + Mapping
- Level 3 (GraphRAG): Hybrid Semantic Top-5 + Multi-hop Graph DB Traversal (Theory <-> Practice)
  + Community Summaries + XML Spotlighting + Deterministic Guardrails Verification
"""
from __future__ import annotations

import json
import os
from typing import Any
from uuid import NAMESPACE_URL, uuid5

import httpx

from graph_db import (
    GOLD_MAPPING_RULES,
    ensure_graph_db_loaded,
    load_all_concepts_by_id,
    traverse_subgraph,
)
from guardrails import check_input_guard, spotlight, verify_mapping
from kg_builder import nfc
from kg_store import KG_DATA_DIR, load_nodes_by_id, search_kg
from repo_parser import parse_workspace_repo, save_repo_index
from semantic_engine import hybrid_search

REPO_INDEX_PATH = KG_DATA_DIR / "repo_index.json"


def ensure_repo_index() -> dict[str, Any]:
    if REPO_INDEX_PATH.exists():
        return json.loads(REPO_INDEX_PATH.read_text(encoding="utf-8"))
    if (REPO_INDEX_PATH.resolve().parents[3] / "starter-repo").exists():
        return save_repo_index()
    return parse_workspace_repo()


def _match_gold_rules(query: str, day: int | None) -> list[dict[str, Any]]:
    q_lower = nfc(query).lower()
    scored: list[tuple[int, dict[str, Any]]] = []
    for rule in GOLD_MAPPING_RULES:
        score = 0
        if day is not None and day in rule["days"]:
            score += 2
        for kw in rule["keywords"]:
            if kw in q_lower:
                score += 3
        if rule["checkpoint"].lower() in q_lower:
            score += 5
        if score >= 3:
            scored.append((score, rule))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored]


def _find_matching_code_refs(
    query: str,
    matched_rules: list[dict[str, Any]],
    repo_index: dict[str, Any],
    subgraph_nodes: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    refs: list[dict[str, Any]] = []
    seen: set[tuple[str, str | None]] = set()
    symbols_by_key = {(s["file_path"], s["symbol"]): s for s in repo_index.get("symbols", [])}

    # First collect code_symbol nodes discovered via GraphRAG traversal
    for gnode in subgraph_nodes or []:
        if gnode.get("node_kind") == "code_symbol":
            prov = gnode.get("provenance", {})
            fpath = prov.get("file_path")
            sym_name = prov.get("symbol")
            if fpath and (fpath, sym_name) not in seen:
                seen.add((fpath, sym_name))
                refs.append({"file_path": fpath, "symbol": sym_name})

    for rule in matched_rules[:2]:
        for target in rule["code_targets"]:
            key = (target["file_path"], target.get("symbol"))
            if key not in seen:
                seen.add(key)
                refs.append(target)

    q_lower = nfc(query).lower()
    for sym in repo_index.get("symbols", []):
        if sym["symbol"].lower() in q_lower or sym["file_path"].lower() in q_lower:
            key = (sym["file_path"], sym["symbol"])
            if key not in seen:
                seen.add(key)
                refs.append({"file_path": sym["file_path"], "symbol": sym["symbol"]})

    enriched: list[dict[str, Any]] = []
    for r in refs:
        sym = symbols_by_key.get((r["file_path"], r.get("symbol")))
        if sym:
            enriched.append(dict(sym))
        else:
            enriched.append(r)
    return enriched[:6]


def _maybe_llm_synthesize(
    clean_query: str,
    direction: str,
    knowledge_refs: list[dict[str, Any]],
    code_refs: list[dict[str, Any]],
    subgraph: dict[str, Any],
    all_concepts_by_id: dict[str, dict[str, Any]],
) -> str | None:
    """Optional real LLM synthesis using XML Spotlighting when LLM_API_KEY/OPENAI_API_KEY is configured."""
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key or os.environ.get("USE_REMOTE_LLM") == "0":
        return None

    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL", "gpt-4o-mini")

    concept_lines = []
    for k in knowledge_refs[:5]:
        node = all_concepts_by_id.get(k["concept_id"])
        if node:
            concept_lines.append(f"- {node['id']} (Ngày {node['day']}): {node['label']} — {node['summary'][:160]}")

    path_lines = [
        f"- {p['from_id']} --[{p['relation']}]--> {p['to_id']}"
        for p in subgraph.get("paths", [])[:8]
    ]
    code_lines = [
        f"- {c['file_path']}" + (f":{c['symbol']}()" if c.get("symbol") else "")
        for c in code_refs[:4]
    ]

    context_block = "\n".join([
        "Concepts:",
        *concept_lines,
        "Graph Paths:",
        *path_lines,
        "Code Refs:",
        *code_lines,
    ])
    user_payload = (
        f"{spotlight(clean_query, 'untrusted_user_query')}\n"
        f"{spotlight(context_block, 'graphrag_context')}\n"
        f"Direction: {direction}. Hãy tổng hợp ngắn gọn bằng tiếng Việt (2-3 câu), chỉ dựa trên concept_id và file trong graphrag_context."
    )
    try:
        resp = httpx.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "temperature": 0,
                "max_tokens": 260,
                "messages": [
                    {
                        "role": "system",
                        "content": "Bạn là AI Knowledge Graph Mapper. Chỉ giải thích dựa trên dữ liệu đã kiểm chứng trong <graphrag_context>, không bịa đặt.",
                    },
                    {"role": "user", "content": user_payload},
                ],
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"].strip()
        return nfc(text) if text else None
    except Exception:
        return None


def map_lecture_to_lab(
    query: str,
    day: int | None = None,
    mode: str = "graphrag",
    direction: str = "both",
) -> dict[str, Any]:
    """Map a user query or lab checkpoint using Level 1, Level 2, or Level 3 GraphRAG."""
    clean_query = nfc(query)
    norm_mode = mode if mode in ("level1", "level2", "level3", "graphrag") else "graphrag"
    norm_dir = direction if direction in ("both", "theory_to_practice", "practice_to_theory") else "both"

    guard = check_input_guard(clean_query)
    if guard["blocked"]:
        return {
            "query": clean_query,
            "mode": norm_mode,
            "direction": norm_dir,
            "blocked": True,
            "abstention": True,
            "status_code": "BLOCKED",
            "explanation": guard["reason"],
            "knowledge_refs": [],
            "code_refs": [],
            "checkpoints": [],
            "trap_warnings": [],
            "semantic_top5": [],
            "subgraph": {"direction": norm_dir, "max_hops": 0, "nodes": [], "edges": [], "paths": [], "communities": []},
            "communities": [],
            "verification": {
                "passed": False,
                "status_code": "BLOCKED",
                "blocked_by_input_guard": True,
                "matched_rules": guard["matched_rules"],
            },
        }

    ensure_graph_db_loaded()
    all_concepts_by_id = load_all_concepts_by_id()
    repo_index = ensure_repo_index()

    fts_hits = search_kg(clean_query, day=day, top_k=6)
    matched_rules = _match_gold_rules(clean_query, day)

    semantic_top5: list[dict[str, Any]] = []
    if norm_mode in ("level2", "level3", "graphrag"):
        node_kinds = ["concept"] if norm_mode == "level2" else None
        semantic_top5 = hybrid_search(clean_query, day=day, node_kinds=node_kinds, top_k=5)

    # Determine grounded candidate concepts & graph seeds
    candidate_ids: list[str] = []
    seed_ids: list[str] = []

    if norm_mode == "level1":
        for hit in fts_hits:
            if hit["id"] not in candidate_ids:
                candidate_ids.append(hit["id"])
    else:
        for hit in semantic_top5:
            if hit["id"] not in seed_ids:
                seed_ids.append(hit["id"])
            if hit["node_kind"] == "concept" and hit["id"] not in candidate_ids:
                candidate_ids.append(hit["id"])
        for hit in fts_hits:
            if hit["id"] not in candidate_ids:
                candidate_ids.append(hit["id"])
            if hit["id"] not in seed_ids:
                seed_ids.append(hit["id"])

    has_rule_keyword = any(kw in clean_query.lower() for rule in matched_rules for kw in rule["keywords"])
    if fts_hits or semantic_top5 or has_rule_keyword:
        for rule in matched_rules[:2]:
            if rule["checkpoint"] not in seed_ids and (semantic_top5 or has_rule_keyword):
                seed_ids.append(rule["checkpoint"])
            for cid in rule["concept_ids"]:
                if cid not in candidate_ids and cid in all_concepts_by_id:
                    candidate_ids.append(cid)

    # Multi-hop GraphRAG expansion for Level 3
    subgraph: dict[str, Any] = {
        "direction": norm_dir,
        "max_hops": 0,
        "nodes": [],
        "edges": [],
        "paths": [],
        "communities": [],
    }
    if norm_mode in ("level3", "graphrag") and seed_ids:
        subgraph = traverse_subgraph(seed_ids[:6], max_hops=2, direction=norm_dir)
        for gnode in subgraph["nodes"]:
            if gnode["node_kind"] == "concept" and gnode["id"] not in candidate_ids:
                candidate_ids.append(gnode["id"])

    knowledge_refs = []
    for cid in candidate_ids[:6]:
        node = all_concepts_by_id.get(cid)
        if node:
            knowledge_refs.append(
                {
                    "concept_id": node["id"],
                    "day": node["day"],
                    "pdf_pages": node.get("provenance", {}).get("pdf_pages", []),
                }
            )

    code_refs = (
        _find_matching_code_refs(clean_query, matched_rules, repo_index, subgraph_nodes=subgraph.get("nodes"))
        if knowledge_refs
        else []
    )
    trap_warnings = [rule["guardrail_warning"] for rule in matched_rules[:2]] if knowledge_refs else []
    for cid in candidate_ids:
        node = all_concepts_by_id.get(cid)
        if node and node["type"] == "FailureOrTrap" and node["label"] not in trap_warnings:
            trap_warnings.append(f"[{node['id']}] {node['label']}: {node['summary']}")

    checkpoints = [rule["checkpoint"] for rule in matched_rules[:2]] if knowledge_refs else []
    if not checkpoints and knowledge_refs:
        checkpoints = [
            g["id"] for g in subgraph.get("nodes", []) if g.get("node_kind") == "checkpoint"
        ][:2]

    if knowledge_refs:
        _ = spotlight(clean_query, "untrusted_user_query")
        llm_text = _maybe_llm_synthesize(
            clean_query, norm_dir, knowledge_refs, code_refs, subgraph, all_concepts_by_id
        )
        if llm_text:
            explanation = llm_text
        else:
            top_labels = ", ".join(
                f"{all_concepts_by_id[k['concept_id']]['label']} (Ngày {k['day']}"
                + (f", tr.{','.join(map(str, k['pdf_pages']))})" if k["pdf_pages"] else ")")
                for k in knowledge_refs[:3]
            )
            cp_text = f"Liên quan tới {', '.join(checkpoints)}. " if checkpoints else ""
            code_text = (
                "Mã nguồn đối chiếu: "
                + ", ".join(
                    f"{c['file_path']}" + (f":{c['symbol']}()" if c.get("symbol") else "")
                    for c in code_refs[:3]
                )
                + "."
                if code_refs
                else ""
            )
            graph_text = (
                f" GraphRAG mở rộng {len(subgraph['nodes'])} nút, {len(subgraph['edges'])} cạnh ({norm_dir})."
                if subgraph.get("nodes")
                else ""
            )
            explanation = f"{cp_text}Kiến thức trọng tâm: {top_labels}. {code_text}{graph_text}".strip()
    else:
        explanation = ""

    raw_result = {
        "query": clean_query,
        "mode": norm_mode,
        "direction": norm_dir,
        "blocked": False,
        "checkpoints": checkpoints,
        "explanation": explanation,
        "knowledge_refs": knowledge_refs,
        "code_refs": code_refs,
        "trap_warnings": trap_warnings[:3],
        "semantic_top5": [
            {
                "id": s["id"],
                "node_kind": s["node_kind"],
                "label": s["label"],
                "day": s["day"],
                "cosine_score": s.get("cosine_score", 0.0),
                "rrf_score": s.get("rrf_score", 0.0),
            }
            for s in semantic_top5
        ],
        "subgraph": subgraph,
        "communities": subgraph.get("communities", []),
    }

    return verify_mapping(raw_result, all_concepts_by_id, repo_index)


def get_day_lab_seed(day: int) -> list[dict[str, Any]]:
    """Pre-seed the Lab tab for each day (1..13) with verified Checkpoint -> Code -> Knowledge chains."""
    if not (1 <= day <= 13):
        return []
    kg_nodes_by_id = load_nodes_by_id()
    repo_index = ensure_repo_index()
    symbols_by_key = {(s["file_path"], s["symbol"]): s for s in repo_index.get("symbols", [])}

    day_rules = [r for r in GOLD_MAPPING_RULES if day in r["days"]]
    if not day_rules:
        day_rules = [GOLD_MAPPING_RULES[2]]

    nodes: list[dict[str, Any]] = []
    y_cursor = 40
    for rule in day_rules:
        cp_uuid = str(uuid5(NAMESPACE_URL, f"aicb-lab:{day}:{rule['id']}"))
        nodes.append(
            {
                "id": cp_uuid,
                "text": f"{rule['title']}\nBẫy cần tránh: {rule['guardrail_warning']}",
                "x": 60,
                "y": min(4096, y_cursor),
                "parent_id": None,
                "node_type": "checkpoint",
                "source_ref": {
                    "concept_id": rule["concept_ids"][0],
                    "day": day,
                    "pdf_pages": kg_nodes_by_id[rule["concept_ids"][0]]["provenance"]["pdf_pages"],
                    "section_ref": kg_nodes_by_id[rule["concept_ids"][0]]["provenance"]["section_ref"],
                    "key_quote": rule["guardrail_warning"],
                },
                "code_link": None,
                "verification_status": "verified",
            }
        )

        for c_idx, c_target in enumerate(rule["code_targets"][:3]):
            sym = symbols_by_key.get((c_target["file_path"], c_target.get("symbol")))
            c_uuid = str(uuid5(NAMESPACE_URL, f"aicb-lab:{day}:{rule['id']}:code:{c_idx}"))
            sym_label = f" -> {sym['symbol']}() L{sym['line_start']}-{sym['line_end']}" if sym else ""
            nodes.append(
                {
                    "id": c_uuid,
                    "text": f"[Code] {c_target['file_path']}{sym_label}",
                    "x": 420,
                    "y": min(4096, y_cursor + c_idx * 170),
                    "parent_id": cp_uuid,
                    "node_type": "code_ref",
                    "source_ref": None,
                    "code_link": {
                        "file_path": c_target["file_path"],
                        "symbol": sym["symbol"] if sym else None,
                        "line_start": sym["line_start"] if sym else 1,
                        "line_end": sym["line_end"] if sym else 1,
                    },
                    "verification_status": "verified",
                }
            )

        for k_idx, cid in enumerate(rule["concept_ids"][:3]):
            gt = kg_nodes_by_id.get(cid)
            if not gt:
                continue
            k_uuid = str(uuid5(NAMESPACE_URL, f"aicb-lab:{day}:{rule['id']}:kg:{cid}"))
            nodes.append(
                {
                    "id": k_uuid,
                    "text": f"[D{gt['day']} tr.{','.join(map(str, gt['provenance']['pdf_pages']))}] {gt['label']}\n{gt['summary']}",
                    "x": 780,
                    "y": min(4096, y_cursor + k_idx * 190),
                    "parent_id": cp_uuid,
                    "node_type": "trap" if gt["type"] == "FailureOrTrap" else "concept",
                    "source_ref": {
                        "concept_id": gt["id"],
                        "day": gt["day"],
                        "pdf_pages": gt["provenance"]["pdf_pages"],
                        "section_ref": gt["provenance"]["section_ref"],
                        "key_quote": gt["provenance"]["key_quote"],
                    },
                    "code_link": None,
                    "verification_status": "verified",
                }
            )

        y_cursor += 600

    return nodes
