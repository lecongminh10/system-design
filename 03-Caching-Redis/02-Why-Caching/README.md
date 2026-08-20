# 02 — Why Caching: Tại Sao Cần Caching & Khi Nào Nên Dùng?

## 1. Lý Do Cần Caching Trong Kiến Trúc Hệ Thống

Khi số lượng người dùng tăng từ hàng nghìn lên hàng triệu, Relational Database (MySQL, PostgreSQL) nhanh chóng trở thành **bottleneck** (điểm nghẽn) lớn nhất của toàn bộ hệ thống.

```text
[ Không có Cache ]
Client (100k QPS) ---> App Server ---> Database (Overloaded CPU 100%, Disk IOPS Exhausted) ---> Crash!

[ Có Cache ]
Client (100k QPS) ---> App Server ---> Redis Cache (95k QPS ~ 95% Hit) -> Response < 1ms
                                 ---> Database (5k QPS ~ 5% Miss)      -> Safe & Healthy!
```

### 1.1 Tăng vọt Throughput (QPS - Queries Per Second)
Một instance MySQL thông thường chỉ chịu được khoảng **2,000 - 5,000 Read QPS** trước khi latency bị đẩy lên cao. Trong khi đó, một instance Redis đơn lẻ có thể dễ dàng phục vụ **100,000+ QPS** trên một CPU core duy nhất.

### 1.2 Giảm tối đa Latency (Thời gian phản hồi)
- Trả kết quả trực tiếp từ Redis RAM: **< 1ms**.
- Thực hiện SQL Query có JOIN, GROUP BY hoặc Index Scan từ DB: **20ms - 200ms**.
- Người dùng trải nghiệm ứng dụng mượt mà, phản hồi tức thì.

### 1.3 Giảm tải và bảo vệ Database
Database là thành phần **khó scale ngang nhất** trong hệ thống (Stateful). Caching đóng vai trò như một tấm lá chắn (shield), giảm tới 90-95% số lượng câu lệnh read rơi vào DB.

### 1.4 Tiết kiệm chi phí Infrastructure (Cost Optimization)
- Scale-up DB (Ví dụ: AWS RDS `db.r6g.16xlarge` 64 vCPU / 512GB RAM) có giá cực kỳ đắt đỏ ($4,000+/tháng).
- Thêm một cluster Redis (Ví dụ: AWS ElastiCache) rẻ hơn từ 3-5 lần mà mang lại hiệu năng gấp hàng chục lần.

---

## 2. Các Đánh Đổi & Thách Thức Khi Dùng Cache (Trade-offs)

Mặc dù có vô số ưu điểm, Caching cũng mang lại những thách thức kiến trúc nghiêm trọng:

| Thách thức | Chi tiết |
| :--- | :--- |
| **Dữ liệu không đồng bộ (Data Inconsistency)** | Dữ liệu trên Cache có thể bị cũ (stale) so với Database khi có thao tác update/delete ở DB nhưng chưa kịp cập nhật Cache. |
| **Tăng độ phức tạp của Code (Complexity)** | Lập trình viên phải tự quản lý logic kiểm tra cache, nạp cache, invalidate cache và handle lỗi khi Redis down. |
| **Rủi ro phụ thuộc hạ tầng (Operational Overhead)** | Cần phải quản lý, monitoring và backup thêm một cụm dịch vụ Redis/Memcached. |
| **Chi phí bộ nhớ RAM (RAM Cost)** | Bộ nhớ RAM có giới hạn dung lượng bé hơn rất nhiều so với Disk SSD. |

---

## 3. Khi Nào NÊN và KHÔNG NÊN Dùng Cache?

### 3.1 NÊN dùng Cache khi:
1. **Dữ liệu được đọc nhiều hơn viết (High Read-to-Write Ratio)**: Ví dụ: Danh mục sản phẩm, cấu hình trang web, thông tin người dùng, bảng xếp hạng.
2. **Dữ liệu ít thay đổi hoặc chấp nhận dữ liệu cũ trong khoảng thời gian ngắn (Stale-tolerant)**: Ví dụ: Số lượt xem bài viết, bài đăng trên mạng xã hội.
3. **Các tính toán phức tạp / tốn tài nguyên**: Kết quả các truy vấn SQL phức tạp, báo cáo thô, aggregated statistics.

### 3.2 KHÔNG NÊN dùng Cache khi:
1. **Dữ liệu thay đổi liên tục (High Write Frequency)**: Viết vào DB xong lại invalidate Cache liên tục sẽ khiến Cache Hit Ratio rất thấp và tốn công nạp/xoá.
2. **Dữ liệu yêu cầu tính chính xác tuyệt đối (Strict Consistency)**: Ví dụ: Số dư tài khoản ngân hàng, giao dịch ví điện tử, kho hàng còn lại ở bước thanh toán cuối cùng.
3. **Dữ liệu chỉ được truy cập một lần (Low Temporal Locality)**: Ví dụ: Kết quả tìm kiếm theo từ khoá vô cùng dị biệt (long-tail queries) không bao giờ lặp lại.

---

## 4. Kết luận bài học

- Caching là công cụ đắc lực nhất để nâng số lượng QPS và hạ Latency của toàn hệ thống.
- Caching không phải là giải pháp vạn năng; nó đánh đổi **Complexity** và **Consistency** lấy **Speed** và **Throughput**.
- Phải phân tích kĩ bản chất dữ liệu (Read/Write ratio & Consistency level) trước khi quyết định đưa vào Cache.
