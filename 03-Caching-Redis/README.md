# Bài 3 — Caching & Redis

## 1. Mục tiêu

Sau bài học này, bạn cần nắm vững và vận dụng được các kiến thức:

- Khái niệm **Caching** và tầm quan trọng của nó trong thiết kế hệ thống lớn (System Design).
- Sự khác biệt về latency giữa RAM, Disk, Network và Database.
- Các mô hình Cache: Local Cache (In-Memory) vs Distributed Cache (Redis, Memcached).
- Các thuật toán Eviction phổ biến (LRU, LFU, FIFO, TTL).
- Chi tiết kiến trúc **Redis**: Data Structures, Single-threaded Event Loop, RDB vs AOF persistence.
- Các chiến lược Cache (Cache Strategies): Cache-Aside, Read-Through, Write-Through, Write-Behind (Write-Back), Write-Around.
- Quản lý TTL (Time-To-Live) và tránh sự cố Cache Avalanche bằng TTL Jitter.
- Kỹ thuật **Cache Invalidation** và cách khắc phục các bài toán kinh điển: Cache Penetration, Cache Breakdown (Thundering Herd), Cache Avalanche.
- Thực hành tích hợp **Spring Boot + Redis** (sử dụng `@Cacheable`, `RedisTemplate`, Jackson serialization, Connection pool).
- Kiến trúc Redis ở quy mô lớn: **Redis Sentinel** (High Availability) và **Redis Cluster** (Sharding / Partitioning).
- Mô hình kết hợp Load Balancer + App Cluster + Redis Centralized Session / Distributed Cache.
- Lab thực hành đo đạc benchmark (wrk / JMeter) trước và sau khi có Cache.
- Cấu hình Production, Monitoring (Prometheus + Grafana), Security và xử lý Hot Key / Big Key.
- Bộ 15+ câu hỏi phỏng vấn System Design thực tế về Caching & Redis.

---

## 2. Tổng quan

Caching là kỹ thuật lưu trữ tạm thời các dữ liệu được truy xuất thường xuyên vào bộ nhớ có tốc độ đọc/ghi cực nhanh (thường là RAM), nhằm giảm thời gian phản hồi (latency) và giảm tải cho hệ thống phía sau (Database hoặc downstream services).

```text
Client -> Load Balancer -> App Servers -> [ Redis Cache (RAM) ] (Latency < 1ms)
                               |
                               +--------> [ Database (Disk) ]  (Latency ~10-50ms)
```

Khi request tới:
1. App kiểm tra dữ liệu trong **Cache**:
   - **Cache Hit**: Trả về dữ liệu lập tức từ RAM.
   - **Cache Miss**: Đọc dữ liệu từ Database, lưu bản sao vào Cache rồi mới trả về Client.

---

## 3. Tại sao Caching là "Vũ Khí Bắt Buộc" trong System Design?

- **Giảm Latency khủng giội**: Đọc từ RAM mất vài microsecond hoặc ~1ms qua network, trong khi đọc từ Disk DB mất từ 10ms đến vài trăm ms.
- **Tăng Throughput (QPS)**: Một server Redis đơn có thể xử lý 100.000+ QPS (queries per second), vượt xa giới hạn đọc của Relational Database.
- **Bảo vệ Database**: Ngăn ngừa hiện tượng DB bị quá tải CPU/IOPS khi có hàng triệu người dùng truy cập đồng thời.
- **Tối ưu chi phí infrastructure**: Scale RAM cho Redis rẻ và hiệu quả hơn rất nhiều so với scale-up/scale-out database read-replicas.

---

## 4. Các chủ đề bài học

