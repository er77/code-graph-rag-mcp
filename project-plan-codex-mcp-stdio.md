# Codex (VSCode) MCP StdIO Compatibility Plan

## Problem Statement
Codex inside VSCode treats MCP stdio servers as **strict JSON-RPC streams**:

- `stdout` is parsed as **newline-delimited JSON-RPC**.
- Any non-JSON line on `stdout` (banners, `console.log`, library prints) can be interpreted as a protocol error.
- Codex may enforce **startup/handshake timeouts**, so heavy initialization before the transport is connected can cause the server to be marked unhealthy.

This differs from more tolerant clients (e.g., tools that ignore parse errors), where the server may appear to work despite stdout pollution.

## Goals
- Guarantee `stdout` is **JSON-only** during MCP operation.
- Keep server startup responsive: connect transport fast; defer heavy initialization.
- Make project root selection reliable under Codex (where process `cwd` may not match workspace root).
- Avoid overengineering: changes should be minimal, testable, and reversible.

## Non-Goals
- Rewriting every module to eliminate `console.*` usage immediately.
- Changing tool semantics or storage schema.
- Introducing new external dependencies.

## Proposed Refactor (Phased)

### Phase 1 — StdIO Safety Guard (Immediate)
**Outcome**: Prevent accidental stdout logging from breaking MCP.

- Add a bootstrap module that redirects `console` stdout-backed methods to `stderr` when `stdout` is not a TTY.
- Keep an opt-out env for local debugging (e.g., `MCP_STDIO_ALLOW_STDOUT_LOGS=1`).

Acceptance:
- Server can start under Codex without protocol parse errors caused by `console.log`.

### Phase 2 — Fast Handshake / Deferred Runtime Init
**Outcome**: Codex sees the server as responsive during initialization.

- Ensure the server connects the stdio transport first.
- Move heavy initialization (config load, DB init, graph storage init, large caches) into an async single-flight initializer.
- Tool handlers `await` runtime initialization when needed.

Acceptance:
- `initialize` handshake completes quickly.
- First tool call waits for init (if still running) instead of failing.

### Phase 3 — Workspace Root Resolution via `roots/list`
**Outcome**: Project root works even when Codex spawns the process with an unexpected `cwd`.

- When no explicit directory argument is provided, request client roots with `roots/list` (short timeout).
- Pick the first `file:` root and use it as the project root.
- `process.chdir(projectRoot)` before loading YAML config so relative paths resolve correctly.

Acceptance:
- Running `code-graph-rag-mcp` with no args under Codex uses the workspace root.

### Phase 4 — Batched Indexing for Strict Client Timeouts
**Outcome**: Avoid MCP transport closure when indexing large repos under strict per-tool timeouts (e.g., ~15s).

- Add a resumable indexing tool (`batch_index`) that processes only a small batch of files per call.
- Persist session state (file list + cursor + stats) under a global tmp directory (e.g., `/tmp/code-graph-rag-mcp/index-sessions/`).
- Return progress (`percent`, counts, `done`) and a `sessionId` that the client can pass to continue.
- Support incremental mode to skip unchanged files; replace per-file graph data safely to avoid duplicates.

Acceptance:
- A single `batch_index` tool call completes under strict tool-call deadlines.
- Repeated calls reach 100% completion and keep the MCP transport alive.

### Phase 5 — Optional: Protocol-Native Logging
**Outcome**: Logs are visible in MCP client without using stdout.

- Advertise `capabilities.logging`.
- After initialization, send logs via `notifications/message` (rate-limited / leveled).

Acceptance:
- Codex can display log messages without protocol corruption.

## Implementation Notes
- Prefer **one** mechanism that guarantees stdout safety (console redirect) rather than trying to rewrite all logging in one pass.
- Treat `roots/list` as best-effort:
  - Use a short timeout.
  - Fallback to `process.cwd()` when unavailable.
- Keep behavior stable for existing usage:
  - `code-graph-rag-mcp /path/to/repo` should behave the same as before.

## Testing & Verification
- `npm run lint`
- `npm run typecheck`
- `npm test`
- Manual smoke (recommended):
  - Run under Codex/VSCode MCP config with **no args** and verify `index` targets the workspace root.

## Related ADRs
- `.memory_bank/patterns/ADR-007-mcp-stdio-compatibility.md`
- `.memory_bank/patterns/ADR-008-refactoring-actions-code-actions.md`
- `.memory_bank/patterns/ADR-009-rg-style-refactor-actions.md`

---

# Follow-on Roadmap: Refactoring Actions (Post-StdIO)

Once Codex stdio compatibility is stable, add **deterministic, previewable refactoring actions** in two complementary
tracks:

- **clangd-like code actions** (semantic, IDE-grade when available): ADR-008
- **rg-style search/replace refactors** (fast mechanical migrations): ADR-009

The shared requirement is: **clients must be able to preview exact edits** and the server must remain **safe by default**
(no implicit writes).

## Phase 5 — Shared Edit Model & Safety Rails (ADR-008/ADR-009)
**Outcome**: A single, LSP-inspired patch model used by all refactor providers.

- Introduce internal types for:
  - `WorkspaceEdit` (per-file `TextEdit[]`)
  - `RefactorAction` (id/title/kind/target + provider metadata)
  - `documentHash` / `expectedDocumentHash` staleness guards
- Add server-side apply gate:
  - default preview-only
  - require explicit opt-in (e.g., `MCP_REFACTOR_ALLOW_WRITES=1`) for any disk writes
- Constrain edits:
  - refuse writes outside workspace root (`roots/list` preferred)
  - enforce blast-radius limits (files changed / edits / diff bytes)
  - never touch ignored folders (`tmp/`, `node_modules/`, build artifacts)

Acceptance:
- Preview returns `WorkspaceEdit` + unified diff without writing to disk.
- Apply refuses if the workspace root is unknown or hashes do not match.

## Phase 6 — rg-Style Search/Replace Refactor Actions (ADR-009)
**Outcome**: Fast, deterministic “mechanical refactors” across any language.

- Add MCP tools:
  - `refactor_search`
  - `refactor_replace_preview`
  - `refactor_replace_apply`
- Provider strategy:
  - prefer `rg --json` when available
  - pure Node fallback scanning when not available
- Support include/exclude globs (merged with server defaults; `tmp/` always excluded).

Acceptance:
- Search returns stable match coordinates and text/capture groups.
- Preview returns a bounded diff; apply is opt-in and hash-guarded.

## Phase 7 — clangd-Like Code Actions (ADR-008)
**Outcome**: Semantic refactor actions with optional best-in-class tooling.

- Add MCP tools:
  - `refactor_list_actions`
  - `refactor_preview_action`
  - `refactor_apply_action`
- Provider architecture:
  - baseline `TreeSitterRefactorProvider` (safe file-local actions)
  - `GraphRefactorProvider` for best-effort cross-file actions
  - optional `LspRefactorProvider` (start with `clangd` for C/C++)

Acceptance:
- At least one deterministic file-local action is available without external tools.
- When `clangd` is present, C/C++ actions return LSP-derived edits as `WorkspaceEdit`.

## Phase 8 — Tests, Fixtures, and Documentation
**Outcome**: Refactor features are regression-tested and discoverable.

- Add fixture-based tests for match/replace and diff generation.
- Add golden outputs for preview diffs where stable.
- Document configuration (write opt-in, limits, provider availability).
