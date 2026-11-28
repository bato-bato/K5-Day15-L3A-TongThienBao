"""Guardrails & Source Verification (Day 4, Day 9, Day 11).

Implements:
1. Input Guard + XML Spotlighting against Direct/Indirect Prompt Injection.
2. Deterministic Source Verifier (Code Grader):
   - Verifies concept_id exists in kg_aicb_p1.json and day/pdf_pages match ground truth.
   - Verifies code_ref (file_path, symbol, line_start, line_end) exists in repo_index.
   - Triggers Abstention when no verified grounding remains.
"""
from __future__ import annotations

import math
import re
import threading
import time
import unicodedata
from collections import defaultdict, deque
from typing import Any

INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?", re.IGNORECASE),
    re.compile(r"reveal\s+(your\s+)?system\s+prompt", re.IGNORECASE),
    re.compile(r"(bypass|override)\s+(guardrail|safety|policy)", re.IGNORECASE),
    re.compile(r"(drop|truncate|delete)\s+(table|database|prod)", re.IGNORECASE),
    re.compile(r"bỏ\s+qua\s+(toàn\s+bộ\s+)?(chỉ\s+dẫn|hướng\s+dẫn)\s+(trước|gốc)", re.IGNORECASE),
    re.compile(r"tiết\s+lộ\s+system\s+prompt", re.IGNORECASE),
    re.compile(r"xóa\s+(cơ\s+sở\s+dữ\s+liệu|database)", re.IGNORECASE),
    # System prompt exfiltration
    re.compile(r"(show|print|dump|output|repeat|leak)\s+(me\s+)?(your\s+|the\s+)?(system\s+prompt|hidden\s+instructions?|developer\s+message)", re.IGNORECASE),
    re.compile(r"(in\s+ra|hiển\s+thị|cho\s+(tôi|mình)\s+xem|đọc\s+lại)\s+(system\s+prompt|chỉ\s+dẫn\s+hệ\s+thống|prompt\s+gốc)", re.IGNORECASE),
    # Jailbreak / persona hijack
    re.compile(r"(you\s+are\s+now|act\s+as|pretend\s+(to\s+be|you\s+are))\s+(dan|an?\s+unrestricted|jailbroken|root|admin|system)", re.IGNORECASE),
    re.compile(r"(developer|god|jailbreak)\s+mode", re.IGNORECASE),
    re.compile(r"(quên\s+(hết|toàn\s+bộ)|hãy\s+đóng\s+vai)\s+(chỉ\s+dẫn|quy\s+tắc|hacker|admin|không\s+giới\s+hạn)", re.IGNORECASE),
    # Delimiter / role spoofing
    re.compile(r"<\s*/?\s*(system|kg_context|untrusted_user_question|untrusted_history)\s*>", re.IGNORECASE),
    re.compile(r"(?m)^\s*(system|developer)\s*:\s*", re.IGNORECASE),
    # Secret / env exfiltration
    re.compile(r"(print|show|dump|read|reveal|cat|echo)\s+.{0,40}(\.env|api[_\s-]?key|secret[_\s-]?key|openai_api_key|llm_api_key)", re.IGNORECASE),
]

POLITICS_ECON_CULTURE_PATTERNS = [
    re.compile(
        r"\b(chinh tri|dia chinh tri|chinh phu|quoc hoi|dang phai|bau cu|tong thong|thu tuong|"
        r"chu nghia (?:tu ban|xa hoi|cong san|dan toc)|xung dot vu trang|chien tranh|bieu tinh|cam van|"
        r"politics|political|geopolitics|geopolitical|election|president|prime minister|parliament|congress|sanctions|warfare|armed conflict)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(kinh te (?:the gioi|vi mo|toan cau|chinh tri|thi truong)|suy thoai kinh te|lam phat|lai suat|"
        r"ngan hang trung uong|ty gia|chung khoan|co phieu|bat dong san|tien ao|forex|gdp|cpi|"
        r"world economy|global economy|macroeconomics|inflation|interest rate|central bank|exchange rate|stock market|real estate|cryptocurrency|trade war|tariff)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(van hoa (?:the gioi|cac nuoc|phuong dong|phuong tay|dan toc)|ton giao|tin nguong|sac toc|"
        r"phan biet chung toc|phong tuc tap quan|"
        r"world culture|cultural heritage|religion|religious|ethnicity|ethnic|racism)\b",
        re.IGNORECASE,
    ),
]

