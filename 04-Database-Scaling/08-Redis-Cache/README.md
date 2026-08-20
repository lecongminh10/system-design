# 08 — Offloading Database Với Redis Cache

## 1. Vai Trò Của Redis In-Memory Cache Trong Database Scaling

Khi truy vấn READ tăng cao vượt quá khả năng phục vụ của cơ sở dữ liệu quan hệ (kể cả khi đã có Read Replicas), giải pháp tiết kiệm chi phí và đạt hiệu năng cao nhất là đưa **Redis In-Memory Cache** đứng trước Database làm lớp đệm giảm tải.

```text
                                +-------------------+
                                |    App Server     |
                                +---------+---------+
                                          |
                      1. Check Cache      |
                     +--------------------+
                     |
                     v
           +-------------------+               +-------------------+
           |    Redis Cache    |  2. Cache Miss|   Primary / Read  |
           |   (RAM ~0.5ms)    | ------------> |    Replica DB     |
           +-------------------+               |  (Disk ~20-50ms)  |
                                               +-------------------+
```

### So sánh Latency & Throughput:
- **Relational DB (PostgreSQL/MySQL)**: 1.000 - 5.000 QPS/node. Latency ~ 10ms - 50ms.
- **Redis Cache (RAM)**: 100.000+ QPS/node. Latency < 1ms.

---

## 2. Chiến Lược Cache-Aside (Lazy Loading) Tối Ưu Đọc DB

**Cache-Aside** là chiến lược offload dữ liệu phổ biến nhất để giảm tải cho DB:

```text
App Client ──> Check Key in Redis
                 │
                 ├── [CACHE HIT]  ──> Trả dữ liệu RAM về lập tức (<1ms).
                 │
                 └── [CACHE MISS] ──> Read từ Database (Disk).
                                        │
                                        ├── Save data bản sao vào Redis + Set TTL (Time-To-Live).
                                        └── Trả dữ liệu về Client.
```

### Code Spring Boot Minh Họa Cache-Aside Offloading:

```java
@Service
public class ProductService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private ProductRepository productRepository;

    public ProductDTO getProductById(Long id) {
        String cacheKey = "product:" + id;

        // 1. Check Redis Cache
        ProductDTO cachedProduct = (ProductDTO) redisTemplate.opsForValue().get(cacheKey);
        if (cachedProduct != null) {
            return cachedProduct; // Cache Hit!
        }

        // 2. Cache Miss -> Read DB
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        ProductDTO dto = convertToDTO(product);

        // 3. Save to Redis Cache with TTL 1 hour (với Jitter)
        long ttlSeconds = 3600 + (long)(Math.random() * 300); // 1 hour + 0-5 mins
        redisTemplate.opsForValue().set(cacheKey, dto, ttlSeconds, TimeUnit.SECONDS);

        return dto;
    }
}
```

---

## 3. Ba Bài Toán Kinh Điển Bảo Vệ Database

Khi ứng dụng Redis Cache trước DB, bạn bắt buộc phải xử lý 3 sự cố sau để tránh làm sập Database:

### 3.1 Cache Avalanche (Thuyết Lở Cache)
- **Hiện tượng**: Hàng vạn key trong Cache được cài đặt cùng một TTL (ví dụ: hết hạn đúng 00:00). Khi đến giờ, tất cả key đồng loạt hết hạn khiến toàn bộ traffic tràn thẳng xuống Database làm sập DB lập tức.
- **Giải pháp**: **TTL Jitter (Cộng số ngẫu nhiên vào TTL)**:
  `TTL_Thuc_Te = TTL_Co_Dinh + Random(0, 300 seconds)`

---

### 3.2 Cache Breakdown / Thundering Herd (Sập Key Nóng)
- **Hiện tượng**: Một key cực hot (Ví dụ: Sản phẩm Flash Sale iPhone 16) bị hết hạn TTL đúng lúc có 50.000 request/giây đang truy cập. 50.000 request này đều thấy Cache Miss và cùng lúc dồn dập query vào Database để lấy lại dữ liệu.
- **Giải pháp**: **Mutex Lock (Distributed Lock với Redisson / Redis SETNX)**:
  Chỉ cho phép **1 request duy nhất** mượn Lock xuống DB lấy data và update Cache. 49.999 request còn lại phải chờ vài milisecond để đọc data vừa được update trong Cache.

```java
public ProductDTO getProductWithMutex(Long id) {
    String cacheKey = "product:" + id;
    String lockKey = "lock:product:" + id;

    ProductDTO dto = (ProductDTO) redisTemplate.opsForValue().get(cacheKey);
    if (dto != null) return dto;

    // Thử lấy Distributed Lock trong 2 giây
    Boolean acquired = redisTemplate.opsForValue().setIfAbsent(lockKey, "1", 2, TimeUnit.SECONDS);
    if (Boolean.TRUE.equals(acquired)) {
        try {
            // Chỉ 1 thread được phép xuống DB!
            Product product = productRepository.findById(id).orElse(null);
            dto = convertToDTO(product);
            redisTemplate.opsForValue().set(cacheKey, dto, 1, TimeUnit.HOURS);
        } finally {
            redisTemplate.delete(lockKey); // Release lock
        }
    } else {
        // Các thread khác ngủ 50ms rồi thử lại từ Cache
        Thread.sleep(50);
        return getProductWithMutex(id);
    }
    return dto;
}
```

---

### 3.3 Cache Penetration (Xuyên Thấu Cache)
- **Hiện tượng**: Hacker cố tình gửi hàng triệu request với các `ID` không hề tồn tại trong hệ thống (`id = -9999` hoặc random UUID rác). Vì ID không tồn tại nên Redis luôn `Cache Miss` và Database luôn trả về `NULL`. Kết quả là 100% request đập thẳng vào DB!
- **Giải pháp**:
  1. **Cache Null Object**: Nếu DB trả về null, vẫn lưu một giá trị dummy `NULL` vào Redis với TTL ngắn (30-60 giây).
  2. **Bloom Filter**: Sử dụng Bloom Filter nằm trước Redis để kiểm tra xem ID đó có thực sự tồn tại trong DB hay không với chi phí bộ nhớ cực kỳ nhỏ.

---

## 4. Nên Chọn Scale Read Replica Hay Dùng Redis Cache?

| Tiêu Chí | Read Replica Scaling | Redis In-Memory Cache |
| :--- | :--- | :--- |
| **Tốc độ Latency** | ~ 5ms - 20ms | **< 1ms (Siêu nhanh)** |
| **Khả năng chịu tải (QPS)**| ~ 5.000 - 10.000 QPS/Node | **100.000+ QPS/Node** |
| **Độ tươi của dữ liệu** | Luôn đọc được data thực từ DB (sau lag) | Phải xử lý Cache Invalidation khi DB update |
| **Dung lượng lưu trữ** | Chứa được toàn bộ bản sao DB (TB Data) | Giới hạn bởi dung lượng RAM (GB Data) |
| **Chi phí hạ tầng** | Đắt hơn (Cần nhiều Server DB mạnh) | Rẻ hơn rất nhiều so với Scale DB |

> **Khuyên dùng trong System Design**: Kết hợp cả hai! Dùng **Redis Cache** cho 90% các truy vấn HOT dữ liệu lặp lại, và dùng **Read Replicas** cho các truy vấn COLD dữ liệu linh hoạt, tìm kiếm phức tạp.
