# 04 — Load Balancing Algorithms

## 1. Mục tiêu

Thuật toán load balancing quyết định request sẽ đi tới backend nào. Mỗi thuật toán có ưu nhược điểm khác nhau.

---

## 2. Round Robin

Gửi request lần lượt theo vòng tròn:

```text
A -> B -> C -> A -> B -> C
```

### Ưu điểm
- đơn giản
- dễ triển khai

### Nhược điểm
- không xét load thực tế của backend

---

## 3. Weighted Round Robin

Mỗi backend có trọng số khác nhau.

Ví dụ:

- Server A = 3
- Server B = 1
- Server C = 2

Server A nhận nhiều request hơn.

---

## 4. Least Connections

Chọn backend có số connection thấp nhất.

Phù hợp khi:

- mỗi request tiêu tốn resource khác nhau
- một số server đang quá tải

---

## 5. IP Hash

Dựa trên IP client hoặc key, request sẽ luôn đi cùng một backend.

### Ưu điểm
- ổn định cho session hoặc caching

### Nhược điểm
- không đều nếu client phân bố không cân đối

---

## 6. Consistent Hashing

Phổ biến trong hệ thống phân tán; giữ tính ổn định khi thêm/xóa node.

### Ưu điểm
- giảm lệch dời khi scale
- phù hợp với cache, sharding, distributed system

---

## 7. Chọn thuật toán nào?

- Round Robin: đơn giản, công bằng cơ bản
- Weighted Round Robin: khi server khác sức mạnh
- Least Connections: khi backend có độ tải khác nhau
- IP Hash: khi cần stickiness đơn giản
- Consistent Hashing: khi hệ thống phân tán và cần hiệu năng cao

---

## 8. Kết luận

Không có thuật toán nào hoàn hảo cho mọi trường hợp. Chọn theo đặc điểm hệ thống, tài nguyên và yêu cầu latency.
