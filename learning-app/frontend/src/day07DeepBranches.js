// Deep structured L2 -> L3 branches & focused inspector details for Day 7
// Combines AI20K course KG (PDF pp. 38-48), Day 07 Lab (M01-M04), and verified external references.

export const DAY7_DEEP_BRANCHES = {
  PAT_D7_PRE_RETRIEVAL: [
    {
      label: '1.1 Chuẩn hóa & Hiểu truy vấn',
      leaves: [
        'Query Normalization: sửa chính tả, mở rộng viết tắt & từ đồng nghĩa trước khi tìm (Tr.38)',
        'Intent & Entity Extraction: tách ý định, thực thể chính & mốc thời gian để gắn bộ lọc metadata',
        'Ambiguity Detection (G10): phát hiện câu hỏi mơ hồ/thiếu ngữ cảnh → hỏi lại thay vì tìm bừa',
      ],
    },
    {
      label: '1.2 Biến đổi truy vấn',
      leaves: [
        'Multi-Query (RAG-Fusion): sinh 3–5 cách diễn đạt khác nhau để tăng độ phủ tìm kiếm (recall)',
        'HyDE: LLM viết đoạn trả lời giả định rồi embed đoạn đó để thu hẹp khoảng cách câu hỏi–tài liệu',
        'Query Decomposition: tách câu hỏi phức tạp nhiều vế (multi-hop) thành các câu hỏi con song song',
        'Step-Back Prompting: nâng câu hỏi hẹp lên nguyên lý tổng quát để lấy đủ bối cảnh nền',
      ],
    },
    {
      label: '1.3 Lập kế hoạch & An toàn',
      leaves: [
        'Query Routing: điều hướng đúng kho (Vector cho ngữ nghĩa, BM25 cho mã lỗi, SQL cho số liệu)',
        'Metadata Filter & Top-k: khóa bộ lọc ngày/nguồn và chọn top_k phù hợp ngân sách token',
        'Input Safety: chặn Prompt Injection và ẩn PII ngay trước khi truy vấn chạm vào kho dữ liệu',
      ],
    },
  ],

  PAT_D7_RETRIEVAL: [
    {
      label: '2.1 Tìm kiếm lai (Hybrid)',
      leaves: [
        'Lexical BM25: khớp chính xác từ khóa, mã lỗi, tên hàm/ID mà tìm kiếm vector hay bỏ sót',
        'Dense Vector Search: tìm theo nghĩa tương đồng (đồng nghĩa, diễn đạt khác) qua embedding',
        'Contextual Retrieval (Anthropic): gắn tiêu đề ngữ cảnh 50–100 token của cả tài liệu vào đầu mỗi chunk',
        'Parent-Child (Small-to-Big): tìm trên chunk con nhỏ (100–200 token), nạp chunk cha lớn vào prompt',
      ],
    },
    {
      label: '2.2 Đồ thị & Có cấu trúc',
      leaves: [
        'Knowledge-Graph Retrieval (GraphRAG): truy vết theo thực thể & quan hệ nhiều bước (Tr.41–42)',
        'Structured Retrieval (Text-to-SQL / Metadata): truy vấn bảng & bộ lọc có cấu trúc cho số liệu chính xác',
      ],
    },
    {
      label: '2.3 Truy xuất thích nghi',
      leaves: [
        'Self-RAG: mô hình tự phản tư quyết định khi nào cần tìm và tự kiểm độ liên quan của chunk',
        'CRAG (Corrective RAG): chấm chất lượng kết quả tìm; nếu nhiễu/thiếu thì mở rộng tìm hoặc lọc bỏ',
        'Agentic Multi-hop (Lab M02): run_agent lặp tìm bổ sung trong giới hạn step budget & giữ ID nguồn',
      ],
    },
  ],

  PAT_D7_POST_RETRIEVAL_AUGMENT: [
    {
      label: '3.1 Gộp hạng & Rerank',
      leaves: [
        'RRF (Reciprocal Rank Fusion): gộp BM25 + Vector theo thứ hạng Σ 1/(60 + rank), không cần chuẩn hóa điểm',
        'Cross-Encoder Reranking: chấm chéo trực tiếp cặp (Query, Chunk) từ top 30–50 xuống top 3–5 đoạn tốt nhất',
        'Dedup & MMR: loại đoạn trùng lặp và cân bằng độ liên quan với độ đa dạng ngữ cảnh',
      ],
    },
    {
      label: '3.2 Nén & Chống trôi giữa',
      leaves: [
        'Contextual Compression (LLMLingua): cắt bỏ câu thừa/boilerplate để tiết kiệm token & giảm nhiễu',
        'Chống Lost in the Middle (Liu et al.): đặt đoạn quan trọng nhất ở ĐẦU và CUỐI prompt (Bookending)',
        'Contradiction Detection: phát hiện nguồn cũ–mới mâu thuẫn nhau trước khi sinh câu trả lời',
      ],
    },
    {
      label: '4.1 Đóng gói Context (Lab M02)',
      leaves: [
        'Token-Budget Packing (pack_context): chọn đoạn đúng hạn mức token & trả kèm danh sách ID đã dùng',
        'Structured XML/JSON Assembly: bọc tài liệu bằng thẻ <doc id="Doc_1"> tách dữ liệu khỏi chỉ thị hệ thống',
        'Evidence IDs [Doc_1]: cấp mã định danh duy nhất cho từng đoạn để bắt buộc trích dẫn & kiểm chứng',
      ],
    },
  ],

  PAT_D7_GEN_POSTGEN: [
    {
      label: '5.1 Sinh bám nguồn (Grounded)',
      leaves: [
        'Context-Grounded Synthesis: chỉ tổng hợp từ đoạn đã nạp, không tự suy diễn từ trí nhớ tham số',
        'Inline Citation & Claim-to-Evidence: gắn [Doc_1] ngay sau từng khẳng định để người dùng & code kiểm chéo',
        'JSON / Grammar Constrained Decoding: ép đầu ra đúng schema JSON để hậu kiểm không vỡ định dạng',
        'Abstention ("Tôi không biết"): từ chối rõ ràng khi ngữ cảnh thiếu bằng chứng thay vì bịa (Tr.46)',
      ],
    },
    {
      label: '6.1 Hậu kiểm & An toàn',
      leaves: [
        'NLI Entailment & Citation Repair: kiểm từng khẳng định có được [Doc_i] hậu thuẫn không & sửa trích dẫn sai',
        'Output Safety (PII / DLP): quét và che dữ liệu cá nhân/nhạy cảm trước khi hiển thị đầu ra',
        'Critique-and-Revise: tự rà soát câu trả lời đối chiếu với rubric trước khi xuất bản cuối',
      ],
    },
    {
      label: '6.2 Đo lường RAG (RAGAS & M04)',
      leaves: [
        'Context Precision & Recall (RAGAS): đo đoạn đúng có đứng đầu danh sách và có lấy đủ bằng chứng không',
        'Faithfulness (Groundedness): tỷ lệ khẳng định bám sát 100% context đã cấp (1.0 = 0 ảo giác)',
        'Tách lỗi Tìm vs Dùng (Lab M03–M04): đọc trace & Hit@k để biết sai do retriever hay do LLM tổng hợp',
      ],
    },
  ],
};

