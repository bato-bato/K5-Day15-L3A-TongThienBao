# Chi phí khi dùng thật · CP4

- [50 phiên mô phỏng](simulate-1.csv), seed 42, [bảng kết quả gốc](simulate-1-summary.md). Không ghi nhận lỗi kỹ thuật. Có phiên được xử lý trước khi cần gọi model.
- Token đo trên `gpt-4o-mini`. Tỷ lệ đạt dùng để tính là **19/20 (95%)**, đọc từ [Lượt 2](../eval/run-2.csv). Tỷ lệ này đo theo câu benchmark.
- [Cấu hình persona](personas.yaml): 175, 350 hoặc 700 người tham gia mỗi tháng. Quy mô tham chiếu từ [guide 4.2](../../02-guide.md#b4-2). Tỷ lệ tham gia và thói quen dùng là giả định.
- Giá USD/triệu token theo [bảng BTC ngày 25/11/2026](../../further-reading/model-prices.md). `gpt-4o-mini` 0,15 vào và 0,60 ra. `gpt-6.2-sol` 2,00 vào và 10,00 ra. Dòng `gpt-6.2-sol` định giá lại cùng số token đã đo.

| Model | Chi phí / phiên | Chi phí / tác vụ thành công | / tháng, thấp | / tháng, cơ sở | / tháng, cao | / người / tháng, cơ sở |
|---|---:|---:|---:|---:|---:|---:|
| gpt-4o-mini | $0.00014 | $0.00015 | $0.2108 | $0.4215 | $0.8431 | $0.0012 |
| gpt-6.2-sol | $0.0020 | $0.0021 | $2.97 | $5.94 | $11.89 | $0.0170 |

Chi phí mỗi tác vụ thành công được ước tính bằng chi phí trung bình mỗi phiên chia tỷ lệ đạt. Các kịch bản chỉ tính tiền token. Chưa tính hosting, lưu trữ và thời gian duyệt.

Ở kịch bản cơ sở, chi phí token khoảng **0,0012 USD/người/tháng** với `gpt-4o-mini`. Mức tiết kiệm **15,2 phút/người/tháng** theo §2 là giả định để kiểm tra qua pilot. Kết quả hiện tại ủng hộ thử phạm vi nhỏ sau khi xử lý ca từ chối còn trượt.
