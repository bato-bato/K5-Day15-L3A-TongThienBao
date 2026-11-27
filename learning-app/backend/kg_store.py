"""SQLite + FTS5 Knowledge Graph Store & Mindmap Seed Generator.

Implements Day 6 rules:
- Unicode NFC normalization before indexing and querying
- FTS5 with tokenize='unicode61 remove_diacritics 0' to preserve Vietnamese tone marks
- Deterministic tree layout for Mindmap seeding (0 <= x,y <= 4096, DAG without cycles)
"""
from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
from contextlib import closing
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from kg_builder import main as build_kg_file, nfc

KG_DATA_DIR = Path(__file__).parent / "kg_data"
KG_JSON_PATH = KG_DATA_DIR / "kg_aicb_p1.json"
KG_DB_PATH = KG_DATA_DIR / "kg_index.sqlite3"


def ensure_kg_loaded() -> dict[str, Any]:
    """Ensure kg_aicb_p1.json and kg_index.sqlite3 exist and are synchronized."""
    if not KG_JSON_PATH.exists():
        build_kg_file()
    kg = json.loads(KG_JSON_PATH.read_text(encoding="utf-8"))
    _sync_sqlite_fts(kg)
    return kg


def _sync_sqlite_fts(kg: dict[str, Any]) -> None:
    KG_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(KG_DB_PATH)) as db, db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("""
            CREATE TABLE IF NOT EXISTS kg_nodes (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                label TEXT NOT NULL,
                day INTEGER NOT NULL,
                tier INTEGER NOT NULL,
                summary TEXT NOT NULL,
                keywords_json TEXT NOT NULL,
                provenance_json TEXT NOT NULL,
                sha256 TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS kg_edges (
                source TEXT NOT NULL,
                target TEXT NOT NULL,
                relation TEXT NOT NULL,
                weight REAL NOT NULL,
                PRIMARY KEY (source, target, relation)
            )
        """)
        db.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS kg_nodes_fts USING fts5(
                id UNINDEXED,
                label,
                summary,
                keywords,
                section_ref,
                tokenize='unicode61 remove_diacritics 0'
            )
        """)

        existing_count = db.execute("SELECT COUNT(*) FROM kg_nodes").fetchone()[0]
        if existing_count == len(kg["nodes"]):
            # Verify sha256 match on first node to skip unnecessary rebuild
            first = kg["nodes"][0]
            row = db.execute("SELECT sha256 FROM kg_nodes WHERE id = ?", (first["id"],)).fetchone()
            if row and row[0] == first["sha256"]:
                return

        db.execute("DELETE FROM kg_edges")
        db.execute("DELETE FROM kg_nodes")
        db.execute("DELETE FROM kg_nodes_fts")

        for node in kg["nodes"]:
            db.execute(
                """
                INSERT INTO kg_nodes (id, type, label, day, tier, summary, keywords_json, provenance_json, sha256)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    node["id"],
                    node["type"],
                    nfc(node["label"]),
                    node["day"],
                    node["tier"],
                    nfc(node["summary"]),
                    json.dumps(node.get("keywords", []), ensure_ascii=False),
                    json.dumps(node["provenance"], ensure_ascii=False),
                    node["sha256"],
                ),
            )
            db.execute(
                """
                INSERT INTO kg_nodes_fts (id, label, summary, keywords, section_ref)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    node["id"],
                    nfc(node["label"]),
                    nfc(node["summary"]),
                    nfc(" ".join(node.get("keywords", []))),
                    nfc(node["provenance"]["section_ref"]),
                ),
            )

        for edge in kg["edges"]:
            db.execute(
                """
                INSERT OR REPLACE INTO kg_edges (source, target, relation, weight)
                VALUES (?, ?, ?, ?)
                """,
                (edge["source"], edge["target"], edge["relation"], edge["weight"]),
            )


def load_nodes_by_id() -> dict[str, dict[str, Any]]:
    kg = ensure_kg_loaded()
    return {node["id"]: node for node in kg["nodes"]}


def _row_to_node(row: tuple) -> dict[str, Any]:
    nid, ntype, label, day, tier, summary, kw_json, prov_json, sha = row
    return {
        "id": nid,
        "type": ntype,
        "label": label,
        "day": day,
        "tier": tier,
        "summary": summary,
        "keywords": json.loads(kw_json),
        "provenance": json.loads(prov_json),
        "sha256": sha,
    }


def _extract_tokens(query: str) -> list[str]:
    normalized = unicodedata.normalize("NFC", query).lower()
    # Keep Vietnamese letters, digits, underscore
    tokens = re.findall(r"[0-9a-zA-ZÀ-ỹ_]+", normalized)
    stop = {
        "là", "gì", "của", "và", "cho", "trong", "khi", "nào", "thế", "như", "có", "không",
        "để", "với", "hướng", "dẫn", "cách", "làm", "sao", "những", "các", "này", "đó",
        "được", "bị", "về", "từ", "tới", "đến", "nên", "cần", "phải", "theo", "trên", "dưới",
        "the", "and", "for", "how", "what", "why", "with",
    }
    filtered = [t for t in tokens if len(t) >= 2 and t not in stop]
    return filtered or tokens


def _count_token_hits(node: dict[str, Any], tokens: list[str]) -> int:
    haystack = f"{node['id']} {node['label']} {node['summary']} {' '.join(node.get('keywords', []))} {node['provenance']['section_ref']}".lower()
    haystack_words = set(re.findall(r"[0-9a-zA-ZÀ-ỹ_]+", haystack))
    return sum(1 for tok in tokens if tok in haystack_words or (len(tok) >= 4 and tok in haystack))


def search_kg(query: str, day: int | None = None, top_k: int = 8) -> list[dict[str, Any]]:
    """Search Knowledge Graph nodes using SQLite FTS5 (preserving Vietnamese diacritics) + relevance threshold."""
    ensure_kg_loaded()
    clean_q = nfc(query)
    if not clean_q:
        return []

    tokens = _extract_tokens(clean_q)
    if not tokens:
        return []

    min_hits = 2 if len(tokens) >= 4 else 1
    fts_expr = " OR ".join(f'"{tok}"' for tok in tokens[:10])
    results: list[dict[str, Any]] = []

    with closing(sqlite3.connect(KG_DB_PATH)) as db:
        if day is not None:
            rows = db.execute(
                """
                SELECT n.id, n.type, n.label, n.day, n.tier, n.summary, n.keywords_json, n.provenance_json, n.sha256,
                       bm25(kg_nodes_fts, 4.0, 2.0, 3.0, 1.0) AS score
                FROM kg_nodes_fts f
                JOIN kg_nodes n ON n.id = f.id
                WHERE kg_nodes_fts MATCH ? AND n.day = ?
                ORDER BY score ASC
                LIMIT ?
                """,
                (fts_expr, day, top_k * 2),
            ).fetchall()
        else:
            rows = db.execute(
                """
                SELECT n.id, n.type, n.label, n.day, n.tier, n.summary, n.keywords_json, n.provenance_json, n.sha256,
                       bm25(kg_nodes_fts, 4.0, 2.0, 3.0, 1.0) AS score
                FROM kg_nodes_fts f
                JOIN kg_nodes n ON n.id = f.id
                WHERE kg_nodes_fts MATCH ?
                ORDER BY score ASC
                LIMIT ?
                """,
                (fts_expr, top_k * 2),
            ).fetchall()

        for row in rows:
            node = _row_to_node(row[:9])
            if _count_token_hits(node, tokens) >= min_hits:
                node["score"] = round(float(-row[9]), 4)
                results.append(node)
                if len(results) >= top_k:
                    break

        # Fallback exact substring match preserving diacritics when FTS returns empty
        if not results:
            all_rows = db.execute(
                "SELECT id, type, label, day, tier, summary, keywords_json, provenance_json, sha256 FROM kg_nodes"
            ).fetchall()
            scored: list[tuple[int, dict[str, Any]]] = []
            for r in all_rows:
                node = _row_to_node(r)
                if day is not None and node["day"] != day:
                    continue
                hits = _count_token_hits(node, tokens)
                if hits >= min_hits:
                    node["score"] = float(hits)
                    scored.append((hits, node))
            scored.sort(key=lambda item: item[0], reverse=True)
            results = [item[1] for item in scored[:top_k]]

    return results


def get_kg_summary() -> dict[str, Any]:
    kg = ensure_kg_loaded()
    by_day: dict[int, int] = {}
    by_type: dict[str, int] = {}
    for node in kg["nodes"]:
        by_day[node["day"]] = by_day.get(node["day"], 0) + 1
        by_type[node["type"]] = by_type.get(node["type"], 0) + 1
    return {
        "version": kg["version"],
        "total_nodes": len(kg["nodes"]),
        "total_edges": len(kg["edges"]),
        "nodes_by_day": by_day,
        "nodes_by_type": by_type,
    }


def _map_kg_type_to_ui(kg_type: str) -> str:
    mapping = {
        "DayModule": "day_root",
        "CoreConcept": "concept",
        "ArchitecturePattern": "pattern",
        "MetricOrFormula": "metric",
        "FailureOrTrap": "trap",
        "CaseStudy": "case_study",
        "LabDeliverable": "checkpoint",
    }
    return mapping.get(kg_type, "concept")


def get_day_mindmap_seed(day: int) -> list[dict[str, Any]]:
    """Build a valid DAG Mindmap seed for a specific Day (1..13) within [0..4096] bounds."""
    if not (1 <= day <= 13):
        return []
    kg = ensure_kg_loaded()
    day_nodes = [n for n in kg["nodes"] if n["day"] == day]
    if not day_nodes:
        return []

    root = next((n for n in day_nodes if n["type"] == "DayModule"), day_nodes[0])
    children = [n for n in day_nodes if n["id"] != root["id"]]

    center_x = 920
    center_y = 460
    root_uuid = str(uuid5(NAMESPACE_URL, f"aicb-kg:{root['id']}"))
    mindmap_nodes: list[dict[str, Any]] = [
        {
            "id": root_uuid,
            "text": f"{root['label']}\n—\n{root['summary']}",
            "x": center_x,
            "y": center_y,
            "parent_id": None,
            "node_type": "day_root",
            "source_ref": {
                "concept_id": root["id"],
                "day": root["day"],
                "pdf_pages": root["provenance"]["pdf_pages"],
                "section_ref": root["provenance"]["section_ref"],
                "key_quote": root["provenance"]["key_quote"],
            },
            "code_link": None,
            "verification_status": "verified",
        }
    ]

    # Radial layout: split children evenly to left and right of central hub
    half = (len(children) + 1) // 2
    left_children = children[:half]
    right_children = children[half:]

    def _append_branch(branch_nodes: list[dict[str, Any]], x_pos: int) -> None:
        count = len(branch_nodes)
        for idx, child in enumerate(branch_nodes):
            y_pos = round(center_y + (idx - (count - 1) / 2.0) * 130)
            child_uuid = str(uuid5(NAMESPACE_URL, f"aicb-kg:{child['id']}"))
            mindmap_nodes.append(
                {
                    "id": child_uuid,
                    "text": f"[{child['type']}] {child['label']}\n{child['summary']}",
                    "x": min(3900, max(40, x_pos)),
                    "y": min(3900, max(40, y_pos)),
                    "parent_id": root_uuid,
                    "node_type": _map_kg_type_to_ui(child["type"]),
                    "source_ref": {
                        "concept_id": child["id"],
                        "day": child["day"],
                        "pdf_pages": child["provenance"]["pdf_pages"],
                        "section_ref": child["provenance"]["section_ref"],
                        "key_quote": child["provenance"]["key_quote"],
                    },
                    "code_link": None,
                    "verification_status": "verified",
                }
            )

    _append_branch(left_children, 500)
    _append_branch(right_children, 1280)

    return mindmap_nodes
