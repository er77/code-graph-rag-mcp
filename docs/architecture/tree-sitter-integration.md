# Tree-sitter Integration Architecture

## Architecture Placement

Tree-sitter serves as the core parsing engine in the MCP Server Codegraph, positioned at the foundation of the indexing pipeline. It acts as the language-agnostic parser that transforms source code into Abstract Syntax Trees (ASTs) for graph extraction.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Source Code   │ -> │  Tree-sitter    │ -> │   AST Parser    │
│   (Multiple     │    │   Grammars      │    │   Adapters      │
│   Languages)    │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        v
                                              ┌─────────────────┐
                                              │  Entity/Edge    │
                                              │   Extraction    │
                                              └─────────────────┘
```

## Usage Guidelines

### Language Support Strategy
- **Primary Languages**: JavaScript/TypeScript (immediate implementation)
- **Future Expansion**: Python, Rust, Go, Java (planned for subsequent phases)
- **Grammar Management**: Use pre-compiled grammars for performance, with fallback to compilation

### Parser Interface Design
```typescript
interface LanguageAdapter {
  parse(source: string, filepath: string): Promise<ParseResult>;
  extractEntities(tree: Tree): Entity[];
  extractRelationships(tree: Tree): Relationship[];
  getSupportedFileExtensions(): string[];
}
```

### Performance-First Parsing
- **Incremental Parsing**: Leverage tree-sitter's incremental parsing for file changes
- **Parallel Processing**: Parse files concurrently with configurable worker pools
- **Memory Management**: Stream processing for large files, bounded memory usage

## Coding Recommendations

### Adapter Implementation Pattern
```typescript
export class TypeScriptAdapter implements LanguageAdapter {
  private parser: Parser;
  private language: Language;

  constructor() {
    this.parser = new Parser();
    this.language = JavaScript; // Include TypeScript syntax
    this.parser.setLanguage(this.language);
  }

  async parse(source: string, filepath: string): Promise<ParseResult> {
    const tree = this.parser.parse(source);
    
    return {
      tree,
      entities: this.extractEntities(tree),
      relationships: this.extractRelationships(tree),
      filepath,
      hash: this.computeContentHash(source)
    };
  }
}
```

### Error Handling Strategy
```typescript
// Graceful degradation for parsing errors
try {
  const result = await adapter.parse(source, filepath);
  if (result.tree.rootNode.hasError()) {
    // Log but continue with partial results
    logger.warn(`Parse errors in ${filepath}, continuing with partial AST`);
  }
  return result;
} catch (error) {
  // Fallback to text-based analysis or skip file
  return this.fallbackTextAnalysis(source, filepath);
}
```

## Performance Considerations

### Commodity Hardware Optimizations

#### Memory Efficiency
- **Streaming Parsers**: Process large files in chunks to avoid memory spikes
- **Grammar Caching**: Pre-load and cache compiled grammars across sessions
- **Tree Disposal**: Explicitly free AST memory after processing

#### CPU Optimization
- **Worker Pools**: Distribute parsing across available CPU cores
- **Batch Processing**: Group small files for batch parsing efficiency
- **Incremental Updates**: Only re-parse modified file sections

#### Storage Strategy
```typescript
interface ParseCache {
  contentHash: string;
  parsedAt: Date;
  entities: Entity[];
  relationships: Relationship[];
  parsingTimeMs: number;
}

// Cache parsed results keyed by file content hash
const parseCache = new Map<string, ParseCache>();
```

### Performance Targets
- **Cold Parse**: Target 100+ files/second on modest hardware (4-core, 8GB RAM)
- **Warm Parse**: Target 5x improvement for unchanged files via caching
- **Memory Usage**: Stay under 1GB peak for repos up to 10k files

## Integration Patterns

### With SQLite Database Layer
```typescript
// Batch insert entities and relationships after parsing
const batchInsert = async (parseResults: ParseResult[]) => {
  const entities = parseResults.flatMap(r => r.entities);
  const relationships = parseResults.flatMap(r => r.relationships);
  
  await db.transaction(async (tx) => {
    await tx.batch('INSERT INTO entities ...', entities);
    await tx.batch('INSERT INTO relationships ...', relationships);
  });
};
```

### With File System Monitoring
```typescript
// Integrate with file watchers for incremental updates
export class IncrementalParser {
  async onFileChanged(filepath: string, content: string) {
    const adapter = this.getAdapterForFile(filepath);
    const parseResult = await adapter.parse(content, filepath);
    
    // Update only the affected nodes in the graph
    await this.updateGraphNode(filepath, parseResult);
  }
}
```

### With LiteRAG Multi-Agent Architecture
```typescript
// Parsing agents for different file types
export class ParsingOrchestrator {
  private agents = new Map<string, LanguageAdapter>();
  
  async distributeParsingTasks(files: FileInfo[]) {
    const tasks = files.map(file => ({
      file,
      agent: this.agents.get(file.extension) || this.fallbackAgent,
      priority: this.calculatePriority(file)
    }));
    
    return await this.executeInParallel(tasks);
  }
}
```

## Configuration Options

### Environment Variables
```bash
# Parser configuration
CODEGRAPH_PARSER_WORKERS=4          # Number of parsing workers
CODEGRAPH_PARSER_MEMORY_LIMIT=512   # Memory limit per worker (MB)
CODEGRAPH_CACHE_SIZE=1000           # Number of parsed files to cache
CODEGRAPH_INCREMENTAL_ENABLED=true  # Enable incremental parsing
```

### Runtime Configuration
```typescript
interface ParserConfig {
  maxWorkers: number;
  memoryLimitMB: number;
  enableIncremental: boolean;
  supportedExtensions: string[];
  timeoutMs: number;
}
```

## Monitoring and Diagnostics

### Parsing Metrics
- Parse success/failure rates by language
- Average parsing time per file size
- Memory usage patterns
- Cache hit rates for incremental parsing

### Health Checks
```typescript
export class ParserHealthCheck {
  async checkHealth(): Promise<HealthStatus> {
    return {
      parsersLoaded: this.adapters.size,
      cacheHitRate: this.calculateCacheHitRate(),
      avgParseTimeMs: this.getAverageParseTime(),
      memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }
}
```

## Future Extensions

### Advanced Language Support
- Custom grammar compilation for domain-specific languages
- Polyglot file parsing (mixed languages in single files)
- Macro and template expansion support

### Enhanced Performance
- GPU-accelerated parsing for very large codebases
- Distributed parsing across multiple machines
- Smart pre-parsing based on change patterns

### Integration Improvements
- Real-time collaboration support with operational transforms
- Integration with language servers for enhanced semantic analysis
- Support for generated code and build artifacts