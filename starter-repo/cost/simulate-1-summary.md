# Tóm tắt mô phỏng simulate-1@20261128-015008

Do `python run.py simulate` sinh ra — không sửa tay. Chép bảng sang `cost/cost-estimate.md`.

| Persona | Số phiên mô phỏng | Lượt hỏi / phiên | Token vào / phiên | Token ra / phiên | Gọi model / phiên | Gọi công cụ / phiên |
|---|---:|---:|---:|---:|---:|---:|
| dung_it | 22 | 1 | 744 | 52 | 0.8 | 0.9 |
| dung_vua | 22 | 1 | 611 | 49 | 0.8 | 1.0 |
| dung_nhieu | 6 | 2 | 1010 | 74 | 1.2 | 1.8 |

Tỉ lệ đạt dùng để tính: 19/20 (95%) — lượt run-2@20261128-014840

- Tỉ lệ đạt lấy từ lượt nhóm chọn: eval/run-2.csv (--rate-from).

| Model (giá) | Chi phí / phiên | Chi phí / task thành công | Chi phí / câu hỏi đạt | Chi phí / tháng — thấp (175 người) | Chi phí / tháng — cơ sở (350 người) | Chi phí / tháng — cao (700 người) | Chi phí / người / tháng (cơ sở) |
|---|---:|---:|---:|---:|---:|---:|---:|
| gpt-4o-mini (vào 0.15 · ra 0.6 $/1M) | $0.00014 | $0.00015 | $0.00013 | $0.2108 | $0.4215 | $0.8431 | $0.0012 |
| gpt-6.2-sol (vào 2.0 · ra 10.0 $/1M) | $0.0020 | $0.0021 | $0.0019 | $2.97 | $5.94 | $11.89 | $0.0170 |

- Chi phí / task thành công = chi phí / phiên ÷ tỉ lệ đạt. Chi phí / câu hỏi đạt = chi phí / phiên ÷ số lượt hỏi trung bình mỗi phiên (1.1) ÷ tỉ lệ đạt — tỉ lệ đạt đo theo từng câu thử.
- Token đo trên model: gpt-4o-mini. Giá tính theo từng model trong bảng — model khác bộ tách token thì số token thật có thể lệch; ghi rõ "đo trên model X, tính giá model Y" trong cost/cost-estimate.md.
- Phiên lỗi (không tính vào trung bình): 0/50.
