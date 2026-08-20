# 11 — Lab: Thực Hành Redis, Spring Boot & Benchmark wrk

## 1. Mục Tiêu Lab Thực Hành

Trong bài lab này, bạn sẽ thực hành:
1. Dựng hạ tầng **Redis + Redis Commander UI + PostgreSQL** bằng Docker Compose.
2. Viết ứng dụng Spring Boot tích hợp Cache-Aside Pattern.
3. Thực hiện **Benchmark đo lường hiệu năng** (Throughput QPS và Latency) khi có Cache và không có Cache bằng công cụ `wrk`.
4. Giả lập sự cố **Cache Breakdown (Thundering Herd)** và áp dụng Distributed Lock để xử lý.

---

## 2. Lab 1: Khởi Tạo Hạ Tầng Với Docker Compose

Tạo file `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: lab-postgres
    environment:
      POSTGRES_DB: demo_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secretpassword
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: lab-redis
    command: redis-server --requirepass redispassword --appendonly yes
    ports:
      - "6379:6379"

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: lab-redis-commander
    environment:
      - REDIS_HOSTS=local:lab-redis:6379:0:redispassword
    ports:
      - "8081:8081"

volumes:
  pgdata:
```

Lệnh khởi chạy:
```bash
docker-compose up -d
```
Mở trình duyệt truy cập Redis Commander GUI: `http://localhost:8081`

---

## 3. Lab 2: Viết Spring Boot API Đọc/Ghi Với Cache

### Entity & Repository:
```java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String email;
    // Getters & Setters
}
```

### Controller với Benchmark Endpoint:
```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    // Endpoint KHÔNG dùng Cache (Truy vấn DB trực tiếp)
    @GetMapping("/no-cache/{id}")
    public User getUserNoCache(@PathVariable Long id) {
        return userService.getUserDirectFromDB(id);
    }

    // Endpoint CÓ dùng Cache (Redis Cache-Aside)
    @GetMapping("/with-cache/{id}")
    public User getUserWithCache(@PathVariable Long id) {
        return userService.getUserWithRedisCache(id);
    }
}
```

---

## 4. Lab 3: Benchmark So Sánh Hiệu Năng Bằng `wrk`

Cài đặt công cụ benchmark `wrk` (trên macOS: `brew install wrk`, Linux: `apt install wrk`).

### Test 1: Truy vấn trực tiếp Database (KHÔNG Cache)
Chạy 12 threads, 400 kết nối đồng thời trong 30 giây:

```bash
wrk -t12 -c400 -d30s http://localhost:8080/api/users/no-cache/1
```

**Kết quả mẫu (No Cache):**
```text
Running 30s test @ http://localhost:8080/api/users/no-cache/1
  12 threads and 400 connections
  Requests/sec:   2,150.45
  Latency Avg:   185.32ms
  Latency Max:   890.12ms
```

### Test 2: Truy vấn qua Redis Cache
Chạy cùng tham số:

```bash
wrk -t12 -c400 -d30s http://localhost:8080/api/users/with-cache/1
```

**Kết quả mẫu (With Redis Cache):**
```text
Running 30s test @ http://localhost:8080/api/users/with-cache/1
  12 threads and 400 connections
  Requests/sec:  48,920.10  (Tăng 22 LẦN Throughput!)
  Latency Avg:     8.12ms   (Giảm 23 LẦN Latency!)
  Latency Max:    25.40ms
```

---

## 5. Lab 4: Xử Lý Cache Breakdown Bằng Redis `SETNX` (Mutex Lock)

Giả lập khi Key hết hạn, 400 request cùng xông vào DB. Ta cài đặt Distributed Lock để ép chỉ 1 Thread vào DB:

```java
public User getUserWithMutex(Long id) {
    String cacheKey = "user:" + id;
    String lockKey = "lock:user:" + id;

    // 1. Đọc từ Cache
    User user = (User) redisTemplate.opsForValue().get(cacheKey);
    if (user != null) {
        return user;
    }

    // 2. Cache Miss -> Thử lấy Mutex Lock bằng SETNX (TTL 5 giây)
    Boolean acquiredLock = redisTemplate.opsForValue().setIfAbsent(lockKey, "LOCKED", 5, TimeUnit.SECONDS);

    if (Boolean.TRUE.equals(acquiredLock)) {
        try {
            System.out.println("===> [LOCK ACQUIRED] Thread " + Thread.currentThread().getName() + " được phép query DB!");
            user = userRepository.findById(id).orElse(null);
            if (user != null) {
                redisTemplate.opsForValue().set(cacheKey, user, 10, TimeUnit.MINUTES);
            }
        } finally {
            // Giải phóng lock
            redisTemplate.delete(lockKey);
        }
    } else {
        // Không lấy được lock -> Chờ 50ms rồi thử lại từ Cache
        try {
            Thread.sleep(50);
        } catch (InterruptedException ignored) {}
        return getUserWithMutex(id);
    }

    return user;
}
```

---

## 6. Kết luận lab

- Kết quả test thực tế bằng `wrk` chứng minh Redis giúp tăng Throughput hàng chục lần và giảm Latency xuống mức millisecond.
- Kỹ thuật **Redis `SETNX` Distributed Lock** bảo vệ Database hoàn toàn khỏi sự cố Thundering Herd khi Hot Key hết hạn.
