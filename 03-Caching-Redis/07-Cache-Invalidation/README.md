# 07 — Cache Invalidation & Sự Cố Kinh Điển (Penetration, Breakdown, Avalanche)

## 1. Thách Thức Cache Invalidation

Chiến lược **Cache Invalidation** (Vô hiệu hoá Cache) giải quyết câu hỏi: *"Làm sao để xóa hoặc làm mới dữ liệu trong Cache ngay khi dữ liệu gốc ở Database bị thay đổi?"*

> *"There are only two hard things in Computer Science: cache invalidation and naming things."* — Phil Karlton

### Các phương pháp Invalidation:
1. **Hard Invalidation (`DEL` / `UNLINK`)**: Xoá hoàn toàn key khỏi Redis khi có thao tác UPDATE/DELETE ở DB. Lần đọc sau sẽ nạp lại dữ liệu mới từ DB.
2. **Soft Invalidation (Logical Expiration / Tombstone)**: Không xoá key ngay mà đánh dấu thuộc tính `isExpired = true` trong giá trị lưu trữ. Một thread ngầm sẽ tự nạp lại dữ liệu mới trong khi vẫn trả về dữ liệu cũ cho client.
3. **Event-driven Invalidation (CDC - Change Data Capture)**: Sử dụng Debezium hoặc Message Queue (Kafka/RabbitMQ) để nghe sự kiện ghi từ DB Binlog và phát tín hiệu xoá Cache ở Redis bất đồng bộ.

---

## 2. Ba Sự Cố Kinh Điển Trong Caching & Cách Khắc Phục

### 2.1 Cache Penetration (Xuyên Thấu Cache)

#### Hiện tượng:
Hacker cố tình tấn công gửi hàng ngàn request tìm kiếm các Key **không hề tồn tại** cả trong Cache lẫn Database (Ví dụ: `GET /orders/id=-99999`).
- Do key không tồn tại, Cache trả về `Miss`.
- Request đâm thẳng xuống Database. DB cũng trả về `NotFound`.
- Kết quả: Cache hoàn toàn vô dụng, Database bị đánh sập do chịu 100% traffic rác.

```text
Attacker (Key = -9999) ---> Cache (Miss) ---> Database (Not Found) ---> Overload DB!
```

#### Giải Pháp:

##### Solution A: Cache Null Value (Lưu giá trị rác/rỗng)
Khi DB trả về `NotFound`, ta chủ động lưu giá trị rỗng (`NULL` hoặc `"{}"`) vào Redis với TTL ngắn (ví dụ 1 - 5 phút).

```java
String value = redis.get(key);
if (value == null) {
    Object dbData = db.findByKey(key);
    if (dbData == null) {
        redis.set(key, "NULL_PLACEHOLDER", 300); // Cache NULL trong 5 phút
        return null;
    }
}
```

##### Solution B: Bloom Filter (Bộ lọc xác suất)
**Bloom Filter** là một cấu trúc dữ liệu tiết kiệm RAM tuyệt đối, cho phép kiểm tra một Key **chắc chắn KHÔNG tồn tại** hay **CÓ THỂ tồn tại**.
- Trước khi chạm tới Cache hay DB, request phải chui qua Bloom Filter.
- Nếu Bloom Filter báo key không tồn tại -> Trả về error lập tức!

```text
Request ---> [ Bloom Filter ] --(Không tồn tại)--> Trả về 404 lập tức!
                     |
                 (Có thể tồn tại)
                     |
                     v
             [ Redis Cache ] ---> [ Database ]
```

---

### 2.2 Cache Breakdown (Sập Key Nóng / Hot Key Expiry / Thundering Herd)

#### Hiện tượng:
Một Key cực kỳ HOT (Ví dụ: Thông tin trận chung kết World Cup hoặc Flash Sale iPhone) nhận **50.000 QPS**.
Ngay thời điểm Key này vừa **hết hạn TTL**, cùng một lúc 50.000 request bị Cache Miss và đồng loạt xông vào Database để query lại dữ liệu. Hiện tượng này gọi là **Thundering Herd**.

