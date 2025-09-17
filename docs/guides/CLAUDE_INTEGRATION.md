# Claude Desktop Integration Guide

## Quick Setup (Recommended)

```bash
# Automated setup using MCP Inspector
npx @modelcontextprotocol/inspector add code-graph-rag \
  --command "npx" \
  --args "@er77/code-graph-rag-mcp /path/to/your/codebase"
```

## Manual Configuration

### Step 1: Locate Claude Desktop Config File

| OS | Config File Location |
|----|--------------------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### Step 2: Add MCP Server Configuration

#### Option A: Using npx (No Installation)
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
# Install first
npm install -g @er77/code-graph-rag-mcp

# Then configure
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
For analyzing multiple codebases simultaneously, see [Multi-Codebase Setup Guide](MULTI_CODEBASE_SETUP.md).

### Step 3: Restart Claude Desktop

Close and restart Claude Desktop application.

## Verification

1. **Check MCP Status**: Look for "MCP" indicator in Claude interface
2. **Test Connection**: Ask Claude: "What MCP tools are available?"
3. **Verify CodeGraph**: Ask: "Can you analyze my codebase structure?"

## Example Usage

Once connected, try these commands:

- "What entities are in my codebase?"
- "Find functions related to authentication"
- "Show me similar code to this function"
- "Analyze the complexity of the user module"
- "Suggest refactoring opportunities"

## Troubleshooting

### Common Issues

**MCP server not found**
- Verify Node.js 18+ is installed: `node --version`
- Use absolute paths in configuration
- Check file permissions

**Connection timeouts**
- Ensure codebase directory exists
- Try with a smaller test project first
- Check Claude Desktop logs

**Configuration errors**
- Validate JSON syntax in config file
- Remove trailing commas
- Use proper escape characters for Windows paths

### Debug Logs

**macOS**: `~/Library/Logs/Claude/claude_desktop.log`
**Windows**: `%APPDATA%/Claude/logs/`
**Linux**: `~/.local/share/Claude/logs/`

```bash
# View live logs (macOS)
tail -f ~/Library/Logs/Claude/claude_desktop.log

# Test MCP server directly
npx @er77/code-graph-rag-mcp /path/to/test/project
```

### Getting Help

- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [GitHub Issues](https://github.com/er77/code-graph-rag-mcp/issues)
- [MCP Protocol Documentation](https://github.com/modelcontextprotocol)