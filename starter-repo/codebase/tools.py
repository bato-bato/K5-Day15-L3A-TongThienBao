"""Read-only tools for the checkpoint coaching workflow."""
from functools import lru_cache
import json
from pathlib import Path

from tracing import tool


DATA = Path(__file__).resolve().parents[2] / "data" / "lab-mapping" / "knowledge-graph.json"


@lru_cache(maxsize=1)
def load_knowledge():
    return json.loads(DATA.read_text(encoding="utf-8"))


@tool
def find_checkpoint(checkpoint_id: str) -> dict:
    """Read a checkpoint ID; return its guide and candidate concepts. Read-only local data."""
    data = load_knowledge()
    view = data["checkpoint_views"].get(checkpoint_id)
    if view is None:
        return {}

    seed_ids = set(view["concept_ids"])
    neighbors = []
    for edge in data["graph"]["edges"]:
        left, right = edge["source"], edge["target"]
        if (left in seed_ids) != (right in seed_ids):
            neighbors.append(right if left in seed_ids else left)
    related_ids = list(dict.fromkeys(neighbors))[:4]
    nodes = {node["id"]: node for node in data["graph"]["nodes"]}
    concepts = [
        {
            "id": nodes[node_id]["id"],
            "label": nodes[node_id]["label"],
            "definition": nodes[node_id]["definition"],
            "direct": node_id in seed_ids,
        }
        for node_id in view["concept_ids"] + related_ids
    ]
    return {"view": view, "concepts": concepts}
