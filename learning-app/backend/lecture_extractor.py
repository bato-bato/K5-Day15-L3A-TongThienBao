"""Multi-Lecture Knowledge Extraction & Cross-Lecture Graph Linking (Level 3 GraphRAG).

Supports ingesting additional Markdown/Text lectures into graphrag.sqlite3,
extracting structured Concept nodes with NFC + SHA-256 provenance, and
discovering semantic cross-links to existing AICB-P1 concepts & checkpoints.
"""
from __future__ import annotations

import hashlib
import re
from typing import Any

from graph_db import get_all_graph_nodes, upsert_lecture_nodes
from kg_builder import nfc
from semantic_engine import hybrid_search, invalidate_semantic_cache, tokenize_text


def _split_sections(title: str, content: str) -> list[dict[str, str]]:
    lines = nfc(content).splitlines()
    sections: list[dict[str, str]] = []
    cur_heading = title
    cur_buf: list[str] = []

    for line in lines:
        m = re.match(r"^#{1,4}\s+(.+)$", line.strip())
        if m:
            body = "\n".join(cur_buf).strip()
            if body:
                sections.append({"heading": nfc(cur_heading), "body": body})
            cur_heading = m.group(1).strip()
            cur_buf = []
        else:
            cur_buf.append(line)

    tail = "\n".join(cur_buf).strip()
    if tail:
        sections.append({"heading": nfc(cur_heading), "body": tail})

    # Fallback: split by double newline if no headings produced multiple chunks
    if len(sections) <= 1 and len(content) > 500:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", nfc(content)) if p.strip()]
        if len(paragraphs) > 1:
            sections = [
                {"heading": f"{title} · Phần {idx}", "body": para}
                for idx, para in enumerate(paragraphs[:12], start=1)
            ]

    if not sections:
        sections = [{"heading": title, "body": nfc(content)}]
    return sections[:12]


def _extract_keywords(heading: str, body: str) -> list[str]:
    tokens = tokenize_text(f"{heading} {body}")
    seen: list[str] = []
    for t in tokens:
        if len(t) >= 3 and t not in seen:
            seen.append(t)
        if len(seen) >= 8:
            break
    return seen


def extract_lecture_knowledge(
    title: str,
    content: str,
    day: int = 14,
    source_file: str = "uploaded_lecture.md",
) -> dict[str, Any]:
    """Extract structured KG nodes from a lecture document and link into GraphRAG DB."""
    clean_title = nfc(title)
    clean_content = nfc(content)
    clean_source = nfc(source_file) or "uploaded_lecture.md"

    content_hash = hashlib.sha256(f"{clean_title}|{day}|{clean_content}".encode("utf-8")).hexdigest()
    short_hash = content_hash[:8].upper()
    lecture_id = f"LEC_{short_hash}"
    root_id = f"LEC_ROOT_{short_hash}"

    sections = _split_sections(clean_title, clean_content)
    root_keywords = _extract_keywords(clean_title, clean_content[:600])

    nodes: list[dict[str, Any]] = [
        {
            "id": root_id,
            "lecture_id": lecture_id,
            "node_kind": "concept",
            "type": "DayModule",
            "label": clean_title,
            "day": int(day),
            "summary": clean_content[:260] + ("…" if len(clean_content) > 260 else ""),
            "keywords": root_keywords,
            "provenance": {
                "lecture_title": clean_title,
                "source_file": clean_source,
                "pdf_pages": [1],
                "section_ref": f"{clean_title} ({clean_source})",
                "key_quote": clean_content.splitlines()[0][:180] if clean_content else clean_title,
            },
            "sha256": content_hash,
        }
    ]
    edges: list[dict[str, Any]] = []
    cross_links_created = 0

    existing_ids = {n["id"] for n in get_all_graph_nodes()}

    for idx, sec in enumerate(sections, start=1):
        heading = sec["heading"]
        body = sec["body"]
        node_id = f"CON_{short_hash}_{idx:02d}"
        kws = _extract_keywords(heading, body)
        summary = body[:360] + ("…" if len(body) > 360 else "")
        first_sentence = re.split(r"(?<=[.!?])\s+", body)[0][:180]
        node_sha = hashlib.sha256(f"{node_id}|{heading}|{body}".encode("utf-8")).hexdigest()

        nodes.append(
            {
                "id": node_id,
                "lecture_id": lecture_id,
                "node_kind": "concept",
                "type": "CoreConcept",
                "label": heading,
                "day": int(day),
                "summary": summary,
                "keywords": kws,
                "provenance": {
                    "lecture_title": clean_title,
                    "source_file": clean_source,
                    "pdf_pages": [idx],
                    "section_ref": f"{clean_title} · {heading}",
                    "key_quote": first_sentence,
                },
                "sha256": node_sha,
            }
        )
        edges.append(
            {
                "source": node_id,
                "target": root_id,
                "relation": "IS_PART_OF",
                "weight": 1.0,
                "evidence": {"source_file": clean_source, "section": heading},
            }
        )

        # Discover cross-lecture links against existing graph nodes (concepts + checkpoints)
        hits = hybrid_search(f"{heading} {' '.join(kws)}", top_k=4)
        for hit in hits:
            if hit["id"] == node_id or hit["id"] not in existing_ids:
                continue
            cos = hit.get("cosine_score", 0.0)
            if hit["node_kind"] == "checkpoint" and cos >= 0.14:
                edges.append(
                    {
                        "source": node_id,
                        "target": hit["id"],
                        "relation": "APPLIED_IN",
                        "weight": round(max(0.5, cos), 3),
                        "evidence": {"cross_link": "semantic_hybrid", "cosine": cos},
                    }
                )
                cross_links_created += 1
            elif hit["node_kind"] == "concept" and cos >= 0.22:
                edges.append(
                    {
                        "source": node_id,
                        "target": hit["id"],
                        "relation": "EXTENDS" if day > hit["day"] else "RELATED_TO",
                        "weight": round(max(0.5, cos), 3),
                        "evidence": {"cross_link": "semantic_hybrid", "cosine": cos},
                    }
                )
                cross_links_created += 1

    res = upsert_lecture_nodes(
        lecture={
            "lecture_id": lecture_id,
            "title": clean_title,
            "source_file": clean_source,
            "day": int(day),
            "sha256": content_hash,
        },
        nodes=nodes,
        edges=edges,
    )
    invalidate_semantic_cache()

    return {
        "lecture_id": lecture_id,
        "title": clean_title,
        "day": int(day),
        "source_file": clean_source,
        "nodes_added": res["nodes_added"],
        "edges_added": res["edges_added"],
        "cross_links_created": cross_links_created,
        "communities_count": res["communities_count"],
        "extracted_concept_ids": [n["id"] for n in nodes],
    }
