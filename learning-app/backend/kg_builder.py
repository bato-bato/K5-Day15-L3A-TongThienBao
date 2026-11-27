"""Build and validate the VinUni AICB-P1 / AI20K (Days 1-13) Knowledge Graph corpus.

Applies Unicode NFC normalization and SHA-256 provenance hashing per Day 6 Data Engineering rules.
"""
from __future__ import annotations

import hashlib
import json
import unicodedata
from pathlib import Path
from typing import Any

KG_VERSION = "2026.1.0"
VALID_TYPES = {
    "DayModule",
    "CoreConcept",
    "ArchitecturePattern",
    "MetricOrFormula",
    "FailureOrTrap",
    "CaseStudy",
    "LabDeliverable",
}
VALID_RELATIONS = {
    "CONTAINS",
    "PREREQUISITE_OF",
    "MITIGATES_FAILURE",
    "MEASURED_BY",
    "ILLUSTRATED_BY",
    "IMPLEMENTED_IN_LAB",
    "EVOLVES_INTO",
}

OUTPUT_PATH = Path(__file__).parent / "kg_data" / "kg_aicb_p1.json"


def nfc(text: str) -> str:
    """Normalize Vietnamese/Unicode text to NFC before hashing, indexing, or matching."""
    return unicodedata.normalize("NFC", text).strip()


def make_node(
    node_id: str,
    node_type: str,
    label: str,
    day: int,
    tier: int,
    summary: str,
    pdf_pages: list[int],
    section_ref: str,
    key_quote: str = "",
    keywords: list[str] | None = None,
) -> dict[str, Any]:
    """Create a normalized Knowledge Graph node with deterministic SHA-256 provenance."""
    clean_label = nfc(label)
    clean_summary = nfc(summary)
    clean_section = nfc(section_ref)
    clean_quote = nfc(key_quote)
    clean_keywords = [nfc(k) for k in (keywords or [])]
    digest_payload = f"{node_id}|{node_type}|{day}|{clean_label}|{clean_summary}|{pdf_pages}"
    sha256 = hashlib.sha256(digest_payload.encode("utf-8")).hexdigest()
    return {
        "id": node_id,
        "type": node_type,
        "label": clean_label,
        "day": day,
        "tier": tier,
        "summary": clean_summary,
        "keywords": clean_keywords,
        "provenance": {
            "pdf_pages": pdf_pages,
            "section_ref": clean_section,
            "key_quote": clean_quote,
        },
        "sha256": sha256,
    }


def make_edge(source: str, target: str, relation: str, weight: float = 1.0) -> dict[str, Any]:
    """Create a directed Knowledge Graph edge."""
    return {
        "source": source,
        "target": target,
        "relation": relation,
        "weight": weight,
    }


