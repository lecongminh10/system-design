# 09 — Docker

## 1. Vì sao cần Docker?

Docker giúp ta chạy nhiều instance của cùng một service trên cùng máy với cách tách biệt rõ ràng.

---

## 2. Ví dụ kiến trúc

```text
Docker Host
  |
  +--> app-1 :8081
  +--> app-2 :8082
  +--> app-3 :8083
  +--> nginx :80
```

---

## 3. Docker Compose ví dụ

```yaml
services:
  app1:
    build: .
    ports:
      - "8081:8080"

  app2:
    build: .
    ports:
      - "8082:8080"

  nginx:
    image: nginx:latest
    ports:
      - "80:80"
```

---

## 4. Lợi ích

- nhanh chóng deploy nhiều instance
- dễ test với môi trường giống nhau
- khả năng scale bằng docker compose hoặc orchestration

---

## 5. Lưu ý

Nếu app lưu state trong memory thì cần phải cân nhắc:

- sticky session
- external session store
- stateless design

---

## 6. Kết luận

Docker giúp mô phỏng kiến trúc load balancing rất hiệu quả trong lab và production mẫu.
