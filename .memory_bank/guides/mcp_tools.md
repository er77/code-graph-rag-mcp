# MCP Tools Reference - Code Graph RAG

## 📋 Complete Tool Portfolio

The Code Graph RAG MCP server provides 13 specialized tools for comprehensive code analysis. Each tool serves specific analysis needs and can be combined for powerful codebase insights.

## 🔧 Core Analysis Tools

### `index`
**Purpose**: Build initial graph representation of the codebase

**Description**: Indexes the entire codebase using multi-agent parsing to extract entities (functions, classes, variables) and relationships (calls, imports, inheritance). This is typically the first operation performed.

**Parameters**:
- `directory` (string): Absolute path to the codebase directory
- `incremental` (boolean, optional): Enable incremental parsing for faster updates (default: false)
- `excludePatterns` (array, optional): Glob patterns to exclude from analysis

**Usage Example**:
```json
{
  "name": "index",
  "arguments": {
    "directory": "/home/user/my-project",
    "incremental": true,
    "excludePatterns": ["node_modules/**", "*.min.js", "dist/**"]
  }
}
```

**Performance**: Processes 100+ files per second, memory usage <1GB for large repositories

---

### `list_file_entities`
**Purpose**: Extract all entities from a specific file

**Description**: Uses Tree-sitter parsing to extract detailed entity information from a single file, including functions, classes, interfaces, variables, and their metadata.

**Parameters**:
- `filePath` (string): Relative or absolute path to the file
- `entityTypes` (array, optional): Filter by specific entity types

**Supported Entity Types**: 
- `function`, `class`, `interface`, `variable`, `import`, `export`, `module`

**Usage Example**:
```json
{
  "name": "list_file_entities",
  "arguments": {
    "filePath": "src/auth/UserService.ts",
    "entityTypes": ["function", "class", "interface"]
  }
}
```

---

### `list_entity_relationships`
**Purpose**: Map relationships for a specific entity

**Description**: Traverses the graph to find all relationships connected to a given entity, providing insight into dependencies and usage patterns.

**Parameters**:
- `entityName` (string): Name of the entity to analyze
- `depth` (number, optional): Relationship traversal depth (default: 1, max: 5)
- `relationshipTypes` (array, optional): Filter by relationship types

**Relationship Types**:
- `imports`, `exports`, `calls`, `extends`, `implements`, `uses`, `contains`

**Usage Example**:
```json
{
  "name": "list_entity_relationships",
  "arguments": {
    "entityName": "UserService.authenticate",
    "depth": 2,
    "relationshipTypes": ["calls", "uses"]
  }
}
```

---

### `query`
**Purpose**: Execute natural language queries against the codebase

**Description**: Processes natural language queries and returns relevant entities, relationships, and code snippets using semantic understanding.

**Parameters**:
- `query` (string): Natural language description of what to find
- `limit` (number, optional): Maximum results to return (default: 10)

**Query Examples**:
- "Find all functions that handle user authentication"
- "Show database connection and query methods"
- "List error handling patterns"
- "Find API endpoint definitions"

**Usage Example**:
```json
{
  "name": "query",
  "arguments": {
    "query": "functions that validate user permissions",
    "limit": 15
  }
}
```

---

### `get_metrics`
**Purpose**: Retrieve system performance and codebase statistics

**Description**: Provides comprehensive metrics about the analysis system performance, codebase size, and processing statistics.

**Parameters**: None

**Metrics Included**:
- Codebase statistics (files, entities, relationships)
- Performance metrics (query times, cache hit rates)
- Memory usage and resource utilization
- Agent performance statistics

**Usage Example**:
```json
{
  "name": "get_metrics",
  "arguments": {}
}
```

## 🧠 Semantic Analysis Tools

### `semantic_search`
**Purpose**: Natural language code search with vector similarity

**Description**: Uses vector embeddings to find code that matches natural language descriptions, even when exact keywords don't match.

**Parameters**:
- `query` (string): Natural language description of desired code
- `limit` (number, optional): Maximum results (default: 10)
- `threshold` (number, optional): Similarity threshold 0-1 (default: 0.7)

**Advanced Features**:
- Cross-language semantic understanding
- Concept-based matching beyond keyword search
- Ranking by semantic relevance

**Usage Example**:
```json
{
  "name": "semantic_search",
  "arguments": {
    "query": "functions that sanitize and validate user input data",
    "limit": 8,
    "threshold": 0.75
  }
}
```

---

### `find_similar_code`
**Purpose**: Find code blocks similar to a given snippet

**Description**: Analyzes code structure and semantics to find similar implementations, useful for identifying patterns, potential refactoring targets, or code reuse opportunities.

