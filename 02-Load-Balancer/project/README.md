# Load Balancer Project

Project này giúp bạn thực hành một hệ thống nhỏ:

```text
Client -> Nginx Load Balancer -> app-1 / app-2 / app-3
```

Bạn sẽ quan sát được:

- Round robin load balancing
- Health check và failover cơ bản
- Sticky session bằng `ip_hash`
- Backend instance identity

---

## 1. Yêu cầu

- Docker
- Docker Compose
- `curl`

---

## 2. Cấu trúc

```text
project/
  app/
    Dockerfile
    server.js
  nginx/
    nginx.conf
    nginx-sticky.conf
  docker-compose.yml
  README.md
```

---

## 3. Chạy project

Từ thư mục này:

```bash
docker compose up --build
```

Load balancer chạy ở:

```text
http://localhost:8080
```

---

## 4. Test round robin

Gửi request nhiều lần:

```bash
for i in {1..9}; do curl -s http://localhost:8080; echo; done
```

Kết quả kỳ vọng: request lần lượt đi qua `app-1`, `app-2`, `app-3`.

Ví dụ:

```json
{"instance":"app-1","message":"Hello from backend"}
{"instance":"app-2","message":"Hello from backend"}
{"instance":"app-3","message":"Hello from backend"}
```

---

## 5. Test health check

Dừng một backend:

```bash
docker compose stop app-2
```

Gửi request lại:

```bash
for i in {1..9}; do curl -s http://localhost:8080; echo; done
```

Kết quả kỳ vọng: Nginx bỏ qua `app-2`, request vẫn được xử lý bởi `app-1` và `app-3`.

Chạy lại backend:

```bash
docker compose start app-2
```

---

## 6. Test request chậm

Endpoint này delay theo query string:

```bash
curl "http://localhost:8080/slow?ms=1500"
```

Dùng để thấy một request có thể giữ connection lâu hơn request bình thường.

---

## 7. Test sticky session

File mặc định `nginx/nginx.conf` dùng round robin. Nếu muốn test sticky session, đổi volume trong `docker-compose.yml`:

```yaml
- ./nginx/nginx-sticky.conf:/etc/nginx/nginx.conf:ro
```

Sau đó reload:

```bash
docker compose up -d --force-recreate nginx
```

Gửi request nhiều lần:

```bash
for i in {1..9}; do curl -s http://localhost:8080/session; echo; done
```

Với `ip_hash`, cùng một client IP thường sẽ đi vào cùng một backend.

---

## 8. Các endpoint

| Endpoint | Ý nghĩa |
| --- | --- |
| `/` | Trả về backend đang xử lý request |
| `/health` | Health check |
| `/slow?ms=1000` | Giả lập request chậm |
| `/session` | Trả về backend và cookie session demo |

---

## 9. Dọn dẹp

```bash
docker compose down
```

---

## 10. Câu hỏi tự luyện

- Nếu một backend chết, vì sao request vẫn thành công?
- Round robin khác `ip_hash` ở điểm nào?
- Nếu backend lưu session trong memory, có rủi ro gì khi không bật sticky session?
- Nếu `app-1` mạnh hơn `app-2`, bạn sẽ cấu hình Nginx như thế nào?
