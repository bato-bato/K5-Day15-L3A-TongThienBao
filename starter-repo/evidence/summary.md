# Tổng hợp bằng chứng về vấn đề của học viên · CP3

## Nguồn và kết quả

**102/453 sự kiện `lab_completed` (22,5%)** trong log Preclass của BTC có `data.skipped=true`. Theo từ điển sự kiện, cờ này được ghi khi học viên bấm bỏ qua trong bài thực hành. Mẫu số là toàn bộ sự kiện `lab_completed` trong tệp `events.csv` của bộ log 05–25/11/2026. Tỷ lệ tính theo sự kiện, gồm cả các lượt thực hành lặp lại của cùng một người. [Mô tả dữ liệu](../../data/preclass/README.md) · [Cách đếm và mã tái lập](data-mining.md)

Nguồn log đáp ứng ngưỡng CP3 với tỷ lệ có thể tái lập và năm bản ghi gốc dưới đây. Nhóm đã soạn câu hỏi khảo sát. Kết quả khảo sát và phỏng vấn chưa được xác nhận. [Yêu cầu bằng chứng CP3](../../02-guide.md#b1-2) · [Câu hỏi khảo sát](survey/questions.md)

## Năm ví dụ nguyên văn

Trích hai cột `lesson_id` và `data` từ năm bản ghi `lab_completed` có `skipped=true` đầu tiên trong `events.csv`. Số thứ tự tính cả dòng tiêu đề. Mã học viên, mã phiên và thời gian đã được lược bỏ.

| Bản ghi | `lesson_id` | `data` |
|---:|---|---|
| 1066 | `program-day01:ai-llm-foundation` | `{"lab_key": "d01-lab-ban-la-llm", "skipped": true, "steps": 2, "steps_done": 1}` |
| 1280 | `program-day01:ai-llm-foundation` | `{"lab_key": "d01-lab-ban-la-llm", "skipped": true, "steps": 2, "steps_done": 1}` |
| 1869 | `program-day02:ai-problem-definition` | `{"lab_key": "d02-lab-cham-gate", "skipped": true, "steps": 3, "steps_done": 2}` |
| 4079 | `program-day04:prompt-engineering-tool-calling` | `{"lab_key": "d04-lab-soi-system-prompt", "skipped": true, "steps": 3, "steps_done": 2}` |
| 4562 | `program-day02:ai-problem-definition` | `{"lab_key": "d02-lab-cham-gate", "skipped": true, "steps": 3, "steps_done": 2}` |

## Kết luận

**Giả thuyết trong Canvas cần thu hẹp.** Log xác nhận có thao tác bỏ qua trong bài thực hành Preclass. Giả thuyết rằng học viên L3 gặp khó khi nối kiến thức Lecture với bước Lab, rồi nhờ AI làm cả bài hoặc bỏ qua tự kiểm, vẫn cần đối chiếu với trải nghiệm của học viên. Buổi phỏng vấn hoặc khảo sát có thể hỏi về lần gần nhất họ bỏ qua một bước, lý do bỏ qua và cách họ tự kiểm kết quả. [Canvas của nhóm](../canvas.md)
