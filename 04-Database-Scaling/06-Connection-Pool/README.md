# 06 — Connection Pooling: Tối Ưu Quản Lý Kết Nối Database

## 1. Chi Phí Đắt Đỏ Của Việc Tạo Mới DB Connection

Mỗi khi ứng dụng thực hiện một truy vấn SQL mà **không dùng Connection Pool**, quy trình tạo mới và đóng kết nối diễn ra như sau:

```text
[App Client]  ───(1. TCP Handshake 3-way)───> [Database Server]
              ───(2. TLS/SSL Negotiation)───>
              ───(3. Auth & Credentials)────>
              ───(4. OS Process/Thread Alloc)> (Tiêu tốn 2MB - 10MB RAM)
              ───(5. Execute SQL Query)─────>
              ───(6. Close TCP Connection)──>
```

### Hậu quả của việc tạo kết nối ngắt quãng (Ephemeral Connections):
- **Thời gian trễ (Latency) cực lớn**: Mất từ **30ms đến 100ms** chỉ để thiết lập kết nối trước khi lệnh SQL được chạy (trong khi câu SQL chỉ chạy mất 2ms!).
- **Cạn kiệt tài nguyên RAM (Out of Memory)**: 1.000 kết nối đồng thời trên PostgreSQL tiêu tốn từ **2GB đến 5GB RAM** chỉ để duy trì bộ nhớ kết nối!
- **Overhead CPU do Context Switching**: CPU máy chủ DB dành phần lớn thời gian để liên tục khởi tạo/hủy bỏ OS process/thread thay vì xử lý dữ liệu.

---

## 2. Giải Pháp Connection Pool

**Connection Pool (Hồ chứa kết nối)** tạo sẵn một số lượng kết nối vật lý cố định (Physical DB Connections) duy trì ở trạng thái chờ (Idle) ngay khi ứng dụng khởi chạy.

```text
[Request 1] ──┐                                   ┌──> [Physical DB Conn 1] ──┐
[Request 2] ──┼──> [ HikariCP Connection Pool ] ──┼──> [Physical DB Conn 2] ──┼──> [Database]
[Request 3] ──┘      (Tái sử dụng kết nối)        └──> [Physical DB Conn 3] ──┘
```

### Luồng hoạt động:
1. Khi có request cần truy vấn DB, App yêu cầu mượn 1 Connection từ Pool (`getConnection()`).
2. Thực thi câu lệnh SQL.
3. Khi xong, App gọi `connection.close()` -> Connection **KHÔNG BỊ ĐÓNG VẬT LÝ**, mà được trả về trạng thái rảnh rỗi trong Pool để request tiếp theo tái sử dụng.

---

## 3. Công Thức Toán Học Tính Toán Max Pool Size Tối Ưu

Một hiểu lầm rất phổ biến của nhiều lập trình viên: *"Càng tăng Max Pool Size (vd: 100, 500 connections) thì hệ thống càng chạy nhanh hơn."*

-> **SAI HOÀN TOÀN!** Việc tăng pool size quá mức sẽ khiến DB bị cạn kiệt I/O đĩa và CPU bị trệch nhịp do Context Switching, làm cho tổng thời gian phản hồi (Response Time) bị chậm đi đáng kể.

### Công thức tính toán của PostgreSQL / HikariCP Team:

$$N_{\text{conn}} = (\text{CPU Cores} \times 2) + \text{Effective Spindle Count}$$

- $\text{CPU Cores}$: Số lượng nhân CPU vật lý của máy chủ Database.
- $\text{Effective Spindle Count}$: Số lượng ổ đĩa quay (Với ổ SSD NVMe hiện đại, chỉ số này thường bằng $1$).

#### Ví dụ thực tế:
Nếu máy chủ Database có **8 vCPU** và dùng ổ **SSD NVMe**:

$$N_{\text{conn}} = (8 \times 2) + 1 = 17 \text{ connections}$$

> **Bất ngờ chưa?** Một máy chủ DB 8 cores chỉ cần một Connection Pool khoảng **15 - 20 connections** để đạt throughput tối đa!
> Nếu bạn có 10 App Instances, mỗi Instance chỉ cần cài `max-pool-size = 2 - 3`!

---

## 4. Cấu Hình HikariCP Trong Spring Boot (Best Practices)

HikariCP là Connection Pool mặc định và nhanh nhất thế giới cho Java/Spring Boot.

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:mysql://db-primary:3306/mydb?useSSL=false&serverTimezone=UTC
    username: app_user
    password: secret_password
    driver-class-name: com.mysql.cj.jdbc.Driver
    hikari:
      # Số lượng connection tối đa trong pool
      maximum-pool-size: 10
      
      # Số connection nhàn rỗi tối thiểu duy trì trong pool
      minimum-idle: 10
      
      # Thời gian chờ mượn connection tối đa trước khi throw SQLException (ms)
      connection-timeout: 30000 # 30 giây
      
      # Thời gian tối đa connection được rảnh rỗi trước khi bị đóng (ms)
      idle-timeout: 600000 # 10 phút
      
      # Vòng đời tối đa của 1 connection trong pool trước khi bị tạo mới (ms)
      # Phải nhỏ hơn wait_timeout của DB 30 giây!
      max-lifetime: 1800000 # 30 phút
      
      # Tên hiển thị pool trong Prometheus JMX metrics
      pool-name: HikariPool-MyService
```

---

## 5. Tầng Proxy Connection Pooling Tập Trung: PgBouncer

Với kiến trúc Microservices gồm hàng trăm App Instances, nếu mỗi instance mở 10 connections thì tổng số connection tới PostgreSQL có thể lên tới **1.000+ connections**.

**PgBouncer** là công cụ Proxy Connection Pooler đứng trước PostgreSQL giúp nén hàng nghìn kết nối từ App xuống chỉ còn vài chục kết nối thực tế tới PostgreSQL:

```text
[App Inst 1 (100 conns)] ──┐
[App Inst 2 (100 conns)] ──┼──> [ PgBouncer Proxy ] ──(20 Connections)──> [ PostgreSQL DB ]
[App Inst N (100 conns)] ──┘     (Transaction Pooling)
```

### Các Chế Độ (Pooling Modes) của PgBouncer:
1. **Session Pooling**: Giữ connection trong suốt thời gian Client đăng nhập (Tương tự HikariCP).
2. **Transaction Pooling (Khuyên dùng)**: PgBouncer cấp connection cho Client trong đúng thời gian thực thi 1 `TRANSACTION`. Xong Transaction, connection được trả về ngay lập tức cho Client khác. (Tiết kiệm connection tối đa!).
3. **Statement Pooling**: Trả connection ngay sau mỗi câu lệnh SQL (Không hỗ trợ Multi-statement Transaction).
