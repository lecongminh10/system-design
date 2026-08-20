# 13 — Interview: Bộ Câu Hỏi Phỏng Vấn System Design Về Caching & Redis

Đây là tổng hợp **15 câu hỏi phỏng vấn tuyển dụng thực tế** (từ Senior đến Software Architect) về Caching, Redis và Thiết kế hệ thống phân tán.

---

### Câu 1: Tại sao Redis chỉ chạy đơn luồng (Single-threaded) nhưng lại có tốc độ xử lý siêu nhanh (100k+ QPS)?

**Trả lời:**
Redis đạt được hiệu năng kinh ngạc nhờ 4 yếu tố chính:
1. **Hoạt động hoàn toàn trên RAM**: Loại bỏ thời gian tìm kiếm cơ học và độ trễ đọc/ghi đĩa SSD.
2. **Cơ chế I/O Multiplexing (Event Loop)**: Sử dụng các kĩ thuật `epoll`/`kqueue` cấp HĐH để quản lý hàng chục ngàn kết nối non-blocking trên một thread duy nhất.
3. **Không tốn chi phí Context Switch & Lock Contraction**: Chạy 1 thread giúp Redis loại bỏ hoàn toàn chi phí chuyển đổi ngữ cảnh CPU và không bị Race Condition hay tranh chấp Lock.
4. **Cấu trúc dữ liệu tối ưu cấp độ C**: Các data structure như `ZSet` (SkipList), `Hash` (Ziplist/Hashtable) được tối ưu bộ nhớ cực tốt.

---

### Câu 2: Phân biệt Cache-Aside, Write-Through và Write-Back (Write-Behind)?

**Trả lời:**
- **Cache-Aside (Lazy Loading)**: App đọc Cache trước. Miss thì đọc DB rồi tự nạp Cache. Khi Ghi, App ghi DB rồi XOÁ key ở Cache. *Ưu điểm:* Tiết kiệm RAM, chịu lỗi tốt. *Dùng cho:* Hầu hết ứng dụng Web.
- **Write-Through**: App ghi vào Cache, Cache ghi đồng bộ (SYNC) vào DB rồi mới xong. *Ưu điểm:* Dữ liệu nhất quán 100%. *Nhược điểm:* Latency ghi cao.
- **Write-Back (Write-Behind)**: App ghi vào Cache và xong ngay. Cache gom batch ghi bất đồng bộ (ASYNC) xuống DB sau. *Ưu điểm:* Latency ghi siêu thấp, giảm tải DB IOPS. *Nhược điểm:* Rủi ro mất dữ liệu nếu Cache sập.

---

### Câu 3: Phân biệt Cache Penetration, Cache Breakdown và Cache Avalanche? Nêu cách xử lý triệt để?

**Trả lời:**
- **Cache Penetration**: Request tìm key rác không tồn tại cả ở Cache lẫn DB.
  - *Giải pháp:* **Bloom Filter** hoặc **Cache Null Values** với TTL ngắn.
- **Cache Breakdown**: Một Hot Key duy nhất vừa hết hạn TTL, hàng chục ngàn request đâm đồng thời xuống DB (Thundering Herd).
  - *Giải pháp:* **Distributed Mutex Lock (`SETNX`)** hoặc **Logical Expiration** (thời hạn ảo).
- **Cache Avalanche**: Hàng ngàn key đồng loạt hết hạn cùng lúc hoặc cả cụm Redis sập.
  - *Giải pháp:* **TTL Jitter** (thêm nhiễu ngẫu nhiên vào TTL), **Redis Sentinel/Cluster HA**, **Circuit Breaker**.

---

### Câu 4: Khi cập nhật dữ liệu ở Database, nên UPDATE cache hay DELETE cache? Tại sao?

