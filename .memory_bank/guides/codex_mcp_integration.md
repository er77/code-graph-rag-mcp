# Codex MCP Integration Guide

This guide describes the integration between xldb_proxy and Codex through the Model Context Protocol (MCP), enabling AI-assisted development and operations.

## Overview

The Codex MCP interface provides a JSON-RPC API that runs over the Model Context Protocol transport to control a local Codex engine. This experimental interface enables AI-powered assistance for database operations, query optimization, and system management.

**Status**: Experimental and subject to change without notice  
**Server binary**: `codex mcp` (or `codex-mcp-server`)  
**Transport**: Standard MCP over stdio (JSON-RPC 2.0, line-delimited)

## Architecture Integration

### MCP Protocol Stack

```
┌─────────────────────────────────────────┐
│           xldb_proxy Application        │
├─────────────────────────────────────────┤
│          Codex MCP Client               │
├─────────────────────────────────────────┤
│     JSON-RPC 2.0 over MCP Transport    │
├─────────────────────────────────────────┤
│           Codex MCP Server              │
├─────────────────────────────────────────┤
│           Local Codex Engine            │
└─────────────────────────────────────────┘
```

### Component Integration

```python
# xldb_proxy integration with Codex MCP
class CodexMCPClient:
    def __init__(self, server_command="codex mcp"):
        self.server_command = server_command
        self.process = None
        self.request_id = 0
    
    def start_server(self):
        """Start the Codex MCP server"""
        self.process = subprocess.Popen(
            self.server_command.split(),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
    
    def send_request(self, method: str, params: dict = None) -> dict:
        """Send JSON-RPC request to Codex server"""
        self.request_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method,
            "params": params or {}
        }
        
        # Send request
        request_line = json.dumps(request) + "\n"
        self.process.stdin.write(request_line)
        self.process.stdin.flush()
        
        # Read response
        response_line = self.process.stdout.readline()
        return json.loads(response_line)
```

## Core Functionality

### Conversation Management

#### Starting a New Conversation

```python
def create_codex_conversation(model: str = "gpt-5", 
                             profile: str = None,
                             approval_policy: str = "on-request") -> dict:
    """Create new Codex conversation for database assistance"""
    
    params = {
        "model": model,
        "approvalPolicy": approval_policy,
        "sandbox": "workspace-write",
        "cwd": os.getcwd(),
        "baseInstructions": """
You are an AI assistant specialized in database operations and xldb_proxy management.
You can help with:
- SQL query optimization
- Database schema analysis
- Connection troubleshooting
- Performance monitoring
- Configuration management
        """,
        "includePlanTool": True
    }
    
    if profile:
        params["profile"] = profile
    
    response = codex_client.send_request("newConversation", params)
    return response["result"]

# Example usage
conversation = create_codex_conversation(
    model="o3",
    approval_policy="on-request"
)
conversation_id = conversation["conversationId"]
```

#### Sending Messages

```python
def send_database_query_for_analysis(conversation_id: str, 
                                    query: str, 
                                    performance_data: dict = None) -> dict:
    """Send database query to Codex for optimization analysis"""
    
    message_items = [
        {
            "type": "text",
            "text": f"""
Please analyze this SQL query for optimization opportunities:

Query:
```sql
{query}
```

Performance Data:
- Execution Time: {performance_data.get('execution_time_ms', 'N/A')}ms
- Rows Returned: {performance_data.get('row_count', 'N/A')}
- Connection Type: {performance_data.get('engine_type', 'N/A')}

Please provide:
1. Query optimization suggestions
2. Index recommendations
3. Potential performance bottlenecks
4. Alternative query approaches
            """
        }
    ]
    
    params = {
        "conversationId": conversation_id,
        "items": message_items
    }
    
    return codex_client.send_request("sendUserMessage", params)
```

### Database Operations Assistance

#### Schema Analysis

```python
def analyze_database_schema(connection_key: str, tables: list) -> dict:
    """Use Codex to analyze database schema and relationships"""
    
    # Get schema information
    schema_data = get_database_schema(connection_key, tables)
    
    conversation = create_codex_conversation(
        model="gpt-5",
        approval_policy="on-request"
    )
    
    message = f"""
Analyze this database schema and provide insights:

Schema Information:
{json.dumps(schema_data, indent=2)}

Please provide:
1. Schema design analysis
2. Normalization recommendations
3. Missing indexes suggestions
4. Potential relationship issues
5. Data modeling improvements
    """
    
    send_message_result = codex_client.send_request("sendUserMessage", {
        "conversationId": conversation["conversationId"],
        "items": [{"type": "text", "text": message}]
    })
    
    return {
        "conversation_id": conversation["conversationId"],
        "analysis_request": send_message_result
    }

def get_database_schema(connection_key: str, tables: list) -> dict:
    """Extract comprehensive schema information"""
    connection = get_connection(connection_key)
    schema = {}
    
    for table in tables:
        # Get columns
        columns_query = connection.columns_query(table, is_admin=True)
        columns = connection.execute_query(columns_query).fetchall()
        
        # Get indexes (if supported)
        try:
            indexes_query = f"SHOW INDEXES FROM {table}"
            indexes = connection.execute_query(indexes_query).fetchall()
        except:
            indexes = []
        
        schema[table] = {
            "columns": [dict(col) for col in columns],
            "indexes": [dict(idx) for idx in indexes]
        }
    
    return schema
```

