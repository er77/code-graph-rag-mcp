# Common Issues and Troubleshooting

## 🚨 Installation and Setup Issues

### NPM Installation Failures

#### Package Installation Errors
**Symptoms**: `npm install` fails with dependency conflicts or permission errors

**Solutions**:
```bash
# Clear npm cache completely
npm cache clean --force

# Remove existing node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try with legacy peer dependencies support
npm install --legacy-peer-deps

# For persistent issues, use yarn as alternative
yarn install
```

#### Node.js Version Compatibility
**Symptoms**: "Unsupported Node.js version" or compatibility warnings

**Requirements**: Node.js 18+ (20+ recommended)
```bash
# Check current version
node --version

# Update Node.js if needed
# Using nvm (recommended)
nvm install 20
nvm use 20

# Using official installer
# Download from: https://nodejs.org/
```

#### Permission Errors (Linux/macOS)
**Symptoms**: EACCES or permission denied errors during global installation

**Solutions**:
```bash
# Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Alternative: Use npx instead of global install
npx @er77/code-graph-rag-mcp /path/to/project

# Last resort: Use sudo (not recommended)
sudo npm install -g @er77/code-graph-rag-mcp
```

### Directory and Path Issues

#### Invalid Directory Paths
**Symptoms**: "Directory not found" or "Cannot access directory" errors

**Solutions**:
```bash
# Always use absolute paths
✅ /home/user/projects/my-app
✅ /Users/user/workspace/project
✅ C:\\Users\\user\\projects\\app

❌ ./my-project          # Relative paths don't work
❌ ~/projects/app         # Tilde expansion issues
❌ ../parent-dir/project  # Relative navigation problems

# Verify directory exists
ls -la /absolute/path/to/project

# Check permissions
ls -ld /absolute/path/to/project
```

#### Windows Path Escaping
**Symptoms**: Path not recognized or parsing errors on Windows

**Solutions**:
```json
{
  "mcpServers": {
    "code-graph-rag": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "C:\\\\Users\\\\username\\\\project"]
      // Note: Double backslashes required in JSON
    }
  }
}
```

## 🔌 Claude Desktop Integration Issues

### MCP Server Detection Problems

#### Server Not Found
**Symptoms**: Claude Desktop doesn't show MCP tools or "No MCP servers" message

**Diagnostic Steps**:
```bash
# 1. Verify Node.js installation
node --version  # Should be 18+

# 2. Test MCP server directly
npx @er77/code-graph-rag-mcp /path/to/test/project

# 3. Check Claude Desktop configuration
cat ~/.config/Claude/claude_desktop_config.json  # Linux
cat "~/Library/Application Support/Claude/claude_desktop_config.json"  # macOS
```

**Solutions**:
1. **Configuration File Location**: Ensure config file is in correct location
2. **JSON Syntax**: Validate JSON syntax with online validator
3. **Absolute Paths**: Use complete absolute paths only
4. **Claude Restart**: Completely close and restart Claude Desktop

#### Configuration Syntax Errors
**Symptoms**: Claude Desktop fails to start or shows configuration errors

**Common Issues**:
```json
// ❌ Common mistakes
{
  "mcpServers": {
    "code-graph-rag": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/path/to/project"],  // ❌ Trailing comma
    },  // ❌ Trailing comma
  }
}

// ✅ Correct format
{
  "mcpServers": {
    "code-graph-rag": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/path/to/project"]
    }
  }
}
```

### Connection and Timeout Issues

#### Server Startup Timeouts
**Symptoms**: "MCP server timed out" or "Failed to connect" errors

**Solutions**:
```bash
# Start with smaller test project
npx @er77/code-graph-rag-mcp /path/to/small/project

# Increase available memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Use exclude patterns for large projects
{
  "args": [
    "@er77/code-graph-rag-mcp", 
    "/path/to/project",
    "--exclude", "node_modules/**,dist/**,build/**"
  ]
}

# Check system resources
htop  # Linux
Activity Monitor  # macOS
Task Manager  # Windows
```

#### Intermittent Disconnections
**Symptoms**: MCP tools work initially but stop responding

**Solutions**:
1. **Memory Pressure**: Monitor and reduce memory usage
2. **System Resources**: Close other heavy applications
3. **Project Size**: Use incremental parsing for large codebases
4. **sqlite-vec**: Install extension for better performance

## ⚡ Performance Issues

### Slow Indexing Performance

#### Long Initial Indexing
**Symptoms**: Indexing takes >60 seconds for medium projects (<5000 files)

**Root Causes**:
- Missing sqlite-vec extension (10-100x slower)
- Large binary files included in parsing
- Insufficient system memory
- Network storage or slow disk I/O

