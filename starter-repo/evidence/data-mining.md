# Đào dữ liệu Preclass · CP3

## Nguồn và cách đếm

Bộ log Preclass AI20K Level 3–4, khoá 5 do BTC cung cấp, bao phủ 05–25/11/2026 (Day 01–13 theo mô tả bộ dữ liệu). Dùng toàn bộ `events.csv` từ bộ dữ liệu này. [Mô tả và hướng dẫn sử dụng dữ liệu](../../data/preclass/README.md) · [Từ điển cột](../../data/preclass/column_dictionary.csv) · [Từ điển sự kiện](../../data/preclass/event_types.csv)

40 bản ghi đầu có các nhóm hành vi như đăng nhập và mở phiên, mở bài giảng hoặc video, ghi nhận đoạn video đã xem và đổi trạng thái hiển thị tab. Mỗi bản ghi là một sự kiện. Theo từ điển, `type` xác định loại sự kiện và cột `data` chứa JSON. Với `lab_completed`, `skipped=true` được ghi khi người dùng bấm bỏ qua.

- **Mẫu số N** là tất cả bản ghi có `type=lab_completed` trong tệp. Một người có thể tạo nhiều bản ghi. Giữ nguyên từng sự kiện, kể cả lượt lặp, và gộp mọi bài và ngày trong tệp.
- **Tử số x** là số bản ghi trong N mà khoá `skipped` trong JSON của cột `data` có giá trị boolean `true`. Giá trị khác `true` vẫn thuộc mẫu số. Tỷ lệ tính bằng `100 × x/N`, làm tròn một chữ số thập phân.
- **Ví dụ** lấy năm bản ghi khớp đầu tiên theo thứ tự trong tệp. Số thứ tự tính cả dòng tiêu đề. Chỉ trích nguyên giá trị cột `lesson_id` và cột `data` để minh hoạ, bỏ mã học viên, mã phiên và thời gian.

## Tái lập

Chạy đoạn Python dưới đây từ gốc repo với tệp BTC tại `data/preclass/events.csv`. Nếu lưu tệp ở nơi khác, truyền đường dẫn tệp CSV qua đối số thứ nhất khi chạy đoạn mã dưới dạng script.

```python
import csv
import json
import sys
from pathlib import Path

source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/preclass/events.csv")
total = skipped = 0
examples = []

with source.open(encoding="utf-8-sig", newline="") as file:
    for record, row in enumerate(csv.DictReader(file), start=2):
        if row["type"] != "lab_completed":
            continue
        total += 1
        if json.loads(row["data"]).get("skipped") is True:
            skipped += 1
            if len(examples) < 5:
                examples.append((record, row["lesson_id"], row["data"]))

if total == 0:
    raise SystemExit("No lab_completed events found")

print(f"{skipped}/{total} ({100 * skipped / total:.1f}%)")
for record, lesson, data in examples:
    print(record, lesson, data)
```

## Kết quả

**102/453 sự kiện `lab_completed` (22,5%)** có `data.skipped=true`. Tỷ lệ tính trên sự kiện, gồm cả các lượt thực hành lặp lại. [Năm ví dụ nguyên văn và kết luận](summary.md)
