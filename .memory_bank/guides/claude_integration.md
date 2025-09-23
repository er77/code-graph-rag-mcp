# Claude Desktop Integration Guide

## 🚀 Quick Setup (Recommended)

```bash
# Automated setup using MCP Inspector
npx @modelcontextprotocol/inspector add code-graph-rag \
  --command "npx" \
  --args "@er77/code-graph-rag-mcp /path/to/your/codebase"
```

## 🔧 Manual Configuration

### Step 1: Locate Claude Desktop Config File

| OS | Config File Location |
|----|--------------------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### Step 2: Add MCP Server Configuration

#### Option A: Using npx (No Installation Required)
```json
{
  "mcpServers": {
    "code-graph-rag": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/absolute/path/to/your/codebase"]
    }
  }
}
```

#### Option B: Global Installation
```bash
# Install globally first
npm install -g @er77/code-graph-rag-mcp

# Then configure Claude Desktop
{
  "mcpServers": {
    "code-graph-rag": {
      "command": "code-graph-rag-mcp",
      "args": ["/absolute/path/to/your/codebase"]
    }
  }
}
```

#### Option C: Multi-Codebase Setup
```json
{
  "mcpServers": {
    "project-main": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/path/to/main/project"]
    },
    "project-api": {
      "command": "npx", 
      "args": ["@er77/code-graph-rag-mcp", "/path/to/api/project"]
    },
    "project-frontend": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/path/to/frontend/project"]
    }
  }
}
```

### Step 3: Restart Claude Desktop

**IMPORTANT**: Close and completely restart the Claude Desktop application after configuration changes.

## ✅ Verification Steps

### 1. Check MCP Connection
- Look for "MCP" indicator in Claude Desktop interface
- Should show connected status with server name

### 2. Test Tool Availability
Ask Claude: **"What MCP tools are available?"**

Expected response should include:
- `index` - Codebase indexing
- `semantic_search` - Natural language code search
- `list_file_entities` - Entity extraction
- And 10 other specialized analysis tools

### 3. Verify CodeGraph Analysis
Ask Claude: **"Can you analyze my codebase structure?"**

This should trigger the indexing process and return:
- Number of files processed
- Entities extracted (functions, classes, etc.)
- Relationships mapped
- Analysis completion status

## 🎯 Example Usage Patterns

### Basic Code Analysis
```
"What entities are in my codebase?"
"Show me all functions in the auth module"
"List the classes and their methods"
```

### Semantic Search
```
"Find functions related to user authentication"
"Search for code that handles database connections"
"Show me error handling patterns"
```

### Code Similarity and Quality
```
"Find similar code to this function: [paste code]"
"Detect duplicate code in my project"
"What are the complexity hotspots?"
"Suggest refactoring opportunities for UserService"
```

### Cross-Language Analysis
```
"Find authentication patterns across TypeScript and Python files"
"Show database query patterns in all languages"
"Compare similar functions across different modules"
```

### Impact Analysis
```
"What would be affected if I change the User class?"
"Show dependencies of the authentication system"
"Analyze the impact of modifying the database schema"
```

## 🐛 Troubleshooting

### Common Connection Issues

#### MCP Server Not Found
**Symptoms**: Claude shows no MCP tools available
**Solutions**:
- Verify Node.js 18+ is installed: `node --version`
- Use absolute paths in configuration (not relative paths)
- Check file permissions on the codebase directory
- Ensure the configuration file JSON syntax is valid

#### Connection Timeouts
**Symptoms**: MCP connection fails or times out
**Solutions**:
- Ensure the codebase directory exists and is accessible
- Start with a smaller test project (< 1000 files)
- Check available memory (requires ~1GB for large projects)
- Verify network connectivity for npx downloads

#### Configuration Errors
**Symptoms**: JSON parse errors or invalid configuration
**Solutions**:
- Validate JSON syntax (use a JSON validator)
- Remove trailing commas from JSON
- Use proper escape characters for Windows paths: `"C:\\Users\\..."`
- Ensure double quotes around all strings

### Performance Issues

