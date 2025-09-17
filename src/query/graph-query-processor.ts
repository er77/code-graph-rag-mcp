/**
 * TASK-002: Graph Query Processor
 *
 * Core query execution engine for graph traversal and relationship queries.
 * Implements optimized query processing with SQLite and caching.
 *
 * External Dependencies:
 * - better-sqlite3: https://github.com/WiseLibs/better-sqlite3 - Fast synchronous SQLite3 bindings
 * - crypto: Node.js built-in - For query hashing
 *
 * Architecture References:
 * - Query Types: src/types/query.ts
 * - Storage Types: src/types/storage.ts
 * - SQLite Manager: src/storage/sqlite-manager.ts
 *
 * @task_id TASK-002
 * @coding_standard Adheres to: doc/CODING_STANDARD.md
 * @history
 *  - 2025-01-14: Created by Dev-Agent - TASK-002: Initial GraphQueryProcessor implementation
 */

import { createHash } from "node:crypto";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type Database from "better-sqlite3";
import type {
  Change,
  Cycle,
  DependencyNode,
  DependencyTree,
  Entity,
  Graph,
  GraphQuery,
  Hotspot,
  ImpactAnalysis,
  OptimizedQuery,
  Path,
  QueryResult,
  Relationship,
  RippleEffect,
} from "../types/query.js";
import type { EntityType, RelationType } from "../types/storage.js";
import type { ConnectionPool } from "./connection-pool.js";
import type { QueryCache } from "./query-cache.js";
import { QueryOptimizer } from "./query-optimizer.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const MAX_TRAVERSAL_DEPTH = 10;
const DEFAULT_BATCH_SIZE = 100;
const QUERY_TIMEOUT_MS = 5000;

// =============================================================================
// 3. GRAPH QUERY PROCESSOR IMPLEMENTATION
// =============================================================================

export class GraphQueryProcessor {
  private optimizer: QueryOptimizer;
  private preparedStatements: Map<string, Database.Statement> = new Map();

  constructor(
    private connectionPool: ConnectionPool,
    private cache: QueryCache,
  ) {
    this.optimizer = new QueryOptimizer();
  }

  /**
   * Execute a graph query with caching and optimization
   */
  async executeQuery<T = unknown>(query: GraphQuery): Promise<QueryResult<T>> {
    const startTime = Date.now();

    // Generate query hash
    query.hash = this.generateQueryHash(query);

    // Check cache first
    const cached = await this.cache.get<T>(query.hash);
    if (cached) {
      return {
        query,
        data: cached,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          fromCache: true,
          cacheLevel: await this.cache.getCacheLevel(query.hash),
        },
      };
    }

    // Execute query based on type
    let result: T;
    switch (query.operation) {
      case "getEntity":
        result = (await this.getEntityById(query.params.id as string)) as T;
        break;
      case "listEntities":
        result = (await this.listEntitiesWithFilter(query.params)) as T;
        break;
      case "getRelationships":
        result = (await this.getEntityRelationships(
          query.params.entityId as string,
          query.params.type as RelationType | undefined,
        )) as T;
        break;
      case "getRelatedEntities":
        result = (await this.getRelatedEntitiesRecursive(
          query.params.entityId as string,
          query.params.depth as number,
        )) as T;
        break;
      case "findPath":
        result = (await this.findShortestPath(query.params.fromId as string, query.params.toId as string)) as T;
        break;
      case "getSubgraph":
        result = (await this.extractSubgraph(query.params.rootId as string, query.params.depth as number)) as T;
        break;
      case "findDependencies":
        result = (await this.buildDependencyTree(query.params.entityId as string)) as T;
        break;
      case "detectCycles":
        result = (await this.detectAllCycles()) as T;
        break;
      case "analyzeHotspots":
        result = (await this.analyzeCodeHotspots()) as T;
        break;
      case "getImpactedEntities":
        result = (await this.analyzeImpact(query.params.entityId as string)) as T;
        break;
      case "calculateChangeRipple":
        result = (await this.calculateRippleEffect(query.params.changes as Change[])) as T;
        break;
      default:
        throw new Error(`Unknown query operation: ${query.operation}`);
    }

    // Cache the result
    await this.cache.set(query.hash, result);