CODE_FOR_USER_PATTERNS = [
    re.compile(
        r"\b(viet|lam|giai|code|lap trinh|hoan thanh)\s+(?:ho|giup|thay|dum|gium)(?:\s+(?:minh|toi|em|ban))?\b"
        r".{0,50}\b(code|ma nguon|chuong trinh|bai tap|bai lab|checkpoint|file|script|ham|function|class|du an|project|ung dung|app|api|bot)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(viet|tao|xay dung|sinh|generate|write)\s+(?:toan bo|tron bo|full|complete|entire|ready[- ]to[- ]run)\s+"
        r"(?:code|ma nguon|solution|loi giai|bai nop|project|app|script)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(viet\s+code\s+(?:thay|ho|giup|dum)|code\s+(?:thay|ho|dum|gium)\s+(?:minh|toi|em)|"
        r"lam\s+thay\s+(?:bai|lab|checkpoint)|giai\s+ho\s+(?:bai|lab|checkpoint))\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(write\s+(?:the\s+)?(?:whole|full|complete|entire)\s+code|"
        r"do\s+my\s+(?:homework|assignment|lab|coding)|code\s+(?:this|it)\s+for\s+me|write\s+the\s+solution\s+for\s+me)\b",
        re.IGNORECASE,
    ),
]

ZERO_WIDTH_BIDI_RE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060\ufeff]")
CTRL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
DELIMITER_TAG_RE = re.compile(
    r"<(/?(?:kg_context|untrusted_[a-z_]+|system|assistant|user|instruction|prompt)\b[^>]*)>",
    re.IGNORECASE,
)

