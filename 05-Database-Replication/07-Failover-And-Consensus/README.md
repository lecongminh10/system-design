# 07 — Failover, High Availability & Consensus Algorithms

## 🎯 Mục tiêu
- Nắm vững quy trình phát hiện sự cố (Node Failure Detection) và chuyển giao Leader (Failover).
- Hiểu hiểm họa **Split-Brain** và cách phòng chống bằng STONITH / Consensus (Raft/Paxos).

## 📖 Nội dung chính
1. **Quy trình Failover**:
   - Step 1: Detect Master node down qua Heartbeat Timeout.
   - Step 2: Bầu chọn Replica mới nhất ( highest GTID/LSN) làm Master.
   - Step 3: Reconfigure routing (Virtual IP, ProxySQL, DNS).
2. **Hiện tượng Split-Brain**:
   - Mạng bị phân đoạn (Network Partition) -> 2 node đều tưởng node kia chết và nhận làm Master -> Data bị đè lẫn nhau dữ dội.
3. **Giải pháp**:
   - **Fencing / STONITH (Shoot The Other Node In The Head)**: Ngắt điện/ngắt mạng node Master cũ cứng.
   - **Consensus Algorithms**: Bầu chọn theo số đông Quorum (Raft, Paxos via ZooKeeper/etcd/Patroni).

---
*Ghi chú học tập sẽ me được cập nhật tiếp tại đây.*
