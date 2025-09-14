# SQLite Integration Architecture

## Architecture Placement

SQLite serves as the primary persistence layer in the MCP Server Codegraph, positioned between the parsing pipeline and the query interface. It provides ACID transactions, efficient indexing, and cross-platform compatibility essential for reliable code graph storage.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tree-sitter   │ -> │     SQLite      │ -> │   Query Layer   │
│   Parse Results │    │   Database      │    │   (MCP Tools)   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                v
                       ┌─────────────────┐
                       │   File System   │
                       │   Persistence   │
                       └─────────────────┘
```

## Usage Guidelines

### Database Schema Design
The schema is optimized for graph queries and relationship traversal:

```sql
-- Core entities table
CREATE TABLE entities (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- Function, Class, Variable, etc.
    start_line INTEGER,
    end_line INTEGER,
    start_column INTEGER,
    end_column INTEGER,
    content_hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relationships between entities
CREATE TABLE relationships (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    type TEXT NOT NULL,  -- Calls, Inherits, Imports, etc.
    metadata TEXT,       -- JSON for additional relationship data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES entities(id),
    FOREIGN KEY (target_id) REFERENCES entities(id)
);

-- File metadata and hierarchy
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    content_hash TEXT,
    size_bytes INTEGER,
    modified_at TIMESTAMP,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Index Strategy for Performance
```sql
-- Optimized indexes for common query patterns
CREATE INDEX idx_entities_file_id ON entities(file_id);
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_name ON entities(name);
CREATE INDEX idx_relationships_source ON relationships(source_id);
CREATE INDEX idx_relationships_target ON relationships(target_id);
CREATE INDEX idx_relationships_type ON relationships(type);
CREATE INDEX idx_files_path ON files(path);
CREATE INDEX idx_files_hash ON files(content_hash);

-- Composite indexes for complex queries
CREATE INDEX idx_entities_file_type ON entities(file_id, type);
CREATE INDEX idx_relationships_source_type ON relationships(source_id, type);
```

## Coding Recommendations

### Database Connection Management
```typescript
import Database from 'better-sqlite3';

export class GraphDatabase {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor(dbPath: string = './codegraph.db') {
    this.dbPath = dbPath;
    this.db = new Database(dbPath, {
      // Performance optimizations for commodity hardware
      pragma: {
        journal_mode: 'WAL',        // Write-Ahead Logging for concurrent reads
        synchronous: 'NORMAL',      // Balance safety and performance
        cache_size: -64000,         // 64MB cache (negative = KB)
        temp_store: 'MEMORY',       // Keep temporary tables in memory
        mmap_size: 268435456,       // 256MB memory-mapped size
        page_size: 4096,            // Standard page size
        auto_vacuum: 'INCREMENTAL'  // Prevent database bloat
      }
    });
    
    this.initializeSchema();
  }

  private initializeSchema(): void {
    // Create tables and indexes
    this.db.exec(`
      ${this.getCreateTableStatements()}
      ${this.getCreateIndexStatements()}
    `);
  }
}
```

### Batch Operations for Performance
```typescript
export class BatchOperations {
  private insertEntity: Database.Statement;
  private insertRelationship: Database.Statement;
  private updateFile: Database.Statement;

  constructor(private db: Database.Database) {
    // Prepare statements once for reuse
    this.insertEntity = db.prepare(`
      INSERT OR REPLACE INTO entities 
      (id, file_id, name, type, start_line, end_line, content_hash) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    this.insertRelationship = db.prepare(`
      INSERT OR REPLACE INTO relationships 
      (id, source_id, target_id, type, metadata) 
      VALUES (?, ?, ?, ?, ?)
    `);
  }

  async batchInsertEntities(entities: Entity[]): Promise<void> {
    const transaction = this.db.transaction((entities: Entity[]) => {
      for (const entity of entities) {
        this.insertEntity.run(
          entity.id,
          entity.fileId,
          entity.name,
          entity.type,
          entity.startLine,
          entity.endLine,
          entity.contentHash
        );
      }
    });

    transaction(entities);
  }
}
```

### Query Optimization Patterns
```typescript
export class GraphQueries {
  constructor(private db: Database.Database) {}

