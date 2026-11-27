"""Deterministic Repo Parser for starter-repo & learning-app.

Extracts Python AST symbols (functions, classes, line ranges, docstrings)
and Hackathon Checkpoints / Spec sections without calling an LLM.
"""
from __future__ import annotations

import ast
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = Path(__file__).parent / "kg_data" / "repo_index.json"

TARGET_PYTHON_FILES = [
    "starter-repo/run.py",
    "starter-repo/codebase/agent.py",
    "starter-repo/codebase/tools.py",
    "starter-repo/codebase/ai.py",
    "starter-repo/codebase/tracing.py",
    "starter-repo/eval/run_eval.py",
    "starter-repo/cost/simulate.py",
    "learning-app/backend/main.py",
    "learning-app/backend/kg_builder.py",
    "learning-app/backend/kg_store.py",
    "learning-app/backend/repo_parser.py",
    "learning-app/backend/guardrails.py",
    "learning-app/backend/mapper.py",
]


def _nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text).strip()


def _parse_python_file(rel_path: str, root: Path) -> list[dict[str, Any]]:
    full_path = root / rel_path
    if not full_path.exists():
        return []
    source = full_path.read_text(encoding="utf-8", errors="replace")
    tree = ast.parse(source, filename=rel_path)
    symbols: list[dict[str, Any]] = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            kind = "class" if isinstance(node, ast.ClassDef) else "function"
            doc = ast.get_docstring(node) or ""
            symbols.append(
                {
                    "file_path": rel_path,
                    "symbol": node.name,
                    "kind": kind,
                    "line_start": int(node.lineno),
                    "line_end": int(getattr(node, "end_lineno", node.lineno)),
                    "docstring": _nfc(doc[:300]),
                }
            )
    symbols.sort(key=lambda s: s["line_start"])
    return symbols


def _parse_checkpoints(root: Path) -> list[dict[str, Any]]:
    checkpoints = [
        {
            "id": "CP1",
            "title": "CP1: Khám phá Pain & Impact",
            "source_file": "01-challenge-brief.md",
            "deliverables": [
                "starter-repo/evidence/hypothesis.md",
                "starter-repo/evidence/data-mining.md",
                "starter-repo/spec.md",
                "starter-repo/canvas.md",
            ],
            "summary": "Chứng minh pain có bằng chứng (đào data x/N %, phỏng vấn >=3 hoặc khảo sát >=20) và bảng Impact có số.",
        },
        {
            "id": "CP2",
            "title": "CP2: Thiết kế Kiến trúc & Chốt Metric Spec",
            "source_file": "starter-repo/spec.md",
            "deliverables": [
                "starter-repo/spec.md",
                "starter-repo/data/DATA_CARD.md",
                "starter-repo/eval/metric_spec.yaml",
                "starter-repo/eval/benchmark.csv",
            ],
            "summary": "Chốt lát cắt 1 câu, chọn Workflow vs Agent, thiết kế tool, 4 lớp chỗ khó và chốt chuẩn 'đạt' trước giờ G.",
        },
        {
            "id": "CP3",
            "title": "CP3: Build Bản chạy thử & Chạy Eval Lượt 1",
            "source_file": "starter-repo/codebase/agent.py",
            "deliverables": [
                "starter-repo/codebase/agent.py",
                "starter-repo/codebase/tools.py",
                "starter-repo/codebase/ai.py",
                "starter-repo/eval/run-1.csv",
            ],
            "summary": "Gọi AI thật qua answer(text), quyết định dựa trên dữ liệu/tool của bài toán, chặn rủi ro và chạy 20–30 câu thử.",
        },
        {
            "id": "CP4",
            "title": "CP4: Đánh giá Lượt 2, Mô phỏng Cost-of-Pass & Slide Go/Iterate/Stop",
            "source_file": "starter-repo/cost/simulate.py",
            "deliverables": [
                "starter-repo/eval/report.md",
                "starter-repo/cost/personas.yaml",
                "starter-repo/cost/cost-estimate.md",
                "starter-repo/slides/outline.md",
            ],
            "summary": "Cải tiến từ lượt 1 -> lượt 2, chạy >=50 phiên giả lập tính chi phí/task thành công và kết luận Go/Iterate/Stop.",
        },
    ]

    # Enrich with actual spec section headers if spec.md exists
    spec_path = root / "starter-repo" / "spec.md"
    spec_sections: list[dict[str, Any]] = []
    if spec_path.exists():
        lines = spec_path.read_text(encoding="utf-8", errors="replace").splitlines()
        for idx, line in enumerate(lines, start=1):
            m = re.match(r"^##\s+(§\d+\.\s+.+?)(?:\s+\*\(.*\)\*)?$", line.strip())
            if m:
                spec_sections.append(
                    {
                        "file_path": "starter-repo/spec.md",
                        "section": _nfc(m.group(1)),
                        "line_start": idx,
                    }
                )
    return checkpoints, spec_sections


def parse_workspace_repo(workspace_root: Path | None = None) -> dict[str, Any]:
    """Parse Python AST symbols and Lab/Hackathon checkpoints in the workspace."""
    root = workspace_root or WORKSPACE_ROOT
    symbols: list[dict[str, Any]] = []
    files_indexed: list[str] = []

    for rel_path in TARGET_PYTHON_FILES:
        file_syms = _parse_python_file(rel_path, root)
        if file_syms or (root / rel_path).exists():
            files_indexed.append(rel_path)
        symbols.extend(file_syms)

    checkpoints, spec_sections = _parse_checkpoints(root)

    return {
        "workspace_root": str(root),
        "files_indexed": files_indexed,
        "symbols": symbols,
        "checkpoints": checkpoints,
        "spec_sections": spec_sections,
    }


def save_repo_index(workspace_root: Path | None = None, output_path: Path | None = None) -> dict[str, Any]:
    index = parse_workspace_repo(workspace_root)
    target = output_path or OUTPUT_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    return index


if __name__ == "__main__":
    idx = save_repo_index()
    print(f"Indexed {len(idx['files_indexed'])} files, {len(idx['symbols'])} AST symbols, {len(idx['checkpoints'])} checkpoints -> {OUTPUT_PATH}")
