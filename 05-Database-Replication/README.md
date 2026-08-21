# Bài 05 — Database Replication (Nhân Bản Cơ Sở Dữ Liệu)

## 1. Mục tiêu bài học

Sau khi hoàn thành module **Database Replication**, bạn sẽ làm chủ:
- **Bản chất lý thuyết & Cơ chế hoạt động**: Nắm vững WAL (Write-Ahead Log), Binlog (GTID), Replication Stream và cách data biến đổi từ Primary tới Replicas.
- **Phân loại Kiến trúc Replication**: So sánh ưu/nhược điểm và case study thực tế của Single Leader (Master-Slave), Multi-Leader (Master-Master), và Leaderless (Quorum Dynamo-style like Cassandra/Riak).
- **Chế độ Đồng bộ**: Phân biệt Synchronous, Asynchronous và Semi-Synchronous Replication. Đánh giá Trade-off theo định lý CAP & PACELC (Latency vs Durability vs Availability).
- **Giải quyết Bài toán Replication Lag**: Hiểu 3 hiện tượng bất thường kinh điển (Reading Own Writes, Monotonic Reads, Consistent Prefix Reads) và kiến trúc ứng xử ở tầng Application/Proxy.
- **Failover & Consensus**: Cách phát hiện node chết, cơ chế bầu chọn Leader (Consensus Raft/Paxos), chống Split-Brain và STONITH / Fencing mechanism.
- **Read/Write Splitting Architecture**: Thiết kế phân tách truy vấn bằng Spring Boot (`AbstractRoutingDataSource`) và Database Proxy (ProxySQL / PgBouncer).
- **Thực hành Lab Docker**: Tự tay dựng MySQL Master-Replica GTID, PostgreSQL Streaming Replication, kiểm thử Lag, Failover và Read/Write Splitting.

---

## 2. Lộ Trình Học Chi Tiết (Learning Roadmap)

Lộ trình được chia làm **7 giai đoạn** từ Lý thuyết cốt lõi -> Kiến trúc nâng cao -> Xử lý Sự cố -> Thực hành Lab -> Phỏng vấn System Design.

```text
[Giai đoạn 1: Foundations]
 └── Khái niệm, WAL/Binlog, Mục đích (HA, DR, Scale Read)
        │
[Giai đoạn 2: Topologies]
 └── Single-Leader vs Multi-Leader vs Leaderless (Quorum W + R > N)
        │
[Giai đoạn 3: Sync Modes & CAP/PACELC]
 └── Sync vs Async vs Semi-Sync Replication
        │
[Giai đoạn 4: Replication Lag & Consistency Anomalies]
 └── Read-after-write, Monotonic reads, Consistent prefix & Mitigations
        │
[Giai đoạn 5: Failover, HA & Consensus]
 └── Heartbeat, Split-Brain, STONITH, Raft/Paxos, Virtual IP
        │
[Giai đoạn 6: Read/Write Splitting & Proxy]
 └── Spring Boot Dynamic DataSource, ProxySQL / PgBouncer Routing
        │
[Giai đoạn 7: Hands-on Labs & Interview Prep]
 └── Docker Labs (MySQL/Postgres) + Mini-project + 15+ Câu hỏi System Design
```

---

## 3. Danh sách Các Bài Học Chi Tiết

| STT | Bài Học | Nội Dung Trọng Tâm |
| :--- | :--- | :--- |
| **01** | [01-Overview-And-WAL](./01-Overview-And-WAL/README.md) | Tổng quan Replication, WAL (Write-Ahead Log), Binlog, Redo Log & Replication Stream |
| **02** | [02-Single-Leader-Replication](./02-Single-Leader-Replication/README.md) | Kiến trúc Primary-Replica (Master-Slave), Statement-based vs WAL-based vs Row-based replication |
| **03** | [03-Multi-Leader-Replication](./03-Multi-Leader-Replication/README.md) | Active-Active (Master-Master), Cross-datacenter, Conflict Resolution (LWW, CRDTs, Operational Transformation) |
| **04** | [04-Leaderless-Replication](./04-Leaderless-Replication/README.md) | Dynamo-style Replication, Read/Write Quorum ($W + R > N$), Read Repair, Anti-Entropy (Merkle Tree) |
| **05** | [05-Sync-Async-SemiSync](./05-Sync-Async-SemiSync/README.md) | Synchronous vs Asynchronous vs Semi-Synchronous, Trade-offs theo Định lý CAP & PACELC |
| **06** | [06-Replication-Lag-And-Consistency](./06-Replication-Lag-And-Consistency/README.md) | Replication Lag, Read-Your-Own-Writes, Monotonic Reads, Consistent Prefix Reads & Giải pháp |
| **07** | [07-Failover-And-Consensus](./07-Failover-And-Consensus/README.md) | Detection, Automatic vs Manual Failover, Split-Brain, Fencing (STONITH), Consensus (Raft/Paxos) |
| **08** | [08-Read-Write-Splitting](./08-Read-Write-Splitting/README.md) | App Routing (`AbstractRoutingDataSource`) vs Proxy Routing (ProxySQL, PgBouncer) |
| **09** | [09-Hands-On-Labs](./09-Hands-On-Labs/README.md) | Thực hành Labs: Dựng MySQL GTID Master-Replica, Postgres Streaming Replication & Stress Test |
| **10** | [10-Interview-Questions](./10-Interview-Questions/README.md) | Bộ 15+ câu hỏi phỏng vấn System Design hàng đầu về Database Replication |

