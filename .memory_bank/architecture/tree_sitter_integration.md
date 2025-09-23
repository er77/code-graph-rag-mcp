# Tree-sitter Integration Architecture

## Overview

Tree-sitter serves as the core parsing engine in the MCP Server Codegraph, positioned at the foundation of the indexing pipeline. It acts as the language-agnostic parser that transforms source code into Abstract Syntax Trees (ASTs) for graph extraction.

## 🏗️ Architecture Placement

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

## 🎯 Language Support Strategy

### Current Implementation
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

## 💻 Implementation Patterns

### TypeScript Adapter Implementation

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

  extractEntities(tree: Tree): Entity[] {
    const entities: Entity[] = [];
    const rootNode = tree.rootNode;

    // Extract functions
    const functions = this.queryNodes(rootNode, '(function_declaration) @function');
    for (const func of functions) {
      entities.push(this.createFunctionEntity(func));
    }

    // Extract classes
    const classes = this.queryNodes(rootNode, '(class_declaration) @class');
    for (const cls of classes) {
      entities.push(this.createClassEntity(cls));
    }

    // Extract interfaces
    const interfaces = this.queryNodes(rootNode, '(interface_declaration) @interface');
    for (const iface of interfaces) {
      entities.push(this.createInterfaceEntity(iface));
    }

    return entities;
  }

  extractRelationships(tree: Tree): Relationship[] {
    const relationships: Relationship[] = [];
    
    // Extract function calls
    const calls = this.queryNodes(tree.rootNode, '(call_expression) @call');
    for (const call of calls) {
      const relationship = this.createCallRelationship(call);
      if (relationship) {
        relationships.push(relationship);
      }
    }

    // Extract inheritance relationships
    const classes = this.queryNodes(tree.rootNode, '(class_declaration) @class');
    for (const cls of classes) {
      const inheritance = this.extractInheritanceRelationships(cls);
      relationships.push(...inheritance);
    }

    return relationships;
  }
}
```

### Error Handling Strategy

```typescript
export class RobustParser {
  async parseWithFallback(source: string, filepath: string): Promise<ParseResult> {
    try {
      const adapter = this.getAdapterForFile(filepath);
      const result = await adapter.parse(source, filepath);
      
      if (result.tree.rootNode.hasError()) {
        // Log but continue with partial results
        console.warn(`Parse errors in ${filepath}, continuing with partial AST`);
        return this.createPartialResult(result, filepath);
      }
      
      return result;
      
    } catch (error) {
      console.error(`Failed to parse ${filepath}:`, error);
      // Fallback to text-based analysis or skip file
      return this.fallbackTextAnalysis(source, filepath);
    }
  }

  private createPartialResult(result: ParseResult, filepath: string): ParseResult {
    // Filter out entities from error nodes
    const validEntities = result.entities.filter(entity => 
      !this.isFromErrorNode(entity, result.tree)
    );
    
    return {
      ...result,
      entities: validEntities,
      hasErrors: true,
      errorCount: this.countErrors(result.tree)
    };
  }

  private fallbackTextAnalysis(source: string, filepath: string): ParseResult {
    // Simple regex-based extraction as fallback
    const entities = this.extractEntitiesWithRegex(source, filepath);
    
    return {
      tree: null,
      entities,
      relationships: [],
      filepath,
      hash: this.computeContentHash(source),
      isFallback: true
    };
  }
}
```

## ⚡ Performance Optimizations

### Memory Efficiency

```typescript
export class MemoryEfficientParser {
  private parseCache = new Map<string, CachedParseResult>();
  private readonly maxCacheSize = 1000;

  async parseFile(filepath: string): Promise<ParseResult> {
    const content = await this.readFileContent(filepath);
    const contentHash = this.computeHash(content);
    
    // Check cache first
    const cached = this.parseCache.get(filepath);
    if (cached && cached.contentHash === contentHash) {
      return cached.result;
    }

    // Parse and cache
    const result = await this.performParse(content, filepath);
    this.cacheResult(filepath, contentHash, result);
    
    return result;
  }

