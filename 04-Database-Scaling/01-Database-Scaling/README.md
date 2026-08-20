# 01 — Database Scaling: Tổng Quan & Điểm Nghẽn (Bottlenecks)

## 1. Tại sao Database luôn là điểm nghẽn (Bottleneck) số 1?

Trong kiến trúc ứng dụng hiện đại, các Stateless Application Server (như Spring Boot, Node.js, Go app) rất dễ dàng mở rộng theo chiều ngang (Horizontal Scale) chỉ bằng cách khởi tạo thêm các container/instance mới đằng sau Load Balancer.

Tuy nhiên, **Database là Statefully Centralized (Lưu trữ trạng thái tập trung)**. Mọi instance ứng dụng đều phải đọc và ghi vào Database chung.

```text
[App Node 1] ──┐
[App Node 2] ──┼──>  [ SINGLE DATABASE NODE ]  <──  BOTTLENECK!
[App Node 3] ──┤     - Disk I/O Limit
[App Node N] ──┘     - Connection Exhaustion
                     - Lock Contention
```

### Các điểm nghẽn phần cứng chính của Database:

1. **Disk I/O (Tốc độ Đọc/Ghi đĩa)**:
   - Cơ sở dữ liệu quan hệ (RDBMS) cần đảm bảo tính chất **ACID** (Durability). Mỗi transaction `COMMIT` phải được ghi xuống ổ đĩa (WAL - Write-Ahead Logging trong PostgreSQL, Redo Log trong MySQL).
   - Tốc độ đọc/ghi từ RAM chỉ mất **100ns**, nhưng từ NVMe SSD mất **1ms** (chậm hơn 10.000 lần) và HDD mất **10ms** (chậm hơn 100.000 lần).
2. **Memory (Bộ nhớ RAM & Buffer Pool)**:
   - Database sử dụng RAM làm Buffer Pool / Page Cache để lưu trữ data pages và indexes. Khi dữ liệu vượt quá dung lượng RAM, DB phải liên tục hoán đổi dữ liệu với ổ đĩa (Disk Paging/Swapping), làm sụt giảm hiệu năng thảm hại.
3. **Connection Limits (Giới hạn kết nối)**:
   - Mỗi kết nối kết nối đến MySQL/PostgreSQL tiêu tốn từ 2MB đến 10MB RAM cùng chi phí context switching CPU.
   - Một server DB chỉ có thể chịu được vài trăm đến vài nghìn kết nối đồng thời trước khi bị sụp đổ (Connection Exhaustion / Out of Memory).
4. **Lock Contention (Tranh chấp khóa)**:
   - Khi hàng ngàn transaction đồng thời ghi hoặc cập nhật vào cùng một dòng dữ liệu (Row Lock) hoặc cùng một bảng (Table Lock), các transaction phía sau phải xếp hàng chờ (Lock Wait Timeout hoặc Deadlock).

---

## 2. Các Chỉ Số (Metrics) Phát Hiện Database Đang Bị Quá Tải

Một System Engineer / DBA cần theo dõi các chỉ số quan trọng sau trên Prometheus/Grafana hoặc Datadog:

| Metric Name | Ngưỡng Cảnh Báo | Nguyên Nhân Triệu Chứng |
| :--- | :--- | :--- |
| **CPU Usage** | > 80% liên tục | Queries thiếu Index, JOIN quá phức tạp, Sort/Aggregate lượng lớn dữ liệu trên RAM. |
| **Disk IOPS / IO Utilization** | > 85% IOPS Max | Write heavy traffic, Buffer pool quá nhỏ buộc DB phải read/write disk liên tục. |
| **Active Connections Ratio** | > 80% Max Connections | App không sử dụng Connection Pool, Connection leak, hoặc query xử lý quá chậm giữ connection lâu. |
| **Lock Wait Time** | > 1-2 giây | Tranh chấp khóa nghiêm trọng trên các HOT rows (VD: tài khoản ngân hàng, kho hàng Flash Sale). |
| **Slow Query Count** | Tăng đột biến | Thiếu Index, Scan Full Table (Seq Scan). |

---

## 3. Lộ Trình Mở Rộng Cơ Sở Dữ Liệu (Scaling Pyramid)

Đừng vội vàng triển khai Sharding phức tạp ngay từ đầu. Hãy áp dụng chiến lược mở rộng theo thứ tự ưu tiên từ thấp đến cao (Scaling Pyramid):

```text
              / \
             /   \      [Layer 5: Database Sharding] (Chi phí & Độ phức tạp cao nhất)
            /     \
           /       \    [Layer 4: Read Replicas & R/W Splitting]
          /---------\
         /           \  [Layer 3: In-Memory Caching (Redis)]
        /-------------\
       /               \ [Layer 2: Connection Pooling (HikariCP/PgBouncer)]
      /-----------------\
     /                   \ [Layer 1: Query & Index Optimization] (Chi phí thấp nhất, hiệu quả tức thì)
    /---------------------\
```

### Các bước tối ưu chi tiết:

1. **Layer 1 — Query & Index Optimization**:
   - Thêm Index thích hợp (B+Tree index, Composite index).
   - Tối ưu câu lệnh SQL: Loại bỏ `SELECT *`, tránh `LIKE '%text%'`, giảm bớt `JOIN` không cần thiết.
2. **Layer 2 — Connection Pooling**:
   - Cấu hình Connection Pool ở tầng App (HikariCP) hoặc dùng Proxy trung gian (PgBouncer, ProxySQL) để tái sử dụng connection.
3. **Layer 3 — In-Memory Caching**:
   - Tách các truy vấn Đọc (Read) lặp đi lặp lại ra khỏi DB bằng Redis hoặc Memcached.
4. **Layer 4 — Read Replica & Read/Write Splitting**:
   - Nhân bản DB thành 1 node Master (chuyên Ghi) và nhiều node Replica (chuyên Đọc).
5. **Layer 5 — Database Sharding**:
   - Phân chia dữ liệu theo hàng (Horizontal Partitioning) sang nhiều cụm DB vật lý riêng biệt.

---

## 4. Tổng kết bài học

- Database là điểm nghẽn lớn nhất vì lưu trữ State và chịu hạn chế của Disk I/O & Memory.
- Luôn đo đạc chỉ số (CPU, IOPS, Active Connections, Slow Queries) trước khi quyết định scale.
- Tuân thủ thứ tự tối ưu: **Optimize Query/Index -> Connection Pool -> Caching -> Read Replica -> Sharding**.
