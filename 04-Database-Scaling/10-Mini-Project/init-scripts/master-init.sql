-- Setup Database and User Table on Master
CREATE DATABASE IF NOT EXISTS scaling_db;
USE scaling_db;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Sample Data
INSERT INTO users (name, email) VALUES
('Nguyen Van A', 'nguyenvana@example.com'),
('Tran Thi B', 'tranthib@example.com'),
('Le Van C', 'levanc@example.com');

-- Create Replication User
CREATE USER IF NOT EXISTS 'repl_user'@'%' IDENTIFIED BY 'replpassword';
GRANT REPLICATION SLAVE ON *.* TO 'repl_user'@'%';
FLUSH PRIVILEGES;
