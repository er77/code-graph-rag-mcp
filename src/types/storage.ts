/**
 * TASK-001: Storage Type Definitions for Indexer Agent
 *
 * Type definitions for SQLite storage layer and graph operations.
 * Provides interfaces for entities, relationships, and storage operations.
 *
 * Architecture References:
 * - Agent Types: src/types/agent.ts
 * - Parser Types: src/types/parser.ts
 * - Base Agent: src/agents/base.ts
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type { ParsedEntity } from "./parser.js";
export type { ParsedEntity };

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
export const MAX_BATCH_SIZE = 1000;
export const DEFAULT_CACHE_TTL = 300000; // 5 minutes
export const MAX_CONNECTIONS = 5;

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================

/**
 * Entity types in the code graph
 */
export enum EntityType {
  FUNCTION = "function",
  CLASS = "class",
  METHOD = "method",
  INTERFACE = "interface",
  TYPE = "type",
  IMPORT = "import",
  EXPORT = "export",
  VARIABLE = "variable",
  CONSTANT = "constant",
  PACKAGE = "package",
}

/**
 * Relationship types between entities
 */
export enum RelationType {
  CALLS = "calls",
  IMPORTS = "imports",
  EXPORTS = "exports",
  EXTENDS = "extends",
  IMPLEMENTS = "implements",
  REFERENCES = "references",
  CONTAINS = "contains",
  DEPENDS_ON = "depends_on",
}

/**
 * Core entity stored in the graph (enhanced for v2)
 */
export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  filePath: string;
  location: {
    start: { line: number; column: number; index: number };
    end: { line: number; column: number; index: number };
  };
  metadata: {
    modifiers?: string[];
    returnType?: string;
    parameters?: Array<{
      name: string;
      type?: string;
      optional?: boolean;
      defaultValue?: string;
    }>;
    importData?: {
      source: string;
      specifiers: Array<{ local: string; imported?: string }>;
      isDefault?: boolean;
      isNamespace?: boolean;
    };
    // Additional useful fields for all languages
    signature?: string;
    language?: string;
    decorators?: Array<{
      name: string;
      arguments?: string[];
      isBuiltin?: boolean;
    }>;
    [key: string]: unknown;
  };
  hash: string;
  createdAt: number;
  updatedAt: number;

  // Enhanced v2 fields
  complexityScore?: number;
  language?: string;
  sizeBytes?: number;
}

/**
 * Relationship between entities (enhanced for v2)
 */
export interface Relationship {
  id: string;
  fromId: string;
  toId: string;
  type: RelationType;
  metadata?: {
    line?: number;
    column?: number;
    context?: string;
    [key: string]: unknown;
  };

  // Enhanced v2 fields
  weight?: number;
  createdAt?: number;
}

/**
 * File tracking information
 */
export interface FileInfo {
  path: string;
  hash: string;
  lastIndexed: number;
  entityCount: number;
}

/**
 * Graph query parameters
 */
export interface GraphQuery {
  type: "entity" | "relationship" | "subgraph";
  filters?: {
    entityType?: EntityType | EntityType[];
    relationshipType?: RelationType | RelationType[];
    filePath?: string | string[];
    name?: string | RegExp;
  };
  depth?: number;
  limit?: number;
  offset?: number;
}

/**
 * Graph query result
 */
export interface GraphQueryResult {
  entities: Entity[];
  relationships: Relationship[];
  stats: {
    totalEntities: number;
    totalRelationships: number;
    queryTimeMs: number;
  };
}

/**
 * Entity change for incremental updates
 */
export interface EntityChange {
  type: "added" | "modified" | "deleted";
  entity?: Entity;
  entityId?: string;
  filePath: string;
  timestamp: number;
}

/**
 * Database schema definition
 */
export interface GraphSchema {
  entities: {
    id: string;
    name: string;
    type: string;
    file_path: string;
    location: string; // JSON string
    metadata: string; // JSON string
    hash: string;
    created_at: number;
    updated_at: number;
  };

  relationships: {
    id: string;
    from_id: string;
    to_id: string;
    type: string;
    metadata: string; // JSON string
  };

  files: {
    path: string;
    hash: string;
    last_indexed: number;
    entity_count: number;
  };

  migrations: {
    version: number;
    applied_at: number;
    checksum: string;
  };
}

/**
 * Storage metrics (enhanced for v2)
 */
export interface StorageMetrics {
  totalEntities: number;
  totalRelationships: number;
  totalFiles: number;
  databaseSizeMB: number;
  indexSizeMB: number;
  cacheHitRate: number;
  averageQueryTimeMs: number;
  lastVacuum: number;

