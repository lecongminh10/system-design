# 05 — Cache Strategies: Các Chiến Lược Caching Kinh Điển

## 1. Tổng Quan Về Chiến Lược Caching

Chiến lược Caching (Caching Pattern/Strategy) quy định cách thức dữ liệu được đọc (Read) và ghi (Write) qua lại giữa **Ứng dụng (App)**, **Cache (Redis)** và **Database**.

Không có chiến lược nào hoàn hảo cho mọi bài toán. Chọn đúng chiến lược giúp tối ưu hiệu năng, giảm latency và đảm bảo độ tin cậy của dữ liệu.

---

## 2. 5 Chiến Lược Caching Phổ Biến Nhất

### 2.1 Cache-Aside (Lazy Loading) — Phổ biến nhất

App trực tiếp quản lý logic trao đổi giữa Cache và Database.

```text
[ Read Flow ]
1. App check Cache
   ├── (Hit)  ---> Trả dữ liệu lập tức cho Client.
   └── (Miss) ---> Đọc DB ---> Ghi bản sao vào Cache ---> Trả dữ liệu cho Client.

[ Write Flow ]
1. App ghi trực tiếp dữ liệu mới vào DB.
2. App XOÁ (Invalidate) key tương ứng trên Cache.
```

- **Ưu điểm:** Chỉ cache dữ liệu thực sự được đọc (Lazy Loading), tiết kiệm dung lượng RAM. Nếu Redis chết, App vẫn chạy bình thường nhờ đọc thẳng DB.
- **Nhược điểm:** Lần đọc đầu tiên (Cache Miss) bị chậm. Nguy cơ race condition nếu không xử lý xoá cache chuẩn xác.

---

### 2.2 Read-Through Cache

App coi Cache như một nguồn dữ liệu duy nhất (Abstraction Layer). App không đọc trực tiếp DB mà giao toàn bộ cho Cache Provider.

```text
Client ---> App ---> [ Read-Through Cache ] --(Tự động nạp từ DB nếu Miss)--> [ Database ]
```

- **Cách hoạt động:** Khi Cache Miss, chính hệ thống Cache sẽ tự động gọi connector để đọc DB, lưu vào cache rồi trả về cho App.
- **Ưu điểm:** Giảm bớt logic phức tạp trong code ứng dụng.
- **Nhược điểm:** Phải viết thêm plugin/connector cho Cache Provider (Redis không hỗ trợ Read-Through native, thường thấy ở NGINX Cache hoặc Hazelcast).

---

### 2.3 Write-Through Cache

Mọi thao tác ghi dữ liệu từ App đều phải đi qua Cache trước, sau đó Cache thực hiện ghi đồng bộ (synchronous) vào DB trước khi trả kết quả thành công cho App.

```text
Client ---> App ---> Ghi dữ liệu ---> [ Cache ] --(Ghi đồng bộ SYNC)--> [ Database ]
                                         |
                                         +--> Trả về Success khi CẢ HAI ghi xong
```

- **Ưu điểm:** Dữ liệu giữa Cache và DB luôn **đồng bộ 100%**, không bao giờ lo thông tin bị cũ.
- **Nhược điểm:** Latency khi ghi dữ liệu bị đẩy lên cao (phải chờ ghi xong cả 2 nơi). Dữ liệu vừa ghi có thể chưa bao giờ được đọc lại, gây lãng phí RAM.

---

### 2.4 Write-Behind / Write-Back Cache

App chỉ ghi dữ liệu vào Cache và trả kết quả thành công ngay lập tức. Sau đó, Cache sẽ gom hàng loạt dữ liệu lại (batch) và ghi bất đồng bộ (asynchronous) xuống DB sau.

```text
Client ---> App ---> Ghi dữ liệu ---> [ Cache ] ---> Trả về Success tức thì (<1ms)
                                         |
                                         +--(Ghi bất đồng bộ ASYNC theo batch)--> [ Database ]
```

- **Ưu điểm:** Tốc độ ghi siêu nhanh (Write Latency cực thấp), giảm tải cực lớn cho DB Write IOPS.
- **Nhược điểm:** **Rủi ro mất dữ liệu cao** nếu Server Cache bị crash/cúp điện trước khi kịp flush dữ liệu xuống DB.

---

### 2.5 Write-Around Cache

Dữ liệu được ghi thẳng vào DB mà **bỏ qua hoàn toàn Cache**. Cache chỉ được nạp dữ liệu khi có request Read sau đó (kết hợp với Cache-Aside).

```text
Write: App ---> Ghi trực tiếp ---> [ Database ] (Bỏ qua Cache)
Read:  App ---> Đọc từ Cache ---> (Miss) ---> Đọc từ Database
```

- **Ưu điểm:** Tránh làm quá tải RAM bằng các dữ liệu ghi xong không ai đọc lại.
- **Nhược điểm:** Lần đọc đầu tiên ngay sau khi ghi sẽ luôn bị Cache Miss.

---

## 3. Ma Trận So Sánh Các Chiến Lược

| Chiến lược | Read Latency | Write Latency | Rủi ro mất dữ liệu | Mức độ phức tạp | Use Case Phù Hợp |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cache-Aside** | Thấp (khi Hit) | Trung bình | Không | Trung bình | Đa số ứng dụng Web, E-commerce, Social Media |
| **Read-Through** | Thấp | Không đổi | Không | Cao | Hệ thống dùng Caching Framework tập trung |
| **Write-Through** | Thấp | Cao | Không | Cao | Hệ thống yêu cầu dữ liệu nhất quán cao |
| **Write-Behind** | Siêu thấp | Siêu thấp | **Rất cao** | Rất cao | Ghi Log, Audit Trail, Đếm lượt View, Game State |
| **Write-Around** | Trung bình | Thấp | Không | Thấp | Dữ liệu ghi nhiều nhưng ít khi đọc lại ngay |

---

## 4. Kết luận bài học

- **Cache-Aside** là lựa chọn mặc định chuẩn hóa cho hầu hết các dự án Spring Boot / Microservices.
- Nếu hệ thống ghi rất nhiều và chấp nhận mất 1 vài log nhỏ, hãy chọn **Write-Behind**.
- Luôn nhớ: Khi ghi dữ liệu ở Cache-Aside, nên **XOÁ (DELETE/INVALIDATE)** key trên Cache chứ **KHÔNG NÊN UPDATE** key trực tiếp để tránh race condition!
