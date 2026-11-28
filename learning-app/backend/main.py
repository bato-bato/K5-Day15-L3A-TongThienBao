import os
import sqlite3
from contextlib import asynccontextmanager, closing
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4, uuid5

from fastapi import Cookie, Depends, FastAPI, HTTPException, Path as ApiPath, Query, Request, Response
from pydantic import BaseModel, Field, model_validator

from graph_db import (
    ensure_graph_db_loaded,
    export_mapping_json,
    get_graph_stats,
    list_communities,
    list_lectures,
    traverse_subgraph,
)
from chat_engine import async_chat_turn, close_async_clients
from guardrails import chat_rate_limiter, check_input_guard
from kg_store import ensure_kg_loaded, get_day_mindmap_seed, get_kg_summary, search_kg
from lecture_extractor import extract_lecture_knowledge
from mapper import ensure_repo_index, get_day_lab_seed, map_lecture_to_lab

DB_PATH = Path(os.environ.get("LEARNING_DB_PATH", Path(__file__).with_name("learning.sqlite3")))
COOKIE_NAME = "learning_workspace"
Day = Annotated[int, ApiPath(ge=1, le=14)]
ResetKind = Annotated[str, ApiPath(pattern="^(mindmaps|lab)$")]


class Node(BaseModel):
    id: UUID
    text: str = Field(max_length=20000)
    x: int = Field(ge=0, le=4096)
    y: int = Field(ge=0, le=4096)
    parent_id: UUID | None = None
    node_type: str = Field(default="note", max_length=32)
    source_ref: dict[str, Any] | None = None
    code_link: dict[str, Any] | None = None
    verification_status: str = Field(default="user_note", max_length=32)


class Mindmap(BaseModel):
    nodes: list[Node] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def check_links(self):
        parents = {node.id: node.parent_id for node in self.nodes}
        if len(parents) != len(self.nodes):
            raise ValueError("Mỗi nút cần một mã riêng")
        for node_id in parents:
            seen = set()
            current = node_id
            while current is not None:
                if current not in parents or current in seen:
                    raise ValueError("Liên kết phải trỏ đến nút hợp lệ và không tạo vòng")
                seen.add(current)
                current = parents[current]
        return self


class Preclass(BaseModel):
    content: str = Field(default="", max_length=20000)


class Workspace(BaseModel):
    mindmaps: dict[int, Mindmap] = Field(default_factory=dict)
    lab: dict[int, Mindmap] = Field(default_factory=dict)
    preclass: dict[int, Preclass] = Field(default_factory=dict)


class MapRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    day: int | None = Field(default=None, ge=1, le=14)
    mode: Literal["level1", "level2", "level3", "graphrag"] = "graphrag"
    direction: Literal["both", "theory_to_practice", "practice_to_theory"] = "both"


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    level: Literal["eli5", "standard", "deep"] = "standard"
    day: int | None = Field(default=None, ge=1, le=14)
    lab_id: str | None = Field(default=None, max_length=64)
    focus_id: str | None = Field(default=None, max_length=200)
    prev_citation_ids: list[str] = Field(default_factory=list, max_length=8)


class LectureIngestRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    content: str = Field(min_length=20, max_length=50000)
    day: int = Field(default=14, ge=1, le=14)
    source_file: str = Field(default="uploaded_lecture.md", max_length=200)


@asynccontextmanager
async def lifespan(app: FastAPI):
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(DB_PATH)) as db, db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("BEGIN IMMEDIATE")
        migrate = db.execute("PRAGMA user_version").fetchone()[0] == 0
        has_drafts = db.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'drafts'"
        ).fetchone()
        if migrate and has_drafts:
            db.execute("ALTER TABLE drafts RENAME TO legacy_drafts")
        db.execute("""
            CREATE TABLE IF NOT EXISTS drafts (
                workspace_id TEXT NOT NULL,
                day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 14),
                kind TEXT NOT NULL CHECK (kind IN ('mindmaps', 'preclass', 'lab')),
                payload TEXT NOT NULL,
                PRIMARY KEY (workspace_id, day, kind)
            )
        """)
        if migrate and has_drafts:
            db.execute("""
                INSERT INTO drafts (workspace_id, day, kind, payload)
                SELECT workspace_id, day, kind, payload FROM legacy_drafts
            """)
            db.execute("DROP TABLE legacy_drafts")
        if migrate:
            db.execute("PRAGMA user_version = 1")

    ensure_kg_loaded()
    ensure_repo_index()
    ensure_graph_db_loaded()
    try:
        yield
    finally:
        await close_async_clients()


