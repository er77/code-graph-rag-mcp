# System Architecture Overview (v2.4.0)

## 🎯 Purpose
A high-level map of the Code Graph RAG MCP server: components, data flows, and how to navigate deeper docs. Links to MCP, parser, vector store, and multi‑agent architecture pages.

## 🗺️ Big Picture

```mermaid
flowchart LR
  subgraph Clients
    C1[Claude Desktop]
    C2[Gemini CLI]
    C3[Codex CLI]
  end

  C1<-->S
  C2<-->S
  C3<-->S

  subgraph MCP Server
    S[MCP Server (stdio)]
    T[Tools + Zod Schemas]
    S-- list/call -->T
    S-- delegate -->K
  end

  subgraph Orchestration
    K[Conductor\n(approval + delegation)]
  end

  subgraph Agents
    A1[DevAgent]
    A2[QueryAgent]
    A3[SemanticAgent]
    A4[IndexerAgent]
    A5[ParserAgent\n(optional)]
    A6[DoraAgent]
  end

  K-->A1 & A2 & A3 & A4 & A5 & A6

  subgraph Storage
    G[(SQLite Graph\nentities/relationships/files)]
    V[(Vector Store\nsqlite-vec or BLOB)]
  end

  A4<-->G
  A2<-->G
  A3<-->V
  A1<-->G

  subgraph Infra
    Y[YAML Config]
    L[Rotated Logs]
    R[Resource Manager]
    B[Knowledge Bus]
  end

  S-->L
  K-->L
  A1-->L
  A2-->L
  A3-->L
  A4-->L
  A5-->L
  A6-->L
  S-->Y
  K-->B
  A1-->B
  A2-->B
  A3-->B
```

## 🔧 Components
- MCP Server: exposes ~13 tools, validates inputs, enforces timeouts.
- Conductor: mandatory delegation, method proposals + complexity scoring.
- Agents:
  - Indexer: persists entities/relationships to SQLite (singleton GraphStorage).
  - Query: traversals, subgraphs, hotspots, dependencies.
  - Semantic: embeddings + hybrid search (circuit breaker, sqlite-vec).
  - Dev: implementation/indexing orchestration; parser fallback scaffolding.
  - Parser: web-tree-sitter incremental parsing (optional on constrained envs).
  - Dora: research/documentation.
- Storage: SQLite (entities/relationships/files), Vector DB (sqlite-vec virtual table or BLOB fallback).
- Infra: YAML config loader; rotated logs; resource monitoring; knowledge bus (pub/sub).

## 🔄 Key Flows
- Indexing
  1) Client calls `index` → Conductor → DevAgent → IndexerAgent
  2) ParserAgent (if enabled) provides AST entities; otherwise DevAgent heuristic fallback creates minimal entities
  3) Graph persisted; semantic ingestion publishes `semantic:new_entities` to queue embeddings

- Query
  1) Client calls `query` → SemanticAgent (semantic_search) or QueryAgent (structural)
  2) Results combined/cached; timeouts enforce responsiveness

- Semantic
  1) Embeddings via transformers (384d) or fallback deterministic vectors
  2) Search via sqlite-vec; fallback cosine similarity on BLOBs
  3) Circuit breaker returns degraded results when backends fail

- Health & Maintenance
  - Tools: `get_graph_stats`, `get_graph_health`, `reset_graph`, `clean_index`
  - Smoke scripts: `scripts/smoke-graph-health.js`, `scripts/smoke-semantic.js`

## ⚙️ Configuration & Logging
- YAML config with ENV fallbacks: `src/config/yaml-config.ts`, `config/*.yaml`
- Logs under `logs_llm/` using categories (SYSTEM, MCP_REQUEST, MCP_ERROR, …)

## 📚 Deep Dives
- MCP Integration: .memory_bank/architecture/mcp_integration.md
- Multi‑Agent Patterns: .memory_bank/architecture/multi_agent_patterns.md
- Tree‑sitter Integration: .memory_bank/architecture/tree_sitter_integration.md
- Vector Store: .memory_bank/architecture/vector_store.md

## 🔗 Code References
- Server/tools: `src/index.ts`
- Conductor: `src/agents/conductor-orchestrator.ts`
- Agents: `src/agents/*.ts`
- Graph storage (singleton): `src/storage/graph-storage-factory.ts`, `src/storage/graph-storage.ts`
- Semantic: `src/semantic/*.ts`
- Knowledge bus / resources: `src/core/*.ts`

Document version: 2.4.0 • Last updated: 2025-09-23