1. [01-Theory/README.md](./01-Theory/README.md) — Lý thuyết tổng quan về Caching & Latency numbers
2. [02-Why-Caching/README.md](./02-Why-Caching/README.md) — Lý do cần Caching & Khi nào không nên cache
3. [03-Cache-Types/README.md](./03-Cache-Types/README.md) — Phân loại Cache & Thuật toán Eviction (LRU, LFU, FIFO)
4. [04-Redis/README.md](./04-Redis/README.md) — Tổng quan về Redis, Data Structures & Persistence (RDB/AOF)
5. [05-Cache-Strategies/README.md](./05-Cache-Strategies/README.md) — Các chiến lược Caching (Cache-Aside, Write-Through, Write-Back, Write-Around)
6. [06-TTL/README.md](./06-TTL/README.md) — TTL, Expiration Policies & TTL Jitter
7. [07-Cache-Invalidation/README.md](./07-Cache-Invalidation/README.md) — Invalidation, Cache Penetration, Breakdown, Avalanche & Giải pháp
8. [08-Spring-Boot-Redis/README.md](./08-Spring-Boot-Redis/README.md) — Tích hợp Spring Boot + Redis chi tiết
9. [09-Distributed-Cache/README.md](./09-Distributed-Cache/README.md) — Redis High Availability (Sentinel) & Scale (Cluster, Hash Slots)
10. [10-Load-Balancer-Redis/README.md](./10-Load-Balancer-Redis/README.md) — Kiến trúc Load Balancer + Redis Session Store + Two-Tier Cache
11. [11-Lab/README.md](./11-Lab/README.md) — Thực hành Lab Docker Compose, Spring Boot & Benchmark wrk
12. [12-Production/README.md](./12-Production/README.md) — Cấu hình Production, Monitoring Grafana, Hot key & Security
13. [13-Interview/README.md](./13-Interview/README.md) — Bộ câu hỏi phỏng vấn tuyển dụng System Design về Caching & Redis

---

## 5. Kiến trúc mẫu hệ thống sử dụng Cache

```text
                                  +-------------------+
                                  |   Browser/Client  |
                                  +---------+---------+
                                            |
                                            v
                                  +-------------------+
                                  |   CDN / Edge      | (Static Assets)
                                  +---------+---------+
                                            |
                                            v
                                  +-------------------+
                                  |   Load Balancer   | (Nginx / ALB)
                                  +---------+---------+
                                            |
                         +------------------+------------------+
                         |                                     |
                         v                                     v
               +-------------------+                 +-------------------+
               |   App Instance 1  |                 |   App Instance 2  |
               +---------+---------+                 +---------+---------+
                         |                                     |
                         +------------------+------------------+
                                            |
                         +------------------+------------------+
                         |                                     |
                         v                                     v
           +---------------------------+         +---------------------------+
           |   Redis Cluster (RAM)     |         |   Relational DB (PostgreSQL)|
           |  (Centralized Cache &     |         |  (Master - Replica)       |
           |   Session Store)          |         |                           |
           +---------------------------+         +---------------------------+
```

---

## 6. Mẹo học hiệu quả

- Hãy coi Cache như một bộ nhớ tạm "không thể tin tưởng tuyệt đối 100%": Dữ liệu trong Cache có thể bị xoá bất cứ lúc nào (Eviction/TTL/Restart).
- Luôn suy nghĩ về **Consistency Trade-off**: Chọn tốc độ cao hay chọn dữ liệu luôn mới nhất?
- Nhớ câu nói nổi tiếng của Phil Karlton: *"There are only two hard things in Computer Science: cache invalidation and naming things."*
- Khi thực hành, hãy mở `redis-cli` và thử từng command tương tác trực tiếp với Redis để hiểu rõ bản chất.

---

## 7. Gợi ý học theo trình tự

1. Đọc kĩ bài 01 đến 03 để nắm bản chất lý thuyết và các chỉ số Latency.
2. Tìm hiểu sâu Redis ở bài 04 & 05 (các chiến lược Caching).
3. Đọc bài 06 & 07 để làm chủ các sự cố kinh điển (Penetration, Breakdown, Avalanche).
4. Thực hành làm Lab ở bài 08 & 11 với Spring Boot và Docker.
5. Tìm hiểu cách scale Redis ở bài 09, 10 & 12 cho môi trường Production.
6. Luyện tập với bộ câu hỏi phỏng vấn ở bài 13.

---

## 8. Checklist hoàn thành bài học

- [ ] Phân biệt được Local Cache (Caffeine) và Distributed Cache (Redis).
- [ ] Giải thích được tại sao đọc RAM nhanh hơn đọc Disk/DB hàng ngàn lần.
- [ ] Thành thạo các lệnh căn bản của Redis (`GET`, `SET`, `HSET`, `ZADD`, `EXPIRE`).
- [ ] Phân biệt rõ Cache-Aside, Write-Through, Write-Back và Write-Around.
- [ ] Hiểu Cache Penetration, Cache Breakdown, Cache Avalanche và cách phòng chống.
- [ ] Biết cách dùng Spring Boot `@Cacheable`, `@CacheEvict` với `RedisTemplate`.
- [ ] Hiểu nguyên lý làm việc của Redis Sentinel (HA) và Redis Cluster (Hash Slots).
- [ ] Sử dụng Redis làm Centralized Session Store đằng sau Load Balancer.
- [ ] Trả lời trôi chảy các câu hỏi phỏng vấn về Caching trong System Design.
