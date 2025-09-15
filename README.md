# code-graph-rag-mcp

A [Model Context Protocol](https://github.com/modelcontextprotocol) server that provides tools to generate and query a graph representation in your codebase.


## Features
- 📊 Creates a graph representation of your codebase
- 🔍 Identifies entities (functions, classes, imports) and their relationships
- 🔗 Tracks relationships like function calls, inheritance, and implementations
- 🌐 Supports multiple programming languages (JavaScript, TypeScript, JSX, TSX)
- ⚡ **Multi-agent LiteRAG architecture** optimized for commodity hardware (4-core CPU, 8GB RAM)
- 🔥 **High-performance vector search** with sqlite-vec integration for semantic code analysis
- 🎯 **13 advanced semantic tools** for code similarity, refactoring suggestions, and hotspot analysis

## Tools

### Core Analysis Tools
- **index** - Indexes the codebase to create a graph of entities and relationships
- **list_file_entities** - Lists all entities within a specified file
  - `path` (string): relative path of the file
- **list_entity_relationships** - Lists relationships of a specific entity
  - `path` (string): relative path of the file
  - `name` (string): name of entity

### Advanced Semantic Analysis Tools (13 tools)
- **find_similar_code** - Find code segments similar to a given snippet
- **suggest_refactoring** - Analyze code complexity and suggest refactoring opportunities
- **detect_hotspots** - Identify frequently modified or complex code areas
- **analyze_dependencies** - Deep analysis of dependency relationships and potential issues
- **search_semantic** - Semantic search across the codebase using natural language queries
- **find_duplicates** - Detect code duplication and suggest consolidation opportunities
- **analyze_complexity** - Measure and report code complexity metrics
- **track_changes** - Analyze code change patterns and impact
- **suggest_optimizations** - Identify performance optimization opportunities
- **analyze_patterns** - Detect design patterns and architectural insights
- **find_related_code** - Find code related to specific functionality or concepts
- **analyze_structure** - Analyze codebase structure and organization
- **generate_insights** - Generate comprehensive codebase insights and recommendations

## Installation

### Option 1: Install from NPM (Recommended)

```bash
# Install globally for CLI usage
npm install -g @er77/code-graph-rag-mcp

# Or use npx for one-time usage
npx @er77/code-graph-rag-mcp /path/to/your/codebase
```

### Option 2: Local Development

```bash
# Clone and build from source
git clone https://github.com/er77/code-graph-rag-mcp.git
cd code-graph-rag-mcp

# Install dependencies (sqlite-vec included automatically)
npm install

# Build the project
npm run build

# Run the MCP server
node dist/index.js /path/to/your/codebase
```

### Verify sqlite-vec Installation
```bash
# Check if sqlite-vec extension loads successfully
# Look for: "✅ Extension loaded from: ./node_modules/sqlite-vec-linux-x64/vec0.so"
node dist/index.js /path/to/your/codebase

# If you see warnings about extension not loading, run:
./scripts/install-sqlite-vec.sh
```

## Usage

### Option 1: Claude Code (Recommended)

Claude Code provides the best experience with this MCP server through its integrated development environment.

#### Installation
1. **Install Claude Code** (if not already installed):
   ```bash
   # Visit https://claude.ai/code for download instructions
   # Or use your preferred installation method
   ```

2. **Add MCP Server to Claude Code**:
   Create or edit your Claude Code MCP configuration file:

   **Linux/macOS**: `~/.config/claude-code/mcp_servers.json`
   **Windows**: `%APPDATA%\claude-code\mcp_servers.json`

   ```json
   {
     "mcpServers": {
       "codegraph": {
         "command": "npx",
         "args": [
           "-y",
           "@er77/code-graph-rag-mcp",
           "/path/to/your/codebase"
         ],
         "env": {}
       }
     }
   }
   ```

3. **Local Development Setup** (Alternative):
   ```json
   {
     "mcpServers": {
       "codegraph": {
         "command": "node",
         "args": [
           "/path/to/code-graph-rag-mcp/dist/index.js",
           "/path/to/your/codebase"
         ],
         "env": {}
       }
     }
   }
   ```

#### Using the Tools in Claude Code

Once configured, you can use any of the 16 available tools directly in Claude Code:

```plaintext
# Core Analysis
"Index my codebase to create a knowledge graph"
"List all entities in src/components/Header.tsx"
"Show relationships for the UserService class"

# Semantic Analysis (13 advanced tools)
"Find code similar to this authentication function"
"Suggest refactoring opportunities for complex functions"
"Detect code hotspots in my React components"
"Search for functions that handle user authentication"
"Find duplicate code patterns across the project"
"Analyze the complexity of my API endpoints"
```

### Option 2: Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "npx",
      "args": [
        "-y",
        "@er77/code-graph-rag-mcp",
        "/path/to/directory"
      ]
    }
  }
}
```

### Option 3: Direct CLI Usage

```sh
# Direct execution
npx @er77/code-graph-rag-mcp /path/to/directory

