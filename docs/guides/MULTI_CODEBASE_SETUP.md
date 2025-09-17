# Multi-Codebase Setup Guide

**Simple solution using multiple MCP server instances - works immediately with current version**

## Quick Setup

### 1. Configure Multiple Servers

Edit Claude Desktop config file:

| OS | Config Location |
|----|-----------------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### 2. Add Multiple Projects

```json
{
  "mcpServers": {
    "frontend-app": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/absolute/path/to/frontend"]
    },
    "backend-api": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/absolute/path/to/backend"]
    },
    "mobile-app": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/absolute/path/to/mobile"]
    }
  }
}
```

### 3. Restart Claude Desktop

Close and restart Claude Desktop completely.

## Usage Examples

```
# Project-specific analysis
"Analyze the frontend-app codebase structure"
"Find authentication functions in backend-api"
"Show navigation components in mobile-app"

# Cross-project comparison (manual)
"How is user authentication implemented in frontend-app?"
"How is user authentication implemented in backend-api?"
"Compare these two authentication approaches"
```

## Performance Optimization

### Memory Management
- Each server: ~50-100MB RAM
- 4 projects: ~200-400MB total
- Monitor with Activity Monitor/Task Manager

### Exclude Patterns
Add excludePatterns for faster indexing:

```bash
# Frontend projects
--exclude "node_modules/**,dist/**,build/**,.next/**"

# Backend projects
--exclude "venv/**,__pycache__/**,*.pyc,node_modules/**"

# Mobile projects
--exclude "node_modules/**,ios/build/**,android/build/**"
```

## Troubleshooting

### Common Issues

**Server not starting**
```bash
# Test individually
npx @er77/code-graph-rag-mcp /path/to/project

# Check logs
tail -f ~/Library/Logs/Claude/claude_desktop.log
```

**Memory issues**
- Reduce number of concurrent servers
- Add exclude patterns
- Monitor system resources

**Path problems**
- Use absolute paths only
- Verify directories exist: `ls -la /path/to/project`
- Check permissions: `ls -ld /path/to/project`

### Server Configuration Tips

```json
{
  "project-name": {
    "command": "npx",
    "args": ["@er77/code-graph-rag-mcp", "/absolute/path"],
    "env": {
      "MCP_MAX_MEMORY": "128",
      "MCP_LOG_LEVEL": "WARN"
    }
  }
}
```

## Advantages of Multiple Server Instances

✅ **Immediate**: Works with current version
✅ **Simple**: No code changes required
✅ **Isolated**: Projects don't interfere
✅ **Flexible**: Enable/disable projects easily
✅ **Scalable**: Add projects as needed

## Limitations

- Manual cross-project correlation required
- Each server uses separate memory/resources
- No unified cross-project search
- Requires separate tool calls per project

---

**Next Steps**: For unified multi-project features, see [Advanced Multi-Project Architecture](ADVANCED_MULTI_PROJECT.md) (future development)