#### Query Optimization Workflow

```python
class QueryOptimizationWorkflow:
    def __init__(self, codex_client: CodexMCPClient):
        self.codex_client = codex_client
        self.conversation_id = None
    
    def start_optimization_session(self):
        """Start optimization session with specialized context"""
        conversation = create_codex_conversation(
            model="o3",
            approval_policy="on-request"
        )
        self.conversation_id = conversation["conversationId"]
        
        # Set context for query optimization
        context_message = """
I need help optimizing SQL queries for a multi-database proxy system (xldb_proxy).
The system supports: PostgreSQL, MySQL, ClickHouse, DuckDB, Oracle, MSSQL, SQLite.

Focus areas:
1. Cross-database query optimization
2. Connection pool efficiency  
3. Result caching strategies
4. Performance monitoring
        """
        
        self.codex_client.send_request("sendUserMessage", {
            "conversationId": self.conversation_id,
            "items": [{"type": "text", "text": context_message}]
        })
    
    def optimize_query(self, query_data: dict) -> dict:
        """Request query optimization from Codex"""
        optimization_request = f"""
Query to optimize:
- SQL: {query_data['sql']}
- Engine: {query_data['engine_type']}
- Current execution time: {query_data['execution_time_ms']}ms
- Rows returned: {query_data['row_count']}
- Schema context: {json.dumps(query_data.get('schema_context', {}), indent=2)}

Please provide optimized version with explanation.
        """
        
        return self.codex_client.send_request("sendUserMessage", {
            "conversationId": self.conversation_id,
            "items": [{"type": "text", "text": optimization_request}]
        })
    
    def get_caching_recommendations(self, query_patterns: list) -> dict:
        """Get caching strategy recommendations"""
        patterns_text = "\n".join([
            f"- {pattern['sql'][:100]}... (freq: {pattern['frequency']})"
            for pattern in query_patterns
        ])
        
        caching_request = f"""
Based on these frequent query patterns:
{patterns_text}

Recommend:
1. Which queries should be cached
2. Cache TTL strategies
3. Cache invalidation triggers
4. Memory usage optimization
        """
        
        return self.codex_client.send_request("sendUserMessage", {
            "conversationId": self.conversation_id,
            "items": [{"type": "text", "text": caching_request}]
        })
```

### Event Handling

#### Real-time Events

```python
class CodexEventHandler:
    def __init__(self):
        self.event_handlers = {}
    
    def register_handler(self, event_type: str, handler_func):
        """Register handler for specific event types"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler_func)
    
    def handle_event(self, event: dict):
        """Process incoming Codex events"""
        event_type = event.get("method")
        
        if event_type == "codex/event":
            self._handle_codex_event(event["params"])
        elif event_type == "loginChatGptComplete":
            self._handle_auth_complete(event["params"])
        elif event_type == "authStatusChange":
            self._handle_auth_change(event["params"])
    
    def _handle_codex_event(self, event_data: dict):
        """Handle Codex execution events"""
        event_msg = event_data.get("eventMsg", {})
        event_type = event_msg.get("type")
        
        if event_type == "agent_output":
            self._handle_agent_output(event_msg.get("content"))
        elif event_type == "tool_call":
            self._handle_tool_call(event_msg.get("tool_call"))
        elif event_type == "error":
            self._handle_error(event_msg.get("error"))
    
    def _handle_agent_output(self, content: str):
        """Process agent output for database insights"""
        # Extract SQL optimizations, recommendations, etc.
        if "OPTIMIZED QUERY:" in content:
            optimized_sql = extract_optimized_query(content)
            store_optimization_suggestion(optimized_sql)
        
        if "RECOMMENDATION:" in content:
            recommendation = extract_recommendation(content)
            log_optimization_recommendation(recommendation)
    
    def _handle_tool_call(self, tool_call: dict):
        """Handle Codex tool execution"""
        tool_name = tool_call.get("name")
        
        if tool_name == "execute_query":
            # Codex wants to execute a query
            query_params = tool_call.get("params", {})
            result = execute_codex_query(query_params)
            return {"result": result}
        
        elif tool_name == "analyze_schema":
            # Codex wants schema information
            schema_params = tool_call.get("params", {})
            schema_data = get_schema_for_codex(schema_params)
            return {"schema": schema_data}
```

