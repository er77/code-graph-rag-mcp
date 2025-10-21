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

import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { nanoid } from "nanoid";
import type {
  BatchResult,
  Entity,
  EntityType,
  FileInfo,
  GraphQuery,
  GraphQueryResult,
  GraphStorage,
  Relationship,
  RelationType,
  StorageMetrics,
} from "../types/storage.js";
import type { SQLiteManager } from "./sqlite-manager.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const ID_LENGTH = 12;
const DEFAULT_QUERY_LIMIT = 100;
const MAX_QUERY_LIMIT = 1000;
const MAX_SUBGRAPH_DEPTH = 5;

// =============================================================================
// 3. GRAPH STORAGE IMPLEMENTATION
// =============================================================================

export class GraphStorageImpl implements GraphStorage {
  private db: Database.Database;
  private sqliteManager: SQLiteManager;

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
    insertPerformanceMetric?: Database.Statement;
  } = {};

  constructor(sqliteManager: SQLiteManager) {
    this.sqliteManager = sqliteManager;
    this.db = sqliteManager.getConnection();
    this.prepareStatements();
  }

  async initialize(): Promise<void> {
    this.ensureReady(true);
  }

  private ensureReady(force = false): void {
    if (!this.sqliteManager) {
      throw new Error("SQLiteManager is required but not provided");
    }

    try {
      if (!force && this.sqliteManager.isOpen()) {
        this.db.pragma("user_version");
        return;
      }
    } catch {}

    if (!this.sqliteManager.isOpen()) {
      this.sqliteManager.initialize();
    }

    if (force) {
      this.db = this.sqliteManager.getConnection();
      this.prepareStatements();
    }
  }

  /**
   * Prepare frequently used statements
   */
  private prepareStatements(): void {
    // Enhanced entity operations with v2 fields
    this.statements.insertEntity = this.db.prepare(`
      INSERT INTO entities
      (id, name, type, file_path, location, metadata, hash, created_at, updated_at,
       complexity_score, language, size_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        file_path = excluded.file_path,
        location = excluded.location,
        metadata = excluded.metadata,
        hash = COALESCE(excluded.hash, entities.hash),
        updated_at = excluded.updated_at,
        complexity_score = excluded.complexity_score,
        language = excluded.language,
        size_bytes = excluded.size_bytes
    `);

    this.statements.updateEntity = this.db.prepare(`
      UPDATE entities
      SET name = ?, type = ?, location = ?, metadata = ?, hash = ?, updated_at = ?,
          complexity_score = ?, language = ?, size_bytes = ?
      WHERE id = ?
    `);

    this.statements.deleteEntity = this.db.prepare(`
      DELETE FROM entities WHERE id = ?
    `);

    this.statements.getEntity = this.db.prepare(`
      SELECT * FROM entities WHERE id = ?
    `);

    // Enhanced relationship operations with v2 fields
    this.statements.insertRelationship = this.db.prepare(`
      INSERT INTO relationships
      (id, from_id, to_id, type, metadata, weight, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        metadata = COALESCE(excluded.metadata, relationships.metadata),
        weight = excluded.weight
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

    // Performance monitoring statement
    this.statements.insertPerformanceMetric = this.db.prepare(`
      INSERT INTO performance_metrics (id, operation, duration_ms, entity_count, memory_usage, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
  }

  // =============================================================================
  // 4. ENTITY OPERATIONS
  // =============================================================================

  async insertEntity(entity: Entity): Promise<void> {
    return this.measureOperation(
      "insert_entity",
      () => {
        const now = Date.now();

        const id = this.stableEntityId(entity);

        // Calculate complexity score and language if not provided
        const complexityScore = entity.complexityScore ?? this.calculateComplexity(entity);
        const language = entity.language ?? this.detectLanguage(entity.filePath);
        const sizeBytes = entity.sizeBytes ?? 0;

        this.statements.insertEntity?.run(
          id,
          entity.name,
          entity.type,
          entity.filePath,
          JSON.stringify(entity.location),
          JSON.stringify(entity.metadata),
          entity.hash,
          entity.createdAt || now,
          entity.updatedAt || now,
          complexityScore,
          language,
          sizeBytes,
        );
      },
      1,
    );
  }

  async insertEntities(entities: Entity[]): Promise<BatchResult> {
    this.ensureReady();
    return this.measureOperation(
      "insert_entities_batch",
      () => {
        const start = Date.now();
        const errors: Array<{ item: unknown; error: string }> = [];
        let processed = 0;

        const seen = new Set<string>();
        const uniq: Entity[] = [];
        for (const e of entities) {
          const key = this.entityKey(e);
          if (!seen.has(key)) {
            seen.add(key);
            uniq.push(e);
          }
        }

        const tx = this.db.transaction((items: Entity[]) => {
          for (const entity of items) {
            try {
              const now = Date.now();
              const id = this.stableEntityId(entity);

              // Calculate enhanced fields
              const complexityScore = entity.complexityScore ?? this.calculateComplexity(entity);
              const language = entity.language ?? this.detectLanguage(entity.filePath);
              const sizeBytes = entity.sizeBytes ?? 0;

              this.statements.insertEntity?.run(
                id,
                entity.name,
                entity.type,
                entity.filePath,
                JSON.stringify(entity.location),
                JSON.stringify(entity.metadata),
                entity.hash,
                entity.createdAt || now,
                entity.updatedAt || now,
                complexityScore,
                language,
                sizeBytes,
              );

              processed++;
            } catch (error) {
              errors.push({
                item: entity,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        });

        try {
          tx(uniq);
        } catch (error) {
          console.error("[GraphStorage] Batch insert failed:", error);
        }

        return {
          processed,
          failed: errors.length,
          errors,
          timeMs: Date.now() - start,
        };
      },
      entities.length,
    );
  }

  async updateEntity(id: string, updates: Partial<Entity>): Promise<void> {
    this.ensureReady();
    const existing = await this.getEntity(id);
    if (!existing) {
      throw new Error(`Entity ${id} not found`);
    }

    const updated = { ...existing, ...updates, updatedAt: Date.now() };

    // Recalculate enhanced fields if necessary
    const complexityScore = updated.complexityScore ?? this.calculateComplexity(updated);
    const language = updated.language ?? this.detectLanguage(updated.filePath);
    const sizeBytes = updated.sizeBytes ?? 0;

    this.statements.updateEntity?.run(
      updated.name,
      updated.type,
      JSON.stringify(updated.location),
      JSON.stringify(updated.metadata),
      updated.hash,
      updated.updatedAt,
      complexityScore,
      language,
      sizeBytes,
      id,
    );
  }

  async deleteEntity(id: string): Promise<void> {
    this.ensureReady();
    this.statements.deleteEntity?.run(id);
  }

  async getEntity(id: string): Promise<Entity | null> {
    this.ensureReady();
    const row = this.statements.getEntity?.get(id) as any;
    return row ? this.rowToEntity(row) : null;
  }

  async findEntities(query: GraphQuery): Promise<Entity[]> {
    this.ensureReady();
    let sql = "SELECT * FROM entities WHERE 1=1";
    const params: any[] = [];

    // Apply filters
    if (query.filters) {
      if (query.filters.entityType) {
        const types = Array.isArray(query.filters.entityType) ? query.filters.entityType : [query.filters.entityType];
        sql += ` AND type IN (${types.map(() => "?").join(",")})`;
        params.push(...types);
      }

      if (query.filters.filePath) {
        const paths = Array.isArray(query.filters.filePath) ? query.filters.filePath : [query.filters.filePath];
        sql += ` AND file_path IN (${paths.map(() => "?").join(",")})`;
        params.push(...paths);
      }

      if (query.filters.name) {
        if (query.filters.name instanceof RegExp) {
          // Use LIKE for regex-like matching
          const pattern = query.filters.name.source.replace(/\*/g, "%");
          sql += " AND name LIKE ?";
          params.push(pattern);
        } else {
          sql += " AND name = ?";
          params.push(query.filters.name);
        }
      }
    }

    // Apply limit and offset
    const limit = Math.min(query.limit || DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT);
    sql += " LIMIT ? OFFSET ?";
    params.push(limit, query.offset || 0);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.rowToEntity(row));
  }

  // =============================================================================
  // 5. RELATIONSHIP OPERATIONS
  // =============================================================================

  async insertRelationship(relationship: Relationship): Promise<void> {
    this.ensureReady();
    const id = this.stableRelationshipId(relationship);
    const now = Date.now();

    this.statements.insertRelationship?.run(
      id,
      relationship.fromId,
      relationship.toId,
      relationship.type,
      relationship.metadata ? JSON.stringify(relationship.metadata) : null,
      relationship.weight ?? 1.0,
      relationship.createdAt ?? now,
    );
  }

  async insertRelationships(relationships: Relationship[]): Promise<BatchResult> {
    this.ensureReady();
    const start = Date.now();
    const errors: Array<{ item: unknown; error: string }> = [];
    let processed = 0;

    const seen = new Set<string>();
    const uniq: Relationship[] = [];
    for (const r of relationships) {
      const key = this.relationshipKey(r);
      if (!seen.has(key)) {
        seen.add(key);
        uniq.push(r);
      }
    }

    const tx = this.db.transaction((rels: Relationship[]) => {
      for (const r of rels) {
        try {
          const id = this.stableRelationshipId(r);
          const now = Date.now();
          this.statements.insertRelationship?.run(
            id,
            r.fromId,
            r.toId,
            r.type,
            r.metadata ? JSON.stringify(r.metadata) : null,
            r.weight ?? 1.0,
            r.createdAt ?? now,
          );
          processed++;
        } catch (error) {
          errors.push({ item: r, error: error instanceof Error ? error.message : String(error) });
        }
      }
    });

    try {
      tx(uniq);
    } catch (error) {
      console.error("[GraphStorage] Batch relationship insert failed:", error);
    }

    return {
      processed,
      failed: errors.length,
      errors,
      timeMs: Date.now() - start,
    };
  }

  async deleteRelationship(id: string): Promise<void> {
    this.ensureReady();
    this.statements.deleteRelationship?.run(id);
  }

  async getRelationshipsForEntity(entityId: string, type?: RelationType): Promise<Relationship[]> {
    this.ensureReady();
    let sql = `
      SELECT * FROM relationships 
      WHERE (from_id = ? OR to_id = ?)
    `;
    const params: any[] = [entityId, entityId];

    if (type) {
      sql += " AND type = ?";
      params.push(type);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.rowToRelationship(row));
  }

  async findRelationships(query: GraphQuery): Promise<Relationship[]> {
    this.ensureReady();
    let sql = "SELECT * FROM relationships WHERE 1=1";
    const params: any[] = [];

    // Apply filters
    if (query.filters) {
      if (query.filters.relationshipType) {
        const types = Array.isArray(query.filters.relationshipType)
          ? query.filters.relationshipType
          : [query.filters.relationshipType];
        sql += ` AND type IN (${types.map(() => "?").join(",")})`;
        params.push(...types);
      }
    }

    // Apply limit and offset
    const limit = Math.min(query.limit || DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT);
    sql += " LIMIT ? OFFSET ?";
    params.push(limit, query.offset || 0);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.rowToRelationship(row));
  }

  // =============================================================================
  // 6. FILE OPERATIONS
  // =============================================================================

  async updateFileInfo(info: FileInfo): Promise<void> {
    this.ensureReady();
    this.statements.updateFile?.run(info.path, info.hash, info.lastIndexed, info.entityCount);
  }

  async getFileInfo(path: string): Promise<FileInfo | null> {
    this.ensureReady();
    const row = this.statements.getFile?.get(path) as any;

    return row
      ? {
          path: row.path,
          hash: row.hash,
          lastIndexed: row.last_indexed,
          entityCount: row.entity_count,
        }
      : null;
  }

  async getOutdatedFiles(since: number): Promise<FileInfo[]> {
    this.ensureReady();
    const rows = this.db
      .prepare(`
      SELECT * FROM files 
      WHERE last_indexed < ?
      ORDER BY last_indexed ASC
    `)
      .all(since) as any[];

    return rows.map((row) => ({
      path: row.path,
      hash: row.hash,
      lastIndexed: row.last_indexed,
      entityCount: row.entity_count,
    }));
  }

  // =============================================================================
  // 7. QUERY OPERATIONS
  // =============================================================================

  async executeQuery(query: GraphQuery): Promise<GraphQueryResult> {
    return this.measureOperation(
      "execute_query",
      async () => {
        const start = Date.now();

        const entities = await this.findEntities(query);
        const relationships = await this.findRelationships(query);

        // Get total counts
        const totalEntities = this.db.prepare("SELECT COUNT(*) as count FROM entities").get() as { count: number };
        const totalRelationships = this.db.prepare("SELECT COUNT(*) as count FROM relationships").get() as {
          count: number;
        };

        return {
          entities,
          relationships,
          stats: {
            totalEntities: totalEntities.count,
            totalRelationships: totalRelationships.count,
            queryTimeMs: Date.now() - start,
          },
        };
      },
      undefined,
    );
  }

  async getSubgraph(entityId: string, depth: number): Promise<GraphQueryResult> {
    return this.measureOperation(
      "get_subgraph",
      async () => {
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
            queryTimeMs: Date.now() - start,
          },
        };
      },
      1,
    );
  }

  // =============================================================================
  // 8. MAINTENANCE OPERATIONS
  // =============================================================================

  async vacuum(): Promise<void> {
    this.ensureReady();
    this.sqliteManager.vacuum();
  }

  async analyze(): Promise<void> {
    this.ensureReady();
    this.sqliteManager.analyze();
  }

  async getMetrics(): Promise<StorageMetrics> {
    return this.measureOperation("get_metrics", async () => {
      const baseMetrics = await this.sqliteManager.getMetrics();

      // Get cache metrics with enhanced v2 fields
      const cacheStats = this.db
        .prepare(`
        SELECT
          COUNT(*) as entries,
          SUM(hit_count) as hits,
          SUM(miss_count) as misses
        FROM query_cache
        WHERE expires_at > ?
      `)
        .get(Date.now()) as { entries: number; hits: number; misses: number };

      // Get embeddings count
      const embeddingsCount = this.db
        .prepare(`
        SELECT COUNT(*) as count FROM embeddings
      `)
        .get() as { count: number };

      // Get performance metrics count
      const perfMetricsCount = this.db
        .prepare(`
        SELECT COUNT(*) as count FROM performance_metrics
      `)
        .get() as { count: number };

      // Calculate average query time from performance metrics
      const avgQueryTime = this.db
        .prepare(`
        SELECT AVG(duration_ms) as avg_time
        FROM performance_metrics
        WHERE operation LIKE '%query%' AND created_at > ?
      `)
        .get(Date.now() - 24 * 60 * 60 * 1000) as { avg_time: number }; // Last 24 hours

      // Get last vacuum time (stored as user_version for simplicity)
      const lastVacuum = this.db.pragma("user_version", { simple: true }) as number;

      // Check if vector search is enabled (sqlite-vec extension)
      let vectorSearchEnabled = false;
      try {
        this.db.prepare("SELECT vec_version()").get();
        vectorSearchEnabled = true;
      } catch {
        // sqlite-vec not available
      }

      // Get current memory usage
      const memoryUsage = process.memoryUsage();

      return {
        ...baseMetrics,
        cacheHitRate:
          cacheStats.hits + cacheStats.misses > 0 ? cacheStats.hits / (cacheStats.hits + cacheStats.misses) : 0,
        lastVacuum,

        // Enhanced v2 metrics
        totalEmbeddings: embeddingsCount.count,
        vectorSearchEnabled,
        performanceMetricsCount: perfMetricsCount.count,
        memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        concurrentConnections: 1, // Single connection for now
        averageQueryTimeMs: avgQueryTime.avg_time || 0,
      } as StorageMetrics;
    });
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
   * Generate stable entity key
   */
  private entityKey(e: Entity): string {
    const s = e.location?.start?.index ?? -1;
    const eIdx = e.location?.end?.index ?? -1;
    return `${e.filePath}|${e.type}|${e.name}|${s}-${eIdx}`;
  }

  /**
   * Generate stable entity ID
   */
  private stableEntityId(e: Entity): string {
    const key = this.entityKey(e);
    return createHash("sha256").update(key).digest("base64url").slice(0, ID_LENGTH);
  }

  /**
   * Generate stable relationship key
   */
  private relationshipKey(r: Relationship): string {
    return `${r.fromId}|${r.toId}|${r.type}`;
  }

  /**
   * Generate stable relationship ID
   */
  private stableRelationshipId(r: Relationship): string {
    return createHash("sha256").update(this.relationshipKey(r)).digest("base64url").slice(0, ID_LENGTH);
  }

  /**
   * Calculate complexity score for an entity
   */
  private calculateComplexity(entity: Entity): number {
    let score = 1;

    // Base complexity by type
    switch (entity.type) {
      case "function":
        score = 2;
        break;
      case "class":
        score = 3;
        break;
      case "method":
        score = 2;
        break;
      case "interface":
        score = 2;
        break;
      default:
        score = 1;
    }

    // Add complexity based on parameters
    if (entity.metadata.parameters?.length) {
      score += Math.min(entity.metadata.parameters.length * 0.5, 3);
    }

    // Add complexity based on modifiers
    if (entity.metadata.modifiers?.length) {
      score += Math.min(entity.metadata.modifiers.length * 0.3, 2);
    }

    return Math.round(score);
  }

  /**
   * Record performance metric
   */
  private recordPerformanceMetric(
    operation: string,
    durationMs: number,
    entityCount?: number,
    memoryUsage?: number,
  ): void {
    try {
      const id = this.generateId();
      const now = Date.now();

      this.statements.insertPerformanceMetric?.run(id, operation, durationMs, entityCount ?? 0, memoryUsage ?? 0, now);
    } catch (error) {
      // Don't let performance monitoring errors break main operations
      console.warn("[GraphStorage] Performance metric recording failed:", error);
    }
  }

  /**
   * Measure operation performance
   */
  private async measureOperation<T>(operation: string, fn: () => Promise<T> | T, entityCount?: number): Promise<T> {
    this.ensureReady();
    const start = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await fn();
      const duration = Date.now() - start;
      const memoryDelta = process.memoryUsage().heapUsed - startMemory;

      this.recordPerformanceMetric(operation, duration, entityCount, memoryDelta);

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordPerformanceMetric(`${operation}_error`, duration, entityCount);
      throw error;
    }
  }

  /**
   * Detect programming language from file path
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
      case "mjs":
        return "javascript";
      case "py":
        return "python";
      case "java":
        return "java";
      case "c":
        return "c";
      case "cpp":
      case "cc":
      case "cxx":
        return "cpp";
      case "rs":
        return "rust";
      case "go":
        return "go";
      case "php":
        return "php";
      case "rb":
        return "ruby";
      case "swift":
        return "swift";
      case "kt":
        return "kotlin";
      default:
        return "unknown";
    }
  }

  /**
   * Convert database row to Entity (enhanced for v2)
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
      updatedAt: row.updated_at,
      complexityScore: row.complexity_score,
      language: row.language,
      sizeBytes: row.size_bytes,
    };
  }

  /**
   * Convert database row to Relationship (enhanced for v2)
   */
  private rowToRelationship(row: any): Relationship {
    return {
      id: row.id,
      fromId: row.from_id,
      toId: row.to_id,
      type: row.type as RelationType,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      weight: row.weight,
      createdAt: row.created_at,
    };
  }

  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    this.ensureReady();
    const transaction = this.db.transaction(() => {
      this.db.exec("DELETE FROM relationships");
      this.db.exec("DELETE FROM entities");
      this.db.exec("DELETE FROM files");
      this.db.exec("DELETE FROM query_cache");
    });

    transaction();
  }
}