  private cacheResult(filepath: string, contentHash: string, result: ParseResult): void {
    // Implement LRU eviction
    if (this.parseCache.size >= this.maxCacheSize) {
      this.evictOldestEntries();
    }
    
    this.parseCache.set(filepath, {
      contentHash,
      result,
      lastAccessed: Date.now()
    });
  }

  private async performParse(content: string, filepath: string): Promise<ParseResult> {
    try {
      const adapter = this.getAdapterForFile(filepath);
      const result = await adapter.parse(content, filepath);
      
      // Explicitly clean up AST memory after processing
      if (result.tree) {
        // Extract what we need, then dispose of tree
        const entities = result.entities;
        const relationships = result.relationships;
        
        // Tree-sitter trees can be large, so dispose explicitly
        result.tree.delete();
        
        return {
          ...result,
          tree: null, // Don't store the tree in memory
          entities,
          relationships
        };
      }
      
      return result;
      
    } catch (error) {
      console.error(`Parse failed for ${filepath}:`, error);
      throw error;
    }
  }
}
```

### CPU Optimization with Worker Pools

```typescript
export class ParallelParser {
  private workerPool: WorkerPool;
  private readonly maxWorkers: number;

  constructor() {
    const cpuCores = require('os').cpus().length;
    this.maxWorkers = Math.max(2, Math.floor(cpuCores * 0.75));
    this.initializeWorkerPool();
  }

  async parseFiles(files: string[]): Promise<ParseResult[]> {
    const batches = this.createBatches(files, this.maxWorkers);
    const results: ParseResult[] = [];

    // Process batches in parallel
    for (const batch of batches) {
      const batchPromises = batch.map(file => this.parseFileInWorker(file));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Yield control between batches
      await new Promise(resolve => setImmediate(resolve));
    }

    return results;
  }

  private async parseFileInWorker(filepath: string): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
      const worker = this.workerPool.acquire();
      
      worker.postMessage({
        type: 'parse',
        filepath,
        timeout: 30000 // 30 second timeout per file
      });

      worker.once('message', (result) => {
        this.workerPool.release(worker);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.data);
        }
      });

      worker.once('error', (error) => {
        this.workerPool.release(worker);
        reject(error);
      });
    });
  }

  private createBatches<T>(items: T[], batchCount: number): T[][] {
    const batches: T[][] = [];
    const batchSize = Math.ceil(items.length / batchCount);
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }
}
```

### Incremental Parsing

```typescript
export class IncrementalParser {
  private previousTrees = new Map<string, Tree>();
  private previousContent = new Map<string, string>();

  async parseIncremental(filepath: string, newContent: string): Promise<ParseResult> {
    const previousTree = this.previousTrees.get(filepath);
    const previousContent = this.previousContent.get(filepath);

    if (!previousTree || !previousContent) {
      // First parse - no incremental benefit
      return await this.fullParse(filepath, newContent);
    }

    try {
      // Calculate edits between old and new content
      const edits = this.calculateEdits(previousContent, newContent);
      
      if (edits.length === 0) {
        // No changes - return cached result
        return this.getCachedResult(filepath);
      }

      // Apply edits to previous tree
      for (const edit of edits) {
        previousTree.edit(edit);
      }

      // Reparse with previous tree as base
      const parser = this.getParserForFile(filepath);
      const newTree = parser.parse(newContent, previousTree);

      // Update caches
      this.previousTrees.set(filepath, newTree);
      this.previousContent.set(filepath, newContent);

      // Extract entities and relationships from new tree
      const adapter = this.getAdapterForFile(filepath);
      const entities = adapter.extractEntities(newTree);
      const relationships = adapter.extractRelationships(newTree);

      return {
        tree: newTree,
        entities,
        relationships,
        filepath,
        hash: this.computeContentHash(newContent),
        isIncremental: true
      };

    } catch (error) {
      console.warn(`Incremental parsing failed for ${filepath}, falling back to full parse`);
      return await this.fullParse(filepath, newContent);
    }
  }

