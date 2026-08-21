# 01 — Tổng Quan Database Replication & Cơ Chế WAL / Binlog

## 🎯 Mục tiêu
- Hiểu tại sao hệ thống cần Database Replication (Scale Read, High Availability, Disaster Recovery).
- Nắm vững cơ chế **Write-Ahead Logging (WAL)** trong PostgreSQL/SQLite và **Binlog / Redo Log** trong MySQL.
- Luồng dữ liệu (Replication Stream) biến đổi từ RAM -> WAL/Binlog -> Network -> Replica.

## 📖 Nội dung chính
1. **Lý do cần Replication**:
   - High Availability (HA): Master chết -> Replica lên thay.
   - Read Scalability: 1 Master xử lý Write, N Replicas xử lý Read.
   - Geographic distribution (Locality): Đặt DB gần user ở nhiều vùng địa lý.
2. **Cơ chế lưu trữ bên dưới**:
   - **WAL (Write-Ahead Log)**: Ghi log thay đổi xuống đĩa trước khi commit transaction.
   - **Binlog (Binary Log - MySQL)**: Ghi lại tất cả thay đổi dữ liệu dưới dạng Statement, Row, hoặc Mixed.
   - **GTID (Global Transaction Identifier)**: Định danh giao dịch duy nhất trong cluster để dễ failover.
3. **Replication Stream**:
   - Master Master-thread đọc WAL/Binlog -> Gởi qua TCP socket -> Replica Receiver-thread nhận -> Applier-thread ghi vào DB engine.

---
*Ghi chú học tập sẽ được cập nhật tiếp tại đây.*
