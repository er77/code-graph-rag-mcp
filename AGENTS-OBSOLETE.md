# Repository Guidelines

This guide helps contributors work effectively on the Code Graph RAG MCP server. It summarizes structure, commands, style, and review expectations.

## Agent Governance
- Mandatory Conductor: start ANY multi‑step task (>2 steps) with `conductor`. Conductor orchestrates only (zero implementation).
- Approval Workflow: Conductor proposes 5 methods and a complexity score (1–10). If >5, obtain explicit approval and record the chosen method.
- Access Control: `codex-coder`, `mcp-agent-gemini`, and `mcp-agent-codex` accept tasks only via Conductor. `dora` may be used directly for simple research but prefer Conductor coordination.
- Traceability & Logs: tag work with `TASK-XXX`; record ADR-XXX in `.memory_bank/patterns/architectural_decisions.md`; write logs to `.memory_bank/logs_llm/TASK-XXX.log`.
- Circular Bugs: on 3+ repeated failures, halt implementation and deploy Enhanced Research Trinity (`dora` + `mcp-agent-gemini` + `mcp-agent-codex`); update `.memory_bank/patterns/circular_bugs.md`.

## Project Structure & Module Organization
- `src/` – main code: `agents/`, `core/`, `query/`, `semantic/`, `storage/`, `parsers/`, `utils/`, `types/`; entry `src/index.ts`.
- Tests live beside code under `**/__tests__/**` (e.g., `src/agents/__tests__/parser-agent.test.ts`).
- `dist/` – build output; `examples/` – sample usage; `config/` – defaults; `.memory_bank/` – architecture docs, ADRs, and task logs.
- Main dev guide hub: `.memory_bank/README.md` (navigation for patterns, workflows, ADRs).

## Build, Test, and Development Commands
- Install: `npm ci` (Node >= 18)
- Build: `npm run build` (tsup → `dist/`), watch: `npm run build:watch`
- Typecheck: `npm run typecheck`
- Lint/Format: `npm run lint` · fix: `npm run lint:fix` · format: `npm run format`
- Tests: `npm test` · watch: `npm run test:watch` · coverage: `npm run test:coverage`
- Package via Make: `make package` (uses Bun if available)
- Run locally: `npm run build && node dist/index.js`

## Code Navigation & Refactoring Tools
- Fast, exact search: use `rg` (preferred over `grep`) to find strings/symbols across C++/JS/SQL/ADRs.
- C++ semantics and safe refactors: use `clangd` (find references, rename, call hierarchy). Generate compile commands with:
  - `cmake -S . -B build-clangd -DCMAKE_EXPORT_COMPILE_COMMANDS=ON`
  - Optional: `ln -sf build-clangd/compile_commands.json compile_commands.json` (for IDEs that look in repo root)
- Cross-language discovery: use `code-graph-rag` (MCP) for “where is X implemented?” and related-concept search across JS↔C++.
  - Note: if the indexer doesn’t ingest `.cxx/.hxx`, prefer `clangd` for C++ or generate a temporary, untracked mirror directory with `.cpp` copies for indexing (do not commit).
- Practical workflow: `code-graph-rag` (broad discovery) → `rg` (confirm exact call sites) → `clangd` (C++ refactor) → run focused tests.

## Coding Style & Naming Conventions
- Language: TypeScript (ESM). Prefer named exports.
- Formatting: Biome (2-space indent, line width 120). Do not commit unformatted code.
- Files: kebab-case (`dev-agent.ts`); tests `*.test.ts` under `__tests__`.
- Names: camelCase (vars/functions), PascalCase (classes), CONSTANT_CASE (const enums/flags).

## Testing Guidelines
- Framework: Jest + ts-jest (ESM). Place tests under `__tests__/` and name `*.test.ts`.
- Aim to cover new/changed logic; ensure `npm run test:coverage` passes.
- Avoid network and external side effects; stub I/O and database; use `data/` fixtures when possible.

## Commit & Pull Request Guidelines
- Commits: imperative mood, concise subject (<72 chars), include scope when helpful (e.g., `agents:`). Example: `agents: fix index tool error in DevAgent`.
- Reference issues and task IDs when applicable (e.g., `TASK-012`).
- PRs: clear description, motivation, screenshots/logs if relevant, reproduction/run steps, and tests. Update `.memory_bank` ADRs and `README.md` when architecture or CLI changes.