**Trả lời:**
**NÊN DELETE CACHE (XOÁ KEY)!**
Lý do:
1. **Tránh Race Condition khi Concurrent Write**: Nếu 2 Thread A và B cùng update DB. Thread A ghi DB trước nhưng lại ghi Cache sau Thread B -> Dữ liệu trên Cache bị sai lệch hoàn toàn!
2. **Tiết kiệm tài nguyên (Lazy Loading)**: Nếu dữ liệu được update 10 lần liên tiếp nhưng không có ai đọc, việc UPDATE cache 10 lần là lãng phí. XOÁ cache giúp dữ liệu chỉ được tính toán nạp lại khi có người thực sự đọc.

---

### Câu 5: Làm thế nào để implement Distributed Lock trong Redis?

**Trả lời:**
Sử dụng lệnh `SET key value NX PX milliseconds`:
- `NX`: Chỉ tạo key nếu key CHƯA tồn tại (Atomic operation).
- `PX`: Tự động giải phóng lock sau khoảng thời gian timeout (tránh Deadlock nếu app sập).
- `value`: Phải là một UUID duy nhất cho từng Thread để khi xoá lock (`DEL`), Thread A không xoá nhầm lock của Thread B (sử dụng Lua Script kiểm tra UUID trước khi delete).
- Với cụm Redis đa node, sử dụng thuật toán **Redlock**.

---

### Câu 6: So sánh Redis Sentinel và Redis Cluster?

**Trả lời:**
- **Redis Sentinel**: Cung cấp **High Availability (Độ sẵn sàng cao)** và tự động Failover cho mô hình Master-Replica. Không phân chia dữ liệu (tất cả dữ liệu nằm trọn ở 1 Master).
- **Redis Cluster**: Cung cấp **Sharding (Phân tán dữ liệu ngang)** dựa trên 16,384 Hash Slots. Dữ liệu được chia nhỏ ra nhiều Node Master khác nhau, giúp scale dung lượng RAM vượt giới hạn 1 máy chủ vật lý.

---

### Câu 7: Redis lưu dữ liệu xuống đĩa (Persistence) bằng cách nào? So sánh RDB và AOF?

**Trả lời:**
- **RDB (Snapshotting)**: Chụp ảnh toàn bộ dữ liệu RAM định kỳ ra file `.rdb`. *Ưu điểm:* File nhỏ, restart nhanh. *Nhược điểm:* Nguy cơ mất dữ liệu giữa 2 lần snapshot.
- **AOF (Append-Only File)**: Ghi log mọi lệnh WRITE vào file `.aof`. *Ưu điểm:* An toàn dữ liệu cao (mất tối đa 1s). *Nhược điểm:* File lớn, restart chậm hơn.
- *Best practice:* Kết hợp **Hybrid Persistence (RDB + AOF)** từ Redis 4.0+.

---

### Câu 8: Bloom Filter là gì và hoạt động như thế nào?

**Trả lời:**
Bloom Filter là một cấu trúc dữ liệu xác suất (Probabilistic Data Structure) sử dụng mảng Bit và các hàm Hash function để kiểm tra sự tồn tại của một phần tử.
- Trả lời 2 trạng thái:
  1. *Chắc chắn không tồn tại (Definitely Not In Set)*: Đúng 100%.
  2. *Có thể tồn tại (Possibly In Set)*: Có tỷ lệ False Positive nhỏ.
- Ứng dụng: Đặt phía trước Cache để chặn 100% các request rác tìm key không tồn tại, giải quyết dứt điểm sự cố **Cache Penetration**.

---

### Câu 9: Consistent Hashing giải quyết vấn đề gì khi scale Cache Server?

**Trả lời:**
Khi có $N$ Cache Server, nếu dùng thuật toán băm đơn thuần `Hash(key) % N`, khi thêm hoặc bớt 1 Server ($N \to N+1$), gần như **100% Key bị đổi vị trí node**, dẫn đến Cache Miss toàn bộ hệ thống.
**Consistent Hashing** xếp các Node và Key lên một vòng tròn số (Hash Ring). Khi thêm/bớt 1 Node, chỉ có $\frac{1}{N}$ số lượng key bị di chuyển, bảo vệ hệ thống không bị sập Cache.

