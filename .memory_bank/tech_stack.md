# Code Graph RAG MCP - Technology Stack

## 🏗️ Architecture Overview

Code Graph RAG MCP is built on a multi-agent architecture with specialized components for code analysis, graph storage, and semantic understanding. The system follows MCP protocol standards for AI assistant integration.

### Core Architecture Principles
- **Multi-Agent Coordination**: Conductor-orchestrated task delegation
- **Graph-Based Storage**: Relationship-aware data management
- **High-Performance Parsing**: Tree-sitter based multi-language analysis
- **Vector Search Integration**: Semantic code understanding
- **MCP Protocol Compliance**: Standards-based AI assistant integration

## 🔧 Core Technology Stack

### Runtime & Language
- **Node.js 18+** - JavaScript runtime with ES module support
- **TypeScript 5.x** - Strict type checking and ES module compilation
- **ESM Architecture** - Native ES modules throughout the stack
- **Bun Runtime** - Alternative high-performance JavaScript runtime

### MCP & Protocol Layer
- **@modelcontextprotocol/sdk** - Official MCP SDK for server implementation
- **JSON-RPC 2.0** - Standard protocol for AI assistant communication
- **StdioServerTransport** - Standard I/O transport for Claude Desktop
- **Protocol Validation** - Zod-based request/response validation

### Database & Storage
- **better-sqlite3** - High-performance synchronous SQLite bindings
- **sqlite-vec v0.1.6** - Vector similarity search extension (optional)
- **WAL Mode** - Write-Ahead Logging for concurrent read/write operations
- **Connection Pooling** - Efficient database connection management
- **Schema Migrations** - Versioned database schema evolution

### Code Analysis & Parsing
- **Tree-sitter** - Incremental parsing library for syntax analysis
- **web-tree-sitter** - WebAssembly Tree-sitter bindings for Node.js
- **Language Grammars** - Multiple programming language support
- **AST Processing** - Abstract Syntax Tree analysis and entity extraction
- **Incremental Updates** - Efficient re-parsing for changed files

### Build & Development Tools
- **tsup** - TypeScript build tool with ES module support
- **Biome** - Fast linting and formatting tool
- **Jest** - Testing framework with TypeScript support
- **npm/bun** - Package management and distribution
- **Make** - Build automation and packaging

## 🤖 Multi-Agent Architecture

### Agent Framework
- **BaseAgent** - Abstract base class with lifecycle management
- **AgentStatus** - State management (IDLE, WORKING, ERROR)
- **AgentCapabilities** - Performance and concurrency limits
- **EventEmitter** - Inter-agent communication patterns

### Specialized Agents

#### ConductorOrchestrator
- **Role**: Task coordination and delegation
- **Capabilities**: 5-method proposal generation, complexity assessment
- **Dependencies**: All other agents for delegation
- **Key Features**: Approval workflows, TASK-XXX tracking

#### ParserAgent  
- **Role**: Code parsing and entity extraction
- **Technology**: Tree-sitter, incremental parsing
- **Performance**: 100+ files/second throughput
- **Languages**: TypeScript, JavaScript, Python, C/C++, Java, Go, Rust

#### IndexerAgent
- **Role**: Graph storage and database management
- **Technology**: SQLite, better-sqlite3, schema migrations
- **Features**: Batch operations, transaction management
- **Performance**: Optimized for large codebases

#### QueryAgent
- **Role**: Graph traversal and relationship queries
- **Technology**: SQL query optimization, connection pooling
- **Features**: Complex graph queries, performance caching
- **Concurrency**: Multi-query support with pooling

#### SemanticAgent
- **Role**: Vector search and semantic analysis
- **Technology**: sqlite-vec, embedding generation
- **Features**: Code similarity, concept relationships
- **Performance**: Hardware-accelerated vector operations

#### DevAgent
- **Role**: Development coordination and implementation
- **Features**: Multi-step task execution, code generation
- **Integration**: Works with all specialized agents
- **Capabilities**: File operations, testing coordination

#### DoraAgent
- **Role**: Research and discovery operations
- **Features**: Information gathering, analysis synthesis
- **Use Cases**: Technology research, documentation generation
- **Integration**: Knowledge base updates, report generation

### Communication Infrastructure
- **KnowledgeBus** - Central event-driven communication system
- **ResourceManager** - CPU and memory monitoring with throttling
- **TaskQueue** - Priority-based task scheduling
- **EventSystem** - Pub/sub messaging between agents

## 🗄️ Data Architecture

### Graph Database Schema
```sql
-- Core entity storage
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  location TEXT NOT NULL,  -- JSON: {start, end}
  metadata TEXT,           -- JSON: language-specific data
  hash TEXT NOT NULL,
  complexity_score INTEGER DEFAULT 0,
  language TEXT,
  size_bytes INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Relationship mapping
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  metadata TEXT,           -- JSON: context data
  weight REAL DEFAULT 1.0,
  created_at INTEGER,
  FOREIGN KEY (from_id) REFERENCES entities(id),
  FOREIGN KEY (to_id) REFERENCES entities(id)
);

-- Vector embeddings (optional with sqlite-vec)
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  content TEXT NOT NULL,
  vector_data BLOB,
  model_name TEXT NOT NULL DEFAULT 'default',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);
```