## Agent-Oriented Notes
- Keep architecture decisions traceable: add ADRs to `.memory_bank/patterns/architectural_decisions.md` and update `.memory_bank/current_tasks.md` for notable changes affecting agent workflows.

## Quick Reference
### Agent Invocation
```bash
# Complex task orchestration
use agent conductor
  [describe task]

# Direct research (when not requiring coordination)
use agent dora
  [research request]
```

### Codex CLI Usage
- Rule: For any multi‑step task, start with `conductor` (see governance in agent docs).
- Flow: conductor → 5 methods + complexity → approve → delegation → implementation (via `codex-coder`) → validation → docs.
- Templates:
```bash
use agent conductor
  TASK: [goal]
  CONTEXT: [repo paths, constraints]
  DONE: [acceptance criteria]
  NOTES: [deps/perf/security]
```
```bash
APPROVE: Method M3, TASK-014. Proceed. ADR required for [topic].
```
```bash
# Implementation (Conductor delegates to Codex Coder MCP)
# (run via MCP tool, not a chat agent)
mcp__codex-coder__codex
  prompt: "TASK-014: [implementation instructions]"
```
```bash
use agent dora
  RESEARCH: [question]
  OUTPUT: [bullets/tradeoffs]
  SCOPE: [tech constraints]
```
```bash
use agent conductor
  TASK: Debug [issue]
  TRIGGER: circular-bug
  CONTEXT: [symptoms, logs]
  DONE: Root cause + validated fix plan
```
- Traceability: reference `TASK-XXX` in commits/PRs and update `.memory_bank/current_tasks.md` and `.memory_bank/patterns/architectural_decisions.md` as needed.

### Task Tracking
- Active work: `.memory_bank/current_tasks.md`
- ADRs: `.memory_bank/patterns/architectural_decisions.md` (link ADR-XXX ↔ TASK-XXX)
- Logs: `.memory_bank/logs_llm/TASK-XXX.log`

## Agent Definitions
### Conductor (`conductor`)
- Model: opus · Color: yellow
- Role: pure orchestration (zero implementation). Generates 5 methods, scores complexity (1–10), requires approval when >5, delegates implementation to `codex-coder`, research to `dora`/MCP agents, tracks ADR-XXX and TASK-XXX, enforces logging.
- Use: start all multi-step tasks with `use agent conductor` and supply task, context, and acceptance criteria.

### Codex Coder MCP (`codex-coder`)
- Model: sonnet (via MCP) · Color: blue
- Role: exclusive implementation worker for Conductor; accepts code changes via the Codex Coder MCP tool.
- Invocation: use MCP tool `mcp__codex-coder__codex` (and `mcp__codex-coder__codex-reply` to continue sessions).
- Duties: implement code changes, add/update tests, run validations, update docs where needed, and maintain end-to-end traceability.
- Access: Conductor-only. Requires TASK-XXX + chosen method. Mandatory log at `.memory_bank/logs_llm/TASK-XXX.log`.

### Dev Agent (`dev-agent`) (legacy)
- Status: deprecated in this repo workflow; use `codex-coder` for implementation tasks. Keep only for historical references.

### Dora (`dora`)
- Model: opus · Color: green
- Role: research/documentation specialist (market, technical, competitive, regulatory).
- Practices: multi-source validation, strategic synthesis, clear deliverables. Log research steps to `.memory_bank/logs_llm/TASK-XXX.log`.

### MCP Agent Gemini (`mcp-agent-gemini`)
- Model: sonnet · Color: orange
- Role: prepares rich project context and delivers development/research tasks to Gemini MCP services only (no code edits, no independent research).
- Validated commands: `mcp__gemini-cli__ask-gemini`, `mcp__gemini-cli__brainstorm`, `mcp__gemini-cli__fetch-chunk`, `mcp__gemini-cli__ping`, `mcp__gemini-cli__Help`.
- Access: Conductor-only, requires TASK-XXX + chosen method; log to `.memory_bank/logs_llm/TASK-XXX.log`.

### MCP Agent Codex (`mcp-agent-codex`)
- Model: sonnet · Color: purple
- Role: circular bug detection and code-intelligence analysis; provides alternative approaches when failures repeat (part of Enhanced Research Trinity with `dora` + `mcp-agent-gemini`).
- Capabilities: pattern recognition, anti-pattern analysis, code graph queries, hotspot/impact analysis; updates `.memory_bank/patterns/circular_bugs.md`.
- Access: Conductor-only, requires TASK-XXX + chosen method; log to `.memory_bank/logs_llm/TASK-XXX.log`.
