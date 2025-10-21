# Repository Guidelines

## Project Structure & Module Organization
Source lives in `src/`, organized by MCP domain: protocol adapters in `src/mcp/`, graph analytics in `src/graph/`, and shared utilities under `src/common/`. Integration and regression specs sit in `tests/` alongside fixtures. Example client workflows are in `examples/`, while reusable orchestration scripts live in `scripts/`. Runtime data (SQLite vectors, generated graphs) persists in `data/` and `llm_rag_db/`; keep large artifacts out of version control. Operational logs and session traces are archived under `logs_llm/` and `logs_archive/`.

## Build, Test, and Development Commands
- `bun run tsup` — bundle the TypeScript server into `dist/` for local validation.
- `make package` — produce the NPM tarball with metadata checks.
- `npx biome check --apply .` — lint and format TypeScript/JSON using the shared ruleset.
- `npm test` — execute the Jest suite with snapshots and coverage.
- `./test-tools.sh` — sanity-check MCP tool wiring against the reference manifest.
- `./test-correct-tools.sh` — performance and correctness sweep for sqlite-vec integration.

## Coding Style & Naming Conventions
Use TypeScript with strict mode enabled (see `tsconfig.json`). Prefer 2-space indentation, single quotes, and trailing commas where Biome enforces them. Name files in kebab-case (`graph-storage.ts`), classes in PascalCase, functions and variables in camelCase, and constants in SCREAMING_SNAKE_CASE. Document non-obvious modules with top-of-file comments describing their agent interaction or graph responsibilities.

## Testing Guidelines
Write Jest tests beside the closest domain (mirroring `src/` inside `tests/`) with filenames ending in `.test.ts`. Favor deterministic fixtures checked into `tests/fixtures/` and update snapshots deliberately. Ensure new features exercise both graph generation and tool invocation paths; aim to keep coverage at or above existing thresholds shown in `coverage/`. Before opening a PR, run `npm test` and both tool scripts locally.

## Commit & Pull Request Guidelines
Follow the established convention of prefixing commits with the active task, e.g., `TASK-123: tighten vector cache`. Keep messages in imperative mood and describe the user-facing outcome. For pull requests, include a concise summary, highlight affected agents or tools, link the relevant TASK ticket, and attach CLI output for key commands (`npm test`, tool scripts). If the change impacts memory bank content or logging, note any new files or retention considerations.

## Agent & Memory Bank Notes
Complex multi-step updates should route through the Conductor agent with clear delegation to specialist agents (parser, vector, tooling). Update `.memory_bank/` entries when workflows, commands, or agent responsibilities change, and log significant orchestration runs in `logs_llm/` to preserve traceability.
