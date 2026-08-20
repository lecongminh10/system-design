# Bài 1 — Reverse Proxy / Nginx

## 1. Mục tiêu

Sau bài này cần hiểu và thực hành được:

- Client / Server
- IP, Port, TCP, HTTP, HTTPS, DNS
- Forward Proxy và Reverse Proxy
- Nginx và cấu trúc cấu hình
- Routing bằng `server` / `location`
- `proxy_pass`
- Nginx + Spring Boot
- Nginx + Docker
- HTTPS / SSL Termination
- Forwarded Headers
- Nginx + nhiều instance Monolith
- Logging, timeout, upload size và một số cấu hình production
- Nền tảng để học Load Balancer ở Bài 2

---

# 2. Networking Basics

## 2.1 Client và Server

Client là bên gửi request.

Ví dụ:

```text
Browser
   |
   | HTTP Request
   v
Spring Boot Server
```

Server nhận request, xử lý và trả response.

---

## 2.2 IP

IP dùng để xác định một thiết bị/server trên mạng.

Ví dụ:

```text
123.45.67.89
```

Khi domain trỏ tới VPS:

```text
example.com
     |
     v
123.45.67.89
```

---

## 2.3 Port

Một server có thể chạy nhiều ứng dụng trên các port khác nhau.

Ví dụ:

```text
Nginx       :80
HTTPS       :443
Spring Boot :8080
MySQL       :3306
Redis       :6379
```

Ví dụ:

```text
http://example.com:80
http://example.com:8080
```

Trong production, người dùng thường truy cập `80` hoặc `443`, còn backend có thể chạy ở port nội bộ như `8080`.

---

## 2.4 HTTP Request / Response

Ví dụ:

```text
GET /api/products HTTP/1.1
Host: example.com
```

Server có thể trả:

```text
HTTP/1.1 200 OK
Content-Type: application/json
```

Các HTTP method phổ biến:

- GET
- POST
- PUT
- PATCH
- DELETE

Một số HTTP status:

- 200 — OK
- 201 — Created
- 400 — Bad Request
- 401 — Unauthorized
- 403 — Forbidden
- 404 — Not Found
- 500 — Internal Server Error
- 502 — Bad Gateway
- 503 — Service Unavailable

---

## 2.5 DNS

DNS chuyển domain thành địa chỉ IP.

Ví dụ:

```text
example.com
      |
      | DNS
      v
123.45.67.89
```

DNS không trực tiếp quyết định request đi vào Spring Boot instance nào.

Trong kiến trúc dùng Nginx:

```text
example.com
      |
      v
Public IP
      |
      v
Nginx
      |
      v
Spring Boot
```

---

# 3. Proxy là gì?

Proxy là thành phần đứng giữa client và server.

## 3.1 Forward Proxy

```text
Client
   |
   v
Forward Proxy
   |
   v
Internet
```

Proxy đại diện cho **Client**.

## 3.2 Reverse Proxy

```text
Internet
   |
   v
Reverse Proxy
   |
   v
Backend Server
```

Reverse Proxy đại diện cho **Server / hệ thống backend**.

---

# 4. Reverse Proxy

## 4.1 Kiến trúc cơ bản

Không có Reverse Proxy:

```text
Browser
   |
   v
Spring Boot :8080
```

Có Reverse Proxy:

```text
Browser
   |
   | HTTPS :443
   v
Nginx
   |
   | HTTP :8080
   v
Spring Boot
```

Client chỉ cần biết domain.

Ví dụ:

```text
https://example.com
```

Client không cần biết:

```text
Spring Boot đang chạy port 8080
```

---

# 5. Vì sao dùng Reverse Proxy?

Nginx có thể đảm nhiệm nhiều vai trò:

- Reverse Proxy
- SSL/TLS termination
- Routing
- Load Balancing
- Static File Server
- Request filtering
- Basic security
- Logging
- Compression
- Caching trong một số trường hợp

Ví dụ:

```text
example.com/
      |
      v
   Frontend

example.com/api/
      |
      v
 Spring Boot

example.com/admin/
      |
      v
 Admin Application
```

---

# 6. Nginx

## 6.1 Nginx là gì?

Nginx là web server / reverse proxy có hiệu năng cao, thường được đặt ở phía trước backend.

Kiến trúc:

```text
Internet
   |
   v
 Nginx
   |
   v
Backend
```

