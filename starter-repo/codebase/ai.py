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

Nối model thật: điền .env (chép từ .env.example) theo docs/connect-model.md.
Các nhánh OpenAI, Claude và Ollama đã có sẵn. Không dán API key vào file này.
"""
import json
import os
import re
import unicodedata
import urllib.error
import urllib.request

from tracing import model_call

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOW_RAW = False
URL_CLAUDE = "https://api.anthropic.com/v1/messages"


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
OPENAI_BASE_URL = (os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").strip().rstrip("/")
OLLAMA_URL = (os.environ.get("OLLAMA_URL") or "http://localhost:11434/api/chat").strip()


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


def post_json(url: str, headers: dict, body: dict, timeout: int = 60) -> dict:
    """Gửi POST JSON, trả về JSON phản hồi. Chỉ dùng thư viện chuẩn (urllib)."""
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers=dict({"Content-Type": "application/json"}, **headers),
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Model API trả HTTP {error.code}.") from None
    if SHOW_RAW:
        print(json.dumps(data, ensure_ascii=False, indent=2)[:3000])
    return data


def call_openai(system: str, user: str) -> dict:
    if not MODEL_NAME or not API_KEY:
        raise RuntimeError("Điền MODEL_NAME và API_KEY trong starter-repo/.env.")
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": user}]
    body = {"model": MODEL_NAME, "messages": messages}
    if "json" in (system or "").lower():
        body["response_format"] = {"type": "json_object"}
    data = post_json(f"{OPENAI_BASE_URL}/chat/completions", {"Authorization": "Bearer " + API_KEY}, body)
    u = data["usage"]
    return {
        "text": data["choices"][0]["message"]["content"] or "",
        "tokens_in": int(u["prompt_tokens"]),
        "tokens_out": int(u["completion_tokens"]),
    }


def call_claude(system: str, user: str) -> dict:
    data = post_json(
        URL_CLAUDE,
        {"x-api-key": API_KEY, "anthropic-version": "2023-06-01"},
        {
            "model": MODEL_NAME,
            "max_tokens": 1024,
            "system": system or "",
            "messages": [{"role": "user", "content": user}],
        },
    )
    text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    u = data["usage"]
    return {
        "text": text,
        "tokens_in": int(u["input_tokens"]),
        "tokens_out": int(u["output_tokens"]),
    }


def call_ollama(system: str, user: str) -> dict:
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": user}]
    data = post_json(OLLAMA_URL, {}, {"model": MODEL_NAME, "messages": messages, "stream": False}, timeout=300)
    return {
        "text": data["message"]["content"] or "",
        "tokens_in": int(data.get("prompt_eval_count", 0)),
        "tokens_out": int(data.get("eval_count", 0)),
    }


@model_call
def call_model(system: str, user: str) -> dict:
    if MODEL_PROVIDER == "fake":
        return {"text": mock_answer(user), "model": "fake", "tokens_in": 0, "tokens_out": 0}
    if MODEL_PROVIDER == "openai":
        r = call_openai(system, user)
    elif MODEL_PROVIDER == "anthropic":
        r = call_claude(system, user)
    elif MODEL_PROVIDER == "ollama":
        r = call_ollama(system, user)
    else:
        raise NotImplementedError(
            "chưa viết phần gọi model thật cho MODEL_PROVIDER=%s trong codebase/ai.py — xem docs/connect-model.md"
            % MODEL_PROVIDER
        )
    return {
        "text": r["text"],
        "model": MODEL_NAME,
        "tokens_in": int(r["tokens_in"]),
        "tokens_out": int(r["tokens_out"]),
    }
