# AI SPEC — Gợi ý có nguồn cho một checkpoint Lab · nhomnhomnhom

> Mốc nộp: §7 chốt chuẩn "đạt" tại **CP2 19:30 Thứ Sáu 27/11** · §0–§7 nộp **CP3 10:00 Thứ Bảy 28/11** · đủ §0–§10 **CP4 14:30 Thứ Bảy 28/11** · §10 changelog ghi tiếp đến **23:59 Thứ Bảy 28/11**.
> Đầu mỗi mục ghi bước guide (`02-guide.md` trong repo đề) chỉ cách điền. Mỗi mục ngắn, có số và nguồn; chi tiết để ở file được trỏ tới. Xoá dòng hướng dẫn trong ngoặc vuông khi điền xong.

Track A · EdTech. Hỗ trợ học viên L3 đang vướng ở một checkpoint Lab.
Nguồn bằng chứng ban đầu: log Preclass đã ẩn danh, ở mức số tổng hợp. Xem Canvas.

## §0. Hiện tại việc này diễn ra thế nào *(guide 1.1)*
- Luồng hiện tại của việc này, trong khoá hoặc trên app thật (3–5 bước; ảnh chụp từ tài khoản của mình, đã che thông tin):
- Công cụ / AI đang được dùng cho việc này (nếu có) + nguồn. Không kiểm được thì ghi "chưa kiểm":

## §1. Người dùng & bằng chứng *(guide 1.1, 1.2)*
- Người dùng chính (một vai cụ thể):
- Việc họ cố làm xong (`động từ + đối tượng + bối cảnh`, không có chữ AI):
- Hôm nay họ giải bằng gì, hỏng ở đâu, vì sao chưa bỏ:
- Pain (KHÔNG chữ AI): ai — đang làm gì — vướng đâu — hậu quả gì:
- Bằng chứng — số chính + kết luận (chi tiết: `evidence/summary.md`): __

## §2. Impact & quyết định chọn *(guide 1.3)*

| Hướng | Số người/tháng | Lần/tháng mỗi người | Phút tiết kiệm/lần | Impact giả định/tháng | Quyết định |
|---|---:|---:|---:|---:|---|
| Gợi ý checkpoint có nguồn | 350 | 7,6 | 2 | 5.320 phút | Chọn để thử trong phạm vi một checkpoint |
| Điều phối lập nhóm | 175 | 1 | 5 | 875 phút | Cần xác nhận nhu cầu và thêm luồng định danh |
| Trợ lý tổng hợp toàn khóa | 350 | 4 | 3 | 4.200 phút | Phạm vi nguồn và đánh giá rộng hơn |

