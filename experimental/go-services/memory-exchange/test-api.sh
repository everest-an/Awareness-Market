#!/bin/bash

# Test Memory Exchange API

BASE_URL="http://localhost:8080"
API_KEY="test_api_key_123"

echo "Testing Memory Exchange API..."
echo ""

# Test 1: Health check
echo "1. Testing health check..."
curl -s "$BASE_URL/health" | jq '.'
echo ""

# Test 2: Get stats
echo "2. Testing stats endpoint..."
curl -s "$BASE_URL/api/v1/stats" | jq '.'
echo ""

# Test 3: Browse memories (should fail without API key)
echo "3. Testing browse memories (no API key - should fail)..."
curl -s "$BASE_URL/api/v1/memories" | jq '.'
echo ""

# Test 4: Browse memories (with API key)
echo "4. Testing browse memories (with API key)..."
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/api/v1/memories?limit=10&offset=0" | jq '.'
echo ""

# Test 5: Browse reasoning chains
echo "5. Testing browse reasoning chains..."
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/api/v1/reasoning-chains?limit=10&offset=0" | jq '.'
echo ""

echo "API tests completed!"
