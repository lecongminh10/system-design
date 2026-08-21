#!/usr/bin/env bash

echo "======================================================="
echo "  [LESSON 01 & 02] TESTING NGINX LOAD BALANCER"
echo "======================================================="
echo "Sending 9 requests to http://localhost:8080 ..."
echo ""

for i in {1..9}
do
  RESPONSE=$(curl -s http://localhost:8080)
  INSTANCE=$(echo "$RESPONSE" | grep -o '"instance":"[^"]*"' | cut -d'"' -f4)
  echo "Request #$i -> Handled by Instance: [$INSTANCE]"
  sleep 0.2
done

echo ""
echo "Notice how requests rotate between app-1, app-2, and app-3!"