def build_knowledge_graph() -> dict[str, Any]:
    """Construct the complete 13-day Knowledge Graph from the 88-page AICB-P1 PDF."""
    n = make_node
    e = make_edge

    nodes: list[dict[str, Any]] = [
        # ================= DAY 1 (Pages 2-6) =================
        n(
            "DAY_01",
            "DayModule",
            "Ngày 1: AI & LLM Foundation",
            1,
            1,
            "Nền tảng AI 2026 từ Machine Learning đến Agentic AI, kiến trúc Transformer, Token Economy, API Call và Vibe Coding.",
            [2, 3, 4, 5, 6],
            "NGÀY 1 — AI & LLM Foundation (trang 2–6)",
            "Bạn đang dùng AI mỗi ngày nhưng thực sự bên trong nó làm gì?",
            ["AI", "LLM", "Transformer", "Token Economy", "Vibe Coding", "API"],
        ),
        n(
            "CON_D1_TAXONOMY",
            "CoreConcept",
            "Phân tầng AI & 3 nhóm AI chính",
            1,
            3,
            "AI > ML > Deep Learning > Generative AI > LLM. Ba nhóm: Discriminative (Input->Label), Generative (Prompt->Content), Agentic (Goal->Plan->Action). Bốn cấp độ lên Agent (Level 0-3); Agent = Goal + Reasoning + Tools + Memory + Action.",
            [2],
            "Ngày 1 · Mục 1 (trang 2)",
            "Trọng tâm doanh nghiệp chuyển từ AI trả lời hay sang AI biết hành động, kết nối công cụ và tạo ROI thực tế.",
            ["Taxonomy", "Discriminative", "Generative", "Agentic", "Level 0-3"],
        ),
        n(
            "CON_D1_TRANSFORMER",
            "CoreConcept",
            "Kiến trúc Transformer & Self-Attention",
            1,
            3,
            "Decoder-only (GPT, Claude, Gemini) thắng thế nhờ khả năng scale tốt. X = E + P (Input Embedding + Positional Encoding). Scaled Dot-Product Attention: softmax((Q x K^T)/sqrt(d_k)) x V; Causal Mask ngăn nhìn trộm token tương lai; 3 giai đoạn: Pre-training -> SFT -> RLHF/DPO.",
            [2, 3, 6],
            "Ngày 1 · Mục 2 (trang 2–3, 6)",
            "Attention(Q, K, V) = softmax((Q x K^T) / sqrt(d_k)) x V",
            ["Transformer", "Self-Attention", "Q K V", "Causal Mask", "Pre-training", "SFT", "RLHF", "DPO"],
        ),
        n(
            "MET_D1_TOKEN_ECONOMY",
            "MetricOrFormula",
            "Token Economy & Tam giác Quality-Latency-Cost",
            1,
            4,
            "Tổng chi phí = Input tokens + Output tokens (tính theo 1M tokens). Output đắt gấp 3–5 lần Input. Tiếng Việt/Unicode (~0.5 từ/token), code, JSON tốn nhiều token hơn tiếng Anh (~0.75 từ/token). Bắt đầu từ model đủ tốt và đủ rẻ (Haiku/Flash) trước khi nâng cấp.",
            [3, 4, 5],
            "Ngày 1 · Mục 3–4 (trang 3–5)",
            "Output tokens thường đắt gấp 3 đến 5 lần Input tokens.",
            ["Token", "Cost", "Latency", "Quality", "temperature", "top_p", "Streaming"],
        ),
        n(
            "PAT_D1_VIBE_CODING",
            "ArchitecturePattern",
            "Vibe Coding & Mẫu triển khai API",
            1,
            3,
            "Quy trình Vibe Coding (Idea -> Prompt -> Code -> Test -> Refine) dựa trên 3 nguyên tắc vàng: Intent-driven, Context-first, Human review. API Call ghi nhận token usage, finish_reason, dùng Streaming và temperature=0 cho code/phân tích.",
            [5],
            "Ngày 1 · Mục 4–5 (trang 5)",
            "Viết phần mềm nhanh hơn, không phải viết code nhiều hơn.",
            ["Vibe Coding", "Intent-driven", "Context-first", "Human review", "API wrapper"],
        ),
        n(
            "ERR_D1_LLM_LIMITS",
            "FailureOrTrap",
            "3 giới hạn bẩm sinh của LLM",
            1,
            3,
            "(1) Knowledge cutoff: không biết thông tin sau thời điểm train; (2) Hallucination: tối ưu xác suất token chứ không phải tính đúng-sai; (3) Context window hữu hạn và hiệu ứng quên thông tin ở giữa (Lost in the Middle).",
            [3],
            "Ngày 1 · Mục 2 (trang 3)",
            "Trả lời tự tin nhưng sai sự thật vì mô hình tối ưu xác suất token chứ không phải tính đúng-sai.",
            ["Knowledge cutoff", "Hallucination", "Lost in the Middle", "ảo giác"],
        ),
        n(
            "LAB_D1_API_BENCHMARK",
            "LabDeliverable",
            "Lab #1: Streaming Chatbot & Bảng so sánh Latency-Cost-Quality",
            1,
            4,
            "Viết script Python gọi GPT-4o và GPT-4o-mini, xây dựng chatbot streaming và lập bảng so sánh latency, cost, quality với 3 prompt khác nhau.",
            [6],
            "Ngày 1 · Mục 6 (trang 6)",
            "Viết script Python gọi GPT-4o và GPT-4o-mini, xây dựng chatbot streaming.",
            ["Lab 1", "GPT-4o", "streaming", "benchmark"],
        ),

        # ================= DAY 2 (Pages 7-12) =================
        n(
            "DAY_02",
            "DayModule",
            "Ngày 2: Xác định bài toán cho AI & Problem Statement",
            2,
            1,
            "Biến yêu cầu mơ hồ thành Problem Statement rõ ràng, định lượng được, chọn đúng cấp độ Rule / Workflow / Agent và ra quyết định Go / Not Yet / No-Go.",
            [7, 8, 9, 10, 11, 12],
            "NGÀY 2 — Xác định bài toán cho AI (trang 7–12)",
            "Never solve the problem I am asked to solve (Don Norman).",
            ["Problem Statement", "Double Diamond", "Rule", "Workflow", "Agent", "Go/No-Go"],
        ),
        n(
            "CON_D2_PROBLEM_DISCOVERY",
            "CoreConcept",
            "3 Trụ cột AI Product & Double Diamond",
            2,
            3,
            "AI Product = AI Engineering (Chip Huyen) + Product Thinking (Marty Cagan) + Design Thinking (Don Norman). Lộ trình chuẩn: Bài toán -> Quy trình vận hành -> Chỉ số đo lường -> Giải pháp AI. Đánh giá qua 4 lăng kính: Repetitive, Time-consuming, AI Advantage, User Pain Points.",
            [7, 8],
            "Ngày 2 · Mục 1–2 (trang 7–8)",
            "Bài toán -> Quy trình vận hành -> Chỉ số đo lường -> Giải pháp AI.",
            ["Double Diamond", "4 Lenses", "Product Thinking", "Design Thinking", "HCD"],
        ),
        n(
            "CON_D2_PROBLEM_CARD",
            "CoreConcept",
            "Problem Statement 9 trường & Nguyên tắc định lượng",
            2,
            3,
            "6 yếu tố bài toán (Actor, Workflow, Bottleneck, Impact, Success Metric, Boundary) + 3 yếu tố quyết định AI (Entry, Solution Level, Risk & HITL). Bắt buộc xác định Baseline -> Target -> Measurement và phân biệt Output Metric vs Input Metrics.",
            [8, 9, 11],
            "Ngày 2 · Mục 3 & 6 (trang 8–9, 11)",
            "Điểm đau chưa đo được bằng số thì không thể chứng minh giá trị của AI.",
            ["Quick Problem Card", "Baseline", "Target", "Output Metric", "Input Metric", "Eval Plan"],
        ),
        n(
            "PAT_D2_BUILD_BOOST_BUY",
            "ArchitecturePattern",
            "Chiến lược Build / Boost / Buy & 3 Cấp độ Giải pháp",
            2,
            3,
            "Build/Boost/Buy (Chip Huyen & MIT CISR 2025): Boost (dùng model sẵn + RAG/fine-tune) phổ biến nhất. Luôn ưu tiên từ cấp đơn giản nhất: Rule/Script (100% deterministic) -> LLM Workflow (Prompt Chaining, Routing, Parallelization, Orchestrator-Workers, Evaluator-Optimizer) -> Agent (tự lập kế hoạch, bắt buộc HITL & rollback).",
            [9, 10, 11],
            "Ngày 2 · Mục 4–5 (trang 9–11)",
            "Luôn bắt đầu từ cấp độ đơn giản nhất (Rule -> Workflow -> Agent).",
            ["Build Boost Buy", "Rule", "Workflow", "Agent", "Prompt Chaining", "Routing"],
        ),
        n(
            "MET_D2_GO_NOGO",
            "MetricOrFormula",
            "Khung quyết định Go / Not Yet / No-Go & 4 Trụ cột Production",
            2,
            4,
            "Production đòi hỏi Baseline, Evaluation, Controls, Operations. Ra quyết định Go / Not Yet (thiếu data hoặc chưa chuẩn hóa quy trình) / No-Go dựa trên 3 nhóm chỉ số: Tác động kinh doanh, CSAT/NPS, Ngưỡng hữu dụng (Accuracy, TTFT, TPOT, Cost).",
            [9, 10, 12],
            "Ngày 2 · Mục 4 & 6 (trang 9–10, 12)",
            "Not Yet thể hiện sự chín chắn trong tư duy sản phẩm, không phải thất bại.",
            ["Go", "Not Yet", "No-Go", "TTFT", "TPOT", "Usefulness Thresholds"],
        ),
        n(
            "ERR_D2_ANTIPATTERNS",
            "FailureOrTrap",
            "4 Anti-patterns khi khởi nguồn dự án AI",
            2,
            3,
            "Solution-first (làm chatbot/agent trước khi hiểu nút thắt), No baseline (không lượng hóa hiện trạng), No evaluation (thiếu test & đối chứng), No boundary (mập mờ phạm vi tự chủ và HITL).",
            [8],
            "Ngày 2 · Mục 2 (trang 8)",
            "Một giải pháp xuất sắc cho sai vấn đề có thể còn tệ hơn không có giải pháp.",
            ["Solution-first", "No baseline", "No evaluation", "No boundary"],
        ),

        # ================= DAY 3 (Pages 13-19) =================
        n(
            "DAY_03",
            "DayModule",
            "Ngày 3: Từ Chatbot đến Agentic Agent (ReAct Pattern)",
            3,
            1,
            "Phân biệt Bot/Chatbot/Agent, khung đánh giá Agentic Fit 15 điểm, kiến trúc 4 khối, thiết kế Tool Definition 5 phần, vòng lặp ReAct và phòng thủ 3 lớp.",
            [13, 14, 15, 16, 17, 18, 19],
            "NGÀY 3 — Từ Chatbot Đến Agentic Agent (trang 13–19)",
            "Không phải hệ thống nào dùng LLM cũng là Agent.",
            ["ReAct", "Agentic Fit", "Tool Definition", "Hybrid Pattern", "Indirect Prompt Injection"],
        ),
        n(
            "MET_D3_AGENTIC_FIT",
            "MetricOrFormula",
            "Agentic Fit Framework (Thang 15 điểm) & Chi phí Agent vs Chatbot",
            3,
            4,
            "4 tiêu chí (1–5): Multi-step Reasoning, Tool Interaction, Dynamic Decision, Long Horizon. Tổng 3 tiêu chí đầu: 0–5 (Chatbot/Rule), 6–10 (Augmented Chatbot), 11–15 (Agent). Agent đắt hơn ~4.5x ($0.0009 vs $0.0002) và chậm hơn ~4x (4–6s vs 1s).",
            [13, 17],
            "Ngày 3 · Mục 2 & 7 (trang 13, 17)",
            "Agent thường đắt hơn ~4.5 lần, chậm hơn ~4 lần và khó debug hơn.",
            ["Agentic Fit", "4.5x cost", "4x latency", "Multi-step Reasoning"],
        ),
        n(
            "PAT_D3_REACT_HYBRID",
            "ArchitecturePattern",
            "ReAct Loop, 5 Phần Tool Definition & Hybrid Production Pattern",
            3,
            3,
            "Vòng lặp Thought -> Action -> Observation. Tool Definition chuẩn 5 phần: Name (verb_noun), Description (làm gì & khi nào dùng), Parameters (type + constraints), Return format, Error modes. Triển khai Hybrid (Native Function Calling JSON + Prompt Reasoning trace) là chuẩn Production; Triage Router phân luồng Simple Chatbot / Agent / Human.",
            [14, 15, 16, 18],
            "Ngày 3 · Mục 3–5, 9 (trang 14–16, 18)",
            "Hybrid: kết hợp Function Calling JSON và prompt reasoning, chuẩn production.",
            ["ReAct", "Tool Definition", "Function Calling", "Hybrid", "Triage Router"],
        ),
        n(
            "CON_D3_SYSTEM_PROMPT_SAFEGUARDS",
            "CoreConcept",
            "System Prompt 5 phần & Safeguards chống Loop",
            3,
            3,
            "System Prompt gồm: Identity, Capabilities, Instructions, Constraints (tối đa 5 lần gọi tool, cấm bịa), Output format. Safeguards: MAX_ITERATIONS, timeout + try/except, is_duplicate_call, trần chi phí/token, fallback. 5 tiêu chí chấm trace: Reasoning quality, Tool selection, Argument correctness, Stopping optimality, Answer grounding.",
            [16, 17, 18],
            "Ngày 3 · Mục 6 & 8 (trang 16–18)",
            "Luôn đọc trace trước khi tin vào Final Answer.",
            ["MAX_ITERATIONS", "is_duplicate_call", "Trace eval", "Answer grounding"],
        ),
        n(
            "ERR_D3_INDIRECT_INJECTION",
            "FailureOrTrap",
            "Indirect Prompt Injection qua Tool Output & Phòng thủ 3 lớp",
            3,
            3,
            "Kẻ tấn công nhúng lệnh độc ẩn trong web/dữ liệu tool trả về (Slack AI 08/2024, Salesforce Agentforce 09/2025). Chặn bằng 3 lớp: Input Guard (lọc PII/injection) -> Tool Guard (sanitize, whitelist, rate limit) -> Output Guard (grounding, HITL).",
            [17],
            "Ngày 3 · Mục 7 (trang 17)",
            "Agent không chỉ nhận input từ user mà còn đọc kết quả từ nguồn ngoài không đáng tin cậy.",
            ["Indirect Prompt Injection", "Input Guard", "Tool Guard", "Output Guard"],
        ),
        n(
            "LAB_D3_REACT_RUBRIC",
            "LabDeliverable",
            "Lab #3: Chatbot Baseline vs ReAct Agent & 5 Test Cases",
            3,
            4,
            "Nộp 1 Chatbot baseline + 1 ReAct Agent (1–2 tools), 5 test cases (2 Chatbot thắng, 2 Agent thắng, 1 edge case lỗi), 1 trace đầy đủ và 1 flowchart (Rubric 100 + 10 bonus).",
            [18],
            "Ngày 3 · Mục 10 (trang 18)",
            "1 Chatbot baseline + 1 ReAct Agent cho cùng một bài toán.",
            ["Lab 3", "Chatbot baseline", "ReAct Agent", "5 test cases"],
        ),

        # ================= DAY 4 (Pages 20-25) =================
        n(
            "DAY_04",
            "DayModule",
            "Ngày 4: Prompt Engineering, Tool Calling & LangGraph",
            4,
            1,
            "Prompts as Code, cấu trúc XML chống Context Bleed, xử lý Long Context/Lost in the Middle, vòng lặp Tool Calling 4 bước và điều phối đồ thị có chu trình bằng LangGraph.",
            [20, 21, 22, 23, 24, 25],
            "NGÀY 4 — Prompt Engineering & Tool Calling (trang 20–25)",
            "Prompt là giao diện giữa ý định con người và hành vi mô hình; Tool Calling là giao diện với thế giới bên ngoài.",
            ["Prompts as Code", "XML", "Context Bleed", "Recency Bias", "Tool Calling", "LangGraph"],
        ),
        n(
            "PAT_D4_XML_DETERMINISM",
            "ArchitecturePattern",
            "Prompts as Code, XML Delimiters & Phòng chống Context Bleed",
            4,
            3,
            "Specificity beats cleverness; Prompt Determinism ép JSON Schema chuẩn. Dùng thẻ XML (<system_role>, <instructions>, <examples>, <documents>, <user_input>, <thinking>, <result>) để cô lập payload ngoài, phòng Context Bleed. Dùng cặp <bad_example>/<good_example> thay vì lệnh phủ định suông; tận dụng Recency Bias đặt câu hỏi ở cuối prompt.",
            [20, 21, 22],
            "Ngày 4 · Mục 1–2 (trang 20–22)",
            "Context Bleed xảy ra khi LLM nhầm lẫn giữa Lệnh (Instructions) và Dữ liệu (Payload).",
            ["XML", "Context Bleed", "Prompt Determinism", "Recency Bias", "Context Compression"],
        ),
        n(
            "CON_D4_SYSTEM_CONTRACT",
            "CoreConcept",
            "System Prompt 4 phần & Dynamic System Prompt",
            4,
            3,
            "Chat API là Stateless (gửi lại mảng messages mỗi lượt, System ở Index=0). Hợp đồng System Prompt gồm: Persona, Core Directives (MUST/NEVER), Capabilities, Output Contract. Dùng Python f-string/Jinja2 bơm ngữ cảnh thời gian thực; thiết kế escalation JSON (status: needs_human); tránh viết >2000 tokens.",
            [22, 23],
            "Ngày 4 · Mục 3 (trang 22–23)",
            "System Prompt chỉ phục vụ Logic nghiệp vụ và UX, KHÔNG phải là tường lửa bảo mật.",
            ["Stateless", "System Prompt", "Jinja2", "Sycophancy", "Escalation"],
        ),
        n(
            "PAT_D4_TOOL_LOOP_LANGGRAPH",
            "ArchitecturePattern",
            "Vòng lặp Tool Calling 4 bước & LangGraph (State, Nodes, Edges)",
            4,
            3,
            "Model KHÔNG tự chạy code mà chỉ sinh JSON tool_calls; app thực thi cục bộ rồi append message role='tool' kèm tool_call_id. LangGraph xây Cyclic Directed Graph gồm State (TypedDict + Reducer add_messages append-only), Nodes (Agent Node, ToolNode), Edges (Normal & Conditional should_continue), hỗ trợ Checkpointer (SQLite/Postgres) cho HITL.",
            [23, 24, 25],
            "Ngày 4 · Mục 4–5 (trang 23–25)",
            "Model KHÔNG tự chạy code; model chỉ sinh JSON yêu cầu, còn ứng dụng của bạn mới là nơi thực thi.",
            ["Tool Calling", "LangGraph", "StateGraph", "add_messages", "ToolNode", "Conditional Edge"],
        ),
        n(
            "ERR_D4_PARALLEL_AND_ORDER_BIAS",
            "FailureOrTrap",
            "Bẫy Parallel Tool Calling, Order Bias & Self-Correction",
            4,
            3,
            "Parallel Calling tăng tốc nhưng dễ gây Rate Limits và Race Conditions (Tool A xóa khi Tool B đọc). Few-shot dễ bị Order Bias ở ví dụ cuối. Luôn bọc try-except + Pydantic và trả Raw Error Message để LLM tự sửa (retry 2–3 lần).",
            [21, 24],
            "Ngày 4 · Mục 2.4 & 4.3–4.4 (trang 21, 24)",
            "Đừng giấu lỗi: gửi thẳng Raw Error Message vào tool_outputs kèm chỉ thị thử lại.",
            ["Parallel Calling", "Race Conditions", "Order Bias", "Pydantic", "Self-Correction"],
        ),

        # ================= DAY 5 (Pages 26-30) =================
        n(
            "DAY_05",
            "DayModule",
            "Ngày 5: Thiết kế Sản phẩm AI cho Sự Không Chắc Chắn",
            5,
            1,
            "Quản trị 3 lớp bất định và 4 dạng trôi hành vi, quyết định Augment vs Automate theo chi phí lỗi False Positive / False Negative, thiết kế UX Safety Net và 4-Path User Stories.",
            [26, 27, 28, 29, 30],
            "NGÀY 5 — Thiết kế sản phẩm AI cho sự không chắc chắn (trang 26–30)",
            "Prototype chỉ có happy path chưa phải là sản phẩm AI.",
            ["Uncertainty", "Augmentation", "Precision", "Recall", "Graceful Failure", "Build Slice"],
        ),
        n(
            "CON_D5_UNCERTAINTY_DRIFT",
            "CoreConcept",
            "3 Lớp Bất định, 4 Dạng Drift & Error Routing",
            5,
            3,
            "3 lớp bất định: Input, Output, Process Uncertainty. 4 dạng Production Gap xảy ra dù không đổi code: Model Update, Context Drift, User Drift, Prompt Drift. Quy trình Error Routing 4 bước: Detect -> Route -> Recover (undo/sửa trực tiếp) -> Learn (lưu edit distance, approve/reject).",
            [27],
            "Ngày 5 · Mục 3 (trang 27)",
            "Cần eval, version log và fallback ngay từ prototype đầu tiên.",
            ["Production Gap", "Context Drift", "Error Routing", "Edit Distance", "Learning Signal"],
        ),
        n(
            "MET_D5_FP_FN_COST",
            "MetricOrFormula",
            "Chi phí lỗi: Precision (Báo nhầm FP) vs Recall (Bỏ sót FN)",
            5,
            4,
            "Hỏi 'Lỗi nào đắt hơn?' trước khi tối ưu model: Báo nhầm đắt (duyệt vay, lọc email) -> ưu tiên Precision + confirmation/human review; Bỏ sót đắt (lọc nội dung trẻ em, X-quang) -> ưu tiên Recall + cảnh báo sớm; Cả hai đều đắt -> dùng Augmentation.",
            [28, 29],
            "Ngày 5 · Mục 5 Trụ 2 (trang 28–29)",
            "Không có mốc accuracy chung: 60% hữu dụng ở mức Copilot, 99.5% vẫn nguy hiểm nếu full-auto ở tác vụ rủi ro cao.",
            ["Precision", "Recall", "False Positive", "False Negative", "Automation Ladder"],
        ),
        n(
            "PAT_D5_UX_4PATHS",
            "ArchitecturePattern",
            "4 Vai trò HITL, 4-Path User Stories & Build Slice",
            5,
            3,
            "4 vai trò HITL: Reviewer, Decider, Trainer, Rescuer. Chuỗi Find -> Synthesize -> Decide: Evidence -> Insight -> Opportunity -> Build Slice (1 user, 1 task, 1 AI decision, 1 failure path). User Story đủ 4 nhánh: Happy, Low-confidence, Failure, Correction Path. Failure Taxonomy 5 tầng: Promise -> Intent -> Data/Tool -> Safety -> UX Recovery.",
            [28, 29, 30],
            "Ngày 5 · Mục 4–6 (trang 28–30)",
            "AI Product Canvas giữ sản phẩm không trôi về demo: Value, Trust, Feasibility.",
            ["Human Role Audit", "4-Path User Stories", "Build Slice", "Graceful Failure", "AI Product Canvas"],
        ),
        n(
            "CASE_D5_REAL_FAILURES",
            "CaseStudy",
            "Bài học thất bại: Google Bard, Slide AI & Air Canada",
            5,
            4,
            "Google Bard mất niềm tin/cổ phiếu vì 1 lỗi factual error; Gamma/Slide AI mất khách nếu 20% cuối khó sửa; Air Canada phải chịu trách nhiệm pháp lý khi chatbot bịa chính sách hoàn tiền.",
            [26],
            "Ngày 5 · Mục 2 (trang 26)",
            "Bot trên website là một phần của hệ thống chịu trách nhiệm pháp lý.",
            ["Google Bard", "Gamma", "Air Canada", "Factual error"],
        ),

        # ================= DAY 6 (Pages 31-37) =================
        n(
            "DAY_06",
            "DayModule",
            "Ngày 6: Data Engineering cho Agent (Ingestion, Storage, Management)",
            6,
            1,
            "Chống Silent Data Failures & Data Cascades bằng Medallion 3 tầng, SCD Type 2, chuẩn hóa NFC Unicode tiếng Việt, Fact Ledger đo Parser, Data Contract Gate, Storage Pyramid, FTS5/RRF và Gold Set Cohen's Kappa.",
            [31, 32, 33, 34, 35, 36, 37],
            "NGÀY 6 — Data Engineering cho Agent (trang 31–37)",
            "Từ tài liệu khó đến một corpus có gate, có version, truy vết được đến từng điều khoản.",
            ["Silent Data Failure", "Data Cascade", "Medallion", "SCD Type 2", "NFC", "FTS5", "RRF", "Cohen Kappa"],
        ),
        n(
            "CON_D6_4PRINCIPLES_MEDALLION",
            "CoreConcept",
            "4 Nguyên tắc Bất biến, Medallion 3 tầng & SCD Type 2",
            6,
            3,
            "Identity (doc_id + version + effective_date + sha256; không dùng source_path làm khóa), Quality Gate (Data Contract ODCS v3), Lineage (truy vết 6 bước về byte gốc), Access Pattern. Pipeline Raw (Bronze, append-only) -> Clean (Silver, Merge/Upsert lũy đẳng) -> Serve (Gold, is_current=True); đóng bản cũ bằng SCD Type 2 (effective_from, effective_to, is_current).",
            [31, 32, 35],
            "Ngày 6 · Mục 1, 3, 7 (trang 31–32, 35)",
            "Ít mà đúng luôn tốt hơn nhiều mà lẫn lộn; thêm bản sao cũ làm retriever chọn nhầm.",
            ["Identity", "Medallion", "Idempotency", "SCD Type 2", "Lineage", "Dedup"],
        ),
        n(
            "ERR_D6_HOSTILE_DOCS_UNICODE",
            "FailureOrTrap",
            "6 Bẫy Hostile Documents, Unicode NFC & Lỗi FTS5 tiếng Việt",
            6,
            3,
            "PDF scan thiếu text layer (needs_ocr), bố cục nhiều cột, bảng Word gộp/lồng, nội dung ẩn, vỏ bọc MIME/.zip, và mã hóa tiếng Việt (NFD 12 code points vs NFC 9 code points gây so khớp False). Bắt buộc gọi unicodedata.normalize('NFC', text) ngay sau decode. SQLite FTS5 mặc định remove_diacritics=1 làm 'hoàn' khớp 'hoạn' -> bắt buộc đặt tokenize='unicode61 remove_diacritics 0'.",
            [33, 34, 37],
            "Ngày 6 · Mục 4 & 6 (trang 33–34, 37)",
            "Text trích từ PDF chưa phải là dữ liệu; phải đo chất lượng parser bằng Fact Ledger.",
            ["Hostile Document", "NFC", "NFD", "Fact Ledger", "remove_diacritics 0", "OCR"],
        ),
        n(
            "PAT_D6_STORAGE_HYBRID_RRF",
            "ArchitecturePattern",
            "Storage Pyramid 4 bậc, Semantic Layer & Hybrid Search RRF",
            6,
            3,
            "Bậc 1 File+Index -> Bậc 2 SQLite/DuckDB (truy vấn có cấu trúc & version) -> Bậc 3 FTS/BM25 -> Bậc 4 Vector Index. Semantic Layer 4KB tăng Text-to-SQL ~20 điểm. Hybrid FTS + Vector gộp bằng RRF = sum(1/(60+rank)); bắt buộc tách Index Serve chỉ chứa is_current=True trước ANN để tránh bẫy Post-filtering.",
            [34, 35],
            "Ngày 6 · Mục 6 (trang 34–35)",
            "Bắt buộc phải lọc is_current = True trước khi tìm kiếm ANN và xếp hạng RRF.",
            ["Storage Pyramid", "Semantic Layer", "RRF", "Post-filtering", "Hybrid Search"],
        ),
        n(
            "MET_D6_DAMA_KAPPA",
            "MetricOrFormula",
            "6 Chiều DAMA, Data Gate & Gold Set Cohen's Kappa",
            6,
            4,
            "6 chiều DAMA UK: Accuracy, Completeness, Consistency, Timeliness, Validity, Uniqueness. Gate chặn 100% lỗi Critical (như mô hình dbt tests). Đo đồng thuận Gold Set bằng Cohen's Kappa = (p_o - p_e)/(1 - p_e), bắt buộc báo cáo kèm bảng Counts + Bootstrap 95% CI để tránh bẫy Prevalence Paradox.",
            [33, 34, 36, 37],
            "Ngày 6 · Mục 5 & 8 (trang 33–34, 36–37)",
            "Không báo cáo một con số kappa đơn độc; bắt buộc kèm Counts và Bootstrap 95%.",
            ["DAMA", "Data Contract", "Quality Gate", "Cohen Kappa", "Prevalence Paradox", "Gold Set"],
        ),
        n(
            "ERR_D6_QUASI_IDENTIFIER",
            "FailureOrTrap",
            "Bẫy Ẩn danh hóa & Quasi-identifiers (87% tái định danh)",
            6,
            3,
            "Xóa tên không phải là ẩn danh hóa: bộ (ZIP + Giới tính + Ngày sinh) đủ tái định danh 87% dân số Mỹ; 15 thuộc tính đạt 99.98%. LLM tái định danh rẻ hơn 100x và nhanh hơn 240x con người (85% Top-1). Cần Role DB SELECT tối thiểu trên tầng Serve.",
            [36, 37],
            "Ngày 6 · Mục 7 & 10 (trang 36–37)",
            "Xóa tên KHÔNG phải là ẩn danh hóa.",
            ["Quasi-identifier", "Least Privilege", "Anonymization", "RLS"],
        ),

        # ================= DAY 7 (Pages 38-48) =================
        n(
            "DAY_07",
            "DayModule",
            "Ngày 7: Toàn cảnh Kỹ thuật RAG Pipeline (6 Giai đoạn)",
            7,
            1,
            "Hệ thống hóa 120 kỹ thuật RAG qua 6 giai đoạn từ Pre-Retrieval, Retrieval, Post-Retrieval, Augmentation, Generation đến Post-Generation, đảm bảo đầu ra chính xác, an toàn, rõ nguồn.",
            [38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48],
            "NGÀY 7 — Các kỹ thuật chính trong RAG Pipeline (trang 38–48)",
            "Pipeline RAG — mỗi giai đoạn có một đầu ra kiểm tra được.",
            ["RAG", "Pre-Retrieval", "Retrieval", "Post-Retrieval", "Augmentation", "Generation", "Post-Generation"],
        ),
        n(
            "PAT_D7_PRE_RETRIEVAL",
            "ArchitecturePattern",
            "Giai đoạn 1: Pre-Retrieval (26 kỹ thuật chuẩn bị & biến đổi truy vấn)",
            7,
            3,
            "5 nhóm: (1.1) Query Normalization (chính tả, đồng nghĩa, viết tắt), (1.2) Query Understanding (intent, entity, temporal, ambiguity detection), (1.3) Query Transformation (rewriting, expansion, decomposition, multi-query, HyDE/Query2Doc), (1.4) Retrieval Planning (routing, source/method selection, filter, top-k), (1.5) Input Safety.",
            [38, 39, 40, 41],
            "Ngày 7 · Giai đoạn 1 (trang 38–41)",
            "Truy vấn thô -> Truy vấn đã tối ưu.",
            ["HyDE", "Query2Doc", "Decomposition", "Request routing", "Ambiguity detection"],
        ),
        n(
            "PAT_D7_RETRIEVAL",
            "ArchitecturePattern",
            "Giai đoạn 2: Retrieval (16 kỹ thuật tìm kiếm lai, cấu trúc & đa nguồn)",
            7,
            3,
            "3 nhóm: (2.1) Hybrid Retrieval (Lexical BM25, Semantic Vector, HNSW TOC vectorless, Knowledge-graph retrieval, Graph traversal, Parent-child small-to-big), (2.2) Structured Retrieval (Text-to-SQL, NoSQL KV, Metadata faceted, API/Warehouse), (2.3) Adaptive/Multi-source (Multi-hop, Federated, Web, Multimodal, Self-RAG/Corrective/Agentic retrieval).",
            [41, 42],
            "Ngày 7 · Giai đoạn 2 (trang 41–42)",
            "Knowledge-graph retrieval: truy xuất thông tin dựa trên mạng lưới các thực thể và mối quan hệ.",
            ["Hybrid Retrieval", "Knowledge-graph retrieval", "Parent-child", "Self-RAG", "Text-to-SQL"],
        ),
        n(
            "PAT_D7_POST_RETRIEVAL_AUGMENT",
            "ArchitecturePattern",
            "Giai đoạn 3 & 4: Post-Retrieval (20 kỹ thuật) & Augmentation (16 kỹ thuật)",
            7,
            3,
            "Post-Retrieval: Reranking/RRF, Filtering (ngưỡng/freshness/trust), Dedup & MMR, Compression (LLMLingua), Long-context reordering (chống Lost in the Middle), Contradiction detection. Augmentation: Structured XML/JSON assembly, Token-budget packing, Grounding Prep (Source tagging, Evidence IDs [Doc_1], Claim-attribution).",
            [42, 43, 44, 45],
            "Ngày 7 · Giai đoạn 3–4 (trang 42–45)",
            "Cấp mã định danh duy nhất [Doc_1], [Doc_2] và sắp xếp chống trôi thông tin ở giữa.",
            ["Reranking", "MMR", "LLMLingua", "Long-context reordering", "Evidence IDs", "Contradiction detection"],
        ),
        n(
            "PAT_D7_GEN_POSTGEN",
            "ArchitecturePattern",
            "Giai đoạn 5 & 6: Grounded Generation (23 kỹ thuật) & Post-Generation (19 kỹ thuật)",
            7,
            3,
            "Generation: Context-grounded synthesis, Cross-doc reasoning, Program-aided reasoning, JSON/Grammar constrained decoding, Inline citation & Claim-to-evidence mapping, Abstention ('Tôi không biết'). Post-Generation: Faithfulness & NLI entailment checking, Citation entailment & repair, Output Safety (PII/DLP), Critique-and-revise, LLM-as-a-judge.",
            [45, 46, 47, 48],
            "Ngày 7 · Giai đoạn 5–6 (trang 45–48)",
            "Kiểm tra ảo giác (NLI/Faithfulness) & Sửa trích dẫn -> Che PII -> LLM chấm điểm.",
            ["Abstention", "Claim-to-evidence", "NLI entailment", "Citation repair", "DLP", "LLM-as-a-judge"],
        ),

        # ================= DAY 8 (Pages 49-52) =================
        n(
            "DAY_08",
            "DayModule",
            "Ngày 8: From Workflows to Agents & Durable Execution",
            8,
            1,
            "4 mức tự chủ và cái giá token/predictability, 5 Workflow Patterns, đo độ tin cậy pass@k vs pass^k, Durable Execution với Idempotency Key, kiến trúc Multi-Agent và Autonomy in Code.",
            [49, 50, 51, 52],
            "NGÀY 8 — From Workflows to Agents (trang 49–52)",
            "Luôn chọn mức tự chủ thấp nhất vẫn vượt qua được cổng đo (gate).",
            ["Levels of Autonomy", "Workflow Patterns", "pass@k", "pass^k", "Durable Execution", "Idempotency", "Multi-Agent"],
        ),
        n(
            "CON_D8_4LEVELS_WORKFLOWS",
            "CoreConcept",
            "4 Mức Tự chủ & 5 Pattern Workflow do Code điều khiển",
            8,
            3,
            "Điểm khác biệt là ai giữ control flow. Mức 1 (1 LLM call) -> Mức 2 (Workflow, vd Stripe Minions) -> Mức 3 (Single Agent: ~4x token, lỗi cộng dồn 0.95^10 ≈ 60%) -> Mức 4 (Multi-Agent: ~15x token, vd Claude Research). 5 Workflow Patterns: Prompt Chaining, Routing, Parallelization, Orchestrator-Workers, Evaluator-Optimizer.",
            [49, 50],
            "Ngày 8 · Phần 1–2 (trang 49–50)",
            "Còn viết trước được khung thì chưa cần agent; việc tất định giao cho Code.",
            ["Four Levels of Autonomy", "Workflow", "Single Agent", "Multi-Agent", "Harness Tax"],
        ),
        n(
            "MET_D8_PASS_AT_POWER_K",
            "MetricOrFormula",
            "Harness Tax & Phân biệt pass@k vs pass^k",
            8,
            4,
            "Harness (vòng lặp, tool, context) làm chi phí chênh ~2x dù tỉ lệ đúng chênh ±2%. pass@k (đúng ≥1/k lần) dùng khi có bước test chọn lại; pass^k (đúng cả k lần liên tiếp: 0.9^8 ≈ 43%) bắt buộc cho tác vụ đi thẳng tới khách hàng/không đảo ngược. Cổng đo Gate gồm 3 số: tỉ lệ đúng, chi phí/ca, số lần chạy n + Decision Log.",
            [50],
            "Ngày 8 · Phần 3 (trang 50)",
            "Với tác vụ đi thẳng tới khách hàng hoặc thay đổi thế giới thật, bắt buộc dùng pass^k.",
            ["pass@k", "pass^k", "Harness Tax", "Gate", "Decision Log"],
        ),
        n(
            "PAT_D8_DURABLE_IDEMPOTENCY",
            "ArchitecturePattern",
            "Durable Execution, Checkpoint & Idempotency Key",
            8,
            3,
            "Tách Activity (step có thể lỗi) và Workflow (hàm điều phối tất định) với Temporal / LangGraph / DBOS. Checkpoint chỉ đảm bảo at-least-once; để đạt exactly-once cho thao tác ghi (tránh sự cố Santander UK chuyển trùng 130 triệu bảng), tool bắt buộc gắn Idempotency Key cố định + Dedupe Ledger cùng transaction.",
            [50, 51],
            "Ngày 8 · Phần 4 (trang 50–51)",
            "Engine lo việc chạy tiếp và tự thử lại; Người viết tool lo việc không thực hiện 2 lần bằng idempotency key.",
            ["Durable Execution", "Activity", "Checkpoint", "at-least-once", "Idempotency Key", "DBOS", "Temporal"],
        ),
        n(
            "PAT_D8_MULTI_AGENT_AUTONOMY_CODE",
            "ArchitecturePattern",
            "Investigator-Writer-Orchestrator & Autonomy in Code",
            8,
            3,
            "Bản chất Multi-agent là tách context; chỉ dùng khi đọc song song độc lập ('writes stay single-threaded': nhiều Investigator đọc, 1 Writer ghi, 1 Orchestrator tổng hợp). Centralized giảm khuếch đại lỗi (4.4x vs 17.2x Independent). Lời dặn trong prompt không chặn được hành động (sự cố Replit 07/2025 xóa DB prod) -> phải chặn bằng Policy Engine & Approval Event trong code.",
            [51, 52],
            "Ngày 8 · Phần 5–6 (trang 51–52)",
            "Nhiều agent đọc song song, chỉ 1 agent ghi; cơ chế chặn thật phải nằm ngoài model — đặt trong code.",
            ["Investigator Writer Orchestrator", "MAST", "MCP", "A2A", "Autonomy in Code", "Policy Engine"],
        ),

        # ================= DAY 9 (Pages 53-58) =================
        n(
            "DAY_09",
            "DayModule",
            "Ngày 9: Evaluation & Failure Analysis",
            9,
            1,
            "Quy trình chuẩn Error Analysis -> Metric -> CI Gate; xây dựng Failure Taxonomy 5 tầng; phân tầng Code/Model/Human Grader; hiệu chuẩn LLM Judge (Rogan-Gladen); Paired Bootstrap CI và Ratchet CI Gate.",
            [53, 54, 55, 56, 57, 58],
            "NGÀY 9 — Evaluation & Failure Analysis (trang 53–58)",
            "Tuyệt đối không đi ngược chiều: Error Analysis -> Thiết kế Metric -> Thiết lập CI Gate.",
            ["Error Analysis", "Failure Taxonomy", "Code Grader", "LLM Judge", "Rogan-Gladen", "Paired Bootstrap", "Ratchet"],
        ),
        n(
            "CON_D9_ERROR_ANALYSIS_5LAYERS",
            "CoreConcept",
            "Scenario-Trace-Outcome & Failure Taxonomy 5 Layers",
            9,
            3,
            "Phân biệt Scenario (input + world state + expected), Trace (bước thực thi), Outcome (DB/ledger cuối). Đọc ~30–100 trace thật (cả PASS & FAIL) -> Open coding (lỗi gốc đầu tiên) -> Axial coding (người đặt tên mode PASS/FAIL) -> 5 Layers: model/prompt, tool/schema, retrieval/context, orchestration/state, guardrail/approval.",
            [53, 54],
            "Ngày 9 · Mục 1–2 (trang 53–54)",
            "Coverage là mức rủi ro đã kiểm, không phải số lượng log; tăng scenario diversity trước khi tăng seed.",
            ["Scenario", "Trace", "Outcome", "Open coding", "Axial coding", "5 Failure Layers"],
        ),
        n(
            "PAT_D9_EVAL_HARNESS_LAYERED_GRADER",
            "ArchitecturePattern",
            "Eval Harness, Metric 4 cấp & Layered Grading (Swiss Cheese)",
            9,
            3,
            "Metric 4 cấp (Step, Trajectory, Outcome, System); tuyệt đối KHÔNG bù trừ Metric An toàn (= 0 vi phạm mọi trial) với Metric Năng lực. Ưu tiên Code Grader (tiền, state, quyền) -> Calibrated LLM Judge (1 mode/judge, critique trước JSON sau, nhị phân, Order swap & Family swap khác họ model) -> Human -> Monitoring.",
            [54, 55],
            "Ngày 9 · Mục 3–4 (trang 54–55)",
            "Thứ code kiểm được thì để code kiểm; model sinh synthetic và judge không được dùng chung một họ model.",
            ["Eval Harness", "Swiss Cheese", "Code Grader", "LLM-as-a-judge", "Family swap", "Order swap"],
        ),
        n(
            "MET_D9_ROGAN_GLADEN_BOOTSTRAP",
            "MetricOrFormula",
            "Hiệu chỉnh Rogan-Gladen & Paired Bootstrap 95% CI",
            9,
            4,
            "Hiệu chỉnh judge (held-out kappa >= 0.6, Precision >= 0.8, Recall >= 0.7): Tỉ lệ lỗi thật = (Tỉ lệ báo FAIL + Specificity - 1) / (Recall + Specificity - 1). So sánh 2 bản bằng Paired Bootstrap: gộp trung bình theo item qua các trial trước, rút hoàn lại 1000 lần trên cùng danh sách item để lập 95% CI loại trừ 0.",
            [56, 57],
            "Ngày 9 · Mục 5 & 7 (trang 56–57)",
            "Judge báo 9% FAIL nhưng Recall=0.30 thì tỉ lệ lỗi thật là 30% (pass thật ~70%, không phải 91%).",
            ["Rogan-Gladen", "Paired Bootstrap", "Confidence Interval", "Calibration", "pass^k"],
        ),
        n(
            "CON_D9_DATASETS_RATCHET_CI",
            "CoreConcept",
            "Golden/Synthetic Data, Capability vs Regression & Luật Ratchet",
            9,
            3,
            "Mọi item eval phải có provenance và tách riêng file nhãn viết tay. Capability suite (case khó) tốt nghiệp vào Regression suite (pass ~100% chặn merge PR). Luật Ratchet: trên cùng version eval set chỉ siết ngưỡng, thêm case khó phải tạo eval_set v2 và đo lại baseline.",
            [57, 58],
            "Ngày 9 · Mục 8–9 (trang 57–58)",
            "Nguyên tắc Ratchet (chỉ siết, không nới): không dời khung thành sau khi thấy kết quả.",
            ["Golden data", "Synthetic data", "Capability suite", "Regression suite", "Ratchet", "CI Gate"],
        ),

        # ================= DAY 10 (Pages 59-64) =================
        n(
            "DAY_10",
            "DayModule",
            "Ngày 10: Từ PoC đến Pilot — Stage Gate & Checklist Go-Live",
            10,
            1,
            "Thu hẹp khoảng trống Demo -> Production qua Stage Gate 1 & 2, chuẩn hóa 5 thành phần Gate và rà soát trọn vẹn 9 nhóm Checklist Go-Live theo mô hình Swiss Cheese.",
            [59, 60, 61, 62, 63, 64],
            "NGÀY 10 — Từ PoC đến Pilot & Checklist Go-Live (trang 59–64)",
            "PoC mất vài tuần, đưa lên Production mất nhiều tháng vì chất lượng, dữ liệu, bảo mật, chi phí và pháp lý.",
            ["Stage Gate", "Go-Live", "Checklist", "Red Team", "TCO", "L1-L3", "Risk Register"],
        ),
        n(
            "CON_D10_STAGE_GATE_5ELEMENTS",
            "CoreConcept",
            "5 Khoảng trống sau PoC & 5 Thành phần Stage Gate",
            10,
            3,
            "5 khoảng trống: Bộ thử đơn giản (Taco Bell 18.000 cốc nước), chi phí thiếu, lỗ hổng bảo mật mở (Salesforce 9.4/10), thiếu PIC, thiếu điều kiện dừng (CBA Úc, Who Gives A Crap). Stage Gate bắt buộc: (1) Chỉ số trên tập cố định, (2) Ngưỡng + CI (Sponsor ký trước khi đo), (3) PIC có tên, (4) Thời hạn, (5) Điều kiện dừng & quay lui. 4 quyết định: Proceed / Descope / Iterate / Stop.",
            [59, 60],
            "Ngày 10 · Mục 2–3 (trang 59–60)",
            "Dừng dự án sớm là một kết quả tích cực giúp tiết kiệm tài chính và bảo vệ uy tín.",
            ["Stage Gate", "PIC", "Sponsor", "Descope", "Stop", "Taco Bell"],
        ),
        n(
            "CON_D10_CHECKLIST_QUALITY_DATA_SEC",
            "CoreConcept",
            "Checklist Nhóm 1–4: Quality, Data, Security 8 lớp & Permissions",
            10,
            3,
            "Quality: 9 bộ dữ liệu độc lập, mỗi thử nghiệm đổi 1 biến. Data: Data Owner, re-index SLA, ACL, PII masking. Security: 8 lớp phòng thủ + Red Team 10 hạng mục (PyRIT, garak, promptfoo, DeepTeam). Permissions: Least Privilege, SSO theo user, tách Đọc/Ghi, Sandbox, Key Vault, Kill-switch.",
            [60, 61, 62],
            "Ngày 10 · Mục 4 Nhóm 1–4 (trang 60–62)",
            "Độ chính xác 80% nhưng bịa nguồn 10% rủi ro cao hơn 75% nhưng biết từ chối khi thiếu dữ kiện.",
            ["Red Teaming", "PyRIT", "garak", "promptfoo", "Least Privilege", "Kill-switch"],
        ),
        n(
            "MET_D10_INFRA_TCO_OPS",
            "MetricOrFormula",
            "Checklist Nhóm 5–9: Infra, TCO (40/60), Ops L1–L3, Pháp lý & Risk Register",
            10,
            4,
            "Load test 2x peak, Exponential backoff 429/503, Model version lock, Multi-region fallback. TCO: API model chỉ chiếm ~40% tổng ngân sách (60% là hạ tầng, giám sát, nhân sự L1-L3, đào tạo, +10% dự phòng). Ops: Langfuse/Opik, Grafana, P1/P2/P3, L1(~15p)-L2(~1h)-L3. Báo cáo Go/No-Go tuyệt đối không làm tròn số (0.78 vs 0.80).",
            [62, 63, 64],
            "Ngày 10 · Mục 4 Nhóm 5–9 (trang 62–64)",
            "Chi phí gọi API mô hình thông thường chỉ chiếm khoảng 40% tổng ngân sách vận hành.",
            ["TCO", "40%", "Load Testing", "Langfuse", "L1-L3", "Risk Register", "Shadow mode"],
        ),
        n(
            "ERR_D10_SEVEN_MYTHS",
            "FailureOrTrap",
            "7 Hiểu lầm Go-Live & 5 Nguyên tắc Báo cáo Trung thực",
            10,
            3,
            "Tránh 7 hiểu lầm: Demo tốt = sẵn sàng Go-live; Risk Register chỉ là thủ tục; Dừng dự án là thất bại; 0.81 > 0.80 trên 1 lần chạy là Đạt; Chatbot sai là lỗi công nghệ (doanh nghiệp chịu trách nhiệm pháp lý như Air Canada); Dùng API không cần lo hạ tầng.",
            [63, 64],
            "Ngày 10 · Mục 5 (trang 63–64)",
            "Tuyệt đối không làm tròn hoặc làm mềm số liệu: báo cáo chính xác 0.78 so với ngưỡng 0.80.",
            ["Air Canada", "7 hiểu lầm", "Go/No-Go", "Risk Register", "API Tier 429"],
        ),

        # ================= DAY 11 (Pages 65-73) =================
        n(
            "DAY_11",
            "DayModule",
            "Ngày 11: Guardrails, HITL & Responsible AI",
            11,
            1,
            "Phòng thủ kiến trúc chống Prompt Injection (Lethal Trifecta, CaMeL), Guardrails 3 tầng Input/LLM/Output, Durable HITL trong LangGraph/Temporal, Human Factors và Luật PDPL 91/2025 + Luật AI 134/2025.",
            [65, 66, 67, 68, 69, 70, 71, 72, 73],
            "NGÀY 11 — Guardrails, HITL & Responsible AI (trang 65–73)",
            "Agent không có guardrails giống như xe không có phanh — càng nhanh càng nguy hiểm.",
            ["Guardrails", "HITL", "Lethal Trifecta", "CaMeL", "interrupt", "Automation Bias", "PDPL", "Luật AI 134"],
        ),
        n(
            "ERR_D11_OWASP_MISALIGNMENT",
            "FailureOrTrap",
            "OWASP Top 10, Agentic Misalignment & Attack Vectors",
            11,
            3,
            "6 rủi ro chính + OWASP LLM01–LLM10 & ASI01–ASI10; sự cố leo thang sang zero-click data exfiltration (EchoLeak CVE-2025-32711, GeminiJack, Chevrolet $1 bot, DPD). 3 dấu hiệu Misalignment: Reward Hacking, Deceptive Alignment, Instrumental Convergence. 4 kỹ thuật Jailbreak: Roleplay, Multi-turn, Encoding Bypass, Language Switch.",
            [65, 66],
            "Ngày 11 · Mục 1–4 (trang 65–66)",
            "Không vụ nào thất bại vì model kém — tất cả thất bại vì thiếu lớp kiểm soát.",
            ["OWASP", "EchoLeak", "GeminiJack", "Reward Hacking", "Jailbreak", "PII Extraction"],
        ),
        n(
            "PAT_D11_DEFENSE_TRIFECTA_CAMEL",
            "ArchitecturePattern",
            "Defense-in-Depth 3 tầng, The Lethal Trifecta & CaMeL Dual-LLM",
            11,
            3,
            "Filter đơn lẻ bị vượt qua (emoji smuggling 100% ASR, Unicode đảo chiều 99% ASR) -> phòng thủ bằng kiến trúc: Spotlighting (Microsoft, ASR <2%), Instruction Hierarchy (system > user > model > tool), CaMeL Dual-LLM (Privileged vs Quarantined LLM). Quy tắc vàng Lethal Trifecta: tuyệt đối không cấp đủ (1) Private Data + (2) Untrusted Content + (3) External Comms cho cùng 1 agent.",
            [66, 67, 68],
            "Ngày 11 · Mục 5–8 (trang 66–68)",
            "Tuyệt đối không cấp đủ cả 3 yếu tố Lethal Trifecta cho cùng một agent.",
            ["Lethal Trifecta", "CaMeL", "Spotlighting", "Prompt Guard 2", "Llama Guard", "NeMo Guardrails"],
        ),
        n(
            "PAT_D11_DURABLE_HITL_ROUTING",
            "ArchitecturePattern",
            "Durable HITL (interrupt + PostgresSaver) & Ma trận Định tuyến",
            11,
            3,
            "if confidence < 0.7 không phải HITL vì mất state khi restart. LangGraph dùng interrupt() + Command(resume=...) + PostgresSaver: CẢNH BÁO node chứa interrupt() chạy lại TỪ ĐẦU khi resume -> tách side effect sang node sau; Idempotent resume & Fail-closed khi timeout. Thứ tự định tuyến: (1) Khả năng hoàn tác -> (2) Giá trị -> (3) Grounding/Tool fail -> (4) Calibrated Confidence.",
            [68, 69],
            "Ngày 11 · Mục 11–12 (trang 68–69)",
            "Confidence score xếp cuối; trục khả năng hoàn tác quan trọng hơn trục tác động.",
            ["Durable HITL", "interrupt", "PostgresSaver", "Fail-closed", "Reversibility", "Audit Trail"],
        ),
        n(
            "ERR_D11_AUTOMATION_BIAS_FATIGUE",
            "FailureOrTrap",
            "Ironies of Automation, Automation Bias & Alert Fatigue",
            11,
            3,
            "Hệ thống đúng 98% làm người duyệt mất kỹ năng ở ca sai 501; Automation Bias (Omission & Commission — thêm người duyệt 2 không cứu được); Alert Fatigue (92.9% cảnh báo bị bỏ qua); Moral Crumple Zone. Khắc phục: giảm false positive trước, hiển thị đủ 5 mục ngay tại màn duyệt, chèn ca sai cài sẵn.",
            [70],
            "Ngày 11 · Mục 13 (trang 70)",
            "'Có người duyệt' không đồng nghĩa với 'có giám sát'.",
            ["Ironies of Automation", "Automation Bias", "Alert Fatigue", "Moral Crumple Zone"],
        ),
        n(
            "CON_D11_LEGAL_VN_EU_2026",
            "CoreConcept",
            "Responsible AI, PDPL 91/2025, Luật AI 134/2025 & EU AI Act",
            11,
            3,
            "Allocative Harm vs Representational Harm (Counterfactual test). VN: PDPL 91/2025 (hiệu lực 1/1/2026, thông báo vi phạm 72h, miễn DPIA/DPO 5 năm cho startup nhỏ không xử lý dữ liệu nhạy cảm); Luật AI 134/2025 (hiệu lực 1/3/2026, 3 mức rủi ro, watermark, biến HITL thành nghĩa vụ pháp lý). EU AI Act Điều 2 áp dụng xuyên biên giới ngay khi đầu ra được dùng tại EU.",
            [70, 71, 72],
            "Ngày 11 · Mục 14–18 (trang 70–72)",
            "Việt Nam đã có hiệu lực cả PDPL 91/2025 và Luật AI 134/2025 — biến HITL thành nghĩa vụ pháp lý.",
            ["PDPL 91/2025", "Luật AI 134/2025", "EU AI Act", "Fairness", "Model Card", "System Card"],
        ),

        # ================= DAY 12 (Pages 74-80) =================
        n(
            "DAY_12",
            "DayModule",
            "Ngày 12: Deployment — Đưa Agent Lên Cloud",
            12,
            1,
            "Đóng gói Docker 2026 (uv + python:3.12-slim + Trivy), giải quyết timeout bằng SSE/Async Job, đẩy State ra Redis/Postgres, API Gateway Cost-Guard, Caching, Saga & Sandbox Fail-closed.",
            [74, 75, 76, 77, 78, 79, 80],
            "NGÀY 12 — Deployment: Đưa Agent Lên Cloud (trang 74–80)",
            "Từ localhost đến production URL.",
            ["Docker", "uv", "SSE", "Cloud Run", "Cost-Guard", "Prompt Cache", "Saga", "Sandbox"],
        ),
        n(
            "PAT_D12_DOCKER_2026",
            "ArchitecturePattern",
            "3 Đặc tính phá vỡ Web & Tiêu chuẩn Docker 2026",
            12,
            3,
            "Agent Long-running (10-60s+ vượt timeout 29s API Gateway), Stateful, tốn token siêu tuyến tính (50–1000x). Pin exact Model ID & tắt auto-upgrade. Docker multi-stage + `uv --locked` (nhanh hơn pip 10x), base `python:3.12-slim` (~150MB) hoặc `distroless`, TRÁNH `alpine` (musl libc build chậm 52x), chạy `USER app`, quét Trivy, xuất SBOM. Endpoints: `/healthz`, `/chat` SSE.",
            [74, 75],
            "Ngày 12 · Mục 1 (trang 74–75)",
            "Tránh python:3.12-alpine vì musl libc làm thời gian build chậm hơn ~52 lần.",
            ["Dockerfile", "uv", "python:3.12-slim", "alpine", "Trivy", "SBOM", "Model pin"],
        ),
        n(
            "PAT_D12_TIMEOUT_SSE_TIERS",
            "ArchitecturePattern",
            "Chiến lược SSE, Async Job, Remote MCP & 4 Tầng Cloud",
            12,
            3,
            "SSE Stream (`EventSourceResponse`, byte đầu <30s, `X-Accel-Buffering: no`, heartbeat ~15s) hoặc Submit-and-poll / Batch API (-50% giá). Đẩy state ra Redis/PostgresSaver; dùng `async def` không chặn luồng. Cloud Tiers: Tier 0 (Bedrock/Vertex), Tier 1 (Railway/Render/Fly), Tier 2 (Cloud Run 60p/ECS Fargate), Tier 3 (K8s); tránh Serverless Vercel timeout ngắn. Remote MCP dùng Streamable HTTP `/mcp` + OAuth 2.1 PKCE.",
            [75, 76, 77],
            "Ngày 12 · Mục 2 (trang 75–77)",
            "Đẩy toàn bộ state ra bộ lưu trữ ngoài; không dùng sticky session.",
            ["SSE", "EventSourceResponse", "Async Job", "Batch API", "Cloud Run", "Remote MCP", "OAuth 2.1"],
        ),
        n(
            "PAT_D12_GATEWAY_CACHE_SERVING",
            "ArchitecturePattern",
            "API Gateway Cost-Guard, Caching & Frontier Serving",
            12,
            3,
            "API Gateway: Auth (X-API-Key/JWT/OAuth) -> Rate Limiter -> Input & Budget Check (`MAX_USD_PER_REQ`, Circuit Breaker chống vòng lặp $47k/11 ngày). Scale ngang theo Concurrency/Queue (KEDA/Knative), `SIGTERM` Graceful Shutdown. Prompt Cache (đặt nội dung tĩnh lên đầu giảm ~90% Anthropic / ~50% OpenAI), Semantic Cache, Continuous batching (36.9x), PagedAttention (vLLM).",
            [77, 78, 79],
            "Ngày 12 · Mục 3–4 (trang 77–79)",
            "Monthly budget trên OpenAI chỉ cảnh báo chứ không tự ngắt — phải làm pre-call admission control.",
            ["API Gateway", "Cost-Guard", "Circuit Breaker", "Prompt Cache", "PagedAttention", "CI/CD Eval Gate"],
        ),
        n(
            "PAT_D12_SAGA_EGRESS_SANDBOX",
            "ArchitecturePattern",
            "Mô hình Saga, Egress Control & Sandbox Fail-closed",
            12,
            3,
            "Chống retry mù quáng bằng Idempotency-Key (`Redis SET_NX + TTL`) và so khớp ngữ nghĩa. Saga: có bước bù trừ (undo), đặt pivot action không đảo ngược ở cuối kèm HITL. Chặn rò rỉ bằng Egress Control + Sandbox (gVisor, Firecracker/E2B, V8 Isolates) thiết kế **Fail-closed** (lỗi là đóng truy cập, bài học CVE-2025-66479).",
            [79],
            "Ngày 12 · Mục 4 (trang 79)",
            "Thiết kế hệ thống theo nguyên tắc Fail-closed thay vì Fail-open.",
            ["Saga", "Idempotency-Key", "Egress Control", "Sandbox", "Fail-closed"],
        ),

        # ================= DAY 13 (Pages 81-88) =================
        n(
            "DAY_13",
            "DayModule",
            "Ngày 13: Launch & Economics — Cost-of-Pass & Controlled Pilot",
            13,
            1,
            "Tính chi phí thật mỗi việc thành công (Cost-of-Pass), 4 đòn bẩy giảm chi phí, so sánh Build vs Buy, đánh giá thành công 3 tầng, 5 loại lỗi Google PAIR và thiết kế Pilot có đối chứng trình Gate 2a.",
            [81, 82, 83, 84, 85, 86, 87, 88],
            "NGÀY 13 — Launch & Economics (trang 81–88)",
            "Có xứng đáng triển khai AI Agent không?",
            ["Cost-of-Pass", "Human Review", "Rework", "Build vs Buy", "3-Tier Success", "Google PAIR", "Pilot", "Peeking problem"],
        ),
        n(
            "MET_D13_COST_OF_PASS",
            "MetricOrFormula",
            "Công thức Cost-of-Pass (ICLR 2026) & Nghịch lý Chọn Model",
            13,
            4,
            "Cost-of-Pass = (Token + Tool + Retry + Human Review + Rework) / Số việc thành công. Tại LogiX-VN: hóa đơn API chỉ 360 đ/ca nhưng chi phí thật tới 3.940 đ/việc (gấp 11 lần, >85% nằm ở Review & Rework). 4 hướng giảm chi phí (ưu tiên 1-3 trước): (1) Ít sai hơn (model chuẩn hơn có thể RẺ hơn theo Cost-of-Pass), (2) Ít kiểm tra hơn, (3) Routing tách 85% ca dễ cho AI / 15% ca khó cho người (hạ từ 3.940 đ -> 2.220 đ), (4) Prompt cache/Batch.",
            [81, 82],
            "Ngày 13 · Phần 1 (trang 81–82)",
            "Hơn 85% chi phí nằm ở thời gian nhân viên; giảm 1 phút xem lại tiết kiệm hơn đổi model rẻ một nửa.",
            ["Cost-of-Pass", "3.940 đ", "Routing", "Sensitivity Analysis", "Retry"],
        ),
        n(
            "CON_D13_BUILD_BUY_3TIERS",
            "CoreConcept",
            "Build vs Buy, Bẫy hợp đồng & 3 Tầng Đánh giá Thành công",
            13,
            3,
            "Mua SaaS giá Mỹ ($0.99/lượt ≈ 25.300đ) đắt hơn nhân viên VN (12.000đ) ~2x, trong khi Tự làm ~3.940đ + 40M cố định. Cảnh giác bẫy 'giải quyết giả định' và kịch bản giá token tăng 2x. Đo đủ 3 tầng + An toàn: Tầng 1 Adoption (tránh người dùng ảo bỏ qua 80% gợi ý như UK Copilot) -> Tầng 2 Task Performance -> Tầng 3 Business Impact (tránh Klarna cắt quá đà); chọn trước 1 Primary Metric.",
            [83, 84, 85],
            "Ngày 13 · Phần 2–3 (trang 83–85)",
            "Đo đủ cả 3 tầng vì tầng dưới tốt không bảo đảm tầng trên tốt.",
            ["Build vs Buy", "Adoption", "Task Performance", "Business Impact", "Primary Metric", "Klarna"],
        ),
        n(
            "ERR_D13_GOOGLE_PAIR_5ERRORS",
            "FailureOrTrap",
            "5 Loại lỗi Google PAIR & Lỗi ngầm (Silent Error)",
            13,
            3,
            "(1) Lỗi người dùng, (2) Lỗi hệ thống, (3) Lỗi ngữ cảnh, (4) Giới hạn hệ thống, (5) Lỗi ngầm (cả người và hệ thống không nhận ra, vd hoàn thiếu 5% đơn quốc tế nhiều tuần) — chỉ phát hiện bằng kiểm tra lấy mẫu QA định kỳ (2%/tuần). Gắn nhãn trace lỗi bởi 2 người độc lập đạt đồng thuận >= 80%.",
            [85, 86],
            "Ngày 13 · Phần 4 (trang 85–86)",
            "Lỗi ngầm chỉ phát hiện bằng kiểm tra lấy mẫu định kỳ (vd: 2% yêu cầu/tuần).",
            ["Google PAIR", "Lỗi ngầm", "Silent Error", "QA sampling", "Cursor Sam", "NYC MyCity"],
        ),
        n(
            "PAT_D13_CONTROLLED_PILOT",
            "ArchitecturePattern",
            "Thiết kế Controlled Pilot, Chống Peeking & Hồ sơ Gate 2a",
            13,
            3,
            "3 câu hỏi Pilot: (1) Nhóm đối chứng ngẫu nhiên 50/50 cùng tệp/thời gian (không so cụm depot), (2) Cỡ mẫu (~1.500 ca/nhóm) & thời gian tối thiểu 4 tuần, (3) Ngưỡng dừng khẩn cấp trao quyền trưởng ca & chống Peeking problem (xem p<0.05 mỗi ngày đẩy dương tính giả từ 5% lên ~26%). Bộ hồ sơ Gate 2a gồm 7 hạng mục + `pilot_plan.yaml`.",
            [86, 87],
            "Ngày 13 · Phần 5–7 (trang 86–87)",
            "Giữa chừng chỉ xem chỉ số an toàn; chỉ ra quyết định vào đúng ngày Gate 2 đã chốt.",
            ["Controlled Pilot", "Peeking problem", "Gate 2a", "pilot_plan.yaml", "LogiX-VN"],
        ),
    ]

    edges: list[dict[str, Any]] = []

    # Intra-day CONTAINS edges (tree hierarchy from DayModule -> child nodes)
    for node in nodes:
        if node["type"] != "DayModule":
            day_id = f"DAY_{node['day']:02d}"
            edges.append(e(day_id, node["id"], "CONTAINS", 1.0))

    # Cross-day Lineage & Dependency edges
    cross_edges = [
        ("CON_D1_TAXONOMY", "PAT_D2_BUILD_BOOST_BUY", "EVOLVES_INTO", 0.95),
        ("ERR_D1_LLM_LIMITS", "PAT_D4_XML_DETERMINISM", "MITIGATES_FAILURE", 0.9),
        ("ERR_D1_LLM_LIMITS", "PAT_D7_POST_RETRIEVAL_AUGMENT", "MITIGATES_FAILURE", 0.95),
        ("MET_D1_TOKEN_ECONOMY", "MET_D13_COST_OF_PASS", "PREREQUISITE_OF", 0.9),
        ("CON_D2_PROBLEM_CARD", "PAT_D5_UX_4PATHS", "PREREQUISITE_OF", 0.9),
        ("PAT_D2_BUILD_BOOST_BUY", "MET_D3_AGENTIC_FIT", "EVOLVES_INTO", 0.95),
        ("PAT_D2_BUILD_BOOST_BUY", "CON_D8_4LEVELS_WORKFLOWS", "EVOLVES_INTO", 0.95),
        ("PAT_D3_REACT_HYBRID", "PAT_D4_TOOL_LOOP_LANGGRAPH", "EVOLVES_INTO", 0.95),
        ("ERR_D3_INDIRECT_INJECTION", "PAT_D11_DEFENSE_TRIFECTA_CAMEL", "MITIGATES_FAILURE", 1.0),
        ("PAT_D4_TOOL_LOOP_LANGGRAPH", "PAT_D8_DURABLE_IDEMPOTENCY", "EVOLVES_INTO", 0.95),
        ("PAT_D4_TOOL_LOOP_LANGGRAPH", "PAT_D11_DURABLE_HITL_ROUTING", "PREREQUISITE_OF", 0.95),
        ("CON_D5_UNCERTAINTY_DRIFT", "CON_D9_ERROR_ANALYSIS_5LAYERS", "PREREQUISITE_OF", 0.9),
        ("MET_D5_FP_FN_COST", "MET_D9_ROGAN_GLADEN_BOOTSTRAP", "MEASURED_BY", 0.9),
        ("CON_D6_4PRINCIPLES_MEDALLION", "PAT_D7_RETRIEVAL", "PREREQUISITE_OF", 0.95),
        ("PAT_D6_STORAGE_HYBRID_RRF", "PAT_D7_POST_RETRIEVAL_AUGMENT", "PREREQUISITE_OF", 0.95),
        ("ERR_D6_HOSTILE_DOCS_UNICODE", "PAT_D7_PRE_RETRIEVAL", "MITIGATES_FAILURE", 0.9),
        ("PAT_D7_GEN_POSTGEN", "PAT_D11_DEFENSE_TRIFECTA_CAMEL", "PREREQUISITE_OF", 0.9),
        ("MET_D8_PASS_AT_POWER_K", "MET_D9_ROGAN_GLADEN_BOOTSTRAP", "MEASURED_BY", 0.95),
        ("PAT_D8_DURABLE_IDEMPOTENCY", "PAT_D12_SAGA_EGRESS_SANDBOX", "EVOLVES_INTO", 0.95),
        ("CON_D9_DATASETS_RATCHET_CI", "CON_D10_STAGE_GATE_5ELEMENTS", "PREREQUISITE_OF", 0.95),
        ("PAT_D9_EVAL_HARNESS_LAYERED_GRADER", "MET_D13_COST_OF_PASS", "MEASURED_BY", 0.85),
        ("CON_D10_STAGE_GATE_5ELEMENTS", "PAT_D13_CONTROLLED_PILOT", "PREREQUISITE_OF", 0.95),
        ("MET_D10_INFRA_TCO_OPS", "PAT_D12_GATEWAY_CACHE_SERVING", "PREREQUISITE_OF", 0.9),
        ("CON_D11_LEGAL_VN_EU_2026", "CON_D10_CHECKLIST_QUALITY_DATA_SEC", "PREREQUISITE_OF", 0.9),
        ("CASE_D5_REAL_FAILURES", "CON_D11_LEGAL_VN_EU_2026", "ILLUSTRATED_BY", 0.85),
        ("ERR_D13_GOOGLE_PAIR_5ERRORS", "CON_D9_ERROR_ANALYSIS_5LAYERS", "MITIGATES_FAILURE", 0.9),
    ]
    for src, tgt, rel, w in cross_edges:
        edges.append(e(src, tgt, rel, w))

    return {"version": KG_VERSION, "nodes": nodes, "edges": edges}


