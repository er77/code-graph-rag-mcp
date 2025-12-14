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

### Phase 4 — Optional: Protocol-Native Logging
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

## Related ADR
- `.memory_bank/patterns/ADR-007-mcp-stdio-compatibility.md`
