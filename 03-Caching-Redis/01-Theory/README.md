# 01 — Theory: Tổng Quan Lý Thuyết Caching

## 1. Caching là gì?

**Cache** (bộ nhớ đệm) là một lớp lưu trữ dữ liệu tốc độ cao (high-speed data storage layer), lưu trữ một tập hợp con dữ liệu tạm thời để phục vụ các yêu cầu trong tương lai nhanh hơn so với việc truy cập vào vị trí lưu trữ gốc (như Database hay Disk).

```text
[ Client / App ]  <--->  [ Cache (RAM) ~1ms ]  <--->  [ Database (Disk) ~20ms ]
```

### Điểm mấu chốt:
- Dữ liệu trong Cache là **tạm thời** (ephemeral).
- Cache đánh đổi **dung lượng lưu trữ lớn** (Disk) lấy **tốc độ truy xuất siêu nhanh** (RAM).
- Nếu dữ liệu không có trong cache, ứng dụng sẽ rơi về (fallback) nguồn gốc (Database/API) để lấy dữ liệu.

---

## 2. Latency Numbers Every Programmer Should Know

Để hiểu tại sao Caching lại quan trọng, hãy nhìn vào con số thời gian truy xuất phần cứng tiêu chuẩn (Latency Numbers by Peter Norvig / Jeff Dean):

| Thao tác (Operation) | Thời gian thực tế | Quy đổi thời gian tương đương |
| :--- | :--- | :--- |
| **L1 cache reference** | 0.5 ns | 1 giây |
| **L2 cache reference** | 7 ns | 14 giây |
| **Main Memory (RAM) reference** | 100 ns | 3.3 phút |
| **Đọc 1 MB tương tự từ RAM** | 250,000 ns (250 µs) | 5.7 ngày |
| **Đọc 1 MB từ NVMe SSD** | 1,000,000 ns (1 ms) | 23 ngày |
| **Gửi request qua Mạng (Same Datacenter Redis)** | 500,000 ns (0.5 ms) | 11.5 ngày |
| **Truy vấn Database phức tạp (RDBMS Disk Read)** | 10,000,000 - 50,000,000 ns (10 - 50 ms) | 7.6 tháng - 3.1 năm |
| **Gửi packet từ California đến Hà Nội (Round trip)** | 150,000,000 ns (150 ms) | 9.5 năm |

> **Nhận xét quan trọng:** Đọc dữ liệu từ RAM nhanh hơn đọc từ Disk từ **1,000 đến 10,000 lần**! Đây chính là lý do các hệ thống phục vụ triệu request bắt buộc phải dùng Caching.

---

## 3. Nguyên Lý Locality of Reference

Caching hoạt động hiệu quả dựa trên hai nguyên lý cơ bản của phần mềm:

### 3.1 Temporal Locality (Tính định vị theo thời gian)
Nếu một dữ liệu vừa được truy cập, nó có khả năng cao sẽ tiếp tục được truy cập lại trong tương lai gần.
- *Ví dụ:* Thông tin chi tiết của một sản phẩm đang hot sale (Flash Sale) trên sàn thương mại điện tử.

### 3.2 Spatial Locality (Tính định vị theo không gian)
Nếu một dữ liệu được truy cập, các dữ liệu nằm gần nó hoặc liên quan đến nó cũng có khả năng cao sẽ được truy cập tiếp theo.
- *Ví dụ:* Khi đọc trang 1 danh sách bài viết, người dùng có xu hướng chuyển tiếp sang trang 2 hoặc xem các bài viết liên quan.

---

## 4. Các Chỉ Số Đo Lường Cache (Cache Metrics)

Khi vận hành một hệ thống Caching, 3 chỉ số quan trọng nhất cần theo dõi là:

### 4.1 Cache Hit Ratio (Tỷ lệ trúng cache)
Là tỷ lệ phần trăm các request tìm thấy dữ liệu trong Cache thành công.

$$\text{Cache Hit Ratio} = \frac{\text{Cache Hits}}{\text{Cache Hits} + \text{Cache Misses}} \times 100\%$$

- **Hit Ratio > 90-95%**: Hệ thống cực kỳ khoẻ, DB được bảo vệ tốt.
- **Hit Ratio < 70%**: Cần xem lại chiến lược Caching, TTL hoặc key evicted quá sớm.

### 4.2 Cache Miss Ratio (Tỷ lệ trượt cache)
Là tỷ lệ các request không tìm thấy dữ liệu trong Cache và phải truy vấn vào Database.

$$\text{Cache Miss Ratio} = 100\% - \text{Cache Hit Ratio}$$

### 4.3 Eviction Rate (Tỷ lệ bị loại bỏ)
Số lượng key bị xoá khỏi Cache do hết bộ nhớ RAM (Memory limit) dựa trên thuật toán đuổi đuổi key (LRU/LFU).

---

## 5. Khái niệm Cache Warm-up

Khi một hệ thống hoặc node Redis mới khởi động, bộ nhớ Cache hoàn toàn **trống (Cold Cache)**. Nếu giải phóng toàn bộ traffic người dùng vào ngay lúc này, 100% request sẽ rơi vào Database (**Cache Miss**) khiến Database lập tức sập do quá tải.

**Cache Warm-up** là quá trình chủ động nạp sẵn các dữ liệu phổ biến (Hot Data) vào Cache **trước khi** cho phép hệ thống đón nhận traffic thực tế.

```text
[ Service Start ] ---> [ Script Warm-up đọc Top 20% Hot Products từ DB ] ---> [ Nạp vào Redis ] ---> [ Mở cổng nhận Traffic ]
```

---

## 6. Kết luận bài học

- Caching khai thác chênh lệch tốc độ giữa RAM và Disk/Network để tối ưu latency.
- Chi phí truy cập RAM < 1ms, trong khi truy vấn DB mất 10ms - 50ms+.
- Mục tiêu hàng đầu của Caching là duy trì **Cache Hit Ratio cao nhất có thể** (> 90%).
