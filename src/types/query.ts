/**
 * TASK-002: Query Type Definitions for QueryAgent
 * 
 * Type definitions for graph traversal, relationship queries, and query operations.
 * Provides interfaces for query processing, caching, and streaming.
 * 
 * External Dependencies:
 * - None (pure TypeScript type definitions)
 * 
 * Architecture References:
 * - Storage Types: src/types/storage.ts
 * - Agent Types: src/types/agent.ts
 * - Graph Storage: src/storage/graph-storage.ts
 * 
 * @task_id TASK-002
 * @coding_standard Adheres to: doc/CODING_STANDARD.md
 * @history
 *  - 2025-01-14: Created by Dev-Agent - TASK-002: Initial query type definitions
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type { Entity, Relationship, EntityType, RelationType } from './storage.js';

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
export const MAX_QUERY_DEPTH = 10;
export const DEFAULT_QUERY_LIMIT = 100;
export const MAX_CONCURRENT_QUERIES = 10;
export const CACHE_L1_SIZE = 100; // Hot cache
export const CACHE_L2_SIZE = 1000; // Warm cache
export const DEFAULT_TTL_MS = 300000; // 5 minutes

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================

/**
 * Filter for entity queries
 */
export interface EntityFilter {
  id?: string | string[];
  name?: string | RegExp;
  type?: EntityType | EntityType[];
  filePath?: string | string[];
  namePattern?: string;
  hasRelationType?: RelationType;
}

/**
 * Graph traversal path
 */
export interface Path {
  nodes: Entity[];
  edges: Relationship[];
  length: number;
  cost?: number;
}

/**
 * Subgraph representation
 */
export interface Graph {
  rootId: string;
  entities: Map<string, Entity>;
  relationships: Map<string, Relationship>;
  depth: number;
}

/**
 * Dependency tree structure
 */
export interface DependencyTree {
  root: Entity;
  dependencies: Map<string, DependencyNode>;
  cycles: Cycle[];
}

export interface DependencyNode {
  entity: Entity;
  children: DependencyNode[];
  depth: number;
  circular: boolean;
}

/**
 * Cycle detection result
 */
export interface Cycle {
  nodes: Entity[];
  edges: Relationship[];
  type: 'import' | 'inheritance' | 'reference';
}

/**
 * Code hotspot analysis
 */
export interface Hotspot {
  entity: Entity;
  score: number;
  metrics: {
    incomingRelationships: number;
    outgoingRelationships: number;
    changeFrequency: number;
    complexity: number;
  };
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysis {
  sourceEntity: Entity;
  impactedEntities: Entity[];
  directImpacts: Entity[];
  indirectImpacts: Entity[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedFiles: string[];
}

/**
 * Change ripple effect
 */
export interface Change {
  entityId: string;
  type: 'added' | 'modified' | 'deleted';
  timestamp: number;
}

export interface RippleEffect {
  changes: Change[];
  affectedEntities: Map<string, {
    entity: Entity;
    impactLevel: number;
    reason: string;
  }>;
  estimatedRisk: number;
}

/**
 * Query operations interface
 */
export interface QueryOperations {
  // Basic queries
  getEntity(id: string): Promise<Entity | null>;
  listEntities(filter: EntityFilter): Promise<Entity[]>;
  
  // Relationship queries
  getRelationships(entityId: string, type?: RelationType): Promise<Relationship[]>;
  getRelatedEntities(entityId: string, depth: number): Promise<Entity[]>;
  
  // Graph traversal
  findPath(fromId: string, toId: string): Promise<Path | null>;
  getSubgraph(rootId: string, depth: number): Promise<Graph>;
  
  // Advanced queries
  findDependencies(entityId: string): Promise<DependencyTree>;
  detectCycles(): Promise<Cycle[]>;
  analyzeHotspots(): Promise<Hotspot[]>;
  
  // Impact analysis
  getImpactedEntities(entityId: string): Promise<ImpactAnalysis>;
  calculateChangeRipple(changes: Change[]): Promise<RippleEffect>;
}

/**
 * Graph query for processing
 */
export interface GraphQuery {
  id: string;
  type: 'entity' | 'relationship' | 'traversal' | 'analysis';
  operation: string;
  params: Record<string, unknown>;
  hash: string;
  timestamp: number;
}

/**
 * Query result wrapper
 */
export interface QueryResult<T = unknown> {
  query: GraphQuery;
  data: T;
  metadata: {
    executionTimeMs: number;
    fromCache: boolean;
    cacheLevel?: 'L1' | 'L2' | 'L3';
  };
}

/**
 * Optimized query for execution
 */
export interface OptimizedQuery {
  sql: string;
  params?: unknown[];
  estimatedCost: number;
  useIndex?: string;
}

/**
 * Cache entry structure
 */
export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  l1Entries: number;
  l2Entries: number;
  l3Entries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsageMB: number;
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  connectionTestInterval: number;
}

/**
 * Streaming options
 */
export interface StreamOptions {
  batchSize: number;
  highWaterMark: number;
  encoding?: BufferEncoding;
}

/**
 * Query metrics for monitoring
 */
export interface QueryMetrics {
  totalQueries: number;
  averageResponseTime: number;
  slowQueries: number;
  errorRate: number;
  cacheHitRate: number;
  concurrentQueries: number;
}