---

### Câu 10: Big Key và Hot Key trong Redis là gì? Cách phát hiện và khắc phục?

**Trả lời:**
- **Big Key**: Key có kích thước lớn (> 10MB JSON hoặc Hash chứa > 10,000 fields).
  - *Phát hiện:* `redis-cli --bigkeys`. *Khắc phục:* Chia nhỏ Hash/List, xoá bất đồng bộ bằng `UNLINK`.
- **Hot Key**: Key nhận lượng đọc khổng lồ chiếm tới 50% traffic cụm.
  - *Phát hiện:* `redis-cli --hotkeys`. *Khắc phục:* Nhân bản key (`key:1`, `key:2`), dùng L1 Local Cache (Caffeine).

---

### Câu 11: Redis xử lý các Key hết hạn (TTL) như thế nào?

**Trả lời:**
Redis kết hợp 2 cơ chế:
1. **Passive Expiration (Thụ động)**: Khi client gọi `GET key`, Redis mới kiểm tra, nếu hết hạn thì xoá và trả về `nil`.
2. **Active Expiration (Chủ động)**: Thread ngầm quét 10 lần/giây, chọn ngẫu nhiên 20 key có TTL để xoá các key đã hết hạn.

---

### Câu 12: Phân biệt Eviction và Expiration trong Redis?

**Trả lời:**
- **Expiration**: Key bị xoá do hết thời gian sống TTL đếm ngược về 0.
- **Eviction**: Key bị cưỡng chế xoá do dung lượng RAM chạm ngưỡng `maxmemory` dựa trên thuật toán `maxmemory-policy` (LRU, LFU, Random).

---

### Câu 13: Phân biệt Local Cache (Caffeine) và Distributed Cache (Redis)?

**Trả lời:**
- **Local Cache (Caffeine)**: Lưu trong bộ nhớ Heap của App. Latency nanosecond. Không cần Network I/O. Tuy nhiên không chia sẻ được giữa các App Node và mất khi restart App.
- **Distributed Cache (Redis)**: Lưu ở Server Redis riêng biệt. Latency ~1ms. Cho phép hàng trăm App Node dùng chung dữ liệu nhất quán và không mất data khi restart App.

---

### Câu 14: Giả sử Redis Server sập, làm thế nào để ứng dụng Spring Boot vẫn chạy bình thường?

**Trả lời:**
Cài đặt `CacheErrorHandler` trong Spring Boot. Khi phát hiện ngoại lệ kết nối `RedisConnectionFailureException`, `CacheErrorHandler` sẽ ghi log warning và **Fallback cho phép request tiếp tục đi xuống Database** để lấy dữ liệu thay vì ném lỗi 500 ra Client.

---

### Câu 15: Tại sao không nên dùng lệnh `KEYS *` trên Production? Thay thế bằng lệnh nào?

**Trả lời:**
Vì Redis là Single-threaded, lệnh `KEYS *` sẽ quét qua toàn bộ triệu key trong RAM, làm **phong tỏa (block) Event Loop** trong nhiều giây hoặc vài phút, khiến mọi request khác từ toàn bộ ứng dụng bị treo (Time out).
- *Thay thế:* Sử dụng lệnh **`SCAN`** (đọc con trỏ theo từng trang nhỏ `COUNT 100` non-blocking).

---

## 💡 Lời Khuyên Cho Phỏng Vấn System Design:
Khi gặp các câu hỏi về Caching, luôn luôn phân tích theo bộ khung:
1. **Mục tiêu**: Latency vs Throughput.
2. **Đánh đổi**: Consistency vs Availability.
3. **Sự cố biên (Edge Cases)**: Penetration, Breakdown, Avalanche.
4. **Giải pháp kiến trúc**: Sentinel vs Cluster, L1/L2 Cache.
