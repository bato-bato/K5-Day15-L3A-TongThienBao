"""Embedded SQLite Property Graph Database for Level 3 GraphRAG.

Implements:
- Canonical 7 Knowledge Graph relations matching .archify/candidate.json
- Multi-layer graph nodes: concept, checkpoint, code_symbol
- Multi-lecture support with Unicode NFC normalization and SHA-256 provenance
- FTS5 index with remove_diacritics 0 for Vietnamese tone preservation
- Deterministic weighted Label Propagation community detection
- SQLite WITH RECURSIVE multi-hop traversal for Theory <-> Practice mapping
- mapping.json export
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
from collections import Counter, defaultdict
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from kg_builder import nfc
from kg_store import KG_DATA_DIR, ensure_kg_loaded
from repo_parser import parse_workspace_repo, save_repo_index

GRAPH_DB_PATH = Path(os.environ.get("GRAPH_DB_PATH", str(KG_DATA_DIR / "graphrag.sqlite3")))
MAPPING_EXPORT_PATH = KG_DATA_DIR / "mapping.json"
REPO_INDEX_PATH = KG_DATA_DIR / "repo_index.json"

CANONICAL_RELATIONS = {
    "IS_PART_OF",
    "PREREQUISITE_OF",
    "EXTENDS",
    "APPLIED_IN",
    "IMPLEMENTED_BY",
    "EXPLAINED_IN",
    "RELATED_TO",
}

RELATION_MAP = {
    "CONTAINS": "IS_PART_OF",
    "IS_PART_OF": "IS_PART_OF",
    "PREREQUISITE_OF": "PREREQUISITE_OF",
    "EVOLVES_INTO": "EXTENDS",
    "EXTENDS": "EXTENDS",
    "IMPLEMENTED_IN_LAB": "APPLIED_IN",
    "APPLIED_IN": "APPLIED_IN",
    "IMPLEMENTED_BY": "IMPLEMENTED_BY",
    "ILLUSTRATED_BY": "EXPLAINED_IN",
    "EXPLAINED_IN": "EXPLAINED_IN",
    "MITIGATES_FAILURE": "RELATED_TO",
    "MEASURED_BY": "RELATED_TO",
    "RELATED_TO": "RELATED_TO",
}

# Gold Mapping Baseline tying Checkpoints & Repo Files -> Knowledge Graph Nodes
GOLD_MAPPING_RULES: list[dict[str, Any]] = [
    {
        "id": "MAP_CP1",
        "checkpoint": "CP1",
        "title": "CP1: Khám phá Pain & Định lượng Impact",
        "keywords": ["cp1", "pain", "impact", "bằng chứng", "double diamond", "problem statement", "hypothesis", "data-mining", "canvas"],
        "days": [2, 5],
        "code_targets": [
            {"file_path": "starter-repo/spec.md", "symbol": None},
            {"file_path": "starter-repo/evidence/data-mining.md", "symbol": None},
            {"file_path": "starter-repo/canvas.md", "symbol": None},
        ],
        "concept_ids": ["CON_D2_PROBLEM_DISCOVERY", "CON_D2_PROBLEM_CARD", "ERR_D2_ANTIPATTERNS", "PAT_D5_UX_4PATHS"],
        "guardrail_warning": "Tránh Solution-first, No baseline, hoặc lấy dữ liệu giả lập làm bằng chứng pain.",
    },
    {
        "id": "MAP_CP2",
        "checkpoint": "CP2",
        "title": "CP2: Thiết kế Kiến trúc, Data Card & Chốt Metric Spec",
        "keywords": ["cp2", "metric", "metric_spec", "benchmark", "data_card", "workflow", "autonomy", "chuẩn đạt", "chốt"],
        "days": [2, 6, 8, 9],
        "code_targets": [
            {"file_path": "starter-repo/eval/metric_spec.yaml", "symbol": None},
            {"file_path": "starter-repo/data/DATA_CARD.md", "symbol": None},
            {"file_path": "starter-repo/spec.md", "symbol": None},
        ],
        "concept_ids": ["PAT_D2_BUILD_BOOST_BUY", "CON_D8_4LEVELS_WORKFLOWS", "MET_D6_DAMA_KAPPA", "CON_D9_DATASETS_RATCHET_CI"],
        "guardrail_warning": "Không chọn Multi-Agent khi Workflow đã đủ; tuyệt đối không sửa chuẩn 'đạt' sau khi chạy eval (Ratchet rule).",
    },
    {
        "id": "MAP_CP3_AGENT",
        "checkpoint": "CP3",
        "title": "CP3 (Core Code): ReAct Agent, Prompt & Tool Calling",
        "keywords": ["cp3", "agent", "agent.py", "tools.py", "ai.py", "react", "tool calling", "prompt", "xml", "langgraph", "tracing"],
        "days": [1, 3, 4],
        "code_targets": [
            {"file_path": "starter-repo/codebase/agent.py", "symbol": "answer"},
            {"file_path": "starter-repo/codebase/tools.py", "symbol": "search_example"},
            {"file_path": "starter-repo/codebase/ai.py", "symbol": "call_model"},
        ],
        "concept_ids": ["PAT_D3_REACT_HYBRID", "CON_D3_SYSTEM_PROMPT_SAFEGUARDS", "PAT_D4_XML_DETERMINISM", "PAT_D4_TOOL_LOOP_LANGGRAPH"],
        "guardrail_warning": "Bọc try/except quanh tool, giới hạn MAX_ITERATIONS, dùng XML Spotlighting chống Context Bleed.",
    },
    {
        "id": "MAP_CP3_RAG_DATA",
        "checkpoint": "CP3",
        "title": "CP3 (Data & RAG): Corpus sạch, FTS5 & Grounding",
        "keywords": ["rag", "retrieval", "fts5", "unicode", "nfc", "medallion", "scd", "hybrid", "rrf", "citation", "nguồn", "kg_store", "graphrag"],
        "days": [6, 7],
        "code_targets": [
            {"file_path": "learning-app/backend/kg_store.py", "symbol": "search_kg"},
            {"file_path": "learning-app/backend/kg_builder.py", "symbol": "nfc"},
            {"file_path": "learning-app/backend/repo_parser.py", "symbol": "parse_workspace_repo"},
        ],
        "concept_ids": ["CON_D6_4PRINCIPLES_MEDALLION", "ERR_D6_HOSTILE_DOCS_UNICODE", "PAT_D6_STORAGE_HYBRID_RRF", "PAT_D7_RETRIEVAL", "PAT_D7_GEN_POSTGEN"],
        "guardrail_warning": "Bắt buộc normalize NFC và FTS5 remove_diacritics 0 cho tiếng Việt; lọc is_current=True trước ANN/RRF.",
    },
    {
        "id": "MAP_CP3_SAFETY",
        "checkpoint": "CP3",
        "title": "CP3 (Safety & HITL): Guardrails, Lethal Trifecta & Durable HITL",
        "keywords": ["guardrail", "hitl", "an toàn", "safety", "injection", "lethal trifecta", "camel", "interrupt", "pdpl", "luật ai", "approval"],
        "days": [11],
        "code_targets": [
            {"file_path": "learning-app/backend/guardrails.py", "symbol": "check_input_guard"},
            {"file_path": "learning-app/backend/guardrails.py", "symbol": "verify_mapping"},
            {"file_path": "starter-repo/codebase/agent.py", "symbol": "answer"},
        ],
        "concept_ids": ["PAT_D11_DEFENSE_TRIFECTA_CAMEL", "PAT_D11_DURABLE_HITL_ROUTING", "ERR_D11_AUTOMATION_BIAS_FATIGUE", "CON_D11_LEGAL_VN_EU_2026"],
        "guardrail_warning": "Không cấp đủ 3 yếu tố Lethal Trifecta cho 1 agent; tách side-effect sau interrupt() để tránh chạy 2 lần.",
    },
    {
        "id": "MAP_CP4_EVAL",
        "checkpoint": "CP4",
        "title": "CP4 (Eval): Error Analysis, Layered Grader & Bootstrap CI",
        "keywords": ["cp4", "eval", "run_eval", "rogan", "bootstrap", "judge", "grader", "failure", "trace", "pass@k", "pass^k", "report"],
        "days": [5, 8, 9],
        "code_targets": [
            {"file_path": "starter-repo/eval/run_eval.py", "symbol": None},
            {"file_path": "starter-repo/run.py", "symbol": None},
            {"file_path": "starter-repo/eval/metric_spec.yaml", "symbol": None},
        ],
        "concept_ids": ["CON_D9_ERROR_ANALYSIS_5LAYERS", "PAT_D9_EVAL_HARNESS_LAYERED_GRADER", "MET_D9_ROGAN_GLADEN_BOOTSTRAP", "MET_D8_PASS_AT_POWER_K"],
        "guardrail_warning": "Code kiểm được thì để Code Grader chấm; Judge phải khác họ model với Agent và calibrate trên held-out.",
    },
    {
        "id": "MAP_CP4_ECONOMICS",
        "checkpoint": "CP4",
        "title": "CP4 (Economics & Launch): Cost-of-Pass, Pilot & Cloud Deploy",
        "keywords": ["cost", "simulate", "cost-of-pass", "hoàn tiền", "pilot", "peeking", "docker", "sse", "cloud", "tco", "go-live", "gate"],
        "days": [10, 12, 13],
        "code_targets": [
            {"file_path": "starter-repo/cost/simulate.py", "symbol": None},
            {"file_path": "starter-repo/cost/personas.yaml", "symbol": None},
            {"file_path": "learning-app/backend/main.py", "symbol": "get_workspace"},
        ],
        "concept_ids": ["MET_D13_COST_OF_PASS", "PAT_D13_CONTROLLED_PILOT", "CON_D10_STAGE_GATE_5ELEMENTS", "MET_D10_INFRA_TCO_OPS", "PAT_D12_GATEWAY_CACHE_SERVING"],
        "guardrail_warning": "Hóa đơn token chỉ là phần nổi; >85% chi phí nằm ở Human Review & Rework. Chống Peeking problem khi chạy Pilot.",
    },
]


def _get_repo_index() -> dict[str, Any]:
    if REPO_INDEX_PATH.exists():
        return json.loads(REPO_INDEX_PATH.read_text(encoding="utf-8"))
    if (Path(__file__).resolve().parents[2] / "starter-repo").exists():
        return save_repo_index()
    return parse_workspace_repo()


def _init_schema(db: sqlite3.Connection) -> None:
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""
        CREATE TABLE IF NOT EXISTS lectures (
            lecture_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            source_file TEXT NOT NULL,
            day INTEGER NOT NULL,
            sha256 TEXT NOT NULL,
            is_current INTEGER NOT NULL DEFAULT 1,
            ingested_at TEXT NOT NULL
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS graph_nodes (
            id TEXT PRIMARY KEY,
            lecture_id TEXT NOT NULL,
            node_kind TEXT NOT NULL CHECK (node_kind IN ('concept', 'checkpoint', 'code_symbol')),
            type TEXT NOT NULL,
            label TEXT NOT NULL,
            day INTEGER NOT NULL,
            summary TEXT NOT NULL,
            keywords_json TEXT NOT NULL,
            provenance_json TEXT NOT NULL,
            sha256 TEXT NOT NULL
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS graph_edges (
            source TEXT NOT NULL,
            target TEXT NOT NULL,
            relation TEXT NOT NULL,
            weight REAL NOT NULL DEFAULT 1.0,
            evidence_json TEXT NOT NULL DEFAULT '{}',
            PRIMARY KEY (source, target, relation)
        )
    """)
    db.execute("CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target)")
    db.execute("""
        CREATE TABLE IF NOT EXISTS communities (
            community_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            member_ids_json TEXT NOT NULL,
            top_keywords_json TEXT NOT NULL,
            day_span_json TEXT NOT NULL
        )
    """)
    db.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS graph_nodes_fts USING fts5(
            id UNINDEXED,
            label,
            summary,
            keywords,
            tokenize='unicode61 remove_diacritics 0'
        )
    """)


def _insert_node_and_fts(db: sqlite3.Connection, node: dict[str, Any]) -> None:
    label = nfc(node["label"])
    summary = nfc(node["summary"])
    keywords = [nfc(k) for k in node.get("keywords", [])]
    db.execute(
        """
        INSERT OR REPLACE INTO graph_nodes
        (id, lecture_id, node_kind, type, label, day, summary, keywords_json, provenance_json, sha256)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            node["id"],
            node["lecture_id"],
            node["node_kind"],
            node["type"],
            label,
            int(node["day"]),
            summary,
            json.dumps(keywords, ensure_ascii=False),
            json.dumps(node.get("provenance", {}), ensure_ascii=False),
            node["sha256"],
        ),
    )
    db.execute("DELETE FROM graph_nodes_fts WHERE id = ?", (node["id"],))
    db.execute(
        "INSERT INTO graph_nodes_fts (id, label, summary, keywords) VALUES (?, ?, ?, ?)",
        (node["id"], label, summary, nfc(" ".join(keywords))),
    )


