# 05 — Read/Write Splitting: Phân Tách Luồng Đọc & Ghi

## 1. Tổng Quan Về Read/Write Splitting

Khi triển khai mô hình Master-Replica, vấn đề quan trọng là: **Làm thế nào để ứng dụng biết câu SQL nào gửi vào Master DB, câu SQL nào gửi vào Read Replica?**

Kỹ thuật **Read/Write Splitting (Phân tách Đọc/Ghi)** tự động nhận diện bản chất câu lệnh SQL:
- Các lệnh sửa đổi dữ liệu (`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`, `FOR UPDATE`) -> Hướng về **Master DB**.
- Các lệnh truy vấn dữ liệu (`SELECT`) -> Hướng về cụm **Read Replicas**.

```text
                  +-----------------------------------+
                  |         Application Layer         |
                  +-----------------+-----------------+
                                    |
                                    v
                     +-----------------------------+
                     |    READ/WRITE SPLITTER      |
                     +--------------+--------------+
                                    |
                 INSERT/UPDATE/DELETE |              | SELECT
                                    v              v
                           +----------------+  +----------------+
                           |   Master DB    |  | Read Replicas  |
                           +----------------+  +----------------+
```

---

## 2. Phương Pháp 1: Application-Level Routing (Tầng Ứng Dụng)

### 2.1 Cơ chế
Ứng dụng trực tiếp quản lý ít nhất 2 DataSource: `MasterDataSource` và `ReplicaDataSource`. Tùy thuộc vào Context giao dịch (Transaction context), ứng dụng sẽ chọn DataSource phù hợp.

Trong **Spring Boot**, kỹ thuật này được thực hiện thông qua `AbstractRoutingDataSource` và annotation `@Transactional(readOnly = true)`.

### 2.2 Ví Dụ Code Spring Boot Implement:

```java
// 1. Enum định nghĩa kiểu DataSource
public enum DbType {
    MASTER, REPLICA
}

// 2. ThreadLocal giữ thông tin DbType của Request hiện tại
public class DbContextHolder {
    private static final ThreadLocal<DbType> CONTEXT = new ThreadLocal<>();

    public static void setDbType(DbType dbType) {
        CONTEXT.set(dbType);
    }

    public static DbType getDbType() {
        return CONTEXT.get() == null ? DbType.MASTER : CONTEXT.get();
    }

    public static void clear() {
        CONTEXT.remove();
    }
}

// 3. Custom Routing DataSource kế thừa AbstractRoutingDataSource
public class RoutingDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        return DbContextHolder.getDbType();
    }
}

// 4. Spring Configuration setup DataSources
@Configuration
public class DataSourceConfig {

    @Bean
    public DataSource routingDataSource(
            @Qualifier("masterDataSource") DataSource master,
            @Qualifier("replicaDataSource") DataSource replica) {
        
        Map<Object, Object> targetDataSources = new HashMap<>();
        targetDataSources.put(DbType.MASTER, master);
        targetDataSources.put(DbType.REPLICA, replica);

        RoutingDataSource routingDataSource = new RoutingDataSource();
        routingDataSource.setDefaultTargetDataSource(master);
        routingDataSource.setTargetDataSources(targetDataSources);
        return routingDataSource;
    }
}

// 5. Sử dụng trong Service Layer
@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    // Tự động định tuyến tới READ REPLICA
    @Transactional(readOnly = true)
    public User getUserById(Long id) {
        return userRepository.findById(id).orElseThrow();
    }

    // Tự động định tuyến tới MASTER DB
    @Transactional
    public User createUser(User user) {
        return userRepository.save(user);
    }
}
```

### 2.3 Đánh giá phương pháp App-Level:
- **Ưu điểm**: Tốc độ phản hồi nhanh nhất (Zero Network Proxy Hop Overhead), dễ dàng tùy biến logic trong code.
- **Nhược điểm**: Phụ thuộc vào framework; phải duy trì nhiều Connection Pool độc lập trong ứng dụng.

---

