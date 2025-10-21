/**
 * TASK-002: Query Optimizer
 *
 * Optimizes graph queries for efficient SQLite execution.
 * Implements query rewriting, index usage, and cost estimation.
 *
 * External Dependencies:
 * - None (pure TypeScript implementation)
 *
 * Architecture References:
 * - Query Types: src/types/query.ts
 * - Storage Types: src/types/storage.ts
 *
 * @task_id TASK-002
 * @coding_standard Adheres to: doc/CODING_STANDARD.md
 * @history
 *  - 2025-01-14: Created by Dev-Agent - TASK-002: Initial QueryOptimizer implementation
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type { EntityFilter, OptimizedQuery } from "../types/query.js";
import type { RelationType } from "../types/storage.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const INDEX_COST_FACTOR = 0.1; // Using index reduces cost by 90%
const FULL_SCAN_COST = 1000;

// =============================================================================
// 3. QUERY OPTIMIZER IMPLEMENTATION
// =============================================================================

export class QueryOptimizer {
  /**
   * Optimize entity query
   */
  optimizeEntityQuery(filter: EntityFilter): OptimizedQuery {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let estimatedCost = FULL_SCAN_COST;
    let useIndex: string | undefined;

    // Build base query
    let sql = `
      SELECT id, name, type, file_path as filePath, location, metadata, hash,
             created_at as createdAt, updated_at as updatedAt
      FROM entities
    `;

    // Apply filters with optimization
    if (filter.id) {
      if (Array.isArray(filter.id)) {
        const placeholders = filter.id.map(() => "?").join(",");
        conditions.push(`id IN (${placeholders})`);
        params.push(...filter.id);
        estimatedCost = filter.id.length;
      } else {
        conditions.push("id = ?");
        params.push(filter.id);
        estimatedCost = 1;
      }
      useIndex = "PRIMARY";
    }

    if (filter.type) {
      if (Array.isArray(filter.type)) {
        const placeholders = filter.type.map(() => "?").join(",");
        conditions.push(`type IN (${placeholders})`);
        params.push(...filter.type);
      } else {
        conditions.push("type = ?");
        params.push(filter.type);
      }
      estimatedCost *= INDEX_COST_FACTOR;
      useIndex = useIndex || "idx_entities_type";
    }

    if (filter.filePath) {
      if (Array.isArray(filter.filePath)) {
        const placeholders = filter.filePath.map(() => "?").join(",");
        conditions.push(`file_path IN (${placeholders})`);
        params.push(...filter.filePath);
      } else {
        conditions.push("file_path = ?");
        params.push(filter.filePath);
      }
      estimatedCost *= INDEX_COST_FACTOR;
      useIndex = useIndex || "idx_entities_file_path";
    }

    if (filter.name) {
      if (filter.name instanceof RegExp) {
        // Convert regex to LIKE pattern
        const pattern = this.regexToLikePattern(filter.name);
        conditions.push("name LIKE ?");
        params.push(pattern);
        estimatedCost *= 0.5; // LIKE is more expensive than equality
      } else {
        conditions.push("name = ?");
        params.push(filter.name);
        estimatedCost *= INDEX_COST_FACTOR;
        useIndex = useIndex || "idx_entities_name";
      }
    }

    if (filter.namePattern) {
      conditions.push("name LIKE ?");
      params.push(`%${filter.namePattern}%`);
      estimatedCost *= 0.7;
    }

    // Join relationship table if needed
    if (filter.hasRelationType) {
      sql = `
        SELECT DISTINCT e.id, e.name, e.type, e.file_path as filePath, 
               e.location, e.metadata, e.hash,
               e.created_at as createdAt, e.updated_at as updatedAt
        FROM entities e
        INNER JOIN relationships r ON (e.id = r.from_id OR e.id = r.to_id)
      `;
      conditions.push("r.type = ?");
      params.push(filter.hasRelationType);
      estimatedCost *= 2; // Join increases cost
    }

    // Apply WHERE clause
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    // Apply ordering and limits
    sql += ` ORDER BY name ASC LIMIT ${DEFAULT_LIMIT}`;

    return {
      sql,
      params: params.length > 0 ? params : undefined,
      estimatedCost: Math.round(estimatedCost),
      useIndex,
    };
  }

  /**
   * Optimize relationship query
   */
  optimizeRelationshipQuery(
    entityId: string,
    type?: RelationType,
    direction?: "incoming" | "outgoing" | "both",
  ): OptimizedQuery {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let estimatedCost = 100;
    let useIndex: string | undefined;

    let sql = `
      SELECT id, from_id as fromId, to_id as toId, type, metadata
      FROM relationships
    `;

    // Apply direction filter
    if (direction === "incoming") {
      conditions.push("to_id = ?");
      params.push(entityId);
      useIndex = "idx_relationships_to_id";
      estimatedCost = 10;
    } else if (direction === "outgoing") {
      conditions.push("from_id = ?");
      params.push(entityId);
      useIndex = "idx_relationships_from_id";
      estimatedCost = 10;
    } else {
      conditions.push("(from_id = ? OR to_id = ?)");
      params.push(entityId, entityId);
      estimatedCost = 20;
    }

    // Apply type filter
    if (type) {
      conditions.push("type = ?");
      params.push(type);
      estimatedCost *= INDEX_COST_FACTOR;
      if (!useIndex) {
        useIndex = "idx_relationships_type";
      }
    }

    sql += ` WHERE ${conditions.join(" AND ")}`;
    sql += ` LIMIT ${MAX_LIMIT}`;

    return {
      sql,
      params,
      estimatedCost: Math.round(estimatedCost),
      useIndex,
    };
  }

  /**
   * Optimize traversal query with depth
   */
  optimizeTraversalQuery(rootId: string, depth: number, relationTypes?: RelationType[]): OptimizedQuery {
    // For traversal, we use a recursive CTE
    const typeCondition = relationTypes ? `AND r.type IN (${relationTypes.map(() => "?").join(",")})` : "";

    const sql = `
      WITH RECURSIVE traversal(id, level, path) AS (
        -- Base case: start from root
        SELECT ?, 0, ?
        
        UNION ALL
        
        -- Recursive case: follow relationships
        SELECT 
          CASE 
            WHEN r.from_id = t.id THEN r.to_id
            ELSE r.from_id
          END,
          t.level + 1,
          t.path || ',' || CASE 
            WHEN r.from_id = t.id THEN r.to_id
            ELSE r.from_id
          END
        FROM traversal t
        INNER JOIN relationships r ON (r.from_id = t.id OR r.to_id = t.id)
        WHERE t.level < ?
          ${typeCondition}
          AND t.path NOT LIKE '%' || CASE 
            WHEN r.from_id = t.id THEN r.to_id
            ELSE r.from_id
          END || '%' -- Avoid cycles
      )
      SELECT DISTINCT e.*, t.level
      FROM traversal t
      INNER JOIN entities e ON e.id = t.id
      WHERE t.level > 0
      ORDER BY t.level, e.name
    `;

    const params: unknown[] = [rootId, rootId, depth];
    if (relationTypes) {
      params.push(...relationTypes);
    }

    // Cost increases exponentially with depth
    const estimatedCost = 10 ** Math.min(depth, 3) * (relationTypes ? 0.5 : 1);

    return {
      sql,
      params,
      estimatedCost: Math.round(estimatedCost),
      useIndex: "idx_relationships_from_id,idx_relationships_to_id",
    };
  }

  /**
   * Optimize path finding query
   */
  optimizePathQuery(fromId: string, toId: string, maxDepth: number = 10): OptimizedQuery {
    // Use recursive CTE for pathfinding
    const sql = `
      WITH RECURSIVE path_search(current_id, target_id, path, edges, depth) AS (
        -- Base case: start from source
        SELECT ?, ?, ?, '', 0
        
        UNION ALL
        
        -- Recursive case: explore neighbors
        SELECT 
          CASE 
            WHEN r.from_id = p.current_id THEN r.to_id
            ELSE r.from_id
          END,
          p.target_id,
          p.path || ',' || CASE 
            WHEN r.from_id = p.current_id THEN r.to_id
            ELSE r.from_id
          END,
          p.edges || ',' || r.id,
          p.depth + 1
        FROM path_search p
        INNER JOIN relationships r ON (r.from_id = p.current_id OR r.to_id = p.current_id)
        WHERE p.depth < ?
          AND p.current_id != p.target_id
          AND p.path NOT LIKE '%' || CASE 
            WHEN r.from_id = p.current_id THEN r.to_id
            ELSE r.from_id
          END || '%'
      )
      SELECT path, edges, depth
      FROM path_search
      WHERE current_id = target_id
      ORDER BY depth
      LIMIT 1
    `;

    const params = [fromId, toId, fromId, maxDepth];
    const estimatedCost = maxDepth * 50;

    return {
      sql,
      params,
      estimatedCost: Math.round(estimatedCost),
      useIndex: "idx_relationships_from_id,idx_relationships_to_id",
    };
  }

  /**
   * Optimize hotspot analysis query
   */
  optimizeHotspotQuery(minConnections: number = 5): OptimizedQuery {
    const sql = `
      WITH connection_counts AS (
        SELECT 
          e.id,
          e.name,
          e.type,
          e.file_path,
          COUNT(DISTINCT r1.id) as incoming_count,
          COUNT(DISTINCT r2.id) as outgoing_count
        FROM entities e
        LEFT JOIN relationships r1 ON r1.to_id = e.id
        LEFT JOIN relationships r2 ON r2.from_id = e.id
        GROUP BY e.id, e.name, e.type, e.file_path
        HAVING (COUNT(DISTINCT r1.id) + COUNT(DISTINCT r2.id)) >= ?
      )
      SELECT 
        e.*,
        cc.incoming_count,
        cc.outgoing_count,
        (cc.incoming_count + cc.outgoing_count) as total_connections,
        (cc.incoming_count * 2 + cc.outgoing_count) as weighted_score
      FROM connection_counts cc
      INNER JOIN entities e ON e.id = cc.id
      ORDER BY weighted_score DESC
      LIMIT 100
    `;

    const params = [minConnections];
    const estimatedCost = 500; // Complex aggregation query

    return {
      sql,
      params,
      estimatedCost,
      useIndex: "idx_relationships_to_id,idx_relationships_from_id",
    };
  }

  /**
   * Optimize cycle detection query
   */
  optimizeCycleDetectionQuery(maxDepth: number = 10): OptimizedQuery {
    const sql = `
      WITH RECURSIVE cycle_search(start_id, current_id, path, depth) AS (
        -- Start from each entity
        SELECT id, id, id, 0
        FROM entities
        
        UNION ALL
        
        -- Follow outgoing relationships
        SELECT 
          cs.start_id,
          r.to_id,
          cs.path || ',' || r.to_id,
          cs.depth + 1
        FROM cycle_search cs
        INNER JOIN relationships r ON r.from_id = cs.current_id
        WHERE cs.depth < ?
          AND cs.path NOT LIKE '%' || r.to_id || '%'
        
        UNION ALL
        
        -- Detect cycle when we return to start
        SELECT 
          cs.start_id,
          r.to_id,
          cs.path || ',' || r.to_id,
          cs.depth + 1
        FROM cycle_search cs
        INNER JOIN relationships r ON r.from_id = cs.current_id
        WHERE cs.depth > 0
          AND r.to_id = cs.start_id
      )
      SELECT DISTINCT start_id, path, depth
      FROM cycle_search
      WHERE current_id = start_id AND depth > 0
      ORDER BY depth, start_id
    `;

    const params = [maxDepth];
    const estimatedCost = 1000; // Very expensive operation

    return {
      sql,
      params,
      estimatedCost,
      useIndex: "idx_relationships_from_id",
    };
  }

  // =============================================================================
  // 4. HELPER METHODS
  // =============================================================================

  /**
   * Convert regex to SQL LIKE pattern
   */
  private regexToLikePattern(regex: RegExp): string {
    let pattern = regex.source;

    // Basic conversion (simplified)
    pattern = pattern.replace(/\^/g, "");
    pattern = pattern.replace(/\$/g, "");
    pattern = pattern.replace(/\./g, "_");
    pattern = pattern.replace(/\*/g, "%");
    pattern = pattern.replace(/\+/g, "%");
    pattern = pattern.replace(/\?/g, "_");

    // Handle word boundaries
    pattern = pattern.replace(/\\b/g, "");

    // Add wildcards if not present
    if (!pattern.startsWith("%")) pattern = `%${pattern}`;
    if (!pattern.endsWith("%")) pattern = `${pattern}%`;

    return pattern;
  }

  /**
   * Estimate query cost based on complexity
   */
  estimateQueryCost(sql: string): number {
    let cost = 0;

    // Count operations
    const joins = (sql.match(/JOIN/gi) || []).length;
    const subqueries = (sql.match(/SELECT.*FROM.*SELECT/gi) || []).length;
    const aggregates = (sql.match(/COUNT|SUM|AVG|MAX|MIN/gi) || []).length;
    const groupBy = sql.includes("GROUP BY") ? 1 : 0;
    const orderBy = sql.includes("ORDER BY") ? 1 : 0;
    const distinct = sql.includes("DISTINCT") ? 1 : 0;

    // Calculate cost
    cost += joins * 100;
    cost += subqueries * 200;
    cost += aggregates * 50;
    cost += groupBy * 150;
    cost += orderBy * 25;
    cost += distinct * 30;

    // Base cost for table scan
    if (cost === 0) {
      cost = 100;
    }

    return cost;
  }
}