def validate_kg(kg: dict[str, Any]) -> None:
    """Validate Knowledge Graph structural integrity, NFC compliance, and page bounds."""
    assert kg.get("version") == KG_VERSION, "Invalid KG version"
    nodes = kg.get("nodes", [])
    edges = kg.get("edges", [])
    assert nodes, "KG nodes cannot be empty"

    ids: set[str] = set()
    days_present: set[int] = set()
    for node in nodes:
        nid = node["id"]
        assert nid not in ids, f"Duplicate node id: {nid}"
        ids.add(nid)

        assert node["type"] in VALID_TYPES, f"Invalid type on {nid}: {node['type']}"
        assert 1 <= node["day"] <= 13, f"Invalid day on {nid}: {node['day']}"
        days_present.add(node["day"])

        pages = node["provenance"]["pdf_pages"]
        assert pages and all(1 <= p <= 88 for p in pages), f"Invalid pdf_pages on {nid}: {pages}"

        for field_val in (node["label"], node["summary"], node["provenance"]["section_ref"]):
            assert field_val == unicodedata.normalize("NFC", field_val), f"Non-NFC string in {nid}"

    assert days_present == set(range(1, 14)), f"Missing days: {set(range(1, 14)) - days_present}"

    for edge in edges:
        assert edge["source"] in ids, f"Dangling edge source: {edge['source']}"
        assert edge["target"] in ids, f"Dangling edge target: {edge['target']}"
        assert edge["relation"] in VALID_RELATIONS, f"Invalid relation: {edge['relation']}"


def main() -> Path:
    kg = build_knowledge_graph()
    validate_kg(kg)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(kg, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Built & validated KG: {len(kg['nodes'])} nodes, {len(kg['edges'])} edges -> {OUTPUT_PATH}")
    return OUTPUT_PATH


if __name__ == "__main__":
    main()
