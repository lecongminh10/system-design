# 02 — Single-Leader Replication (Master-Slave / Primary-Replica)

## 🎯 Mục tiêu
- Hiểu mô hình nhân bản phổ biến nhất trong RDBMS (MySQL, PostgreSQL, MongoDB).
- So sánh Statement-based, WAL-based, và Row-based Logical Replication.

## 📖 Nội dung chính
1. **Kiến trúc Single Leader**:
   - Chỉ có 1 Primary chấp nhận Write (INSERT, UPDATE, DELETE).
   - Replicas nhận log và replay lại ở chế độ Read-Only.
2. **Các hình thức replication**:
   - **Statement-based**: Gởi câu lệnh SQL (`INSERT INTO...`). Nguy cơ: `RAND()`, `NOW()`, Auto-Increment.
   - **WAL / Physical Log Shipping**: Gởi exact disk block changes. Nhanh nhưng ràng buộc cùng version DB.
   - **Row-based / Logical Log**: Gởi thông tin biến đổi từng row dữ liệu. Linh hoạt, hỗ trợ zero-downtime migration.

---
*Ghi chú học tập sẽ được cập nhật tiếp tại đây.*
