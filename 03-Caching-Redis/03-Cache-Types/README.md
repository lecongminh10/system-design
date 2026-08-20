# 03 — Cache Types: Phân Loại Cache & Thuật Toán Eviction

## 1. Phân Loại Cache Theo Vị Trí Kiến Trúc (Caching Layers)

Trong một hệ thống web hiện đại, Caching không chỉ nằm ở Redis mà xuất hiện ở **nhiều lớp khác nhau** từ Client tới Database:

```text
[ Browser / Client ] ---> [ CDN / Edge ] ---> [ Reverse Proxy / Nginx ] ---> [ App Local Cache ] ---> [ Distributed Cache (Redis) ] ---> [ Database Buffer Pool ]
```

| Lớp Cache | Vị trí | Ví dụ công nghệ | Mục đích lưu trữ |
| :--- | :--- | :--- | :--- |
| **Client-side Cache** | Trình duyệt, App Mobile | Browser Storage, HTTP Cache Header (`Cache-Control`) | HTML, CSS, JS, Images, API response tạm |
| **CDN (Content Delivery Network)** | Server vị trí địa lý gần người dùng | Cloudflare, AWS CloudFront, Akamai | Static Assets (Images, Videos, Media, Static HTML) |
| **Reverse Proxy Cache** | Phía trước App Server | Nginx FastCGI Cache, Varnish Cache | Full HTTP Page response, Micro-caching API |
| **Application Local Cache** | Ngay trong bộ nhớ heap của App | Caffeine (Java), Guava, Memory Cache (NodeJS) | Dữ liệu cấu hình, dictionary data tĩnh |
| **Distributed Cache** | Server Cache dùng chung độc lập | Redis, Memcached | Session, User Data, Hot Query Results dùng chung cho nhiều App node |
| **Database Buffer Pool** | Ngay trong bộ nhớ của DB Engine | InnoDB Buffer Pool (MySQL), Shared Buffers (Postgres) | Index, Data pages nóng từ Disk DB |

---

## 2. In-Memory (Local) Cache vs Distributed Cache

Hai hình thức Application Caching phổ biến nhất là **Local Cache** và **Distributed Cache**.

```text
[ Local Cache (Caffeine) ]
App Instance 1 [ App Logic | Local Cache ]  \---> Độc lập bộ nhớ
App Instance 2 [ App Logic | Local Cache ]  /---> Không chia sẻ được dữ liệu giữa 2 instance!

[ Distributed Cache (Redis) ]
App Instance 1 [ App Logic ] ---\
                                 +---> [ Centralized Redis Cluster ] (Dùng chung bộ nhớ)
App Instance 2 [ App Logic ] ---/
```

### So Sánh Chi Tiết:

| Tiêu chí | Local Cache (Ví dụ: Caffeine) | Distributed Cache (Ví dụ: Redis) |
| :--- | :--- | :--- |
| **Vị trí** | Trong heap của ứng dụng (In-Process) | Server riêng biệt qua Mạng (Out-of-Process) |
| **Speed / Latency** | Siêu nhanh (~nanosecond, không tốn Network IO) | Nhanh (~0.5ms - 1ms, tốn Network RTT) |
| **Dung lượng** | Bị giới hạn bởi JVM Heap Size | Rất lớn, dễ dàng scale bằng cách thêm node |
| **Data Consistency giữa các node** | **Rất khó đồng bộ**: Node A update cache nhưng Node B vẫn mang dữ liệu cũ | **Đồng bộ 100%**: Tất cả App nodes đọc chung 1 nguồn dữ liệu |
| **Độ bền khi Restart App** | **Mất sạch dữ liệu** khi restart server | **Không mất dữ liệu**: Cache nằm ở Redis server riêng biệt |

---

## 3. Các Thuật Toán Loại Bỏ Key Khi Hết Bộ Nhớ (Eviction Policies)

Do bộ nhớ RAM có giới hạn (`maxmemory`), khi RAM bị đầy, Cache bắt buộc phải xoá bớt các key cũ để nhường chỗ cho key mới. Việc chọn key nào để xoá do **Thuật toán Eviction** quyết định.

```text
Bộ nhớ RAM đầy!
[ Key A (dùng 1s trước) ] -> Giữ lại
[ Key B (dùng 10h trước) ] -> [ EVICTED / XOÁ ]
```

### 3.1 LRU (Least Recently Used) — Dùng ít nhất gần đây
- Xoá key nào có **thời gian truy cập lần cuối cùng (last accessed time)** xa nhất trong quá khứ.
- *Trường hợp sử dụng:* Rất phổ biến, phù hợp cho hầu hết ứng dụng web tổng quát.

### 3.2 LFU (Least Frequently Used) — Truy cập tần suất thấp nhất
- Đếm số lần (frequency counter) key được đọc. Key nào có **tổng số lần đọc ít nhất** sẽ bị xoá.
- *Ưu điểm:* Tránh được hạn chế của LRU khi một key cũ đột nhiên bị đọc 1 lần rồi bỏ lỡ key hot thực sự.

### 3.3 FIFO (First In, First Out) — Vào trước, Xoá trước
- Key nào được tạo ra đầu tiên sẽ bị xoá trước, không quan tâm tần suất hay thời gian truy cập.
- *Nhược điểm:* Có thể xoá nhầm key đang được dùng rất nhiều.

### 3.4 Random Eviction
- Chọn ngẫu nhiên một key bất kỳ để xoá.

### 3.5 TTL-based Eviction (Volatile-LRU / Volatile-TTL)
- Chỉ xem xét và xoá các key **đã được thiết lập thời gian hết hạn (TTL)**. Các key không cài TTL sẽ không bị xoá.

---

## 4. Tóm Tắt & Lựa Chọn Kiến Trúc

- Dùng **Local Cache (Caffeine)** cho dữ liệu tĩnh cực nhỏ, truy cập triệu lần/giây, không cần đồng bộ giữa các node.
- Dùng **Distributed Cache (Redis)** cho ứng dụng chạy multi-instance/microservices cần chia sẻ session và cache chung.
- Dùng thuật toán **LRU / LFU** trong Redis để tự động giải phóng RAM khi vượt mức cho phép.
