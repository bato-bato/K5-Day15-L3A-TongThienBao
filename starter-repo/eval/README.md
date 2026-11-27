# Hồ sơ đánh giá CP2

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

## Chạy và lưu kết quả

- Kiểm cấu trúc từ gốc repo bằng python run.py check. Chạy python run.py để kiểm luồng mock.
- Khi nối model thật, dùng python run.py eval. Điền pass rồi chạy python run.py score eval/run-N.csv. Đường dẫn được tính từ starter-repo.
- Lưu run ID, model và % đạt cho từng lượt. Mốc CP2 chưa có số đo model thật.
