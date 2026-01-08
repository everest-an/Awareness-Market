#!/bin/bash

# Test script for Enhanced MCP Server with three memory types

echo "========================================"
echo "Testing Enhanced Awareness MCP Server"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test MCP tool
test_mcp_tool() {
    local tool_name=$1
    local args=$2
    
    echo -e "${YELLOW}Testing: ${tool_name}${NC}"
    
    # Create test input
    cat > /tmp/mcp_test_input.json << EOF
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "${tool_name}",
    "arguments": ${args}
  }
}
EOF
    
    # Call MCP server
    result=$(cat /tmp/mcp_test_input.json | node /home/ubuntu/Awareness-Market/mcp-server/index-enhanced.ts 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: ${tool_name}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: ${tool_name}"
        ((TESTS_FAILED++))
    fi
    
    echo ""
}

# Test 1: Search KV-Cache Memories
echo "Test 1: Search KV-Cache Memories"
test_mcp_tool "search_kv_cache_memories" '{
  "sourceModel": "gpt-4",
  "targetModel": "gpt-3.5-turbo",
  "minQuality": 70,
  "limit": 5
}'

# Test 2: Search Reasoning Chain Memories
echo "Test 2: Search Reasoning Chain Memories"
test_mcp_tool "search_reasoning_chain_memories" '{
  "sourceModel": "gpt-4",
  "targetModel": "gpt-3.5-turbo",
  "problemType": "math",
  "minQuality": 70,
  "limit": 5
}'

# Test 3: Search Long-term Memories
echo "Test 3: Search Long-term Memories"
test_mcp_tool "search_long_term_memories" '{
  "sourceModel": "gpt-4",
  "targetModel": "gpt-4",
  "minQuality": 70,
  "limit": 5
}'

# Test 4: Get All Memory Types
echo "Test 4: Get All Memory Types"
test_mcp_tool "get_all_memory_types" '{
  "sourceModel": "gpt-4",
  "targetModel": "gpt-3.5-turbo"
}'

# Test 5: Check Model Compatibility
echo "Test 5: Check Model Compatibility"
test_mcp_tool "check_model_compatibility" '{
  "sourceModel": "gpt-4",
  "targetModel": "gpt-3.5-turbo"
}'

# Print summary
echo "========================================"
echo "MCP Server Test Summary"
echo "========================================"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
echo "========================================"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
