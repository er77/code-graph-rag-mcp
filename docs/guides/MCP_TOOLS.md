# MCP Tools Reference

Complete documentation for all 13 MCP tools available in the Code Graph RAG server.

## Core Analysis Tools

### `index`
**Description**: Index codebase and build entity relationship graph

**Parameters**:
- `directory` (string): Path to codebase directory
- `incremental` (boolean, optional): Enable incremental parsing
- `excludePatterns` (array, optional): Patterns to exclude from parsing

**Example**:
```json
{
  "name": "index",
  "arguments": {
    "directory": "/path/to/project",
    "incremental": true,
    "excludePatterns": ["node_modules/**", "*.min.js"]
  }
}
```

### `list_file_entities`
**Description**: Extract and list all entities (functions, classes, etc.) from a specific file

**Parameters**:
- `filePath` (string): Path to file to analyze
- `entityTypes` (array, optional): Filter by entity types

**Example**:
```json
{
  "name": "list_file_entities",
  "arguments": {
    "filePath": "src/utils/auth.ts",
    "entityTypes": ["function", "class"]
  }
}
```

### `list_entity_relationships`
**Description**: Show relationships for a specific entity

**Parameters**:
- `entityName` (string): Name of entity to analyze
- `depth` (number, optional): Relationship traversal depth (default: 1)
- `relationshipTypes` (array, optional): Filter relationship types

**Example**:
```json
{
  "name": "list_entity_relationships",
  "arguments": {
    "entityName": "UserService",
    "depth": 2,
    "relationshipTypes": ["calls", "imports"]
  }
}
```

### `query`
**Description**: Execute natural language queries against the codebase

**Parameters**:
- `query` (string): Natural language query
- `limit` (number, optional): Maximum results to return

**Example**:
```json
{
  "name": "query",
  "arguments": {
    "query": "Find all authentication functions",
    "limit": 10
  }
}
```

### `get_metrics`
**Description**: Retrieve system performance and analysis metrics

**Parameters**: None

**Example**:
```json
{
  "name": "get_metrics",
  "arguments": {}
}
```

## Semantic Analysis Tools

### `semantic_search`
**Description**: Search code using natural language descriptions

**Parameters**:
- `query` (string): Natural language search query
- `limit` (number, optional): Maximum results (default: 10)

**Example**:
```json
{
  "name": "semantic_search",
  "arguments": {
    "query": "functions that validate user input",
    "limit": 5
  }
}
```

### `find_similar_code`
**Description**: Find code blocks similar to a given snippet

**Parameters**:
- `code` (string): Code snippet to find similarities for
- `threshold` (number, optional): Similarity threshold 0-1 (default: 0.7)
- `limit` (number, optional): Maximum results

**Example**:
```json
{
  "name": "find_similar_code",
  "arguments": {
    "code": "async function fetchData(url) { return await fetch(url); }",
    "threshold": 0.8,
    "limit": 5
  }
}
```

### `analyze_code_impact`
**Description**: Analyze potential impact of changes to a specific entity

**Parameters**:
- `entityId` (string): Entity ID to analyze
- `depth` (number, optional): Analysis depth (default: 2)

**Example**:
```json
{
  "name": "analyze_code_impact",
  "arguments": {
    "entityId": "UserService.authenticate",
    "depth": 3
  }
}
```

### `detect_code_clones`
**Description**: Find duplicate or highly similar code blocks

**Parameters**:
- `minSimilarity` (number, optional): Minimum similarity threshold (default: 0.8)
- `scope` (string, optional): Scope of analysis: "all", "file", "module"

**Example**:
```json
{
  "name": "detect_code_clones",
  "arguments": {
    "minSimilarity": 0.9,
    "scope": "all"
  }
}
```

### `suggest_refactoring`
**Description**: Generate AI-powered refactoring suggestions

**Parameters**:
- `filePath` (string): File to analyze for refactoring
- `focusArea` (string, optional): Specific area to focus on

**Example**:
```json
{
  "name": "suggest_refactoring",
  "arguments": {
    "filePath": "src/components/UserForm.tsx",
    "focusArea": "complexity reduction"
  }
}
```

## Advanced Analytics Tools

### `cross_language_search`
**Description**: Search for patterns across multiple programming languages

**Parameters**:
- `query` (string): Search query or pattern
- `languages` (array, optional): Languages to search in

**Example**:
```json
{
  "name": "cross_language_search",
  "arguments": {
    "query": "database connection patterns",
    "languages": ["typescript", "python"]
  }
}
```

### `analyze_hotspots`
**Description**: Identify code hotspots based on complexity, changes, or coupling

**Parameters**:
- `metric` (string, optional): Analysis metric: "complexity", "changes", "coupling"
- `limit` (number, optional): Maximum hotspots to return

**Example**:
```json
{
  "name": "analyze_hotspots",
  "arguments": {
    "metric": "complexity",
    "limit": 10
  }
}
```

### `find_related_concepts`
**Description**: Find code related to a concept or entity

**Parameters**:
- `entityId` (string): Entity to find related concepts for
- `limit` (number, optional): Maximum results

**Example**:
```json
{
  "name": "find_related_concepts",
  "arguments": {
    "entityId": "authentication",
    "limit": 8
  }
}
```

## Common Patterns

### Chaining Operations
Many tools can be chained for comprehensive analysis:

1. First, index the codebase: `index`
2. Search for entities: `semantic_search`
3. Analyze relationships: `list_entity_relationships`
4. Check for duplicates: `detect_code_clones`
5. Get refactoring suggestions: `suggest_refactoring`

### Performance Tips

- Use `incremental: true` for large codebases
- Set appropriate `excludePatterns` to skip irrelevant files
- Adjust `limit` parameters to control result size
- Use `threshold` parameters to fine-tune similarity matching

### Error Handling

All tools return structured responses with error information when issues occur:

```json
{
  "success": false,
  "error": "Entity not found: InvalidEntityName",
  "errorCode": "ENTITY_NOT_FOUND"
}
```

## Integration Examples

### With Claude Desktop
Simply ask natural language questions:
- "What functions handle user authentication?"
- "Find code similar to the login function"
- "Show me all dependencies of the UserService class"
- "What are the complexity hotspots in this codebase?"

### Command Line Testing
```bash
# Test tool directly
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"semantic_search","arguments":{"query":"authentication functions"}},"id":"1"}' | npx @er77/code-graph-rag-mcp .
```