### Approval Workflow

#### Command Approval System

```python
class CodexApprovalManager:
    def __init__(self):
        self.pending_approvals = {}
    
    def handle_approval_request(self, request: dict) -> dict:
        """Handle approval requests from Codex"""
        request_type = request.get("method")
        
        if request_type == "applyPatchApproval":
            return self._handle_patch_approval(request["params"])
        elif request_type == "execCommandApproval":
            return self._handle_command_approval(request["params"])
    
    def _handle_patch_approval(self, params: dict) -> dict:
        """Handle file modification approval"""
        conversation_id = params["conversationId"]
        call_id = params["callId"]
        file_changes = params["fileChanges"]
        reason = params.get("reason", "")
        
        # Analyze file changes for database-related modifications
        analysis = self._analyze_file_changes(file_changes)
        
        # Present to user for approval
        approval_request = {
            "type": "file_modification",
            "conversation_id": conversation_id,
            "call_id": call_id,
            "changes": file_changes,
            "reason": reason,
            "analysis": analysis,
            "risk_level": self._assess_risk_level(file_changes)
        }
        
        # Store for user decision
        self.pending_approvals[call_id] = approval_request
        
        # Return decision (would be from user interface)
        return {"decision": "allow"}  # or "deny"
    
    def _handle_command_approval(self, params: dict) -> dict:
        """Handle command execution approval"""
        conversation_id = params["conversationId"]
        call_id = params["callId"]
        command = params["command"]
        cwd = params.get("cwd", "")
        reason = params.get("reason", "")
        
        # Analyze command safety
        safety_analysis = self._analyze_command_safety(command)
        
        approval_request = {
            "type": "command_execution",
            "conversation_id": conversation_id,
            "call_id": call_id,
            "command": command,
            "working_directory": cwd,
            "reason": reason,
            "safety_analysis": safety_analysis
        }
        
        self.pending_approvals[call_id] = approval_request
        
        # Auto-approve safe database operations
        if safety_analysis["auto_approve"]:
            return {"decision": "allow"}
        
        # Require manual approval for potentially risky operations
        return {"decision": "deny"}  # User must manually approve
    
    def _analyze_command_safety(self, command: str) -> dict:
        """Analyze command for safety and database relevance"""
        safe_db_commands = [
            "SELECT", "SHOW", "DESCRIBE", "EXPLAIN",
            "psql -c 'SELECT'", "mysql -e 'SELECT'",
            "python -c 'import'", "pip list"
        ]
        
        risky_commands = [
            "DROP", "DELETE", "TRUNCATE", "ALTER",
            "rm ", "sudo ", "chmod +x"
        ]
        
        is_safe = any(safe_cmd in command.upper() for safe_cmd in safe_db_commands)
        is_risky = any(risky_cmd in command.upper() for risky_cmd in risky_commands)
        
        return {
            "auto_approve": is_safe and not is_risky,
            "risk_level": "high" if is_risky else "low" if is_safe else "medium",
            "database_related": any(db in command.lower() for db in ["sql", "db", "database", "query"])
        }
```

## Integration with xldb_proxy Components

### Query Engine Integration

```python
class CodexEnhancedQueryEngine:
    def __init__(self, codex_client: CodexMCPClient):
        self.codex_client = codex_client
        self.optimization_cache = {}
    
    def execute_with_codex_optimization(self, query_params: dict) -> dict:
        """Execute query with Codex optimization suggestions"""
        
        # Check if we have cached optimization for this query
        query_hash = hash(query_params["sql"])
        
        if query_hash in self.optimization_cache:
            optimized_query = self.optimization_cache[query_hash]
        else:
            # Request optimization from Codex
            optimization_result = self._request_optimization(query_params)
            optimized_query = optimization_result.get("optimized_sql", query_params["sql"])
            
            # Cache optimization
            self.optimization_cache[query_hash] = optimized_query
        
        # Execute optimized query
        result = execute_database_query({
            **query_params,
            "sql": optimized_query
        })
        
        # Track performance improvement
        if "original_execution_time" in query_params:
            improvement = calculate_performance_improvement(
                query_params["original_execution_time"],
                result["execution_time_ms"]
            )
            log_optimization_impact(query_hash, improvement)
        
        return result
    
    def _request_optimization(self, query_params: dict) -> dict:
        """Request query optimization from Codex"""
        conversation = create_codex_conversation()
        
        optimization_request = {
            "conversationId": conversation["conversationId"],
            "items": [{
                "type": "text",
                "text": f"""
Optimize this SQL query for {query_params['engine_type']}:

```sql
{query_params['sql']}
```

Context:
- Database: {query_params.get('database', 'Unknown')}
- Expected rows: {query_params.get('expected_rows', 'Unknown')}
- Frequency: {query_params.get('frequency', 'Unknown')}

Return optimized SQL and explanation.
                """
            }]
        }
        
        response = self.codex_client.send_request("sendUserMessage", optimization_request)
        return self._parse_optimization_response(response)
```

