# Project Plan: Agent Smoothness Enhancements

## Goals
Improve agent coordination and MCP operator experience by exposing richer telemetry, automating resource adjustments, warming semantic caches, and clarifying backpressure, while keeping the existing multi-agent architecture intact.

## Phases & Tasks

### ✅ Phase 1 — Diagnostics & Telemetry
- **A1.1** Implement `get_agent_metrics` MCP tool exposing:
  - Conductor metrics via `ConductorOrchestrator.getPerformanceMetrics()` (`src/agents/conductor-orchestrator.ts`).
  - Per-agent metrics from `BaseAgent.getMetrics()`, SemanticAgent’s `getSemanticMetrics()`, and QueryAgent’s `getQueryMetrics()`.
- **A1.2** Add unit coverage in `tests/agents/*` verifying aggregation and JSON schema.
- **A1.3** Document usage in `.memory_bank/architecture/mcp_integration.md` and README (Codex diagnostics section).

### ✅ Phase 2 — Resource Broadcast Integration
- **A2.1** Emit knowledge-bus events (topic `resources:adjusted`) from `ResourceManager.adjustForCodebaseSize` with memory/agent limits.
- **A2.2** Subscribe DevAgent, SemanticAgent, and QueryAgent to `resources:*` topics, adapting batch sizes or concurrency when a message arrives.
- **A2.3** Add regression tests for the broadcast/subscribe flow and update `.memory_bank/architecture/multi_agent_patterns.md`.

### ✅ Phase 3 — Semantic Warmup Improvements
- **A3.1** Configure SemanticAgent initialization to call `SemanticCache.warmup()` with a curated set of entities (mirroring QueryAgent warmup).
- **A3.2** Make warmup parameters configurable via YAML (`semantic.cacheWarmupLimit`, `semantic.popularEntitiesTopic`).
- **A3.3** Extend tests/fixtures to cover warmup and cache hit improvements; note behaviour in `.memory_bank/architecture/vector_store.md`.

### ✅ Phase 4 — Knowledge Bus Health Tools
- **A4.1** Add MCP tools `get_bus_stats` and `clear_bus_topic` that invoke `KnowledgeBus.getStats()` and `KnowledgeBus.clearTopic()`.
- **A4.2** Wire tools into `src/index.ts`, including schema validation and response formatting.
- **A4.3** Update docs (README diagnostics section + memory bank) and add tests for tool behaviours.

### ✅ Phase 5 — Backpressure Signalling
- **A5.1** Enhance `BaseAgent.process` to throw structured `AgentBusyError` containing reason, queue length, and recommended retry delay when `canHandle` rejects.
- **A5.2** Update MCP handlers (`withTimeout` paths in `src/index.ts`) to surface these hints to clients and include in `logger.mcpResponse`.
- **A5.3** Extend automated tests to cover busy-path signalling; document new behaviour in `.memory_bank/architecture/system_architecture.md`.

### ✅ Phase 6 — Documentation & Release Prep
- **A6.1** Refresh memory bank architecture pages reflecting telemetry tools, resource broadcasts, warmup behaviour, and bus tooling.
- **A6.2** Produce release notes summarising Codex-facing improvements and recommended upgrade path.
- **A6.3** Optional smoke test updates/scripts ensuring new MCP endpoints respond correctly in Codex CLI.

## Dependencies & Considerations
- Ensure new MCP tools follow existing schema registration patterns and respect timeout/resource safeguards.
- Maintain backward compatibility: default configurations should retain current behaviour if new features are disabled.
- Coordinate documentation updates with `.memory_bank` and main README to keep Codex instructions in sync.

## Success Criteria
- MCP clients can retrieve agent, semantic, and bus metrics on demand.
- Agents dynamically adjust to resource broadcasts without manual tuning.
- Semantic operations exhibit reduced cold-start latency after indexing.
- Codex users receive actionable backpressure guidance instead of generic failures.
