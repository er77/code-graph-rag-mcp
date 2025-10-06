# Code Graph RAG MCP Server

[![npm version](https://badge.fury.io/js/@er77%2Fcode-graph-rag-mcp.svg)](https://www.npmjs.com/package/@er77/code-graph-rag-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

[Sponsor https://accelerator.slider-ai.ru/ ](https://accelerator.slider-ai.ru/)

**Advanced Multi-Language Code Analysis with Semantic Intelligence**

A powerful [Model Context Protocol](https://github.com/modelcontextprotocol) server that creates intelligent graph representations of your codebase with comprehensive semantic analysis capabilities.

**🌟 10 Languages Supported** | **⚡ 5.5x Faster** | **🔍 Semantic Search** | **📊 13+ Analysis Tools**

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
| Features | Basic patterns | 13 tools | **Comprehensive** |
| Accuracy | Pattern-based | Semantic | **Superior** |

---

## 🔍 **Key Features**

### **🔬 Advanced Analysis Tools (13+)**

| Feature | Description | Use Case |
|---------|-------------|----------|
| **Semantic Search** | Natural language code search | "Find authentication functions" |
| **Code Similarity** | Duplicate & clone detection | Identify refactoring opportunities |
| **Impact Analysis** | Change impact prediction | Assess modification risks |
| **AI Refactoring** | Intelligent code suggestions | Improve code quality |
| **Hotspot Analysis** | Complexity & coupling metrics | Find problem areas |
| **Cross-Language** | Multi-language relationships | Polyglot codebases |
| **Graph Health** | Database diagnostics | `get_graph_health` |
| **Safe Reset** | Clean reindexing | `reset_graph`, `clean_index` |

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

## 📚 **Documentation**

| Guide | Description |
|-------|-------------|
| [Claude Integration](docs/guides/CLAUDE_INTEGRATION.md) | Complete setup guide for Claude Desktop |
| [Multi-Codebase Setup](docs/guides/MULTI_CODEBASE_SETUP.md) | Analyze multiple projects simultaneously |
| [Performance Guide](docs/guides/PERFORMANCE_GUIDE.md) | Optimization and sqlite-vec setup |
| [MCP Tools Reference](docs/guides/MCP_TOOLS.md) | Complete tool documentation |
| [Development Guide](docs/AGENTS.md) | Agent governance and workflow |
| [Troubleshooting](docs/guides/TROUBLESHOOTING.md) | Common issues and solutions |
| [Gemini CLI Setup](scripts/GEMINI-CORRECT-CONFIG.sh) | Helper script for Gemini configuration |
| [Codex CLI Setup](scripts/CODEX-CORRECT-CONFIG.sh) | Helper script for Codex CLI configuration |

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

# Relationships for an entity name
list_entity_relationships (entityName: "YourEntity", relationshipTypes: ["imports"]) 
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

## 📋 **Changelog**

### Version 2.5.4 (2025-10-06)

#### 📚 **Documentation Updates**
- **Architecture Decision Records**: Created comprehensive ADR system
  - ADR-003: Multi-Language Expansion (10 languages)
  - ADR-004: GraphStorage Singleton Pattern
  - ADR-005: Python Type Enhancements
  - ADR-INDEX: Complete ADR catalog and templates
- **Updated Technical Docs**: System architecture, memory bank README, language support guide
- **Corrected Dates**: Fixed version dates to October 2025

### Version 2.5.3 (2025-10-06)

#### 🔧 **Fixes**
- **Suppressed deprecated dependency warning**: Added npm override for `boolean@3.2.0` (transitive dependency from optional ML package)
- **Documented known issues**: Added Known Issues section explaining the deprecated package warning
- **No functional changes**: Core functionality unaffected

### Version 2.5.2 (2025-10-06)

#### 📚 **Documentation**
- **Enhanced README**: Added npm badges, feature tables, and language support matrix
- **Better visualization**: Structured tables for features, architecture metrics, and capabilities
- **Fixed examples**: Updated Gemini/Codex integration examples to use generic npx commands
- **Corrected dates**: Fixed version release dates

### Version 2.5.1 (2025-10-06)

#### ✨ **Enhancements**
- **Enhanced Python Magic Methods**: Added comprehensive type system for 40+ Python magic methods
- **Improved Import Analysis**: Added type classification (import/from_import), module tracking, and local/external detection
- **Better Test Infrastructure**: ESM module support with cross-platform compatibility via cross-env
- **Granular Performance Metrics**: Enhanced metrics for relationship mapping and pattern recognition
- **Async Pattern Detection**: Added awaitCount, yieldCount, and generator type tracking

#### 🔧 **Technical Improvements**
- Updated to TypeScript 5.9.2 for better type checking
- Upgraded Jest to 29.7.0 with ESM support
- Latest ML libraries (@xenova/transformers 2.17.2, onnxruntime-node 1.23.0)
- Sponsor link added to README

#### 📦 **Dependencies**
- cross-env: ^10.1.0 (new - cross-platform environment variables)
- @types/jest: ^29.5.14 (updated from ^29.0.0)
- jest: ^29.7.0 (updated from ^29.0.0)
- ts-jest: ^29.4.4 (updated from ^29.0.0)
- typescript: ^5.9.2 (updated from ^5.0.0)

### Version 2.5.0 (2025-10-05)

#### ✨ **Major Features**
- **8 New Languages**: Added comprehensive support for C#, Rust, C, C++, Go, Java, and VBA
- **Enhanced Research Trinity**: Multi-agent circular bug detection with mcp-agent-codex
- **Agent System Integration**: Complete GRACE framework with 5 specialized agents
- **Circuit Breaker Protection**: 50-level recursion limit and 5s timeout across all analyzers

#### 🏗️ **Architecture**
- **GraphStorage Factory Pattern**: Centralized singleton management preventing state isolation bugs
- **Language-Specific Analyzers**: Dedicated analyzers for each language with 80-95% accuracy
- **VBA Regex Parser**: Special handling for languages without tree-sitter support
- **Protocol Enforcement**: Multi-layer protection system with mandatory Conductor orchestration

#### 🐛 **Bug Fixes**
- Fixed circular bug where entity extraction succeeded but queries returned empty results
- Resolved multiple GraphStorageImpl instance issue via factory pattern
- Fixed C++ relationship type validation ("member_of" → "contains", "uses" → "references")
- Corrected database singleton usage in ConnectionPool and IndexerAgent

#### 📚 **Documentation**
- New AGENTS.md with comprehensive multi-agent governance
- Updated language support documentation with all 10 languages
- Enhanced circular bug detection protocols
- Added governance violation tracking

### Version 2.4.1 (2025-09-23)

#### ✨ Improvements
- Added Rust AST parsing support (fn/struct/enum/trait/impl/mod/use)
- Solidified C/C++ extraction and updated parser docs
- New System Architecture overview doc with quick links
- WASM grammar setup notes for web-tree-sitter

#### 📚 Docs & UX
- Updated README multi-language support
- Internal architecture docs refreshed to v2.4.0/2.4.1

### Version 2.4.0 (2025-09-23)

#### ✨ New Features
- New MCP tools: `get_graph_health`, `reset_graph`, `clean_index` for health checks and safe maintenance.
- AST-based hotspot analysis: precise code snippets with semantic summaries.
- Automatic embedding ingestion after indexing (no manual step required).
- Direct semantic method routing for `semantic_search`, `find_similar_code`, `cross_language_search`, `suggest_refactoring`.
- `find_related_concepts` now returns snippet-based semantic neighbors.
- Helper scripts for client setup: Gemini (`scripts/GEMINI-CORRECT-CONFIG.sh`) and Codex (`scripts/CODEX-CORRECT-CONFIG.sh`).

#### 🧩 Reliability & UX
- Robust fallbacks for advanced queries:
  - `analyze_hotspots`: falls back to `query:analysis` if direct method unavailable.
  - `analyze_code_impact`: falls back to `query:analysis` when needed.
- Reuse agents by type to avoid pool exhaustion; increased default agent concurrency.
- External placeholder entities ensure relationships are persisted (FK-safe).

#### 🐞 Fixes & Improvements
- Fixed MCP graph query tool to use storage API correctly (no silent empties).
- Fixed duplicate handler cases and tightened task routing across agents.
- Added smoke scripts for quick checks (`smoke`, `smoke:clean`, `smoke:semantic`).

### Version 2.3.3 (2025-09-22)

#### 🐛 **Critical Bug Fixes**
- **Fixed Entity Extraction**: Resolved issue where indexing processed files but extracted 0 entities
  - DevAgent now creates real entities (files, modules, classes, functions) instead of mock data
  - IndexerAgent properly returns statistics (`entitiesIndexed`, `relationshipsCreated`)
  - Conductor preserves original task types when delegating to agents

#### 📊 **Performance Improvements**
- **Massively improved entity extraction**: From 0 entities → 4,467 entities on 1,956 files
- Batch processing optimized for large codebases (50 files per batch)
- Memory usage remains stable even with large codebases

#### ✅ **Test Results**
- Small codebase (13 files): 35 entities extracted
- Medium codebase (41 files): 123 entities extracted
- Large codebase (1,956 files): **4,467 entities extracted** 🚀

#### 🔧 **Technical Details**
- Fixed DevAgent's `performRealIndexing` method to generate meaningful entities
- Updated IndexerAgent to properly track and return indexing statistics
- Modified Conductor to preserve "index" task type through delegation chain
- Entity types now include: file, module, class, and function entities
- **Added Graph Query Tools**:
  - New `get_graph` tool for direct database queries to retrieve entities and relationships
  - New `get_graph_stats` tool for getting comprehensive graph statistics
  - Created `graph-query.ts` module for direct SQLite database access
  - Fixed disconnect between entity storage and graph visualization

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
