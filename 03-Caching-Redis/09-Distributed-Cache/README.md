# 09 — Distributed Cache: Redis High Availability & Sharding (Sentinel & Cluster)

## 1. Tại Sao Cần Distributed Cache?

Một server Redis đơn lẻ (Standalone Node) có 2 điểm yếu chí mạng:
1. **Single Point of Failure (SPOF)**: Nếu Node Redis duy nhất bị crash, toàn bộ Cache bị mất, Database phía sau sẽ bị quá tải sập theo.
2. **Giới hạn RAM & CPU**: Một máy chủ vật lý bị giới hạn dung lượng RAM (Ví dụ 64GB). Khi dữ liệu cache vượt quá ngưỡng này, ta không thể scale-up mãi mãi.

Để giải quyết, Redis cung cấp 2 giải pháp kiến trúc: **Redis Sentinel** (High Availability) và **Redis Cluster** (Sharding / Distributed Horizontal Scaling).

---

## 2. Redis Replication (Master - Replica)

Mô hình nền tảng cho cả Sentinel và Cluster là **Master - Replica Replication**.

```text
[ Redis Master (Read/Write) ]
        |
        +--- Async Replication ---> [ Redis Replica 1 (Read Only) ]
        |
        +--- Async Replication ---> [ Redis Replica 2 (Read Only) ]
```

- **Master Node**: Nhận các thao tác Ghi (Write/Update/Delete).
- **Replica Nodes**: Nhân bản dữ liệu từ Master đồng bộ bất đồng bộ (Async) và chỉ phục vụ thao tác Đọc (Read-Only).
- **Chế độ nhân bản:**
  - *Full Synchronization (RDB Transfer)*: Khi Replica mới join cụm, Master chụp file RDB gửi qua network.
  - *Partial Synchronization (Replication Buffer & Offset)*: Khi đứt kết nối ngắn, Replica dùng Replication Offset để chép bù phần log bị thiếu.

---

## 3. Redis Sentinel: High Availability (Độ Sẵn Sàng Cao)

Redis Sentinel là một quy trình giám sát độc lập (Monitoring process) giúp tự động **Phát hiện sự cố & Failover**.

```text
               +-----------------------------+
               |  Sentinel 1 / 2 / 3 (Quorum)| (Giám sát & Bình chọn Failover)
               +--------------+--------------+
                              |
                              v
                +----------------------------+
                |    Redis Master (Sập!)     |
                +----------------------------+
                              |
                              v (Sentinel tự động đôn Replica 1 lên làm Master mới)
                +----------------------------+
                |    Redis Replica 1 (Master)|
                +----------------------------+
```

### Chức năng chính của Sentinel:
1. **Monitoring**: Thường xuyên kiểm tra xem Master và Replica có sống hay không bằng lệnh PING.
2. **Notification**: Phát cảnh báo qua API / Webhook khi có Node bị hỏng.
3. **Automatic Failover**: Nếu Master bị sập (Subjective Down -> Objective Down qua bầu chọn Quorum), Sentinel tự động nâng cấp (promote) một Replica tốt nhất lên làm **Master mới**.
4. **Configuration Provider**: Client (Spring Boot) hỏi Sentinel để lấy IP của Master hiện tại.

---

## 4. Redis Cluster: Scale-out Ngang (Sharding / Partitioning)

Khi dung lượng cache cần hàng Hàng Trăm GB RAM, ta sử dụng **Redis Cluster** để chia nhỏ dữ liệu ra nhiều Node Master khác nhau.

```text
                       [ Redis Cluster (16384 Hash Slots) ]
                                         |
     +-----------------------------------+-----------------------------------+
     |                                   |                                   |
     v                                   v                                   v
[ Node Master 1 ]                   [ Node Master 2 ]                   [ Node Master 3 ]
(Slots 0 - 5460)                    (Slots 5461 - 10922)                (Slots 10923 - 16383)
  ├── Replica 1a                      ├── Replica 2a                      ├── Replica 3a
```

### Cơ chế Hash Slots & Hashing:
Redis Cluster phân chia toàn bộ không gian dữ liệu thành đúng **16,384 Hash Slots**.

Khi ghi một Key (Ví dụ `SET user:100 "Minh"`):
1. Redis tính giá trị CRC16 của Key: `CRC16("user:100")`
2. Thực hiện lấy dư cho 16384:

$$\text{Slot} = \text{CRC16}(\text{key}) \pmod{16384}$$

3. Điều hướng request đến đúng Node Master đang quản lý Slot đó!

### Hash Tags (Gom Key vào cùng 1 Slot):
Nếu muốn bắt buộc 2 key rơi vào cùng một Slot (để chạy được lệnh multi-key): sử dụng `{}`.
- `SET user:{100}:profile "..."` -> Chỉ băm chuỗi `"100"`.
- `SET user:{100}:orders "..."` -> Băm chuỗi `"100"` -> Rơi cùng Slot!

---

## 5. Hiện Tượng Split-Brain & Cách Phòng Tránh

### Hiện tượng Split-Brain:
Do nghẽn mạng (Network Partition), Master bị cô lập khỏi Sentinel/Replicas. Sentinel bầu ra Master mới. Tuy nhiên Client ở một phân vùng mạng cũ vẫn tiếp tục GHI dữ liệu vào Master cũ -> Tạo ra **2 Master song song (Split-Brain)**. Khi mạng thông trở lại, dữ liệu ở Master cũ bị xoá đè, gây **Mất dữ liệu nghiêm trọng**.

### Cách phòng chống trong `redis.conf`:
```properties
# Yêu cầu phải có ít nhất 1 Replica kết nối thành công mới cho phép Master nhận lệnh WRITE
min-replicas-to-write 1
min-replicas-max-lag 10
```

---

## 6. Kết luận bài học

- Dùng **Redis Sentinel** khi dữ liệu vừa phải (chứa đủ 1 máy RAM), cần độ tin cậy và tự động khôi phục khi sập.
- Dùng **Redis Cluster** khi dữ liệu khủng (> 100GB RAM), cần scale-out phân tải Read/Write ngang.
- Luôn cấu hình `min-replicas-to-write` để chống hiện tượng Split-Brain mất dữ liệu.