---

## 6.2 Cấu hình Nginx cơ bản

Ví dụ:

```nginx
server {
    listen 80;

    server_name example.com;

    location / {
        proxy_pass http://backend:8080;
    }
}
```

Ý nghĩa:

- `server` — định nghĩa một virtual server
- `listen` — port Nginx lắng nghe
- `server_name` — domain
- `location` — xác định URL pattern
- `proxy_pass` — chuyển request tới backend

---

# 7. Routing bằng Nginx

Ví dụ:

```nginx
server {
    listen 80;

    server_name example.com;

    location / {
        proxy_pass http://frontend:3000;
    }

    location /api/ {
        proxy_pass http://backend:8080;
    }

    location /admin/ {
        proxy_pass http://admin:8081;
    }
}
```

Kiến trúc:

```text
                   Nginx
                     |
        +------------+------------+
        |            |            |
        v            v            v
    Frontend      Backend       Admin
     :3000         :8080        :8081
```

Request:

```text
GET /api/products
```

sẽ được route tới backend.

---

# 8. Nginx + Spring Boot

Ví dụ Spring Boot chạy:

```text
8080
```

Nginx chạy:

```text
80
```

Flow:

```text
Browser
   |
   | GET /api/products
   v
Nginx :80
   |
   | proxy_pass
   v
Spring Boot :8080
   |
   v
Response
```

---

# 9. Docker Networking

Khi Nginx và Spring Boot chạy trong Docker:

```text
Docker Network
|
+-- nginx
|
+-- backend
```

Nginx có thể gọi:

```text
http://backend:8080
```

Không nên mặc định dùng:

```text
http://localhost:8080
```

Vì trong container:

```text
localhost
```

chỉ chính container hiện tại.

Do đó:

```text
nginx container
      |
      | backend:8080
      v
backend container
```

Docker DNS sẽ phân giải tên service `backend`.

---

# 10. Nginx + Docker Compose

Ví dụ:

```yaml
services:

  nginx:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - backend

  backend:
    image: shop-monolith:latest
```

Nginx:

```nginx
server {
    listen 80;

    location / {
        proxy_pass http://backend:8080;
    }
}
```

Chạy:

```bash
docker compose up -d
```

---

# 11. Nginx + Spring Boot Docker

Kiến trúc:

```text
                  Docker Network
                       |
             +---------+---------+
             |                   |
             v                   v
          Nginx              Spring Boot
           :80                  :8080
             |                   |
             +-------- HTTP -----+
```

---

# 12. HTTPS / SSL

Production thường dùng:

```text
Browser
   |
   | HTTPS :443
   v
Nginx
   |
   | HTTP :8080
   v
Spring Boot
```

Nginx nhận và xử lý TLS.

Đây gọi là:

> SSL/TLS Termination

Backend có thể chỉ cần nhận HTTP nội bộ.

---

## 12.1 HTTP redirect sang HTTPS

Mô hình:

```text
HTTP :80
   |
   v
Redirect
   |
   v
HTTPS :443
```

---

# 13. Forwarded Headers

Khi Nginx proxy request, backend có thể cần biết thông tin request gốc.

Cấu hình phổ biến:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Các thông tin này giúp backend biết:

- Host ban đầu
- IP client
- Chuỗi proxy
- Protocol ban đầu (`http` / `https`)

---

# 14. Nginx + Load Balancing

Nginx có thể đứng trước nhiều instance của cùng một application.

```text
                     Nginx
                       |
            +----------+----------+
            |          |          |
            v          v          v
          App #1     App #2     App #3
```

Ví dụ:

```nginx
upstream monolith_backend {
    server app1:8080;
    server app2:8080;
    server app3:8080;
}

server {
    listen 80;

    location / {
        proxy_pass http://monolith_backend;
    }
}
```

Điểm quan trọng:

`app1`, `app2`, `app3` đều là **cùng một Monolith Application**.

Không phải:

```text
app1 = User Service
app2 = Order Service
app3 = Payment Service
```

Mà là:

```text
app1 = toàn bộ Monolith
app2 = toàn bộ Monolith
app3 = toàn bộ Monolith
```

Kiến trúc:

```text
                    Nginx
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
       Monolith    Monolith    Monolith
         #1          #2          #3
          |           |           |
          +-----------+-----------+
                      |
                      v
                    MySQL
```

Đây là:

