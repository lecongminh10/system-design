# 02 — Why Load Balancer?

## 1. Vấn đề khi chỉ có một server

Một server duy nhất dễ gặp các vấn đề:

- quá tải khi traffic tăng
- single point of failure
- khó nâng cấp hoặc maintenance
- không thể scale theo chiều ngang

---

## 2. Lợi ích chính

### 2.1 Tăng khả năng chịu tải

Dùng nhiều backend instances, traffic được chia đều, mỗi node chịu một phần nhỏ.

### 2.2 Tăng độ sẵn sàng

Nếu một node chết, LB vẫn chuyển request sang node còn sống.

### 2.3 Dễ maintenance

Có thể tắt một node để deploy mới mà không làm gián đoạn hệ thống.

### 2.4 Hỗ trợ scale theo chiều ngang

Thêm instance mới không cần thay đổi client, vì client chỉ giao tiếp với LB.

---

## 3. Ví dụ điển hình

```text
1. User gửi request tới example.com
2. DNS trỏ tới IP của LB
3. LB chọn 1 backend
4. Backend xử lý và trả response
```

Nếu backend A chết, LB không gửi tiếp request cho A nữa.

---

## 4. Trade-off

Load balancer mang lại lợi ích lớn nhưng cần cân nhắc:

- thêm một điểm trung gian
- cần health check và failover
- sticky session có thể sinh ra vấn đề đồng nhất dữ liệu
- cần tối ưu cấu hình cho production

---

## 5. Kết luận

Load Balancer không chỉ để "chia tải" mà còn là một phần quan trọng của kiến trúc high availability.
