#!/bin/bash
# Concurrency Test Script for Orderz API
# Tests database handling of simultaneous requests

API_URL="https://orderz-one.vercel.app"
CONCURRENT_REQUESTS=20
TOTAL_BATCHES=3

echo "=========================================="
echo "ORDERZ API CONCURRENCY TEST"
echo "=========================================="
echo "Target: $API_URL"
echo "Concurrent requests per batch: $CONCURRENT_REQUESTS"
echo "Total batches: $TOTAL_BATCHES"
echo ""

# Test 1: Concurrent GET requests (read operations)
echo "TEST 1: Concurrent READ operations (GET /api/items)"
echo "------------------------------------------"
start_time=$(date +%s.%N)

for batch in $(seq 1 $TOTAL_BATCHES); do
    echo "Batch $batch..."
    for i in $(seq 1 $CONCURRENT_REQUESTS); do
        curl -s "$API_URL/api/items?limit=10" -o /dev/null &
    done
    wait
done

end_time=$(date +%s.%N)
duration=$(echo "$end_time - $start_time" | bc)
total_requests=$((CONCURRENT_REQUESTS * TOTAL_BATCHES))
rps=$(echo "scale=2; $total_requests / $duration" | bc)
echo "✅ Completed $total_requests GET requests in ${duration}s (${rps} req/s)"
echo ""

# Test 2: Concurrent POST requests (write operations - order creation)
echo "TEST 2: Concurrent WRITE operations (POST /api/orders)"
echo "------------------------------------------"

# Create test order JSON
ORDER_JSON='{
  "site_code": "BEITBRIDGE",
  "category": "PPE",
  "requested_by": "Concurrency Test",
  "items": [
    { "sku": "PPE-HARD-HAT", "quantity": 1, "employee_name": "Test User" }
  ]
}'

start_time=$(date +%s.%N)
success_count=0
fail_count=0

for batch in $(seq 1 2); do
    echo "Batch $batch..."
    for i in $(seq 1 10); do
        result=$(curl -s -X POST "$API_URL/api/orders" \
            -H "Content-Type: application/json" \
            -d "$ORDER_JSON")
        if echo "$result" | grep -q '"success":true'; then
            ((success_count++))
        else
            ((fail_count++))
        fi &
    done
    wait
done

end_time=$(date +%s.%N)
duration=$(echo "$end_time - $start_time" | bc)
echo "✅ Completed 20 POST requests in ${duration}s"
echo "   Success: $success_count, Failed: $fail_count"
echo ""

# Test 3: Mixed read/write operations
echo "TEST 3: Mixed READ/WRITE operations"
echo "------------------------------------------"
start_time=$(date +%s.%N)

for i in $(seq 1 10); do
    curl -s "$API_URL/api/items" -o /dev/null &
    curl -s "$API_URL/api/sites" -o /dev/null &
    curl -s "$API_URL/api/admin/orders" -o /dev/null &
    curl -s "$API_URL/api/admin/stock" -o /dev/null &
done
wait

end_time=$(date +%s.%N)
duration=$(echo "$end_time - $start_time" | bc)
echo "✅ Completed 40 mixed requests in ${duration}s"
echo ""

# Test 4: Verify data integrity
echo "TEST 4: Data Integrity Check"
echo "------------------------------------------"
orders_response=$(curl -s "$API_URL/api/admin/orders")
order_count=$(echo "$orders_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
echo "Total orders in database: $order_count"

# Check for any duplicate voucher numbers
echo "Checking for duplicate voucher numbers..."
duplicates=$(curl -s "$API_URL/api/admin/orders?limit=100" | python3 -c "
import sys, json
d = json.load(sys.stdin)
orders = d.get('data', [])
vouchers = [o.get('voucher_number') for o in orders]
dups = set([v for v in vouchers if vouchers.count(v) > 1])
if dups:
    print(f'DUPLICATES FOUND: {dups}')
else:
    print('No duplicates - data integrity OK')
" 2>/dev/null)
echo "$duplicates"
echo ""

# Test 5: Response time under load
echo "TEST 5: Response Time Under Load"
echo "------------------------------------------"
echo "Measuring average response time for 10 requests..."
total_time=0
for i in $(seq 1 10); do
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$API_URL/api/items")
    total_time=$(echo "$total_time + $response_time" | bc)
done
avg_time=$(echo "scale=3; $total_time / 10" | bc)
echo "Average response time: ${avg_time}s"
echo ""

echo "=========================================="
echo "CONCURRENCY TEST COMPLETE"
echo "=========================================="
