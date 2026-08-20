# 04 — Redis: Khái Niệm, Kiểu Dữ Liệu & Persistence (RDB/AOF)

## 1. Redis Là Gì?

**Redis** (Viết tắt của **RE**mote **DI**ctionary **S**erver) là một hệ thống lưu trữ dữ liệu dạng Key-Value chạy hoàn toàn trên RAM (In-memory Data Structure Store) với hiệu năng cực cao.

Redis có thể được dùng như:
- Database tạm thời (In-memory DB)
- Cache Server (Distributed Cache)
- Message Broker (Pub/Sub & Redis Streams)
- Distributed Lock Manager (Redlock)

```text
[ Redis Server ]
     ├── Single-threaded Event Loop (I/O Multiplexing)
     ├── RAM Memory Data Store (<1ms Latency)
     └── Disk Persistence Engine (RDB Snapshots / AOF Logs)
```

---

## 2. Tại Sao Redis Lại Siêu Nhanh Dù Là Single-Threaded?

Rất nhiều người thắc mắc: *"Tại sao một hệ thống chỉ dùng 1 thread chính như Redis lại xử lý được 100k+ QPS?"*

### Lý do:
1. **Hoạt động hoàn toàn trên RAM**: Không bị ảnh hưởng bởi độ trễ tìm kiếm (seek time) hay đọc ghi cơ học/điện tử của Disk/SSD.
2. **Kiến trúc I/O Multiplexing (Event Loop)**: Sử dụng các cơ chế hướng sự kiện cấp HĐH như `epoll` (Linux) hoặc `kqueue` (macOS). Một thread duy nhất có thể quản lý đồng thời hàng chục ngàn socket connection mà không bị nghẽn (non-blocking I/O).
3. **Không tốn chi phí Context Switching**: Đa luồng (Multi-threading) tạo ra chi phí chuyển đổi ngữ cảnh CPU (context switch) và tranh chấp khóa (Lock Contraction/Race Conditions). Redis đơn luồng loại bỏ hoàn toàn rủi ro này.
4. **Cấu trúc dữ liệu được tối ưu cực tốt C-level**: Mỗi kiểu dữ liệu trong Redis đều được triển khai bằng các cấu trúc mã C tối ưu dung lượng và thời gian thực thi.

---

## 3. Các Kiểu Dữ Liệu redis (Data Structures) & Use Cases

Redis không chỉ lưu chuỗi đơn thuần mà hỗ trợ nhiều kiểu dữ liệu phong phú:

```text
                  +----------------------------------+
                  |         Redis Key-Value          |
                  +----------------------------------+
                    |        |        |        |   
        +-----------+        |        |        +-----------+
        v                    v        v                    v
    [ String ]           [ Hash ]  [ List ]            [ ZSet ]
("user:100" -> "Nam")  ("user:100") (Queue)       (Leaderboard)
                        name:"Nam"  [req1, req2]   Score: 150 -> Alice
                        age: 25                    Score: 200 -> Bob
```

