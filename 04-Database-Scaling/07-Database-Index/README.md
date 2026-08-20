# 07 — Database Indexing: Cấu Trúc B+Tree & Tối Ưu Truy Truy Vấn

## 1. Bản Chất Của Database Index

Nếu một bảng dữ liệu không có Index và chứa 10.000.000 dòng, khi bạn chạy câu lệnh `SELECT * FROM users WHERE email = 'user@example.com'`, Database phải thực hiện **Full Table Scan (Sequential Scan)** — đọc từng dòng trong tổng số 10 triệu dòng từ đĩa cứng.

**Database Index (Chỉ mục)** là một cấu trúc dữ liệu tách biệt (thường lưu trữ trên RAM và NVMe đĩa) giữ các bản sao của một số cột dữ liệu được sắp xếp theo thứ tự, giúp DB tìm kiếm dữ liệu với độ phức tạp **$O(\log N)$** thay vì $O(N)$.

---

## 2. Cấu Trúc Dữ Liệu B+Tree

Hầu hết các RDBMS hiện đại (MySQL InnoDB, PostgreSQL, Oracle) đều sử dụng **B+Tree** làm cấu trúc mặc định cho Index.

```text
                           [ Root Node: 50 ]
                          /                 \
            [ Internal: 20 ]               [ Internal: 70 ]
           /                \             /                \
   [Leaf: 5, 10, 15] <-> [Leaf: 20, 30] <-> [Leaf: 50, 60] <-> [Leaf: 70, 80, 90]
   (Data Pointer)        (Data Pointer)      (Data Pointer)      (Data Pointer)
```

### Đặc điểm tuyệt vời của B+Tree:
1. **Mọi Leaf Node đều ở cùng một độ sâu (Self-balancing)**: Đảm bảo thời gian truy tìm bất kỳ record nào cũng bằng nhau.
2. **Các Leaf Node được nối với nhau bằng danh sách liên kết kép (Doubly Linked List)**: Giúp các truy vấn tìm kiếm theo khoảng (**Range Queries**: `WHERE age BETWEEN 18 AND 30` hoặc `ORDER BY created_at LIMIT 10`) diễn ra cực nhanh mà không cần duyệt lại từ root tree!

---

## 3. Clustered Index vs Secondary Index (Non-Clustered Index)

### 3.1 Clustered Index (Primary Key Index)
- Dữ liệu thực tế của toàn bộ dòng (Row Data) được sắp xếp vật lý trực tiếp bên trong các Leaf Node của Clustered Index.
- Mỗi bảng chỉ có **ĐÚNG 1 Clustered Index** (thường là cột Primary Key ID).

### 3.2 Secondary Index (Non-Clustered Index)
- Dữ liệu Leaf Node của Secondary Index không chứa toàn bộ thông tin dòng, mà chỉ chứa: **Giá trị cột Indexed + Giá trị Primary Key**.
- Khi truy vấn qua Secondary Index:
  1. DB tìm trong Secondary Index để lấy được `Primary Key`.
  2. DB dùng `Primary Key` đó tìm tiếp trong Clustered Index để lấy dữ liệu dòng đầy đủ (**Bước này gọi là Bookmark Lookup / Key Lookup**).

```text
Query: SELECT * FROM users WHERE email = 'test@gmail.com'

[ Secondary Index (email) ]  ──(Tìm thấy email)──> [ Lấy được ID = 105 ]
                                                           │
                                                           v
[ Clustered Index (id) ]    ──(Lookup ID = 105)──> [ Return Full Row Data ]
```

---

## 4. Composite Index & Quy Tắc Leftmost Prefix Rule

Một **Composite Index** là Index được tạo trên nhiều cột cùng lúc: `CREATE INDEX idx_user_status_date ON users (status, created_at);`

### Quy tắc Leftmost Prefix Rule (Tiền tố trái cùng):
Database chỉ có thể sử dụng Composite Index nếu câu truy vấn chứa các cột từ **trái sang phải** theo đúng thứ tự khai báo trong Index!

Giả sử Index là `(A, B, C)`:

| Câu lệnh WHERE | Dùng được Index `(A, B, C)` không? | Lý do |
| :--- | :--- | :--- |
| `WHERE A = 1` | **CÓ** | Đủ tiền tố trái cùng `A` |
| `WHERE A = 1 AND B = 2` | **CÓ** | Đủ tiền tố trái cùng `A, B` |
| `WHERE A = 1 AND B = 2 AND C = 3` | **CÓ** | Đủ toàn bộ `A, B, C` |
| `WHERE B = 2 AND C = 3` | **KHÔNG** | Thiếu cột `A` (Vi phạm Leftmost Prefix Rule) |
| `WHERE C = 3` | **KHÔNG** | Thiếu cột `A, B` |
| `WHERE A = 1 AND C = 3` | **CÓ 1 PHẦN** | Chỉ sử dụng phần `A` để lọc, không dùng được `C` |

---

## 5. Covering Index — Tối Ưu Tốc Độ Gấp 5 Lần

Một **Covering Index** là một Secondary Index chứa **TẤT CẢ các cột** mà câu lệnh `SELECT` yêu cầu.

### Ví dụ:
Giả sử ta tạo Index: `CREATE INDEX idx_user_email_name ON users (email, name);`

Và chạy câu SQL: `SELECT name FROM users WHERE email = 'test@gmail.com';`

-> Database nhận thấy cả `email` và `name` đều đã có sẵn trong Secondary Index! DB sẽ trả về kết quả lập tức mà **KHÔNG CẦN** tốn bước Bookmark Lookup về Clustered Index nữa.

---

## 6. Trade-offs & Anti-Patterns Cần Tránh

### 6.1 Trade-offs của Index
1. **Làm chậm thao tác Ghi (`INSERT`, `UPDATE`, `DELETE`)**: Mỗi khi thêm/sửa/xóa dòng, DB phải cập nhật lại cấu trúc cây B+Tree trên tất cả các Index tương ứng của bảng đó.
2. **Tiêu tốn dung lượng bộ nhớ**: Một bảng 50GB data có thể tốn thêm 30GB - 50GB dung lượng RAM/Disk chỉ để lưu trữ các tệp Index.

### 6.2 Anti-Patterns phổ biến khiến Index bị vô hiệu hóa:
1. **Dùng hàm (Functions) lên cột Index**:
   - ❌ `WHERE YEAR(created_at) = 2026` -> DB bỏ qua Index!
   - ✅ `WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01'` -> Dùng Index mượt mà.
2. **Wildcard ở đầu chuỗi (`LIKE '%abc'`)**:
   - ❌ `WHERE name LIKE '%Nguyễn'` -> Phải scan toàn bộ B+Tree.
   - ✅ `WHERE name LIKE 'Nguyễn%'` -> Dùng B+Tree Index tìm kiếm nhanh.
3. **Index trên cột Low Cardinality (Độ đa dạng dữ liệu thấp)**:
   - Tạo Index trên cột `gender` (chỉ có giá trị 'MALE' / 'FEMALE') hoặc `is_active` (0 / 1) là lãng phí. DB Query Planner luôn ưu tiên Full Table Scan thay vì dùng Index có tỉ lệ phân biệt quá thấp.
