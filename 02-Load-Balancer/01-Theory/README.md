# 01 — Theory

## 1. Load Balancer là gì?

Load Balancer (LB) là một thành phần nằm giữa client và các backend server, có nhiệm vụ phân phối request đến server phù hợp.

```text
Client -> Load Balancer -> Server 1 / Server 2 / Server 3
```

Mục tiêu:

- tăng số lượng request xử lý được
- tránh overload cho một node
- tăng resilience và availability

---

## 2. Khi nào cần Load Balancer?

Khi:

- traffic tăng quá mức một server xử lý được
- cần chạy nhiều instance cùng lúc
- cần tách biệt public endpoint với backend
- cần nâng cấp / rollback mà không gián đoạn dịch vụ

---

## 3. Cấu trúc đơn giản

```text
Internet
   |
   v
LB
   |--- App A
   |--- App B
   |--- App C
```

Một LB có thể là:

- reverse proxy (Nginx, HAProxy)
- cloud load balancer (AWS ALB/NLB, Nginx Plus, F5)
- layer 4 hoặc layer 7 load balancer

---

## 4. Layer 4 vs Layer 7

### Layer 4
- phân phối theo IP/Port
- nhanh, đơn giản
- không quan tâm nội dung HTTP

### Layer 7
- phân phối theo URL, host, header, cookie, content
- linh hoạt hơn
- phù hợp cho routing theo API, route, service

---

## 5. Ví dụ thực tế

```text
https://example.com/api/orders
      |
      v
Load Balancer
      |
      +--> orders-1
      +--> orders-2
      +--> orders-3
```

LB có thể gửi các request đến các instance dựa trên thuật toán nào đó như round robin hoặc least connections.

---

## 6. Kết luận

Load balancer là nền tảng quan trọng khi bạn cần hệ thống có khả năng mở rộng và chịu lỗi tốt hơn. Nó là bước chuyển từ single instance sang multi-instance deployment.