## 3. Phương Pháp 2: Proxy / Middleware-Level Routing (Tầng Proxy)

### 3.1 Cơ chế
Ứng dụng chỉ kết nối tới một Endpoint duy nhất của **Database Proxy (như ProxySQL, PgBouncer, MaxScale, AWS Aurora Endpoint)**. Proxy sẽ parse câu lệnh SQL wire protocol và tự động phân tách luồng:

```text
App Server  ──(All SQL Queries)──>  [ ProxySQL Middleware ]
                                           │
                        ┌──────────────────┴──────────────────┐
                        │ (INSERT/UPDATE)                     │ (SELECT)
                        v                                     v
                  [ Master DB ]                        [ Read Replicas ]
```

### 3.2 Ví dụ Cấu hình Rule ProxySQL (`mysql_query_rules`):

```sql
-- Rule 1: Định tuyến tất cả SELECT ... FOR UPDATE tới Master (hostgroup 10)
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup, apply) 
VALUES (1, 1, '^SELECT.*FOR UPDATE', 10, 1);

-- Rule 2: Định tuyến tất cả SELECT thông thường tới Read Replicas (hostgroup 20)
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup, apply) 
VALUES (2, 1, '^SELECT', 20, 1);

-- Rule 3: Mặc định tất cả câu lệnh còn lại (INSERT/UPDATE/DELETE) gửi tới Master (hostgroup 10)
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup, apply) 
VALUES (3, 1, '.*', 10, 1);
```

### 3.3 Đánh giá phương pháp Proxy-Level:
- **Ưu điểm**: Hoàn toàn trong suốt với code ứng dụng (Transparent). Hỗ trợ bất kỳ ngôn ngữ nào (Java, Python, Go, Node.js). Tự động Load Balancing và Failover.
- **Nhược điểm**: Tốn thêm khoảng **0.2 - 0.5ms Network Hop Latency**. Cần quản lý thêm cụm Proxy High Availability.

---

## 4. Bảng So Sánh Hai Phương Pháp

| Tiêu Chí | App-Level Routing (Spring/Hibernate) | Proxy-Level Routing (ProxySQL/PgBouncer) |
| :--- | :--- | :--- |
| **Network Hop Overhead** | **0 ms** (Kết nối trực tiếp) | **~0.3 - 0.8 ms** (Qua Proxy trung gian) |
| **Sửa code ứng dụng** | Có (Cần cấu hình DataSource / Annotation) | **Không** (Dùng chung DB Driver Connection String) |
| **Độ độc lập ngôn ngữ** | Thấp (Cần lib/framework hỗ trợ) | **Tuyệt đối** (Hỗ trợ mọi ngôn ngữ) |
| **Quản lý Connection Pool**| Tách biệt trên từng App Instance | Tập trung tại Proxy (Giảm tổng kết nối tới DB) |
| **Load Balancing Replicas**| Phải viết code Round-Robin/Random | Tích hợp sẵn (Weighted Round Robin, Least Conn) |

---

## 5. Xử Lý Bài Toán Replication Lag Trong Read/Write Splitting: Sticky Session Read

Khi người dùng vừa bấm "Lưu thông tin", hệ thống vừa thực hiện `UPDATE` vào Master. Ngay lập tức người dùng chuyển hướng sang trang xem lại thông tin. Nếu query `SELECT` đọc từ Read Replica chưa kịp sync, người dùng sẽ thấy thông tin cũ!

### Giải pháp: **Sticky Read After Write Window**
1. Khi có thao tác WRITE thành công từ User $X$, ứng dụng ghi vào Redis một key: `user_write_flag:X` với TTL = **3 - 5 giây** (tương đương max Replication Lag).
2. Khi User $X$ gửi bất kỳ truy vấn READ nào trong vòng 3-5s đó:
   - App kiểm tra thấy key `user_write_flag:X` còn tồn tại -> **Ép buộc đọc từ MASTER DB**.
   - Sau 5 giây key hết hạn -> Chuyển về đọc từ **Read Replicas** bình thường.
