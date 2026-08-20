# 10 — Load Balancer & Caching: Kiến Trúc Centralized Session & Two-Tier Cache

## 1. Vị Trí Của Redis Đằng Sau Load Balancer

Ở Bài 02 (Load Balancer), chúng ta đã học cách dùng Nginx phân tải tới nhiều App Instance. Khi chạy nhiều App Instance, hai bài toán lớn nhất nảy sinh là:
1. **Quản lý Session người dùng (User Session Management)**.
2. **Đồng bộ hóa dữ liệu Cache giữa các Node App**.

```text
                                +-------------------+
                                |   Load Balancer   |
                                +---------+---------+
                                          |
                        +-----------------+-----------------+
                        |                                   |
                        v                                   v
             +--------------------+               +--------------------+
             |   App Instance 1   |               |   App Instance 2   |
             | [L1 Cache Caffeine]|               | [L1 Cache Caffeine]|
             +----------+---------+               +----------+---------+
                        |                                   |
                        +-----------------+-----------------+
                                          |
                                          v
                            +---------------------------+
                            |   Redis Cluster (L2 Cache)|
                            |  & Centralized Session    |
                            +---------------------------+
```

---

## 2. Quản Lý Session Tập Trung (Centralized Session Store)

### 2.1 Vấn đề với In-Memory Session của từng Server
Nếu Client đăng nhập ở App Node 1, Session ID được lưu trong RAM của Node 1. Khi request tiếp theo qua Load Balancer bị đẩy sang Node 2 -> Client lập tức bị văng ra trang Login (**Bị bắt đăng nhập lại**)!

### 2.2 So sánh Sticky Session vs Centralized Session

| Tiêu chí | Sticky Session (LB Ingress) | Centralized Session (Redis) |
| :--- | :--- | :--- |
| **Cách hoạt động** | Load Balancer gán Cookie để ép 1 Client luôn tới 1 Node duy nhất | Tất cả App Node đều truy vấn Session từ 1 cụm Redis chung |
| **Tính chịu lỗi (Fault Tolerance)** | **Kém**: Nếu Node đó bị sập, toàn bộ session của người dùng trên node đó bị mất | **Tuyệt vời**: Node sập, LB chuyển client sang Node khác vẫn đọc được Session ở Redis |
| **Khả năng Scale-out** | Gây lệch tải (Uneven Load Distribution) giữa các node | Phân tải đều hoàn hảo 100% |

### 2.3 Cấu hình Spring Session với Redis (`Spring Session Redis`)

Thêm dependency trong Spring Boot:
```xml
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>
```

Thêm Annotation trong App:
```java
@Configuration
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 1800) // Session hết hạn sau 30 phút
public class SessionConfig {
}
```
Nhờ vậy, mọi App Server đều hoàn toàn **Stateless (Phi trạng thái)**. Bạn có thể scale từ 2 lên 100 App Instance chỉ trong vài giây!

---

## 3. Kiến Trúc Two-Tier Cache (Cache Hai Lớp L1/L2)

Để có được tốc độ tối thượng (< 0.1ms), các hệ thống lớn kết hợp **L1 Local Cache** và **L2 Distributed Cache**:

- **L1 Cache (In-Memory Caffeine)**: Nằm ngay trong bộ nhớ Heap của từng App Server (Tốc độ Nanosecond, zero Network latency).
- **L2 Cache (Distributed Redis)**: Nằm ở cụm Redis dùng chung (Tốc độ ~1ms, dữ liệu nhất quán).

```text
Request ---> Check L1 Cache (Caffeine)
                ├── (Hit ~0.01ms)  ---> Trả về luôn!
                └── (Miss)         ---> Check L2 Cache (Redis ~1ms)
                                            ├── (Hit)  ---> Ghi vào L1 ---> Trả về!
                                            └── (Miss) ---> Đọc DB ---> Ghi L2 ---> Ghi L1 ---> Trả về!
```

---

## 4. Đồng Bộ Invalidation Giữa Các L1 Cache Bằng Redis Pub/Sub

Thách thức của L1 Cache: Khi App Node 1 cập nhật dữ liệu ở DB, làm sao để App Node 2 biết mà xoá L1 Cache nội bộ của nó?

### Giải pháp: Redis Pub/Sub Invalidation Broadcast

```text
1. App Node 1 update DB & L2 Redis.
2. App Node 1 bắn Message lên Channel Redis: PUBLISH "cache-invalidate" "product:100"
3. App Node 2 đang SUBSCRIBE channel này nhận được thông báo ---> Lập tức XOÁ key "product:100" khỏi L1 Caffeine của nó!
```

```java
// Logic Listener ở App Node 2:
public void onMessage(String keyToInvalidate) {
    localCaffeineCache.invalidate(keyToInvalidate);
    log.info("Đã xoá L1 Cache cục bộ cho key: {}", keyToInvalidate);
}
```

---

## 5. Kết luận bài học

- Luôn biến App Servers thành **Stateless** bằng cách đưa User Sessions vào **Redis Centralized Session Store**.
- Sử dụng mô hình **Two-Tier Cache (L1 Caffeine + L2 Redis)** cho các dữ liệu siêu nóng.
- Dùng **Redis Pub/Sub** để broadcast tín hiệu vô hiệu hóa L1 Cache giữa các Node App.
