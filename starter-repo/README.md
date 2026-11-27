# nhomnhomnhom — Gợi ý theo checkpoint Lab

**Track A · EdTech · AI20K khóa 5 · CP1**

Học viên L3 có thời lượng Lec và Lab giới hạn. Khi mắc ở một checkpoint, họ phải tìm lại khái niệm hoặc ví dụ đã học để làm tiếp. Nếu chưa nối được kiến thức với bước đang làm, họ dễ dùng lời giải có sẵn khi chưa hiểu hoặc chưa tự kiểm kết quả.

**Lát cắt dự kiến.** Khi học viên L3 bị kẹt ở một checkpoint Lab, AI dựa vào hướng dẫn của checkpoint, nút Mindmap Preclass và ví dụ Inclass để chọn một gợi ý có dẫn nguồn. Học viên tự thử bước tiếp theo và so sánh kết quả với kết quả mong đợi. Nếu thiếu thông tin, AI hỏi một câu làm rõ.

## Nhóm làm gì, khung làm gì

- **Preclass.** Học viên dùng Mindmap để chọn lộ trình cơ bản (15–30 phút) hoặc chuyên sâu (60–90 phút).
- **Inclass.** Học viên gắn ví dụ và ghi chú vào các nút kiến thức liên quan.
- **Lab.** Checkpoint có mục tiêu, gợi ý, kết quả mong đợi và đường dẫn về kiến thức cần dùng. Demo dự kiến đi qua một checkpoint của một ngày học.
- Bộ khung hackathon cung cấp lệnh kiểm, chạy bộ câu thử, ghi trace và mô phỏng chi phí. [Canvas CP1 và phân công](canvas.md) · [Danh sách thành viên](TEAMS.md)

## Chạy trong 3 phút

Ứng dụng học dùng React, FastAPI và SQLite. Mở hai terminal trong `learning-app/`, chạy backend ở cổng `8000` và frontend bằng `npm run dev`, rồi mở URL Vite in ra. [Hướng dẫn cài đặt và chạy app](../learning-app/README.md#chạy-local)

## Lệnh

Chạy các lệnh sau trong thư mục chứa README này và `run.py`.

| Lệnh | Mục đích |
|---|---|
| `python run.py` | Chạy luồng mẫu của bộ khung. |
| `python run.py check` | Kiểm định dạng `TEAMS.md`, bộ câu thử và metric. |
| `python run.py eval --try` | Thử chạy ba câu đầu khi đã nối model. |
| `python run.py simulate --try` | Thử mô phỏng chi phí trên 10 phiên khi đã có đầu vào. |

## Bản chạy thử — viết ở đâu

Giao diện Mindmap và Lab, API lưu bản nháp và API tìm trong đồ thị kiến thức nằm trong [app học tập](../learning-app/). Lát cắt gợi ý có dẫn nguồn sẽ được mô tả trong [spec](spec.md) và nối vào bộ khung tại [điểm vào của agent](codebase/agent.py).

## Phần nào thật, phần nào giả

| Thành phần | Tình trạng tại CP1 |
|---|---|
| Log Preclass | **102/453 sự kiện `lab_completed` (22,5%)** có `data.skipped=true`. Tỷ lệ này tính trên sự kiện. Nhóm sẽ dùng khảo sát để tìm hiểu lý do bỏ qua và cách học viên dùng AI. [Mô tả dữ liệu](../data/preclass/README.md) |
| Khảo sát học viên | Form đã mở. Câu hỏi tập trung vào cách dùng AI, cách kiểm kết quả và mức hiểu tự đánh giá ở bài lab gần nhất. Nhóm sẽ dùng khảo sát để kiểm tra giả thuyết khi có đủ phản hồi. [Bộ câu hỏi và kế hoạch](evidence/survey/questions.md) |
| Gợi ý có dẫn nguồn | Hành vi mục tiêu của demo CP1. Luồng đánh giá trong bộ khung còn ở trạng thái mẫu. |

## Dùng AI vào việc gì

Nhóm dùng ChatGPT/Codex để soạn và chỉnh Google Form, rồi tổng hợp README từ Canvas và repo. Nhóm chốt nội dung câu hỏi và sẽ đối chiếu kết quả khảo sát với log Preclass. [Khai báo dùng AI](docs/ai-usage.md)

## File mẫu — điền ở bước nào

| Mốc | File |
|---|---|
| CP1 | [Canvas](canvas.md) · [Thông tin nhóm](TEAMS.md) |
| CP2 | [Thiết kế và chuẩn đạt](spec.md) · [Data card](data/DATA_CARD.md) · [Bộ câu thử](eval/benchmark.csv) · [Metric](eval/metric_spec.yaml) |
| CP3 | [Tổng hợp bằng chứng](evidence/summary.md) · [Luồng agent](codebase/agent.py) |
| CP4 | [Báo cáo đánh giá](eval/report.md) · [Ước tính chi phí](cost/cost-estimate.md) · [Dàn ý slide](slides/outline.md) |

## Bảy hạng mục bắt buộc — nằm ở file nào

| Hạng mục | File |
|---|---|
| Bằng chứng về vấn đề người dùng | [Tổng hợp bằng chứng](evidence/summary.md) |
| Impact có số | [Spec, mục §2](spec.md) |
| Thiết kế giải pháp | [Spec, mục §4](spec.md) |
| Bản chạy thử | [App học tập](../learning-app/) · [Agent](codebase/agent.py) |
| Định nghĩa đạt và bộ câu thử | [Data card](data/DATA_CARD.md) · [Bộ câu thử](eval/benchmark.csv) |
| Mô phỏng chi phí | [Ước tính chi phí](cost/cost-estimate.md) |
| Slide, demo và video dự phòng | [Dàn ý slide](slides/outline.md). Slide và video sẽ được bổ sung khi hoàn tất. |
