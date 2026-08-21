#!/usr/bin/env bash

echo "======================================================="
echo "  [LESSON 04 & 05] TESTING READ/WRITE SPLITTING"
echo "======================================================="

echo "1. Checking Cluster & Database Status..."
curl -s http://localhost:8080/api/cluster-status
echo ""
echo ""

echo "2. READ Query (SELECT) -> Routed to MySQL Replica (Secondary)..."
curl -s http://localhost:8080/api/products
echo ""
echo ""

echo "3. WRITE Query (INSERT) -> Routed to MySQL Master (Primary)..."
curl -s -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{"name": "Logitech MX Master 3S", "price": 99.99, "stock": 50}'
echo ""
