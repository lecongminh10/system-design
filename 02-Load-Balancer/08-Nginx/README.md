# 08 — Nginx

## 1. Nginx là gì?

Nginx là một web server và reverse proxy phổ biến. Nó cũng rất mạnh trong việc làm load balancer.

---

## 2. Cấu trúc cơ bản

```nginx
http {
    upstream app_backend {
        server 127.0.0.1:8081;
        server 127.0.0.1:8082;
        server 127.0.0.1:8083;
    }

    server {
        listen 80;
        location / {
            proxy_pass http://app_backend;
        }
    }
}
```

---

## 3. Các thuật toán Nginx hỗ trợ

- round robin (mặc định)
- least_conn
- ip_hash
- hash
- zone / keepalive nếu dùng cấu hình nâng cao

---

## 4. Health check trong Nginx

Nginx có thể dùng:

- `max_fails`
- `fail_timeout`
- `backup`
- `down`

Ví dụ:

```nginx
upstream app_backend {
    server 127.0.0.1:8081 max_fails=3 fail_timeout=10s;
    server 127.0.0.1:8082 max_fails=3 fail_timeout=10s;
}
```

---

## 5. Vị trí của Nginx trong hệ thống

```text
Client -> Nginx -> App 1 / App 2 / App 3
```

Nginx có thể làm:

- reverse proxy
- static file server
- load balancer
- SSL termination

---

## 6. Kết luận

Nginx là công cụ đơn giản nhưng rất mạnh để triển khai load balancing ngay trên production hoặc môi trường lab.
