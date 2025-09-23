#!/bin/bash

# CORRECT Configuration for UltraFink/Claude MCP
# This uses the LOCAL FIXED version, not the npm registry version

echo "🔧 Updating Claude MCP configuration to use fixed local version..."
echo ""
echo "Run this command to update the configuration:"
echo ""
echo "claude mcp add-json code-graph-rag '{"
echo '  "command": "node",'
echo '  "args": ["/home/er77/_work_fodler/code-graph-rag-mcp/dist/index.js", "/home/er77/_work_fodler/baserow-develop"]'
echo "}'"
echo ""
echo "Or if you prefer to use npx with the local version:"
echo ""
echo "claude mcp add-json code-graph-rag '{"
echo '  "command": "node",'
echo '  "args": ["/home/er77/_work_fodler/code-graph-rag-mcp/dist/index.js", "/home/er77/_work_fodler/baserow-develop"]'
echo "}'"
echo ""
echo "✅ This configuration will use the FIXED local version that extracts entities correctly!"
echo ""
echo "After updating the configuration:"
echo "1. Restart UltraFink or reconnect the MCP server"
echo "2. Run: code-graph-rag - index"
echo "3. You should see ~4,467 entities extracted!"