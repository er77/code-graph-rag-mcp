# Multi-Codebase Setup Guide

## 🎯 Overview

The Code Graph RAG MCP server supports analyzing multiple codebases simultaneously using multiple MCP server instances. This approach provides immediate multi-project analysis capabilities without requiring code changes.

## ⚡ Quick Setup

### 1. Locate Claude Desktop Configuration

| OS | Configuration File Location |
|----|----------------------------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### 2. Configure Multiple Server Instances

**Example Configuration for 3 Projects:**
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

**Enterprise Monorepo Example:**
```json
{
  "mcpServers": {
    "auth-service": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/workspace/services/auth"]
    },
    "user-service": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/workspace/services/user"]
    },
    "payment-service": {
      "command": "npx", 
      "args": ["@er77/code-graph-rag-mcp", "/workspace/services/payment"]
    },
    "shared-libs": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/workspace/shared-libraries"]
    },
    "frontend-web": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/workspace/frontend/web"]
    },
    "frontend-mobile": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/workspace/frontend/mobile"]
    }
  }
}
```

### 3. Restart Claude Desktop

**IMPORTANT**: Completely close and restart Claude Desktop after configuration changes.

## 🎯 Usage Patterns

### Project-Specific Analysis
```
# Target specific projects
"Analyze the frontend-app codebase structure"
"Find authentication functions in backend-api"
"Show navigation components in mobile-app"
"List all TypeScript interfaces in shared-libs"
"What are the API endpoints in user-service?"
```

### Cross-Project Comparison
```
# Manual cross-project analysis
"How is user authentication implemented in frontend-app?"
"How is user authentication implemented in backend-api?"
"Compare these two authentication approaches and suggest improvements"

"Show me the user data models in user-service"
"Show me the user data models in frontend-web"
"Identify inconsistencies between these data models"
```

### Architecture Analysis
```
# Service architecture understanding
"What microservices are defined in this workspace?"
"Show me the API contract for auth-service"
"Find all database interactions in payment-service"
"List shared utilities used across services"
```

### Dependency Analysis
```
# Cross-project dependency insights
"What shared-libs functions are used in frontend-web?"
"Find all services that depend on auth-service APIs"
"Show me imports from shared-libs in all services"
"Identify circular dependencies between services"
```

## ⚙️ Advanced Configuration

### Memory Optimization
**For Large Numbers of Projects (>5):**
```json
{
  "project-name": {
    "command": "npx",
    "args": ["@er77/code-graph-rag-mcp", "/absolute/path"],
    "env": {
      "NODE_OPTIONS": "--max-old-space-size=1024",
      "MCP_MAX_MEMORY": "256",
      "MCP_LOG_LEVEL": "WARN"
    }
  }
}
```

### Exclude Patterns for Performance
**Frontend Projects:**
```json
{
  "frontend-react": {
    "command": "npx",
    "args": [
      "@er77/code-graph-rag-mcp", 
      "/path/to/frontend",
      "--exclude", "node_modules/**,dist/**,build/**,.next/**,coverage/**"
    ]
  }
}
```

**Backend Projects:**
```json
{
  "backend-python": {
    "command": "npx", 
    "args": [
      "@er77/code-graph-rag-mcp",
      "/path/to/backend",
      "--exclude", "venv/**,__pycache__/**,*.pyc,node_modules/**,.pytest_cache/**"
    ]
  }
}
```

**Mobile Projects:**
```json
{
  "mobile-react-native": {
    "command": "npx",
    "args": [
      "@er77/code-graph-rag-mcp",
      "/path/to/mobile", 
      "--exclude", "node_modules/**,ios/build/**,android/build/**,ios/Pods/**"
    ]
  }
}
```

### Language-Specific Configurations
**Multi-Language Project:**
```json
{
  "fullstack-app": {
    "command": "npx",
    "args": [
      "@er77/code-graph-rag-mcp",
      "/path/to/project",
      "--languages", "typescript,javascript,python,java",
      "--exclude", "node_modules/**,venv/**,target/**"
    ]
  }
}
```

## 📊 Performance Considerations

### Resource Usage by Project Count

| Projects | Memory Usage | Startup Time | Concurrent Queries |
|----------|-------------|--------------|-------------------|
| 1-2 projects | 100-200MB | 5-10 seconds | 10+ |
| 3-5 projects | 300-500MB | 15-30 seconds | 8-10 |
| 6-10 projects | 600MB-1GB | 30-60 seconds | 5-8 |
| 10+ projects | 1-2GB | 1-2 minutes | 3-5 |

### Optimization Strategies

#### 1. Selective Activation
```json
{
  "mcpServers": {
    "active-project-1": {
      "command": "npx",
      "args": ["@er77/code-graph-rag-mcp", "/current/work/project"]
    }
    // Comment out inactive projects
    // "inactive-project": {
    //   "command": "npx", 
    //   "args": ["@er77/code-graph-rag-mcp", "/old/project"]
    // }
  }
}
```

#### 2. Incremental Loading
```bash
# Start with core projects, add others as needed
# Week 1: Core services only
# Week 2: Add frontend projects  
# Week 3: Add mobile and shared libraries
```

#### 3. Hardware Optimization
```bash
# System requirements for multi-codebase:
# - 8GB+ RAM for 5+ projects
# - SSD storage for faster indexing
# - 4+ CPU cores for concurrent processing
# - Install sqlite-vec for 10-100x performance improvement
```

