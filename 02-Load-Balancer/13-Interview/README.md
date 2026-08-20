# 13 — Interview

## 1. Câu hỏi thường gặp

### 1. Load balancer là gì?
Load balancer là thành phần phân phối request tới nhiều backend server để tăng khả năng chịu tải và độ sẵn sàng.

### 2. Tại sao cần load balancer?
Để tránh single point of failure, tăng throughput, dễ scale ngang và xử lý traffic cao.

### 3. Round robin khác least connection như thế nào?
Round robin chia theo vòng tròn, còn least connection ưu tiên server có ít kết nối đang hoạt động.

### 4. Sticky session là gì và nguy hiểm ở đâu?
Sticky session giữ client đi cùng một backend. Nó khiến hệ thống dễ mất session khi node chết nếu không quản lý tốt.

### 5. Health check dùng để làm gì?
Để bỏ backend lỗi khỏi vòng phân tải và tự động đưa lại khi server phục hồi.

### 6. Khi nào nên dùng IP hash?
Khi muốn client cụ thể luôn tới cùng backend, ví dụ session dựa trên server memory hoặc cache locality.

### 7. Nginx có thể làm load balancer không?
Có. Nginx thường được dùng làm reverse proxy và load balancer rất phổ biến.

---

## 2. Câu trả lời ngắn gọn

- LB giúp scale ngang
- health check giúp loại node lỗi
- failover giúp bảo toàn service
- sticky session là tùy trường hợp, không phải giải pháp vĩnh viễn
- production cần cả monitoring, timeout, retry và autoscaling

---

## 3. Gợi ý trả lời theo phong cách system design

"Hệ thống của chúng ta có client -> load balancer -> nhiều backend instance. LB chia request dựa trên thuật toán và health check, giúp tăng throughput và độ sẵn sàng. Nếu một backend down, LB chuyển request sang instance khác. Nếu app cần server-side session, ta có thể dùng sticky session hoặc lưu session tập trung trong Redis."
