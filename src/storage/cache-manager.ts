/**
 * TASK-001: Cache Manager for Query Results
 *
 * LRU cache implementation for query result caching.
 * Optimized for memory-constrained environments.
 *
 * External Dependencies:
 * - lru-cache: https://github.com/isaacs/node-lru-cache - LRU cache implementation
 *
 * Architecture References:
 * - Storage Types: src/types/storage.ts
 * - Graph Storage: src/storage/graph-storage.ts
 */

import { createHash } from "node:crypto";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { LRUCache } from "lru-cache";
import type { CacheEntry, CacheManager } from "../types/storage.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_ENTRIES = 1000;

// =============================================================================
// 3. CACHE MANAGER IMPLEMENTATION
// =============================================================================

export class QueryCacheManager implements CacheManager {
  private cache: LRUCache<string, CacheEntry>;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0,
  };

  constructor(config: CacheConfig = {}) {
    this.cache = new LRUCache<string, CacheEntry>({
      max: config.maxEntries || DEFAULT_MAX_ENTRIES,
      maxSize: config.maxSize || DEFAULT_MAX_SIZE,

      // Size calculation
      sizeCalculation: (entry: CacheEntry) => {
        return entry.size || this.estimateSize(entry.value);
      },

      // Disposal handler
      dispose: (_value: CacheEntry, key: string, reason: LRUCache.DisposeReason) => {
        if (reason === "evict" || reason === "delete") {
          this.stats.evictions++;
          console.debug(`[CacheManager] Evicted cache entry: ${key} (reason: ${reason})`);
        }
      },

      // TTL based on entry - using function form to allow per-entry TTL
      ttl: config.defaultTTL || DEFAULT_TTL,

      // Update age on get
      updateAgeOnGet: true,
      updateAgeOnHas: false,

      // Allow stale entries
      allowStale: false,
    });
  }

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (entry) {
      this.stats.hits++;

      // Update hit count
      entry.hits++;
      this.cache.set(key, entry);

      return entry.value as T;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set cache value
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const size = this.estimateSize(value);

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || DEFAULT_TTL,
      hits: 0,
      size,
    };

    this.cache.set(key, entry);
    this.stats.sets++;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    console.log("[CacheManager] Cache cleared");
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    entries: number;
    evictions: number;
    memoryUsage: number;
  } {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      entries: this.cache.size,
      evictions: this.stats.evictions,
      memoryUsage: this.cache.calculatedSize || 0,
    };
  }

  /**
   * Create cache key from query parameters
   */
  static createKey(params: Record<string, any>): string {
    const sorted = Object.keys(params)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = params[key];
          return acc;
        },
        {} as Record<string, any>,
      );

    const json = JSON.stringify(sorted);
    return createHash("sha256").update(json).digest("hex").substring(0, 16);
  }

  /**
   * Estimate size of a value in bytes
   */
  private estimateSize(value: unknown): number {
    if (value === null || value === undefined) return 0;

    if (typeof value === "string") {
      return value.length * 2; // Approximate UTF-16 size
    }

    if (typeof value === "number") {
      return 8;
    }

    if (typeof value === "boolean") {
      return 4;
    }

    if (value instanceof Date) {
      return 8;
    }

    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + this.estimateSize(item), 24);
    }

    if (typeof value === "object") {
      let size = 24; // Object overhead
      for (const key in value) {
        if (Object.hasOwn(value, key)) {
          size += key.length * 2 + this.estimateSize((value as any)[key]);
        }
      }
      return size;
    }

    return 24; // Default size
  }

  /**
   * Prune expired entries
   */
  prune(): void {
    const pruned = this.cache.purgeStale();
    if (pruned) {
      console.log("[CacheManager] Pruned stale entries");
    }
  }

  /**
   * Get cache entries (for debugging)
   */
  getEntries(): Array<{ key: string; value: CacheEntry }> {
    const entries: Array<{ key: string; value: CacheEntry }> = [];

    for (const [key, value] of this.cache.entries()) {
      entries.push({ key, value });
    }

    return entries;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
    };
  }
}

// =============================================================================
// 4. CONFIGURATION INTERFACE
// =============================================================================

export interface CacheConfig {
  maxSize?: number; // Maximum cache size in bytes
  maxEntries?: number; // Maximum number of entries
  defaultTTL?: number; // Default TTL in milliseconds
}

// =============================================================================
// 5. DECORATOR FOR CACHE-ENABLED METHODS
// =============================================================================

/**
 * Decorator to add caching to a method
 */
export function Cacheable(ttl?: number) {
  return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const cacheManager = new QueryCacheManager();

    descriptor.value = async function (...args: any[]) {
      // Create cache key from arguments
      const key = QueryCacheManager.createKey({ method: propertyKey, args });

      // Check cache
      const cached = cacheManager.get(key);
      if (cached !== null) {
        console.debug(`[Cache] Hit for ${propertyKey}`);
        return cached;
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Store in cache
      cacheManager.set(key, result, ttl);

      return result;
    };

    return descriptor;
  };
}

// =============================================================================
// 6. SINGLETON INSTANCE
// =============================================================================

let cacheInstance: QueryCacheManager | null = null;

/**
 * Get singleton cache manager instance
 */
export function getCacheManager(config?: CacheConfig): QueryCacheManager {
  if (!cacheInstance) {
    cacheInstance = new QueryCacheManager(config);
  }
  return cacheInstance;
}

/**
 * Reset singleton instance (mainly for testing)
 */
export function resetCacheManager(): void {
  if (cacheInstance) {
    cacheInstance.clear();
    cacheInstance = null;
  }
}
