#!/usr/bin/env bash

PRODUCT_ID=1

echo "======================================================="
echo "  [LESSON 03] TESTING REDIS CACHE-ASIDE PATTERN"
echo "======================================================="

echo "1. Requesting Product #$PRODUCT_ID (First Time - Should be Cache MISS)..."
curl -s http://localhost:8080/api/products/$PRODUCT_ID | grep -E '"(cacheHit|data|instance)"'
echo ""

echo "2. Requesting Product #$PRODUCT_ID (Second Time - Should be Cache HIT from Redis)..."
curl -s http://localhost:8080/api/products/$PRODUCT_ID | grep -E '"(cacheHit|data|instance)"'
echo ""

echo "3. Creating a New Product (POST to Master DB + Invalidate Cache)..."
NEW_PRODUCT=$(curl -s -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{"name": "Mechanical Keyboard RGB", "price": 129.99, "stock": 45}')
echo "$NEW_PRODUCT"
echo ""

NEW_ID=$(echo "$NEW_PRODUCT" | grep -o '"productId":[0-9]*' | cut -d':' -f2)

if [ -n "$NEW_ID" ]; then
  echo "4. Reading Newly Created Product #$NEW_ID..."
  curl -s http://localhost:8080/api/products/$NEW_ID
  echo ""
fi
