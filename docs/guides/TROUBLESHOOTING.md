# Troubleshooting Guide

## Installation Issues

### npm install fails
```bash
# Clear npm cache
npm cache clean --force

# Try with legacy peer deps
npm install --legacy-peer-deps

# Use Node.js 18+ (check version)
node --version
```

### Permission errors
```bash
# Fix npm permissions (Linux/macOS)
sudo chown -R $(whoami) ~/.npm

# Use npx instead of global install
npx @er77/code-graph-rag-mcp /path/to/project
```

## Claude Desktop Integration

### MCP server not found
**Symptoms**: Claude doesn't recognize MCP tools

**Solutions**:
1. **Verify Node.js version**: `node --version` (requires 18+)
2. **Use absolute paths** in configuration
3. **Check JSON syntax** in claude_desktop_config.json
4. **Restart Claude Desktop** completely

### Server startup failures
**Symptoms**: MCP server fails to start

**Check**:
```bash
# Test server directly
npx @er77/code-graph-rag-mcp /path/to/test/project

# Verify directory exists
ls -la /path/to/your/codebase

# Check permissions
ls -ld /path/to/your/codebase
```

### Connection timeouts
**Symptoms**: "MCP server timed out" errors

**Solutions**:
1. **Start with smaller projects** first
2. **Use exclude patterns** for large codebases
3. **Increase timeout** in Claude Desktop settings
4. **Check system resources** (RAM, CPU)

## Performance Issues

### Slow parsing
**Symptoms**: Long indexing times

**Optimize**:
```json
{
  "name": "index",
  "arguments": {
    "directory": "/path/to/project",
    "incremental": true,
    "excludePatterns": [
      "node_modules/**",
      "dist/**",
      "build/**",
      "*.min.js",
      ".git/**"
    ]
  }
}
```

### High memory usage
**Symptoms**: System becomes slow during analysis

**Solutions**:
1. **Set memory limits**:
   ```bash
   export MCP_MAX_MEMORY=512  # Limit to 512MB
   ```
2. **Process smaller chunks** of codebase
3. **Use incremental parsing** for large projects
4. **Close other applications** while analyzing

### Query timeouts
**Symptoms**: Semantic search takes too long

**Optimize**:
```json
{
  "name": "semantic_search",
  "arguments": {
    "query": "your search",
    "limit": 5  // Reduce result count
  }
}
```

## Database Issues

### SQLite errors
**Symptoms**: Database corruption or access errors

**Fix**:
```bash
# Remove corrupted database
rm vectors.db vectors.db-*

# Re-index codebase
npx @er77/code-graph-rag-mcp /path/to/project
```

### Vector store problems
**Symptoms**: Semantic search not working

**Check**:
```bash
# Verify sqlite-vec availability
sqlite3 :memory: "SELECT sqlite_version();"

# Install sqlite-vec for better performance
npm install sqlite-vec
```

## Logging and Debugging

### Enable debug logs
```bash
export MCP_LOG_LEVEL=DEBUG
npx @er77/code-graph-rag-mcp /path/to/project
```

### View detailed logs
```bash
# Real-time log viewing
tail -f logs_llm/mcp-server-$(date +%Y-%m-%d).log

# Search for errors
grep ERROR logs_llm/mcp-server-*.log

# Check performance metrics
grep PERFORMANCE logs_llm/mcp-server-*.log
```

### Claude Desktop logs
| OS | Log Location |
|----|-------------|
| **macOS** | `~/Library/Logs/Claude/claude_desktop.log` |
| **Windows** | `%APPDATA%/Claude/logs/` |
| **Linux** | `~/.local/share/Claude/logs/` |

```bash
# View Claude Desktop logs (macOS)
tail -f ~/Library/Logs/Claude/claude_desktop.log
```

## Common Error Messages

### "Failed to initialize embedding model"
**Cause**: Environment or dependency issues

**Fix**:
```bash
# Update dependencies
npm update

# Clear node modules
rm -rf node_modules package-lock.json
npm install
```

### "Directory not found"
**Cause**: Invalid path in configuration

**Fix**:
- Use **absolute paths** in configuration
- Verify directory exists: `ls -la /path/to/project`
- Check permissions: `ls -ld /path/to/project`

### "Entity not found"
**Cause**: Codebase not indexed or entity doesn't exist

**Fix**:
1. **Re-index codebase**:
   ```json
   {"name": "index", "arguments": {"directory": "/path/to/project"}}
   ```
2. **Check entity name spelling**
3. **Verify file was parsed correctly**

### "Maximum call stack size exceeded"
**Cause**: Recursive parsing issue

**Fix**:
```bash
# Use exclude patterns to skip problematic files
{
  "excludePatterns": ["problematic-file.js", "recursive-dir/**"]
}
```

## Environment-Specific Issues

### Windows path issues
```json
{
  "mcpServers": {
    "code-graph-rag": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "C:\\\\absolute\\\\path\\\\to\\\\project"]
    }
  }
}
```

### macOS permission issues
```bash
# Grant full disk access to Terminal/Claude Desktop
# System Preferences > Security & Privacy > Privacy > Full Disk Access
```

### Linux AppImage issues
```bash
# Extract AppImage and run directly
chmod +x Claude.AppImage
./Claude.AppImage --appimage-extract
./squashfs-root/AppRun
```

## Getting Help

### Before reporting issues
1. **Check logs** for detailed error information
2. **Test with simple project** to isolate issue
3. **Verify system requirements** (Node.js 18+, 2GB RAM)
4. **Update to latest version**: `npm update -g @er77/code-graph-rag-mcp`

### Support channels
- **GitHub Issues**: [Report bugs and feature requests](https://github.com/er77/code-graph-rag-mcp/issues)
- **Documentation**: [Performance Guide](PERFORMANCE_GUIDE.md)
- **Logs**: Include relevant log excerpts when reporting issues

### Issue template
When reporting issues, include:
```
**Environment**:
- OS: [macOS/Windows/Linux]
- Node.js version: [output of `node --version`]
- Package version: [output of `npm list -g @er77/code-graph-rag-mcp`]

**Expected behavior**: [What you expected to happen]
**Actual behavior**: [What actually happened]
**Error messages**: [Full error messages from logs]
**Steps to reproduce**: [Minimal steps to reproduce the issue]
```