# Or after building locally
node dist/index.js /path/to/directory
```

## Examples

### Common Use Cases in Claude Code

```plaintext
# 1. Initial Setup - Index your codebase
"Index my React project to understand its structure"

# 2. Code Discovery
"Find all React components that use useState"
"List entities in my authentication module"
"Show relationships for the Database class"

# 3. Semantic Analysis
"Find code similar to this login function"
"Detect duplicate validation logic across components"
"Suggest refactoring for overly complex functions"
"Find all functions that handle file uploads"

# 4. Architecture Analysis
"Analyze the dependency structure of my API layer"
"Detect code hotspots that change frequently"
"Find patterns in my error handling code"
"Generate insights about my codebase organization"

# 5. Performance & Quality
"Identify performance optimization opportunities"
"Analyze code complexity metrics"
"Find related code for this feature implementation"
```

### Step-by-step Claude Code Integration

1. **First Time Setup**:
   ```bash
   # Create the MCP config directory if it doesn't exist
   mkdir -p ~/.config/claude-code/

   # Create the MCP servers configuration
   cat > ~/.config/claude-code/mcp_servers.json << 'EOF'
   {
     "mcpServers": {
       "codegraph": {
         "command": "npx",
         "args": [
           "-y",
           "@er77/code-graph-rag-mcp",
           "/home/user/my-project"
         ],
         "env": {}
       }
     }
   }
   EOF
   ```

2. **Start Claude Code** and verify the MCP server loads:
   - Look for "codegraph" in the available tools
   - Check the status indicator shows connected

3. **Index Your Codebase**:
   ```plaintext
   Claude: "Index my codebase to create a knowledge graph"
   ```

4. **Start Analyzing**:
   ```plaintext
   Claude: "What are the main components in my project?"
   Claude: "Find functions similar to my authentication logic"
   ```

## Troubleshooting

### MCP Server Not Loading
```bash
# Test the server directly
npx @er77/code-graph-rag-mcp /path/to/your/code

# Check for errors in Claude Code MCP logs
# Look for connection issues or permission errors
```

### sqlite-vec Extension Issues
```bash
# Verify extension loading
node dist/index.js /path/to/code
# Look for: "✅ Extension loaded from: ./node_modules/sqlite-vec-linux-x64/vec0.so"

# If extension fails to load:
./scripts/install-sqlite-vec.sh

# Manual verification
ls -la node_modules/sqlite-vec*/
```

### Performance Issues
```bash
# For large codebases, increase memory if needed:
NODE_OPTIONS="--max-old-space-size=4096" node dist/index.js /path/to/code

