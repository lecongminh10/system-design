# 12 — Production: Cấu Hình, Monitoring Grafana, Security & Hot Key Optimization

## 1. Cấu Hình Bộ Nhớ RAM Trên Production (`redis.conf`)

Khi đưa Redis lên môi trường Production, 2 thông số bộ nhớ bắt buộc phải cấu hình là `maxmemory` và `maxmemory-policy`:

```properties
# 1. Giới hạn dung lượng RAM tối đa Redis được phép dùng (Ví dụ 8GB)
maxmemory 8gb

# 2. Thuật toán xử lý khi RAM chạm ngưỡng maxmemory
# Khuyên dùng: allkeys-lru (Xoá bất kỳ key nào ít được dùng nhất)
maxmemory-policy allkeys-lru
```

### Các chính sách Eviction trên Production:
- `allkeys-lru`: **Khuyên dùng cho Caching**. Xoá các key ít được truy cập gần đây nhất.
- `volatile-lru`: Chỉ xoá các key có cài đặt TTL ít được truy cập nhất.
- `noeviction`: Trả về lỗi `OOM command not allowed` khi RAM đầy (**Chỉ dùng khi Redis đóng vai trò Database chính chủ**).

---

## 2. Monitoring Cụm Redis Với Prometheus & Grafana

Một hệ thống Caching Production cần theo dõi sát sao các chỉ số (metrics) sau qua **Redis Exporter**:

```text
[ Redis Server ] ---> [ Redis Exporter ] ---> [ Prometheus ] ---> [ Grafana Dashboard ]
```

### Top 5 Metrics Bắt Buộc Phải Set Alarm (Cảnh báo):

1. **Cache Hit Ratio (`redis_keyspace_hits_total / (hits + misses)`)**:
   - Alarm nếu Hit Ratio rơi xuống **< 80%**.
2. **Used Memory vs Max Memory (`redis_memory_used_bytes`)**:
   - Alarm nếu Used Memory đạt **> 85%** của `maxmemory`.
3. **Connected Clients (`redis_connected_clients`)**:
   - Theo dõi số lượng kết nối từ App Servers. Cảnh báo khi chạm giới hạn `maxclients`.
4. **Evicted Keys (`redis_evicted_keys_total`)**:
   - Đột biến số key bị eviction chứng tỏ dung lượng RAM đang bị quá tải so với nhu cầu thực tế.
5. **Slow Log Count (`redis_slowlog_length`)**:
   - Phát hiện các lệnh chạy chậm gây nghẽn Event Loop (như lệnh `KEYS *` hoặc `SMEMBERS` tập hợp lớn).

---

## 3. Bảo Mật Cụm Redis (Security Best Practices)

Redis mặc định không bật mật khẩu và cho phép thực thi tất cả các lệnh nguy hiểm. Trên Production, bắt buộc thực hiện các bước sau:

### 3.1 Đặt mật khẩu mạnh hoặc ACLs (Redis 6.0+)
```properties
# Mật khẩu mạnh
requirepass Cb8#mK9$vL2!xP5@

# Hoặc dùng ACLs cấp quyền theo Username:
user app-user on >SecretPass123~ +@read +@write ~cache:*
```

### 3.2 Vô hiệu hóa hoặc đổi tên các lệnh nguy hiểm (Dangerous Commands)
Các lệnh như `FLUSHALL` (xoá sạch data) hoặc `KEYS *` (quét toàn bộ database gây đơ Event Loop) phải bị cấm trên Production:

```properties
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command KEYS ""
rename-command CONFIG "SUPER_SECRET_CONFIG_RENAMED"
```

### 3.3 Đóng cổng Public & Bật TLS/SSL
- **Không bao giờ mở port 6379 ra ngoài Internet public**.
- Chỉ cho phép truy cập từ dải IP nội bộ (VPC Private Subnet).
- Bật mã hóa đường truyền **TLS/SSL** cho traffic giữa App Server và Redis.

---

## 4. Xử Lý Big Key & Hot Key Tránh Đơ Event Loop

### 4.1 Big Keys (Key có dung lượng quá lớn)
Big Key là các Key chứa chuỗi JSON dài hàng chục MB hoặc một Hash/List có hàng trăm ngàn phần tử.
- *Hậu quả:* Việc đọc/ghi Big Key tiêu tốn nhiều thời gian I/O và làm nghẽn Event Loop đơn luồng của Redis.

#### Phát hiện Big Key bằng lệnh `redis-cli`:
```bash
redis-cli -h localhost -p 6379 -a "redispassword" --bigkeys
```

#### Cách khắc phục:
- Chia nhỏ Hash/List lớn thành nhiều Hash/List nhỏ (Ví dụ: `user:100:part1`, `user:100:part2`).
- Sử dụng lệnh xoá bất đồng bộ `UNLINK key` thay vì lệnh xoá đồng bộ `DEL key`.

---

### 4.2 Hot Keys (Key nhận lượng đọc khổng lồ)
Hot Key là một Key duy nhất nhận tới 50% tổng lượng traffic của cả cụm Redis (Ví dụ: Banner trang chủ).
- *Hậu quả:* Gây lệch tải, CPU của Node chứa Hot Key tăng lên 100% trong khi các Node khác rảnh rỗi.

#### Phát hiện Hot Key bằng lệnh `redis-cli`:
```bash
redis-cli -h localhost -p 6379 -a "redispassword" --hotkeys
```

#### Cách khắc phục:
- **Nhân bản Hot Key**: Tạo ra các bản sao `hotkey:1`, `hotkey:2`, ..., `hotkey:10` nằm rải rác trên các Node khác nhau và chọn ngẫu nhiên Key khi đọc.
- **Sử dụng L1 Local Cache (Caffeine)** ngay tại App Server để hứng bớt traffic cho Hot Key.

---

## 5. Kết luận bài học

- Bắt buộc set `maxmemory` và `maxmemory-policy allkeys-lru` trên Production.
- Cấm hoàn toàn các lệnh `KEYS *` và `FLUSHALL`.
- Dùng `redis-cli --bigkeys` và `--hotkeys` để chủ động rà soát điểm nghẽn hiệu năng.