def _insert_edge(
    db: sqlite3.Connection,
    source: str,
    target: str,
    relation: str,
    weight: float = 1.0,
    evidence: dict[str, Any] | None = None,
) -> None:
    canon_rel = RELATION_MAP.get(relation, "RELATED_TO")
    if canon_rel not in CANONICAL_RELATIONS:
        canon_rel = "RELATED_TO"
    db.execute(
        """
        INSERT OR REPLACE INTO graph_edges (source, target, relation, weight, evidence_json)
        VALUES (?, ?, ?, ?, ?)
        """,
        (source, target, canon_rel, float(weight), json.dumps(evidence or {}, ensure_ascii=False)),
    )


def _code_node_id(file_path: str, symbol: str | None) -> str:
    return f"CODE:{file_path}:{symbol}" if symbol else f"CODE:{file_path}"


def _rebuild_communities(db: sqlite3.Connection) -> list[dict[str, Any]]:
    """Run deterministic weighted Label Propagation on undirected graph projection."""
    node_rows = db.execute(
        "SELECT id, node_kind, type, label, day, keywords_json FROM graph_nodes ORDER BY id ASC"
    ).fetchall()
    if not node_rows:
        db.execute("DELETE FROM communities")
        return []

    nodes_meta: dict[str, dict[str, Any]] = {}
    for nid, nkind, ntype, label, day, kw_json in node_rows:
        nodes_meta[nid] = {
            "id": nid,
            "node_kind": nkind,
            "type": ntype,
            "label": label,
            "day": day,
            "keywords": json.loads(kw_json),
        }

    adj: dict[str, list[tuple[str, float]]] = defaultdict(list)
    edge_rows = db.execute("SELECT source, target, weight FROM graph_edges").fetchall()
    for src, tgt, w in edge_rows:
        if src in nodes_meta and tgt in nodes_meta and src != tgt:
            adj[src].append((tgt, float(w)))
            adj[tgt].append((src, float(w)))

    labels: dict[str, str] = {nid: nid for nid in nodes_meta}
    sorted_ids = sorted(nodes_meta.keys())

    for _ in range(15):
        changed = False
        for nid in sorted_ids:
            neighbors = adj.get(nid)
            if not neighbors:
                continue
            scores: dict[str, float] = defaultdict(float)
            for nb, w in neighbors:
                scores[labels[nb]] += w
            # Deterministic tie-breaking: highest weight, then lexicographically smallest label
            best_label = min(scores.keys(), key=lambda lbl: (-scores[lbl], lbl))
            if best_label != labels[nid]:
                labels[nid] = best_label
                changed = True
        if not changed:
            break

    groups: dict[str, list[str]] = defaultdict(list)
    for nid, lbl in labels.items():
        groups[lbl].append(nid)

    # Sort groups by size desc, then min member id
    ordered_groups = sorted(groups.values(), key=lambda g: (-len(g), min(g)))

    db.execute("DELETE FROM communities")
    communities: list[dict[str, Any]] = []
    for idx, members in enumerate(ordered_groups, start=1):
        members_sorted = sorted(members)
        comm_id = f"COMM_{idx:03d}"

        kw_counter: Counter[str] = Counter()
        days: set[int] = set()
        kinds_count: Counter[str] = Counter()
        rep_labels: list[str] = []

        for mid in members_sorted:
            meta = nodes_meta[mid]
            kinds_count[meta["node_kind"]] += 1
            if meta["day"] > 0:
                days.add(meta["day"])
            for kw in meta["keywords"]:
                if kw:
                    kw_counter[kw] += 1
            if meta["type"] == "DayModule" or meta["node_kind"] == "checkpoint":
                rep_labels.append(meta["label"])

        if not rep_labels:
            rep_labels = [nodes_meta[m]["label"] for m in members_sorted[:2]]

        top_kws = [k for k, _ in kw_counter.most_common(6)]
        day_span = sorted(days)
        title = nfc(rep_labels[0]) if len(rep_labels) == 1 else nfc(f"{rep_labels[0]} (+{len(members_sorted) - 1} nút)")
        day_text = f"Ngày {day_span[0]}–{day_span[-1]}" if len(day_span) > 1 else (f"Ngày {day_span[0]}" if day_span else "Đa ngày")
        summary = nfc(
            f"Cụm {comm_id} ({day_text}): {len(members_sorted)} nút "
            f"[{kinds_count.get('concept', 0)} concept, {kinds_count.get('checkpoint', 0)} CP, {kinds_count.get('code_symbol', 0)} code]. "
            f"Từ khóa: {', '.join(top_kws[:5]) if top_kws else 'N/A'}."
        )

        comm = {
            "community_id": comm_id,
            "title": title,
            "summary": summary,
            "member_ids": members_sorted,
            "top_keywords": top_kws,
            "day_span": day_span,
        }
        communities.append(comm)
        db.execute(
            """
            INSERT INTO communities (community_id, title, summary, member_ids_json, top_keywords_json, day_span_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                comm_id,
                comm["title"],
                comm["summary"],
                json.dumps(members_sorted, ensure_ascii=False),
                json.dumps(top_kws, ensure_ascii=False),
                json.dumps(day_span, ensure_ascii=False),
            ),
        )

    return communities


def ensure_graph_db_loaded(force: bool = False) -> dict[str, Any]:
    """Synchronize base AICB-P1 KG, checkpoints, and repo AST symbols into graphrag.sqlite3."""
    kg = ensure_kg_loaded()
    repo_index = _get_repo_index()
    GRAPH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    kg_hash = hashlib.sha256(
        json.dumps(
            {
                "version": kg["version"],
                "nodes": len(kg["nodes"]),
                "edges": len(kg["edges"]),
                "symbols": len(repo_index.get("symbols", [])),
                "rules": len(GOLD_MAPPING_RULES),
            },
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()

    with closing(sqlite3.connect(GRAPH_DB_PATH)) as db, db:
        _init_schema(db)
        existing_lec = db.execute(
            "SELECT sha256 FROM lectures WHERE lecture_id = 'LEC_AICB_P1'"
        ).fetchone()
        existing_count = db.execute("SELECT COUNT(*) FROM graph_nodes").fetchone()[0]

        if not force and existing_lec and existing_lec[0] == kg_hash and existing_count > 0:
            return get_graph_stats_from_conn(db)

        now_iso = datetime.now(timezone.utc).isoformat()
        db.execute(
            """
            INSERT OR REPLACE INTO lectures (lecture_id, title, source_file, day, sha256, is_current, ingested_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
            ("LEC_AICB_P1", "VinUni AICB-P1 / AI20K (Days 1–13)", "AICB-P1.pdf", 0, kg_hash, now_iso),
        )

        # 1. Concept nodes from base KG
        for node in kg["nodes"]:
            _insert_node_and_fts(
                db,
                {
                    "id": node["id"],
                    "lecture_id": "LEC_AICB_P1",
                    "node_kind": "concept",
                    "type": node["type"],
                    "label": node["label"],
                    "day": node["day"],
                    "summary": node["summary"],
                    "keywords": node.get("keywords", []),
                    "provenance": node["provenance"],
                    "sha256": node["sha256"],
                },
            )

        # 2. Concept-to-Concept edges mapped to canonical 7 relations
        for edge in kg["edges"]:
            rel = edge["relation"]
            if rel == "CONTAINS":
                # Reverse DayModule -> child into child IS_PART_OF DayModule
                _insert_edge(db, edge["target"], edge["source"], "IS_PART_OF", edge.get("weight", 1.0))
            else:
                _insert_edge(db, edge["source"], edge["target"], rel, edge.get("weight", 1.0))

        # 3. Checkpoint nodes (CP1..CP4)
        for cp in repo_index.get("checkpoints", []):
            cp_id = cp["id"]
            cp_sha = hashlib.sha256(f"{cp_id}|{cp['title']}|{cp['summary']}".encode("utf-8")).hexdigest()
            _insert_node_and_fts(
                db,
                {
                    "id": cp_id,
                    "lecture_id": "LEC_AICB_P1",
                    "node_kind": "checkpoint",
                    "type": "HackathonCheckpoint",
                    "label": cp["title"],
                    "day": 0,
                    "summary": cp["summary"],
                    "keywords": [cp_id, *cp.get("deliverables", [])],
                    "provenance": {
                        "source_file": cp["source_file"],
                        "deliverables": cp.get("deliverables", []),
                        "pdf_pages": [],
                        "section_ref": cp["title"],
                        "key_quote": cp["summary"],
                    },
                    "sha256": cp_sha,
                },
            )

        # 4. Code symbol nodes from Repo AST Parser
        for sym in repo_index.get("symbols", []):
            cid = _code_node_id(sym["file_path"], sym["symbol"])
            summary = sym.get("docstring") or f"{sym['kind']} {sym['symbol']} in {sym['file_path']} (L{sym['line_start']}-{sym['line_end']})"
            c_sha = hashlib.sha256(f"{cid}|{sym['line_start']}|{sym['line_end']}".encode("utf-8")).hexdigest()
            _insert_node_and_fts(
                db,
                {
                    "id": cid,
                    "lecture_id": "LEC_AICB_P1",
                    "node_kind": "code_symbol",
                    "type": f"Code{sym['kind'].capitalize()}",
                    "label": f"{sym['file_path']}:{sym['symbol']}()",
                    "day": 0,
                    "summary": summary,
                    "keywords": [sym["symbol"], sym["file_path"], Path(sym["file_path"]).name],
                    "provenance": {
                        "file_path": sym["file_path"],
                        "symbol": sym["symbol"],
                        "line_start": sym["line_start"],
                        "line_end": sym["line_end"],
                        "pdf_pages": [],
                        "section_ref": f"{sym['file_path']} L{sym['line_start']}-{sym['line_end']}",
                        "key_quote": summary[:160],
                    },
                    "sha256": c_sha,
                },
            )

        # 5. Cross-layer Theory <-> Checkpoint <-> Code edges from Gold Mapping Rules
        existing_nodes = {r[0] for r in db.execute("SELECT id FROM graph_nodes").fetchall()}
        for rule in GOLD_MAPPING_RULES:
            cp_id = rule["checkpoint"]
            code_ids: list[str] = []
            for target in rule["code_targets"]:
                code_id = _code_node_id(target["file_path"], target.get("symbol"))
                if code_id not in existing_nodes:
                    c_sha = hashlib.sha256(code_id.encode("utf-8")).hexdigest()
                    _insert_node_and_fts(
                        db,
                        {
                            "id": code_id,
                            "lecture_id": "LEC_AICB_P1",
                            "node_kind": "code_symbol",
                            "type": "CodeFile",
                            "label": target["file_path"],
                            "day": 0,
                            "summary": f"Repo deliverable {target['file_path']} for {rule['title']}",
                            "keywords": [target["file_path"], Path(target["file_path"]).name, cp_id],
                            "provenance": {
                                "file_path": target["file_path"],
                                "symbol": target.get("symbol"),
                                "line_start": 1,
                                "line_end": 1,
                                "pdf_pages": [],
                                "section_ref": target["file_path"],
                                "key_quote": rule["guardrail_warning"],
                            },
                            "sha256": c_sha,
                        },
                    )
                    existing_nodes.add(code_id)
                code_ids.append(code_id)
                if cp_id in existing_nodes:
                    _insert_edge(db, cp_id, code_id, "IMPLEMENTED_BY", 1.0, {"rule_id": rule["id"]})

            for concept_id in rule["concept_ids"]:
                if concept_id in existing_nodes:
                    if cp_id in existing_nodes:
                        _insert_edge(db, concept_id, cp_id, "APPLIED_IN", 1.0, {"rule_id": rule["id"]})
                    for code_id in code_ids:
                        _insert_edge(db, concept_id, code_id, "IMPLEMENTED_BY", 0.9, {"rule_id": rule["id"]})

        _rebuild_communities(db)
        stats = get_graph_stats_from_conn(db)

    export_mapping_json()
    return stats


def _row_to_graph_node(row: tuple) -> dict[str, Any]:
    nid, lec_id, nkind, ntype, label, day, summary, kw_json, prov_json, sha = row
    return {
        "id": nid,
        "lecture_id": lec_id,
        "node_kind": nkind,
        "type": ntype,
        "label": label,
        "day": day,
        "summary": summary,
        "keywords": json.loads(kw_json),
        "provenance": json.loads(prov_json),
        "sha256": sha,
    }


def get_graph_stats_from_conn(db: sqlite3.Connection) -> dict[str, Any]:
    lectures_count = db.execute("SELECT COUNT(*) FROM lectures WHERE is_current = 1").fetchone()[0]
    nodes_by_kind = dict(db.execute("SELECT node_kind, COUNT(*) FROM graph_nodes GROUP BY node_kind").fetchall())
    edges_by_rel = dict(db.execute("SELECT relation, COUNT(*) FROM graph_edges GROUP BY relation").fetchall())
    comm_count = db.execute("SELECT COUNT(*) FROM communities").fetchone()[0]
    return {
        "lectures_count": lectures_count,
        "total_nodes": sum(nodes_by_kind.values()),
        "total_edges": sum(edges_by_rel.values()),
        "communities_count": comm_count,
        "nodes_by_kind": nodes_by_kind,
        "edges_by_relation": edges_by_rel,
        "canonical_relations": sorted(CANONICAL_RELATIONS),
    }


def get_graph_stats() -> dict[str, Any]:
    ensure_graph_db_loaded()
    with closing(sqlite3.connect(GRAPH_DB_PATH)) as db:
        return get_graph_stats_from_conn(db)


def list_lectures() -> list[dict[str, Any]]:
    ensure_graph_db_loaded()
    with closing(sqlite3.connect(GRAPH_DB_PATH)) as db:
        rows = db.execute(
            "SELECT lecture_id, title, source_file, day, sha256, is_current, ingested_at FROM lectures ORDER BY day ASC, ingested_at ASC"
        ).fetchall()
    return [
        {
            "lecture_id": r[0],
            "title": r[1],
            "source_file": r[2],
            "day": r[3],
            "sha256": r[4],
            "is_current": bool(r[5]),
            "ingested_at": r[6],
        }
        for r in rows
    ]


def list_communities(limit: int = 50) -> list[dict[str, Any]]:
    ensure_graph_db_loaded()
    with closing(sqlite3.connect(GRAPH_DB_PATH)) as db:
        rows = db.execute(
            "SELECT community_id, title, summary, member_ids_json, top_keywords_json, day_span_json FROM communities LIMIT ?",
            (limit,),
        ).fetchall()
    return [
        {
            "community_id": r[0],
            "title": r[1],
            "summary": r[2],
            "member_ids": json.loads(r[3]),
            "top_keywords": json.loads(r[4]),
            "day_span": json.loads(r[5]),
        }
        for r in rows
    ]


def get_all_graph_nodes(node_kinds: list[str] | None = None, day: int | None = None) -> list[dict[str, Any]]:
    ensure_graph_db_loaded()
    clauses: list[str] = []
    params: list[Any] = []
    if node_kinds:
        placeholders = ",".join("?" for _ in node_kinds)
        clauses.append(f"node_kind IN ({placeholders})")
        params.extend(node_kinds)
    if day is not None:
        clauses.append("(day = ? OR day = 0)")
        params.append(day)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = (
        "SELECT id, lecture_id, node_kind, type, label, day, summary, keywords_json, provenance_json, sha256 "
        f"FROM graph_nodes {where_sql}"
    )
    with closing(sqlite3.connect(GRAPH_DB_PATH)) as db:
        rows = db.execute(sql, params).fetchall()
    return [_row_to_graph_node(r) for r in rows]


def load_all_concepts_by_id() -> dict[str, dict[str, Any]]:
    nodes = get_all_graph_nodes(node_kinds=["concept"])
    return {n["id"]: n for n in nodes}


def fts_search_graph_nodes(
    tokens: list[str],
    day: int | None = None,
    node_kinds: list[str] | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    ensure_graph_db_loaded()
    if not tokens:
        return []
    fts_expr = " OR ".join(f'"{t}"' for t in tokens[:10])
    clauses = ["graph_nodes_fts MATCH ?"]
    params: list[Any] = [fts_expr]
    if day is not None:
        clauses.append("(n.day = ? OR n.day = 0)")
        params.append(day)
    if node_kinds:
        placeholders = ",".join("?" for _ in node_kinds)
        clauses.append(f"n.node_kind IN ({placeholders})")
        params.extend(node_kinds)
    params.append(limit)

    sql = f"""
        SELECT n.id, n.lecture_id, n.node_kind, n.type, n.label, n.day, n.summary,
               n.keywords_json, n.provenance_json, n.sha256,
               bm25(graph_nodes_fts, 4.0, 2.0, 3.0) AS score
        FROM graph_nodes_fts f
        JOIN graph_nodes n ON n.id = f.id
        WHERE {' AND '.join(clauses)}
        ORDER BY score ASC
        LIMIT ?
    """
    with closing(sqlite3.connect(GRAPH_DB_PATH)) as db:
        rows = db.execute(sql, params).fetchall()

    results: list[dict[str, Any]] = []
    for row in rows:
        node = _row_to_graph_node(row[:10])
        node["fts_score"] = round(float(-row[10]), 4)
        results.append(node)
    return results


def traverse_subgraph(
    seed_ids: list[str],
    max_hops: int = 2,
    direction: str = "both",
) -> dict[str, Any]:
    """Multi-hop GraphRAG traversal using SQLite WITH RECURSIVE CTE."""
    ensure_graph_db_loaded()
    clean_seeds = [s for s in seed_ids if s]
    if not clean_seeds:
        return {"nodes": [], "edges": [], "paths": [], "communities": []}

    hops = max(1, min(3, int(max_hops)))
    dir_mode = direction if direction in ("both", "theory_to_practice", "practice_to_theory") else "both"

    with closing(sqlite3.connect(GRAPH_DB_PATH)) as db:
        placeholders = ",".join("?" for _ in clean_seeds)
        valid_seeds = [
            r[0]
            for r in db.execute(
                f"SELECT id FROM graph_nodes WHERE id IN ({placeholders})",
                clean_seeds,
            ).fetchall()
        ]
        if not valid_seeds:
            return {"nodes": [], "edges": [], "paths": [], "communities": []}

        seed_placeholders = ",".join("?" for _ in valid_seeds)
        if dir_mode == "theory_to_practice":
            step_sql = """
                SELECT e.target AS node_id, w.hop + 1 AS hop
                FROM walk w
                JOIN graph_edges e ON e.source = w.node_id
                WHERE w.hop < ?
            """
        elif dir_mode == "practice_to_theory":
            step_sql = """
                SELECT e.source AS node_id, w.hop + 1 AS hop
                FROM walk w
                JOIN graph_edges e ON e.target = w.node_id
                WHERE w.hop < ?
            """
        else:
            step_sql = """
                SELECT CASE WHEN e.source = w.node_id THEN e.target ELSE e.source END AS node_id, w.hop + 1 AS hop
                FROM walk w
                JOIN graph_edges e ON (e.source = w.node_id OR e.target = w.node_id)
                WHERE w.hop < ?
            """

        cte_sql = f"""
            WITH RECURSIVE walk(node_id, hop) AS (
                SELECT id, 0 FROM graph_nodes WHERE id IN ({seed_placeholders})
                UNION
                {step_sql}
            )
            SELECT node_id, MIN(hop) AS min_hop
            FROM walk
            GROUP BY node_id
            ORDER BY min_hop ASC, node_id ASC
            LIMIT 32
        """
        visited_rows = db.execute(cte_sql, [*valid_seeds, hops]).fetchall()
        hop_by_id = {r[0]: r[1] for r in visited_rows}
        visited_ids = list(hop_by_id.keys())

        v_placeholders = ",".join("?" for _ in visited_ids)
        node_rows = db.execute(
            f"""
            SELECT id, lecture_id, node_kind, type, label, day, summary, keywords_json, provenance_json, sha256
            FROM graph_nodes
            WHERE id IN ({v_placeholders})
            """,
            visited_ids,
        ).fetchall()
        nodes_map: dict[str, dict[str, Any]] = {}
        for row in node_rows:
            node = _row_to_graph_node(row)
            node["hop"] = hop_by_id.get(node["id"], 0)
            nodes_map[node["id"]] = node

        edge_rows = db.execute(
            f"""
            SELECT source, target, relation, weight, evidence_json
            FROM graph_edges
            WHERE source IN ({v_placeholders}) AND target IN ({v_placeholders})
            ORDER BY weight DESC, source ASC, target ASC
            """,
            [*visited_ids, *visited_ids],
        ).fetchall()

        edges: list[dict[str, Any]] = []
        paths: list[dict[str, Any]] = []
        for src, tgt, rel, weight, ev_json in edge_rows:
            edges.append(
                {
                    "source": src,
                    "target": tgt,
                    "relation": rel,
                    "weight": weight,
                    "evidence": json.loads(ev_json),
                }
            )
            if src in nodes_map and tgt in nodes_map:
                paths.append(
                    {
                        "from_id": src,
                        "from_label": nodes_map[src]["label"],
                        "from_kind": nodes_map[src]["node_kind"],
                        "relation": rel,
                        "to_id": tgt,
                        "to_label": nodes_map[tgt]["label"],
                        "to_kind": nodes_map[tgt]["node_kind"],
                        "hop": max(hop_by_id.get(src, 0), hop_by_id.get(tgt, 0)),
                    }
                )

        # Prioritize paths matching requested direction
        if dir_mode == "theory_to_practice":
            paths.sort(key=lambda p: (0 if p["relation"] in ("APPLIED_IN", "IMPLEMENTED_BY") else 1, p["hop"], p["from_id"]))
        elif dir_mode == "practice_to_theory":
            paths.sort(key=lambda p: (0 if p["to_kind"] == "concept" or p["relation"] in ("IMPLEMENTED_BY", "APPLIED_IN") else 1, p["hop"], p["from_id"]))
        else:
            paths.sort(key=lambda p: (p["hop"], 0 if p["relation"] in ("APPLIED_IN", "IMPLEMENTED_BY") else 1, p["from_id"]))

        # Find communities overlapping visited_ids
        visited_set = set(visited_ids)
        comm_rows = db.execute(
            "SELECT community_id, title, summary, member_ids_json, top_keywords_json, day_span_json FROM communities"
        ).fetchall()
        matched_comms: list[dict[str, Any]] = []
        for cid, title, summary, members_json, kws_json, span_json in comm_rows:
            members = json.loads(members_json)
            overlap = len(visited_set.intersection(members))
            if overlap > 0:
                matched_comms.append(
                    {
                        "community_id": cid,
                        "title": title,
                        "summary": summary,
                        "overlap_count": overlap,
                        "member_count": len(members),
                        "top_keywords": json.loads(kws_json),
                        "day_span": json.loads(span_json),
                    }
                )
        matched_comms.sort(key=lambda c: c["overlap_count"], reverse=True)

    nodes_sorted = sorted(nodes_map.values(), key=lambda n: (n["hop"], n["node_kind"], n["id"]))
    return {
        "direction": dir_mode,
        "max_hops": hops,
        "nodes": nodes_sorted[:24],
        "edges": edges[:40],
        "paths": paths[:20],
        "communities": matched_comms[:4],
    }


def export_mapping_json(output_path: Path | None = None) -> dict[str, Any]:
    """Export the 7-relation Knowledge Graph + Lecture-to-Lab mapping to mapping.json."""
    target = output_path or MAPPING_EXPORT_PATH
    with closing(sqlite3.connect(GRAPH_DB_PATH)) as db:
        lectures = [
            {
                "lecture_id": r[0],
                "title": r[1],
                "source_file": r[2],
                "day": r[3],
                "sha256": r[4],
                "is_current": bool(r[5]),
            }
            for r in db.execute("SELECT lecture_id, title, source_file, day, sha256, is_current FROM lectures").fetchall()
        ]
        nodes = [
            _row_to_graph_node(r)
            for r in db.execute(
                "SELECT id, lecture_id, node_kind, type, label, day, summary, keywords_json, provenance_json, sha256 FROM graph_nodes"
            ).fetchall()
        ]
        edges = [
            {
                "source": r[0],
                "target": r[1],
                "relation": r[2],
                "weight": r[3],
                "evidence": json.loads(r[4]),
            }
            for r in db.execute("SELECT source, target, relation, weight, evidence_json FROM graph_edges").fetchall()
        ]
        communities = [
            {
                "community_id": r[0],
                "title": r[1],
                "summary": r[2],
                "member_ids": json.loads(r[3]),
                "top_keywords": json.loads(r[4]),
                "day_span": json.loads(r[5]),
            }
            for r in db.execute(
                "SELECT community_id, title, summary, member_ids_json, top_keywords_json, day_span_json FROM communities"
            ).fetchall()
        ]

    payload = {
        "schema_version": "3.0-graphrag",
        "canonical_relations": sorted(CANONICAL_RELATIONS),
        "lectures": lectures,
        "nodes": nodes,
        "edges": edges,
        "communities": communities,
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def upsert_lecture_nodes(
    lecture: dict[str, Any],
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> dict[str, Any]:
    """Atomically ingest a new lecture, its extracted concepts, and cross-lecture edges."""
    ensure_graph_db_loaded()
    now_iso = datetime.now(timezone.utc).isoformat()
    with closing(sqlite3.connect(GRAPH_DB_PATH)) as db, db:
        _init_schema(db)
        db.execute(
            """
            INSERT OR REPLACE INTO lectures (lecture_id, title, source_file, day, sha256, is_current, ingested_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
            (
                lecture["lecture_id"],
                nfc(lecture["title"]),
                nfc(lecture["source_file"]),
                int(lecture["day"]),
                lecture["sha256"],
                now_iso,
            ),
        )
        for node in nodes:
            _insert_node_and_fts(db, node)
        for edge in edges:
            _insert_edge(
                db,
                edge["source"],
                edge["target"],
                edge["relation"],
                edge.get("weight", 1.0),
                edge.get("evidence"),
            )
        communities = _rebuild_communities(db)
        stats = get_graph_stats_from_conn(db)

    export_mapping_json()
    return {
        "lecture_id": lecture["lecture_id"],
        "nodes_added": len(nodes),
        "edges_added": len(edges),
        "communities_count": len(communities),
        "stats": stats,
    }


def delete_lecture(lecture_id: str) -> bool:
    """Remove an ingested non-base lecture and rebuild communities (used for cleanup/management)."""
    if lecture_id == "LEC_AICB_P1":
        return False
    ensure_graph_db_loaded()
    with closing(sqlite3.connect(GRAPH_DB_PATH)) as db, db:
        node_ids = [r[0] for r in db.execute("SELECT id FROM graph_nodes WHERE lecture_id = ?", (lecture_id,)).fetchall()]
        if not node_ids:
            db.execute("DELETE FROM lectures WHERE lecture_id = ?", (lecture_id,))
            return False
        placeholders = ",".join("?" for _ in node_ids)
        db.execute(f"DELETE FROM graph_edges WHERE source IN ({placeholders}) OR target IN ({placeholders})", [*node_ids, *node_ids])
        db.execute(f"DELETE FROM graph_nodes_fts WHERE id IN ({placeholders})", node_ids)
        db.execute("DELETE FROM graph_nodes WHERE lecture_id = ?", (lecture_id,))
        db.execute("DELETE FROM lectures WHERE lecture_id = ?", (lecture_id,))
        _rebuild_communities(db)
    export_mapping_json()
    return True
