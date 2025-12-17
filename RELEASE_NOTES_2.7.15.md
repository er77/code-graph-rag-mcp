# Release Notes (Consolidated) — `@er77/code-graph-rag-mcp` v2.7.9 → v2.7.18

This file consolidates recent release notes into a single document for easier tracking.

## Install / Upgrade (latest)

- npm: `npm install -g @er77/code-graph-rag-mcp@2.7.18`
- local artifact: `npm install -g ./er77-code-graph-rag-mcp-2.7.18.tgz` (if present)

Node.js: `>=24`

---

## v2.7.15 (2025-12-17)

- Maintenance release (version bump + rebuild).

## v2.7.16 (2025-12-17)

- Timeout defaults: raise MCP tool-call timeouts to 600s in code defaults and shipped YAML configs to avoid premature `clean_index` / `batch_index` failures on larger repos.

## v2.7.17 (2025-12-17)

- Docs: refresh contributor guidelines (`AGENTS.md`) and update consolidated release notes.

## v2.7.18 (2025-12-17)

- Indexing: stop excluding Markdown by default; `.md` / `.mdx` are now discoverable via `index`, `clean_index`, and `batch_index`.
- Diagnostics: log file-discovery stats for `batch_index` sessions and reduce false-positive “Agent heartbeat stale” warnings when agents are idle.

## v2.7.14 (2025-12-17)

- Indexing: include Markdown files (`.md`, `.mdx`) in the parser/index pipeline.
- New Markdown parsing: emits `document` + `heading` entities and `contains` relationships for heading structure.

## v2.7.13 (2025-12-16)

Agent-quality upgrade for MCP tool usability and reliability:

- Tool guidance: rewritten tool descriptions with “Use when / Typical flow / Output” structure.
- Response standardization: unified JSON envelope via `toolOk` / `toolFail` (including `agent_busy` failures).
- Pagination: cursor + `pageSize` support for high-cardinality tools (`semantic_search`, `query`, `get_graph`).
- Schema/behavior alignment: `depth` now honored by `list_entity_relationships` and `analyze_code_impact`.
- New grounding tools:
  - `resolve_entity` for ranked disambiguation by name (+ `filePathHint` boosting).
  - `get_entity_source` for snippet extraction with context + truncation safeguards.
- Query improvements: hybrid results include structural match annotations and paging metadata.
- Tests: added/updated integration + utility tests to prevent schema/behavior drift.

## v2.7.12 (2025-12-15)

- Dependencies: `onnxruntime-node` is now an optional peer dependency (avoids pulling deprecated `boolean@3.2.0`).

## v2.7.11 (2025-12-15)

- Database isolation: default `database.path` is `./.code-graph-rag/vectors.db` (per-repo storage by default).
- Index hygiene: `.code-graph-rag/**` is always excluded from indexing.

## v2.7.10 (2025-12-15)

- sqlite-vec loading: load sqlite-vec via `sqlite-vec`’s `getLoadablePath()` first (global-install safe), with fallbacks.

## v2.7.9 (2025-12-15)

Reliability release focused on stricter MCP clients and big repos:

- Stdio hardening: prevent stdout log pollution during MCP runs so strict clients can complete `initialize`.
- Logging: mirror server logs to `/tmp/code-graph-rag-mcp/mcp-server-YYYY-MM-DD.log` for early-start debugging.
- Indexing defaults: exclude common build/tmp/vendor directories unless explicitly overridden.
- Batched indexing: `batch_index` (resumable, progress-returning) to avoid strict client tool-call timeouts on big repos.
- Incremental indexing: `incremental:true` reindexes only changed files and safely replaces per-file graph rows.
- Vector DB location: YAML supports `~` and defaults were improved for predictable paths.
- Graph query fix: RegExp name filtering supports exact `^...$` and substring matches (unblocks relationship tools).
