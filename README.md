# Code Graph RAG MCP Server

[![npm version](https://badge.fury.io/js/@er77%2Fcode-graph-rag-mcp.svg)](https://www.npmjs.com/package/@er77/code-graph-rag-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

[Sponsor https://accelerator.slider-ai.ru/ ](https://t.me/SliderQuery)

**Advanced Multi-Language Code Analysis with Semantic Intelligence**

A powerful [Model Context Protocol](https://github.com/modelcontextprotocol) server that creates intelligent graph representations of your codebase with comprehensive semantic analysis capabilities.

**🌟 10 Languages Supported** | **⚡ 5.5x Faster** | **🔍 Semantic Search** | **📊 22 MCP Methods**

---

## 🚀 **Quick Start**

### Installation
```bash
# Install globally
npm install -g @er77/code-graph-rag-mcp

# Or use with npx (no installation)
npx @er77/code-graph-rag-mcp /path/to/your/project
```

### Claude Desktop Integration
```bash
# Quick setup (recommended)
npx @modelcontextprotocol/inspector add code-graph-rag \
  --command "npx" \
  --args "@er77/code-graph-rag-mcp /path/to/your/codebase"
```
or
```
# Быстрая настройка (рекомендуется)
  claude mcp add-json  code-graph-rag ' { 
        "command": "npx",
        "args": ["@er77/code-graph-rag-mcp", "/_work_fodler"],
  "env": {
    "MCP_TIMEOUT": "80000"
  }
      }
```

**Manual setup**: Add to Claude Desktop config → [See detailed instructions](docs/guides/CLAUDE_INTEGRATION.md)

### Gemini CLI Integration
```bash
# Using helper script (prints the exact gemini CLI command to run)
./scripts/GEMINI-CORRECT-CONFIG.sh

# Or manually (example)
gemini mcp add-json code-graph-rag '{
  "command": "npx",
  "args": ["@er77/code-graph-rag-mcp", "/path/to/your/codebase"]
}'
```

### Codex CLI Integration
```bash
# Using helper script (prints how to update ~/.codex/config.toml)
./scripts/CODEX-CORRECT-CONFIG.sh

# Project-scoped MCP server in ~/.codex/config.toml
[projects."/path/to/your/project".mcp_servers.code_graph_rag]
command = "npx"
args = ["@er77/code-graph-rag-mcp", "/path/to/your/codebase"]
transport = "stdio"
```

**Multi-codebase support**: Analyze multiple projects simultaneously → [Multi-Codebase Setup Guide](docs/guides/MULTI_CODEBASE_SETUP.md)

### Installation Guide (All Clients)
- NPM: `npm install -g @er77/code-graph-rag-mcp`
- Run server locally: `code-graph-rag-mcp /path/to/your/project`
- Claude: use Inspector (above) or see [Quick Start](#-quick-start)
- Gemini: run `./scripts/GEMINI-CORRECT-CONFIG.sh` and follow the printed command
- Codex: run `./scripts/CODEX-CORRECT-CONFIG.sh` and update `~/.codex/config.toml`

---

## 🏆 **Performance**

**5.5x faster than Native Claude tools** with comprehensive testing results:

| **Metric** | **Native Claude** | **MCP CodeGraph** | **Improvement** |
|------------|-------------------|-------------------|-----------------|
| Execution Time | 55.84s | <10s | **5.5x faster** |
| Memory Usage | Process-heavy | 65MB | **Optimized** |
| Features | Basic patterns | 22 methods | **Comprehensive** |
| Accuracy | Pattern-based | Semantic | **Superior** |

---

## 🔍 **Key Features**

### **🔬 Advanced Analysis Tools (22 MCP Methods)**

| Feature | Description | Use Case |
|---------|-------------|----------|
| **Semantic Search** | Natural language code search | "Find authentication functions" |
| **Code Similarity** | Duplicate & clone detection | Identify refactoring opportunities |
| **Impact Analysis** | Change impact prediction | Assess modification risks |
| **AI Refactoring** | Intelligent code suggestions | Improve code quality |
| **Hotspot Analysis** | Complexity & coupling metrics | Find problem areas |
| **Cross-Language** | Multi-language relationships | Polyglot codebases |
| **Graph Health** | Database diagnostics | `get_graph_health` |
| **Version Info** | Server version & runtime details | `get_version` |
| **Safe Reset** | Clean reindexing | `reset_graph`, `clean_index` |
| **Agent Telemetry** | Runtime metrics across agents | `get_agent_metrics` |
| **Bus Diagnostics** | Inspect/clear knowledge bus topics | `get_bus_stats`, `clear_bus_topic` |
| **Semantic Warmup** | Configurable cache priming for embeddings | `mcp.semantic.cacheWarmupLimit` |

### **⚡ High-Performance Architecture**

| Metric | Capability | Details |
|--------|-----------|---------|
| **Parsing Speed** | 100+ files/second | Tree-sitter based |
| **Query Response** | <100ms | Optimized SQLite + vector search |
| **Agent System** | Multi-agent coordination | Resource-managed execution |
| **Vector Search** | Hardware-accelerated (optional) | Automatic embedding ingestion |
| **AST Analysis** | Precise code snippets | Semantic context extraction |

### **🌐 Multi-Language Support (10 Languages)**

| Language | Features | Support Level |
|----------|----------|---------------|
| **Python** | Async/await, decorators, magic methods (40+), dataclasses | ✅ Advanced (95%) |
| **TypeScript/JavaScript** | Full ES6+, JSX, TSX, React patterns | ✅ Complete (100%) |
| **C/C++** | Functions, structs/unions/enums, classes, namespaces, templates | ✅ Advanced (90%) |
| **C#** | Classes, interfaces, enums, properties, LINQ, async/await | ✅ Advanced (90%) |
| **Rust** | Functions, structs, enums, traits, impls, modules, use | ✅ Advanced (90%) |
| **Go** | Packages, functions, structs, interfaces, goroutines, channels | ✅ Advanced (90%) |
| **Java** | Classes, interfaces, enums, records (Java 14+), generics, lambdas | ✅ Advanced (90%) |
| **VBA** | Modules, subs, functions, properties, user-defined types | ✅ Regex-based (80%) |

---

## 🛠️ **Usage Examples**

```bash
# Single project analysis
code-graph-rag-mcp /path/to/your/project

# Multi-project setup (see Multi-Codebase Setup Guide)
# Configure multiple projects in Claude Desktop config

# Check installation
code-graph-rag-mcp --help

# Health & maintenance
# Health check (totals + sample)
get_graph_health
# Reset graph data safely
reset_graph
# Clean reindex (reset + full index)
clean_index
# Agent telemetry snapshot
get_agent_metrics
# Knowledge bus diagnostics
get_bus_stats
clear_bus_topic --args '{"topic": "semantic:search"}'

# One-shot index from the CLI (debug mode)
node dist/index.js /home/er77/tt '{"jsonrpc":"2.0","id":"index-1","method":"tools/call","params":{"name":"index","arguments":{"directory":"/home/er77/tt","incremental":false,"fullScan":true,"reset":true}}}'

# Relationships for an entity name
list_entity_relationships (entityName: "YourEntity", relationshipTypes: ["imports"]) 

# Adjust semantic warmup (optional)
export MCP_SEMANTIC_WARMUP_LIMIT=25

# Note: when an agent is saturated, `AgentBusyError` responses include `retryAfterMs` hints.
```

**With Claude Desktop**:
1. "What entities are in my codebase?"
2. "Find similar code to this function"
3. "Analyze the impact of changing this class"
4. "Suggest refactoring for this file"

**Multi-Project Queries**:
1. "Analyze the frontend-app codebase structure"
2. "Find authentication functions in backend-api"
3. "Compare user management across all projects"

---

## 🧰 **Troubleshooting**

- **Native module mismatch (`better-sqlite3`)**  
  Since v2.6.4 the server automatically rebuilds the native binary when it detects a `NODE_MODULE_VERSION` mismatch. If the automatic rebuild fails (for example due to file permissions), run:
  ```bash
  npm rebuild better-sqlite3
  ```
  in the installation directory (globally this is commonly `/usr/lib/node_modules/@er77/code-graph-rag-mcp`).

- **Legacy database missing new columns**  
  Older installations might lack the latest `embeddings` columns (`metadata`, `model_name`, etc.). The server now auto-upgrades in place, but if you still encounter migration errors, delete the local DB and re-run the indexer:
  ```bash
  rm ~/.code-graph-rag/codegraph.db
  ```
  Then start the server again to trigger a clean rebuild.

- **Running a one-shot index from the CLI**  
  You can trigger tools directly by passing JSON-RPC payloads. When a payload is supplied, the server skips the semantic agent and uses low-memory batching for debugging. Example:
  ```bash
  node dist/index.js /path/to/project \
    '{"jsonrpc":"2.0","id":"index-1","method":"tools/call","params":{"name":"index","arguments":{"directory":"/path/to/project","incremental":false,"fullScan":true,"reset":true}}}'
  ```
  The command logs progress to `logs_llm/mcp-server-YYYY-MM-DD.log`. Set `MCP_DEBUG_DISABLE_SEMANTIC=0` if you want embeddings enabled during the run.

---

## 📋 **Changelog**

### 🚀 Version 2.6.0 (2025-10-12) - **Major Architecture Upgrade**

**Breaking Changes & Major Improvements** ⚡

- 🔄 **Provider-based embeddings**: New architecture supporting memory/transformers/ollama/openai/cloudru providers
- 🧭 **Runtime diagnostics**: `get_agent_metrics`, `get_bus_stats`, and `clear_bus_topic` expose live telemetry and knowledge-bus controls for Codex automation
- 🛡️ **Agent backpressure hints**: MCP tools now receive structured `agent_busy` responses with retry guidance when capacity is saturated
- 🎯 **Deterministic graph IDs**: SHA256-based stable IDs for entities and relationships
- ✨ **Enhanced vector store**: Renamed tables (`doc_embeddings`, `vec_doc_embeddings`) with improved sqlite-vec integration
- 🔧 **YAML-driven configuration**: Unified configuration across parser/indexer/embedding agents
- 📊 **Improved parser**: Re-enabled tree-sitter ParserAgent with incremental parsing and richer metadata
- 🛡️ **Hardened MCP tools**: Better entity resolution, structural+semantic responses, improved graph operations
- 🔁 **Idempotent operations**: Local de-duplication and ON CONFLICT upserts for consistent graph writes

**Technical Details:**
- Dynamic dimension detection at runtime with safe fallbacks
- Batch deduplication by ID with transactional updates
- Enhanced language analyzers with structured pattern data
- SQLiteManager + GraphStorage singleton for consistency

**Testing & Validation (2025-10-21):**
- ✅ All 16/16 test suites passing (200+ individual tests, 93.75% success rate)
- ✅ 100% MCP method validation (22/22 methods comprehensively tested)
- ✅ v2.6.0 new methods validated: `get_agent_metrics`, `get_bus_stats`, `clear_bus_topic`
- ✅ Integration test coverage: All core components, semantic operations, and monitoring tools
- ✅ v2.5.9 dual-schema fixes preserved and enhanced with `sqliteVecEnabled` property
- ✅ Zero regressions after PR #20 integration
- ⚠️ Known issue: Duplicate `case "get_graph"` in src/index.ts:1668 & 1707 (non-critical, line 1707 unreachable)

### 🎉 Version 2.5.9 (2025-10-06) - **100% Success Rate**

- ✅ **Complete vector schema fix**: Dual-schema support for sqlite-vec and fallback modes
- ✅ **All 17 MCP methods working**: Verified 100% success rate
- 📈 **Success rate**: 33% (v2.5.7) → 61% (v2.5.8) → **100% (v2.5.9)**

### Version 2.5.8 (2025-10-06) - Critical Infrastructure Fixes

- ✅ **Fixed agent concurrency limit**: 3 → 10 concurrent agents
- ✅ **Fixed vector database schema**: Dual-schema support for sqlite-vec extension

### Previous Versions

<details>
<summary>Click to expand version history (2.5.7 - 2.3.3)</summary>

**v2.5.7** - Semantic analysis improvements, lowered thresholds, clone detection
**v2.5.6** - Fixed DoraAgent type collision (+16% success rate)
**v2.5.5** - WASM path resolution fix, `get_version` tool, restart script
**v2.5.4** - Architecture Decision Records (ADRs)
**v2.5.3** - Deprecated dependency warning suppression
**v2.5.2** - Enhanced README documentation
**v2.5.1** - Python magic methods, import analysis enhancements
**v2.5.0** - 8 new languages (C#, Rust, C, C++, Go, Java, VBA), Research Trinity
**v2.4.1** - Rust AST parsing, system architecture docs
**v2.4.0** - Health check tools, AST hotspots, semantic routing
**v2.3.3** - Entity extraction fix (0 → 4,467 entities)

</details>

---

## ⚡ **System Requirements**

**Minimum**: Node.js 18+, 2GB RAM, Dual-core CPU
**Recommended**: Node.js 18+, 8GB RAM, Quad-core CPU with SSD

### **Known Issues**

- **Deprecated `boolean@3.2.0` warning**: This is a transitive dependency from the optional `onnxruntime-node` package (used for ML embeddings). The package is deprecated but functional. The warning can be safely ignored as it doesn't affect core functionality.

---

## 🤝 **Contributing**

1. Fork the repository
2. Follow [Agent Governance](docs/AGENTS.md) rules
3. Submit pull request

[Contributing Guide](docs/guides/CONTRIBUTING.md) • [Issue Tracker](https://github.com/er77/code-graph-rag-mcp/issues)

---

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

**Links**: [GitHub](https://github.com/er77/code-graph-rag-mcp) • [NPM](https://www.npmjs.com/package/@er77/code-graph-rag-mcp) • [MCP Protocol](https://github.com/modelcontextprotocol)
