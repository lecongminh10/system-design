# 03 — Multi-Leader Replication (Active-Active / Master-Master)

## 🎯 Mục tiêu
- Hiểu bài toán ghi trên nhiều Datacenter cùng lúc để giảm độ trễ (Latency).
- Làm chủ kỹ thuật giải quyết xung đột dữ liệu (Conflict Resolution).

## 📖 Nội dung chính
1. **Use cases phù hợp**: Multi-datacenter, offline-first mobile apps (Google Docs, Notion).
2. **Xung đột ghi (Write Conflicts)**:
   - Hai Leader nhận 2 ghi chép mâu thuẫn cho cùng 1 dòng dữ liệu cùng thời điểm.
3. **Chiến lược giải quyết xung đột (Conflict Resolution)**:
   - **LWW (Last Write Wins)**: Dùng Timestamp (Dễ mất mát dữ liệu do Clock Skew).
   - **Conflict-free Replicated Data Types (CRDTs)**: Cấu trúc dữ liệu tự hòa giải (Counters, Sets).
   - **Operational Transformation (OT)**: Dùng trong Real-time Collaborative Editing.

---
*Ghi chú học tập sẽ được cập nhật tiếp tại đây.*
