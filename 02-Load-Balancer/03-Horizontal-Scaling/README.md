# 03 — Horizontal Scaling

## 1. Scale ngang là gì?

Scale ngang nghĩa là tăng số lượng server cùng làm một nhiệm vụ thay vì tăng sức mạnh cho một server duy nhất.

```text
Trước: 1 máy mạnh
Sau: 3 máy vừa/nhỏ, chạy song song
```

---

## 2. So sánh Vertical vs Horizontal Scaling

### Vertical Scaling
- nâng RAM/CPU/storage
- đơn giản
- giới hạn vật lý

### Horizontal Scaling
- thêm instance mới
- phù hợp với cloud / container
- dễ mở rộng theo nhu cầu

---

## 3. Khi nào scale ngang?

- traffic tăng mạnh
- cần độ sẵn sàng cao
- có nhiều pod/container/service cùng chạy
- cần deploy theo nhóm và có auto scaling

---

## 4. Ví dụ kiến trúc scale ngang

```text
Client
  |
  v
LB
  |--- App 1
  |--- App 2
  |--- App 3
```

Nếu App 2 bị lỗi, LB bỏ qua nó và chuyển request sang App 1 / App 3.

---

## 5. Lưu ý

Scale ngang yêu cầu:

- stateless application nếu có thể
- session management rõ ràng
- shared storage / cache / database phù hợp
- monitoring và health checks

---

## 6. Kết luận

Horizontal scaling là cách phổ biến nhất để xây dựng hệ thống chạy ổn định dưới áp lực lớn.