> Horizontal Scaling của Monolith.

Load Balancing chuyên sâu sẽ học ở **Bài 2**.

---

# 15. Những vấn đề khi chạy nhiều instance

Khi chạy:

```text
App #1
App #2
App #3
```

cần chú ý:

## 15.1 Session

Không nên phụ thuộc vào session nằm trong RAM của một instance.

Ví dụ:

```text
User
 |
 v
App #1
 |
 Session trong RAM
```

Request sau có thể đi:

```text
User
 |
 v
App #2
```

App #2 không có session của App #1.

Giải pháp phổ biến:

```text
App #1 ---+
App #2 ---+---> Redis
App #3 ---+
```

Hoặc thiết kế application theo hướng stateless và dùng token như JWT khi phù hợp.

---

## 15.2 File Upload

Không nên phụ thuộc vào filesystem riêng của một instance:

```text
App #1
└── uploads/
```

Request sau đi App #2 sẽ không nhất thiết thấy file.

Giải pháp:

- Object Storage
- Shared Storage
- CDN

---

## 15.3 Scheduled Jobs

Nếu có:

```java
@Scheduled(...)
public void process() {
}
```

và chạy 3 instance, job có thể được thực hiện ở cả 3 instance.

Cần cơ chế:

- Distributed Lock
- Job coordination
- Hoặc tách worker/job phù hợp

---

# 16. Production Configuration

## 16.1 Logging

Nginx có:

```text
access.log
error.log
```

Access log giúp biết request nào đã đi qua Nginx.

Error log giúp điều tra lỗi proxy, upstream và cấu hình.

---

## 16.2 Timeout

Một số cấu hình:

```nginx
proxy_connect_timeout 5s;
proxy_read_timeout 60s;
proxy_send_timeout 60s;
```

Không nên đặt timeout tùy tiện; cần dựa trên loại request và SLA của hệ thống.

---

## 16.3 Upload Size

Ví dụ:

```nginx
client_max_body_size 20M;
```

Giới hạn kích thước request body.

---

## 16.4 Compression

Nginx có thể hỗ trợ gzip để giảm kích thước response trong một số trường hợp.

---

# 17. Lab thực hành

## Lab 1 — Reverse Proxy

```text
Browser
   |
   v
Nginx
   |
   v
Spring Boot
```

Mục tiêu:

- Nginx nhận request
- Nginx proxy tới Spring Boot
- Spring Boot trả response

---

## Lab 2 — Frontend + Backend

```text
Browser
   |
   v
Nginx
   |
   +----> React
   |
   +----> Spring Boot
```

Routing:

```text
/       -> React
/api    -> Spring Boot
```

---

## Lab 3 — HTTPS

```text
Browser
   |
 HTTPS
   v
Nginx
   |
 HTTP
   v
Spring Boot
```

Mục tiêu:

- Domain
- DNS
- SSL/TLS
- HTTPS
- HTTP redirect
- SSL Termination

---

## Lab 4 — Monolith Load Balancing

```text
                    Nginx
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
        App #1      App #2      App #3
```

Cả 3 instance dùng cùng một Docker image.

Test endpoint:

```text
GET /instance
```

Mỗi instance trả về tên riêng:

```text
APP-1
APP-2
APP-3
```

Mục tiêu là quan sát request được phân phối giữa các instance.

---

# 18. Bài tập

### Bài tập 1

Giải thích:

> Reverse Proxy là gì?

### Bài tập 2

Giải thích:

```text
example.com
     |
     v
Public IP
     |
     v
Nginx
     |
     v
Spring Boot
```

request đi qua những bước nào?

### Bài tập 3

Tại sao trong Docker:

```text
http://backend:8080
```

có thể đúng, còn:

```text
http://localhost:8080
```

có thể sai?

### Bài tập 4

Tạo Nginx routing:

```text
/api      -> Spring Boot
/admin    -> Admin
/         -> Frontend
```

### Bài tập 5

Chạy 3 instance của cùng một Monolith và đặt Nginx phía trước.

---

# 19. Interview Questions

