# 03 — Database Replication: Cơ Chế Nhân Bản & Chế Độ Đồng Bộ

## 1. Cơ Chế Cơ Bản của Database Replication

**Database Replication (Nhân bản cơ sở dữ liệu)** là kỹ thuật tự động sao chép dữ liệu liên tục từ một máy chủ cơ sở dữ liệu (được gọi là **Primary / Master / Leader**) sang một hoặc nhiều máy chủ cơ sở dữ liệu khác (được gọi là **Replica / Slave / Follower / Standby**).

```text
                                +-------------------+
                                | App (Write Data)  |
                                +---------+---------+
                                          |
                                          v
                                +-------------------+
                                |    Primary DB     | (Chấp nhận READ & WRITE)
                                |     (Master)      |
                                +---------+---------+
                                          |
                        +-----------------+-----------------+
                        | Binary Log / WAL Streaming        |
                        v                                   v
             +-------------------+                 +-------------------+
             | Read Replica 1    |                 | Read Replica 2    |
             |  (Only READ)      |                 |  (Only READ)      |
             +-------------------+                 +-------------------+
```

### Các mục đích chính:
1. **Read Scaling**: Phân tải truy vấn Đọc (READ) cho nhiều Replicas.
2. **High Availability (Tính sẵn sàng cao)**: Nếu Master bị lỗi, một Replica có thể được bầu chọn lên làm Master mới (Failover).
3. **Disaster Recovery (Phục hồi thảm họa)**: Duy trì một bản sao dữ liệu ở Datacenter/Region khác.
4. **Analytics Offloading**: Chạy các truy vấn thống kê, báo cáo nặng (Heavy OLAP queries) trên Replica mà không ảnh hưởng tới người dùng ở Master.

---

## 2. Các Chế Độ Đồng Bộ Dữ Liệu (Replication Modes)

### 2.1 Synchronous Replication (Đồng bộ tuyệt đối)

```text
Client ──(Write)──> Master ──(Replicate)──> Replica
                      │                       │
                      │ <───(Ack Success)─────┤
                      │
Client <──(Success)───┘
```
- **Nguyên lý**: Master chỉ phản hồi kết quả thành công cho Client **SAU KHI** tất cả (hoặc một số lượng Replicas chỉ định) đã nhận và ghi thành công dữ liệu xuống đĩa.
- **Ưu điểm**: **Zero Data Loss**. Đảm bảo dữ liệu trên Replica luôn hoàn toàn giống Master 100%.
- **Nhược điểm**: Thời gian phản hồi (Latency) rất cao vì bị phụ thuộc vào đường truyền mạng và tốc độ ghi của Replica chậm nhất. Nếu 1 Replica bị sập, Master cũng sẽ ngưng nhận lệnh Write.

---

### 2.2 Asynchronous Replication (Bất đồng bộ)

```text
Client ──(Write)──> Master ──(Success)──> Client
                      │
                      └──(Replicate in Background)──> Replica (Replication Lag!)
```
- **Nguyên lý**: Master ghi dữ liệu xuống đĩa của nó xong là trả về kết quả thành công cho Client lập tức. Quá trình gửi Replication Log sang Replica diễn ra ngầm ở background.
- **Ưu điểm**: Thời gian phản hồi (Latency) cực nhanh, không bị ảnh hưởng nếu các Replica bị chậm hoặc sập.
- **Nhược điểm**: Dữ liệu ở Replica bị chậm hơn Master một khoảng thời gian (**Replication Lag**). Nếu Master bị sập đột ngột, các transaction chưa kịp replicate sang Replica sẽ bị mất vĩnh viễn (Data Loss).

---

### 2.3 Semi-Synchronous Replication (Bán đồng bộ)

- **Nguyên lý**: Master chờ **ít nhất 1 Replica** nhận được log (ghi vào Relay Log) và gửi ACK về thì mới trả về OK cho Client. Các Replica còn lại sẽ tiếp tục nhận log bất đồng bộ.
- **Đánh giá**: Đây là sự cân bằng hoàn hảo giữa hiệu năng và độ an toàn dữ liệu, được sử dụng rất phổ biến trong MySQL InnoDB Cluster và PostgreSQL Replication.

---

## 3. Kiến Trúc Topology

```text
1. Single Leader (1 Master - N Replicas): 
   Phổ biến nhất, 1 Master xử lý Write, N Replica xử lý Read.

2. Multi-Leader (Master - Master):
   Nhiều node cùng nhận Write. Phù hợp Multi-Region Datacenter.
   Thách thức lớn nhất: Conflict Resolution khi 2 Master sửa cùng 1 dòng dữ liệu đồng thời.

3. Leaderless (Dynamo-Style - Cassandra/ScyllaDB):
   Không có Master. Client ghi đồng thời vào Quorum nodes (W + R > N).
```

---

## 4. Vấn Đề Replication Lag & Giải Pháp Kiến Trúc

**Replication Lag** là khoảng thời gian chênh lệch giữa lúc dữ liệu được ghi vào Master và lúc nó xuất hiện trên Replica (có thể từ vài milisecond đến vài phút nếu hệ thống tải cao).

### Các sự cố kinh điển do Replication Lag gây ra:

#### A. Read-Your-Own-Writes Consistency (Nhất quán Ghi-Đọc của tôi)
- **Kịch bản**: Người dùng đổi Avatar -> App gửi Write vào Master -> Người dùng F5 lại trang -> App Đọc dữ liệu từ Read Replica (chưa kịp sync) -> Người dùng vẫn thấy Avatar cũ và nghĩ ứng dụng bị lỗi.
- **Giải pháp**:
  - Với các thông tin do chính người dùng vừa sửa, trong vòng $X$ giây (vd: 5 giây), **bắt buộc đọc trực tiếp từ Master DB**.
  - Hoặc theo dõi LSN (Log Sequence Number) / GTID: Chỉ đọc từ Replica nếu GTID của Replica đã bắt kịp GTID của lệnh Write vừa thực hiện.

#### B. Monotonic Reads (Đọc đơn điệu)
- **Kịch bản**: Lần 1 đọc từ Replica A (đã sync xong) -> Thấy bình luận của bạn bè. Lần 2 F5 đọc từ Replica B (đang bị lag) -> Bình luận biến mất!
- **Giải pháp**: Sticky Replica Session — Đảm bảo mỗi User Session luôn luôn được định tuyến đọc cố định từ 1 Replica duy nhất.

#### C. Consistent Prefix Reads (Đọc theo tiền tố nhất quán)
- **Kịch bản**: Câu hỏi xuất hiện sau câu trả lời do thứ tự replicate các dòng bị đảo lộn.
- **Giải pháp**: Đảm bảo các dữ liệu có quan hệ nhân quả (Causally dependent) phải được ghi vào cùng một Partition/Shard.