// Focused deep-dive details shown in the right Inspector Drawer when clicking a specific L3 leaf
const DAY7_LEAF_DETAILS_BY_PREFIX = {
  'Query Normalization': {
    problem: 'Người dùng gõ sai chính tả, dùng từ viết tắt ("CP2", "RAG", "eval") khiến tìm kiếm từ khóa BM25 bị trượt.',
    mechanism: 'Chuẩn hóa Unicode NFC, sửa lỗi chính tả phổ biến và mở rộng từ viết tắt/đồng nghĩa trước khi đưa vào retriever.',
    example: '"kết quả cp2 ngày 7" → chuẩn hóa thành "checkpoint 2 ngày 7 Retrieval Context Engineering".',
    source: 'Giáo trình AI20K · Ngày 7 Tr.38',
  },
  'Intent & Entity Extraction': {
    problem: 'Tìm kiếm trên toàn kho tài liệu 14 ngày dễ lẫn khái niệm cùng tên giữa các ngày khác nhau.',
    mechanism: 'Trích xuất ý định (hỏi định nghĩa, so sánh, sửa lỗi), thực thể chính và mốc ngày/thời gian để gắn bộ lọc metadata.',
    example: 'Tách được entity="pack_context", day=7 → chỉ lọc chunk thuộc Day 07 thay vì quét cả 14 ngày.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.38–39',
  },
  'Ambiguity Detection': {
    problem: 'Câu hỏi quá ngắn hoặc mơ hồ (vd: "Mình bị lỗi ở CP2") khiến RAG kéo về nhầm bài và trả lời lệch.',
    mechanism: 'Phát hiện thiếu trường bắt buộc (ngày học, checkpoint, thông báo lỗi) → kích hoạt nhánh hỏi lại (nguyên tắc HAX G10).',
    example: 'Ca B12 trong benchmark của nhóm: thay vì đoán bừa 1 ngày, hệ thống hỏi lại học viên đang làm CP2 của Ngày nào.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.39 · HAX G10',
  },
  'Multi-Query': {
    problem: 'Một cách hỏi duy nhất của người dùng thường lệch từ vựng so với cách viết trong tài liệu gốc.',
    mechanism: 'Dùng LLM nhanh sinh 3–5 biến thể câu hỏi từ các góc nhìn khác nhau, chạy tìm kiếm song song rồi gộp kết quả bằng RRF.',
    example: 'Hỏi "chống bịa nguồn" → sinh thêm "citation grounding", "hallucination check RAG", "faithfulness verification".',
    source: 'Giáo trình AI20K · Tr.39–40 · Mở rộng: RAG-Fusion / LangChain',
  },
  'HyDE': {
    problem: 'Câu hỏi ngắn của người dùng khác rất xa về mặt vector so với đoạn văn bản giải thích dài trong kho tài liệu.',
    mechanism: 'Nhờ LLM sinh trước 1 đoạn trả lời giả định (có thể chưa chính xác tuyệt đối), rồi embed đoạn giả định đó để tìm đoạn thật giống nhất.',
    example: 'Hỏi "RRF là gì?" → HyDE viết 1 đoạn giải thích công thức gộp hạng → vector đoạn này khớp sát với trang tài liệu kỹ thuật.',
    source: 'Giáo trình AI20K · Tr.40 · Mở rộng: HyDE (Gao et al.)',
  },
  'Query Decomposition': {
    problem: 'Câu hỏi nhiều vế hoặc đa chặng (multi-hop) không nằm gọn trong 1 chunk duy nhất.',
    mechanism: 'Tách câu hỏi phức tạp thành 2–3 câu hỏi con độc lập, truy xuất từng ý rồi gộp ngữ cảnh trước khi tổng hợp.',
    example: '"So sánh Workflow Ngày 2 và Multi-agent Ngày 8" → tách thành 2 truy vấn riêng cho Day 02 và Day 08.',
    source: 'Giáo trình AI20K · Tr.40 · Mở rộng: Query Decomposition',
  },
  'Step-Back Prompting': {
    problem: 'Câu hỏi quá chi tiết khiến retriever chỉ tìm thấy mảnh vụn mà thiếu nguyên lý nền để suy luận đúng.',
    mechanism: 'Tạo thêm 1 câu hỏi "lùi lại 1 bước" ở mức nguyên lý tổng quát, truy xuất song song cả ngữ cảnh nền lẫn chi tiết.',
    example: 'Từ câu hỏi về 1 tham số nhỏ của Cross-Encoder → lùi lại hỏi "Kiến trúc Two-stage Retrieval hoạt động thế nào?".',
    source: 'Mở rộng: Step-Back Prompting (Google DeepMind)',
  },
  'Query Routing': {
    problem: 'Đẩy mọi câu hỏi (kể cả câu chào hỏi hay câu đếm số liệu bảng) vào cùng 1 vector DB vừa chậm vừa sai.',
    mechanism: 'Bộ phân loại chọn đúng nguồn & phương pháp: Vector cho ngữ nghĩa, BM25 cho mã/ID, SQL cho bảng số, hoặc bỏ qua tìm kiếm.',
    example: 'Câu "L0012 có bao nhiêu lượt?" → định tuyến sang truy vấn có cấu trúc thay vì vector search.',
    source: 'Giáo trình AI20K · Tr.40–41',
  },
  'Metadata Filter': {
    problem: 'Top-k quá lớn gây loãng ngữ cảnh và tốn token; không lọc metadata dễ lấy nhầm tài liệu hết hạn.',
    mechanism: 'Áp bộ lọc cứng theo ngày, loại tài liệu, quyền truy cập trước khi tính độ tương đồng và giới hạn top-k hợp lý.',
    example: 'Khóa `day=7` và `top_k=5` khi học viên bật chế độ "Chỉ Ngày 7" trong Gia sư AI.',
    source: 'Giáo trình AI20K · Tr.41',
  },
  'Input Safety': {
    problem: 'Kẻ tấn công chèn chỉ thị độc hại ("Ignore previous instructions") hoặc người dùng vô tình dán số điện thoại/API key.',
    mechanism: 'Chạy Guardrail kiểm tra Prompt Injection và ẩn PII ngay ở cửa vào, trước khi gọi retriever hoặc LLM.',
    example: 'Ca B19 trong bộ test của nhóm bị chặn ngay ở cổng vào với thông báo 🛡️ Guardrail.',
    source: 'Giáo trình AI20K · Tr.41 · learning-app/backend/guardrails.py',
  },
  'Lexical BM25': {
    problem: 'Embedding vector dễ bỏ sót khớp chính xác như mã lỗi (`ERR-404`), tên hàm (`pack_context`), mã khái niệm (`PAT_D7_RETRIEVAL`).',
    mechanism: 'Tính điểm khớp từ khóa theo tần suất xuất hiện (TF) và độ hiếm trên toàn kho (IDF) có chuẩn hóa độ dài tài liệu.',
    example: 'Trong `learning-app`, SQLite FTS5/BM25 bắt chính xác cụm tiếng Việt có dấu như "hoàn tiền Cost-of-Pass".',
    source: 'Giáo trình AI20K · Tr.41 · Mở rộng: BM25 Hybrid Search',
  },
  'Dense Vector Search': {
    problem: 'Tìm từ khóa BM25 thất bại khi người dùng diễn đạt khác từ ngữ trong tài liệu (đồng nghĩa, hỏi theo ý).',
    mechanism: 'Biến câu hỏi và chunk thành vector số cùng không gian, rồi tìm top-k gần nhất bằng Cosine Similarity.',
    example: 'Hỏi "làm sao chống AI bịa chuyện" vẫn tìm trúng đoạn viết về "Hallucination & Grounded Generation".',
    source: 'Giáo trình AI20K · Tr.41 · Lab Day 01 & Day 06',
  },
  'Contextual Retrieval': {
    problem: 'Cắt nhỏ tài liệu thành chunk 500 token làm mất bối cảnh chung (vd chunk ghi "tăng 4% quý 3" nhưng không rõ công ty nào).',
    mechanism: 'Dùng LLM nhanh sinh 1 đoạn mở đầu ngữ cảnh 50–100 token tóm tắt vị trí chunk trong cả tài liệu, gắn vào đầu chunk trước khi embed & index BM25.',
    example: 'Gắn tiền tố "[AI20K Ngày 7 · Giai đoạn 3 Post-Retrieval]" vào mỗi chunk giúp giảm mạnh tỷ lệ tìm trượt.',
    source: 'Mở rộng: Anthropic Contextual Retrieval (2024)',
  },
  'Parent-Child': {
    problem: 'Chunk nhỏ giúp tìm chính xác nhưng thiếu ngữ cảnh khi sinh câu trả lời; chunk lớn đủ ngữ cảnh nhưng vector bị loãng.',
    mechanism: 'Tách rời đơn vị tìm kiếm (chunk con 100–200 token) và đơn vị nạp prompt (chunk cha 1.000+ token trỏ ngược từ chunk con).',
    example: 'Tìm khớp câu ngắn về `pack_context` ở chunk con → tự động nạp nguyên mục hướng dẫn M02 của chunk cha vào LLM.',
    source: 'Giáo trình AI20K · Tr.41–42 · Mở rộng: Parent Document Retriever',
  },
  'Knowledge-Graph Retrieval': {
    problem: 'Vector search chỉ tìm từng đoạn độc lập, khó trả lời câu hỏi cần lần theo chuỗi quan hệ nhiều bước giữa các khái niệm.',
    mechanism: 'Truy xuất theo nút thực thể và duyệt cạnh quan hệ (multi-hop traversal) để gom đủ bối cảnh liên kết và cụm cộng đồng.',
    example: 'Trong dự án của nhóm: từ `checkpoint day07-m02` lần sang `retrieval-context` → `citation` → `starter/baseline.py:pack_context`.',
    source: 'Giáo trình AI20K · Tr.41–42 · learning-app/backend/graph_db.py',
  },
  'Structured Retrieval': {
    problem: 'Tìm văn bản phi cấu trúc không thể tính tổng, lọc chính xác hoặc thống kê trên dữ liệu dạng bảng.',
    mechanism: 'Dịch câu hỏi sang truy vấn SQL / bộ lọc key-value có cấu trúc, chạy trên DB để lấy con số chính xác 100%.',
    example: 'Đếm chính xác `102/453` sự kiện `lab_completed` có `skipped=true` trong log Pre-class thay vì ước lượng.',
    source: 'Giáo trình AI20K · Tr.42',
  },
  'Self-RAG': {
    problem: 'RAG truyền thống luôn gọi retriever cho mọi câu hỏi và tin mù quáng vào mọi chunk tìm về.',
    mechanism: 'Mô hình tự sinh tín hiệu phản tư để quyết định: (1) có cần tìm không, (2) đoạn tìm về có liên quan không, (3) câu trả lời có bám đoạn đó không.',
    example: 'Nếu đoạn tìm về không đủ liên quan, mô hình tự loại bỏ thay vì cố ghép vào câu trả lời.',
    source: 'Giáo trình AI20K · Tr.42 · Mở rộng: Self-RAG (Asai et al.)',
  },
  'CRAG': {
    problem: 'Khi retriever trả về toàn đoạn nhiễu hoặc sai chủ đề, LLM sẽ bị "nhiễm độc ngữ cảnh" và trả lời sai.',
    mechanism: 'Bộ đánh giá chấm điểm chất lượng tập tài liệu tìm được: Đúng → dùng; Mơ hồ → tinh lọc; Sai → kích hoạt tìm lại/mở rộng nguồn.',
    example: 'Nếu tìm trong kho Day 07 ra điểm thấp, CRAG mở rộng sang toàn khóa 14 ngày hoặc báo thiếu căn cứ.',
    source: 'Giáo trình AI20K · Tr.42 · Mở rộng: Corrective RAG (Yan et al.)',
  },
  'Agentic Multi-hop': {
    problem: 'Câu hỏi phức tạp không thể giải trong 1 lượt tìm kiếm duy nhất.',
    mechanism: 'Agent tự gọi tool tìm kiếm theo nhiều bước có giới hạn `max_steps`, ghi trace từng lượt và giữ nguyên ID nguồn để kiểm chứng.',
    example: 'Lab Day 07 M02 (`starter/agentic.py → run_agent`): điều phối controller & retriever, kiểm tra ID trích dẫn có nằm trong context.',
    source: 'Lab Day 07 M02 · starter/agentic.py:L31',
  },
  'RRF': {
    problem: 'Vector search trả điểm cosine (0.0–1.0) còn BM25 trả điểm không giới hạn (vd 3.2 hoặc 14.5) — không thể cộng trực tiếp hai thang điểm này.',
    mechanism: 'Bỏ qua điểm số thô, chỉ gộp theo thứ hạng tương đối bằng công thức: RRF(d) = Σ 1 / (k + rank_m(d)), thường chọn hằng số làm mượt k = 60.',
    example: 'Chunk A đứng #1 ở BM25 và #2 ở Vector → điểm RRF = 1/61 + 1/62 = 0.0325, tự động nổi lên đầu bảng hợp nhất.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.42–43 · Mở rộng: Cormack et al. (RRF)',
  },
  'Cross-Encoder Reranking': {
    problem: 'Bi-Encoder (vector search) mã hóa câu hỏi và tài liệu tách rời nhau nên độ chính xác (precision) ở top đầu chưa cao.',
    mechanism: 'Kiến trúc 2 giai đoạn: Stage 1 lấy rộng top 30–50 ứng viên; Stage 2 đưa đồng thời cặp (Query, Chunk) qua Cross-Encoder để chấm chéo sâu và giữ top 3–5.',
    example: 'Loại bỏ các đoạn chỉ trùng từ khóa bề mặt, đẩy đúng đoạn chứa công thức/hàm cần tìm lên vị trí #1.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.42–43 · Mở rộng: Two-stage Retrieval',
  },
  'Dedup & MMR': {
    problem: 'Top-5 kết quả thường bị lặp đi lặp lại cùng 1 ý từ nhiều chunk gần nhau, lãng phí khung context.',
    mechanism: 'Khử trùng lặp (Dedup) và áp dụng MMR (Maximal Marginal Relevance) để chọn đoạn vừa liên quan câu hỏi vừa bổ sung góc nhìn mới.',
    example: 'Thay vì lấy 4 đoạn giống nhau đều định nghĩa RAG, MMR chọn 1 đoạn định nghĩa + 1 đoạn kiến trúc + 1 đoạn lỗi thường gặp.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.43',
  },
  'Contextual Compression': {
    problem: 'Ngay cả chunk đúng vẫn chứa nhiều câu râu ria, tiêu đề lặp, boilerplate gây tốn token và làm loãng chú ý của LLM.',
    mechanism: 'Lọc bỏ câu không liên quan trong từng chunk hoặc nén token (như LLMLingua) để chỉ giữ lại thông tin cốt lõi phục vụ câu hỏi.',
    example: 'Rút gọn 2.000 token tài liệu thô xuống ~500 token sạch giúp giảm chi phí API và tăng độ tập trung.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.43 · Mở rộng: LLMLingua',
  },
  'Chống Lost in the Middle': {
    problem: 'Nghiên cứu Liu et al. (2023) chứng minh LLM có đường cong chú ý hình chữ U: đọc rất tốt ở ĐẦU và CUỐI context, nhưng dễ bỏ sót thông tin nằm Ở GIỮA.',
    mechanism: 'Chiến lược Bookending (Long-context Reordering): đặt chunk điểm cao nhất ở ngay đầu prompt, chunk quan trọng thứ hai ở cuối prompt, không nhồi quá nhiều chunk rác.',
    example: 'Đưa đoạn định nghĩa chính của checkpoint lên đầu và đoạn code mẫu xuống cuối context trước khi gọi model.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.43–44 · Mở rộng: Liu et al. (Stanford/Berkeley, 2023)',
  },
  'Contradiction Detection': {
    problem: 'Kho tài liệu có nhiều phiên bản cũ–mới mâu thuẫn nhau khiến LLM tự trộn thông tin sai.',
    mechanism: 'Đối chiếu thời gian/phiên bản và kiểm tra mâu thuẫn giữa các chunk trước khi tổng hợp; ưu tiên bản mới nhất hoặc nêu rõ sự khác biệt.',
    example: 'Phát hiện tài liệu CP1 và bản cập nhật CP2 khác ngưỡng đạt → bám theo bản mới nhất và ghi rõ phiên bản.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.44',
  },
  'Token-Budget Packing': {
    problem: 'Nhồi quá nhiều tài liệu vượt giới hạn context sẽ gây cắt cụt prompt hoặc đội chi phí token.',
    mechanism: 'Sắp xếp và chọn lọc các đoạn đưa vào prompt trong đúng hạn mức token cho phép, đồng thời trả về danh sách ID các đoạn đã dùng.',
    example: 'Lab Day 07 M02 (`starter/baseline.py → pack_context`, L77): đóng gói context theo budget và trả ID để hậu kiểm citation.',
    source: 'Giáo trình AI20K · Tr.44–45 · Lab Day 07 M02 (starter/baseline.py:L77)',
  },
  'Structured XML/JSON Assembly': {
    problem: 'Dán văn bản thô nối tiếp nhau khiến LLM dễ nhầm nội dung tài liệu thành chỉ thị hệ thống (Indirect Prompt Injection).',
    mechanism: 'Đóng gói từng đoạn vào thẻ cấu trúc rõ ràng như `<doc id="Doc_1" source="...">...</doc>` để phân tách ranh giới dữ liệu và lệnh.',
    example: 'Tách biệt `<system_rules>`, `<evidence_docs>` và `<user_query>` giúp model bám nguồn và giảm rủi ro injection.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.44–45',
  },
  'Evidence IDs': {
    problem: 'Không có mã định danh cho từng đoạn khiến người dùng không biết câu trả lời dựa vào đoạn nào để mở kiểm tra.',
    mechanism: 'Gán mã duy nhất `[Doc_1]`, `[Doc_2]` hoặc `concept_id` vào từng đoạn context làm neo trích dẫn cho bước sinh.',
    example: 'Mỗi nút trong dự án của nhóm gắn `PAT_D7_*` và số trang PDF giúp kiểm chứng 100% không có nguồn bịa.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.45',
  },
  'Context-Grounded Synthesis': {
    problem: 'LLM có xu hướng dùng trí nhớ huấn luyện sẵn để trả lời ngay cả khi tài liệu nội bộ quy định khác.',
    mechanism: 'Ràng buộc system prompt chỉ tổng hợp thông tin từ các đoạn context được cấp; mọi kiến thức ngoài context đều không được tự thêm.',
    example: 'Chỉ trả lời đúng quy định checkpoint của AI20K K5 thay vì lấy định nghĩa chung chung từ Internet.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.45–46',
  },
  'Inline Citation': {
    problem: 'Câu trả lời dài không chỉ rõ ý nào lấy từ nguồn nào làm người học khó đối chiếu.',
    mechanism: 'Ép mô hình chèn mã trích dẫn `[Doc_1]` ngay sau từng khẳng định quan trọng (Claim-to-Evidence Mapping).',
    example: 'Mỗi gợi ý trong Gia sư AI kèm badge `[N7]` bấm vào nhảy thẳng tới nút kiến thức & số trang PDF tương ứng.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.46 · Mở rộng: Citation Grounding',
  },
  'JSON / Grammar Constrained': {
    problem: 'LLM trả văn bản tự do dễ sai định dạng, làm hỏng bước code hậu kiểm ID nguồn phía sau.',
    mechanism: 'Sử dụng Structured Outputs / JSON Schema để ép model trả đúng các trường `concept_id`, `hint`, `code_ref_id`, `status`.',
    example: 'Luồng `starter-repo/codebase/agent.py` yêu cầu LLM trả JSON chuẩn để bước `verify` kiểm tra tự động.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.46',
  },
  'Abstention': {
    problem: 'Khi tài liệu không chứa đáp án, LLM thường cố "chiều" người dùng bằng cách bịa ra câu trả lời nghe rất thuyết phục.',
    mechanism: 'Đặt luật cứng: nếu không tìm thấy bằng chứng khớp trong context → trả trạng thái `insufficient_evidence` và nói rõ "không có căn cứ".',
    example: 'Ca B13 (hỏi trang 95 / Quantum RAG ngoài PDF 1–88): hệ thống từ chối bịa và báo rõ giới hạn dữ liệu.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.46',
  },
  'NLI Entailment': {
    problem: 'Mô hình vẫn có thể gắn mã `[Doc_1]` nhưng viết nội dung sai lệch so với đoạn `Doc_1` thật.',
    mechanism: 'Chạy bộ kiểm tra kéo theo ngữ nghĩa (NLI / Faithfulness check) để xác minh đoạn trích có thực sự hậu thuẫn khẳng định hay không, gỡ/sửa trích dẫn sai.',
    example: 'Kiểm chéo `concept_id` và `evidence_id` nằm đúng trong danh sách context đã cấp trước khi trả về UI.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.47',
  },
  'Output Safety': {
    problem: 'Đầu ra có thể vô tình lặp lại thông tin cá nhân (email, MSSV, SĐT) hoặc bí mật hệ thống (API key).',
    mechanism: 'Quét DLP / PII Redaction trên cả đầu vào lẫn đầu ra để che thông tin nhạy cảm trước khi hiển thị hoặc ghi log.',
    example: 'Guardrail trong `learning-app` tự động che PII và hiển thị nhãn 🔒 "Đã tự động ẩn thông tin nhạy cảm".',
    source: 'Giáo trình AI20K · Ngày 7 Tr.47 · learning-app/backend/guardrails.py',
  },
  'Critique-and-Revise': {
    problem: 'Bản nháp đầu tiên của LLM có thể thiếu bước tự kiểm hoặc diễn đạt quá dài dòng.',
    mechanism: 'Cho bước rà soát đối chiếu câu trả lời với tiêu chí chất lượng (rubric) để chỉnh gọn, đủ nguồn rồi mới xuất bản.',
    example: 'Cải tiến từ Lượt 1 (16/20) → Lượt 2 (19/20) của nhóm bằng cách đảm bảo mọi gợi ý đều kèm thao tác tự kiểm cụ thể.',
    source: 'Giáo trình AI20K · Ngày 7 Tr.47–48',
  },
  'Context Precision': {
    problem: 'Nếu retriever kéo nhiều đoạn rác lên đầu hoặc bỏ sót đoạn cần thiết thì LLM dù mạnh mấy cũng trả lời sai.',
    mechanism: 'RAGAS đo 2 chỉ số riêng cho tầng tìm kiếm: Context Precision (đoạn đúng có xếp trên cùng không) và Context Recall (đã lấy đủ mọi ý cần thiết chưa).',
    example: 'Dùng tập `dev` ở Lab Day 07 M03 để so sánh ≥3 cấu hình tìm kiếm trước khi khóa cấu hình chấm `test`.',
    source: 'Giáo trình AI20K · Tr.48 · Mở rộng: RAGAS Framework',
  },
  'Faithfulness': {
    problem: 'Câu trả lời nghe trôi chảy nhưng lại chứa chi tiết tự bịa ngoài tài liệu đã cấp.',
    mechanism: 'RAGAS tách câu trả lời thành từng mệnh đề nhỏ và dùng judge kiểm xem bao nhiêu % mệnh đề suy ra được từ context (1.0 = 0 ảo giác).',
    example: 'Kết hợp Faithfulness với Code Verifier kiểm 100% ID nguồn hợp lệ trong bộ metric của nhóm.',
    source: 'Giáo trình AI20K · Tr.47–48 · Mở rộng: RAGAS Framework',
  },
  'Tách lỗi Tìm vs Dùng': {
    problem: 'Khi hệ thống trả lời sai, nếu chỉ nhìn điểm tổng sẽ không biết phải sửa Retriever hay sửa Prompt/LLM.',
    mechanism: 'Đọc trace + đo Hit@k: nếu đoạn đúng KHÔNG có trong context → lỗi Tìm nguồn (Retrieval); nếu CÓ trong context mà vẫn trả lời sai → lỗi Dùng nguồn (Generation).',
    example: 'Lab Day 07 M04 (`starter/agent_metrics.py:L7`): bắt buộc đọc trace để tách 2 nhóm lỗi trước khi cải tiến.',
    source: 'Lab Day 07 M03–M04 · starter/agent_metrics.py:L7',
  },
};

export function getLeafFocusedDetail(leafText, groupLabel = '', parentTitle = '') {
  const raw = (leafText || '').trim();
  const colonIdx = raw.indexOf(': ');
  const title = colonIdx > 0 ? raw.slice(0, colonIdx).trim() : raw;
  const shortSummary = colonIdx > 0 ? raw.slice(colonIdx + 2).trim() : '';

  const matchedKey = Object.keys(DAY7_LEAF_DETAILS_BY_PREFIX).find(prefix =>
    title.toLowerCase().startsWith(prefix.toLowerCase()),
  );
  const deep = matchedKey ? DAY7_LEAF_DETAILS_BY_PREFIX[matchedKey] : null;

  return {
    kind: 'l3',
    title,
    shortSummary,
    groupLabel,
    parentTitle,
    problem: deep?.problem || null,
    mechanism: deep?.mechanism || shortSummary || raw,
    example: deep?.example || null,
    source: deep?.source || null,
  };
}