- **Nguồn quy mô:** lớp L3 trên 700 học viên theo [guide 4.2](../02-guide.md#b4-2). Số người tham gia, tần suất và số phút tiết kiệm trong bảng đều là **tự ước tính**, chưa đo trên người học.
- **Impact cơ sở:** 350 người × 7,6 phiên/tháng × 2 phút = 5.320 phút/tháng, tương đương 15,2 phút/người/tháng. Tần suất có trọng số từ [persona](cost/personas.yaml).
- **Bằng chứng hành vi:** [102/453 sự kiện hoàn thành Lab có cờ bỏ qua](evidence/summary.md) là tỷ lệ theo sự kiện. Mức tiết kiệm và lý do bỏ qua cần đo riêng.

## §3. Giải pháp tương tự *(guide 2.1)*
- [sản phẩm / tính năng gần giống]: một điều đáng học · một điều đáng né · mình khác gì

## §4. Thiết kế

**Lát cắt.** Khi một học viên L3 bị kẹt ở một checkpoint Lab, AI dựa trên hướng dẫn của checkpoint, nút Mindmap Preclass và ví dụ Inclass để chọn một gợi ý có dẫn nguồn, giúp học viên tự thử và kiểm tra kết quả bước tiếp theo.

**Sơ đồ kiến trúc**

~~~mermaid
flowchart LR
    A["Input · câu hỏi + ngày học + checkpoint"] --> B{"Kiểm phạm vi và đủ thông tin?"}
    B -->|Thiếu ngày hoặc mốc| Q["Hỏi lại đúng trường thiếu"]
    B -->|Vượt phạm vi| R["Từ chối và hướng về checkpoint"]
    B -->|Đủ| C["Tra checkpoint và Concept Graph · tối đa 4 node liên quan"]
    D[("Checkpoint Lab + kiến thức + vị trí code mẫu")] --> C
    C -->|Có căn cứ| E["AI Core · chọn một concept và soạn gợi ý JSON"]
    C -->|Thiếu căn cứ| F["Báo thiếu căn cứ và đề nghị bổ sung"]
    E --> G{"Chặn rủi ro · kiểm ID khái niệm và bằng chứng"}
    G -->|Sai schema hoặc ID| F
    G -->|Hợp lệ| H["Output · gợi ý ngắn + nguồn + câu tự kiểm"]
    H --> I["Học viên mở nguồn, tự làm và kiểm kết quả"]
~~~

**Hình dạng.** Workflow cố định dùng GraphRAG để lấy ngữ cảnh có giới hạn. Một lần gọi model chọn khái niệm và gợi ý cho một checkpoint. Các bước truy xuất, kiểm nguồn và phản hồi đều xác định trước, nên lát cắt này dùng một quyết định AI và không cần nhiều agent điều phối.

| Công cụ | Input | Output | Tác động |
|---|---|---|---|
| find_checkpoint | ID chuẩn, ví dụ day01-cp2 | Hướng dẫn checkpoint, node trực tiếp, tối đa 4 node kề và vị trí code mẫu nếu có | Đọc knowledge-graph.json trong repo |
| call_model | Câu hỏi và phần ngữ cảnh đã lấy | Một concept ID, một gợi ý, ID bằng chứng code nếu có, hoặc trạng thái thiếu căn cứ | CP2 dùng model fake cục bộ, token 0 |

**Mức tự động.** AI gợi ý, học viên quyết định làm bước nào và kiểm theo kết quả mong đợi. Giảng viên hoặc người giữ tài liệu duyệt nội dung Lecture và ví dụ Inclass khi đưa vào nguồn chính thức. Hệ thống chỉ đọc dữ liệu phục vụ học, không ghi repo, chấm bài hoặc làm trọn bài hộ.

| Nguyên tắc | Áp dụng |
|---|---|
| G10 · Thu hẹp khi không chắc | Hỏi ngày và mốc khi đầu vào mơ hồ. Báo thiếu căn cứ khi chưa có checkpoint, file hoặc trang được yêu cầu. |
| G11 · Giải thích vì sao | Gắn gợi ý với một concept và link dẫn tới đúng checkpoint để học viên mở và đối chiếu. |
| G8/G9 · Dễ bỏ qua và sửa | Học viên có thể bỏ qua gợi ý hoặc bổ sung lại ngày, mốc hay đoạn đang vướng để chạy lại. |

**Phạm vi bản CP2.** CLI đọc nguồn Lab và giải thích có sẵn trong repo, truy xuất node theo checkpoint, gọi model fake rồi kiểm bằng chứng. Dữ liệu khái niệm của luồng này dựa trên Lab. Tài liệu PDF Lecture, ví dụ Inclass đã duyệt và repo riêng của học viên chưa được nạp vào luồng demo này. Khi gợi ý vị trí code, trạng thái TODO vẫn được giữ và vị trí được ghi rõ là của repo mẫu.

## §5. Chỗ khó và câu thử

| Kịch bản | Lớp | Hành vi mong đợi | Câu thử |
|---|---|---|---|
| Checkpoint có nhiều khái niệm | 4 · đặc thù học tập | Chọn một gợi ý và kèm câu tự kiểm | B01, B15 |
| Chỉ nói CP2 | 2 · thiếu thông tin | Hỏi ngày học và bước đang vướng | B12 |
| Trường hợp hỏi trang chưa xác minh | 1 · nguồn sự thật | Báo thiếu căn cứ | B13 |
| Hỏi file ngoài nguồn | 1 · nguồn sự thật | Yêu cầu đoạn code hoặc file đúng | B14 |
| Hàm còn TODO | 4 · đặc thù học tập | Gắn đúng trạng thái của repo mẫu | B16 |
| Phase chỉ có lịch công khai | 1 · nguồn sự thật | Nêu giới hạn và hướng đến Lab Board | B17 |
| Xin truy ra danh tính học viên | 3 · thẩm quyền | Từ chối, giữ phạm vi hỗ trợ Lab | B18 |
| Cố yêu cầu lộ cấu hình nội bộ | 3 · tấn công | Từ chối, không xuất dữ liệu nội bộ | B19 |
| Ép làm hộ và tạo nguồn bịa | 3 · tấn công | Từ chối, hướng học viên tự kiểm | B20 |

## §6. Bốn đường đi của trải nghiệm

- **Đủ căn cứ.** Đưa một gợi ý, nguồn checkpoint, vị trí code mẫu nếu có và câu tự kiểm.
- **Không chắc.** Hỏi ngày học hoặc checkpoint còn thiếu để học viên bổ sung.
- **Thiếu căn cứ hoặc vượt phạm vi.** Báo giới hạn hoặc từ chối theo tình huống. Hướng học viên trở lại nội dung có thể kiểm.
- **Người dùng sửa.** Nhập lại ngày, checkpoint hoặc đoạn đang vướng để chạy một lượt mới.

## §7. Đánh giá và chuẩn đạt

- [Data Card](data/DATA_CARD.md), [benchmark](eval/benchmark.csv) và [metric spec](eval/metric_spec.yaml). Bộ có 20 câu, gồm 11 thường, 6 khó và 3 từ chối. Có 11/20 câu dựa trên dữ liệu thật của Lab và 9 câu tự viết. Cách chấm ở [hồ sơ đánh giá](eval/README.md).
- **Chuẩn đạt benchmark.** Bộ benchmark đạt khi ít nhất 16/20 câu qua (80%), đủ 3/3 câu từ chối qua, và 100% trích dẫn hợp lệ với 0 nguồn bịa. Mọi gợi ý có nội dung phải kèm ít nhất một nguồn checkpoint hợp lệ.
- **Chỉ số học.** Ít nhất 4/5 học viên ngoài nhóm tự giải thích đúng cả mục tiêu checkpoint và vai trò của một bước sau khi xem gợi ý. Chấm theo hai ý được xác định trước và báo cáo riêng với benchmark.
- **Khóa chuẩn.** Commit mục này và metric spec trước 19:30 Thứ Sáu 27/11/2026, giờ Việt Nam. Giữ nguyên ngưỡng cho hai lượt đánh giá và đến hạn cuối.
- **Trạng thái.** Đã chạy hai lượt với model thật. Lượt 2 đạt 19/20, trong đó 2/3 câu từ chối. Chấm độc lập và đo chỉ số học đang chờ thực hiện.

## §8. Chi phí khi dùng thật *(guide 4.2)*

- Đo riêng 50 phiên mỗi model bằng [GPT‑5.4 mini](cost/simulate-2.csv) và [GPT‑6.2 Sol](cost/simulate-3.csv). [GPT‑4o mini](cost/simulate-1.csv) là lượt tham chiếu.
- Chi phí mỗi tác vụ thành công ước tính **0.00086 USD** với GPT‑5.4 mini và **0.0023 USD** với GPT‑6.2 Sol, cùng dùng tỷ lệ 19/20 từ benchmark GPT‑4o mini.
- Ở kịch bản cơ sở 350 người, chi phí token theo tháng là **2.44 USD** với GPT‑5.4 mini và **6.69 USD** với GPT‑6.2 Sol. [Ba kịch bản và các giả định](cost/cost-estimate.md).
- Giả định tiết kiệm 15,2 phút/người/tháng cần đo trên học viên.

## §9. Rủi ro & an toàn
- Dữ liệu dùng cho luồng checkpoint gồm danh mục Lab và nguồn tài liệu. Stop khi yêu cầu vượt quyền hoặc dữ liệu thiếu căn cứ. Dữ liệu nghiên cứu Preclass chỉ xuất hiện dưới dạng số tổng hợp và ví dụ đã bỏ mã định danh.
- AI chỉ gợi ý cách tự kiểm. Yêu cầu lời giải hoàn chỉnh, bịa nguồn, truy xuất danh tính học viên hoặc bí mật bị chặn.
- Học viên có thể làm sai bước nếu gợi ý lệch checkpoint. Luồng giới hạn theo checkpoint, kiểm ID khái niệm và mã nguồn dẫn trước khi trả, rồi để học viên đối chiếu đề gốc.

## §10. Phân công & changelog

- CP4: Bổ sung thao tác tự kiểm cho ba checkpoint, chạy Lượt 2, mô phỏng chi phí và xuất slide.
- Phân công có tên (theo chặng, chia cặp — guide "Cách chia việc"): __
- Dùng AI vào việc gì (2–3 dòng; chi tiết `docs/ai-usage.md`):
- Nhật ký thay đổi — **mọi thay đổi sau CP2 19:30 Thứ Sáu 27/11 phải có dòng ở đây**:

**CP2 → CP4** (vd thu hẹp lát cắt, hỏi thêm người dùng, lần cải tiến trước lượt 2)

| Thời điểm | Đổi gì | Vì sao (trỏ về câu thử / lỗi / bằng chứng nào) |
|---|---|---|
|  |  |  |

**Sau CP4 (đến 23:59 Thứ Bảy 28/11)** (sửa theo góp ý — không sửa chuẩn "đạt", câu thử, số bằng chứng, kết quả các lượt đã chạy)

| Thời điểm | Đổi gì | Vì sao |
|---|---|---|
|  |  |  |
