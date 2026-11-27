import os
import sqlite3
from contextlib import asynccontextmanager, closing
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4, uuid5

from fastapi import Cookie, Depends, FastAPI, Path as ApiPath, Request, Response
from pydantic import BaseModel, Field, model_validator

DB_PATH = Path(os.environ.get("LEARNING_DB_PATH", Path(__file__).with_name("learning.sqlite3")))
COOKIE_NAME = "learning_workspace"
Day = Annotated[int, ApiPath(ge=1, le=14)]


class Node(BaseModel):
    id: UUID
    text: str = Field(max_length=20000)
    x: int = Field(ge=0, le=4096)
    y: int = Field(ge=0, le=4096)
    parent_id: UUID | None = None


class Mindmap(BaseModel):
    nodes: list[Node] = Field(default_factory=list, max_length=20)

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
    yield


app = FastAPI(title="AI in Action", lifespan=lifespan)


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
    for day, note in workspace.preclass.items():
        if note.content and day not in workspace.lab:
            node = Node(id=uuid5(UUID(workspace_id), f"preclass:{day}"), text=note.content, x=24, y=24)
            workspace.lab[day] = Mindmap(nodes=[node])
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
