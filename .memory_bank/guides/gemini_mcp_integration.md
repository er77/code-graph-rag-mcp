# Gemini MCP Integration Guide

This guide describes the integration between xldb_proxy and Gemini through the Model Context Protocol (MCP), enabling AI-assisted development, analysis, and research operations.

## Overview

The Gemini MCP interface provides a standardized MCP tool that connects the Gemini CLI to the MCP ecosystem. This integration enables AI-powered assistance for code analysis, development tasks, research, and system management using Google's Gemini models.

**Status**: Stable (Version 1.1.4)
**Tool**: `gemini-cli` MCP tool
**Protocol**: Standard MCP over stdio
**Models**: Gemini-2.5-Pro, Gemini-2.5-Flash
**License**: MIT

## Architecture Integration

### MCP Protocol Stack

```
┌─────────────────────────────────────────┐
│           xldb_proxy Application        │
├─────────────────────────────────────────┤
│          Gemini MCP Client              │
├─────────────────────────────────────────┤
│     Standard MCP Protocol Transport    │
├─────────────────────────────────────────┤
│           Gemini MCP Tool               │
├─────────────────────────────────────────┤
│        Gemini AI Service (Cloud)       │
└─────────────────────────────────────────┘
```

### Component Integration

```python
# xldb_proxy integration with Gemini MCP
class GeminiMCPClient:
    def __init__(self):
        self.available_tools = [
            "mcp__gemini-cli__ask-gemini",
            "mcp__gemini-cli__ping",
            "mcp__gemini-cli__Help",
            "mcp__gemini-cli__brainstorm",
            "mcp__gemini-cli__fetch-chunk",
            "mcp__gemini-cli__timeout-test"
        ]

    def ask_gemini(self, prompt: str, model: str = None, sandbox: bool = False,
                   change_mode: bool = False) -> dict:
        """Send analysis request to Gemini via MCP"""
        params = {
            "prompt": prompt,
            "sandbox": sandbox,
            "changeMode": change_mode
        }

        if model:
            params["model"] = model

        return self.mcp_call("mcp__gemini-cli__ask-gemini", params)

    def brainstorm(self, prompt: str, domain: str = None,
                   idea_count: int = 12) -> dict:
        """Generate ideas using Gemini's brainstorming capabilities"""
        params = {
            "prompt": prompt,
            "ideaCount": idea_count,
            "includeAnalysis": True
        }

        if domain:
            params["domain"] = domain

        return self.mcp_call("mcp__gemini-cli__brainstorm", params)
```

## Core Functionality

### Analysis and Code Review

#### File Analysis

```python
def analyze_database_code(file_path: str, analysis_type: str = "security") -> dict:
    """Use Gemini to analyze database code for issues"""

    prompt = f"""
    @{file_path} analyze this database code for {analysis_type} issues.

    Focus on:
    1. SQL injection vulnerabilities
    2. Connection security patterns
    3. Input validation
    4. Error handling
    5. Performance considerations

    Provide specific recommendations for xldb_proxy implementation.
    """

    response = gemini_client.ask_gemini(
        prompt=prompt,
        model="gemini-2.5-pro",
        change_mode=True
    )

    return response

# Example usage
security_analysis = analyze_database_code(
    "sqlengines/postgres.py",
    "security"
)
```

#### Multi-File Analysis

```python
def analyze_sql_engines(pattern: str = "sqlengines/*.py") -> dict:
    """Analyze multiple SQL engine files"""

    prompt = f"""
    @{pattern} analyze these SQL engine implementations.

    Compare and evaluate:
    1. Code consistency across engines
    2. Error handling patterns
    3. Security implementation
    4. Performance optimization opportunities
    5. Architectural improvements

    Provide unified recommendations for xldb_proxy.
    """

    return gemini_client.ask_gemini(
        prompt=prompt,
        model="gemini-2.5-pro"
    )
```

### Development Assistance

#### Code Generation and Modification

```python
def generate_database_engine(engine_type: str, requirements: dict) -> dict:
    """Generate new database engine implementation"""

    prompt = f"""
    Create a new {engine_type} database engine for xldb_proxy following these requirements:

    Requirements:
    {json.dumps(requirements, indent=2)}

    Based on existing patterns in @sqlengines/postgres.py and @sqlengines/mysql_.py:
    1. Implement connection management
    2. Add query execution methods
    3. Include error handling
    4. Follow xldb_proxy coding standards
    5. Add comprehensive logging

    Generate complete implementation with proper documentation.
    """

    return gemini_client.ask_gemini(
        prompt=prompt,
        model="gemini-2.5-pro",
        change_mode=True,
        sandbox=False
    )
```

