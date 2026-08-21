# System Design Integrated Project (Bài 1 ➔ Bài 5)

Project thực hành tổng hợp tích hợp toàn bộ kiến thức từ **Bài 01 đến Bài 05** trong lộ trình System Design Learning.

---

## 🏗️ 1. Tổng Quan Kiến Trúc (End-to-End System Architecture)

Hệ thống mô phỏng môi trường Production thực tế bao gồm **7 container services**:

```text
                                  Client Request
                                        │
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │  [Bài 01 & 02] Nginx Reverse Proxy &    │ (Port 8080)
                   │  Round-Robin Load Balancer              │
                   └────────────────────┬────────────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
      ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
      │ App Node 1  │            │ App Node 2  │            │ App Node 3  │ (Node.js Express)
      │  (app-1)    │            │  (app-2)    │            │  (app-3)    │
      └──────┬──────┘            └──────┬──────┘            └──────┬──────┘
             │                          │                          │
             └──────────────────────────┼──────────────────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             │                                                     │
             ▼                                                     ▼
  ┌────────────────────┐                               ┌──────────────────────┐
  │  [Bài 03] Redis    │ Cache-Aside                   │ [Bài 04 & 05] DB     │ Dynamic Read / Write
  │  Cache Cluster     │ Pattern                       │ Connection Pool      │ Routing
  └────────────────────┘                               └───────────┬──────────┘
                                                                   │
                                             ┌─────────────────────┴─────────────────────┐
                                             ▼                                           ▼
                                  ┌────────────────────┐   GTID Replication   ┌────────────────────┐
                                  │   MySQL Primary    │ ───────────────────► │   MySQL Replica    │
                                  │   (mysql-master)   │   Binlog Stream      │  (mysql-replica)   │
                                  │   (WRITE ONLY)     │                      │    (READ ONLY)     │
                                  └────────────────────┘                      └────────────────────┘
```

---

## 🧩 2. Cách Mỗi Bài Học Được Tích Hợp Vào Project

| Bài Học | Công Nghệ / Kỹ Thuật | Vị Trí Triển Khai Trong Project |
| :--- | :--- | :--- |
| **01. Reverse Proxy (Nginx)** | Gateway, Header Forwarding, SSL/Port Mapping | `nginx/conf.d/app.conf` tiếp nhận request từ bên ngoài ở port 8080 và route vào mạng nội bộ. |
| **02. Load Balancer** | Round-Robin Balancing, Health Check, Failover | Nginx tự động cân bằng tải đều qua 3 instance (`app-1`, `app-2`, `app-3`). Kiểm thử bằng `scripts/test-load-balancer.sh`. |
| **03. Caching (Redis)** | Cache-Aside Pattern, TTL, Cache Invalidation | `app/cache.js` kiểm tra Redis cache trước khi query DB. Khi tạo product mới (WRITE), cache tương ứng lập tức bị xóa (Invalidated). |
| **04. Database Scaling** | Connection Pooling, Database Indexing, Read/Write Splitting | `app/db.js` khởi tạo 2 connection pools (Master Pool & Replica Pool). Tối ưu index trên cột `name`. |
| **05. Database Replication** | Single-Leader (Primary-Replica), GTID Binlog Stream | `mysql-master` (Write) tự động stream log sang `mysql-replica` (Read-only) bằng cơ chế GTID replication. |

---

## 📁 3. Cấu Trúc Thư Mục Project

```text
project/
├── docker-compose.yml              # File điều phối 7 container services
├── README.md                       # Tài liệu hướng dẫn sử dụng
├── app/                            # Backend Application Cluster
│   ├── Dockerfile                  # Docker image build file
│   ├── package.json                # Dependencies (express, mysql2, ioredis)
│   ├── server.js                   # REST API logic & Middleware logging
│   ├── db.js                       # Connection Pools & Read/Write Router
│   └── cache.js                    # Redis Cache-Aside & Invalidation Logic
├── nginx/                          # Layer 1 & 2: Gateway & Load Balancer
│   ├── nginx.conf                  # Main Nginx configuration
│   └── conf.d/
│       └── app.conf                # Upstream cluster configuration (app-1, app-2, app-3)
├── mysql/                          # Layer 4 & 5: Replication Database
│   ├── master/
│   │   └── my.cnf                  # Enable Binlog ROW & GTID Mode on Master
│   ├── replica/
│   │   └── my.cnf                  # Enable read_only & GTID Mode on Replica
│   └── init/
│       └── 01-init-master.sql      # Database schema, table indexes, sample data & repl user
└── scripts/                        # Các script kiểm thử tự động
    ├── test-load-balancer.sh       # Test Round-Robin balancing
    ├── test-cache-hit.sh           # Test Redis Cache Miss / Hit / Invalidate
    └── test-read-write-split.sh    # Test Read/Write Splitting routing
```

