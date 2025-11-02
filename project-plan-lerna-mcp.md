# Lerna Integration & MCP Service Plan

## Goal
Introduce Lerna-based workspace graph capabilities to the Code Graph RAG MCP server, enabling both internal dependency-aware workflows and an external MCP tool surface for other agents.

## Context
- Repository currently behaves as a single package (`package.json` only, no `lerna.json`).
- Existing agents rely on bespoke graph logic; dependency metadata is limited to file-level analysis.
- MCP governance requires TASK-IDs and logging (`.memory_bank/logs_llm/`) for coordinated multi-agent work.

## Scope
1. Restructure repo (if needed) to support Lerna/Nx project graph generation.
2. Build internal adapter that normalizes Lerna graph data into the code-graph storage schema.
3. Expose Lerna graph access via dedicated MCP service commands.
4. Document workflows and update governance artifacts.

## Phase Breakdown

### Phase 1 – Assessment & Task Framing
- Inventory current module boundaries; decide between full monorepo split or Nx “virtual” projects.
- File TASK ticket (e.g., `TASK-0XX`) in `.memory_bank/current_tasks.md`.
- Draft ADR entry outline in `.memory_bank/patterns/architectural_decisions.md` describing Lerna adoption rationale.

### Phase 2 – Workspace Enablement
- Introduce `lerna.json` and workspace/glob configuration.
- If moving to monorepo, split `src` into `packages/*` while preserving build/test coverage.
- Verify `npm run build`, `npm run test`, and linting succeed under the new structure.

### Phase 3 – Graph Ingestion Layer
- Implement `src/graph/lerna-adapter.ts` (name TBD) to:
  - Execute Lerna project graph generation (via API or `npx lerna ls --graph`).
  - Map nodes/edges into existing SQLite/vector storage entities.
  - Cache results keyed by Git SHA or manifest modification times.
- Add Jest coverage for workspace protocol handling, semver checks, and error paths.
- ✅ Initial ingestion adapter available via `lerna_project_graph` tool (`ingest` flag) writing package nodes, dependency edges, pruning stale packages, and caching CLI results per workspace.
  - Supports `force` flag to bypass cache when urgent refresh is required.

### Phase 4 – MCP Service Exposure
- Add MCP tools (e.g., `lerna.projectGraph`, `lerna.changedGraph`) with streaming JSON responses.
- Integrate logging hooks writing to `.memory_bank/logs_llm/TASK-XXX.log`.
- Ensure conductor workflow can request these tools and use results to scope downstream agent tasks.
- ✅ `lerna_project_graph` MCP tool exposed with optional ingest + logging.

### Phase 5 – Documentation & Rollout
- Update `.memory_bank/README.md`, main `README.md`, and `examples/` with setup/usage steps.
- Record final ADR + link to TASK.
- Communicate migration steps for contributors (simple runbooks, fallback guidance).

## Deliverables
- `lerna.json`, workspace reorganization (if adopted).
- Graph adapter module with tests and caching strategy.
- MCP tool handlers registered in server entry points.
- Documentation updates, ADR entry, and task log.

## Risks & Mitigations
- **Build/CI regressions**: Run full test + lint suites after workspace migration; stage changes incrementally.
- **Agent coordination complexity**: Provide clear conductor templates for leveraging the new MCP tools.
- **Performance overhead**: Cache graph results and invalidate only on relevant file changes.

## Open Questions
- Can we adopt Nx virtual projects instead of full package split to minimize refactor cost?
- Should the MCP service fall back gracefully when Lerna config is absent?
- How do we surface dependency drift warnings to downstream agents (logs vs. status API)?

## Next Steps
1. Assign TASK ID and note entry in `.memory_bank/current_tasks.md`.
2. Schedule conductor session to confirm chosen workspace strategy.
3. Prototype graph adapter against current single-package layout to validate assumptions before large refactor.
