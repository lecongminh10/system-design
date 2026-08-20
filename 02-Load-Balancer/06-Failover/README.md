# 06 — Failover

## 1. Failover là gì?

Failover là khả năng chuyển traffic từ node lỗi sang node thay thế hoặc node còn sống.

---

## 2. Active-Active

Nhiều node cùng chạy, cùng phục vụ traffic.

### Ưu điểm
- tốt cho khả năng chịu tải
- không có idle node quá nhiều

### Nhược điểm
- phức tạp hơn

---

## 3. Active-Passive

Một node đang chạy, node còn lại ở chế độ standby.

### Ưu điểm
- đơn giản
- dễ quản lý

### Nhược điểm
- tài nguyên dự phòng chưa sử dụng

---

## 4. Failover trong Load Balancer

Ví dụ:

```text
App 1 -> down
App 2 -> healthy
App 3 -> healthy
```

LB không gửi request tới App 1, chỉ tới App 2, App 3.

---

## 5. Mục tiêu của failover

- giảm downtime
- duy trì tính khả dụng của service
- tăng độ tin cậy khi có sự cố

---

## 6. Kết luận

Failover không chỉ là backup, mà là chiến lược tự động để hệ thống vẫn phục vụ dù một phần backend lỗi.
