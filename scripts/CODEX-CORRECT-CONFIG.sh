#!/bin/bash

# Helper for Codex CLI MCP configuration
# Prints a TOML block to add into ~/.codex/config.toml

PROJECT_DIR="/home/er77/_work_fodler/code-graph-rag-mcp"
TARGET_DIR="/home/er77/_work_fodler/baserow-develop"

cat <<EOF
🔧 Add this to your ~/.codex/config.toml to register the MCP server for this project:

[projects."$PROJECT_DIR".mcp_servers.code_graph_rag]
command = "node"
args = ["$PROJECT_DIR/dist/index.js", "$TARGET_DIR"]
transport = "stdio"
cwd = "$PROJECT_DIR"

# Alternatively, add globally:
#[mcp_servers.code_graph_rag]
#command = "node"
#args = ["$PROJECT_DIR/dist/index.js", "$TARGET_DIR"]
#transport = "stdio"
#cwd = "$PROJECT_DIR"

After updating, restart Codex CLI and run tools:
  - get_graph_stats
  - get_graph
  - semantic_search
EOF