  // Find all functions that call a specific function
  findCallers(functionId: string): CallerInfo[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT 
        e.id, e.name, e.type, f.path,
        e.start_line, e.end_line
      FROM relationships r
      JOIN entities e ON r.source_id = e.id
      JOIN files f ON e.file_id = f.id
      WHERE r.target_id = ? AND r.type = 'Calls'
      ORDER BY f.path, e.start_line
    `);
    
    return stmt.all(functionId) as CallerInfo[];
  }

  // Find circular dependencies
  findCircularDependencies(): CircularDependency[] {
    const stmt = this.db.prepare(`
      WITH RECURSIVE dependency_path AS (
        SELECT source_id, target_id, type, source_id as root, 1 as depth
        FROM relationships 
        WHERE type IN ('Imports', 'Calls')
        
        UNION ALL
        
        SELECT r.source_id, r.target_id, r.type, dp.root, dp.depth + 1
        FROM relationships r
        JOIN dependency_path dp ON r.source_id = dp.target_id
        WHERE dp.depth < 10 -- Prevent infinite recursion
      )
      SELECT DISTINCT root, target_id, depth
      FROM dependency_path
      WHERE root = target_id AND depth > 1
    `);
    
    return stmt.all() as CircularDependency[];
  }
}
```

## Performance Considerations

### Commodity Hardware Optimizations

#### Memory Management
```typescript
// Connection pooling for concurrent access
export class DatabasePool {
  private connections: Database.Database[] = [];
  private readonly maxConnections = 4; // Adjust based on CPU cores

  getConnection(): Database.Database {
    if (this.connections.length > 0) {
      return this.connections.pop()!;
    }
    
    return this.createConnection();
  }

  releaseConnection(db: Database.Database): void {
    if (this.connections.length < this.maxConnections) {
      this.connections.push(db);
    } else {
      db.close();
    }
  }
}
```

#### Incremental Updates Strategy
```typescript
export class IncrementalUpdater {
  async updateFileEntities(filePath: string, entities: Entity[]): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Remove old entities and relationships for this file
      const fileId = this.getFileId(filePath);
      this.db.prepare('DELETE FROM relationships WHERE source_id IN (SELECT id FROM entities WHERE file_id = ?)').run(fileId);
      this.db.prepare('DELETE FROM entities WHERE file_id = ?').run(fileId);
      
      // Insert new entities
      for (const entity of entities) {
        this.insertEntity.run(/* entity data */);
      }
    });
    
    transaction();
  }
}
```

#### Storage Optimization
```typescript
// Periodic maintenance for database health
export class DatabaseMaintenance {
  async optimizeDatabase(): Promise<void> {
    // Update statistics for query planner
    this.db.exec('ANALYZE');
    
    // Reclaim space from deleted records
    this.db.exec('PRAGMA incremental_vacuum(1000)');
    
    // Optimize indexes
    this.db.exec('REINDEX');
  }

  async compactDatabase(): Promise<void> {
    // Full vacuum during low-usage periods
    this.db.exec('VACUUM');
  }
}
```

### Performance Targets
- **Query Response**: <100ms for typical entity/relationship queries
- **Bulk Insert**: >1000 entities/second during indexing
- **Database Size**: <10MB per 1000 source files
- **Memory Usage**: <256MB for databases up to 100k entities

## Integration Patterns

### With Tree-sitter Parser Results
```typescript
export class ParserToDatabase {
  async indexParseResults(results: ParseResult[]): Promise<void> {
    const transaction = this.db.transaction((results: ParseResult[]) => {
      for (const result of results) {
        // Update file record
        this.updateFile(result.filePath, result.contentHash);
        
        // Insert entities
        for (const entity of result.entities) {
          this.insertEntity(entity);
        }
        
        // Insert relationships
        for (const relationship of result.relationships) {
          this.insertRelationship(relationship);
        }
      }
    });
    
    transaction(results);
  }
}
```

### With MCP Query Layer
```typescript
export class MCPQueryInterface {
  constructor(private graphDb: GraphDatabase) {}

  async listFileEntities(filePath: string): Promise<Entity[]> {
    return this.graphDb.query(`
      SELECT e.* FROM entities e
      JOIN files f ON e.file_id = f.id
      WHERE f.path = ?
      ORDER BY e.start_line
    `, [filePath]);
  }

  async getEntityRelationships(entityId: string): Promise<Relationship[]> {
    return this.graphDb.query(`
      SELECT r.*, 
             se.name as source_name, se.type as source_type,
             te.name as target_name, te.type as target_type,
             sf.path as source_file, tf.path as target_file
      FROM relationships r
      JOIN entities se ON r.source_id = se.id
      JOIN entities te ON r.target_id = te.id
      JOIN files sf ON se.file_id = sf.id
      JOIN files tf ON te.file_id = tf.id
      WHERE r.source_id = ? OR r.target_id = ?
    `, [entityId, entityId]);
  }
}
```

### With Vector Store for Semantic Search
```typescript
export class HybridSearchIndex {
  async combineStructuralAndSemantic(query: string): Promise<SearchResult[]> {
    // First get structural matches from SQLite
    const structuralResults = await this.db.query(`
      SELECT * FROM entities 
      WHERE name LIKE ? OR type LIKE ?
    `, [`%${query}%`, `%${query}%`]);
    
    // Enhance with semantic similarity scores
    const enhancedResults = await Promise.all(
      structuralResults.map(async (entity) => {
        const semanticScore = await this.vectorStore.similarity(query, entity.name);
        return { ...entity, semanticScore };
      })
    );
    
    return enhancedResults.sort((a, b) => b.semanticScore - a.semanticScore);
  }
}
```

## Configuration Options

### Database Configuration
```typescript
interface DatabaseConfig {
  path: string;
  memoryLimit: number;      // SQLite cache size in MB
  walMode: boolean;         // Write-Ahead Logging
  syncMode: 'OFF' | 'NORMAL' | 'FULL';
  tempStore: 'FILE' | 'MEMORY';
  mmapSize: number;         // Memory-mapped database size
  autoVacuum: 'NONE' | 'FULL' | 'INCREMENTAL';
}

// Environment-based configuration
const config: DatabaseConfig = {
  path: process.env.CODEGRAPH_DB_PATH || './codegraph.db',
  memoryLimit: parseInt(process.env.CODEGRAPH_DB_CACHE_MB || '64'),
  walMode: process.env.CODEGRAPH_DB_WAL !== 'false',
  syncMode: (process.env.CODEGRAPH_DB_SYNC as any) || 'NORMAL',
  tempStore: process.env.CODEGRAPH_DB_TEMP_STORE as any || 'MEMORY',
  mmapSize: parseInt(process.env.CODEGRAPH_DB_MMAP_MB || '256') * 1024 * 1024,
  autoVacuum: (process.env.CODEGRAPH_DB_AUTO_VACUUM as any) || 'INCREMENTAL'
};
```

## Monitoring and Diagnostics

### Performance Metrics
```typescript
export class DatabaseMetrics {
  async getStats(): Promise<DatabaseStats> {
    const stats = this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM entities) as entity_count,
        (SELECT COUNT(*) FROM relationships) as relationship_count,
        (SELECT COUNT(*) FROM files) as file_count,
        (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) as db_size_bytes
    `).get() as any;
    