  // Enhanced v2 metrics
  totalEmbeddings?: number;
  vectorSearchEnabled?: boolean;
  performanceMetricsCount?: number;
  memoryUsageMB?: number;
  concurrentConnections?: number;
}

/**
 * Batch operation result
 */
export interface BatchResult {
  processed: number;
  failed: number;
  errors: Array<{
    item: unknown;
    error: string;
  }>;
  timeMs: number;
}

/**
 * Cache entry for query results
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
 * Connection pool statistics
 */
export interface PoolStats {
  total: number;
  active: number;
  idle: number;
  waiting: number;
  timeouts: number;
}

// =============================================================================
// 4. STORAGE INTERFACE DEFINITIONS
// =============================================================================

/**
 * Main storage interface for graph operations
 */
export interface GraphStorage {
  // Entity operations
  insertEntity(entity: Entity): Promise<void>;
  insertEntities(entities: Entity[]): Promise<BatchResult>;
  updateEntity(id: string, updates: Partial<Entity>): Promise<void>;
  deleteEntity(id: string): Promise<void>;
  getEntity(id: string): Promise<Entity | null>;
  findEntities(query: GraphQuery): Promise<Entity[]>;

  // Relationship operations
  insertRelationship(relationship: Relationship): Promise<void>;
  insertRelationships(relationships: Relationship[]): Promise<BatchResult>;
  deleteRelationship(id: string): Promise<void>;
  getRelationshipsForEntity(entityId: string, type?: RelationType): Promise<Relationship[]>;
  findRelationships(query: GraphQuery): Promise<Relationship[]>;

  // File operations
  updateFileInfo(info: FileInfo): Promise<void>;
  getFileInfo(path: string): Promise<FileInfo | null>;
  getOutdatedFiles(since: number): Promise<FileInfo[]>;

  // Query operations
  executeQuery(query: GraphQuery): Promise<GraphQueryResult>;
  getSubgraph(entityId: string, depth: number): Promise<GraphQueryResult>;

  // Maintenance operations
  vacuum(): Promise<void>;
  analyze(): Promise<void>;
  getMetrics(): Promise<StorageMetrics>;
}

/**
 * Cache manager interface
 */
export interface CacheManager {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  };
}

/**
 * Connection pool interface
 */
export interface ConnectionPool<T> {
  acquire(): Promise<T>;
  release(connection: T): void;
  destroy(connection: T): void;
  drain(): Promise<void>;
  getStats(): PoolStats;
}

// =============================================================================
// 5. ENHANCED V2 TYPES
// =============================================================================

/**
 * Performance metrics entry
 */
export interface PerformanceMetric {
  id: string;
  operation: string;
  durationMs: number;
  entityCount?: number;
  memoryUsage?: number;
  createdAt: number;
}

/**
 * Vector embedding for semantic search
 */
export interface VectorEmbedding {
  id: string;
  entityId: string;
  content: string;
  vectorData?: ArrayBuffer | null;
  modelName: string;
  createdAt: number;
}

/**
 * Enhanced cache entry with v2 features
 */
export interface EnhancedCacheEntry<T = unknown> extends CacheEntry<T> {
  missCount?: number;
  lastAccessed?: number;
}

// =============================================================================
// 6. HELPER TYPES
// =============================================================================

/**
 * Convert ParsedEntity to Entity
 */
export function parsedEntityToEntity(
  parsed: ParsedEntity,
  filePath: string,
  hash: string,
): Omit<Entity, "id" | "createdAt" | "updatedAt"> {
  return {
    name: parsed.name,
    type: parsed.type as EntityType,
    filePath,
    location: parsed.location,
    metadata: {
      modifiers: parsed.modifiers,
      returnType: parsed.returnType,
      parameters: parsed.parameters,
      importData: parsed.importData,
      signature: parsed.signature,
      language: parsed.language,
      decorators: parsed.decorators,
    },
    hash,
  };
}

/**
 * Type guard for Entity
 */
export function isEntity(obj: unknown): obj is Entity {
  return typeof obj === "object" && obj !== null && "id" in obj && "name" in obj && "type" in obj && "filePath" in obj;
}

/**
 * Type guard for Relationship
 */
export function isRelationship(obj: unknown): obj is Relationship {
  return typeof obj === "object" && obj !== null && "id" in obj && "fromId" in obj && "toId" in obj && "type" in obj;
}