#### Code Review and Optimization

```python
def review_implementation(file_path: str, focus_area: str) -> dict:
    """Review implementation for specific focus area"""

    prompt = f"""
    @{file_path} review this implementation focusing on {focus_area}.

    Analyze:
    1. Code quality and maintainability
    2. Performance implications
    3. Security considerations
    4. Compliance with xldb_proxy patterns
    5. Integration compatibility

    Provide actionable improvement suggestions.
    """

    return gemini_client.ask_gemini(
        prompt=prompt,
        model="gemini-2.5-pro"
    )
```

### Research and Brainstorming

#### Technology Research

```python
def research_database_technology(topic: str, constraints: dict = None) -> dict:
    """Research database technology using Gemini's brainstorming"""

    research_prompt = f"""
    Research {topic} for xldb_proxy database proxy implementation.

    Focus areas:
    1. Current market solutions and approaches
    2. Technical implementation strategies
    3. Performance and scalability considerations
    4. Integration complexity assessment
    5. Security and compliance requirements
    """

    params = {
        "prompt": research_prompt,
        "domain": "software",
        "ideaCount": 15,
        "includeAnalysis": True
    }

    if constraints:
        params["constraints"] = json.dumps(constraints)

    return gemini_client.brainstorm(**params)

# Example usage
research_results = research_database_technology(
    "real-time query optimization",
    constraints={
        "budget": "medium",
        "complexity": "manageable",
        "timeline": "6 months"
    }
)
```

#### Architecture Brainstorming

```python
def brainstorm_architecture_improvements(current_issues: list) -> dict:
    """Brainstorm architectural improvements"""

    prompt = f"""
    Brainstorm architectural improvements for xldb_proxy addressing these issues:

    Current Issues:
    {chr(10).join(f'- {issue}' for issue in current_issues)}

    Consider:
    1. Scalability enhancements
    2. Performance optimizations
    3. Security improvements
    4. Maintainability upgrades
    5. Integration simplifications

    Provide creative and practical solutions.
    """

    return gemini_client.brainstorm(
        prompt=prompt,
        domain="software",
        idea_count=20,
        methodology="design-thinking"
    )
```

## Integration with xldb_proxy Components

### SQL Engine Enhancement

```python
class GeminiEnhancedSQLEngine:
    def __init__(self, engine_name: str, gemini_client: GeminiMCPClient):
        self.engine_name = engine_name
        self.gemini_client = gemini_client
        self.optimization_cache = {}

    def optimize_query_with_gemini(self, query: str, context: dict) -> dict:
        """Optimize SQL query using Gemini analysis"""

        query_hash = hash(query)

        if query_hash in self.optimization_cache:
            return self.optimization_cache[query_hash]

        optimization_prompt = f"""
        Optimize this SQL query for {self.engine_name}:

        Query:
        ```sql
        {query}
        ```

        Context:
        - Database: {context.get('database', 'Unknown')}
        - Expected rows: {context.get('expected_rows', 'Unknown')}
        - Engine: {self.engine_name}
        - Performance target: {context.get('performance_target', 'standard')}

        Provide:
        1. Optimized query
        2. Explanation of changes
        3. Performance impact estimation
        4. Index recommendations
        """

        result = self.gemini_client.ask_gemini(
            prompt=optimization_prompt,
            model="gemini-2.5-pro"
        )

        # Cache optimization
        self.optimization_cache[query_hash] = result

        return result

    def analyze_query_performance(self, query: str, execution_stats: dict) -> dict:
        """Analyze query performance with Gemini"""

        analysis_prompt = f"""
        Analyze query performance for {self.engine_name}:

        Query:
        ```sql
        {query}
        ```

        Execution Statistics:
        {json.dumps(execution_stats, indent=2)}

        Identify:
        1. Performance bottlenecks
        2. Optimization opportunities
        3. Index suggestions
        4. Query rewriting options
        5. Configuration recommendations
        """

        return self.gemini_client.ask_gemini(
            prompt=analysis_prompt,
            model="gemini-2.5-pro"
        )
```

### Configuration Analysis

