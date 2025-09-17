# MCP Server Debug Logging System

## Overview

The MCP Code Graph RAG server includes a comprehensive rotated debug logging system that captures all server activity in the `logs_llm/` directory. This system provides detailed insights into MCP operations, agent activities, and system performance.

## Features

### 🔄 **Log Rotation**
- **File Size Limits**: Automatically rotates logs when files exceed 10MB
- **File Count Management**: Maintains up to 20 log files (configurable)
- **Daily Log Files**: Creates new log files each day with format `mcp-server-YYYY-MM-DD.log`
- **Automatic Cleanup**: Removes old log files beyond the retention limit

### 📊 **Comprehensive Activity Logging**
- **System Events**: Server startup, shutdown, configuration changes
- **MCP Requests**: All incoming MCP tool calls with parameters and request IDs
- **MCP Responses**: Tool execution results and response times
- **MCP Errors**: Detailed error logging with stack traces
- **Agent Activity**: Multi-agent system operations and coordination
- **Performance Metrics**: Resource usage, timing, and performance data

### 🏷️ **Structured Log Format**
```
[TIMESTAMP] [LEVEL] [CATEGORY] [REQUEST_ID] MESSAGE DATA: {...} DURATION: Xms
```

Example:
```
[2025-09-16T13:01:27.810Z] [INFO] [MCP_REQUEST] [req_1758027687810_fc171lsyi] Incoming MCP request: get_metrics DATA: {
  "method": "get_metrics",
  "params": {}
}
```

## Log Categories

### System Operations
- **SYSTEM**: Server lifecycle events (startup, shutdown, configuration)
- **PERFORMANCE**: Resource usage, timing metrics, and performance data

### MCP Protocol
- **MCP_REQUEST**: Incoming MCP tool calls with full parameter details
- **MCP_RESPONSE**: Tool execution results, success/failure, response times
- **MCP_ERROR**: Detailed error information with stack traces

### Agent Activities
- **AGENT_ACTIVITY**: Multi-agent system operations and coordination
- **PARSE_ACTIVITY**: Code parsing operations with file paths and entity counts
- **QUERY_ACTIVITY**: Graph query operations with query details and results

## Configuration

### Log Levels (in order of severity)
- `DEBUG`: Detailed debugging information
- `INFO`: General operational information
- `WARN`: Warning conditions
- `ERROR`: Error conditions
- `CRITICAL`: Critical system failures

### Default Configuration
```typescript
{
  logDir: 'logs_llm',           // Log directory relative to project root
  maxFileSize: 10MB,            // Max size before rotation
  maxFiles: 20,                 // Max number of retained files
  logLevel: DEBUG,              // Minimum level to log
  enableRotation: true,         // Enable automatic rotation
  enableTimestamp: true,        // Include timestamps
  enableStackTrace: true        // Include stack traces for errors
}
```

## Usage Examples

### View Recent Activity
```bash
# View latest log entries
tail -f logs_llm/mcp-server-$(date +%Y-%m-%d).log

# View specific categories
grep "MCP_REQUEST" logs_llm/mcp-server-*.log
grep "AGENT_ACTIVITY" logs_llm/mcp-server-*.log
```

### Monitor Performance
```bash
# View performance metrics
grep "PERFORMANCE" logs_llm/mcp-server-*.log

# View response times
grep "DURATION:" logs_llm/mcp-server-*.log
```

### Debug Issues
```bash
# View all errors
grep "ERROR\|CRITICAL" logs_llm/mcp-server-*.log

# View specific request traces
grep "req_1758027687810_fc171lsyi" logs_llm/mcp-server-*.log
```

## Log File Location

### Default Location
- **Project Root**: `./logs_llm/mcp-server-YYYY-MM-DD.log`
- **Working Directory**: If running from subdirectory, logs are created relative to the working directory

### Centralized Configuration
The logging system automatically detects the project root and places logs in a centralized location to avoid scattered log files.

## Integration with MCP Tools

All 13 MCP tools are fully integrated with the logging system:

1. **index** - Codebase indexing with entity counts and performance metrics
2. **list_file_entities** - File entity extraction with parsing details
3. **list_entity_relationships** - Relationship queries with graph traversal info
4. **query** - Natural language queries with response times
5. **get_metrics** - System metrics with resource usage data
6. **semantic_search** - Semantic queries with similarity scores
7. **find_similar_code** - Code similarity analysis with match details
8. **analyze_code_impact** - Impact analysis with dependency mapping
9. **detect_code_clones** - Clone detection with similarity metrics
10. **suggest_refactoring** - Refactoring suggestions with analysis details
11. **cross_language_search** - Multi-language search operations
12. **analyze_hotspots** - Code hotspot analysis with complexity metrics
13. **find_related_concepts** - Conceptual relationship discovery

## Monitoring and Alerting

### Key Metrics to Monitor
- **Response Times**: Average response time per tool
- **Error Rates**: Percentage of failed requests
- **Memory Usage**: Peak memory consumption during operations
- **Agent Performance**: Task completion rates and processing times

### Performance Thresholds
- **Response Time**: >1000ms indicates potential performance issues
- **Memory Usage**: >1GB suggests memory optimization needed
- **Error Rate**: >5% indicates system instability
- **Agent Failures**: Any agent crashes should be investigated immediately

## Troubleshooting

### Common Issues

**No Log Files Created**
- Check directory permissions for `logs_llm/`
- Verify the server is running and processing requests
- Ensure log level is set appropriately (DEBUG captures all activity)

**Log Rotation Not Working**
- Check disk space availability
- Verify write permissions to log directory
- Review configuration for `enableRotation` setting

**Missing Request/Response Pairs**
- Each MCP request gets a unique request ID for tracing
- Search logs using the request ID to see the complete flow
- Responses may be in separate log entries but with matching request IDs

### Debug Mode
For maximum debugging information, ensure log level is set to `DEBUG` in the configuration. This captures all activity including detailed agent coordination and performance metrics.

## Security Considerations

### Sensitive Data
- The logging system **does not log** sensitive information like authentication tokens
- Code content is logged only as metadata (file paths, entity names, not full source)
- Request parameters are logged for debugging but should not contain secrets

### Log Retention
- Configure appropriate retention periods based on your security requirements
- Consider log rotation frequency for high-volume environments
- Implement log archival if long-term retention is required

## Performance Impact

### Minimal Overhead
- Asynchronous logging operations minimize impact on MCP response times
- Structured logging with efficient serialization
- Automatic log rotation prevents disk space issues

### Resource Usage
- Typical overhead: <5% CPU, <50MB additional memory
- Log file I/O is optimized for minimal blocking operations
- Rotation happens automatically to prevent performance degradation

---

The logging system provides comprehensive visibility into MCP server operations while maintaining high performance and automatic management of log files.