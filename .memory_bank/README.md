# Code Graph RAG MCP Memory Bank

## 🎯 Project Overview

**Code Graph RAG MCP** is an advanced Model Context Protocol server that creates intelligent graph representations of codebases with comprehensive semantic analysis capabilities. It provides 13 specialized analysis tools for multi-language code understanding, relationship mapping, and semantic search.

### Current Status
- **Phase**: Production Ready
- **Version**: v2.4.0
- **Last Updated**: 2025-09-23
- **Next Milestone**: Enhanced Multi-Language Support

## 🗺️ Navigation Guide

### 🧭 Quick Architecture
- [System Architecture Overview](./architecture/system_architecture.md) — big-picture map and flows
- [MCP Integration](./architecture/mcp_integration.md) — server, tools, timeouts, resilience
- [Multi-Agent Patterns](./architecture/multi_agent_patterns.md) — Conductor orchestration and agents
- [Tree-sitter Integration](./architecture/tree_sitter_integration.md) — incremental parsing + Python analyzer
- [Vector Store](./architecture/vector_store.md) — sqlite-vec primary + fallbacks, embeddings

### 📋 Project Context
- [**Product Brief**](./product_brief.md) - Technical capabilities and MCP integration
- [**Technology Stack**](./tech_stack.md) - Architecture, agents, and dependencies
- [**Current Tasks**](./current_tasks.md) - Active development board and priorities
- [**Agent System**](../AGENTS.md) - Multi-agent coordination and governance framework

### 🔄 Development Processes
- [**Development Workflow**](./workflows/development.md) - Conductor-driven development process
- [**Testing Strategy**](./workflows/testing.md) - Multi-agent testing coordination
- [**Deployment Process**](./workflows/deployment.md) - NPM publishing and distribution
- [**Agent Architecture**](./workflows/agent_coordination.md) - Multi-agent system workflows

### 🏗️ Architecture & Patterns
- [**Architectural Decisions**](./patterns/architectural_decisions.md) - ADR documentation for MCP architecture
- [**Agent Delegation**](./patterns/agent_delegation.md) - Multi-agent coordination patterns
- [**Code Analysis Patterns**](./patterns/code_analysis.md) - Entity extraction and relationship mapping
- [**Database Schema**](./patterns/database_schema.md) - SQLite graph storage design
- [**Task Tracking**](./patterns/task_tracking.md) - TASK-XXX lifecycle and coordination

### 📚 Implementation Guides
- [**MCP Tools Reference**](./guides/mcp_tools.md) - Complete 13-tool API documentation
- [**Claude Integration**](./guides/claude_integration.md) - Claude Desktop setup and configuration
- [**Performance Optimization**](./guides/performance_optimization.md) - sqlite-vec and hardware acceleration
- [**Multi-Codebase Setup**](./guides/multi_codebase_setup.md) - Analyzing multiple projects
- [**Semantic Analysis**](./guides/semantic_analysis.md) - Vector search and AI-powered code understanding
- [**Agent System Development**](./guides/agent_development.md) - Building and extending agents

### 🛠️ Troubleshooting & Operations
- [**Common Issues**](./troubleshooting/common_issues.md) - UltraFink/UltraThink integration fixes
- [**Performance Tuning**](./troubleshooting/performance_tuning.md) - Hardware optimization and scaling
- [**Database Issues**](./troubleshooting/database_issues.md) - SQLite, migrations, and graph queries
- [**Agent Coordination Issues**](./troubleshooting/agent_issues.md) - Multi-agent system debugging