**Solutions**:
```bash
# Install sqlite-vec extension (most important)
./scripts/install-sqlite-vec.sh

# Verify extension is active
npx @er77/code-graph-rag-mcp --diagnostic

# Add comprehensive exclude patterns
{
  "args": [
    "@er77/code-graph-rag-mcp",
    "/path/to/project", 
    "--exclude", "node_modules/**,*.min.js,dist/**,build/**,coverage/**,.git/**,*.jpg,*.png,*.pdf"
  ]
}

# Increase memory allocation
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### Progressive Performance Degradation
**Symptoms**: Performance gets worse over time or with repeated operations

**Solutions**:
```bash
# Clear database and rebuild
rm vectors.db vectors.db-*
npx @er77/code-graph-rag-mcp /path/to/project

# Use incremental parsing
{
  "name": "index",
  "arguments": {
    "directory": "/path/to/project",
    "incremental": true
  }
}

# Monitor memory usage
ps aux | grep node  # Check memory consumption
```

### High Memory Usage

#### Excessive RAM Consumption
**Symptoms**: System becomes slow, >2GB memory usage, swapping

**Immediate Actions**:
```bash
# Restart the MCP server
pkill -f "code-graph-rag-mcp"

# Limit memory usage
export NODE_OPTIONS="--max-old-space-size=2048"

# Use more aggressive exclude patterns
--exclude "node_modules/**,dist/**,build/**,coverage/**,.git/**,*.min.js,vendor/**"
```

**Long-term Solutions**:
1. **Install sqlite-vec**: Reduces memory usage by 2-5x
2. **Incremental Processing**: Avoid reprocessing unchanged files
3. **Project Segmentation**: Analyze smaller portions of large codebases
4. **Hardware Upgrade**: 8GB+ RAM recommended for large projects

### Slow Query Response

#### Search Operations Taking >2 Seconds
**Symptoms**: Semantic search, similarity queries, or relationship analysis slow

**Diagnostic**:
```bash
# Check if sqlite-vec is active
grep "sqlite-vec" logs_llm/mcp-server-*.log

# Monitor query performance
grep "QUERY_PERFORMANCE" logs_llm/mcp-server-*.log
```

**Solutions**:
```bash
# Enable hardware acceleration
./scripts/install-sqlite-vec.sh

# Optimize query parameters
{
  "name": "semantic_search",
  "arguments": {
    "query": "your search",
    "limit": 10,        # Reduce result count
    "threshold": 0.8    # Increase similarity threshold
  }
}

# Warm up caches
curl http://localhost:3000/api/warmup  # If server mode enabled
```

## 🗄️ Database and Storage Issues

### SQLite Database Problems

#### Database Corruption
**Symptoms**: "database disk image is malformed" or similar SQLite errors

**Recovery Steps**:
```bash
# Backup current database (if possible)
cp vectors.db vectors.db.backup

# Remove corrupted database files
rm vectors.db vectors.db-shm vectors.db-wal

# Rebuild from scratch
npx @er77/code-graph-rag-mcp /path/to/project

# If backup exists, try repair
sqlite3 vectors.db.backup ".recover" | sqlite3 vectors.db.recovered
```

#### Permission Errors
**Symptoms**: "unable to open database file" or write permission errors

**Solutions**:
```bash
# Check file permissions
ls -la vectors.db*

# Fix permissions (Linux/macOS)
chmod 644 vectors.db*
chown $USER:$USER vectors.db*

# Ensure directory is writable
chmod 755 $(dirname $(pwd)/vectors.db)
```

### Vector Store Issues

#### "Extension not loaded" Warnings
**Symptoms**: Fallback implementation warnings, slower performance

**This is Normal**: The system works without the extension, just slower

**For Optimal Performance**:
```bash
# Install sqlite-vec extension
./scripts/install-sqlite-vec.sh

# Verify installation
sqlite3 -cmd ".load vec0" -cmd "SELECT vec_version();" -cmd ".quit"

# Check in application logs
grep "sqlite-vec" logs_llm/mcp-server-*.log
```

#### Vector Embedding Failures
**Symptoms**: Semantic search not working, embedding errors

**Solutions**:
```bash
# Clear vector data and rebuild
DELETE FROM embeddings WHERE 1=1;  # In sqlite3
# Or remove database entirely
rm vectors.db*

# Check model availability
npm list sentence-transformers

# Verify internet connectivity for model download
curl -I https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
```

## 🔧 Development and Build Issues

### TypeScript Compilation Errors

#### Build Failures
**Symptoms**: `npm run build` fails with TypeScript errors

**Solutions**:
```bash
# Update TypeScript and dependencies
npm update

