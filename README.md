# Code Graph RAG MCP Server

[Sponsor https://accelerator.slider-ai.ru/ ]([url](https://accelerator.slider-ai.ru/))

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

**Multi-codebase support**: Analyze multiple projects simultaneously → [Multi-Codebase Setup Guide](docs/guides/MULTI_CODEBASE_SETUP.md)

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

### **13 Advanced Analysis Tools**
- **Semantic code search** with natural language
- **Code similarity** and duplicate detection
- **Impact analysis** for changes
- **Refactoring suggestions** with AI
- **Hotspot analysis** and complexity metrics
- **Cross-language** relationship mapping

### **High-Performance Architecture**
- **100+ files/second** parsing throughput
- **<100ms** query response time
- **Multi-agent coordination** with resource management
- **Hardware-accelerated** vector search (optional)

### **Multi-Language Support**
- **Python** ✅ - Advanced syntax, async/await, decorators
- **TypeScript/JavaScript** ✅ - Full ES6+, JSX, TSX
- **C/C++** 🚧 - Planned with template analysis

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

---

## 🛠️ **Usage Examples**

```bash
# Single project analysis
code-graph-rag-mcp /path/to/your/project

# Multi-project setup (see Multi-Codebase Setup Guide)
# Configure multiple projects in Claude Desktop config

# Check installation
code-graph-rag-mcp --help
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