# Check available system resources
free -h  # Linux
top      # Monitor CPU/memory usage
```

### Common Configuration Errors

1. **Wrong path in MCP config**:
   ```json
   // ❌ Wrong - relative path may not work
   "args": [".", "my-project"]

   // ✅ Correct - absolute path
   "args": ["/home/user/my-project"]
   ```

2. **Missing executable permissions**:
   ```bash
   chmod +x ~/.config/claude-code/mcp_servers.json
   ```

3. **Node.js version issues**:
   ```bash
   node --version  # Should be 18+
   npm --version   # Should be recent
   ```

## Performance Optimization

### SQLite-vec Extension (Recommended)

For optimal performance, especially with large codebases, the sqlite-vec extension provides hardware-accelerated vector similarity search:

#### Automatic Installation (via npm)
The sqlite-vec extension (v0.1.6) is **automatically included** as an optional dependency:

```bash
# sqlite-vec is already included when you install
npm install

# The extension will be available at:
# ./node_modules/sqlite-vec-linux-x64/vec0.so (Linux x64)
# ./node_modules/sqlite-vec-darwin-x64/vec0.dylib (macOS Intel)
# ./node_modules/sqlite-vec-darwin-arm64/vec0.dylib (macOS Apple Silicon)
# ./node_modules/sqlite-vec-windows-x64/vec0.dll (Windows x64)
```

#### System-wide Installation (Optional)
For system-wide access or troubleshooting:

```bash
# Automated installation script
./scripts/install-sqlite-vec.sh

# Manual installation options:
# Ubuntu/Debian: See SQLITE_VEC_INSTALLATION.md
# macOS: brew install asg017/sqlite-vec/sqlite-vec
# Windows: Download from sqlite-vec releases
```

#### Performance Benefits
With sqlite-vec extension (v0.1.6) enabled:
- ⚡ **25-50x faster** vector operations (insert, search, batch operations)
- 💾 **5x lower memory usage** for large vector datasets (2.5GB → 0.5GB for 1M vectors)
- 🔧 **Pure C implementation** with hardware SIMD optimization
- 🌐 **Cross-platform support**: Linux, macOS, Windows, WASM, Raspberry Pi
- 📈 **Real-time semantic search** for large codebases (30s → 1-3s search time)

#### Automatic Fallback
The server automatically detects and loads the extension, gracefully falling back to JavaScript implementation if unavailable, ensuring full functionality regardless of installation status.

### System Requirements

**Minimum**:
- Node.js 18+
- 2GB RAM
- Dual-core CPU

**Recommended** (with sqlite-vec):
- Node.js 18+
- 8GB RAM
- Quad-core CPU with SIMD support
- SSD storage

## Architecture

This MCP server implements a **multi-agent LiteRAG architecture** optimized for commodity hardware:

### Core Components
- **Conductor Agent** - Orchestrates complex tasks and manages other agents
- **Parser Agent** - High-performance code parsing using Tree-sitter (100+ files/second)
- **Indexer Agent** - Manages graph indexing and relationship mapping
- **Query Agent** - Handles graph queries and traversal operations
- **Semantic Agent** - Vector-based semantic analysis and similarity search

### Storage & Performance
- **SQLite with WAL mode** - Optimized for concurrent access and reliability
- **Vector Store with sqlite-vec** - Hardware-accelerated similarity search
- **Incremental processing** - Efficient handling of large codebases
- **Resource management** - Optimized for 4-core CPU, 8GB RAM systems

### Language Support
- JavaScript, TypeScript, JSX, TSX
- Extensible parser system for additional languages

## Documentation

- **Performance Guide**: [PERFORMANCE_GUIDE.md](./PERFORMANCE_GUIDE.md)
- **SQLite-vec Installation**: [SQLITE_VEC_INSTALLATION.md](./SQLITE_VEC_INSTALLATION.md)
- **Project Instructions**: [CLAUDE.md](./CLAUDE.md)
- **Architecture Decisions**: [docs/architecture_decisions/](./docs/architecture_decisions/)

## Contributing

This project uses:
- **Biome** for linting and formatting: `npx biome check --apply .`
- **TypeScript** with ES modules
- **tsup** for building: `npm run build`
- **npm/bun** for package management

For complex development tasks, always use the **Conductor agent** as specified in [CLAUDE.md](./CLAUDE.md).