    return {
      query,
      data: result,
      metadata: {
        executionTimeMs: Date.now() - startTime,
        fromCache: false,
      },
    };
  }

  // =============================================================================
  // 4. BASIC QUERY OPERATIONS
  // =============================================================================

  private async getEntityById(id: string): Promise<Entity | null> {
    const conn = await this.connectionPool.acquire();
    try {
      const stmt = this.getPreparedStatement(
        conn,
        "getEntity",
        `
        SELECT id, name, type, file_path as filePath, location, metadata, hash, 
               created_at as createdAt, updated_at as updatedAt
        FROM entities 
        WHERE id = ?
      `,
      );

      const row = stmt.get(id) as any;
      if (!row) return null;

      return this.rowToEntity(row);
    } finally {
      this.connectionPool.release(conn);
    }
  }

  private async listEntitiesWithFilter(filter: any): Promise<Entity[]> {
    const conn = await this.connectionPool.acquire();
    try {
      const optimized = this.optimizer.optimizeEntityQuery(filter);
      const stmt = conn.prepare(optimized.sql);
      const rows = optimized.params ? stmt.all(...optimized.params) : stmt.all();

      return rows.map((row: any) => this.rowToEntity(row));
    } finally {
      this.connectionPool.release(conn);
    }
  }

  private async getEntityRelationships(entityId: string, type?: RelationType): Promise<Relationship[]> {
    const conn = await this.connectionPool.acquire();
    try {
      let sql = `
        SELECT id, from_id as fromId, to_id as toId, type, metadata
        FROM relationships 
        WHERE from_id = ? OR to_id = ?
      `;
      const params: any[] = [entityId, entityId];

      if (type) {
        sql += " AND type = ?";
        params.push(type);
      }

      const stmt = conn.prepare(sql);
      const rows = stmt.all(...params);

      return rows.map((row: any) => this.rowToRelationship(row));
    } finally {
      this.connectionPool.release(conn);
    }
  }

  // =============================================================================
  // 5. GRAPH TRAVERSAL OPERATIONS
  // =============================================================================

  private async getRelatedEntitiesRecursive(entityId: string, depth: number): Promise<Entity[]> {
    if (depth <= 0 || depth > MAX_TRAVERSAL_DEPTH) {
      throw new Error(`Invalid depth: ${depth}. Must be between 1 and ${MAX_TRAVERSAL_DEPTH}`);
    }

    const conn = await this.connectionPool.acquire();
    try {
      const visited = new Set<string>();
      const result: Entity[] = [];
      const queue: Array<{ id: string; level: number }> = [{ id: entityId, level: 0 }];

      while (queue.length > 0) {
        const { id, level } = queue.shift()!;

        if (visited.has(id) || level > depth) continue;
        visited.add(id);

        // Get entity
        const entity = await this.getEntityById(id);
        if (entity && level > 0) {
          result.push(entity);
        }

        // Get related entities
        if (level < depth) {
          const relationships = await this.getEntityRelationships(id);
          for (const rel of relationships) {
            const nextId = rel.fromId === id ? rel.toId : rel.fromId;
            if (!visited.has(nextId)) {
              queue.push({ id: nextId, level: level + 1 });
            }
          }
        }
      }

      return result;
    } finally {
      this.connectionPool.release(conn);
    }
  }

  private async findShortestPath(fromId: string, toId: string): Promise<Path | null> {
    const conn = await this.connectionPool.acquire();
    try {
      // BFS implementation for shortest path
      const visited = new Set<string>();
      const queue: Array<{
        id: string;
        path: string[];
        edges: Relationship[];
      }> = [{ id: fromId, path: [fromId], edges: [] }];

      while (queue.length > 0) {
        const current = queue.shift()!;

        if (current.id === toId) {
          // Found path - load entities
          const nodes = await Promise.all(current.path.map((id) => this.getEntityById(id)));

          return {
            nodes: nodes.filter((n) => n !== null) as Entity[],
            edges: current.edges,
            length: current.path.length - 1,
          };
        }

        if (visited.has(current.id)) continue;
        visited.add(current.id);

        // Get neighbors
        const relationships = await this.getEntityRelationships(current.id);
        for (const rel of relationships) {
          const nextId = rel.fromId === current.id ? rel.toId : rel.fromId;
          if (!visited.has(nextId)) {
            queue.push({
              id: nextId,
              path: [...current.path, nextId],
              edges: [...current.edges, rel],
            });
          }
        }
      }

      return null; // No path found
    } finally {
      this.connectionPool.release(conn);
    }
  }

  private async extractSubgraph(rootId: string, depth: number): Promise<Graph> {
    const entities = new Map<string, Entity>();
    const relationships = new Map<string, Relationship>();

    // Get root entity
    const root = await this.getEntityById(rootId);
    if (!root) {
      throw new Error(`Entity not found: ${rootId}`);
    }
    entities.set(rootId, root);

    // BFS to extract subgraph
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number }> = [{ id: rootId, level: 0 }];

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;

      if (visited.has(id) || level >= depth) continue;
      visited.add(id);

      // Get relationships
      const rels = await this.getEntityRelationships(id);
      for (const rel of rels) {
        relationships.set(rel.id, rel);

        // Add connected entities
        const nextId = rel.fromId === id ? rel.toId : rel.fromId;
        if (!entities.has(nextId)) {
          const entity = await this.getEntityById(nextId);
          if (entity) {
            entities.set(nextId, entity);
            if (level + 1 < depth) {
              queue.push({ id: nextId, level: level + 1 });
            }
          }
        }
      }
    }

    return {
      rootId,
      entities,
      relationships,
      depth,
    };
  }

  // =============================================================================
  // 6. ANALYSIS OPERATIONS
  // =============================================================================

  private async buildDependencyTree(entityId: string): Promise<DependencyTree> {
    const root = await this.getEntityById(entityId);
    if (!root) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    const dependencies = new Map<string, DependencyNode>();
    const cycles: Cycle[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const buildNode = async (id: string, depth: number): Promise<DependencyNode> => {
      if (recursionStack.has(id)) {
        // Cycle detected
        return {
          entity: (await this.getEntityById(id))!,
          children: [],
          depth,
          circular: true,
        };
      }

      if (visited.has(id)) {
        return dependencies.get(id)!;
      }

      visited.add(id);
      recursionStack.add(id);

      const entity = await this.getEntityById(id);
      const node: DependencyNode = {
        entity: entity!,
        children: [],
        depth,
        circular: false,
      };

      // Get dependencies (outgoing DEPENDS_ON relationships)
      const relationships = await this.getEntityRelationships(id, "depends_on" as RelationType);
      for (const rel of relationships) {
        if (rel.fromId === id) {
          const childNode = await buildNode(rel.toId, depth + 1);
          node.children.push(childNode);
        }
      }

      recursionStack.delete(id);
      dependencies.set(id, node);
      return node;
    };

    await buildNode(entityId, 0);

    return {
      root,
      dependencies,
      cycles,
    };
  }

  private async detectAllCycles(): Promise<Cycle[]> {
    const conn = await this.connectionPool.acquire();
    try {
      const cycles: Cycle[] = [];
      const visited = new Set<string>();

      // Get all entities
      const entities = conn.prepare("SELECT id FROM entities").all() as Array<{ id: string }>;

      for (const { id } of entities) {
        if (!visited.has(id)) {
          const cycle = await this.detectCycleFromEntity(id, visited);
          if (cycle) {
            cycles.push(cycle);
          }
        }
      }

      return cycles;
    } finally {
      this.connectionPool.release(conn);
    }
  }

  private async detectCycleFromEntity(startId: string, globalVisited: Set<string>): Promise<Cycle | null> {
    const path: string[] = [];
    const pathSet = new Set<string>();
    const localVisited = new Set<string>();

    const dfs = async (id: string): Promise<Cycle | null> => {
      localVisited.add(id);
      globalVisited.add(id);
      path.push(id);
      pathSet.add(id);

      const relationships = await this.getEntityRelationships(id);
      for (const rel of relationships) {
        if (rel.fromId === id) {
          if (pathSet.has(rel.toId)) {
            // Cycle found
            const cycleStart = path.indexOf(rel.toId);
            const cycleNodes = await Promise.all(path.slice(cycleStart).map((nodeId) => this.getEntityById(nodeId)));

            return {
              nodes: cycleNodes.filter((n) => n !== null) as Entity[],
              edges: [], // Would need to collect edges during traversal
              type: "reference",
            };
          }

          if (!localVisited.has(rel.toId)) {
            const cycle = await dfs(rel.toId);
            if (cycle) return cycle;
          }
        }
      }

      path.pop();
      pathSet.delete(id);
      return null;
    };

    return dfs(startId);
  }

  private async analyzeCodeHotspots(): Promise<Hotspot[]> {
    const conn = await this.connectionPool.acquire();
    try {
      // Query for entities with relationship counts
      const sql = `
        WITH relationship_counts AS (
          SELECT 
            e.id,
            COUNT(DISTINCT r1.id) as incoming,
            COUNT(DISTINCT r2.id) as outgoing
          FROM entities e
          LEFT JOIN relationships r1 ON r1.to_id = e.id
          LEFT JOIN relationships r2 ON r2.from_id = e.id
          GROUP BY e.id
        )
        SELECT 
          e.*,
          rc.incoming,
          rc.outgoing,
          (rc.incoming + rc.outgoing) as total_relationships
        FROM entities e
        JOIN relationship_counts rc ON rc.id = e.id
        WHERE (rc.incoming + rc.outgoing) > 5
        ORDER BY total_relationships DESC
        LIMIT 100
      `;

      const rows = conn.prepare(sql).all() as any[];

      return rows.map((row) => ({
        entity: this.rowToEntity(row),
        score: row.total_relationships * 10 + row.incoming * 5, // Weighted score
        metrics: {
          incomingRelationships: row.incoming,
          outgoingRelationships: row.outgoing,
          changeFrequency: 0, // Would need change tracking
          complexity: Math.min(100, row.total_relationships * 2),
        },
      }));
    } finally {
      this.connectionPool.release(conn);
    }
  }

  private async analyzeImpact(entityId: string): Promise<ImpactAnalysis> {
    const sourceEntity = await this.getEntityById(entityId);
    if (!sourceEntity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    // Get direct impacts (entities that depend on this one)
    const directRelationships = await this.getEntityRelationships(entityId);
    const directImpactIds = new Set<string>();

    for (const rel of directRelationships) {
      if (rel.toId === entityId) {
        directImpactIds.add(rel.fromId);
      }
    }

    // Get indirect impacts (2 levels deep)
    const allImpacted = new Set<string>(directImpactIds);
    for (const impactedId of directImpactIds) {
      const secondLevel = await this.getRelatedEntitiesRecursive(impactedId, 2);
      secondLevel.forEach((e) => allImpacted.add(e.id));
    }

    // Load all impacted entities
    const directImpacts = await Promise.all(Array.from(directImpactIds).map((id) => this.getEntityById(id)));

    const indirectImpacts = await Promise.all(
      Array.from(allImpacted)
        .filter((id) => !directImpactIds.has(id))
        .map((id) => this.getEntityById(id)),
    );

    const allEntities = [...directImpacts, ...indirectImpacts].filter((e) => e !== null) as Entity[];
    const affectedFiles = new Set(allEntities.map((e) => e.filePath));

    // Calculate risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    if (allImpacted.size > 50) riskLevel = "critical";
    else if (allImpacted.size > 20) riskLevel = "high";
    else if (allImpacted.size > 5) riskLevel = "medium";
    else riskLevel = "low";

    return {
      sourceEntity,
      impactedEntities: allEntities,
      directImpacts: directImpacts.filter((e) => e !== null) as Entity[],
      indirectImpacts: indirectImpacts.filter((e) => e !== null) as Entity[],
      riskLevel,
      affectedFiles: Array.from(affectedFiles),
    };
  }

  private async calculateRippleEffect(changes: Change[]): Promise<RippleEffect> {
    const affectedEntities = new Map<
      string,
      {
        entity: Entity;
        impactLevel: number;
        reason: string;
      }
    >();

    let totalRisk = 0;

    for (const change of changes) {
      const impact = await this.analyzeImpact(change.entityId);

      // Add direct impacts
      for (const entity of impact.directImpacts) {
        const existing = affectedEntities.get(entity.id);
        const impactLevel = change.type === "deleted" ? 3 : change.type === "modified" ? 2 : 1;

        if (!existing || existing.impactLevel < impactLevel) {
          affectedEntities.set(entity.id, {
            entity,
            impactLevel,
            reason: `Direct dependency on ${change.type} entity`,
          });
        }

        totalRisk += impactLevel;
      }

      // Add indirect impacts with lower level
      for (const entity of impact.indirectImpacts) {
        if (!affectedEntities.has(entity.id)) {
          affectedEntities.set(entity.id, {
            entity,
            impactLevel: 1,
            reason: "Indirect dependency",
          });
          totalRisk += 0.5;
        }
      }
    }

    return {
      changes,
      affectedEntities,
      estimatedRisk: Math.min(100, totalRisk * 5), // Normalized risk score
    };
  }

  // =============================================================================
  // 7. HELPER METHODS
  // =============================================================================

  private getPreparedStatement(conn: Database.Database, key: string, sql: string): Database.Statement {
    const cacheKey = `${conn.name}:${key}`;
    if (!this.preparedStatements.has(cacheKey)) {
      this.preparedStatements.set(cacheKey, conn.prepare(sql));
    }
    return this.preparedStatements.get(cacheKey)!;
  }

  private rowToEntity(row: any): Entity {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      filePath: row.filePath || row.file_path,
      location: typeof row.location === "string" ? JSON.parse(row.location) : row.location,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
      hash: row.hash,
      createdAt: row.createdAt || row.created_at,
      updatedAt: row.updatedAt || row.updated_at,
    };
  }

  private rowToRelationship(row: any): Relationship {
    return {
      id: row.id,
      fromId: row.fromId || row.from_id,
      toId: row.toId || row.to_id,
      type: row.type,
      metadata: row.metadata ? (typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata) : undefined,
    };
  }

  private generateQueryHash(query: GraphQuery): string {
    const data = JSON.stringify({
      type: query.type,
      operation: query.operation,
      params: query.params,
    });
    return createHash("sha256").update(data).digest("hex").substring(0, 16);
  }
}