  private calculateEdits(oldContent: string, newContent: string): Edit[] {
    // Simple diff algorithm - could be enhanced with more sophisticated diff
    const edits: Edit[] = [];
    
    // For now, implement a simple line-based diff
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // This is a simplified implementation
    // Production code would use a proper diff algorithm
    if (oldLines.length !== newLines.length || oldContent !== newContent) {
      edits.push({
        startIndex: 0,
        oldEndIndex: oldContent.length,
        newEndIndex: newContent.length,
        startPosition: { row: 0, column: 0 },
        oldEndPosition: { row: oldLines.length - 1, column: oldLines[oldLines.length - 1]?.length || 0 },
        newEndPosition: { row: newLines.length - 1, column: newLines[newLines.length - 1]?.length || 0 }
      });
    }
    
    return edits;
  }
}
```

## 🔧 Integration Patterns

### With SQLite Database Layer

```typescript
export class DatabaseIntegratedParser {
  constructor(
    private db: GraphDatabase,
    private parser: ParallelParser
  ) {}

  async parseAndStore(files: string[]): Promise<void> {
    const parseResults = await this.parser.parseFiles(files);
    
    // Batch insert for performance
    await this.db.transaction(async (tx) => {
      // Prepare batch operations
      const entities = parseResults.flatMap(r => r.entities);
      const relationships = parseResults.flatMap(r => r.relationships);
      
      // Insert in batches
      const entityBatches = this.createBatches(entities, 1000);
      for (const batch of entityBatches) {
        await tx.batch('INSERT OR REPLACE INTO entities (id, name, type, file, start_line, end_line, signature) VALUES (?, ?, ?, ?, ?, ?, ?)', 
          batch.map(e => [e.id, e.name, e.type, e.file, e.startLine, e.endLine, e.signature])
        );
      }
      
      const relationshipBatches = this.createBatches(relationships, 1000);
      for (const batch of relationshipBatches) {
        await tx.batch('INSERT OR REPLACE INTO relationships (from_id, to_id, type, metadata) VALUES (?, ?, ?, ?)',
          batch.map(r => [r.fromId, r.toId, r.type, JSON.stringify(r.metadata)])
        );
      }
    });
  }

  async updateFileInDatabase(filepath: string): Promise<void> {
    // Remove existing entities/relationships for this file
    await this.db.run('DELETE FROM entities WHERE file = ?', [filepath]);
    await this.db.run('DELETE FROM relationships WHERE from_id IN (SELECT id FROM entities WHERE file = ?) OR to_id IN (SELECT id FROM entities WHERE file = ?)', [filepath, filepath]);
    
    // Reparse and insert
    const result = await this.parser.parseFile(filepath);
    await this.storeParseResult(result);
  }
}
```

### With File System Monitoring

```typescript
export class FileWatchingParser {
  private watcher: FSWatcher;
  private parser: IncrementalParser;
  private pendingUpdates = new Set<string>();
  private updateTimer?: NodeJS.Timeout;

  constructor(
    private rootPath: string,
    private database: GraphDatabase
  ) {
    this.parser = new IncrementalParser();
    this.initializeWatcher();
  }

  private initializeWatcher(): void {
    this.watcher = chokidar.watch(this.rootPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**'
      ],
      ignoreInitial: true
    });

    this.watcher.on('change', (filepath) => {
      this.scheduleUpdate(filepath);
    });

    this.watcher.on('add', (filepath) => {
      this.scheduleUpdate(filepath);
    });

    this.watcher.on('unlink', (filepath) => {
      this.handleFileDeleted(filepath);
    });
  }

  private scheduleUpdate(filepath: string): void {
    this.pendingUpdates.add(filepath);
    
    // Debounce updates - wait for 1 second of no changes
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    this.updateTimer = setTimeout(() => {
      this.processPendingUpdates();
    }, 1000);
  }

  private async processPendingUpdates(): Promise<void> {
    const filesToUpdate = Array.from(this.pendingUpdates);
    this.pendingUpdates.clear();

    for (const filepath of filesToUpdate) {
      try {
        const content = await fs.readFile(filepath, 'utf-8');
        const result = await this.parser.parseIncremental(filepath, content);
        await this.updateDatabaseWithResult(filepath, result);
      } catch (error) {
        console.error(`Failed to update ${filepath}:`, error);
      }
    }
  }

  private async handleFileDeleted(filepath: string): Promise<void> {
    // Remove from database
    await this.database.run('DELETE FROM entities WHERE file = ?', [filepath]);
    await this.database.run('DELETE FROM relationships WHERE from_id IN (SELECT id FROM entities WHERE file = ?) OR to_id IN (SELECT id FROM entities WHERE file = ?)', [filepath, filepath]);
    
    // Clean up parser caches
    this.parser.clearCacheForFile(filepath);
  }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Parser configuration