#### Slow Indexing
**Symptoms**: Initial indexing takes >30 seconds
**Solutions**:
- Install sqlite-vec extension for 10-100x performance improvement
- Exclude large directories: `node_modules`, `dist`, `.git`
- Use incremental indexing for subsequent runs
- Consider project size (10,000+ files may require patience)

#### High Memory Usage
**Symptoms**: System becomes slow during analysis
**Solutions**:
- Close other memory-intensive applications
- Use smaller batch sizes for large codebases
- Install sqlite-vec extension for memory optimization
- Consider analyzing subsets of large monorepos

### Debug Information

#### Log Locations
- **macOS**: `~/Library/Logs/Claude/claude_desktop.log`
- **Windows**: `%APPDATA%/Claude/logs/claude_desktop.log`
- **Linux**: `~/.local/share/Claude/logs/claude_desktop.log`

#### View Live Logs
```bash
# macOS/Linux
tail -f ~/Library/Logs/Claude/claude_desktop.log

# Windows PowerShell
Get-Content "$env:APPDATA/Claude/logs/claude_desktop.log" -Wait
```

#### Test MCP Server Directly
```bash
# Test the server outside of Claude Desktop
npx @er77/code-graph-rag-mcp /path/to/test/project

# Should show:
# - Server starting
# - Indexing progress
# - Tools available
# - Ready for connections
```

### Advanced Debugging

#### Enable Debug Mode
```json
{
  "mcpServers": {
    "code-graph-rag": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/path/to/codebase"],
      "env": {
        "DEBUG": "true",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

#### Network Diagnostics
```bash
# Check npx connectivity
npx --version

# Verify package accessibility
npm view @er77/code-graph-rag-mcp

# Test package installation
npm install -g @er77/code-graph-rag-mcp
```

## 🔧 Advanced Configuration

### Custom Parsing Options
```json
{
  "mcpServers": {
    "code-graph-rag": {
      "command": "npx",
      "args": [
        "@er77/code-graph-rag-mcp", 
        "/path/to/codebase",
        "--exclude", "node_modules,dist,build",
        "--languages", "typescript,javascript,python",
        "--max-file-size", "1000000"
      ]
    }
  }
}
```

### Memory Optimization
```json
{
  "mcpServers": {
    "code-graph-rag": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/path/to/codebase"],
      "env": {
        "NODE_OPTIONS": "--max-old-space-size=4096",
        "SQLITE_VEC_ENABLED": "true"
      }
    }
  }
}
```

### Multi-Project Workspace
```json
{
  "mcpServers": {
    "workspace-backend": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/workspace/backend"]
    },
    "workspace-frontend": {
      "command": "npx", 
      "args": ["@er77/code-graph-rag-mcp", "/workspace/frontend"]
    },
    "workspace-shared": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/workspace/shared-libs"]
    }
  }
}
```

## 📚 Related Documentation

- **[MCP Tools Reference](./mcp_tools.md)** - Complete documentation of all 13 analysis tools
- **[Performance Guide](./performance_optimization.md)** - sqlite-vec installation and optimization
- **[Multi-Codebase Setup](./multi_codebase_setup.md)** - Advanced multi-project configuration
- **[Troubleshooting Guide](../troubleshooting/common_issues.md)** - Comprehensive issue resolution

## 🆘 Getting Help

### Community Support
- **GitHub Issues**: [Report integration problems](https://github.com/er77/code-graph-rag-mcp/issues)
- **GitHub Discussions**: [Community help and questions](https://github.com/er77/code-graph-rag-mcp/discussions)

### Documentation
- **MCP Protocol**: [Official MCP documentation](https://github.com/modelcontextprotocol)
- **Claude Desktop**: [Claude Desktop user guide](https://claude.ai/desktop)

### Self-Help Resources
- **Diagnostic Script**: Run `npx @er77/code-graph-rag-mcp --diagnostic`
- **Configuration Validator**: Check JSON syntax with online validators
- **Network Connectivity**: Test with `npx --help` to verify npx functionality

---

*For optimal performance with large codebases, consider installing the sqlite-vec extension following the [Performance Guide](./performance_optimization.md).*

**Document Version**: 1.0 | **Last Updated**: 2025-01-22 | **Next Review**: 2025-02-15