## 🐛 Troubleshooting

### Common Issues

#### Server Startup Failures
**Symptoms**: One or more MCP servers fail to start
**Diagnosis**:
```bash
# Test each project individually
npx @er77/code-graph-rag-mcp /path/to/project-1
npx @er77/code-graph-rag-mcp /path/to/project-2

# Check Claude Desktop logs
tail -f ~/Library/Logs/Claude/claude_desktop.log
```

**Solutions**:
1. **Verify paths exist**: `ls -la /path/to/each/project`
2. **Check permissions**: `ls -ld /path/to/each/project`
3. **Reduce concurrent servers**: Comment out some projects temporarily
4. **Add exclude patterns**: Skip large/unnecessary directories

#### Memory Issues
**Symptoms**: System becomes slow, servers crash
**Solutions**:
```bash
# Monitor memory usage
htop  # Linux
Activity Monitor  # macOS
Task Manager  # Windows

# Reduce memory per server
export NODE_OPTIONS="--max-old-space-size=512"

# Add more aggressive exclude patterns
--exclude "node_modules/**,dist/**,build/**,coverage/**,.git/**"
```

#### Path Resolution Problems
**Symptoms**: "Directory not found" errors
**Solutions**:
```json
{
  "project-name": {
    "command": "npx",
    "args": ["@er77/code-graph-rag-mcp", "/Users/username/absolute/path"]
    // ✅ Always use absolute paths
    // ❌ Never use relative paths like "./project" or "~/project"
  }
}
```

#### Claude Desktop Integration Issues
**Symptoms**: Projects not showing up in Claude
**Diagnosis**:
```bash
# Check JSON syntax
cat ~/.config/Claude/claude_desktop_config.json | jq .

# Validate configuration
npx @modelcontextprotocol/inspector validate-config
```

### Debug Mode Configuration
```json
{
  "debug-project": {
    "command": "npx",
    "args": ["@er77/code-graph-rag-mcp", "/path/to/project"],
    "env": {
      "DEBUG": "true",
      "MCP_LOG_LEVEL": "debug",
      "SQLITE_VEC_DEBUG": "true"
    }
  }
}
```

## ✅ Advantages of Multiple Server Architecture

### ✅ Immediate Benefits
- **No Code Changes**: Works with current version
- **Simple Configuration**: JSON-based setup  
- **Project Isolation**: Independent analysis per project
- **Flexible Management**: Enable/disable projects easily
- **Scalable Architecture**: Add projects incrementally

### ✅ Operational Benefits
- **Independent Failures**: One project issue doesn't affect others
- **Resource Control**: Memory and CPU limits per project
- **Parallel Processing**: Concurrent analysis across projects
- **Selective Updates**: Update only specific project analysis

### ✅ Development Benefits
- **Clear Boundaries**: Project-specific tool scoping
- **Team Coordination**: Different teams can manage their projects
- **Security Isolation**: Projects can't access each other's data
- **Performance Optimization**: Tune each project independently

## ⚠️ Current Limitations

### Manual Cross-Project Correlation
- **Challenge**: No unified cross-project search
- **Workaround**: Ask separate questions for each project, then compare manually
- **Future**: Unified multi-project analysis in development

### Resource Usage
- **Challenge**: Each server uses separate memory/resources
- **Workaround**: Use exclude patterns and memory limits
- **Future**: Optimized shared resource architecture

### Query Complexity
- **Challenge**: Requires separate tool calls per project
- **Workaround**: Clear naming and organized queries
- **Future**: Cross-project query language support

## 🚀 Best Practices

### Project Naming Convention
```json
{
  "mcpServers": {
    "company-frontend-web": { ... },      // Clear, hierarchical naming
    "company-frontend-mobile": { ... },
    "company-backend-auth": { ... },
    "company-backend-user": { ... },
    "company-shared-utils": { ... }
  }
}
```

### Configuration Management
```bash
# Version control your configuration
cd ~/.config/Claude/
git init
git add claude_desktop_config.json
git commit -m "Initial multi-codebase setup"

# Create environment-specific configs
cp claude_desktop_config.json claude_desktop_config.development.json
cp claude_desktop_config.json claude_desktop_config.production.json
```

### Incremental Adoption
```bash
# Week 1: Start with 1-2 core projects
# Week 2: Add 2-3 more related projects  
# Week 3: Add remaining projects as needed
# Week 4: Optimize and tune performance
```

## 📈 Advanced Use Cases

### Microservices Architecture Analysis
- **Service Dependency Mapping**: Understand service interactions
- **API Contract Validation**: Ensure consistency across services
- **Shared Library Usage**: Track common utility usage
- **Cross-Service Patterns**: Identify implementation patterns

### Monorepo Management
- **Module Analysis**: Understand module boundaries and dependencies
- **Code Reuse Opportunities**: Find duplicated functionality
- **Refactoring Planning**: Identify extraction and consolidation opportunities
- **Team Coordination**: Support multiple team development

### Multi-Technology Stacks
- **Language Consistency**: Compare implementations across languages
- **Pattern Migration**: Port patterns between technologies
- **Technology Assessment**: Evaluate different tech stack approaches
- **Integration Points**: Understand technology boundaries

---

*Multi-codebase setup enables comprehensive analysis of complex software architectures while maintaining the performance and reliability of individual project analysis.*

**Document Version**: 1.0 | **Last Updated**: 2025-01-22 | **Next Review**: 2025-02-15