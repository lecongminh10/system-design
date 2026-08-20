# 11 — Lab

## 1. Mục tiêu lab

Thực hành chạy 2–3 backend instance và một Nginx load balancer phía trước.

---

## 2. Lab đề xuất

### Bước 1: Tạo ứng dụng backend
- chạy 3 instance của cùng một service
- bind port 8081, 8082, 8083

### Bước 2: Cấu hình Nginx upstream
- upstream app_backend
- proxy_pass http://app_backend

### Bước 3: Kiểm tra request
- gửi request nhiều lần
- xem request phân phối như thế nào

### Bước 4: Thử health check
- tắt 1 instance
- xem Nginx còn chuyển request tới instance nào

### Bước 5: Kiểm tra sticky session
- nếu dùng session, kiểm tra request từ cùng client có đi cùng backend không

---

## 3. Câu hỏi lab

- Khi một node chết, request còn được xử lý không?
- Thuật toán nào đang phân phối?
- Nếu dùng session trong memory, sticky session có cần thiết không?
- Nếu request đến cùng 1 backend quá tải, cần làm gì?

---

## 4. Checklist thực hành

- [ ] Chạy ít nhất 2 instance backend
- [ ] Cấu hình Nginx upstream
- [ ] Gửi request nhiều lần và quan sát
- [ ] Tắt 1 instance và kiểm tra failover
- [ ] Ghi nhận kết quả và rút kinh nghiệm