app = FastAPI(title="AI in Action · Knowledge Graph & Mapper", lifespan=lifespan)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    return response


def get_workspace_id(
    request: Request,
    response: Response,
    learning_workspace: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
) -> str:
    response.headers["Cache-Control"] = "no-store"
    if learning_workspace:
        try:
            workspace_id = UUID(learning_workspace)
            if workspace_id.version == 4:
                return str(workspace_id)
        except ValueError:
            pass

    workspace_id = str(uuid4())
    response.set_cookie(
        COOKIE_NAME, workspace_id, max_age=365 * 24 * 60 * 60,
        httponly=True, samesite="strict", secure=request.url.scheme == "https",
        path="/api",
    )
    return workspace_id


WorkspaceID = Annotated[str, Depends(get_workspace_id)]


def _seeded_mindmap(day: int, kind: str) -> Mindmap:
    if day > 13:
        return Mindmap(nodes=[])
    raw_nodes = get_day_mindmap_seed(day) if kind == "mindmaps" else get_day_lab_seed(day)
    return Mindmap.model_validate({"nodes": raw_nodes})


@app.get("/api/workspace")
def get_workspace(workspace_id: WorkspaceID) -> Workspace:
    workspace = Workspace()
    with closing(sqlite3.connect(DB_PATH)) as db:
        rows = db.execute(
            "SELECT day, kind, payload FROM drafts WHERE workspace_id = ?",
            (workspace_id,),
        )
        for day, kind, payload in rows:
            if kind == "mindmaps":
                workspace.mindmaps[day] = Mindmap.model_validate_json(payload)
            elif kind == "lab":
                workspace.lab[day] = Mindmap.model_validate_json(payload)
            else:
                workspace.preclass[day] = Preclass.model_validate_json(payload)

    # Pre-seed Knowledge Graph (Mindmap) and Lecture-to-Lab Mapping (Lab) for Days 1-13
    for day in range(1, 14):
        if day not in workspace.mindmaps:
            workspace.mindmaps[day] = _seeded_mindmap(day, "mindmaps")
        if day not in workspace.lab:
            workspace.lab[day] = _seeded_mindmap(day, "lab")

    for day, note in workspace.preclass.items():
        if note.content:
            pre_id = uuid5(UUID(workspace_id), f"preclass:{day}")
            existing = workspace.lab.get(day, Mindmap(nodes=[]))
            if not any(n.id == pre_id for n in existing.nodes):
                node = Node(
                    id=pre_id,
                    text=note.content,
                    x=24,
                    y=24,
                    node_type="note",
                    verification_status="user_note",
                )
                workspace.lab[day] = Mindmap(nodes=[node, *existing.nodes][:100])
    return workspace


def save_draft(workspace_id: str, day: int, kind: str, draft: Mindmap | Preclass):
    with closing(sqlite3.connect(DB_PATH)) as db, db:
        db.execute("""
            INSERT INTO drafts (workspace_id, day, kind, payload)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (workspace_id, day, kind)
            DO UPDATE SET payload = excluded.payload
        """, (workspace_id, day, kind, draft.model_dump_json()))


@app.put("/api/mindmaps/{day}")
def save_mindmap(day: Day, draft: Mindmap, workspace_id: WorkspaceID) -> Mindmap:
    save_draft(workspace_id, day, "mindmaps", draft)
    return draft


@app.put("/api/preclass/{day}")
def save_preclass(day: Day, draft: Preclass, workspace_id: WorkspaceID) -> Preclass:
    save_draft(workspace_id, day, "preclass", draft)
    return draft


@app.put("/api/lab/{day}")
def save_lab(day: Day, draft: Mindmap, workspace_id: WorkspaceID) -> Mindmap:
    save_draft(workspace_id, day, "lab", draft)
    return draft


@app.post("/api/reset/{kind}/{day}")
def reset_day_draft(kind: ResetKind, day: Day, workspace_id: WorkspaceID) -> Mindmap:
    """Clear user draft for (workspace_id, day, kind) and return the verified KG/Lab seed."""
    with closing(sqlite3.connect(DB_PATH)) as db, db:
        db.execute(
            "DELETE FROM drafts WHERE workspace_id = ? AND day = ? AND kind = ?",
            (workspace_id, day, kind),
        )
    return _seeded_mindmap(day, kind)


