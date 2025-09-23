#!/bin/bash

# CORRECT Configuration for Gemini CLI MCP
# Mirrors the Claude helper, pointing Gemini to the local fixed build

PROJECT_DIR="/home/er77/_work_fodler/code-graph-rag-mcp"
TARGET_DIR="/home/er77/_work_fodler/baserow-develop"

echo "🔧 Updating Gemini MCP configuration to use the local server..."
echo
echo "Run this command to register the MCP server with Gemini CLI:"
echo
echo "gemini mcp add-json code-graph-rag '{" \
     "\\\"command\\\": \\\"node\\\"," \
     "\\\"args\\\": [\\\"$PROJECT_DIR/dist/index.js\\\", \\\"$TARGET_DIR\\\"]" \
     "}'"
echo
echo "If your Gemini CLI expects a different subcommand, adapt accordingly (e.g., 'mcp add')."
echo
echo "After updating, restart Gemini or reload MCP connections, then test tools with:"
echo "  - get_graph_stats"
echo "  - get_graph"
echo "  - semantic_search"
echo
echo "✅ Configuration output complete"

