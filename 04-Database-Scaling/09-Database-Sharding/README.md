# 09 — Database Sharding: Phân Mảnh Dữ Liệu Theo Chiều Ngang

## 1. Khái Niệm Database Sharding (Horizontal Partitioning)

Khi dung lượng dữ liệu của một bảng vượt quá giới hạn lưu trữ đĩa của một máy chủ vật lý (ví dụ: Bảng Orders vượt quá **2 Terabytes** hoặc **1 tỷ dòng**) hoặc lượng truy vấn Ghi (WRITE) vượt quá khả năng xử lý của 1 Master DB, ta phải áp dụng **Database Sharding**.

**Sharding** là kỹ thuật chia nhỏ một tập dữ liệu lớn thành nhiều phần độc lập gọi là các **Shards**. Mỗi Shard là một cơ sở dữ liệu riêng biệt nằm trên một máy chủ vật lý riêng.

```text
                                  [ Global Application Router ]
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 │ (User 1 - 10M)               │ (User 10M - 20M)             │ (User 20M - 30M)
                 v                              v                              v
        +------------------+           +------------------+           +------------------+
        |     SHARD 1      |           |     SHARD 2      |           |     SHARD 3      |
        |  (Server DB 1)   |           |  (Server DB 2)   |           |  (Server DB 3)   |
        +------------------+           +------------------+           +------------------+
```

---

## 2. Sharding Key — Yếu Tố Quyết Định Thành Bại

**Sharding Key** là thuộc tính (cột dữ liệu) được sử dụng để xác định một dòng dữ liệu cụ thể sẽ sống ở Shard nào.

### Tiêu chuẩn chọn Sharding Key tốt:
1. **Phân bố dữ liệu đồng đều (High Cardinality & Even Distribution)**: Tránh hiện tượng **Data Skew (Mất cân bằng dữ liệu)**.
2. **Định tuyến truy vấn chính xác (Query Routing)**: Hầu hết các câu truy vấn quan trọng trong ứng dụng phải chứa Sharding Key trong mệnh đề `WHERE` để Router bắn thẳng request tới 1 Shard duy nhất (Single-Shard Query).

### Ví dụ Lựa chọn Sharding Key:
- **Tốt**: `user_id` (Trong ứng dụng B2C như Facebook, Shopee), `tenant_id` (Trong ứng dụng SaaS B2B).
- **Xấu**:
  - `created_at` (Ngày tạo): Tạo ra **Hotspot Shard** — toàn bộ Write của ngày hôm nay sẽ dồn hết vào Shard mới nhất, các Shard cũ hoàn toàn nhàn rỗi!
  - `gender` (Giới tính): Chỉ có 2-3 giá trị, dữ liệu bị dồn thành 2 cụm khổng lồ.

---

## 3. Các Phương Pháp Phân Mảnh (Sharding Strategies)

### 3.1 Hash-Based Sharding (Phương pháp Modulus)

$$\text{Shard ID} = \text{Hash}(\text{Sharding Key}) \pmod{\text{Total Shards}}$$

- **Ưu điểm**: Dữ liệu được phân bổ cực kỳ đồng đều giữa các Shards.
- **Nhược điểm**: **Cực kỳ khó scale out khi thêm Shard mới!** Nếu tăng số Shard từ 3 lên 4, công thức Modulo đổi từ $\% 3$ sang $\% 4$, dẫn tới **90% dữ liệu bị sai Shard** và phải chạy chiến dịch Resharding di chuyển toàn bộ Data vô cùng phức tạp.

---

### 3.2 Range-Based Sharding (Phân mảnh theo khoảng)

Phân chia dựa trên dải giá trị của Sharding Key:
- Shard 1: `User ID` từ 1 -> 1.000.000
- Shard 2: `User ID` từ 1.000.001 -> 2.000.000

- **Ưu điểm**: Dễ dàng thêm Shard mới (chỉ cần tạo Shard 3 cho User ID 2.000.001+).
- **Nhược điểm**: Bị **Hotspot Write** ở Shard cao nhất vừa tạo.

---

### 3.3 Consistent Hashing (Vòng Băm Nhất Quán)

Sử dụng thuật toán **Consistent Hashing** (như trong Cassandra hoặc DynamoDB) xếp các Shard và Data Keys trên cùng một vòng tròn số nguyên $0 \to 2^{32}-1$.

```text
                          [ Shard A ] (Pos: 100)
                         /          \
                        /            \
       [ Key X ] ──────>              [ Shard B ] (Pos: 200)
                        \            /
                         \          /
                          [ Shard C ] (Pos: 300)
```

- **Ưu điểm vượt trội**: Khi thêm hoặc xóa 1 Shard, hệ thống **CHỈ CẦN di chuyển $\frac{1}{N}$ số lượng key** từ Shard kế cận, không cần di chuyển toàn bộ database!

---

## 4. Những Thách Thức Và Nhược Điểm Lớn Của Sharding

Sharding là "vũ khí hạng nặng" cuối cùng khi scaling DB. Bạn phải chấp nhận trả giá bằng các thách thức lớn sau:

### 4.1 Cross-Shard JOINs (Không thể JOIN khác Shard)
Không thể thực hiện lệnh SQL `JOIN` giữa 2 bảng nằm trên 2 máy chủ Shard khác nhau:
- ❌ `SELECT * FROM users u JOIN orders o ON u.id = o.user_id` (Nếu Users và Orders nằm ở 2 Shards riêng).
- ✅ **Giải pháp**: **Denormalization (Phi chuẩn hóa dữ liệu)** bằng cách lưu sẵn thông tin `user_name` vào bảng `orders`, hoặc tự xử lý JOIN ở tầng Application Code.

---

### 4.2 Cross-Shard Transactions (Giao Dịch Phân Tán)
Khi chuyển tiền từ `User A` (nằm ở Shard 1) sang `User B` (nằm ở Shard 2), tính chất ACID bị phá vỡ.
- ✅ **Giải pháp**: Sử dụng giao thức **Two-Phase Commit (2PC)** hoặc mô hình **Saga Pattern** (Event-Driven với Message Queue như Kafka/RabbitMQ) để đảm bảo Nhất Quán Sau Cùng (Eventual Consistency).

---

### 4.3 Global Unique Primary Key Generation (Tạo ID Duy Nhất Toàn Cục)
Khi có 10 Shard DB độc lập, không thể dùng tính năng `AUTO_INCREMENT` của từng DB node vì sẽ bị trùng lặp ID giữa các Shard (`Shard 1` tạo ID = 100, `Shard 2` cũng tạo ID = 100).

- **Giải pháp tạo Distributed Unique ID**:
  1. **UUIDv7**: Chứa timestamp 48-bit ở đầu giúp sắp xếp được theo thời gian và không trùng lặp.
  2. **Twitter Snowflake ID**: Chuỗi 64-bit integer bao gồm: `Timestamp (41 bit) + Datacenter ID (5 bit) + Worker ID (5 bit) + Sequence (12 bit)`.

```text
 0 - 00000000000000000000000000000000000000000 - 00000 - 00000 - 000000000000
 ^   -----------------------------------------   -----   -----   ------------
 Sign               Timestamp                     DC ID  Node ID   Sequence
(1bit)               (41 bits)                   (5 bits)(5 bits)  (12 bits)
```
