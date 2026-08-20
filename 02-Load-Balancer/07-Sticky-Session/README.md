# 07 — Sticky Session

## 1. Sticky session là gì?

Sticky session là kỹ thuật giữ cho request từ cùng một client được chuyển tới cùng một backend trong một khoảng thời gian.

```text
Client A -> Server 1
Client A -> Server 1
Client A -> Server 1
```

---

## 2. Khi nào dùng?

Khi application lưu session trong memory của server, ví dụ:

- server-side session
- JWT không cần sticky session
- nhưng nếu dùng session cookie + server memory thì sticky session giúp giữ nguyên session

---

## 3. Ưu điểm

- đơn giản cho server-side session
- ứng dụng không cần chia sẻ session giữa các server

---

## 4. Nhược điểm

- node down thì client có thể mất session
- không cân bằng tốt bằng round robin nếu một node bị "dính" client
- khó scaling nếu session lớn

---

## 5. Cách thực hiện

Thông thường dùng:

- cookie
- hash trên IP client
- route header

---

## 6. Tốt hơn là gì?

Nhiều hệ thống hiện đại thay vì sticky session, họ dùng:

- JWT hoặc token-based auth
- Redis session store
- distributed cache

Điều này giúp hệ thống scale dễ hơn.

---

## 7. Kết luận

Sticky session là một giải pháp phù hợp trong một số hệ thống nhưng không phải cách tối ưu nhất cho mọi kiến trúc modern.