### Performance Optimizations
- **Compound Indexes** - Multi-column indexes for common query patterns
- **FTS5 Integration** - Full-text search for entity names and metadata
- **Query Cache** - LRU caching for expensive operations
- **Connection Pooling** - Efficient database connection reuse
- **Pragma Optimization** - SQLite performance tuning

## 🔍 Analysis Capabilities

### Entity Types Supported
- **file** - Source code files
- **module** - Module/namespace declarations
- **class** - Class definitions
- **interface** - Interface/trait definitions
- **function** - Function/method definitions
- **variable** - Variable declarations
- **import** - Import/dependency statements
- **export** - Export declarations

### Relationship Types
- **imports** - Module import relationships
- **extends** - Inheritance relationships
- **implements** - Interface implementation
- **calls** - Function call relationships
- **uses** - Variable/property usage
- **contains** - Containment relationships
- **defines** - Definition relationships

### Language-Specific Features

#### TypeScript/JavaScript
- **Advanced AST parsing** with Tree-sitter
- **Module system analysis** (ES6, CommonJS)
- **Type relationship extraction**
- **Decorator and annotation support**

#### Python
- **Enhanced entity extraction** with class/function analysis
- **Import system mapping** (absolute, relative imports)
- **Decorator pattern recognition**
- **Module structure analysis**

#### C/C++
- **Header file relationship mapping**
- **Preprocessor directive analysis**
- **Struct/class hierarchy extraction**
- **Function signature analysis**

## 🚀 Performance Architecture

### Hardware Optimization
- **sqlite-vec Extension** - SIMD-accelerated vector operations
- **Memory Mapping** - Efficient file system integration
- **Multi-threading** - Concurrent parsing and indexing
- **CPU Optimization** - Resource-aware processing

### Scalability Features
- **Incremental Processing** - Only parse changed files
- **Batch Operations** - Efficient bulk data operations
- **Connection Pooling** - Database connection reuse
- **Memory Management** - Controlled memory usage patterns

### Performance Targets
- **Parsing**: 100+ files/second
- **Query Response**: <100ms simple, <1s complex
- **Memory Usage**: <1GB for large repositories
- **Concurrent Queries**: 10+ simultaneous operations

## 🔧 Development & Deployment

### Build Pipeline
```bash
# TypeScript compilation
bun run tsup

# Package distribution
make package

# Quality checks
npx biome check --apply .

# Testing
npm test
```

### Distribution
- **NPM Global Installation** - `npm install -g @er77/code-graph-rag-mcp`
- **NPX Usage** - `npx @er77/code-graph-rag-mcp /path/to/project`
- **Local Development** - Project-specific installation and usage
- **Claude Desktop Integration** - MCP inspector setup

### Configuration Management
- **Environment Variables** - Runtime configuration options
- **Command Line Arguments** - Directory and option specification
- **Config Files** - YAML-based configuration support
- **Agent Settings** - Per-agent configuration and limits

## 🔒 Security & Compliance

### Security Features
- **Input Validation** - Comprehensive parameter validation with Zod
- **Path Security** - File system access controls
- **Resource Limits** - Memory and CPU usage constraints
- **Error Handling** - Secure error reporting without information leakage

### Compliance Standards
- **MCP Protocol** - Full JSON-RPC 2.0 compliance
- **TypeScript Strict** - Comprehensive type safety
- **ES Module Standards** - Modern JavaScript module compliance
- **NPM Publishing** - Package registry security standards

## 📊 Monitoring & Observability

### Performance Metrics
- **Agent Performance** - Task execution times and resource usage
- **Database Metrics** - Query performance and storage efficiency
- **Memory Monitoring** - Heap usage and garbage collection
- **Parse Throughput** - Files processed per second

### Operational Logging
- **Structured Logging** - JSON-formatted operational logs
- **Agent Coordination** - Multi-agent task tracking
- **Error Tracking** - Comprehensive error reporting and recovery
- **Performance Profiling** - Detailed performance analysis

## 🔄 Extension Architecture

### Plugin System
- **Language Extensions** - Additional Tree-sitter language support
- **Analysis Plugins** - Custom entity and relationship extractors
- **Storage Backends** - Alternative database implementations
- **Transport Protocols** - Additional MCP transport methods

### API Extensions
- **Custom MCP Tools** - Additional analysis capabilities
- **Agent Extensions** - Specialized agent implementations
- **Integration APIs** - External system integration points
- **Webhook Support** - Event-driven external notifications

---

*This technology stack documentation provides comprehensive technical context for all development activities and architectural decisions in the Code Graph RAG MCP project.*

**Document Version**: 1.0 | **Last Updated**: 2025-01-22 | **Next Review**: 2025-02-15