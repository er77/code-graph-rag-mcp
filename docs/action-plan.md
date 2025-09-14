# MCP Server Codegraph — Action Plan and Roadmap

Last updated: 2025-09-14

This plan delivers a reliable, fast, and useful MCP server that builds and queries a code graph. It’s phased for incremental value and small, reviewable PRs.

## Phase 0 — Repo hygiene and packaging (Day 0–2)
Goals: First-run success, working CLI, clean builds, and basic CI.

### Tasks
- Fix CLI packaging
  - Set bin to `mcp-server-codegraph` and ensure `dist/index.js` is built.
  - Add `tsconfig.json` and tsup build scripts (`build`, `dev`, `typecheck`, `prepublishOnly`).
  - Move TypeScript to `devDependencies`; add `engines`, `repository`, `bugs`, `homepage` metadata.
- Fix README
  - Correct the Claude Desktop JSON (no trailing comma).
  - Add `npx` and global install examples.
- Add CI
  - Node 20 job with `npm ci`, `lint`, `typecheck`, `build` on master/main.
- Repo settings (optional)
  - Enable Issues on the fork.
  - Consider renaming `master` → `main` (or allow both in CI for now).

### Deliverables
- Working `npx` run and local install: `mcp-server-codegraph /path/to/dir`
- Green CI on push/PR.

### Acceptance criteria
- Running `npx @scope/mcp-server-codegraph` indexes a sample directory without crashing.
- CI passes on clean checkout.

---

## Phase 1 — Indexer foundation (Week 1)
Goals: Reliable, incremental indexing with a pluggable parser architecture.

### Tasks
- Define a graph schema
  - Node types: repository, module/file, class, function, method, variable, interface.
  - Edge types: call, reference, import, export, inherit, implement, contain.
- Implement core indexing pipeline
  - File discovery that respects `.gitignore`; skip binaries/large files.
  - Content hashing and incremental rebuild (only changed files).
  - Parallel parsing by file with configurable concurrency.
  - Watch mode for live updates (optional).
- Parser interface
  - Define a `LanguageAdapter` interface (parse, extract entities/edges).
  - Implement JS/TS via tree-sitter as first adapter.
  - Store results in a portable local DB (SQLite by default), with in-memory option.

### Deliverables
- `src/indexer` with pipeline, adapters, and SQLite store.
- Graph schema documented in README (or `docs/schema.md`).
- Minimal e2e: index a small JS/TS project, persist entities/edges, and query counts.

### Acceptance criteria
- Re-running index on unchanged repo performs <10% of cold time.
- On small sample repo, entity and edge counts are stable and deterministic.

---

## Phase 2 — Query surface and MCP tools (Week 2)
Goals: Useful, user-facing queries beyond simple listings.

### Tasks
- MCP tools
  - `index` (existing): index repo path with options (ignore patterns, concurrency).
  - `list_file_entities(path)`.  
  - `list_entity_relationships(path, name)`.  
  - New tools: `search_entities(query)`, `find_references(path, name)`, `who_calls(path, name)`, `impacted_by_change(path, name)`, `list_cycles(scope)`, `module_dependencies(scope)`.
- Internal query layer
  - SQL helpers over the SQLite schema, or a simple query DSL.
  - Optional: streaming responses for large result sets.
- Natural language wrappers (optional)
  - Map common phrasings (“who calls X?”) to tool invocations.

### Deliverables
- Expanded MCP manifest with tool schemas and validation.
- Documentation with examples for each tool.

### Acceptance criteria
- Given a sample repo, `who_calls` and `find_references` return correct results for known cases.
- `list_cycles` detects at least one synthetic cycle in sample fixtures.

---

## Phase 3 — Performance, persistence, and scale (Week 3)
Goals: Predictable performance and warm-start speed.

### Tasks
- Caching and persistence
  - Cache parse artifacts keyed by file hash; reuse across runs.
  - Vacuum/compaction strategy for SQLite; schema migrations strategy.
- Performance tuning
  - Batched writes; WAL mode; tuned PRAGMAs for SQLite.
  - Configurable parallelism; backpressure to avoid memory spikes.
- Benchmarking
  - Define standard benchmarks and report: files/sec by language, cold vs warm indexing.
  - Add a simple benchmark command or script.

### Deliverables
- `docs/performance.md` with reproducible benchmarks.
- Config options for tuning (env vars or CLI flags).

### Acceptance criteria
- Warm indexing ≥5x faster than cold on test repo (target baseline, adjust as measured).
- Memory usage stable within configuration bounds under parallel load.

---

## Phase 4 — Developer ergonomics, tests, and examples (Week 4)
Goals: Confidence via tests, clear examples, and easy validation.

### Tasks
- Testing
  - Vitest setup; unit tests for parsers and graph edge extraction.
  - Golden tests for entity/edge sets on sample fixtures.
  - Minimal e2e test that boots MCP server and runs a query.
- Examples and docs
  - Sample repo with known relationships for demos.
  - Quickstart: “trace callers of function X”, “find circular deps”, “impact of change”.
- Visualization (optional but valuable)
  - Export graph to Graphviz or a simple web page for visual validation.
  - VS Code task or script to generate a PNG/SVG from current graph.

### Deliverables
- `tests/` with coverage for adapters and pipeline.
- `examples/` with scripts and expected outputs.
- Optional: graph export command producing a .dot file.

### Acceptance criteria
- CI gates on test, typecheck, and lint; coverage ≥70% on core modules.
- Example scenarios run and produce expected outputs.

---

## Phase 5 — Release readiness and governance (Week 5)
Goals: Clean releases and community-ready project.

### Tasks
- Package and versioning
  - Decide on final npm scope/name (avoid `@cartographai` if this is your fork).
  - Add `CHANGELOG.md` and semantic versioning (e.g., changesets or conventional commits).
- Project docs
  - `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
  - Templates for issues and PRs.
- Optional: GitHub Action integration
  - Action that runs impact analysis on PRs and comments with findings.

### Deliverables
- v0.1.0 release notes; publish if desired.
- Community docs and templates in `.github/`.

### Acceptance criteria
- Publish dry-run succeeds; install and run works from npm tarball.
- New contributors can run the project from README without assistance.

---

## Suggested PR sequence
1) chore: fix packaging (bin), add tsconfig, build scripts, CI, README JSON fix
2) feat(indexer): graph schema, SQLite store, file scanning, incremental hashing
3) feat(parser-js): tree-sitter JS/TS adapter and tests
4) feat(mcp): add query tools (search_entities, who_calls, find_references, etc.)
5) perf: caching, batched writes, WAL tuning, benchmarks and docs
6) test/docs: golden tests, examples, visualization export, contributor docs
7) release: prepare v0.1.0 and decide on npm scope

---

## Success metrics
- DX: `npx` run under 30s on medium repo for initial index; warm under 5s.
- Accuracy: >95% precision/recall on entity and call extraction in curated fixtures.
- Stability: CI green across platforms; no memory spikes under parallel indexing.
- Adoption: Internal users can answer “who-calls/impact” within first 5 minutes.

## Risks and mitigations
- Parser accuracy: Start with one language; build golden fixtures; iterate.
- Performance regressions: Add benchmarks early; CI performance checks (if feasible).
- Scope creep: Keep MCP tools focused; advanced features behind flags.
- Publishing conflicts: Choose your own scope before publish; avoid upstream namespace.