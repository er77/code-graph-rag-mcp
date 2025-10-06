/**
 * TASK-002: Semantic Cache with LRU Eviction
 *
 * High-performance caching for embeddings and similarity results
 * Implements LRU eviction with TTL support for optimal memory usage
 *
 * External Dependencies:
 * - lru-cache: https://github.com/isaacs/node-lru-cache - LRU cache implementation
 *
 * Architecture References:
 * - Project Overview: doc/PROJECT_OVERVIEW.md
 * - Coding Standards: doc/CODING_STANDARD.md
 * - Architectural Decisions: doc/ARCHITECTURAL_DECISIONS.md
 *
 * @task_id TASK-002
 * @history
 *  - 2025-09-14: Created by Dev-Agent - TASK-002: Semantic cache with LRU implementation
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { LRUCache } from "lru-cache";
import type { SemanticAnalysis, SimilarityResult, VectorEmbedding } from "../types/semantic.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_MAX_SIZE = 5000;
const DEFAULT_TTL = 3600000; // 1 hour in milliseconds
const DEFAULT_MAX_AGE = 86400000; // 24 hours in milliseconds

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================
interface CacheOptions {
  maxSize?: number;
  ttl?: number;
  maxAge?: number;
  updateAgeOnGet?: boolean;
  updateAgeOnHas?: boolean;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  memoryUsage: number;
}

type CacheValue = VectorEmbedding | SimilarityResult[] | Float32Array | SemanticAnalysis;

// =============================================================================
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================
function estimateMemorySize(value: CacheValue): number {
  if (value instanceof Float32Array) {
    return value.length * 4; // 4 bytes per float32
  } else if (Array.isArray(value)) {
    return value.length * 100; // Rough estimate for array of objects
  } else if (typeof value === "object" && value !== null) {
    return JSON.stringify(value).length * 2; // Rough estimate for objects
  }
  return 100; // Default size
}

function generateCacheKey(...parts: (string | number)[]): string {
  return parts.join(":");
}

// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================
export class SemanticCache {
  private embeddingCache: LRUCache<string, Float32Array>;
  private resultCache: LRUCache<string, SimilarityResult[]>;
  private generalCache: LRUCache<string, CacheValue>;

  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(options: CacheOptions = {}) {
    const config = {
      maxSize: options.maxSize || DEFAULT_MAX_SIZE,
      ttl: options.ttl || DEFAULT_TTL,
      maxAge: options.maxAge || DEFAULT_MAX_AGE,
      updateAgeOnGet: options.updateAgeOnGet ?? true,
      updateAgeOnHas: options.updateAgeOnHas ?? false,
    };

    // Initialize embedding cache
    this.embeddingCache = new LRUCache<string, Float32Array>({
      max: Math.floor(config.maxSize / 3),
      ttl: config.ttl,
      maxSize: 100 * 1024 * 1024, // 100MB max memory
      sizeCalculation: (value) => value.length * 4,
      updateAgeOnGet: config.updateAgeOnGet,
      updateAgeOnHas: config.updateAgeOnHas,
      dispose: () => this.stats.evictions++,
    });

    // Initialize result cache
    this.resultCache = new LRUCache<string, SimilarityResult[]>({
      max: Math.floor(config.maxSize / 3),
      ttl: config.ttl,
      maxSize: 50 * 1024 * 1024, // 50MB max memory
      sizeCalculation: (value) => value.length * 100,
      updateAgeOnGet: config.updateAgeOnGet,
      updateAgeOnHas: config.updateAgeOnHas,
      dispose: () => this.stats.evictions++,
    });

    // Initialize general cache
    this.generalCache = new LRUCache<string, CacheValue>({
      max: Math.floor(config.maxSize / 3),
      ttl: config.ttl,
      maxSize: 50 * 1024 * 1024, // 50MB max memory
      sizeCalculation: estimateMemorySize,
      updateAgeOnGet: config.updateAgeOnGet,
      updateAgeOnHas: config.updateAgeOnHas,
      dispose: () => this.stats.evictions++,
    });

    console.log(`[SemanticCache] Initialized with max size: ${config.maxSize}, TTL: ${config.ttl}ms`);
  }

  /**
   * Cache an embedding
   */
  setEmbedding(key: string, embedding: Float32Array, ttl?: number): void {
    const cacheKey = generateCacheKey("embedding", key);
    this.embeddingCache.set(cacheKey, embedding, { ttl });
  }

  /**
   * Get a cached embedding
   */
  getEmbedding(key: string): Float32Array | undefined {
    const cacheKey = generateCacheKey("embedding", key);
    const result = this.embeddingCache.get(cacheKey);

    if (result) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }

    return result;
  }

  /**
   * Cache similarity search results
   */
  setSearchResults(query: string, results: SimilarityResult[], ttl?: number): void {
    const cacheKey = generateCacheKey("search", query);
    this.resultCache.set(cacheKey, results, { ttl });
  }

  /**
   * Get cached search results
   */
  getSearchResults(query: string): SimilarityResult[] | undefined {
    const cacheKey = generateCacheKey("search", query);
    const results = this.resultCache.get(cacheKey);

    if (results) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }

    return results;
  }

  /**
   * Cache a general value
   */
  set(key: string, value: CacheValue, ttl?: number): void {
    this.generalCache.set(key, value, { ttl });
  }

  /**
   * Get a cached general value
   */
  get<T = CacheValue>(key: string): T | undefined {
    const result = this.generalCache.get(key);

    if (result !== undefined) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }

    return result as T | undefined;
  }

  /**
   * Check if a key exists in any cache
   */
  has(key: string): boolean {
    return (
      this.embeddingCache.has(generateCacheKey("embedding", key)) ||
      this.resultCache.has(generateCacheKey("search", key)) ||
      this.generalCache.has(key)
    );
  }

  /**
   * Delete a specific key from all caches
   */
  delete(key: string): boolean {
    const embeddingDeleted = this.embeddingCache.delete(generateCacheKey("embedding", key));
    const searchDeleted = this.resultCache.delete(generateCacheKey("search", key));
    const generalDeleted = this.generalCache.delete(key);

    return embeddingDeleted || searchDeleted || generalDeleted;
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.embeddingCache.clear();
    this.resultCache.clear();
    this.generalCache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    console.log("[SemanticCache] All caches cleared");
  }

  /**
   * Prune expired entries from all caches
   */
  prune(): number {
    const before = this.size();

    this.embeddingCache.purgeStale();
    this.resultCache.purgeStale();
    this.generalCache.purgeStale();

    const pruned = before - this.size();
    console.log(`[SemanticCache] Pruned ${pruned} expired entries`);

    return pruned;
  }

  /**
   * Get total size across all caches
   */
  size(): number {
    return this.embeddingCache.size + this.resultCache.size + this.generalCache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    // Calculate approximate memory usage
    const embeddingMemory = this.embeddingCache.calculatedSize || 0;
    const resultMemory = this.resultCache.calculatedSize || 0;
    const generalMemory = this.generalCache.calculatedSize || 0;
    const memoryUsage = embeddingMemory + resultMemory + generalMemory;

    return {
      size: this.size(),
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate,
      memoryUsage,
    };
  }

  /**
   * Get detailed cache information
   */
  getInfo(): {
    embedding: { size: number; memory: number };
    results: { size: number; memory: number };
    general: { size: number; memory: number };
    stats: CacheStats;
  } {
    return {
      embedding: {
        size: this.embeddingCache.size,
        memory: this.embeddingCache.calculatedSize || 0,
      },
      results: {
        size: this.resultCache.size,
        memory: this.resultCache.calculatedSize || 0,
      },
      general: {
        size: this.generalCache.size,
        memory: this.generalCache.calculatedSize || 0,
      },
      stats: this.getStats(),
    };
  }

  /**
   * Warm up cache with pre-computed embeddings
   */
  async warmup(embeddings: Map<string, Float32Array>): Promise<void> {
    let loaded = 0;

    for (const [key, embedding] of embeddings) {
      if (loaded >= Math.floor(DEFAULT_MAX_SIZE / 3)) {
        break; // Don't exceed cache limits
      }

      this.setEmbedding(key, embedding);
      loaded++;
    }

    console.log(`[SemanticCache] Warmed up with ${loaded} embeddings`);
  }

  /**
   * Export cache contents for persistence
   */
  export(): {
    embeddings: Array<[string, Float32Array]>;
    results: Array<[string, SimilarityResult[]]>;
    general: Array<[string, CacheValue]>;
  } {
    return {
      embeddings: Array.from(this.embeddingCache.entries()),
      results: Array.from(this.resultCache.entries()),
      general: Array.from(this.generalCache.entries()),
    };
  }

  /**
   * Import cache contents from export
   */
  import(data: {
    embeddings?: Array<[string, Float32Array]>;
    results?: Array<[string, SimilarityResult[]]>;
    general?: Array<[string, CacheValue]>;
  }): void {
    if (data.embeddings) {
      for (const [key, value] of data.embeddings) {
        this.embeddingCache.set(key, value);
      }
    }

    if (data.results) {
      for (const [key, value] of data.results) {
        this.resultCache.set(key, value);
      }
    }

    if (data.general) {
      for (const [key, value] of data.general) {
        this.generalCache.set(key, value);
      }
    }

    console.log(`[SemanticCache] Imported ${this.size()} entries`);
  }
}
