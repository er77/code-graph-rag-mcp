# Release Notes — `@er77/code-graph-rag-mcp` v2.7.9 (2025-12-15)

## Summary

v2.7.9 is a documentation/configuration release focused on making Codex MCP setup reliable across projects and reducing
stdio handshake failures caused by misconfiguration.

There are no behavior changes compared to v2.7.8.

## What’s Changed

- Codex CLI setup: recommend a global MCP server entry (`codex mcp add ...`) that works from any project folder.
- Documentation cleanup: removed references to non-existent helper scripts and updated examples accordingly.

## Install / Upgrade

- npm: `npm install -g @er77/code-graph-rag-mcp@2.7.9`
- local artifact: `npm install -g ./er77-code-graph-rag-mcp-2.7.9.tgz`

Node.js: `>=24`

## Codex CLI Configuration (Global)

Recommended:

- `codex mcp remove code-graph-rag` (optional cleanup)
- `codex mcp add code-graph-rag -- code-graph-rag-mcp`

Alternative (local dev build, no npm/npx):

- `codex mcp remove code-graph-rag` (optional cleanup)
- `codex mcp add code-graph-rag -- node /absolute/path/to/code-graph-rag-mcp/dist/index.js`

## Troubleshooting

If Codex reports `handshaking with MCP server failed: connection closed: initialize response`:

- Ensure the server writes JSON-RPC only to `stdout` (logs must go to `stderr`).
- Ensure your configured `command`/`args` are valid (e.g., don’t use `node -y ...`).
- Check server logs:
  - primary: `logs_llm/mcp-server-YYYY-MM-DD.log` (when writable)
  - global mirror: `/tmp/code-graph-rag-mcp/mcp-server-YYYY-MM-DD.log` (uses `os.tmpdir()`)
