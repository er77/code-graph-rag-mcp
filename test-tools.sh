#!/bin/bash

# MCP Server Tool Testing Script
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

    echo "Request: $request"
    echo ""

    # Send request to server and get response
    echo "$request" | timeout 3 node /home/er77/_work_fodler/code-graph-rag-mcp/dist/index.js /home/er77/_work_fodler/baserow-develop 2>/dev/null | grep -A10 '"result"' | head -20 || echo "No response or timeout"

    echo "---------------------------------"
}

# Test 1: List tools
send_request "tools/list" "{}" "List Available Tools"

# Test 2: Graph Analyze
send_request "tools/call" '{"name":"graph:analyze","arguments":{"directory":"/home/er77/_work_fodler/baserow-develop"}}' "Graph Analyze"

# Test 3: Graph Index
send_request "tools/call" '{"name":"graph:index","arguments":{"directory":"/home/er77/_work_fodler/baserow-develop","incremental":true}}' "Graph Index"

# Test 4: Query Search
send_request "tools/call" '{"name":"query:search","arguments":{"query":"function","limit":3}}' "Query Search"

# Test 5: Find Entity
send_request "tools/call" '{"name":"query:findEntity","arguments":{"name":"BaserowApplication","type":"class"}}' "Find Entity"

# Test 6: Semantic Search
send_request "tools/call" '{"name":"semantic:search","arguments":{"query":"database","limit":3}}' "Semantic Search"

# Test 7: Explain Code
send_request "tools/call" '{"name":"semantic:explain","arguments":{"code":"def add(a,b): return a+b","language":"python"}}' "Explain Code"

# Test 8: Suggest Improvements
send_request "tools/call" '{"name":"semantic:suggest","arguments":{"code":"def add(a,b): return a+b","language":"python"}}' "Suggest Improvements"

echo ""
echo "================================="
echo "✅ TESTING COMPLETE"
echo "================================="