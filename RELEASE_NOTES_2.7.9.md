# Release Notes — `@er77/code-graph-rag-mcp` v2.7.9 (2025-12-15)

## Summary

v2.7.9 is a reliability release focused on making Codex MCP setup reliable across projects, reducing stdio handshake
failures, and improving indexing defaults.

## What’s Changed

- Stdio hardening: prevent stdout log pollution during MCP runs so strict clients can complete `initialize`.
- Logging: mirror server logs to `/tmp/code-graph-rag-mcp/mcp-server-YYYY-MM-DD.log` for early-start debugging.
- Indexing defaults: always exclude common build/tmp/vendor directories unless explicitly overridden.
- Batched indexing: add `batch_index` (resumable, progress-returning batches) to avoid strict client tool-call timeouts on big repos.
- Incremental indexing: `incremental:true` now reindexes only changed files and safely replaces per-file graph rows to avoid duplicates.
- Vector DB location: default `database.path` now resolves to `~/.code-graph-rag/vectors.db` (YAML supports leading `~`).
- Graph query fix: RegExp name filtering now resolves entities correctly (supports exact `^...$` and substring matches),
  unblocking tools like `list_entity_relationships` and `analyze_code_impact`.
- Codex CLI setup: recommend a global MCP server entry (`codex mcp add ...`) that works from any project folder.

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

If `clean_index` / `index` time out on large repos under strict clients (15s) and the transport closes:

- Use `batch_index` with a small `maxFilesPerBatch` and keep calling it with the returned `sessionId` until `done:true`.
