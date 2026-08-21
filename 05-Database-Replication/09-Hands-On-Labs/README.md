# 09 — Hands-On Labs (Thực Hành Dựng Lab Replication)

## 🎯 Mục tiêu
- Tự tay tạo cụm MySQL GTID Master-Replica bằng Docker Compose.
- Giả lập Replication Lag và viết test case kiểm thử Read/Write Splitting.

## 🧪 Các bài Lab thực hành
1. **Lab 1: MySQL GTID Master-Replica Setup**:
   - Khởi tạo 1 MySQL Primary và 2 MySQL Replicas bằng Docker Compose.
   - Cấu hình GTID, `binlog_format=ROW`, `read_only=ON` trên Replica.
2. **Lab 2: PostgreSQL Streaming Replication & PgBouncer**:
   - Cấu hình `pg_hba.conf`, `primary_conninfo` và WAL streaming.
3. **Lab 3: Application Integration (Spring Boot)**:
   - Dùng `@Transactional(readOnly = true)` để tự phân tuyến query.
4. **Lab 4: Stress Test & Replication Lag Monitoring**:
   - Sử dụng `sysbench` bơm write traffic nặng và đo `Seconds_Behind_Master`.

---
*Mã nguồn Docker Compose & Code mẫu sẽ được cập nhật trong thư mục này.*
