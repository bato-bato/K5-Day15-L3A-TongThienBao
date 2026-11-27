# Tóm tắt mô phỏng simulate-3@20261128-015704

Do `python run.py simulate` sinh ra — không sửa tay. Chép bảng sang `cost/cost-estimate.md`.

| Persona | Số phiên mô phỏng | Lượt hỏi / phiên | Token vào / phiên | Token ra / phiên | Gọi model / phiên | Gọi công cụ / phiên |
|---|---:|---:|---:|---:|---:|---:|
| dung_it | 22 | 1 | 743 | 79 | 0.8 | 0.9 |
| dung_vua | 22 | 1 | 610 | 73 | 0.8 | 1.0 |
| dung_nhieu | 6 | 2 | 1009 | 107 | 1.2 | 1.8 |

Tỉ lệ đạt dùng để tính: 19/20 (95%) — lượt run-2@20261128-014840

- Tỉ lệ đạt lấy từ lượt nhóm chọn: eval/run-2.csv (--rate-from). ⚠️ Lượt này chạy bằng gpt-4o-mini, mô phỏng đo trên gpt-6.2-sol — khác model.

| Model (giá) | Chi phí / phiên | Chi phí / task thành công | Chi phí / câu hỏi đạt | Chi phí / tháng — thấp (175 người) | Chi phí / tháng — cơ sở (350 người) | Chi phí / tháng — cao (700 người) | Chi phí / người / tháng (cơ sở) |
|---|---:|---:|---:|---:|---:|---:|---:|
| gpt-4o-mini (vào 0.15 · ra 0.6 $/1M) | $0.00016 | $0.00016 | $0.00015 | $0.2331 | $0.4662 | $0.9323 | $0.0013 |
| gpt-5.4-mini (vào 0.75 · ra 4.5 $/1M) | $0.00090 | $0.00094 | $0.00084 | $1.34 | $2.69 | $5.37 | $0.0077 |
| gpt-6.2-sol (vào 2.0 · ra 10.0 $/1M) | $0.0022 | $0.0023 | $0.0021 | $3.34 | $6.69 | $13.38 | $0.0191 |

- Chi phí / task thành công = chi phí / phiên ÷ tỉ lệ đạt. Chi phí / câu hỏi đạt = chi phí / phiên ÷ số lượt hỏi trung bình mỗi phiên (1.1) ÷ tỉ lệ đạt — tỉ lệ đạt đo theo từng câu thử.
- Token đo trên model: gpt-6.2-sol. Giá tính theo từng model trong bảng — model khác bộ tách token thì số token thật có thể lệch; ghi rõ "đo trên model X, tính giá model Y" trong cost/cost-estimate.md.
- Phiên lỗi (không tính vào trung bình): 0/50.