---

## 4. Kiến trúc Tổng thể Master - Replica & Read/Write Splitting

```text
                            +--------------------------+
                            |    Client App / API      |
                            +------------+-------------+
                                         |
                                         v
                            +--------------------------+
                            |   Spring Boot Services   |
                            | (AbstractRoutingDS /     |
                            |  @Transactional(readOnly)|
                            +-----+--------------+-----+
                                  |              |
                    WRITE Queries |              | READ Queries
                    (INSERT/UPDATE)              | (SELECT)
                                  v              v
                        +---------------+  +---------------+
                        | Master /      |  | DB Proxy /    |
                        | Primary DB    |  | PgBouncer /   |
                        +-------+-------+  | ProxySQL      |
                                |          +-------+-------+
                       Binlog / |                  |
                       WAL Stream                  v
                                |          +---------------+
                                +--------->| Replica 1     |
                                |          | (Read Only)   |
                                |          +---------------+
                                |                  
                                |          +---------------+
                                +--------->| Replica 2     |
                                           | (Read Only)   |
                                           +---------------+
```

---

## 5. Kế hoạch Học tập Theo Tuần (Weekly Plan)

### 🗓️ Tuần 1: Lý Thuyết Nền Tảng & Các Mô Hình Replication (Bài 01 - 04)
- **Mục tiêu**: Hiểu bản chất bên dưới DB (WAL/Binlog) và phân biệt 3 mô hình Single-Leader, Multi-Leader, Leaderless.
- **Sản phẩm**: Nắm vững công thức Quorum $W + R > N$, giải thích được Conflict Resolution trong Multi-Master.

### 🗓️ Tuần 2: Chế Độ Đồng Bộ, Consistency & Failover (Bài 05 - 07)
- **Mục tiêu**: Nắm vững Sync/Async/Semi-Sync, xử lý triệt để Replication Lag và thiết kế Failover an toàn.
- **Sản phẩm**: Giải pháp chống đọc dữ liệu cũ (Read-after-write consistency), cơ chế Raft/Paxos bầu chọn Master.

### 🗓️ Tuần 3: Read/Write Splitting & Thực Hành Labs Docker (Bài 08 - 09)
- **Mục tiêu**: Dựng môi trường thực tế và tích hợp code Spring Boot / Proxy.
- **Sản phẩm**:
  - Docker Compose file chạy 1 Master + 2 Replicas MySQL GTID.
  - Project Spring Boot tự động phân tuyến Write -> Master, Read -> Replica.
  - Lab test Failover: Kill Master node -> Replica tự upgrade hoặc switch connection.

### 🗓️ Tuần 4: Luyện Phỏng Vấn & System Design Trade-offs (Bài 10)
- **Mục tiêu**: Trả lời tự tin các câu hỏi hóc búa của Nhà tuyển dụng / Software Architect.
- **Sản phẩm**: Hoàn thành Checklist 15+ câu hỏi phỏng vấn chuẩn Big Tech.

---

## 6. Checklist Tự Đánh Giá Hoàn Thành Bài Học

- [ ] Tôi giải thích được WAL (Write-Ahead Log) và Binlog là gì, vai trò trong Replication.
- [ ] Tôi phân biệt được Single-Leader, Multi-Leader và Leaderless (Dynamo-style).
- [ ] Tôi tính được Quorum $W + R > N$ để đảm bảo Strong Consistency trong Leaderless.
- [ ] Tôi phân biệt được Sync vs Async vs Semi-Sync Replication và trade-off Latency/Durability.
- [ ] Tôi hiểu 3 hiện tượng do Replication Lag: Read-your-own-writes, Monotonic reads, Consistent prefix reads.
- [ ] Tôi biết cách routing Read/Write trong Spring Boot bằng `AbstractRoutingDataSource`.
- [ ] Tôi giải thích được hiện tượng Split-Brain và cơ chế Fencing / Consensus (Raft).
- [ ] Tôi đã tự tay dựng thành công MySQL Master-Replica bằng Docker Compose.