---

## 🚀 4. Hướng Dẫn Khởi Chạy (Quick Start)

### 📌 Bước 1: Khởi động toàn bộ hệ thống bằng Docker Compose

Từ thư mục `project/`:

```bash
docker compose up --build -d
```

> ⏱️ *Lưu ý*: Lần khởi chạy đầu tiên có thể mất khoảng 20-30 giây để MySQL Master & Replica hoàn tất khởi tạo database và thiết lập đường truyền GTID Replication.

### 📌 Bước 2: Kiểm tra trạng thái các Containers

```bash
docker compose ps
```

Kỳ vọng tất cả 7 services đều ở trạng thái `running` (hoặc `healthy`):
- `nginx-lb` (Port 8080)
- `app-1`, `app-2`, `app-3`
- `redis-cache` (Port 6379)
- `mysql-master` (Port 3306)
- `mysql-replica` (Port 3307)

---

## 🧪 5. Các Kịch Bản Kiểm Thử Thật (Hands-On Testing)

### 🔹 Kịch bản 1: Kiểm thử Load Balancer (Bài 1 & 2)

Chạy script kiểm thử:

```bash
bash scripts/test-load-balancer.sh
```

Hoặc dùng `curl` thủ công:

```bash
for i in {1..6}; do curl -s http://localhost:8080; echo; done
```

**Kết quả kỳ vọng**: Nginx phân bổ luân phiên các request qua từng app instance:
```json
{"instance":"app-1","message":"Welcome to System Design Integrated Project..."}
{"instance":"app-2","message":"Welcome to System Design Integrated Project..."}
{"instance":"app-3","message":"Welcome to System Design Integrated Project..."}
```

---

### 🔹 Kịch bản 2: Kiểm thử Redis Cache-Aside Pattern (Bài 3)

Chạy script kiểm thử:

```bash
bash scripts/test-cache-hit.sh
```

Quá trình hoạt động:
1. **Lần 1 (Cache MISS)**: `curl http://localhost:8080/api/products/1` ➔ Truy vấn MySQL Replica ➔ Lưu kết quả vào Redis với TTL 30s (`cacheHit: false`).
2. **Lần 2 (Cache HIT)**: `curl http://localhost:8080/api/products/1` ➔ Trả kết quả tức thì từ Redis mà không tốn query DB (`cacheHit: true`).
3. **Write & Invalidate**: `POST http://localhost:8080/api/products` ➔ Tạo sản phẩm mới ở Master DB ➔ Tự động Invalidate/Xóa cache key cũ.

---

### 🔹 Kịch bản 3: Kiểm thử Read/Write Splitting & Database Replication (Bài 4 & 5)

Chạy script kiểm thử:

```bash
bash scripts/test-read-write-split.sh
```

Hoặc kiểm tra trạng thái phân tuyến thủ công:

1. **Xem trạng thái Master vs Replica Node**:
   ```bash
   curl -s http://localhost:8080/api/cluster-status
   ```

2. **Thực hiện câu lệnh READ (SELECT)**:
   ```bash
   curl -s http://localhost:8080/api/products
   ```
   ➔ Trả về `querySource: "replica"` (Query chạy trực tiếp trên Replica DB).

3. **Thực hiện câu lệnh WRITE (INSERT)**:
   ```bash
   curl -s -X POST http://localhost:8080/api/products \
     -H "Content-Type: application/json" \
     -d '{"name": "iPad Pro M4", "price": 999.00, "stock": 25}'
   ```
   ➔ Trả về `dbTarget: "master"` (Query ghi thẳng vào Master DB). Dữ liệu này ngay lập tức được stream sang Replica node qua GTID Binlog.

---

## 🧹 6. Dọn Dẹp Sau Khi Học

Để dừng và xóa sạch tài nguyên containers & volumes:

```bash
docker compose down -v
```

---

## ✅ Checklist Tự Đánh Giá Kiến Thức Tích Hợp

- [ ] Tôi biết cách cấu hình Nginx Upstream để Load Balance nhiều App Instances.
- [ ] Tôi giải thích được luồng dữ liệu của Cache-Aside Pattern với Redis.
- [ ] Tôi hiểu cách tách biệt Connection Pool cho Master (Write) và Replica (Read).
- [ ] Tôi chứng minh được MySQL Replication stream dữ liệu từ Primary sang Secondary qua GTID.
- [ ] Tôi biết cách Invalidate Cache khi có thao tác Mutation (INSERT/UPDATE/DELETE).
