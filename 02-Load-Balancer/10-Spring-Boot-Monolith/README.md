# 10 — Spring Boot Monolith

## 1. Mô hình monolith phía sau Load Balancer

Trong một service monolith, bạn có thể chạy nhiều instance cùng một lúc:

```text
LB
 |--- Spring Boot instance 1
 |--- Spring Boot instance 2
 |--- Spring Boot instance 3
```

---

## 2. Cấu hình ứng dụng

Một ứng dụng Spring Boot thường lắng nghe trên cổng:

```properties
server.port=8080
```

Nếu chạy nhiều instance trên một máy, cần mapping port khác nhau:

- 8081
- 8082
- 8083

---

## 3. Vấn đề session

Nếu app dùng session trên server memory, cần:

- sticky session
- distributed session store
- JWT / token-based auth

---

## 4. Khi nào dùng monolith + LB?

Khi:

- đang cần scale ngang ban đầu
- hệ thống chưa tách service
- cần tăng khả năng chịu tải mà không đổi kiến trúc quá lớn

---

## 5. Kết luận

Spring Boot monolith vẫn có thể hưởng lợi từ Load Balancer nếu được thiết kế đúng và có phân tách rõ ràng giữa stateless logic và session management.
