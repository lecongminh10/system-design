# 04 — Read Replica, High Availability & Automatic Failover

## 1. Kiến Trúc Read Replica cho Hệ Thống Read-Heavy

Trong hầu hết ứng dụng thực tế (Mạng xã hội, Thương mại điện tử, Tin tức), tỷ lệ truy vấn Đọc (READ) luôn áp đảo truy vấn Ghi (WRITE) — thường là **80:20 hoặc 95:5**.

Thay vì để 1 DB duy nhất gánh cả READ và WRITE, mô hình **Single Master — Multiple Read Replicas** cho phép mở rộng tuyến tính năng lực phục vụ truy vấn READ.

```text
                               +-------------------+
                               |     App Cluster   |
                               +----+---------+----+
                                    |         |
                     WRITE Requests |         | READ Requests (Load Balanced)
                                    v         v
                         +--------------+  +--------------------------------+
                         | Master DB    |  | Read Replicas Cluster          |
                         | (1 Instance) |  | (Replica 1, Replica 2, ... N)  |
                         +------+-------+  +--------------------------------+
                                | Replication Log
                                +-------------------->
```

### Các ưu điểm nổi bật:
- **Tăng Throughput READ khủng giội**: Có thể gắn 5-10 Read Replicas để nâng khả năng xử lý lên hàng trăm ngàn READ queries/sec.
- **Bảo vệ Master DB**: Giữ cho CPU và I/O trên Master luôn thấp để phục vụ các giao dịch WRITE quan trọng.
- **Tối ưu hóa báo cáo (Analytics)**: Các truy vấn `SELECT COUNT(*)`, JOIN phức tạp được đẩy sang 1 Replica riêng biệt mà không ảnh hưởng tới người dùng cuối.

---

## 2. High Availability (HA) & Các Chỉ Số RTO / RPO

Khi xây dựng hạ tầng Cơ sở dữ liệu cho doanh nghiệp, hai chỉ số SLO/SLA quan trọng nhất là:

- **RTO (Recovery Time Objective)**: Thời gian tối đa hệ thống cho phép khôi phục lại hoạt động sau sự cố. (Ví dụ: RTO < 30 giây).
- **RPO (Recovery Point Objective)**: Lượng dữ liệu tối đa hệ thống chấp nhận bị mất mát khi gặp sự cố thảm họa. (Ví dụ: RPO = 0 trong Sync replication, hoặc RPO < 1 giây trong Async replication).

---

## 3. Quy Trình Automatic Failover (Tự Động Chuyển Vùng Lỗi)

Khi máy chủ Master bị hỏng phần cứng hoặc sập mạng, hệ thống quản lý HA (như **Patroni** cho PostgreSQL, **Orchestrator** cho MySQL, **AWS Aurora Auto-Failover**) phải thực hiện quy trình tự động sau:

```text
[Step 1: Detect Failure]  --->  [Step 2: Elect New Master] ---> [Step 3: Promote Node]
  Master không phản hồi          Chọn Replica có GTID mới         Chuyển Replica B thành
  Health check trong 10s         nhất & Replication lag = 0       Master mới (Writable)
                                                                        │
[Step 5: Re-configure]   <---  [Step 4: Update Routing] <---------------+
  Cấu hình các Replica            Cập nhật Virtual IP / DNS /
  khác follow New Master          ProxySQL trỏ Write sang New Master
```

### 3.1 Quy trình chi tiết từng bước:
1. **Phát hiện lỗi (Failure Detection)**: Monitoring Agent / Heartbeat Service liên tục gửi ping đến Master. Nếu mất kết nối 3 lần liên tiếp (ví dụ sau 10-15s), xác nhận Master DOWN.
2. **Bầu chọn Master mới (Leader Election)**: Sử dụng thuật toán đồng thuận (Consensus algorithm như Raft/Paxos via Etcd/Consul) để chọn ra Read Replica có vị trí log mới nhất (Highest Log Sequence Number / GTID).
3. **Thăng cấp Node (Promotion)**: Thực hiện câu lệnh Promote Replica đó lên thành Primary (Bật quyền READ-WRITE).
4. **Cập nhật định tuyến (Traffic Routing Update)**:
   - Thay đổi **Virtual IP (VIP)** thông qua Keepalived.
   - Hoặc cập nhật bản tin **DNS record** nội bộ.
   - Hoặc thông báo cho **DB Proxy (PgBouncer/ProxySQL)** thay đổi IP Master target.
5. **Re-pointing các Replica còn lại**: Ra lệnh cho các Read Replicas còn lại chuyển sang sync dữ liệu từ New Master.

---

## 4. Hiện Tượng Split-Brain & Kỹ Thuật Phòng Tránh

### 4.1 Split-Brain là gì?
**Split-Brain (Phân liệt não)** xảy ra khi kết nối mạng giữa Master cũ và cụm Replica bị đứt (Network Partition), nhưng Master cũ **VẪN CÒN SỐNG**. 

Lúc này, hệ thống HA lầm tưởng Master cũ đã chết và bầu chọn Replica A lên làm Master mới. Kết quả là hệ thống xuất hiện **2 MASTER CÙNG LÚC**:
- Một số App Server vẫn ghi vào Master cũ.
- Một số App Server ghi vào Master mới.
-> Dữ liệu bị sai lệch phân tán (Data Divergence) vô cùng nghiêm trọng và cực kỳ khó khắc phục!

```text
                    NETWORK PARTITION (Mạng bị đứt!)
         [ Master Cũ ] <──────── X ────────> [ Failover Agent ]
        (Vẫn nhận Write)                         (Tưởng Master Cũ chết)
               │                                           │
               v                                           v
    [ App Group 1 Write ]                       [ Bầu Master Mới! ]
                                                [ App Group 2 Write ]
                                           ===> TWO MASTERS (SPLIT BRAIN)!
```

### 4.2 Giải pháp khắc phục (Fencing / STONITH):
1. **Quorum Voting**: Yêu cầu số lượng node bầu chọn phải đạt Quorum (Đa số: $N/2 + 1$). Nếu một phân vùng mạng không đủ Quorum, nó không được phép tự bầu Master.
2. **Fencing / STONITH (Shoot The Other Node In The Head)**: Trước khi Promote Replica mới lên Master, Failover Agent bắt buộc phải ngắt nguồn điện (PDU switch) hoặc cô lập hoàn toàn hạ tầng mạng của Master cũ để đảm bảo nó chết hẳn 100%.
