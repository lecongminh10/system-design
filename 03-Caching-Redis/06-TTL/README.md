# 06 — TTL & Expiration: Quản Lý Thời Gian Sống & Phòng Chống Sự Cố Expiry

## 1. TTL (Time To Live) Là Gì?

**TTL (Time To Live)** là khoảng thời gian tồn tại được quy định cho một key trong Cache trước khi nó tự động bị hệ thống tiêu hủy (expired).

```bash
# Thiết lập key 'user:100' sống trong 600 giây (10 phút)
SET user:100 "Minh" EX 600

# Kiểm tra thời gian sống còn lại (bằng giây)
TTL user:100
# Trả về: (integer) 542
```

### Tại sao bắt buộc phải đặt TTL cho Cache?
1. **Tránh cạn kiệt RAM (Memory Leak)**: Nếu không đặt TTL, các dữ liệu không bao giờ được truy cập lại sẽ nằm lại trong RAM mãi mãi.
2. **Giảm rủi ro dữ liệu cũ (Stale Data)**: Giúp dữ liệu trong Cache tự động làm mới định kỳ từ Database.

---

## 2. Redis Xử Lý Key Hết Hạn Như Thế Nào? (Expiration Algorithms)

Nhiều người nghĩ rằng khi TTL về 0, Redis sẽ lập tức xoá key đó khỏi RAM. Thực tế, Redis kết hợp **2 cơ chế** để tối ưu CPU:

```text
               +-----------------------------------+
               |    Key Hết Hạn (TTL <= 0)         |
               +-----------------+-----------------+
                                 |
           +---------------------+---------------------+
           |                                           |
           v                                           v
[ Passive Expiration (Thụ động) ]           [ Active Expiration (Chủ động) ]
(Xoá khi có Request đọc Key)                 (Thread chạy ngầm 10 lần/giây quét mẫu)
```

### 2.1 Passive Expiration (Xoá thụ động khi truy cập)
Khi client gửi lệnh `GET key`, Redis kiểm tra thời gian hết hạn của key đó:
- Nếu key đã hết hạn: Redis xoá key khỏi RAM lập tức và trả về `nil`.
- *Nhược điểm:* Nếu một key hết hạn nhưng không bao giờ có request nào đọc lại nó, nó vẫn sẽ nằm lì trong RAM.

### 2.2 Active Expiration (Xoá chủ động ngầm)
Mỗi giây 10 lần (mặc định mỗi 100ms), Redis thực hiện công việc dọn dẹp ngầm:
1. Lấy ngẫu nhiên **20 key** có cài đặt TTL.
2. Xoá tất cả các key đã hết hạn trong 20 key này.
3. Nếu tỷ lệ key hết hạn vượt quá **25%** số key được quét, Redis tiếp tục quét lặp lại bước 1.

---

## 3. Kỹ Thuật TTL Jitter (Ngẫu Nhiên Hoá TTL) Tránh Cache Avalanche

### Bài toán hiểm hóc:
Giả sử bạn chạy một Cronjob vào lúc **00:00:00** để warm-up 100.000 sản phẩm hot vào Redis với TTL cố định là **24 giờ** (86.400 giây).

Đúng **00:00:00 ngày hôm sau**, toàn bộ 100.000 key này sẽ **cùng lúc hết hạn (Mass Expiration)**!

```text
[ Không dùng Jitter ]
00:00:00: 100,000 Keys hết hạn cùng lúc! ---> 100% Request rơi thẳng DB ---> Sập Database!

[ Có dùng Jitter ]
TTL = 24h + Random(0 -> 30 phút)
Key hết hạn rải rác từ 00:00 đến 00:30 ---> DB xử lý êm ái!
```

### Giải pháp — TTL Jitter (Thêm nhiễu ngẫu nhiên):
Luôn luôn cộng thêm một khoảng thời gian ngẫu nhiên (random delta) vào TTL gốc:

```java
// Ví dụ trong Spring Boot / Java:
int baseTTL = 86400; // 24 giờ
int jitter = new Random().nextInt(1800); // Ngẫu nhiên 0 đến 30 phút
int finalTTL = baseTTL + jitter;

redisTemplate.opsForValue().set(key, value, finalTTL, TimeUnit.SECONDS);
```

---

## 4. Phân Biệt Key Expiration vs Key Eviction

| Tiêu chí | Key Expiration (Hết hạn) | Key Eviction (Bị trục xuất) |
| :--- | :--- | :--- |
| **Nguyên nhân** | Do TTL của key đếm ngược về `0`. | Do bộ nhớ RAM đạt ngưỡng `maxmemory`. |
| **Hành vi** | Hành vi tự nhiên đã lên lịch từ trước. | Hành vi cưỡng chế khi thiếu dung lượng RAM. |
| **Cấu hình liên quan** | Lệnh `EXPIRE`, `SETEX`, `PEXPIRE`. | Cấu hình `maxmemory-policy` (LRU, LFU, Random). |

---

## 5. Kết luận bài học

- Bắt buộc phải cài **TTL** cho 100% key trên Redis Cache.
- Áp dụng **TTL Jitter** (cộng thêm 5-10% thời gian ngẫu nhiên) cho các tác vụ nạp cache số lượng lớn.
- Hiểu rõ sự khác biệt giữa Passive và Active Expiration để theo dõi memory usage chuẩn xác.
