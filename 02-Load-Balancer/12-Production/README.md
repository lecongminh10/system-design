# 12 — Production

## 1. Cần lưu ý khi triển khai production

- health check phải đúng
- timeout, retry, circuit breaker cần có
- có monitoring / alerting
- có cấu hình failover rõ ràng
- cluster và autoscaling cần được quản lý

---

## 2. Production best practices

### 2.1 Có nhiều instance
- nên có ít nhất 2 instance ở mỗi region / zone

### 2.2 Không cho một backend quá tải
- cần cấu hình thuật toán phù hợp
- theo dõi CPU, memory, latency

### 2.3 Dùng health checks chính xác
- `/health` cần trả đúng trạng thái
- type 200 OK khi backend ready

### 2.4 Quản lý session
- ưu tiên JWT / distributed session nếu scale ngang

---

## 3. Mẹo triển khai

- Không để LB là điểm single point of failure nếu production cần HA
- Có thể dùng load balancer cluster hoặc cloud-managed LB
- Kết hợp với monitoring và autoscaling

---

## 4. Kết luận

Production không chỉ là “có Nginx ở trước app”, mà là có cả health check, failover, observability và session strategy.