@app.get("/api/kg/summary")
def kg_summary() -> dict[str, Any]:
    summary = get_kg_summary()
    repo_index = ensure_repo_index()
    summary["repo_files_indexed"] = len(repo_index.get("files_indexed", []))
    summary["repo_symbols_indexed"] = len(repo_index.get("symbols", []))
    summary["checkpoints"] = [cp["id"] for cp in repo_index.get("checkpoints", [])]
    return summary


@app.get("/api/kg/search")
def kg_search(
    q: str = Query(min_length=1, max_length=500),
    day: int | None = Query(default=None, ge=1, le=14),
    top_k: int = Query(default=8, ge=1, le=20),
) -> dict[str, Any]:
    hits = search_kg(q, day=day, top_k=top_k)
    return {"query": q, "day": day, "count": len(hits), "results": hits}


@app.post("/api/map")
def ai_lecture_to_lab_map(req: MapRequest) -> dict[str, Any]:
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query không được rỗng")
    return map_lecture_to_lab(req.query, day=req.day, mode=req.mode, direction=req.direction)


@app.post("/api/chat")
async def kg_rag_chat(req: ChatRequest, request: Request, response: Response) -> dict[str, Any]:
    """KG-RAG tutor: explain concepts/lessons at eli5|standard|deep, grounded + cited on the GraphRAG DB."""
    response.headers["Cache-Control"] = "no-store"
    client_key = request.cookies.get(COOKIE_NAME) or (request.client.host if request.client else "unknown")
    max_req = int(os.environ.get("CHAT_RATE_LIMIT_MAX", "10"))
    window_s = int(os.environ.get("CHAT_RATE_LIMIT_WINDOW_S", "60"))
    max_users = int(os.environ.get("CHAT_MAX_CONCURRENT_USERS", "0"))
    allowed, retry_after = chat_rate_limiter.check(
        client_key,
        max_req,
        window_s,
        max_keys=max_users if max_users > 0 else None,
    )
    if not allowed:
        detail = (
            "Hệ thống đang đạt giới hạn người dùng hoặc bạn gửi quá nhanh. Vui lòng đợi vài giây rồi thử lại."
            if max_users > 0
            else "Bạn đang gửi quá nhanh (tối đa 10 lượt/phút). Vui lòng đợi vài giây rồi thử lại."
        )
        raise HTTPException(
            status_code=429,
            detail=detail,
            headers={"Retry-After": str(retry_after)},
        )
    return await async_chat_turn(
        req.message,
        history=[t.model_dump() for t in req.history],
        level=req.level,
        scope_day=req.day,
        focus_id=req.focus_id,
        lab_id=req.lab_id,
        prev_citation_ids=req.prev_citation_ids,
    )


@app.get("/api/graph/stats")
def graph_stats() -> dict[str, Any]:
    return get_graph_stats()


@app.get("/api/graph/subgraph")
def graph_subgraph(
    node_id: str = Query(min_length=1, max_length=200),
    hops: int = Query(default=2, ge=1, le=3),
    direction: Literal["both", "theory_to_practice", "practice_to_theory"] = "both",
) -> dict[str, Any]:
    return traverse_subgraph([node_id], max_hops=hops, direction=direction)


@app.get("/api/graph/communities")
def graph_communities(limit: int = Query(default=50, ge=1, le=200)) -> dict[str, Any]:
    communities = list_communities(limit=limit)
    return {"count": len(communities), "communities": communities}


@app.get("/api/graph/mapping-export")
def graph_mapping_export() -> dict[str, Any]:
    ensure_graph_db_loaded()
    return export_mapping_json()


@app.get("/api/lectures")
def graph_lectures() -> dict[str, Any]:
    lectures = list_lectures()
    return {"count": len(lectures), "lectures": lectures}


@app.post("/api/lectures/ingest")
def ingest_lecture(req: LectureIngestRequest) -> dict[str, Any]:
    title_guard = check_input_guard(req.title)
    if title_guard["blocked"]:
        raise HTTPException(status_code=400, detail=title_guard["reason"])
    content_guard = check_input_guard(req.content[:2000])
    if content_guard["blocked"] and "max_length_exceeded" not in content_guard["matched_rules"]:
        raise HTTPException(status_code=400, detail=content_guard["reason"])
    return extract_lecture_knowledge(
        title=req.title,
        content=req.content,
        day=req.day,
        source_file=req.source_file,
    )
