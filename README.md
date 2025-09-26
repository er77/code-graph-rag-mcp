# Code Graph RAG MCP Server

**Advanced Multi-Language Code Analysis with Semantic Intelligence**

A powerful [Model Context Protocol](https://github.com/modelcontextprotocol) server that creates intelligent graph representations of your codebase with comprehensive semantic analysis capabilities.

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

**Manual setup**: Add to Claude Desktop config → [See detailed instructions](docs/guides/CLAUDE_INTEGRATION.md)

### Gemini CLI Integration
```bash
# Using helper script (prints the exact gemini CLI command to run)
./scripts/GEMINI-CORRECT-CONFIG.sh

# Or manually (example)
gemini mcp add-json code-graph-rag '{
  "command": "node",
  "args": ["/home/er77/_work_fodler/code-graph-rag-mcp/dist/index.js", "/home/er77/_work_fodler/baserow-develop"]
}'
```

### Codex CLI Integration
```bash
# Using helper script (prints how to update ~/.codex/config.toml)
./scripts/CODEX-CORRECT-CONFIG.sh

# Project-scoped MCP server in ~/.codex/config.toml
[projects."/home/er77/_work_fodler/code-graph-rag-mcp".mcp_servers.code_graph_rag]
command = "node"
args = ["/home/er77/_work_fodler/code-graph-rag-mcp/dist/index.js", "/home/er77/_work_fodler/baserow-develop"]
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

### **13+ Advanced Analysis Tools**
- **Semantic code search** with natural language
- **Code similarity** and duplicate detection
- **Impact analysis** for changes
- **Refactoring suggestions** with AI
- **Hotspot analysis** and complexity metrics
- **Cross-language** relationship mapping
 - New: `get_graph_health`, `reset_graph`, `clean_index` (safe ops & diagnostics)

### **High-Performance Architecture**
- **100+ files/second** parsing throughput
- **<100ms** query response time
- **Multi-agent coordination** with resource management
- **Hardware-accelerated** vector search (optional)
 - Automatic embedding ingestion after indexing (no manual step required)
 - AST-based hotspot summaries (precise snippets + semantic context)

### **Multi-Language Support**
- **Python** ✅ - Advanced syntax, async/await, decorators
- **TypeScript/JavaScript** ✅ - Full ES6+, JSX, TSX
- **C/C++** ✅ - Functions, structs/unions/enums, classes/namespaces/templates
- **Rust** ✅ - Functions, structs, enums, traits, impls, modules, use

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