    return {
      ...stats,
      cacheHitRate: this.getCacheHitRate(),
      avgQueryTimeMs: this.getAverageQueryTime(),
      connectionCount: this.getActiveConnections()
    };
  }
}
```

### Health Checks
```typescript
export class DatabaseHealthCheck {
  async checkIntegrity(): Promise<IntegrityReport> {
    // Check foreign key constraints
    const fkViolations = this.db.prepare('PRAGMA foreign_key_check').all();
    
    // Check index consistency
    const indexCheck = this.db.prepare('PRAGMA integrity_check').get();
    
    // Check for orphaned records
    const orphanedEntities = this.db.prepare(`
      SELECT COUNT(*) as count FROM entities e
      LEFT JOIN files f ON e.file_id = f.id
      WHERE f.id IS NULL
    `).get() as any;
    
    return {
      isHealthy: fkViolations.length === 0 && indexCheck === 'ok' && orphanedEntities.count === 0,
      foreignKeyViolations: fkViolations.length,
      orphanedEntities: orphanedEntities.count,
      lastIntegrityCheck: new Date()
    };
  }
}
```

## Migration and Backup Strategies

### Schema Migrations
```typescript
export class SchemaManager {
  private migrations = [
    {
      version: 1,
      up: () => this.db.exec('ALTER TABLE entities ADD COLUMN visibility TEXT DEFAULT "public"'),
      down: () => this.db.exec('ALTER TABLE entities DROP COLUMN visibility')
    },
    // Additional migrations...
  ];

  async migrate(): Promise<void> {
    const currentVersion = this.getCurrentSchemaVersion();
    const targetVersion = this.migrations.length;
    
    for (let v = currentVersion + 1; v <= targetVersion; v++) {
      const migration = this.migrations[v - 1];
      this.db.transaction(() => {
        migration.up();
        this.setSchemaVersion(v);
      })();
    }
  }
}
```

### Backup and Recovery
```typescript
export class BackupManager {
  async createBackup(backupPath: string): Promise<void> {
    // SQLite backup API for hot backups
    const backup = this.db.backup(backupPath);
    
    do {
      await backup.step(100); // Copy 100 pages at a time
    } while (backup.remaining > 0);
    
    backup.finish();
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    this.db.close();
    // Copy backup to main database location
    // Reopen connection
    this.db = new Database(this.dbPath);
  }
}
```

## Future Enhancements

### Advanced Query Features
- Full-text search integration with FTS5
- Temporal queries for code evolution tracking
- Graph algorithms (PageRank, community detection)
- Materialized views for complex aggregations

### Scalability Improvements
- Horizontal partitioning by repository or project
- Read replicas for query scaling
- Compression for historical data
- Archive strategies for old versions