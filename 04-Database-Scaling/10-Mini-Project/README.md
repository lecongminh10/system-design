# 10 — Mini Project: Thực Hành Master-Replica Replication, Read/Write Splitting & Redis Caching

## 1. Yêu Cầu & Mục Tiêu Dự Án

Trong dự án thực hành này, bạn sẽ tự tay dựng và kiểm thử một hạ tầng cơ sở dữ liệu mở rộng hoàn chỉnh bao gồm:
- **MySQL Primary (Master)**: Đảm nhận các thao tác Ghi (`INSERT`, `UPDATE`, `DELETE`). Port `3306`.
- **MySQL Secondary (Read Replica)**: Tự động sao chép dữ liệu từ Master qua GTID Binlog. Đảm nhận truy vấn Đọc (`SELECT`). Port `3307`.
- **Redis Cache**: Đóng vai trò lớp In-Memory Cache giảm tải cho DB Replica. Port `6379`.
- **Demo Script**: Kiểm thử luồng Read/Write Splitting tự động và so sánh Latency giữa **Redis Cache Hit (<1ms)** vs **DB Read Replica (~10ms)**.

---

## 2. Kiến Trúc Hạ Tầng (Docker Compose)

```text
                                [ Python / Spring App ]
                                           │
                 ┌─────────────────────────┼─────────────────────────┐
                 │ WRITE (Port 3306)       │ READ (Port 6379)        │ READ Fallback (Port 3307)
                 v                         v                         v
        +------------------+      +------------------+      +------------------+
        |   mysql-master   |      |   redis-cache    |      |  mysql-replica   |
        |     (Master)     |      |     (RAM)        |      |    (Replica)     |
        +--------+---------+      +------------------+      +------------------+
                 | Binlog GTID Replication
                 +--------------------------------------------------->
```

---

## 3. Hướng Dẫn Khởi Chạy Step-by-Step

### Bước 1: Khởi động Containers với Docker Compose
Chạy lệnh sau tại thư mục `04-Database-Scaling/10-Mini-Project`:

```bash
docker-compose up -d
```

Kiểm tra trạng thái các containers:
```bash
docker-compose ps
```
*(Đảm bảo cả 3 container `mysql-master`, `mysql-replica`, và `redis-cache` đều ở trạng thái `healthy` hoặc `Up`).*

---

### Bước 2: Kiểm Tra Trạng Thái Replication Trên MySQL Replica
Mở terminal và truy cập vào MySQL Replica để kiểm tra xem quá trình nhân bản dữ liệu đã sẵn sàng chưa:

```bash
docker exec -it mysql-replica mysql -u root -prootpassword -e "SHOW SLAVE STATUS\G"
```

Tìm 2 dòng sau trong kết quả trả về:
- `Slave_IO_Running: Yes`
- `Slave_SQL_Running: Yes`
- `Seconds_Behind_Master: 0`

=> **Thành công!** Read Replica đang đồng bộ trực tiếp dữ liệu từ Master mà không có Replication Lag.

---

### Bước 3: Cài đặt thư viện Python & Chạy Demo Script

Cài đặt thư viện `mysql-connector-python` và `redis`:
```bash
pip install mysql-connector-python redis
```

Chạy script demo:
```bash
python app/demo.py
```

---

## 4. Kết Quả Chạy Demo & Phân Tích Latency

Khi chạy script `python app/demo.py`, bạn sẽ nhận được output tương tự như sau:

```text
🚀 === STARTING DATABASE SCALING DEMO ===
✅ [WRITE - MASTER DB] Created User ID=4 (18.45 ms)
🐢 [READ - DB REPLICA MISS] User ID=4: {'id': 4, 'name': 'Dev Master', 'email': 'dev_1771500000@example.com', 'created_at': '2026-08-20 14:45:00'} (12.30 ms)
⚡ [READ - REDIS CACHE HIT] User ID=4: {"id": 4, "name": "Dev Master", "email": "dev_1771500000@example.com", "created_at": "2026-08-20 14:45:00"} (0.65 ms)
⚡ [READ - REDIS CACHE HIT] User ID=4: {"id": 4, "name": "Dev Master", "email": "dev_1771500000@example.com", "created_at": "2026-08-20 14:45:00"} (0.42 ms)
🎉 === DEMO COMPLETED SUCCESSFULLY ===
```

### Nhận Xét Quan Trọng:
1. **Lần Ghi dữ liệu (WRITE)**: Gửi tới Master DB (Port 3306), mất **~18ms** do chi phí ghi log WAL xuống đĩa.
2. **Lần Đọc thứ nhất (CACHE MISS)**: Query đọc từ Read Replica (Port 3307), mất **~12ms** do phải đọc từ Disk MySQL. Dữ liệu sau đó được lưu vào Redis Cache.
3. **Lần Đọc thứ hai & ba (CACHE HIT)**: Query đọc trực tiếp từ Redis RAM (Port 6379), chỉ mất **~0.4ms - 0.6ms** (Nhanh hơn **20-30 lần** so với đọc DB!).

---

## 5. Dọn Dẹp Tài Nguyên

Sau khi thực hành xong, chạy lệnh sau để dừng và xóa các containers:

```bash
docker-compose down -v
```
