# 04 — Leaderless Replication (Dynamo-Style & Quorum)

## 🎯 Mục tiêu
- Hiểu kiến trúc không có Leader duy nhất (Amazon Dynamo, Apache Cassandra, Riak).
- Tính toán công thức Quorum ($W + R > N$) để đạt Strong Consistency.

## 📖 Nội dung chính
1. **Nguyên lý Leaderless**: Client gửi request đồng thời tới tất cả $N$ nodes trong cluster.
2. **Quorum Consensus**:
   - $N$: Số node nhân bản (Replication Factor).
   - $W$: Số node phải xác nhận ghi thành công trước khi trả về Client.
   - $R$: Số node phải phản hồi đọc thành công.
   - **Strong Consistency**: Khi $W + R > N$.
3. **Cơ chế phục hồi dữ liệu cũ**:
   - **Read Repair**: Phát hiện version cũ khi Read -> Tự gửi update lại node cũ.
   - **Anti-Entropy Process**: Chạy background dùng Merkle Tree so sánh hash dữ liệu giữa các node.

---
*Ghi chú học tập sẽ được cập nhật tiếp tại đây.*