### Configuration Management

```python
class CodexConfigurationAssistant:
    def __init__(self, codex_client: CodexMCPClient):
        self.codex_client = codex_client
    
    def analyze_configuration(self, config_data: dict) -> dict:
        """Use Codex to analyze xldb_proxy configuration"""
        
        conversation = create_codex_conversation(
            model="gpt-5",
            approval_policy="on-request"
        )
        
        analysis_request = f"""
Analyze this xldb_proxy configuration for optimization opportunities:

Configuration:
{json.dumps(config_data, indent=2)}

Please provide:
1. Performance optimization suggestions
2. Security recommendations
3. Resource allocation analysis
4. Best practices compliance
        """
        
        self.codex_client.send_request("sendUserMessage", {
            "conversationId": conversation["conversationId"],
            "items": [{"type": "text", "text": analysis_request}]
        })
        
        return {"conversation_id": conversation["conversationId"]}
    
    def generate_optimized_config(self, current_config: dict, 
                                 requirements: dict) -> dict:
        """Generate optimized configuration based on requirements"""
        
        conversation = create_codex_conversation()
        
        config_request = f"""
Generate optimized xldb_proxy configuration:

Current Config:
{json.dumps(current_config, indent=2)}

Requirements:
- Environment: {requirements.get('environment', 'production')}
- Expected Load: {requirements.get('expected_load', 'medium')}
- Security Level: {requirements.get('security_level', 'high')}
- Database Types: {requirements.get('database_types', [])}

Generate TOML configuration with explanations.
        """
        
        return self.codex_client.send_request("sendUserMessage", {
            "conversationId": conversation["conversationId"],
            "items": [{"type": "text", "text": config_request}]
        })
```

## Error Handling and Recovery

```python
class CodexErrorHandler:
    def __init__(self):
        self.error_patterns = {}
        self.recovery_strategies = {}
    
    def handle_codex_error(self, error: dict) -> dict:
        """Handle errors from Codex integration"""
        error_type = error.get("type")
        error_message = error.get("message", "")
        
        if error_type == "connection_error":
            return self._handle_connection_error(error)
        elif error_type == "model_error":
            return self._handle_model_error(error)
        elif error_type == "approval_timeout":
            return self._handle_approval_timeout(error)
        else:
            return self._handle_generic_error(error)
    
    def _handle_connection_error(self, error: dict) -> dict:
        """Handle Codex server connection errors"""
        # Attempt to restart Codex server
        try:
            restart_codex_server()
            return {"status": "recovered", "action": "server_restarted"}
        except Exception as e:
            return {"status": "failed", "error": str(e)}
    
    def _handle_model_error(self, error: dict) -> dict:
        """Handle model-specific errors"""
        # Fall back to simpler model or local processing
        return {
            "status": "fallback",
            "action": "using_local_optimization",
            "message": "Codex unavailable, using local query optimization"
        }
```

## Best Practices

### Performance Optimization

1. **Conversation Reuse**: Maintain long-running conversations for related tasks
2. **Response Caching**: Cache optimization suggestions for similar queries
3. **Batch Processing**: Group related requests to minimize round trips
4. **Async Processing**: Handle Codex responses asynchronously

### Security Considerations

1. **Approval Workflows**: Always require approval for data modifications
2. **Sandbox Mode**: Use appropriate sandbox levels for different operations
3. **Input Validation**: Validate all data sent to Codex
4. **Audit Logging**: Log all Codex interactions for security review

### Integration Guidelines

1. **Graceful Degradation**: Ensure xldb_proxy works without Codex
2. **Error Recovery**: Implement robust error handling and fallbacks
3. **Resource Management**: Monitor and limit Codex resource usage
4. **Testing**: Thoroughly test Codex integration in all scenarios

This Codex MCP integration enhances xldb_proxy with AI-powered database optimization, intelligent query analysis, and automated configuration management while maintaining security and reliability standards.