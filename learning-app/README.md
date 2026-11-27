# AI in Action · 14 ngày

Sườn web React + FastAPI cho học viên tự điền. Hai tab **Mindmap** và **Lab** cùng dải 14 ngày nằm ở mép dưới. Cả hai tab dùng cùng một kiểu canvas để thêm, di chuyển và nối các ô. Kéo nền để di chuyển canvas, bấm đúp vào chỗ trống để thêm ô tại đó.

Chọn **Lưu** để ghi bản nháp của tab và ngày đang mở. Có thể chuyển ngày hoặc tab rồi quay lại phần đang sửa trong cùng phiên mở trang. Dữ liệu đã lưu gắn với cookie của trình duyệt. Mở trình duyệt khác hoặc xóa cookie sẽ tạo một không gian mới.

Ghi chú Preclass đã lưu trước đây xuất hiện thành một ô khi mở Lab của ngày tương ứng lần đầu.

## Chạy local

Cần Python 3.10+ và Node.js 22.12+ (khuyên dùng bản LTS). Từ thư mục `learning-app`, mở hai terminal.

**FastAPI**

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

**React**

```sh
cd frontend
npm ci
npm run dev
```

Mở địa chỉ Vite in ra, thường là `http://localhost:5173`. Vite chuyển tiếp `/api` tới FastAPI ở cổng 8000. Tài liệu API ở `http://127.0.0.1:8000/docs`.

## Lưu trữ

SQLite tự tạo file `backend/learning.sqlite3` lúc FastAPI khởi động. Có thể đặt `LEARNING_DB_PATH` để đổi vị trí. Bảng `drafts` lưu từng bản nháp theo bộ ba không gian, ngày và tab. Nội dung của mỗi tab được lưu dưới dạng JSON.

SQLite phù hợp khi bản demo chạy trên một máy chủ. Nếu cần đồng bộ theo tài khoản giữa nhiều thiết bị, bổ sung đăng nhập. Nếu triển khai nhiều máy chủ cần ghi chung, có thể chuyển lớp lưu trữ sang PostgreSQL.

Nội dung 14 ngày bắt đầu trống để nhóm tự bổ sung. Dữ liệu hành vi trong `data/preclass/` có thể dùng riêng để nghiên cứu cách học viên sử dụng pre-class.
