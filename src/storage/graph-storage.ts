/**
 * TASK-001: Graph Storage Implementation
 * 
 * Core graph storage operations for entities and relationships.
 * Provides efficient querying and traversal of the code graph.
 * 
 * External Dependencies:
 * - nanoid: https://github.com/ai/nanoid - Secure unique ID generation
 * 
 * Architecture References:
 * - Storage Types: src/types/storage.ts
 * - SQLite Manager: src/storage/sqlite-manager.ts
 * - Schema Migrations: src/storage/schema-migrations.ts
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { nanoid } from 'nanoid';
import type Database from 'better-sqlite3';
import type { SQLiteManager } from './sqlite-manager.js';
import type {
  Entity,
  Relationship,
  FileInfo,
  GraphQuery,
  GraphQueryResult,
  GraphStorage,
  BatchResult,
  EntityType,
  RelationType,
  StorageMetrics
} from '../types/storage.js';

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const ID_LENGTH = 12;
const DEFAULT_QUERY_LIMIT = 100;
const MAX_QUERY_LIMIT = 1000;
const DEFAULT_SUBGRAPH_DEPTH = 2;
const MAX_SUBGRAPH_DEPTH = 5;

// =============================================================================
// 3. GRAPH STORAGE IMPLEMENTATION
// =============================================================================

export class GraphStorageImpl implements GraphStorage {
  private db: Database.Database;
  
  // Prepared statements for performance
  private statements: {
    insertEntity?: Database.Statement;
    updateEntity?: Database.Statement;
    deleteEntity?: Database.Statement;
    getEntity?: Database.Statement;
    insertRelationship?: Database.Statement;
    deleteRelationship?: Database.Statement;
    updateFile?: Database.Statement;
    getFile?: Database.Statement;
  } = {};
  
  constructor(private sqliteManager: SQLiteManager) {
    this.db = sqliteManager.getConnection();
    this.prepareStatements();
  }
  
  /**
   * Prepare frequently used statements
   */
  private prepareStatements(): void {
    this.statements.insertEntity = this.db.prepare(`
      INSERT OR REPLACE INTO entities 
      (id, name, type, file_path, location, metadata, hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    this.statements.updateEntity = this.db.prepare(`
      UPDATE entities 
      SET name = ?, type = ?, location = ?, metadata = ?, hash = ?, updated_at = ?
      WHERE id = ?
    `);
    
    this.statements.deleteEntity = this.db.prepare(`
      DELETE FROM entities WHERE id = ?
    `);
    
    this.statements.getEntity = this.db.prepare(`
      SELECT * FROM entities WHERE id = ?
    `);
    
    this.statements.insertRelationship = this.db.prepare(`
      INSERT OR REPLACE INTO relationships 
      (id, from_id, to_id, type, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    this.statements.deleteRelationship = this.db.prepare(`
      DELETE FROM relationships WHERE id = ?
    `);
    
    this.statements.updateFile = this.db.prepare(`
      INSERT OR REPLACE INTO files 
      (path, hash, last_indexed, entity_count)
      VALUES (?, ?, ?, ?)
    `);
    
    this.statements.getFile = this.db.prepare(`
      SELECT * FROM files WHERE path = ?
    `);
  }
  
  // =============================================================================
  // 4. ENTITY OPERATIONS
  // =============================================================================
  
  async insertEntity(entity: Entity): Promise<void> {
    const now = Date.now();
    const id = entity.id || this.generateId();
    
    this.statements.insertEntity!.run(
      id,
      entity.name,
      entity.type,
      entity.filePath,
      JSON.stringify(entity.location),
      JSON.stringify(entity.metadata),
      entity.hash,
      entity.createdAt || now,
      entity.updatedAt || now
    );
  }
  
  async insertEntities(entities: Entity[]): Promise<BatchResult> {
    const start = Date.now();
    const errors: Array<{ item: unknown; error: string }> = [];
    let processed = 0;
    
    const transaction = this.db.transaction((entities: Entity[]) => {
      for (const entity of entities) {
        try {
          const now = Date.now();
          const id = entity.id || this.generateId();
          
          this.statements.insertEntity!.run(
            id,
            entity.name,
            entity.type,
            entity.filePath,
            JSON.stringify(entity.location),
            JSON.stringify(entity.metadata),
            entity.hash,
            entity.createdAt || now,
            entity.updatedAt || now
          );
          
          processed++;
        } catch (error) {
          errors.push({
            item: entity,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    });
    
    try {
      transaction(entities);
    } catch (error) {
      console.error('[GraphStorage] Batch insert failed:', error);
    }
    
    return {
      processed,
      failed: errors.length,
      errors,
      timeMs: Date.now() - start
    };
  }
  
  async updateEntity(id: string, updates: Partial<Entity>): Promise<void> {
    const existing = await this.getEntity(id);
    if (!existing) {
      throw new Error(`Entity ${id} not found`);
    }
    
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    
    this.statements.updateEntity!.run(
      updated.name,
      updated.type,
      JSON.stringify(updated.location),
      JSON.stringify(updated.metadata),
      updated.hash,
      updated.updatedAt,
      id
    );
  }
  
  async deleteEntity(id: string): Promise<void> {
    this.statements.deleteEntity!.run(id);
  }
  
  async getEntity(id: string): Promise<Entity | null> {
    const row = this.statements.getEntity!.get(id) as any;
    return row ? this.rowToEntity(row) : null;
  }
  
  async findEntities(query: GraphQuery): Promise<Entity[]> {
    let sql = 'SELECT * FROM entities WHERE 1=1';
    const params: any[] = [];
    
    // Apply filters
    if (query.filters) {
      if (query.filters.entityType) {
        const types = Array.isArray(query.filters.entityType) 
          ? query.filters.entityType 
          : [query.filters.entityType];
        sql += ` AND type IN (${types.map(() => '?').join(',')})`;
        params.push(...types);
      }
      
      if (query.filters.filePath) {
        const paths = Array.isArray(query.filters.filePath)
          ? query.filters.filePath
          : [query.filters.filePath];
        sql += ` AND file_path IN (${paths.map(() => '?').join(',')})`;
        params.push(...paths);
      }
      
      if (query.filters.name) {
        if (query.filters.name instanceof RegExp) {
          // Use LIKE for regex-like matching
          const pattern = query.filters.name.source.replace(/\*/g, '%');
          sql += ' AND name LIKE ?';
          params.push(pattern);
        } else {
          sql += ' AND name = ?';
          params.push(query.filters.name);
        }
      }
    }
    
    // Apply limit and offset
    const limit = Math.min(query.limit || DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT);
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, query.offset || 0);
    
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.rowToEntity(row));
  }
  
  // =============================================================================
  // 5. RELATIONSHIP OPERATIONS
  // =============================================================================
  
  async insertRelationship(relationship: Relationship): Promise<void> {
    const id = relationship.id || this.generateId();
    
    this.statements.insertRelationship!.run(
      id,
      relationship.fromId,
      relationship.toId,
      relationship.type,
      relationship.metadata ? JSON.stringify(relationship.metadata) : null
    );
  }
  
  async insertRelationships(relationships: Relationship[]): Promise<BatchResult> {
    const start = Date.now();
    const errors: Array<{ item: unknown; error: string }> = [];
    let processed = 0;
    
    const transaction = this.db.transaction((relationships: Relationship[]) => {
      for (const relationship of relationships) {
        try {
          const id = relationship.id || this.generateId();
          
          this.statements.insertRelationship!.run(
            id,
            relationship.fromId,
            relationship.toId,
            relationship.type,
            relationship.metadata ? JSON.stringify(relationship.metadata) : null
          );
          
          processed++;
        } catch (error) {
          errors.push({
            item: relationship,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    });
    
    try {
      transaction(relationships);
    } catch (error) {
      console.error('[GraphStorage] Batch relationship insert failed:', error);
    }
    
    return {
      processed,
      failed: errors.length,
      errors,
      timeMs: Date.now() - start
    };
  }
  
  async deleteRelationship(id: string): Promise<void> {
    this.statements.deleteRelationship!.run(id);
  }
  
  async getRelationshipsForEntity(
    entityId: string, 
    type?: RelationType
  ): Promise<Relationship[]> {
    let sql = `
      SELECT * FROM relationships 
      WHERE (from_id = ? OR to_id = ?)
    `;
    const params: any[] = [entityId, entityId];
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.rowToRelationship(row));
  }
  
  async findRelationships(query: GraphQuery): Promise<Relationship[]> {
    let sql = 'SELECT * FROM relationships WHERE 1=1';
    const params: any[] = [];
    
    // Apply filters
    if (query.filters) {
      if (query.filters.relationshipType) {
        const types = Array.isArray(query.filters.relationshipType)
          ? query.filters.relationshipType
          : [query.filters.relationshipType];
        sql += ` AND type IN (${types.map(() => '?').join(',')})`;
        params.push(...types);
      }
    }
    
    // Apply limit and offset
    const limit = Math.min(query.limit || DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT);
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, query.offset || 0);
    
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.rowToRelationship(row));
  }
  
  // =============================================================================
  // 6. FILE OPERATIONS
  // =============================================================================
  
  async updateFileInfo(info: FileInfo): Promise<void> {
    this.statements.updateFile!.run(
      info.path,
      info.hash,
      info.lastIndexed,
      info.entityCount
    );
  }
  
  async getFileInfo(path: string): Promise<FileInfo | null> {
    const row = this.statements.getFile!.get(path) as any;
    
    return row ? {
      path: row.path,
      hash: row.hash,
      lastIndexed: row.last_indexed,
      entityCount: row.entity_count
    } : null;
  }
  
  async getOutdatedFiles(since: number): Promise<FileInfo[]> {
    const rows = this.db.prepare(`
      SELECT * FROM files 
      WHERE last_indexed < ?
      ORDER BY last_indexed ASC
    `).all(since) as any[];
    
    return rows.map(row => ({
      path: row.path,
      hash: row.hash,
      lastIndexed: row.last_indexed,
      entityCount: row.entity_count
    }));
  }
  
  // =============================================================================
  // 7. QUERY OPERATIONS
  // =============================================================================
  
  async executeQuery(query: GraphQuery): Promise<GraphQueryResult> {
    const start = Date.now();
    
    const entities = await this.findEntities(query);
    const relationships = await this.findRelationships(query);
    
    // Get total counts
    const totalEntities = this.db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };
    const totalRelationships = this.db.prepare('SELECT COUNT(*) as count FROM relationships').get() as { count: number };
    
    return {
      entities,
      relationships,
      stats: {
        totalEntities: totalEntities.count,
        totalRelationships: totalRelationships.count,
        queryTimeMs: Date.now() - start
      }
    };
  }
  
  async getSubgraph(entityId: string, depth: number): Promise<GraphQueryResult> {
    const start = Date.now();
    const maxDepth = Math.min(depth, MAX_SUBGRAPH_DEPTH);
    
    const entities = new Map<string, Entity>();
    const relationships = new Map<string, Relationship>();
    const visited = new Set<string>();
    
    // BFS traversal
    const queue: Array<{ id: string; level: number }> = [{ id: entityId, level: 0 }];
    
    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      
      if (visited.has(id) || level > maxDepth) continue;
      visited.add(id);
      
      // Get entity
      const entity = await this.getEntity(id);
      if (entity) {
        entities.set(id, entity);
        
        // Get relationships
        const rels = await this.getRelationshipsForEntity(id);
        for (const rel of rels) {
          relationships.set(rel.id, rel);
          
          // Add connected entities to queue
          if (level < maxDepth) {
            const nextId = rel.fromId === id ? rel.toId : rel.fromId;
            if (!visited.has(nextId)) {
              queue.push({ id: nextId, level: level + 1 });
            }
          }
        }
      }
    }
    
    return {
      entities: Array.from(entities.values()),
      relationships: Array.from(relationships.values()),
      stats: {
        totalEntities: entities.size,
        totalRelationships: relationships.size,
        queryTimeMs: Date.now() - start
      }
    };
  }
  
  // =============================================================================
  // 8. MAINTENANCE OPERATIONS
  // =============================================================================
  
  async vacuum(): Promise<void> {
    this.sqliteManager.vacuum();
  }
  
  async analyze(): Promise<void> {
    this.sqliteManager.analyze();
  }
  
  async getMetrics(): Promise<StorageMetrics> {
    const baseMetrics = await this.sqliteManager.getMetrics();
    
    // Get cache metrics
    const cacheStats = this.db.prepare(`
      SELECT 
        COUNT(*) as entries,
        SUM(hit_count) as hits
      FROM query_cache
      WHERE expires_at > ?
    `).get(Date.now()) as { entries: number; hits: number };
    
    // Get last vacuum time (stored as user_version for simplicity)
    const lastVacuum = this.db.pragma('user_version', { simple: true }) as number;
    
    return {
      ...baseMetrics,
      cacheHitRate: cacheStats.hits > 0 ? cacheStats.hits / (cacheStats.hits + cacheStats.entries) : 0,
      lastVacuum
    } as StorageMetrics;
  }
  
  // =============================================================================
  // 9. UTILITY METHODS
  // =============================================================================
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return nanoid(ID_LENGTH);
  }
  
  /**
   * Convert database row to Entity
   */
  private rowToEntity(row: any): Entity {
    return {
      id: row.id,
      name: row.name,
      type: row.type as EntityType,
      filePath: row.file_path,
      location: JSON.parse(row.location),
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      hash: row.hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  
  /**
   * Convert database row to Relationship
   */
  private rowToRelationship(row: any): Relationship {
    return {
      id: row.id,
      fromId: row.from_id,
      toId: row.to_id,
      type: row.type as RelationType,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }
  
  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    const transaction = this.db.transaction(() => {
      this.db.exec('DELETE FROM relationships');
      this.db.exec('DELETE FROM entities');
      this.db.exec('DELETE FROM files');
      this.db.exec('DELETE FROM query_cache');
    });
    
    transaction();
  }
}