**Parameters**:
- `code` (string): Code snippet to find similarities for
- `threshold` (number, optional): Similarity threshold 0-1 (default: 0.7)
- `limit` (number, optional): Maximum results (default: 10)
- `includeMetadata` (boolean, optional): Include detailed similarity analysis

**Similarity Analysis**:
- Structural similarity (AST-based)
- Semantic similarity (meaning-based)
- Functional similarity (behavior-based)

**Usage Example**:
```json
{
  "name": "find_similar_code", 
  "arguments": {
    "code": "async function processUserData(data) {\n  const validated = await validateInput(data);\n  return await saveToDatabase(validated);\n}",
    "threshold": 0.8,
    "limit": 5,
    "includeMetadata": true
  }
}
```

---

### `analyze_code_impact`
**Purpose**: Analyze the impact of potential changes to code entities

**Description**: Performs dependency analysis to understand what would be affected by changes to a specific entity, helping with refactoring and change impact assessment.

**Parameters**:
- `entityId` (string): Entity identifier to analyze
- `depth` (number, optional): Analysis traversal depth (default: 2)
- `includeIndirect` (boolean, optional): Include indirect dependencies

**Impact Analysis Types**:
- Direct dependencies (immediate callers/callees)
- Indirect dependencies (transitive relationships)
- Cross-module impacts
- Type system impacts (for TypeScript)

**Usage Example**:
```json
{
  "name": "analyze_code_impact",
  "arguments": {
    "entityId": "auth.UserService.updatePassword",
    "depth": 3,
    "includeIndirect": true
  }
}
```

---

### `detect_code_clones`
**Purpose**: Identify duplicate or highly similar code blocks

**Description**: Scans the codebase for code duplication using multiple detection algorithms, helping identify refactoring opportunities and maintain code quality.

**Parameters**:
- `minSimilarity` (number, optional): Minimum similarity threshold (default: 0.8)
- `scope` (string, optional): Analysis scope: "all", "file", "module" (default: "all")
- `ignoreComments` (boolean, optional): Exclude comments from analysis (default: true)

**Clone Detection Types**:
- **Type 1**: Exact duplicates (ignoring whitespace/comments)
- **Type 2**: Syntactic clones (identical structure, different names)
- **Type 3**: Near-miss clones (similar with minor modifications)
- **Type 4**: Semantic clones (different implementation, same behavior)

**Usage Example**:
```json
{
  "name": "detect_code_clones",
  "arguments": {
    "minSimilarity": 0.85,
    "scope": "all",
    "ignoreComments": true
  }
}
```

---

### `suggest_refactoring`
**Purpose**: Generate AI-powered refactoring suggestions

**Description**: Analyzes code for improvement opportunities and generates specific, actionable refactoring suggestions based on best practices and patterns.

**Parameters**:
- `filePath` (string): File to analyze for refactoring opportunities
- `focusArea` (string, optional): Specific improvement area to focus on
- `includeExamples` (boolean, optional): Include before/after code examples

**Focus Areas**:
- `complexity` - Reduce cyclomatic complexity
- `duplication` - Eliminate code duplication
- `naming` - Improve variable and function naming
- `structure` - Improve code organization
- `performance` - Optimize for better performance

**Usage Example**:
```json
{
  "name": "suggest_refactoring",
  "arguments": {
    "filePath": "src/components/UserDashboard.tsx",
    "focusArea": "complexity",
    "includeExamples": true
  }
}
```

## 🌐 Advanced Analytics Tools

### `cross_language_search`
**Purpose**: Search for patterns across multiple programming languages

**Description**: Finds similar patterns, implementations, or concepts across different programming languages in a multi-language codebase.

**Parameters**:
- `query` (string): Search pattern or natural language description
- `languages` (array, optional): Specific languages to search (default: all supported)
- `includeTranslations` (boolean, optional): Suggest equivalent implementations

**Supported Languages**:
- TypeScript, JavaScript, Python, Java, C/C++, Go, Rust, PHP, Ruby

**Usage Example**:
```json
{
  "name": "cross_language_search",
  "arguments": {
    "query": "database connection pooling implementations",
    "languages": ["typescript", "python", "java"],
    "includeTranslations": true
  }
}
```

---

### `analyze_hotspots`
**Purpose**: Identify problematic code areas based on various metrics

**Description**: Analyzes the codebase to identify hotspots - areas that may need attention based on complexity, change frequency, or coupling metrics.

**Parameters**:
- `metric` (string, optional): Analysis metric type (default: "complexity")
- `limit` (number, optional): Maximum hotspots to return (default: 10)
- `threshold` (number, optional): Minimum score threshold for inclusion

**Metric Types**:
- `complexity` - Cyclomatic complexity and cognitive load
- `changes` - Files/functions with frequent modifications
- `coupling` - High interdependency areas
- `size` - Oversized functions or classes
- `defects` - Areas prone to bugs based on patterns

