# Project Plan: Integrate JSCPD MCP Tool (Approach 1)

## Objective
Expose JSCPD clone detection as a first-class MCP tool by wrapping the upstream `@jscpd/core` implementation directly from the `tmp/jscpd-master` source, aligning with the existing semantic tooling architecture.

## Scope
- Implement a new MCP tool handler (`tools/jscpd-clone-detector`) that invokes `detectClones` from `@jscpd/core`.
- Register the tool in `src/index.ts` alongside existing clone-detection capabilities, using Zod schemas for argument validation.
- Ensure the tool returns structured JSON compatible with Codex clients (clone groups, duplication metrics, file metadata).
- Provide configuration hooks (thresholds, include/exclude patterns) consistent with current YAML config patterns.
- Add tests covering argument parsing, successful execution on sample fixtures, and error handling.

## Deliverables
- Source integration module for JSCPD under `src/tools/`.
- Updated tool registration and handler logic in `src/index.ts`.
- Jest tests with fixture projects demonstrating duplicate detection.
- Documentation updates: README, `.memory_bank/README.md`, and method reference entries.
- (Optional) Logging enhancements showing JSCPD execution metrics via existing logger.

## Phases & Tasks

### Phase 1 — Dependency Integration
- **P1.1** Add required packages (`@jscpd/core`, `@jscpd/finder`, `@jscpd/tokenizer`, etc.) to `package.json` using workspace-relative paths or bundled builds from `tmp/jscpd-master`.
- **P1.2** Create a build script (if needed) to keep local JSCPD sources in sync, documenting the workflow in `.memory_bank/current_tasks.md`.
- **P1.3** Verify TypeScript compatibility; add ambient declarations if upstream lacks typings.

### Phase 2 — Tool Schema & Handler
- **P2.1** Define `JscpdCloneDetectionSchema` in `src/index.ts` (consistent with other tool schemas) covering options like `minTokens`, `maxLines`, and `path` filters.
- **P2.2** Implement `src/tools/jscpd.ts` exposing a single `runJscpdCloneDetection` function that maps schema arguments into JSCPD options and normalizes response payloads.
- **P2.3** Register the MCP tool in `list_tools` output (`src/index.ts:780` block) and dispatch switch (`src/index.ts:1468`), respecting timeout handling and logging conventions.

### Phase 3 — Testing & Fixtures
- **P3.1** Add minimal fixture repository under `tests/fixtures/jscpd-clones` with known duplicates.
- **P3.2** Write Jest integration test (`tests/integration/jscpd-tool.test.ts`) exercising success path, threshold filtering, and empty results.
- **P3.3** Cover failure cases (invalid options, timeout) ensuring structured error responses (`AgentBusyError` and validation errors).

### Phase 4 — Documentation & DX
- **P4.1** Document the new MCP method in README (tool list + usage example) and `.memory_bank/README.md`.
- **P4.2** Update `project-plan.md` progress trackers and task logs (`.memory_bank/current_tasks.md`, `.memory_bank/logs_llm/TASK-XXX.log`) with TASK identifier once assigned.
- **P4.3** Provide client snippets for Codex/Claude/Gemini in docs to trigger the new tool.

### Phase 5 — Validation & Release Prep
- **P5.1** Run `npm run lint`, `npm run typecheck`, and targeted Jest suites to confirm CI readiness.
- **P5.2** Capture before/after performance metrics during a sample run (optional).
- **P5.3** Prepare release notes summarizing JSCPD integration, configuration knobs, and testing status.

## Risks & Mitigations
- **Dependency Drift**: Upstream JSCPD may change; pin commit hash or publish tarball to ensure reproducible builds.
- **Performance Impact**: JSCPD scanning large codebases can be slow; expose limits (max files/tokens) and reuse existing `resourceManager` heuristics for throttling.
- **Schema Mismatch**: Align response format with existing `CloneGroup` typing; add conversion helpers to avoid breaking clients.

## Success Criteria
- New MCP tool returns JSCPD clone groups with accurate counts on fixture tests.
- CLI clients list and execute the tool without additional setup steps.
- Code passes lint/typecheck/test suites and documentation guides mention the new capability.
- Logging and error handling match conventions set by `detect_code_clones` and other semantic tools.
