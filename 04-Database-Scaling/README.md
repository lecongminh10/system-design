# Bài 4 — Database Scaling (Mở Rộng Cơ Sở Dữ Liệu)

## 1. Mục tiêu bài học

Sau khi hoàn thành module này, bạn sẽ nắm vững:
- **Nguyên nhân Database trở thành Bottleneck**: Tại sao Database thường là thành phần sụp đổ đầu tiên khi hệ thống tăng trưởng (Disk I/O, RAM, Connection limits, Lock contention).
- **Chiến lược Vertical Scaling vs Horizontal Scaling**: Khi nào nên nâng cấp phần cứng (Scale Up) và khi nào bắt buộc phải phân tán ra nhiều node (Scale Out).
- **Database Replication**: Nguyên lý hoạt động của Primary-Replica (Master-Slave), Synchronous vs Asynchronous replication, xử lý Replication Lag.
- **Read Replica & Read/Write Splitting**: Kiến trúc phân tách truy vấn Đọc/Ghi ở tầng Ứng dụng (Spring Boot `AbstractRoutingDataSource`) và tầng Proxy (ProxySQL / PgBouncer).
- **Connection Pooling**: Cơ chế tối ưu kết nối DB với HikariCP / PgBouncer và công thức toán học tính toán Max Pool Size tối ưu.
- **Database Indexing**: Cấu trúc B+Tree, Composite Index, Leftmost Prefix Rule và trade-off giữa tốc độ Read vs Insert/Update.
- **In-Memory Caching Offload**: Giảm tải cho DB bằng Redis Cache-Aside và chiến lược chống Cache Avalanche / Breakdown / Penetration.
- **Database Sharding (Horizontal Partitioning)**: Phân mảnh dữ liệu theo Sharding Key, Hash/Range/Directory Sharding, Consistent Hashing, Snowflake ID và xử lý Cross-Shard Query / Distributed Transactions.
- **Thực hành Mini Project**: Xây dựng ứng dụng Spring Boot + MySQL Master-Replica + Redis với Docker Compose và kiểm thử Read/Write Splitting tự động.

---

## 2. Tổng quan kiến trúc Database Scaling Roadmap

Khi một hệ thống đi từ **1.000 users** lên **10.000.000+ users**, chiến lược mở rộng database tuân theo lộ trình thực tế sau:

```text
[1. Single DB Node] 
       │ (Tăng query/giây & dung lượng)
       v
[2. DB Optimization & Indexing + Connection Pool]
       │ (Hết khả năng tối ưu query)
       v
[3. Add Redis Cache (In-Memory Offloading)]
       │ (Traffic Read vượt quá khả năng 1 DB)
       v
[4. Master-Replica (Read/Write Splitting)]
       │ (Write traffic quá lớn & Data size > 1TB)
       v
[5. Vertical Partitioning / Database Sharding (Scale Out)]
```

---

## 3. Danh sách các bài học

1. [01-Database-Scaling/README.md](./01-Database-Scaling/README.md) — Tổng Quan Database Scaling & Nguyên Nhân DB Bottleneck
2. [02-Vertical-vs-Horizontal-Scaling/README.md](./02-Vertical-vs-Horizontal-Scaling/README.md) — Vertical Scaling (Scale Up) vs Horizontal Scaling (Scale Out)
3. [03-Database-Replication/README.md](./03-Database-Replication/README.md) — Database Replication (Primary/Replica, Sync vs Async, Replication Lag)
4. [04-Read-Replica/README.md](./04-Read-Replica/README.md) — Read Replica, High Availability & Automatic Failover
5. [05-Read-Write-Splitting/README.md](./05-Read-Write-Splitting/README.md) — Read/Write Splitting (Application Routing vs Proxy Routing)
6. [06-Connection-Pool/README.md](./06-Connection-Pool/README.md) — Connection Pooling (HikariCP, PgBouncer & Sizing Math)
7. [07-Database-Index/README.md](./07-Database-Index/README.md) — Database Indexing (B+Tree, Composite Index & Query Optimization)
8. [08-Redis-Cache/README.md](./08-Redis-Cache/README.md) — Offloading DB Đọc bằng Redis Cache & Bảo Vệ Database
9. [09-Database-Sharding/README.md](./09-Database-Sharding/README.md) — Database Sharding (Partitioning, Sharding Keys, Consistent Hashing & Distributed DB)
10. [10-Mini-Project/README.md](./10-Mini-Project/README.md) — Mini Project Thực Hành: Spring Boot + MySQL Master-Replica + Redis + Read/Write Splitting

---

## 4. Mô hình Tổng Thể Hệ Thống Sau Khi Scaling

```text
                                     +-------------------+
                                     |   Client App /    |
                                     |   Web Frontend    |
                                     +---------+---------+
                                               |
                                               v
                                     +-------------------+
                                     |   Load Balancer   |
                                     +---------+---------+
                                               |
                                               v
                                     +-------------------+
                                     |   App Cluster     |
                                     |  (Spring Boot)    |
                                     +----+---------+----+
                                          |         |
                     +--------------------+         +--------------------+
                     | (Read/Write Cache)                | (Read/Write DB)
                     v                                   v
           +-------------------+               +-------------------+
           |    Redis Cache    |               |  DB Connection    |
           |     Cluster       |               | Pool (HikariCP)   |
           +-------------------+               +---------+---------+
                                                         |
                                                         v
                                               +-------------------+
                                               |   ProxySQL /      |
                                               |   Middleware      |
                                               +----+---------+----+
                                                    |         |
                                   WRITE (Queries)  |         |  READ (Queries)
                                                    v         v
                                        +---------------+  +---------------+
                                        | Master DB     |  | Read Replica  |
                                        | (Primary)     |  | (Secondary)   |
                                        +-------+-------+  +---------------+
                                                | Replication
                                                +----------------->
```