```python
class GeminiConfigurationAnalyzer:
    def __init__(self, gemini_client: GeminiMCPClient):
        self.gemini_client = gemini_client

    def analyze_configuration(self, config_path: str = "xldb-sql-proxy.conf") -> dict:
        """Analyze xldb_proxy configuration using Gemini"""

        analysis_prompt = f"""
        @{config_path} analyze this xldb_proxy configuration.

        Evaluate:
        1. Security settings and recommendations
        2. Performance optimization opportunities
        3. Resource allocation efficiency
        4. Best practices compliance
        5. Environment-specific adjustments

        Consider xldb_proxy architecture from @main.py and @xldb_config.py
        """

        return self.gemini_client.ask_gemini(
            prompt=analysis_prompt,
            model="gemini-2.5-pro"
        )

    def generate_optimized_config(self, requirements: dict) -> dict:
        """Generate optimized configuration"""

        config_prompt = f"""
        Generate optimized xldb_proxy configuration based on:

        Requirements:
        {json.dumps(requirements, indent=2)}

        Reference existing configuration @xldb-sql-proxy.conf and structure from @xldb_config.py

        Optimize for:
        1. Performance and scalability
        2. Security and compliance
        3. Resource efficiency
        4. Operational simplicity
        5. Environment compatibility
        """

        return self.gemini_client.ask_gemini(
            prompt=config_prompt,
            model="gemini-2.5-pro",
            change_mode=True
        )
```

### Error Analysis and Debugging

```python
class GeminiErrorAnalyzer:
    def __init__(self, gemini_client: GeminiMCPClient):
        self.gemini_client = gemini_client

    def analyze_error_patterns(self, log_files: list) -> dict:
        """Analyze error patterns across log files"""

        files_pattern = " ".join(f"@{log_file}" for log_file in log_files)

        analysis_prompt = f"""
        {files_pattern} analyze error patterns in these xldb_proxy logs.

        Identify:
        1. Common error patterns and root causes
        2. Performance degradation indicators
        3. Security-related events
        4. Database connection issues
        5. Query execution problems

        Provide actionable troubleshooting recommendations.
        """

        return self.gemini_client.ask_gemini(
            prompt=analysis_prompt,
            model="gemini-2.5-pro"
        )

    def diagnose_specific_error(self, error_message: str, context_files: list) -> dict:
        """Diagnose specific error with context"""

        context_pattern = " ".join(f"@{file}" for file in context_files)

        diagnostic_prompt = f"""
        Diagnose this xldb_proxy error:

        Error: {error_message}

        Context files: {context_pattern}

        Provide:
        1. Root cause analysis
        2. Step-by-step debugging approach
        3. Code fix recommendations
        4. Prevention strategies
        5. Testing verification steps
        """

        return self.gemini_client.ask_gemini(
            prompt=diagnostic_prompt,
            model="gemini-2.5-pro",
            change_mode=True
        )
```

## Advanced Usage Patterns

### Change Mode for Structured Edits

```python
def structured_code_improvement(file_path: str, improvement_type: str) -> dict:
    """Use change mode for structured code improvements"""

    prompt = f"""
    @{file_path} improve this code for {improvement_type}.

    Apply structured improvements:
    1. Add comprehensive error handling
    2. Implement proper logging
    3. Optimize performance bottlenecks
    4. Enhance security measures
    5. Update documentation

    Return structured edit suggestions that can be applied directly.
    """

    return gemini_client.ask_gemini(
        prompt=prompt,
        model="gemini-2.5-pro",
        change_mode=True
    )
```

### Sandbox Mode for Safe Testing

```python
def test_code_changes_safely(code_snippet: str, test_requirements: str) -> dict:
    """Test code changes in sandbox mode"""

    prompt = f"""
    Test this code snippet safely:

    ```python
    {code_snippet}
    ```

    Test Requirements:
    {test_requirements}

    Verify:
    1. Functionality correctness
    2. Error handling
    3. Performance characteristics
    4. Security implications
    5. Integration compatibility
    """

    return gemini_client.ask_gemini(
        prompt=prompt,
        model="gemini-2.5-flash",
        sandbox=True
    )
```

### Chunked Response Handling

```python
def handle_large_analysis(file_pattern: str) -> dict:
    """Handle large analysis with chunked responses"""

    prompt = f"""
    @{file_pattern} perform comprehensive analysis of xldb_proxy codebase.

    Analyze:
    1. Architecture and design patterns
    2. Code quality and maintainability
    3. Performance and scalability
    4. Security implementation
    5. Testing coverage and strategies

    Provide detailed analysis with actionable recommendations.
    """

    response = gemini_client.ask_gemini(
        prompt=prompt,
        model="gemini-2.5-pro",
        change_mode=True
    )

    # Handle chunked response if needed
    if response.get("isChunked"):
        cache_key = response.get("cacheKey")
        total_chunks = response.get("totalChunks")

        full_response = response

        for chunk_index in range(2, total_chunks + 1):
            chunk_response = gemini_client.fetch_chunk(
                cache_key=cache_key,
                chunk_index=chunk_index
            )
            full_response["content"] += chunk_response["content"]

        return full_response

    return response
```

