# Chi phí khi dùng thật · CP4

Đo token riêng trên ba model, mỗi model 50 phiên, seed 42 và cùng kịch bản câu hỏi.

| Model đo | Mô phỏng | Lần gọi model | Phiên lỗi |
|---|---|---:|---:|
| `gpt-4o-mini` | [simulate-1](simulate-1-summary.md) | 42 | 0/50 |
| `gpt-5.4-mini` | [simulate-2](simulate-2-summary.md) | 42 | 0/50 |
| `gpt-6.2-sol` | [simulate-3](simulate-3-summary.md) | 42 | 0/50 |

- Tỷ lệ **19/20 (95%)** dùng để ước tính chi phí mỗi tác vụ thành công lấy từ [Lượt 2 trên GPT‑4o mini](../eval/run-2.csv). Tỷ lệ đạt riêng của hai model mới chưa được đo. Cột chi phí mỗi phiên dùng token thực đo của từng model.
- [Cấu hình persona](personas.yaml) dùng 175, 350 hoặc 700 người tham gia mỗi tháng. Quy mô tham chiếu từ [guide 4.2](../../02-guide.md#b4-2). Tỷ lệ tham gia và thói quen dùng là giả định.
- Giá mỗi triệu token áp theo [bảng Standard của BTC ngày 25/11/2026](../../further-reading/model-prices.md).

| Model | Chi phí / phiên | Chi phí ước tính / tác vụ thành công | / tháng, thấp | / tháng, cơ sở | / tháng, cao | / người / tháng, cơ sở |
|---|---:|---:|---:|---:|---:|---:|
| gpt-4o-mini | $0.00014 | $0.00015 | $0.2108 | $0.4215 | $0.8431 | $0.0012 |
| gpt-5.4-mini | $0.00082 | $0.00086 | $1.22 | $2.44 | $4.87 | $0.0070 |
| gpt-6.2-sol | $0.0022 | $0.0023 | $3.34 | $6.69 | $13.38 | $0.0191 |

Chi phí ước tính mỗi tác vụ thành công lấy chi phí trung bình mỗi phiên chia cho 95%. Các kịch bản chỉ tính token. Chi phí hosting, lưu trữ và thời gian duyệt nằm ngoài bảng.

Ở kịch bản cơ sở, GPT‑5.4 mini khoảng **0.0070 USD/người/tháng** và GPT‑6.2 Sol khoảng **0.0191 USD/người/tháng**. Mức tiết kiệm giả định là 15,2 phút/người/tháng theo §2 và cần kiểm tra qua pilot.
