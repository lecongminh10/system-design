# 08 — Read/Write Splitting Architecture

## 🎯 Mục tiêu
- Thiết kế mô hình phân định đường đi truy vấn: Write -> Primary, Read -> Secondary.
- Phân biệt Application Routing vs Database Proxy Routing.

## 📖 Nội dung chính
1. **Application-Level Routing**:
   - Sử dụng Spring Boot `AbstractRoutingDataSource` kết hợp với `@Transactional(readOnly = true)`.
   - Pros: Kiểm soát logic linh hoạt, không tốn thêm hop hạ tầng.
   - Cons: Phải sửa code application, phụ thuộc framework.
2. **Proxy-Level Routing**:
   - Sử dụng Database Proxy đứng ở giữa (ProxySQL cho MySQL, PgBouncer / MaxScale cho PostgreSQL).
   - Application gửi query tới Proxy, Proxy tự phân tích SQL syntax (SELECT vs INSERT) để điều hướng.
   - Pros: NTransparent với Application code, hỗ trợ Connection Pooling & Load Balancing.

---
*Ghi chú học tập sẽ được cập nhật tiếp tại đây.*
