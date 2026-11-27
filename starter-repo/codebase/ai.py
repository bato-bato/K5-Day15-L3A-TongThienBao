"""Nối model — chỗ DUY NHẤT trong bản chạy thử gọi model AI. NHÓM VIẾT phần gọi model thật.

Hợp đồng (giữ nguyên để khung đo được token):
    call_model(system: str, user: str) -> dict với 4 khoá
        "text":       str   chữ model trả về
        "model":      str   tên model đã gọi (để tra giá ở bảng giá model)
        "tokens_in":  int   số token vào, lấy từ trường usage trong phản hồi API — KHÔNG ước lượng
        "tokens_out": int   số token ra, gồm cả token suy luận / suy nghĩ nếu API tính riêng
    @model_call (từ tracing.py) tự ghi mỗi lần gọi vào trace; agent.py gọi call_model bao nhiêu lần
    cũng được, khung tự cộng token.
    Lỗi gọi model (hết lượt, sai key, mất mạng): cứ để exception bay ra — khung ghi lỗi vào cột error.

Chế độ giả (mặc định khi .env chưa có MODEL_PROVIDER, hoặc MODEL_PROVIDER=fake):
    chọn từ dữ liệu đã nạp, model "fake", token 0 — để luồng chạy hết từ trước CP2 (guide bước 3.2).
    Lượt `run.py eval` / `run.py simulate` chạy bằng model giả KHÔNG được tính.

Nối model thật: điền .env (chép từ .env.example), rồi viết nhánh gọi API ở dưới theo docs/connect-model.md
(có ví dụ OpenAI, Claude, model chạy trên máy, và cách nối nhà cung cấp khác). Không dán API key vào file này.
"""
import json
import os
import re
import unicodedata

from tracing import model_call

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_env(path=os.path.join(ROOT, ".env")):
    """Đọc file .env (KEY=VALUE mỗi dòng) vào biến môi trường, không ghi đè biến đã có. Khung — không cần sửa."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()
MODEL_PROVIDER = (os.environ.get("MODEL_PROVIDER") or "fake").strip().lower()
MODEL_NAME = (os.environ.get("MODEL_NAME") or "").strip()
API_KEY = (os.environ.get("API_KEY") or "").strip()


def mock_answer(user: str) -> str:
    """Select a direct concept from the supplied context for the offline demonstration."""
    try:
        request = json.loads(user)
        candidates = [item for item in request["concepts"] if item["direct"]]
        question = terms(request["question"])
        code_guides = request["code_guides"]
    except (KeyError, TypeError, ValueError):
        last = (user.strip().splitlines() or [""])[-1]
        return "[câu trả lời giả — chưa nối model] " + last[:60]
    if not candidates:
        return json.dumps({"status": "insufficient_evidence"})
    def relevance(item):
        words = terms(item["label"]) | terms(item["id"])
        return len(question & words) / len(words)

    concept = max(candidates, key=relevance)

    code_id = None
    for guide in code_guides:
        locator = guide["source"]["locator"]
        symbols = set(locator.get("symbols", [])) | {locator.get("text", "")}
        if any(terms(symbol) & question for symbol in symbols):
            code_id = guide["evidence_id"]
            break
    return json.dumps(
        {"concept_id": concept["id"], "hint": concept["definition"], "code_ref_id": code_id},
        ensure_ascii=False,
    )


def terms(text: str) -> set:
    letters = unicodedata.normalize("NFD", text.casefold())
    normalized = "".join(char for char in letters if not unicodedata.combining(char))
    return set(re.findall(r"[^\W_]+", normalized)) - {"", "def", "todo"}


@model_call
def call_model(system: str, user: str) -> dict:
    if MODEL_PROVIDER == "fake":
        return {"text": mock_answer(user), "model": "fake", "tokens_in": 0, "tokens_out": 0}

    # NHÓM VIẾT: gọi model thật ở đây (theo MODEL_PROVIDER, MODEL_NAME, API_KEY) rồi trả đúng 4 khoá.
    # Ví dụ chép được cho từng nhà cung cấp: docs/connect-model.md mục 2.
    raise NotImplementedError(
        "chưa viết phần gọi model thật cho MODEL_PROVIDER=%s trong codebase/ai.py — xem docs/connect-model.md"
        % MODEL_PROVIDER)
