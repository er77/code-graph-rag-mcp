# Code Graph RAG MCP Server

[![npm version](https://badge.fury.io/js/@er77%2Fcode-graph-rag-mcp.svg)](https://www.npmjs.com/package/@er77/code-graph-rag-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

[Sponsor https://accelerator.slider-ai.ru/ ](https://t.me/SliderQuery)

**Advanced Multi-Language Code Analysis with Semantic Intelligence**

A powerful [Model Context Protocol](https://github.com/modelcontextprotocol) server that creates intelligent graph representations of your codebase with comprehensive semantic analysis capabilities.

**🌟 10 Languages Supported** | **⚡ 5.5x Faster** | **🔍 Semantic Search** | **📊 14+ Analysis Tools**

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

### **🔬 Advanced Analysis Tools (14+)**

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
| [**Restart Server Script**](scripts/restart-mcp-server.sh) | **Utility to restart MCP server processes** |

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

### 🎉 Version 2.5.9 (2025-10-06) - **100% Success Rate**

**All 17 MCP methods working perfectly!** ✅

- ✅ **Complete vector schema fix**: Fixed `fallbackSearchWithFilters()` to handle both sqlite-vec and fallback schemas
- ✅ **4 semantic methods now fully functional**: `find_similar_code`, `suggest_refactoring`, `cross_language_search`, `find_related_concepts`
- ✅ **Verified 100% success**: All 17/17 MCP codegraph methods tested without errors
- 📈 **Success rate**: 33% (v2.5.7) → 61% (v2.5.8) → **100% (v2.5.9)**

### Version 2.5.8 (2025-10-06) - Critical Infrastructure Fixes

- ✅ **Fixed agent concurrency limit**: 3 → 10 concurrent agents (fixes 4 methods)
- ✅ **Fixed vector database schema**: Dual-schema support for sqlite-vec extension
- 📈 **Success rate improvement**: 33% → 61%+

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

[**Full Changelog →**](https://github.com/er77/code-graph-rag-mcp/blob/master/CHANGELOG.md)

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
