#!/bin/bash

# MCP Server Tool Testing Script with Correct Tool Names
# Tests all available MCP tools via JSON-RPC protocol

echo "================================="
echo "MCP SERVER TOOL TESTING"
echo "================================="

# Function to send request and get response
send_request() {
    local method=$1
    local params=$2
    local name=$3

    echo ""
    echo "🔧 Testing: $name"
    echo "Method: $method"

    # Create request JSON
    local request=$(cat <<EOF
{"jsonrpc":"2.0","id":1,"method":"$method","params":$params}
EOF
)

    echo "Request: $(echo $params | jq -c '.' 2>/dev/null || echo $params)"
    echo ""

    # Send request to server and get response
    echo "$request" | timeout 5 node /home/er77/_work_fodler/code-graph-rag-mcp/dist/index.js /home/er77/_work_fodler/baserow-develop 2>/dev/null | grep -A50 '"result"' | head -100 || echo "No response or timeout"

    echo "---------------------------------"
}

# Test actual tool names from the list

# Test 1: Index (main indexing tool)
send_request "tools/call" '{"name":"index","arguments":{"directory":"/home/er77/_work_fodler/baserow-develop","incremental":true,"excludePatterns":["node_modules/**","*.test.js"]}}' "Index Codebase"

# Test 2: Query
send_request "tools/call" '{"name":"query","arguments":{"query":"find all classes","limit":3}}' "Query Code Graph"

# Test 3: List File Entities
send_request "tools/call" '{"name":"list_file_entities","arguments":{"filePath":"/home/er77/_work_fodler/baserow-develop/backend/src/baserow/__init__.py"}}' "List File Entities"

# Test 4: List Entity Relationships
send_request "tools/call" '{"name":"list_entity_relationships","arguments":{"entityName":"BaserowApplication","depth":1}}' "List Entity Relationships"

# Test 5: Semantic Search
send_request "tools/call" '{"name":"semantic_search","arguments":{"query":"database models","limit":3}}' "Semantic Search"

# Test 6: Find Similar Code
send_request "tools/call" '{"name":"find_similar_code","arguments":{"code":"def add(a, b): return a + b","threshold":0.7,"limit":3}}' "Find Similar Code"

# Test 7: Analyze Code Impact
send_request "tools/call" '{"name":"analyze_code_impact","arguments":{"entityId":"test-entity","depth":2}}' "Analyze Code Impact"

# Test 8: Detect Code Clones
send_request "tools/call" '{"name":"detect_code_clones","arguments":{"minSimilarity":0.8,"scope":"all"}}' "Detect Code Clones"

# Test 9: Suggest Refactoring
send_request "tools/call" '{"name":"suggest_refactoring","arguments":{"filePath":"/home/er77/_work_fodler/baserow-develop/backend/src/baserow/__init__.py"}}' "Suggest Refactoring"

# Test 10: Cross Language Search
send_request "tools/call" '{"name":"cross_language_search","arguments":{"query":"database","languages":["python","javascript"]}}' "Cross Language Search"

# Test 11: Analyze Hotspots
send_request "tools/call" '{"name":"analyze_hotspots","arguments":{"metric":"complexity","limit":5}}' "Analyze Hotspots"

# Test 12: Find Related Concepts
send_request "tools/call" '{"name":"find_related_concepts","arguments":{"entityId":"test-entity","limit":5}}' "Find Related Concepts"

# Test 13: Get Metrics
send_request "tools/call" '{"name":"get_metrics","arguments":{}}' "Get System Metrics"

echo ""
echo "================================="
echo "✅ TESTING COMPLETE"
echo "================================="