1. Reverse Proxy là gì?
2. Forward Proxy khác Reverse Proxy thế nào?
3. Tại sao dùng Nginx trước Spring Boot?
4. `proxy_pass` làm gì?
5. `location` trong Nginx dùng làm gì?
6. `upstream` dùng làm gì?
7. SSL Termination là gì?
8. `X-Forwarded-For` dùng làm gì?
9. Tại sao Docker container không nên mặc định gọi backend bằng `localhost`?
10. Nginx có thể làm Load Balancer không?
11. Monolith có thể dùng Load Balancer không?
12. Tại sao chạy nhiều instance lại gây vấn đề với session?
13. Tại sao file upload có thể gây vấn đề khi scale nhiều instance?
14. Tại sao `@Scheduled` có thể chạy nhiều lần khi có nhiều instance?

---

# 20. Kiến trúc cần nhớ

## Monolith đơn

```text
Internet
   |
   v
Spring Boot
   |
   v
MySQL
```

## Monolith + Reverse Proxy

```text
Internet
   |
   v
Nginx
   |
   v
Spring Boot
   |
   v
MySQL
```

## Monolith + Load Balancer

```text
                    Internet
                       |
                       v
                     Nginx
                       |
          +------------+------------+
          |            |            |
          v            v            v
       App #1       App #2       App #3
          |            |            |
          +------------+------------+
                       |
                       v
                     MySQL
```

## Monolith + Load Balancer + Redis

```text
                    Internet
                       |
                       v
                     Nginx
                       |
          +------------+------------+
          |            |            |
          v            v            v
       App #1       App #2       App #3
          |            |            |
          +------------+------------+
                       |
             +---------+---------+
             |                   |
             v                   v
           Redis               MySQL
```

---

# 21. Architecture Evolution

Đây là chuỗi kiến thức của toàn bộ khóa học:

```text
MVC
 |
 v
Modular Monolith
 |
 v
Reverse Proxy / Nginx
 |
 v
Multiple Instances
 |
 v
Load Balancer
 |
 v
Redis / Shared State
 |
 v
Database Scaling
 |
 v
Kafka / Message Queue
 |
 v
API Gateway
 |
 v
Microservices
 |
 v
Distributed Systems
 |
 v
Fault Tolerance
 |
 v
High Availability
```

---

# 22. Checklist hoàn thành Bài 1

- [ ] Hiểu Client / Server
- [ ] Hiểu IP / Port
- [ ] Hiểu DNS
- [ ] Hiểu HTTP / HTTPS
- [ ] Hiểu Forward Proxy
- [ ] Hiểu Reverse Proxy
- [ ] Hiểu Nginx
- [ ] Hiểu `server`
- [ ] Hiểu `location`
- [ ] Hiểu `proxy_pass`
- [ ] Hiểu `upstream`
- [ ] Chạy được Nginx + Spring Boot
- [ ] Chạy được Nginx + Docker
- [ ] Hiểu HTTPS / SSL Termination
- [ ] Hiểu Forwarded Headers
- [ ] Chạy được nhiều instance Monolith
- [ ] Hiểu session khi scale nhiều instance
- [ ] Hiểu vấn đề file upload
- [ ] Hiểu vấn đề scheduled jobs
- [ ] Hoàn thành Lab 1
- [ ] Hoàn thành Lab 2
- [ ] Hoàn thành Lab 3
- [ ] Hoàn thành Lab 4
- [ ] Trả lời được Interview Questions

---

# 23. Tài liệu tham khảo

- Nginx Reverse Proxy Documentation:
  https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/

- Nginx Load Balancing Documentation:
  https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/

- Nginx Documentation:
  https://nginx.org/en/docs/

---

# Kết quả đầu ra của Bài 1

Sau khi hoàn thành Bài 1, cần có khả năng nhìn vào kiến trúc:

```text
Internet
   |
Domain
   |
DNS
   |
Public IP
   |
Nginx
   |
   +----> Frontend
   |
   +----> Spring Boot
```

và giải thích được toàn bộ luồng request.

Đồng thời hiểu được:

```text
Internet
   |
Nginx
   |
   +----> Monolith #1
   +----> Monolith #2
   +----> Monolith #3
```

Đây là nền tảng để bước sang:

# Bài 2 — Load Balancer

Bài 2 sẽ đi sâu vào:

- Load Balancing
- Horizontal Scaling
- Round Robin
- Weighted Round Robin
- Least Connections
- IP Hash
- Health Check
- Failover
- Session / Sticky Session
- Nginx Load Balancer
- Load Balancer với Spring Boot Monolith
- Docker Compose nhiều instance
- Thực hành khi một instance bị chết