**Usage Example**:
```json
{
  "name": "analyze_hotspots",
  "arguments": {
    "metric": "complexity",
    "limit": 15,
    "threshold": 7.0
  }
}
```

---

### `find_related_concepts`
**Purpose**: Discover conceptually related code across the codebase

**Description**: Uses semantic analysis to find code that deals with related concepts, even when there are no direct structural relationships.

**Parameters**:
- `entityId` (string): Starting entity or concept to find relations for
- `limit` (number, optional): Maximum related concepts to return (default: 10)
- `conceptDepth` (string, optional): Relationship distance: "close", "moderate", "distant"

**Concept Analysis**:
- Semantic relationships (similar purpose/domain)
- Functional relationships (similar behavior)
- Data flow relationships (similar data handling)
- Pattern relationships (similar implementation approaches)

**Usage Example**:
```json
{
  "name": "find_related_concepts",
  "arguments": {
    "entityId": "user-authentication",
    "limit": 12,
    "conceptDepth": "moderate"
  }
}
```

## 🔄 Tool Orchestration Patterns

### Sequential Analysis Workflow
```
1. index (build graph)
2. semantic_search (find areas of interest)
3. list_entity_relationships (understand connections)
4. analyze_code_impact (assess change implications)
5. suggest_refactoring (get improvement recommendations)
```

### Quality Assessment Workflow
```
1. index (establish baseline)
2. detect_code_clones (find duplications)
3. analyze_hotspots (identify problem areas)
4. suggest_refactoring (get solutions)
5. cross_language_search (check patterns across languages)
```

### Exploration Workflow
```
1. index (build knowledge graph)
2. query (natural language exploration)
3. find_similar_code (pattern discovery)
4. find_related_concepts (conceptual exploration)
5. list_file_entities (deep dive into specific files)
```

## 📊 Performance Characteristics

### Tool Response Times
| Tool | Simple Query | Complex Query | Large Codebase |
|------|-------------|---------------|----------------|
| `index` | 5-15s | 30-60s | 2-5 minutes |
| `semantic_search` | <100ms | <500ms | <1s |
| `list_file_entities` | <50ms | <100ms | <200ms |
| `query` | <200ms | <1s | <2s |
| `detect_code_clones` | 1-5s | 10-30s | 1-3 minutes |
| `analyze_hotspots` | <500ms | <2s | <5s |

### Memory Usage
- **With sqlite-vec**: 100-500MB for large codebases
- **Without sqlite-vec**: 500MB-2GB for large codebases
- **Concurrent queries**: 10+ supported simultaneously

### Scalability Limits
- **Files**: Tested up to 50,000+ files
- **Entities**: Scales to millions of entities
- **Relationships**: Handles complex graph structures efficiently
- **Languages**: Supports 6+ programming languages simultaneously

## 🎯 Best Practices

### Performance Optimization
1. **Install sqlite-vec** for 10-100x performance improvement
2. **Use incremental indexing** for large codebases
3. **Set appropriate excludePatterns** to skip irrelevant files
4. **Tune limit parameters** based on your analysis needs
5. **Cache results** for repeated analysis patterns

### Effective Query Patterns
1. **Start broad, then narrow**: Use general queries first, then specific ones
2. **Combine tools**: Chain tools for comprehensive analysis
3. **Use semantic search** for exploratory analysis
4. **Leverage metadata**: Include entity types and relationship filters
5. **Iterate with feedback**: Refine queries based on results

### Error Handling
All tools return structured error responses:
```json
{
  "success": false,
  "error": "Entity not found: InvalidEntityName",
  "errorCode": "ENTITY_NOT_FOUND",
  "suggestions": ["Check entity name spelling", "Run index tool first"]
}
```

## 🔧 Integration Examples

### Claude Desktop Natural Language
```
"What authentication functions exist in my codebase?"
"Find code similar to the user validation logic"
"Show me all components that depend on the UserService"
"What are the most complex functions that need refactoring?"
```

### Programmatic API Usage
```javascript
// Example MCP client usage
const response = await mcpClient.callTool("semantic_search", {
  query: "database transaction handling",
  limit: 10,
  threshold: 0.8
});
```

### Command Line Testing
```bash
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"analyze_hotspots","arguments":{"metric":"complexity","limit":5}},"id":"1"}' | npx @er77/code-graph-rag-mcp /path/to/project
```

---

*This comprehensive tool reference enables effective utilization of all Code Graph RAG MCP capabilities for deep codebase analysis and understanding.*

**Document Version**: 1.0 | **Last Updated**: 2025-01-22 | **Next Review**: 2025-02-15