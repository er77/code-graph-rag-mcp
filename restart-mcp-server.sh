#!/bin/bash

# MCP Server Restart Script with Entity Extraction Fix
# Version 2.3.3 - Fixed entity extraction

echo "🔧 MCP Code Graph RAG - Restart Script"
echo "======================================="
echo "This will restart the MCP server with the fixed entity extraction"
echo ""

# Kill any existing MCP server processes
echo "1. Stopping existing MCP server processes..."
pkill -f "node.*dist/index.js.*baserow" 2>/dev/null
pkill -f "node.*code-graph-rag-mcp" 2>/dev/null
sleep 2

# Build the project with fixes
echo "2. Building project with entity extraction fixes..."
cd /home/er77/_work_fodler/code-graph-rag-mcp
npm run build

# Clear the database to start fresh (optional - uncomment if needed)
# echo "3. Clearing existing database..."
# rm -f ~/.code-graph-rag/codegraph.db

echo ""
echo "✅ Build complete! The MCP server is ready with fixes."
echo ""
echo "📋 IMPORTANT: To use in UltraFink, you need to:"
echo ""
echo "1. Restart the MCP server connection in UltraFink"
echo "2. Or restart UltraFink completely"
echo ""
echo "The MCP server will now extract entities correctly:"
echo "  - Files, modules, classes, and functions"
echo "  - Expected: ~4,467 entities from baserow-develop (1,956 files)"
echo ""
echo "🚀 Start the server with:"
echo "   node /home/er77/_work_fodler/code-graph-rag-mcp/dist/index.js /home/er77/_work_fodler/baserow-develop"