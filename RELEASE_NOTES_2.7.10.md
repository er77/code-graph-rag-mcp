# Release Notes — `@er77/code-graph-rag-mcp` v2.7.10 (2025-12-15)

## Summary

v2.7.10 is a small patch release that fixes sqlite-vec extension loading for global installs (independent of project `cwd`).

## What’s Changed

- sqlite-vec loading: `VectorStore` now loads sqlite-vec via `sqlite-vec`’s `getLoadablePath()` first (global-install safe), with the existing fallback probes preserved.

## Install / Upgrade

- npm: `npm install -g @er77/code-graph-rag-mcp@2.7.10`
- local artifact: `npm install -g ./er77-code-graph-rag-mcp-2.7.10.tgz`

Node.js: `>=24`

## Notes

- If sqlite-vec still can’t load, the server will run in fallback mode (slower semantic search). Check `/tmp/code-graph-rag-mcp/mcp-server-YYYY-MM-DD.log` for the exact load error.

