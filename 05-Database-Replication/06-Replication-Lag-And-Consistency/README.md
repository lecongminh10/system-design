# 06 — Replication Lag & Consistency Anomalies (Hiện Tượng Bất Thường Đồng Bộ)

## 🎯 Mục tiêu
- Hiểu nguyên nhân gây ra Replication Lag.
- Xử lý 3 hiện tượng bất thường do Eventual Consistency:
  1. Reading Your Own Writes (Read-After-Write Consistency).
  2. Monotonic Reads.
  3. Consistent Prefix Reads.

## 📖 Nội dung chính & Giải pháp
1. **Reading Your Own Writes**:
   - *Vấn đề*: User sửa profile -> ấn F5 -> trang web đọc từ Replica (chưa kịp sync) -> hiển thị thông tin cũ.
   - *Giải pháp*:
     - Route câu lệnh đọc dữ liệu cá nhân của chính user về Master trong 5-10 giây sau khi ghi.
     - Kiểm tra LSN / GTID timestamp ở Replica.
2. **Monotonic Reads**:
   - *Vấn đề*: User F5 lần 1 đọc ở Replica A (đã sync), F5 lần 2 đọc ở Replica B (chậm lag) -> thấy comment vừa viết bị biến mất (thời gian đi lùi).
   - *Giải pháp*: Sticky Replica session per user (Hash `user_id` để kết nối cố định 1 replica).
3. **Consistent Prefix Reads**:
   - *Vấn đề*: Câu trả lời xuất hiện trước câu hỏi do log truyền lệch thứ tự giữa các partition.
   - *Giải pháp*: Causal consistency, đảm bảo dữ liệu có quan hệ nhân quả nằm cùng 1 partition/replica.

---
*Ghi chú học tập sẽ được cập nhật tiếp tại đây.*
