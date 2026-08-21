-- Lesson 04 & 05: Database Initialization Script
CREATE DATABASE IF NOT EXISTS shop_db;
USE shop_db;

-- 1. Create Products table with Index
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Seed Initial Sample Products
INSERT INTO products (name, price, stock) VALUES
('MacBook Pro M3', 1999.99, 15),
('iPhone 15 Pro Max', 1199.00, 30),
('Dell XPS 15', 1499.50, 20),
('Sony WH-1000XM5', 399.99, 50),
('Keychron K2 Mechanical Keyboard', 89.00, 100);

-- 3. Create Replication User (using mysql_native_password for replication compatibility)
CREATE USER IF NOT EXISTS 'repl_user'@'%' IDENTIFIED WITH mysql_native_password BY 'repl_password';
ALTER USER 'repl_user'@'%' IDENTIFIED WITH mysql_native_password BY 'repl_password';
GRANT REPLICATION SLAVE ON *.* TO 'repl_user'@'%';
FLUSH PRIVILEGES;

-- 4. Create Application Database User
CREATE USER IF NOT EXISTS 'app_user'@'%' IDENTIFIED WITH mysql_native_password BY 'app_password';
ALTER USER 'app_user'@'%' IDENTIFIED WITH mysql_native_password BY 'app_password';
GRANT ALL PRIVILEGES ON shop_db.* TO 'app_user'@'%';
FLUSH PRIVILEGES;