```text
Hot Key hết hạn TTL!
50k Requests ---> Cache (MISS!) ---> 50k Queries đâm đồng thời vào DB cùng 1 milisecond! ---> Sập DB!
```

#### Giải Pháp:

##### Solution A: Distributed Mutex Lock (Khóa phân tán)
Chỉ cho phép **1 request duy nhất** có Lock được phép truy vấn Database để nạp lại Cache. 49.999 request còn lại phải chờ (sleep) một chút rồi đọc lại Cache.

```java
public String getHotData(String key) {
    String data = redis.get(key);
    if (data == null) {
        // Thử lấy Distributed Lock bằng Redis SETNX
        if (redis.setIfAbsent("lock:" + key, "1", 5, TimeUnit.SECONDS)) {
            try {
                data = db.get(key);
                redis.set(key, data, 1800);
            } finally {
                redis.delete("lock:" + key);
            }
        } else {
            Thread.sleep(50);
            return getHotData(key); // Retry đọc lại từ Cache
        }
    }
    return data;
}
```

##### Solution B: Logical Expiration (Thời hạn ảo ngầm)
Không bao giờ cài đặt TTL cứng trên Redis (`EXPIRE`). Trong dữ liệu JSON lưu vào Redis, bổ sung thêm field `expire_atTimestamp`. Khi App đọc thấy `now > expire_atTimestamp`, App tạo một luồng bất đồng bộ (Async Thread) đi cập nhật DB, còn request hiện tại vẫn trả về dữ liệu cũ mượt mà.

---

### 2.3 Cache Avalanche (Tuyết Lở Cache)

#### Hiện tượng:
- Trường hợp 1: Hàng trăm ngàn Key đồng loạt hết hạn ở cùng một thời điểm (Mass Expiration).
- Trường hợp 2: Cụm máy chủ Redis bị crash hoàn toàn.

Khiến cho **toàn bộ traffic** của hệ thống đổ dồn xuống Database khiến DB gục ngã dây chuyền.

```text
Cụm Redis Crash / Hàng triệu Key đồng loạt hết hạn cùng lúc!
                         |
                         v
              [ Tuyết Lở Cache Avalanche ]
                         |
                         v
   Toàn bộ Traffic đâm xuống Database ---> Hệ thống sập toàn diện!
```

#### Giải Pháp:
1. **TTL Jitter**: Ngẫu nhiên hóa thời gian hết hạn TTL (đã học ở Bài 06).
2. **Triển khai Redis High Availability**: Sử dụng **Redis Sentinel** hoặc **Redis Cluster** có Node Replication để tự động Failover khi Node chính bị sập.
3. **Circuit Breaker & Rate Limiting**: Sử dụng Resilience4j / Sentinel để ngắt mạch, chặn bớt request rác hoặc trả về fallback data tạm thời khi phát hiện DB bị quá tải.

---

## 3. Tổng Kết Bảng Tra Cứu Sự Cố

| Sự Cố | Nguyên Nhân | Dấu Hiệu | Giải Pháp Tối Ưu |
| :--- | :--- | :--- | :--- |
| **Cache Penetration** | Request tìm Key rác không tồn tại | DB quá tải vì các câu query trả về rỗng | **Bloom Filter** hoặc **Cache Null Values** |
| **Cache Breakdown** | Single Hot Key bị hết hạn đột ngột | DB bị đột biến CPU/IOPS tại 1 thời điểm | **Distributed Lock (Mutex)** hoặc **Logical Expiration** |
| **Cache Avalanche** | Mất hàng loạt Key hoặc Redis Cluster sập | Toàn bộ hệ thống sập hoàn toàn | **TTL Jitter**, **Redis Cluster HA**, **Circuit Breaker** |
