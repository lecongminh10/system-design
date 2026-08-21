# 05 — Synchronous, Asynchronous & Semi-Synchronous Replication

## 🎯 Mục tiêu
- Hiểu sự khác biệt về latency, durability và availability giữa 3 chế độ đồng bộ.
- Phân tích trade-offs dựa trên Định lý CAP và Định lý PACELC.

## 📖 Nội dung chính
1. **Synchronous Replication**:
   - Master chờ tất cả Replicas ghi xong disk mới ack client.
   - Pros: Zero data loss.
   - Cons: Tăng Write Latency; nếu 1 Replica nghẽn/chết thì Master ngừng nhận Write!
2. **Asynchronous Replication**:
   - Master ghi xong disk trả về ack ngay, log chuyển cho Replica ở background.
   - Pros: Viết cực nhanh, không phụ thuộc đường truyền mạng.
   - Cons: Có rủi ro mất dữ liệu nếu Master chết trước khi log đến Replica.
3. **Semi-Synchronous Replication**:
   - Master chỉ cần 1 Replica nhận log vào Relay Log (chưa cần apply) là ack client.
   - Cân bằng hoàn hảo giữa Performance và Data Safety (PostgreSQL / MySQL production standard).

---
*Ghi chú học tập sẽ được cập nhật tiếp tại đây.*
