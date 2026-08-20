# Bài 2 — Load Balancer

## 1. Mục tiêu

Sau bài này, bạn cần hiểu và vận dụng được:

- Load Balancer là gì, nơi nó đứng trong hệ thống
- Vì sao cần load balancer khi traffic tăng
- Horizontal scaling và các mô hình scale-out
- Các thuật toán load balancing phổ biến
- Health check, failover và độ sẵn sàng
- Sticky session và trade-off của nó
- Cách dùng Nginx làm load balancer
- Cách chạy nhiều instance bằng Docker
- Cách triển khai với Spring Boot monolith
- Lab thực hành và câu hỏi phỏng vấn

---

## 2. Tổng quan

Load Balancer là thành phần đặt giữa client và nhiều backend server, có nhiệm vụ phân phối request đều nhau để:

- tăng throughput
- giảm tải cho từng server
- tăng khả dụng và độ tin cậy
- tránh single point of failure

```text
Client
  |
  v
Load Balancer
  |-----------\
  |           \
  v            v
App 1        App 2
  |            |
  v            v
App 3        App 4
```

Khi một ứng dụng chỉ có 1 instance, server có thể bị quá tải hoặc crash. Khi chạy nhiều instance, load balancer sẽ quyết định request đi tới instance nào để đạt hiệu suất tốt hơn.

---

## 3. Tại sao cần Load Balancer?

- Tăng khả năng xử lý nhiều request cùng lúc
- Chia đều tải giữa các node
- Giảm rủi ro một node chết làm toàn hệ thống mất tác vụ
- Dễ dàng scale theo chiều ngang (horizontal scaling)
- Hỗ trợ nâng cấp, rollout, maintenance không làm downtime

---

## 4. Các chủ đề cần học

1. [01-Theory/README.md](./01-Theory/README.md) — Tổng quan lý thuyết
2. [02-Why-Load-Balancer/README.md](./02-Why-Load-Balancer/README.md) — Lý do cần LB
3. [03-Horizontal-Scaling/README.md](./03-Horizontal-Scaling/README.md) — Scale ngang
4. [04-Load-Balancing-Algorithms/README.md](./04-Load-Balancing-Algorithms/README.md) — Thuật toán phân tải
5. [05-Health-Check/README.md](./05-Health-Check/README.md) — Health check
6. [06-Failover/README.md](./06-Failover/README.md) — Failover
7. [07-Sticky-Session/README.md](./07-Sticky-Session/README.md) — Sticky session
8. [08-Nginx/README.md](./08-Nginx/README.md) — Nginx làm load balancer
9. [09-Docker/README.md](./09-Docker/README.md) — Chạy nhiều instance bằng Docker
10. [10-Spring-Boot-Monolith/README.md](./10-Spring-Boot-Monolith/README.md) — Spring Boot monolith phía sau LB
11. [11-Lab/README.md](./11-Lab/README.md) — Thực hành lab
12. [12-Production/README.md](./12-Production/README.md) — Triển khai production
13. [13-Interview/README.md](./13-Interview/README.md) — Câu hỏi phỏng vấn
14. [project/README.md](./project/README.md) — Project thực hành Nginx + Docker + 3 backend instance

---

## 5. Kiến trúc mẫu

```text
Internet
   |
   v
[DNS / Domain]
   |
   v
[Load Balancer / Nginx]
   |---------------------|
   |                     |
   v                     v
App Server 1         App Server 2
   |                     |
   +---------+-----------+
             |
             v
         Database / Cache
```

Trong ví dụ này:

- client chỉ tiếp cận thông qua domain hoặc IP của load balancer
- load balancer gửi request đến một backend phù hợp
- backend có thể là nhiều instance cùng chạy một service
- database/cache vẫn là tầng phụ thuộc chung

---

## 6. Mẹo học hiệu quả

- Học thuật toán phân tải qua ví dụ số lượng request lớn
- Thử hình dung khi 1 node chết, 1 node quá tải, 1 node chạy maintenance
- Đề cập tới trade-off giữa độ đồng đều, độ phức tạp và session affinity
- Luôn kết nối với Nginx, Docker, Kubernetes và deployment thực tế

---

## 7. Gợi ý học theo trình tự

1. Hiểu khái niệm và mục tiêu
2. Nắm rõ vì sao cần load balancing
3. Học thuật toán phân tải
4. Học health check và failover
5. Học sticky session và session management
6. Thực hành Nginx + Docker + Spring Boot
7. Tự làm lab và ghi chú interview

---

## 8. Bài học quan trọng

Load Balancer không chỉ là CPU/traffic distributor. Nó còn là công cụ giúp chúng ta:

- giảm điểm lỗi đơn lẻ
- tăng throughput và độ sẵn sàng
- hỗ trợ rollout và maintenance
- tạo nền tảng cho microservices và hệ thống phân tán

---

## 9. Nền tảng để học tiếp theo

Sau khi học Load Balancer, bạn có thể tiếp tục với:

- Caching / Redis
- Database Replication
- Database Sharding
- Message Queue / Kafka
- API Gateway
- Microservices
- Rate Limiting
- High Availability / Fault Tolerance

---

## 10. Checklist cuối bài

- [ ] Tôi biết Load Balancer làm gì
- [ ] Tôi biết vì sao cần scale ngang
- [ ] Tôi phân biệt được round robin, least connection, IP hash
- [ ] Tôi hiểu health check và failover
- [ ] Tôi biết sticky session là gì và khi nào dùng
- [ ] Tôi có thể cấu hình Nginx upstream
- [ ] Tôi có thể chạy nhiều instance bằng Docker
- [ ] Tôi có thể mô tả kiến trúc production