## Error Handling and Recovery

```python
class GeminiErrorHandler:
    def __init__(self, gemini_client: GeminiMCPClient):
        self.gemini_client = gemini_client
        self.retry_count = 3
        self.fallback_model = "gemini-2.5-flash"

    def robust_analysis(self, prompt: str, **kwargs) -> dict:
        """Perform analysis with error handling and fallback"""

        for attempt in range(self.retry_count):
            try:
                response = self.gemini_client.ask_gemini(
                    prompt=prompt,
                    **kwargs
                )

                if response.get("success", True):
                    return response

            except Exception as e:
                if attempt == self.retry_count - 1:
                    # Final attempt with fallback model
                    try:
                        return self.gemini_client.ask_gemini(
                            prompt=prompt,
                            model=self.fallback_model,
                            **{k: v for k, v in kwargs.items() if k != "model"}
                        )
                    except Exception as fallback_error:
                        return {
                            "success": False,
                            "error": str(fallback_error),
                            "fallback_attempted": True
                        }

                # Wait before retry
                time.sleep(2 ** attempt)

        return {"success": False, "error": "Max retries exceeded"}

    def validate_connection(self) -> dict:
        """Validate Gemini MCP connection"""
        try:
            response = self.gemini_client.ping("Connection test")
            return {
                "connected": True,
                "response": response
            }
        except Exception as e:
            return {
                "connected": False,
                "error": str(e)
            }
```

## Best Practices

### Performance Optimization

1. **Model Selection**: Use Gemini-2.5-Flash for quick analysis, Gemini-2.5-Pro for complex tasks
2. **Caching**: Cache frequent analysis results to reduce API calls
3. **Batch Processing**: Combine related analyses in single requests
4. **Change Mode**: Use structured change mode for code modifications

### Security Considerations

1. **Sandbox Mode**: Use sandbox for testing untrusted code
2. **Input Validation**: Validate all inputs before sending to Gemini
3. **Output Sanitization**: Review and sanitize all Gemini outputs
4. **Access Control**: Implement proper access controls for Gemini integration

### Integration Guidelines

1. **Graceful Degradation**: Ensure xldb_proxy works without Gemini
2. **Error Recovery**: Implement robust error handling and fallbacks
3. **Resource Management**: Monitor and limit Gemini resource usage
4. **Testing**: Thoroughly test Gemini integration in all scenarios

### Usage Patterns

1. **File Analysis**: Start with single files, then expand to patterns
2. **Clear Prompts**: Use specific, well-structured prompts
3. **Context Inclusion**: Include relevant project context
4. **Iterative Refinement**: Refine queries based on results

## MCP Command Reference

### Available Commands

1. **`mcp__gemini-cli__ask-gemini`**
   - Purpose: General analysis and questioning
   - Parameters: prompt, model, sandbox, changeMode
   - Usage: Primary command for most interactions

2. **`mcp__gemini-cli__brainstorm`**
   - Purpose: Creative ideation and problem-solving
   - Parameters: prompt, domain, ideaCount, methodology
   - Usage: Research and innovation tasks

3. **`mcp__gemini-cli__ping`**
   - Purpose: Connection testing
   - Parameters: prompt (optional)
   - Usage: Connectivity verification

4. **`mcp__gemini-cli__Help`**
   - Purpose: Documentation and help
   - Parameters: None
   - Usage: Get help information

5. **`mcp__gemini-cli__fetch-chunk`**
   - Purpose: Retrieve chunked responses
   - Parameters: cacheKey, chunkIndex
   - Usage: Handle large response data

6. **`mcp__gemini-cli__timeout-test`**
   - Purpose: Timeout testing
   - Parameters: duration
   - Usage: Testing and debugging

### File Pattern Support

- **Single files**: `@filename.ext`
- **Multiple files**: `@file1.py @file2.py`
- **Wildcards**: `@*.json`, `@src/*.py`
- **Directories**: `@src/`, `@tests/`

This Gemini MCP integration enhances xldb_proxy with AI-powered code analysis, development assistance, research capabilities, and intelligent problem-solving while maintaining performance and security standards.