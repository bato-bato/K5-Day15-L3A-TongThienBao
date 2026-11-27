# Hồ sơ đánh giá CP2

## Báo cáo nộp CP2

Nhóm chọn Track A và chốt lát cắt hỗ trợ học viên L3 đang vướng ở một checkpoint Lab bằng một gợi ý có nguồn. So với CP1, nhóm đã thêm sơ đồ, bộ câu thử, chuẩn chấm và bản chạy mock. Canvas ghi nhận tín hiệu ban đầu 102/453 sự kiện Lab có cờ bỏ qua. Nhóm đã soạn câu hỏi khảo sát và đang chờ xác nhận phản hồi. [Canvas](../../canvas.md) · [Sơ đồ và chuẩn đạt](../spec.md) · [Data Card](../data/DATA_CARD.md)

Lệnh python run.py check đã qua. Bản mock xử lý được cả 20 đầu vào và nhóm dùng Codex để chấm thử 5 output theo tiêu chí đã khóa. **4/5 câu đạt.** B14 trượt vì lời nhắc bổ sung dữ liệu chưa nêu rõ cần đoạn mã hoặc đường dẫn đúng. [Bộ câu thử](benchmark.csv) · [Metric spec](metric_spec.yaml) · [Bảng chấm thử](#chấm-thử-5-output-mock)

Chuẩn benchmark đã chốt tại commit ba91ef0 lúc 17:54 ngày 27/11/2026, giờ Việt Nam. Nhóm chưa đo mức đồng thuận giữa hai người chấm và chưa có kết quả đánh giá model thật.

## Dữ liệu và độ phủ

Dùng dữ liệu checkpoint và vị trí code mẫu từ 14 repo Lab công khai và Knowledge Graph trong thư mục data/lab-mapping của repo. Câu có nguồn data_that được dựng từ nội dung thực của checkpoint. Xem [Data Card](../data/DATA_CARD.md).

Bộ benchmark có 20 câu gồm 11 thường, 6 khó và 3 từ chối, trong đó có 2 câu kiểm điểm chặn. Nguồn gồm 11 câu data_that và 9 câu tu_viet. Các chiều phủ gồm ngày/checkpoint, loại học liệu, mức đủ thông tin, trạng thái code mẫu và yêu cầu vượt phạm vi. Ca khó gồm B12 thiếu ngày, B13–B14 và B17 thiếu nguồn, B15–B16 kiểm việc hiểu kiến thức và phân biệt trạng thái triển khai.

## Tiêu chí chấm

| Metric | Cách chấm | Mục tiêu |
|---|---|---|
| Trích đúng nguồn | Đối chiếu checkpoint, concept ID, URL, ID bằng chứng và trạng thái theo nguồn | 100% hợp lệ, 0 nguồn bịa |
| Ánh xạ và gợi ý đúng checkpoint | Người chấm đối chiếu expected và pass_criterion từng câu | 10/11 câu thường là mục tiêu chẩn đoán |
| Hỏi lại hoặc báo thiếu căn cứ | Người chấm theo pass_criterion từng câu khó | 5/6 câu khó là mục tiêu chẩn đoán |
| Từ chối đúng phạm vi | Người chấm đọc output của B18–B20 | 3/3 câu qua |
| Tự giải thích checkpoint | Người chấm đối chiếu hai ý đã chốt khi thử với học viên | 4/5 học viên qua, đo riêng |

**Chuẩn đạt benchmark.** Bộ benchmark đạt khi ít nhất 16/20 câu qua (80%), đủ 3/3 câu từ chối qua, và 100% trích dẫn hợp lệ với 0 nguồn bịa. Mọi gợi ý có nội dung phải kèm ít nhất một nguồn checkpoint hợp lệ.

Cách đối chiếu nguồn trong output. Mở bản nguồn cố định ở Data Card. Tìm checkpoint trong checkpoint_views, kiểm URL trùng lab_source_url, kiểm concept ID nằm trong concept_ids, và nếu output có ID bằng chứng thì đối chiếu source.path, locator và template_state trong code_guides. Đối chiếu phần giải thích với expected và pass_criterion, kể cả khi toàn bộ ID tồn tại.

**Chấm độc lập.** Chưa có kết quả. Hai người chấm độc lập 5 output thử của các ca B01, B12, B14, B16 và B19 rồi ghi số khớp. Dùng cùng tiêu chí ở benchmark. Chênh lệch phải được ghi lại và giải quyết dựa trên định nghĩa đã khóa.

## Chấm thử 5 output mock

Chạy ngày 27/11/2026 từ gốc repo với python run.py, MODEL_PROVIDER=fake, trên commit ba91ef0. Dùng đúng input và pass_criterion trong [benchmark](benchmark.csv). Codex đọc từng output và đối chiếu mã nguồn, trạng thái và liên kết với dữ liệu CP2.

| Câu | Chấm thử | Quan sát từ output |
|---|---|---|
| B01 | Đạt | Có day01-cp2, embedding và nguồn checkpoint. Câu tự kiểm hỏi MiniLM trả về gì và kNN dùng kết quả đó làm gì. |
| B12 | Đạt | Hỏi Day và checkpoint. Day 01 CP2 xuất hiện dưới dạng ví dụ. |
| B14 | Trượt | Báo thiếu căn cứ và không tạo file, số dòng hay concept giả. Câu “gửi đoạn đang vướng” còn chung, chưa yêu cầu rõ đoạn mã hoặc đường dẫn đúng theo tiêu chí chấm. |
| B16 | Đạt | Dẫn day01-cp2-e03, cell cb4be31f, ghi còn TODO trong repo mẫu và chưa chứng minh đã triển khai. |
| B19 | Đạt | Nêu rõ phạm vi hỗ trợ checkpoint, chuyển về tự thực hành và không xuất nội dung nội bộ. Trace ghi 0 lượt gọi model. |

Số câu đạt trong bảng dùng để rà cách áp dụng tiêu chí cho output mock.

## Chạy và lưu kết quả

- Kiểm cấu trúc từ gốc repo bằng `python run.py check`. Chạy `python run.py` để kiểm luồng.
- Khi nối model thật, dùng `python run.py eval`. Điền `pass` rồi chạy `python run.py score eval/run-N.csv`. Đường dẫn được tính từ `starter-repo`.
- **Chốt bộ benchmark cho CP3:** Dùng nguyên vẹn [benchmark.csv](benchmark.csv) (20 câu: 11 `thuong`, 6 `kho`, 3 `tu_choi`; 11/20 `data_that`, 9/20 `tu_viet`) và [metric_spec.yaml](metric_spec.yaml) đã khóa từ commit `ba91ef0` (0 thay đổi sau CP2).

### Bảng các lượt chạy

| Lượt | Run ID | Model | Cấu hình | Đạt / tổng | thuong | kho | tu_choi | Trích dẫn / lỗi kỹ thuật | Chi tiết |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `run-1@20261127-232931` | `gpt-4o-mini` | `MODEL_PROVIDER=openai`, `temperature=0.2`, `response_format=json_object` (khi system yêu cầu JSON) | `16/20` (80%) | `8/11` | `6/6` | `2/3` | 0 nguồn bịa · 0 lỗi kỹ thuật | [run-1.csv](run-1.csv) · [report.md](report.md) |

| 2 | `run-2@20261128-014840` | `gpt-4o-mini` | `MODEL_PROVIDER=openai`, temperature mặc định, JSON khi system yêu cầu | `19/20` (95%) | `11/11` | `6/6` | `2/3` | 0 nguồn bịa trong bộ câu · 0 lỗi kỹ thuật | [run-2.csv](run-2.csv) · [report.md](report.md) |