CODEGRAPH_PARSER_WORKERS=4          # Number of parsing workers
CODEGRAPH_PARSER_MEMORY_LIMIT=512   # Memory limit per worker (MB)
CODEGRAPH_CACHE_SIZE=1000           # Number of parsed files to cache
CODEGRAPH_INCREMENTAL_ENABLED=true  # Enable incremental parsing
CODEGRAPH_TIMEOUT_MS=30000          # Parse timeout per file
```

### Runtime Configuration

```typescript
interface ParserConfig {
  maxWorkers: number;
  memoryLimitMB: number;
  enableIncremental: boolean;
  supportedExtensions: string[];
  timeoutMs: number;
  cacheSize: number;
  fallbackToRegex: boolean;
}

const parserConfig: ParserConfig = {
  maxWorkers: parseInt(process.env.CODEGRAPH_PARSER_WORKERS || '4'),
  memoryLimitMB: parseInt(process.env.CODEGRAPH_PARSER_MEMORY_LIMIT || '512'),
  enableIncremental: process.env.CODEGRAPH_INCREMENTAL_ENABLED !== 'false',
  supportedExtensions: ['.ts', '.js', '.tsx', '.jsx'],
  timeoutMs: parseInt(process.env.CODEGRAPH_TIMEOUT_MS || '30000'),
  cacheSize: parseInt(process.env.CODEGRAPH_CACHE_SIZE || '1000'),
  fallbackToRegex: process.env.CODEGRAPH_FALLBACK_REGEX !== 'false'
};
```

## 📊 Monitoring & Health Checks

### Parser Health Monitoring

```typescript
export class ParserHealthCheck {
  constructor(private parser: ParallelParser) {}

  async checkHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // Test parse a simple file
      const testCode = `
        function testFunction() {
          return "hello world";
        }
      `;
      
      const result = await this.parser.parseString(testCode, 'test.ts');
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTimeMs: responseTime,
        parsersLoaded: this.parser.getLoadedParsers(),
        cacheHitRate: this.parser.getCacheHitRate(),
        avgParseTimeMs: this.parser.getAverageParseTime(),
        memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
        entitiesFound: result.entities.length,
        lastHealthCheck: new Date()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        responseTimeMs: Date.now() - startTime,
        lastHealthCheck: new Date()
      };
    }
  }

  async getMetrics(): Promise<ParserMetrics> {
    return {
      totalFilesParsed: this.parser.getTotalFilesParsed(),
      parseSuccessRate: this.parser.getSuccessRate(),
      averageParseTimeMs: this.parser.getAverageParseTime(),
      cacheHitRate: this.parser.getCacheHitRate(),
      activeWorkers: this.parser.getActiveWorkerCount(),
      queuedFiles: this.parser.getQueuedFileCount(),
      memoryUsageByLanguage: this.parser.getMemoryUsageByLanguage()
    };
  }
}
```

## 🔮 Future Extensions

### Advanced Language Support
- **Custom Grammar Compilation**: Support for domain-specific languages
- **Polyglot File Parsing**: Mixed languages in single files (e.g., HTML with embedded JS)
- **Macro Expansion**: Support for preprocessor macros and template expansion

### Enhanced Performance
- **GPU-Accelerated Parsing**: Leverage GPU for very large codebases
- **Distributed Parsing**: Parse across multiple machines
- **Smart Pre-parsing**: Based on change patterns and usage analytics

### Integration Improvements
- **Real-time Collaboration**: Support operational transforms for live editing
- **Language Server Integration**: Enhanced semantic analysis via LSP
- **Build Artifact Support**: Parse generated code and build outputs

---

## Related Documentation
- [Multi-Agent Patterns](./multi_agent_patterns.md)
- [MCP Integration Architecture](./mcp_integration.md)
- [Vector Store Architecture](./vector_store.md)
- [Performance Optimization Guide](../guides/performance_optimization.md)