| Kiểu dữ liệu | Mô tả | Use Case Thực Tế | Các lệnh tiêu biểu |
| :--- | :--- | :--- | :--- |
| **String** | Lưu chuỗi, số, JSON, hoặc binary (tối đa 512MB) | Caching HTML/JSON, Counter, Session Token | `GET`, `SET`, `INCR`, `DECR`, `SETEX` |
| **Hash** | Field-value pairs tương tự JSON object nhỏ | Lưu thông tin User Profile, Cart Items | `HSET`, `HGET`, `HGETALL`, `HINCRBY` |
| **List** | Danh sách liên kết hai chiều (Doubly Linked List) | Message Queue đơn giản, Timeline bài viết mới | `LPUSH`, `RPUSH`, `LPOP`, `RPOP`, `LRANGE` |
| **Set** | Tập hợp các phần tử duy nhất, không trùng lặp | Thống kê Unique IP, Tag sản phẩm, Friend List chung | `SADD`, `SMEMBERS`, `SISMEMBER`, `SINTER` |
| **Sorted Set (ZSet)** | Tập hợp có thứ tự dựa trên điểm số (Score) | Bảng xếp hạng Game (Leaderboard), Rate Limiting | `ZADD`, `ZRANGE`, `ZREVRANGE`, `ZINCRBY` |
| **Bitmap** | Mảng Bit (0 và 1) siêu tiết kiệm dung lượng | Đánh dấu User Active theo ngày (Check-in) | `SETBIT`, `GETBIT`, `BITCOUNT` |
| **HyperLogLog** | Thuật toán xác suất đếm phần tử duy nhất | Đếm số lượt người dùng truy cập trang web (UV) | `PFADD`, `PFCOUNT` |
| **Pub/Sub** | Hệ thống Publisher - Subscriber tin nhắn | Chat realtime, Broadcast sự kiện invalid cache | `PUBLISH`, `SUBSCRIBE`, `UNSUBSCRIBE` |
| **Streams** | Nhật ký Append-only tương tự Apache Kafka | Message log có consumer group, replay event | `XADD`, `XREAD`, `XGROUP` |

---

## 4. Cơ Chế Lưu Dữ Liệu Xuống Đĩa (Redis Persistence)

Do RAM là bộ nhớ volatile (mất dữ liệu khi cúp điện), Redis cung cấp 2 cơ chế chính để ghi dữ liệu xuống Disk:

```text
               +-----------------------+
               |     Redis In-RAM      |
               +-----------+-----------+
                           |
             +-------------+-------------+
             |                           |
             v                           v
   [ RDB Snapshot ]              [ AOF Log ]
(Định kỳ chụp ảnh dữ liệu)   (Ghi log mọi lệnh ghi WRITE)
```

### 4.1 RDB (Redis Database Snapshotting)
- **Cách hoạt động:** Tạo bản sao (snapshot) toàn bộ dữ liệu RAM ghi vào đĩa thành file nén `.rdb` theo định kỳ (ví dụ: 5 phút/lần).
- **Ưu điểm:** File nhỏ gọn, khởi động khôi phục dữ liệu cực nhanh khi restart server.
- **Nhược điểm:** Có nguy cơ mất dữ liệu trong khoảng thời gian giữa 2 lần snapshot (ví dụ: bị rớt điện ở phút thứ 4).

### 4.2 AOF (Append-Only File)
- **Cách hoạt động:** Ghi tất cả các lệnh thao tác ghi (`SET`, `HSET`, `DEL`) vào file log `appendonly.aof`.
- **Chế độ ghi (fsync):**
  - `appendfsync always`: Ghi đĩa sau mỗi lệnh (Rất an toàn, nhưng chậm).
  - `appendfsync everysec`: Ghi đĩa mỗi giây 1 lần (**Khuyên dùng**, tối đa mất 1s dữ liệu).
  - `appendfsync no`: Phụ thuộc OS tự ghi đĩa.
- **Ưu điểm:** Mức độ an toàn dữ liệu cao hơn RDB rất nhiều.
- **Nhược điểm:** File AOF lớn hơn RDB, thời gian khôi phục lâu hơn khi nạp lại file lớn.

### 4.3 Hybrid Persistence (Kết hợp RDB + AOF từ Redis 4.0+)
Redis kết hợp ưu điểm của cả hai: File AOF chứa phần đầu là bản RDB snapshot và phần đuôi là các log AOF ngắn gần nhất. Đây là **cấu hình khuyên dùng nhất trên Production**.

---

## 5. Kết luận bài học

- Redis nhanh nhờ chạy hoàn toàn trên RAM + Event Loop I/O Multiplexing đơn luồng.
- Hãy tận dụng đúng kiểu dữ liệu (`Hash` thay vì lưu JSON String lớn, `ZSet` cho leaderboard, `Bitmap` cho check-in).
- Bật **Hybrid Persistence (RDB + AOF)** trên Production để vừa đảm bảo tốc độ vừa an toàn dữ liệu.
