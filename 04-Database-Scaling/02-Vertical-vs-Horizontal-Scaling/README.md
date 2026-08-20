# 02 — Vertical vs Horizontal Scaling (Scale Up vs Scale Out)

## 1. Khái Niệm Cơ Bản

Khi cơ sở dữ liệu quá tải, có hai hướng tiếp cận chính để mở rộng khả năng xử lý:

```text
       VERTICAL SCALING (SCALE UP)              HORIZONTAL SCALING (SCALE OUT)

           +-----------------+                     +-------+  +-------+  +-------+
           | DB Instance     |                     | DB 1  |  | DB 2  |  | DB 3  |
           | 128 vCPU        |                     | 16vCPU|  | 16vCPU|  | 16vCPU|
           | 512 GB RAM      |                     | 64GB  |  | 64GB  |  | 64GB  |
           | 10TB NVMe SSD   |                     +-------+  +-------+  +-------+
           +-----------------+                     (Nhiều Server phần cứng nhỏ)
    (1 Server cực khủng, nâng cấp phần cứng)
```

---

## 2. Vertical Scaling (Scale Up)

### 2.1 Bản chất
Nâng cấp tài nguyên phần cứng của server Database hiện tại:
- Tăng CPU (từ 8 cores lên 32, 64, 128 vCPU).
- Tăng RAM (từ 16GB lên 128GB, 512GB, 1TB RAM).
- Chuyển sang ổ đĩa tốc độ cao hơn (HDD -> SATA SSD -> NVMe PCIe SSD -> Intel Optane).

### 2.2 Ưu điểm
- **Đơn giản tối đa**: Không cần sửa đổi kiến trúc ứng dụng hay viết lại câu lệnh SQL.
- **Giữ nguyên 100% tính chất ACID**: Transaction, Foreign Key, JOIN phức tạp giữa nhiều bảng hoạt động hoàn hảo trên 1 node.
- **Không có Replication Lag hay Phân tán data**: Dữ liệu luôn nhất quán tức thì (Strong Consistency).

### 2.3 Nhược điểm & Giới hạn
- **Physical Hardware Ceiling (Trần giới hạn phần cứng)**: Không thể tăng RAM hoặc CPU mãi mãi. Server lớn nhất hiện tại cũng có giới hạn.
- **Chi phí đắt đỏ theo cấp số nhân (Law of Diminishing Returns)**: Server RAM 512GB đắt hơn gấp 10 lần server RAM 64GB.
- **Single Point of Failure (SPOF)**: Nếu server duy nhất bị sập hoặc hỏng phần cứng, toàn bộ hệ thống ngưng hoạt động.
- **Downtime khi nâng cấp**: Cần dừng database để thay thế / nâng cấp linh kiện phần cứng.

---

## 3. Horizontal Scaling (Scale Out)

### 3.1 Bản chất
Phân tán dữ liệu và tải xử lý ra nhiều máy chủ (nodes) chạy song song với nhau:
- **Read Scaling**: Thêm các Read Replicas.
- **Write Scaling**: Database Sharding hoặc Distributed Databases (CockroachDB, TiDB, Google Spanner, Cassandra, MongoDB Cluster).

### 3.2 Ưu điểm
- **Khả năng mở rộng gần như vô hạn**: Cần thêm năng lượng xử lý chỉ cần mua thêm các node tiêu chuẩn (Commodity Hardware) ghép vào cụm.
- **Tăng tính sẵn sàng (High Availability - HA)**: Nếu 1 node bị hỏng, các node còn lại vẫn hoạt động bình thường, không gây sập hệ thống.
- **Tối ưu chi phí linh hoạt**: Thêm/bớt node theo nhu cầu thực tế của lưu lượng truy cập.

### 3.3 Nhược điểm & Thách thức
- **Độ phức tạp kiến trúc tăng vọt**: Ứng dụng phải xử lý việc định tuyến query, phân chia data.
- **Đánh đổi tính nhất quán (CAP Theorem)**: Phải chấp nhận **Eventual Consistency** (Nhất quán sau cùng) thay vì Strong Consistency.
- **Thách thức với Cross-Node Queries**: Không thể `JOIN` trực tiếp các bảng nằm trên 2 node khác nhau; Distributed Transactions (2PC) có thời gian phản hồi cực chậm.

---

## 4. Bảng So Sánh Chi Tiết

| Tiêu Chí So Sánh | Vertical Scaling (Scale Up) | Horizontal Scaling (Scale Out) |
| :--- | :--- | :--- |
| **Cách triển khai** | Thay đổi kích thước máy chủ (Tăng CPU/RAM) | Thêm máy chủ mới vào cụm cluster |
| **Chi phí phần cứng** | Tăng theo cấp số nhân (Rất đắt ở quy mô lớn) | Tăng theo cấp số nhân tuyến tính (Chi phí tối ưu hơn) |
| **Giới hạn tối đa** | Bị giới hạn bởi công nghệ phần cứng hiện tại | Hầu như không giới hạn |
| **Độ phức tạp phần mềm**| Thấp (Không cần sửa đổi code/SQL) | Cao (Cần Data Routing, Sharding, Replication logic) |
| **Tính sẵn sàng (HA)** | Thấp (SPOF ngoại trừ khi có Standby node) | Cao (Lỗi 1 node hệ thống vẫn chạy) |
| **Độ nhất quán (ACID)** | Strong Consistency tuyệt đối | Eventual Consistency (hoặc 2PC tốn kém) |
| **Phù hợp nhất cho** | Hệ thống vừa và nhỏ, OLTP nặng về Transaction | Hệ thống Big Data, Web Scale (Triệu QPS, Hàng TB/PB Data) |

---

## 5. Khi nào chọn phương án nào?

### Chọn Scale Up khi:
1. Hệ thống mới khởi chạy hoặc ở quy mô vừa (Dung lượng data < 500GB, QPS < 5.000).
2. Đội ngũ kỹ sư mỏng, chưa có chuyên môn vận hành Distributed Systems.
3. Ứng dụng yêu cầu tính nhất quán dữ liệu nghiêm ngặt (Tài chính, Kế toán, Ngân hàng).

### Chọn Scale Out khi:
1. Đã chạm trần phần cứng của Scale Up (Server Max cấu hình nhưng CPU vẫn > 90%).
2. Lưu lượng truy cập Read/Write lớn khủng giội (Triệu request/giây).
3. Cần đảm bảo hệ thống Uptime 99.999% không được phép có Single Point of Failure.
