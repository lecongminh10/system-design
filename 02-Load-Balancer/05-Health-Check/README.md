# 05 — Health Check

## 1. Health check là gì?

Health check là cơ chế kiểm tra xem một backend có đang sẵn sàng phục vụ request hay không.

---

## 2. Tại sao cần Health Check?

- backend có thể crash hoặc timeout
- server quá tải hoặc không ready
- cần tạm thời loại bỏ instance khỏi nhóm upstream

---

## 3. Active Health Check

LB chủ động gửi HTTP/TCP request để kiểm tra backend.

Ví dụ:

- GET /health
- TCP connect tới port 8080
- gRPC health check

---

## 4. Passive Health Check

LB dựa vào lỗi/timeout thực tế để đánh giá backend không ổn.

---

## 5. Readiness vs Liveness

### Readiness
- backend sẵn sàng nhận request

### Liveness
- backend còn đang sống và không deadlock/crash

---

## 6. Cách LB xử lý

Nếu health check fail:

- bỏ backend khỏi rotation
- gửi request sang node khác
- tự động re-add khi backend phục hồi

---

## 7. Kết luận

Health check là cơ sở để LB hoạt động an toàn và tránh gửi request vào instance chết hoặc không sẵn sàng.