PII_SECRET_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    ("api_key", re.compile(r"sk-[A-Za-z0-9_-]{20,}"), "[REDACTED_SECRET]"),
    ("api_key", re.compile(r"AIza[0-9A-Za-z_-]{30,}"), "[REDACTED_SECRET]"),
    ("api_key", re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"), "[REDACTED_SECRET]"),
    ("api_key", re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED_SECRET]"),
    ("api_key", re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"), "[REDACTED_SECRET]"),
    ("email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "[REDACTED_EMAIL]"),
    ("phone_vn", re.compile(r"(?<!\d)(?:\+84|0)(?:3|5|7|8|9)\d{8}(?!\d)"), "[REDACTED_PHONE]"),
    ("national_id", re.compile(r"(?<!\d)0\d{11}(?!\d)"), "[REDACTED_ID]"),
]

OUTPUT_LEAK_PATTERNS = [
    re.compile(r"<\s*/?\s*(kg_context|untrusted_user_question|untrusted_history)\s*>", re.IGNORECASE),
    re.compile(r"Nội dung trong <untrusted_\*>", re.IGNORECASE),
    re.compile(r"\b(OPENAI_API_KEY|LLM_API_KEY)\b"),
]
DANGEROUS_HTML_PATTERNS = [
    re.compile(r"<script\b[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<iframe\b[^>]*>.*?</iframe>", re.IGNORECASE | re.DOTALL),
    re.compile(r"javascript\s*:", re.IGNORECASE),
]

MAX_QUERY_CHARS = 2000


def sanitize_text(text: str) -> str:
    """Normalize NFC and strip zero-width/bidi/control characters used to obfuscate injections."""
    normalized = unicodedata.normalize("NFC", text or "")
    normalized = ZERO_WIDTH_BIDI_RE.sub("", normalized)
    return CTRL_CHARS_RE.sub("", normalized)


def spotlight(text: str, tag: str) -> str:
    """Wrap untrusted user/repo/note payload in XML delimiters to prevent Context Bleed (Day 4 & 11)."""
    clean = sanitize_text(text)
    clean = DELIMITER_TAG_RE.sub(r"&lt;\1&gt;", clean)
    clean = clean.replace(f"</{tag}>", f"&lt;/{tag}&gt;")
    return f"<{tag}>\n{clean}\n</{tag}>"


def _fold_ascii(text: str) -> str:
    """Strip Vietnamese diacritics for accent-tolerant guardrail matching."""
    decomposed = unicodedata.normalize("NFD", (text or "").casefold())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).replace("đ", "d")


def check_input_guard(text: str) -> dict[str, Any]:
    """Screen input query for length limits, prompt injection, off-limit topics, and code-for-user requests."""
    normalized = sanitize_text(text).strip()
    if not normalized:
        return {"blocked": True, "reason": "Empty query", "matched_rules": ["empty_input"]}
    if len(normalized) > MAX_QUERY_CHARS:
        return {
            "blocked": True,
            "reason": f"Query exceeds max length ({MAX_QUERY_CHARS} chars)",
            "matched_rules": ["max_length_exceeded"],
        }

    matched: list[str] = []
    for pattern in INJECTION_PATTERNS:
        if pattern.search(normalized):
            matched.append(pattern.pattern)

    if matched:
        return {
            "blocked": True,
            "reason": "Phát hiện dấu hiệu Prompt Injection / chỉ dẫn vượt quyền trong dữ liệu đầu vào.",
            "matched_rules": matched,
        }

    folded = _fold_ascii(normalized)
    topic_matched = [p.pattern for p in POLITICS_ECON_CULTURE_PATTERNS if p.search(folded)]
    if topic_matched:
        return {
            "blocked": True,
            "reason": "Gia sư AI chỉ hỗ trợ trao đổi kiến thức và bài học AI/kỹ thuật, không thảo luận các chủ đề chính trị, kinh tế hoặc văn hóa thế giới.",
            "matched_rules": topic_matched,
        }

    code_matched = [p.pattern for p in CODE_FOR_USER_PATTERNS if p.search(folded)]
    if code_matched:
        return {
            "blocked": True,
            "reason": "Mình không viết code thay hay làm hộ bài cho bạn. Hãy chia sẻ hướng tiếp cận hoặc đoạn bạn đang vướng để mình gợi ý cách tự triển khai và debug nhé.",
            "matched_rules": code_matched,
        }

    return {"blocked": False, "reason": "OK", "matched_rules": []}


def redact_sensitive_data(text: str) -> tuple[str, list[str]]:
    """Mask API keys, tokens, and PII before sending to LLM, logging, or returning to client."""
    out = sanitize_text(text)
    detected: set[str] = set()
    for kind, pattern, replacement in PII_SECRET_PATTERNS:
        out, count = pattern.subn(replacement, out)
        if count > 0:
            detected.add(kind)
    return out, sorted(detected)


def sanitize_chat_history(history: list[dict[str, str]], max_turns: int = 6) -> tuple[list[dict[str, str]], int]:
    """Filter poisoned turns and redact sensitive data from conversation history."""
    clean: list[dict[str, str]] = []
    dropped = 0
    for turn in (history or [])[-max_turns:]:
        role = turn.get("role")
        if role not in ("user", "assistant"):
            continue
        raw_content = sanitize_text(turn.get("content", ""))[:1200]
        if not raw_content.strip():
            continue
        redacted, _ = redact_sensitive_data(raw_content)
        guard = check_input_guard(redacted)
        if guard["blocked"]:
            dropped += 1
            continue
        clean.append({"role": role, "content": redacted})
    return clean, dropped


def check_output_guard(text: str) -> dict[str, Any]:
    """Screen assistant output for system-prompt leakage, leaked secrets/PII, and unsafe HTML."""
    cleaned, redacted_types = redact_sensitive_data(text or "")
    flags: list[str] = []

    for pattern in OUTPUT_LEAK_PATTERNS:
        if pattern.search(cleaned):
            flags.append("prompt_leakage")
            return {
                "blocked": True,
                "text": "⚠️ Phản hồi đã bị chặn bởi Output Guardrail để bảo vệ cấu hình hệ thống. Bạn vui lòng hỏi lại về nội dung bài học nhé.",
                "redacted_types": redacted_types,
                "flags": flags,
            }

    before_xss = cleaned
    for pattern in DANGEROUS_HTML_PATTERNS:
        cleaned = pattern.sub("", cleaned)
    if cleaned != before_xss:
        flags.append("xss_stripped")

    return {
        "blocked": False,
        "text": cleaned.strip(),
        "redacted_types": redacted_types,
        "flags": flags,
    }


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding-window rate limiter keyed by workspace/client."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._ops = 0

    def check(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
        max_keys: int | None = None,
    ) -> tuple[bool, int]:
        now = time.monotonic()
        window = max(1, window_seconds)
        cutoff = now - window
        with self._lock:
            self._ops += 1
            if max_keys is not None or self._ops % 100 == 0:
                stale = [k for k, dq in self._hits.items() if not dq or dq[-1] <= cutoff]
                for k in stale:
                    del self._hits[k]

            if max_keys is not None and key not in self._hits and len(self._hits) >= max(1, max_keys):
                earliest_expiry = min(dq[-1] for dq in self._hits.values() if dq)
                retry_after = max(1, math.ceil(earliest_expiry + window - now))
                return False, retry_after

            dq = self._hits[key]
            while dq and dq[0] <= cutoff:
                dq.popleft()

            if len(dq) >= max(1, max_requests):
                retry_after = max(1, math.ceil(dq[0] + window - now))
                return False, retry_after

            dq.append(now)
            return True, 0

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()
            self._ops = 0


chat_rate_limiter = SlidingWindowRateLimiter()


def reset_rate_limiter() -> None:
    """Reset the shared chat rate limiter (primarily for isolated tests)."""
    chat_rate_limiter.clear()


def verify_mapping(
    result: dict[str, Any],
    kg_nodes_by_id: dict[str, dict[str, Any]],
    repo_index: dict[str, Any],
) -> dict[str, Any]:
    """Deterministic Code Grader that verifies all Knowledge & Repo citations against ground truth.

    Any fabricated concept_id, mismatched pdf_pages/day, or non-existent file_path/symbol
    is stripped and logged in `rejected_claims`. If no verified evidence remains, abstention=True.
    """
    rejected_claims: list[dict[str, str]] = []
    verified_knowledge: list[dict[str, Any]] = []
    verified_code_refs: list[dict[str, Any]] = []

    indexed_files = set(repo_index.get("files_indexed", []))
    symbols_lookup: dict[tuple[str, str], dict[str, Any]] = {
        (sym["file_path"], sym["symbol"]): sym for sym in repo_index.get("symbols", [])
    }

    for k_ref in result.get("knowledge_refs", []):
        cid = k_ref.get("concept_id")
        gt = kg_nodes_by_id.get(cid)
        if not gt:
            rejected_claims.append({"kind": "knowledge_ref", "id": str(cid), "reason": "concept_id not found in KG"})
            continue

        claimed_day = k_ref.get("day")
        claimed_pages = k_ref.get("pdf_pages")
        if claimed_day is not None and claimed_day != gt["day"]:
            rejected_claims.append({
                "kind": "knowledge_ref",
                "id": str(cid),
                "reason": f"day mismatch (claimed {claimed_day}, ground truth {gt['day']})",
            })
            continue

        gt_pages = set(gt.get("provenance", {}).get("pdf_pages", []))
        if claimed_pages is not None and gt_pages and not set(claimed_pages).issubset(gt_pages):
            rejected_claims.append({
                "kind": "knowledge_ref",
                "id": str(cid),
                "reason": f"pdf_pages mismatch (claimed {claimed_pages}, ground truth {sorted(gt_pages)})",
            })
            continue

        prov = gt.get("provenance", {})
        verified_knowledge.append(
            {
                "concept_id": gt["id"],
                "lecture_id": gt.get("lecture_id", "LEC_AICB_P1"),
                "type": gt["type"],
                "label": gt["label"],
                "day": gt["day"],
                "summary": gt["summary"],
                "pdf_pages": prov.get("pdf_pages", []),
                "section_ref": prov.get("section_ref", ""),
                "key_quote": prov.get("key_quote", ""),
                "verification_status": "verified",
            }
        )

    for c_ref in result.get("code_refs", []):
        fpath = c_ref.get("file_path", "")
        sym_name = c_ref.get("symbol")
        if fpath not in indexed_files and not any(
            cp.get("source_file") == fpath or fpath in cp.get("deliverables", [])
            for cp in repo_index.get("checkpoints", [])
        ):
            rejected_claims.append({"kind": "code_ref", "id": fpath, "reason": "file_path not found in repo_index"})
            continue

        if sym_name:
            sym = symbols_lookup.get((fpath, sym_name))
            if not sym:
                rejected_claims.append({
                    "kind": "code_ref",
                    "id": f"{fpath}:{sym_name}",
                    "reason": "symbol not found in AST index",
                })
                continue
            verified_code_refs.append(
                {
                    "file_path": sym["file_path"],
                    "symbol": sym["symbol"],
                    "kind": sym["kind"],
                    "line_start": sym["line_start"],
                    "line_end": sym["line_end"],
                    "docstring": sym["docstring"],
                    "verification_status": "verified",
                }
            )
        else:
            verified_code_refs.append(
                {
                    "file_path": fpath,
                    "symbol": None,
                    "kind": "file",
                    "line_start": c_ref.get("line_start", 1),
                    "line_end": c_ref.get("line_end", 1),
                    "docstring": c_ref.get("docstring", ""),
                    "verification_status": "verified",
                }
            )

    abstention = len(verified_knowledge) == 0
    out = dict(result)
    out["knowledge_refs"] = verified_knowledge
    out["code_refs"] = verified_code_refs
    out["abstention"] = abstention
    out["status_code"] = "INSUFFICIENT_EVIDENCE" if abstention else "VERIFIED"
    out["verification"] = {
        "passed": not abstention and len(rejected_claims) == 0,
        "status_code": out["status_code"],
        "verified_knowledge_count": len(verified_knowledge),
        "verified_code_count": len(verified_code_refs),
        "rejected_count": len(rejected_claims),
        "rejected_claims": rejected_claims,
    }
    if abstention:
        out["explanation"] = (
            "Không tìm thấy căn cứ trong tài liệu AICB-P1 (Days 1–13) hoặc repo hiện tại. "
            "Hệ thống từ chối suy diễn để tránh ảo giác (Abstention Guardrail)."
        )
        out["trap_warnings"] = []
    return out