### 📁 Operational Logs
- [**logs_llm/**](./logs_llm/) - Development session logs and agent coordination
  - TASK-XXX.json - Structured execution logs with agent workflows
  - TASK-XXX.log - Detailed step-by-step development traces
  - [component]_development.log - Component-specific development logs
  - mcp-integration-*.log - MCP protocol communication logs

## 🚀 Quick Start for AI Agents

### Context Priorities
1. **Agent Governance**: Always use Conductor agent for complex tasks per [AGENTS.md](./patterns/agent_delegation.md)
2. **Current Focus**: Check [Current Tasks](./current_tasks.md) for immediate priorities
3. **Technical Context**: Review [Tech Stack](./tech_stack.md) for MCP architecture constraints
4. **Architecture**: Understand [ADR documentation](./patterns/architectural_decisions.md) for core design decisions

### Development Guidelines
- **Multi-Agent Coordination**: Use Conductor for ALL complex tasks (>2 steps)
- **MCP Development**: Follow [MCP Tools Reference](./guides/mcp_tools.md) for tool integration
- **Code Analysis**: Adhere to [Code Analysis Patterns](./patterns/code_analysis.md) for entity extraction
- **Performance**: Follow [Performance Optimization](./guides/performance_optimization.md) for sqlite-vec integration

### Key Constraints
- **Node.js 18+** - Minimum runtime version
- **TypeScript ESM** - Strict ES module architecture
- **Multi-Agent System** - Conductor orchestration required
- **MCP Protocol** - JSON-RPC 2.0 communication standard
- **SQLite + Vector Extensions** - Graph storage with semantic search

## 📊 Project Metrics

### MCP Tools Portfolio (13 Tools)
- ✅ **index** - Multi-agent parsing and indexing with incremental processing
- ✅ **list_file_entities** - Entity extraction using Tree-sitter parsers
- ✅ **list_entity_relationships** - Graph traversal and relationship analysis
- ✅ **query** - Natural language and structured queries
- ✅ **semantic_search** - Vector-based natural language code search
- ✅ **find_similar_code** - Code similarity detection using semantic analysis
- ✅ **analyze_code_impact** - Impact analysis for code changes
- ✅ **detect_code_clones** - Duplicate code detection across codebase
- ✅ **suggest_refactoring** - AI-powered refactoring recommendations
- ✅ **cross_language_search** - Multi-language code pattern search
- ✅ **analyze_hotspots** - Code hotspot analysis (complexity, changes, coupling)
- ✅ **find_related_concepts** - Conceptual relationship discovery
- ✅ **get_graph/get_graph_stats** - Direct graph database access

### Multi-Agent Architecture
- ✅ **ConductorOrchestrator** - Task coordination and 5-method proposal generation
- ✅ **ParserAgent** - High-performance Tree-sitter based parsing (100+ files/second)
- ✅ **IndexerAgent** - SQLite-based graph storage and indexing
- ✅ **QueryAgent** - Graph traversal and relationship queries
- ✅ **SemanticAgent** - Vector search and semantic analysis
- ✅ **DevAgent** - Development coordination and implementation
- ✅ **DoraAgent** - Research and discovery operations

### Performance Achievements
- ✅ **5.5x faster** than native Claude tools
- ✅ **100+ files/second** parsing throughput
- ✅ **<100ms** query response for simple operations
- ✅ **<1GB** memory usage for large repositories
- ✅ **Hardware acceleration** via sqlite-vec extension

### Language Support
- ✅ **TypeScript/JavaScript** - Full AST parsing and analysis
- ✅ **Python** - Enhanced features with comprehensive entity extraction
- ✅ **C/C++** - Native support with Tree-sitter
- ✅ **Java** - Enterprise application analysis
- ✅ **Go** - Modern language support
- ✅ **Rust** - Systems programming language
- ✅ **Multi-language** - Cross-language relationship detection

## 🎯 Current Development Focus

### Immediate Priorities
1. **Memory Bank Integration** - Systematic knowledge management for MCP development
2. **Enhanced Python Support** - Advanced language-specific analysis features
3. **Agent Coordination Optimization** - Improved multi-agent task delegation
4. **Vector Search Enhancement** - Better semantic analysis and code understanding
5. **Cross-Language Relationships** - Enhanced multi-language codebase analysis

### Architecture Enhancements
- **Conductor Agent Governance** - Mandatory for all complex development tasks
- **Specialized Agent Workflows** - Clear delegation patterns for different task types
- **TASK-XXX Tracking** - Comprehensive development lifecycle management
- **ADR Documentation** - Architecture Decision Records for MCP design decisions

### Integration Features
- **Claude Desktop Integration** - Seamless MCP protocol communication
- **NPM Distribution** - Global installation and project-specific usage
- **sqlite-vec Integration** - Hardware-accelerated vector operations
- **Memory Bank Patterns** - Systematic knowledge capture for AI-assisted development

## 🔧 Development Commands

### Build & Package
```bash
# Build TypeScript
bun run tsup

# Package for NPM
make package

# Lint and format
npx biome check --apply .
```

### Testing & Validation
```bash
# Run test suite
npm test

# Test MCP integration
./test-tools.sh

# Performance testing
./test-correct-tools.sh
```

### Agent Coordination
```bash
# Always use Conductor for complex tasks
# Example: Complex feature development
use agent conductor
  implement advanced semantic search with vector optimization

# Example: Research and documentation
use agent dora
  research latest Tree-sitter language support for enhanced parsing
```

## 🔧 Maintenance Notes

### Memory Bank Updates
- **Frequency**: Updated during each development session
- **Responsibility**: AI agents following Conductor governance
- **Validation**: Automated checks during agent coordination

### Knowledge Capture
- **Architectural Decisions**: ADR-XXX documentation in `patterns/architectural_decisions.md`
- **Agent Workflows**: Multi-agent coordination patterns in `patterns/agent_delegation.md`
- **Development Processes**: MCP-specific workflows in `workflows/` directory
- **Task Tracking**: TASK-XXX lifecycle management in `current_tasks.md`
- **Technical Knowledge**: Component-specific guides in `guides/` directory

### Operational Logging Structure
- **logs_llm/TASK-XXX.json**: Structured execution logs with agent workflows
- **logs_llm/TASK-XXX.log**: Human-readable agent coordination traces
- **logs_llm/[component]_development.log**: Component-specific development logs
- **logs_llm/mcp-integration-*.log**: MCP protocol communication debugging
- **Integration**: Operational logs support strategic memory bank knowledge

### Agent Coordination
- **Conductor Orchestration**: ALL complex tasks (>2 steps) require Conductor agent
- **Specialized Delegation**: Parser/indexing work to specialized agents
- **Research Coordination**: Dora agent for comprehensive research and documentation
- **Development Coordination**: DevAgent for implementation work
- **Task Validation**: TASK-XXX identifiers for complete traceability

## 🌟 Key Features

### Advanced Code Analysis
- **Multi-Language Support**: Tree-sitter based parsing for 6+ languages
- **Semantic Understanding**: Vector-based code similarity and search
- **Relationship Mapping**: Comprehensive entity relationship analysis
- **Cross-Project Analysis**: Multi-codebase support with unified querying

### High-Performance Architecture
- **Multi-Agent System**: Specialized agents for different analysis tasks
- **Hardware Acceleration**: sqlite-vec extension for vector operations
- **Incremental Processing**: Efficient handling of large codebases
- **Memory Optimization**: <1GB usage for enterprise repositories

### MCP Integration Excellence
- **13 Specialized Tools**: Comprehensive MCP tool portfolio
- **Claude Desktop Ready**: Seamless integration with Claude Desktop
- **JSON-RPC 2.0**: Standards-compliant MCP protocol implementation
- **Resource Management**: Optimized for commodity hardware

### Development Excellence
- **Conductor Agent System**: Intelligent task orchestration with method proposals
- **Memory Bank System**: Systematic knowledge management for AI development
- **TASK-XXX Tracking**: Complete development lifecycle traceability
- **Quality Assurance**: Multi-agent testing and validation

---

*This Memory Bank serves as the single source of truth for the Code Graph RAG MCP project. All AI agents and team members must consult and update this knowledge base during development activities, following Conductor agent governance for complex tasks.*

**Last Updated**: 2025-01-22 | **Next Review**: 2025-02-15
