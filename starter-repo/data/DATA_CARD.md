# Data card — dữ liệu bản chạy thử dùng

> Bản đầu cho CP2 (27/11/2026). Không commit nguyên file tài liệu khóa học, dữ liệu cá nhân thật hay nguyên bộ log hành vi BTC cấp — chỉ lưu cấu trúc trích xuất, số tổng hợp và mẫu ngắn phục vụ kiểm thử.

## Snapshot chạy mock CP2

Nguồn đọc ở runtime là [knowledge-graph.json](../../data/lab-mapping/knowledge-graph.json) trong chính commit CP2. Tệp chứa 65 khái niệm, 92 quan hệ, 77 checkpoint/phase và 34 lời giải thích code mẫu. Dữ liệu được diễn giải từ tài liệu Lab công khai, với nguồn tra lại theo commit. Các khái niệm ở đây đang chờ đối chiếu với Lecture chính thức. CP2 không dùng PDF Lecture, ví dụ Inclass từ người dùng, repo học viên hay log Preclass làm đầu vào runtime.

Fixture chạy mock dùng dữ liệu Lab dẫn nguồn và bộ luật chọn khái niệm tất định. Benchmark có 11 câu dựng từ dữ liệu Lab và 9 câu tự viết. Không dùng benchmark làm đầu vào truy xuất. Không dùng dữ liệu sinh có seed ở snapshot này. Lịch Day 12 từ README công khai, phần yêu cầu chi tiết cần Lab Board.

Các dataset bên dưới ghi nguồn cho backend đang phát triển và cho phần đánh giá pain. Khái niệm có trang PDF thuộc dataset Lecture riêng với graph dựa trên Lab của CLI mock.

## Dataset 1 · Knowledge Graph Giáo trình AI20K (Day 01–Day 13)

| | |
|---|---|
| Dùng để làm gì | Nguồn tri thức gốc cho công cụ truy xuất Knowledge Graph / GraphRAG (`kg_store.py`, `graph_db.py`), hiển thị Mindmap và kiểm chứng nguồn (`verify_mapping`) |
| Từ đâu | Tài liệu giáo trình khóa AI20K Level 3–4 (trích tóm tắt có cấu trúc kèm số trang PDF và mục giáo trình; file `learning-app/backend/kg_data/kg_aicb_p1.json` ) |
| Xử lý những bước gì | Chuẩn hóa Unicode NFC, tách node theo loại (`CoreConcept`, `ArchitecturePattern`, `MetricOrFormula`, `FailureOrTrap`, `CaseStudy`, `LabDeliverable`), gắn metadata `day`, `pdf_pages` (1–88), `section_ref`, `key_quote`, lập chỉ mục FTS5 và kiểm hợp lệ bằng `kg_builder.py` |
| Số dòng / số đoạn | 71 node (13 node ngày + 58 khái niệm) và 84 cạnh quan hệ trong `kg_aicb_p1.json` |
| Phiên bản / ngày lấy | v1.0 · 27/11/2026 |
| Nhãn | thật (trích tóm tắt có cấu trúc từ giáo trình khóa) |
| Giới hạn | Chưa bao phủ toàn văn trang PDF (chỉ gồm tóm tắt khái niệm và trích dẫn chính); Day 14 hiện mới có khung Lab/Ingestion chứ chưa có bộ trang PDF gốc |

## Dataset 2 · Lab Mapping & Checkpoint Evidence (Day 01–Day 14)

| | |
|---|---|
| Dùng để làm gì | Ánh xạ hai chiều giữa yêu cầu từng Checkpoint Lab với khái niệm lý thuyết và vị trí code thực tế; tạo câu thử `data_that` trong `eval/benchmark.csv` |
| Từ đâu | Repo bài lab công khai của khóa AI20K K5 L3 (`data/lab-mapping/labs.json` và `data/lab-mapping/LAB-MAPPING.md`) |
| Xử lý những bước gì | Thu thập danh sách 14 repo lab ở commit cố định, trích yêu cầu checkpoint, đầu ra kỳ vọng, khái niệm gợi ý và vị trí file/cell/hàm trong từng repo |
| Số dòng / số đoạn | 14 Lab · 77 checkpoint/phase · 165 mục bằng chứng (148 mục trỏ tới file có thật trong commit nguồn) |
| Phiên bản / ngày lấy | v1.0 · 27/11/2026 |
| Nhãn | thật |
| Giới hạn | Day 06 và Day 07 dùng ID mốc nội bộ theo lịch; Day 12 trích theo README công khai; một số mốc slide Day 01 đang chờ đối chiếu thêm với Lecture gốc |

## Dataset 3 · Workspace Repo AST Index & GraphRAG Graph

| | |
|---|---|
| Dùng để làm gì | Cung cấp danh sách file, hàm/lớp có thật (`repo_index.json`) và đồ thị đa chặng 7 quan hệ + community (`mapping.json`) để kiểm chứng `code_ref` và chống bịa đường dẫn |
| Từ đâu | Phân tích mã nguồn trong chính workspace dự án (`starter-repo/` và `learning-app/backend/`) bằng `learning-app/backend/repo_parser.py` và `graph_db.py` |
| Xử lý những bước gì | Quét AST Python (trích `file_path`, `symbol`, `line_start`, `line_end`), gộp với Knowledge Graph và Checkpoint thành đồ thị GraphRAG schema `3.0-graphrag` lưu SQLite + JSON |
| Số dòng / số đoạn | 13 file nguồn · 116 code symbol (`repo_index.json`); 199 node · 224 cạnh · 113 community (`mapping.json`) |
| Phiên bản / ngày lấy | v3.0-graphrag · 27/11/2026 |
| Nhãn | thật |
| Giới hạn | Hiện mới phân tích AST cho file Python trong workspace; chưa tự động quét repo bài làm riêng của từng học viên nếu chưa nhập link commit |

## Dataset 4 · Nhật ký hành vi Pre-class (BTC cấp) & Khảo sát học viên

| | |
|---|---|
| Dùng để làm gì | Đào bằng chứng pain (tần suất tương tác AI, tỷ lệ cần xem lại bài giảng khi làm lab) và ước lượng tần suất dùng cho mô phỏng chi phí (`cost/personas.yaml`) |
| Từ đâu | Data BTC cấp trong `data/preclass/` (05/11/2026–25/11/2026) và form khảo sát tự thiết kế của nhóm (`starter-repo/evidence/survey/questions.md`) |
| Xử lý những bước gì | Pre-class đã được BTC ẩn danh sẵn (mã `L0001…`, bỏ tên/email/IP, không chứa nội dung chữ học viên viết); khảo sát không thu email/MSSV và chỉ lưu số tổng hợp + trích dẫn đã bỏ thông tin nhận diện |
| Số dòng / số đoạn | Pre-class: 721 tài khoản (436 có hoạt động), 107.709 events, 3.776 answers, 1.260 chats · Khảo sát: 20 câu hỏi (đang thu phản hồi từ L3A/L3B, mục tiêu ≥20 phiếu) |
| Phiên bản / ngày lấy | Pre-class: 25/11/2026 · Khảo sát: 27/11/2026 |
| Nhãn | thật |
| Giới hạn | Log pre-class không có nội dung câu hỏi nguyên văn (chỉ có độ dài ký tự) và phản ánh hoạt động trước buổi hơn là lúc làm lab trên lớp — do đó cần kết hợp thêm khảo sát và phỏng vấn trực tiếp |