# Check TypeScript configuration
npx tsc --noEmit  # Type check without building

# Clean build artifacts
rm -rf dist/ .tsbuildinfo
npm run build

# Fix common issues
# - Update import paths to use .js extensions
# - Ensure all dependencies have type definitions
# - Check tsconfig.json for correct settings
```

#### Runtime Type Errors
**Symptoms**: Runtime errors despite successful build

**Solutions**:
```bash
# Enable strict mode in tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

# Validate syntax
node --check dist/index.js

# Check for any require() instead of import
grep -r "require(" dist/
```

### Test Suite Issues

#### Test Failures
**Symptoms**: `npm test` fails with various errors

**Common Solutions**:
```bash
# Update test dependencies
npm update --dev

# Clear test cache
npm test -- --clearCache

# Run tests in watch mode for debugging
npm test -- --watch

# Run specific test files
npm test -- --testPathPattern=specific-test.test.ts
```

## 📊 Debugging and Diagnostics

### Enabling Debug Mode

#### Comprehensive Logging
```bash
# Environment variables for debug mode
export DEBUG="*"
export MCP_LOG_LEVEL="debug"
export SQLITE_VEC_DEBUG="true"

# Run with full debugging
npx @er77/code-graph-rag-mcp /path/to/project 2>&1 | tee debug.log
```

#### Claude Desktop Debug Configuration
```json
{
  "mcpServers": {
    "code-graph-rag": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/path/to/project"],
      "env": {
        "DEBUG": "true",
        "MCP_LOG_LEVEL": "debug",
        "NODE_OPTIONS": "--inspect=9229"
      }
    }
  }
}
```

### Log Analysis

#### Log Locations
- **Application Logs**: `logs_llm/mcp-server-*.log`
- **Claude Desktop Logs**: 
  - macOS: `~/Library/Logs/Claude/claude_desktop.log`
  - Linux: `~/.local/share/Claude/logs/`
  - Windows: `%APPDATA%/Claude/logs/`

#### Common Log Patterns
```bash
# Check for errors
grep -i error logs_llm/mcp-server-*.log

# Performance issues
grep -i "slow\|timeout\|memory" logs_llm/mcp-server-*.log

# Extension status
grep -i "sqlite-vec\|extension" logs_llm/mcp-server-*.log

# MCP protocol issues
grep -i "mcp\|protocol\|json-rpc" logs_llm/mcp-server-*.log
```

### Health Check and Diagnostics

#### Built-in Diagnostics
```bash
# Run comprehensive health check
npx @er77/code-graph-rag-mcp --diagnostic

# Expected output includes:
# ✅ Node.js version compatibility
# ✅ Dependencies installed correctly
# ✅ Database connectivity
# ✅ sqlite-vec extension status
# ✅ Memory availability
# ✅ File system permissions
```

#### Manual Health Checks
```bash
# Test basic functionality
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_metrics","arguments":{}},"id":"1"}' | npx @er77/code-graph-rag-mcp /path/to/test/project

# Verify MCP protocol compliance
npx @modelcontextprotocol/inspector validate /path/to/project
```

## 🆘 Getting Help

### Before Seeking Support

1. **Check this troubleshooting guide** for your specific issue
2. **Review recent logs** for error messages and patterns
3. **Test with a minimal example** to isolate the problem
4. **Verify system requirements** (Node.js 18+, sufficient memory)
5. **Update to latest version**: `npm update -g @er77/code-graph-rag-mcp`

### Information to Include in Support Requests

#### System Information
```bash
# Gather system details
echo "OS: $(uname -a)"
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "Package: $(npm list -g @er77/code-graph-rag-mcp)"
echo "Memory: $(free -h | head -2)"  # Linux
echo "Disk: $(df -h .)"
```

#### Error Information
- **Complete error messages** from logs
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Configuration files** (sanitized)
- **Relevant log excerpts** (not entire logs)

### Support Channels

- **GitHub Issues**: [Bug reports and feature requests](https://github.com/er77/code-graph-rag-mcp/issues)
- **GitHub Discussions**: [Community help and questions](https://github.com/er77/code-graph-rag-mcp/discussions)
- **Documentation**: Comprehensive guides in `.memory_bank/guides/`

---

*This troubleshooting guide covers the most common issues encountered when using Code Graph RAG MCP. For issues not covered here, please check the GitHub repository or create a new issue with detailed information.*

**Document Version**: 1.0 | **Last Updated**: 2025-01-22 | **Next Review**: 2025-02-15