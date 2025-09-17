/**
 * TASK-002: Multi-Level Query Cache Manager
 *
 * Implements a three-tier caching system (L1: Hot, L2: Warm, L3: Cold/SQLite)
 * for optimizing query performance with memory-aware eviction.
 *
 * External Dependencies:
 * - lru-cache: https://github.com/isaacs/node-lru-cache - LRU cache implementation
 * - better-sqlite3: https://github.com/WiseLibs/better-sqlite3 - SQLite for L3 cache
 *
 * Architecture References:
 * - Query Types: src/types/query.ts
 * - SQLite Manager: src/storage/sqlite-manager.ts
 *
 * @task_id TASK-002
 * @coding_standard Adheres to: doc/CODING_STANDARD.md
 * @history
 *  - 2025-01-14: Created by Dev-Agent - TASK-002: Initial QueryCache implementation
 */

import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { LRUCache } from "lru-cache";
import { SQLiteManager } from "../storage/sqlite-manager.js";
import type { CacheEntry, CacheStats } from "../types/query.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const L1_MAX_SIZE = 100; // Hot cache - most frequently accessed
const L2_MAX_SIZE = 1000; // Warm cache - recently accessed
const L1_TTL = 60000; // 1 minute
const L2_TTL = 300000; // 5 minutes
const L3_TTL = 3600000; // 1 hour
const CACHE_DB_PATH = "./data/query_cache.db";

// =============================================================================
// 3. QUERY CACHE IMPLEMENTATION
// =============================================================================

export class QueryCache {
  private l1Cache: LRUCache<string, CacheEntry>;
  private l2Cache: LRUCache<string, CacheEntry>;
  private l3Db: Database.Database | null = null;
  private sqliteManager: SQLiteManager;

  private stats = {
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    misses: 0,
    evictions: 0,
  };

  // Prepared statements for L3 cache
  private l3Statements: {
    get?: Database.Statement;
    set?: Database.Statement;
    delete?: Database.Statement;
    cleanup?: Database.Statement;
  } = {};

  constructor() {
    // Initialize L1 cache (hot)
    this.l1Cache = new LRUCache<string, CacheEntry>({
      max: L1_MAX_SIZE,
      ttl: L1_TTL,
      updateAgeOnGet: true,
      dispose: (value, key) => {
        // Move to L2 when evicted from L1
        this.moveToL2(key, value);
        this.stats.evictions++;
      },
    });

    // Initialize L2 cache (warm)
    this.l2Cache = new LRUCache<string, CacheEntry>({
      max: L2_MAX_SIZE,
      ttl: L2_TTL,
      updateAgeOnGet: false,
      dispose: (value, key) => {
        // Move to L3 when evicted from L2
        this.moveToL3(key, value);
        this.stats.evictions++;
      },
    });

    // SQLite manager for L3 cache
    this.sqliteManager = new SQLiteManager({
      path: CACHE_DB_PATH,
      memory: false,
    });
  }

  /**
   * Initialize the cache system
   */
  async initialize(): Promise<void> {
    // Initialize SQLite for L3 cache
    this.sqliteManager.initialize();
    this.l3Db = this.sqliteManager.getConnection();

    // Create cache table
    this.l3Db.exec(`
      CREATE TABLE IF NOT EXISTS query_cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        ttl INTEGER NOT NULL,
        hits INTEGER DEFAULT 0,
        size INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_cache_timestamp ON query_cache(timestamp);
      CREATE INDEX IF NOT EXISTS idx_cache_hits ON query_cache(hits);
    `);

    // Prepare statements
    this.l3Statements.get = this.l3Db.prepare(`
      SELECT value, timestamp, ttl, hits, size 
      FROM query_cache 
      WHERE key = ?
    `);

    this.l3Statements.set = this.l3Db.prepare(`
      INSERT OR REPLACE INTO query_cache (key, value, timestamp, ttl, hits, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    this.l3Statements.delete = this.l3Db.prepare(`
      DELETE FROM query_cache WHERE key = ?
    `);

    this.l3Statements.cleanup = this.l3Db.prepare(`
      DELETE FROM query_cache 
      WHERE timestamp + ttl < ?
    `);

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get a value from the cache
   */
  async get<T>(key: string): Promise<T | null> {
    // Check L1 (hot cache)
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry) {
      this.stats.l1Hits++;
      l1Entry.hits++;
      return l1Entry.value as T;
    }

    // Check L2 (warm cache)
    const l2Entry = this.l2Cache.get(key);
    if (l2Entry) {
      this.stats.l2Hits++;
      l2Entry.hits++;

      // Promote to L1 if frequently accessed
      if (l2Entry.hits > 3) {
        this.l2Cache.delete(key);
        this.l1Cache.set(key, l2Entry);
      }

      return l2Entry.value as T;
    }

    // Check L3 (cold cache - SQLite)
    if (this.l3Db && this.l3Statements.get) {
      const row = this.l3Statements.get.get(key) as any;
      if (row) {
        const now = Date.now();
        if (now - row.timestamp <= row.ttl) {
          this.stats.l3Hits++;

          // Update hits
          this.l3Db.prepare("UPDATE query_cache SET hits = hits + 1 WHERE key = ?").run(key);

          const entry: CacheEntry = {
            key,
            value: JSON.parse(row.value),
            timestamp: row.timestamp,
            ttl: row.ttl,
            hits: row.hits + 1,
            size: row.size,
          };

          // Promote to L2 if accessed
          if (entry.hits > 5) {
            this.l2Cache.set(key, entry);
            this.l3Statements.delete?.run(key);
          }

          return entry.value as T;
        } else {
          // Expired, remove from L3
          this.l3Statements.delete?.run(key);
        }
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set a value in the cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const size = this.estimateSize(value);
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || L1_TTL,
      hits: 0,
      size,
    };

    // Always add to L1 first
    this.l1Cache.set(key, entry as CacheEntry);
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.l1Cache.delete(key);
      this.l2Cache.delete(key);
      if (this.l3Statements.delete) {
        this.l3Statements.delete.run(key);
      }
    }
  }

  /**
   * Find affected queries based on data changes
   */
  async findAffectedQueries(changeData: any): Promise<string[]> {
    const affected: string[] = [];

    // Check L1 and L2 caches
    const checkEntry = (entry: CacheEntry) => {
      const value = entry.value as any;
      if (value && value.data) {
        // Simple check: if the data contains the changed entity ID
        if (changeData.entityId && JSON.stringify(value.data).includes(changeData.entityId)) {
          affected.push(entry.key);
        }
      }
    };

    for (const [key, entry] of this.l1Cache.entries()) {
      checkEntry(entry);
    }

    for (const [key, entry] of this.l2Cache.entries()) {
      checkEntry(entry);
    }

    // Check L3 cache
    if (this.l3Db && changeData.entityId) {
      const rows = this.l3Db
        .prepare(`
        SELECT key FROM query_cache 
        WHERE value LIKE ?
      `)
        .all(`%${changeData.entityId}%`) as Array<{ key: string }>;

      affected.push(...rows.map((r) => r.key));
    }

    return [...new Set(affected)]; // Remove duplicates
  }

  /**
   * Get cache level for a key
   */
  async getCacheLevel(key: string): Promise<"L1" | "L2" | "L3" | undefined> {
    if (this.l1Cache.has(key)) return "L1";
    if (this.l2Cache.has(key)) return "L2";

    if (this.l3Db && this.l3Statements.get) {
      const row = this.l3Statements.get.get(key);
      if (row) return "L3";
    }

    return undefined;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits;
    const total = totalHits + this.stats.misses;

    let l3Entries = 0;
    if (this.l3Db) {
      const row = this.l3Db.prepare("SELECT COUNT(*) as count FROM query_cache").get() as any;
      l3Entries = row.count;
    }

    // Estimate memory usage
    let memoryUsageMB = 0;
    for (const entry of this.l1Cache.values()) {
      memoryUsageMB += entry.size / 1024 / 1024;
    }
    for (const entry of this.l2Cache.values()) {
      memoryUsageMB += entry.size / 1024 / 1024;
    }

    return {
      l1Entries: this.l1Cache.size,
      l2Entries: this.l2Cache.size,
      l3Entries,
      totalHits,
      totalMisses: this.stats.misses,
      hitRate: total > 0 ? totalHits / total : 0,
      memoryUsageMB,
    };
  }

  /**
   * Clear all cache levels
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    this.l2Cache.clear();

    if (this.l3Db) {
      this.l3Db.exec("DELETE FROM query_cache");
    }

    // Reset stats
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Flush cache to persistent storage
   */
  async flush(): Promise<void> {
    // Move L1 to L2
    for (const [key, entry] of this.l1Cache.entries()) {
      this.l2Cache.set(key, entry);
    }

    // Move L2 to L3
    for (const [key, entry] of this.l2Cache.entries()) {
      this.moveToL3(key, entry);
    }

    this.l1Cache.clear();
    this.l2Cache.clear();
  }

  // =============================================================================
  // 4. HELPER METHODS
  // =============================================================================

  private moveToL2(key: string, entry: CacheEntry): void {
    // Only move if not already in L2 and entry is still valid
    if (!this.l2Cache.has(key)) {
      const now = Date.now();
      if (now - entry.timestamp <= entry.ttl) {
        this.l2Cache.set(key, {
          ...entry,
          ttl: L2_TTL, // Reset TTL for L2
        });
      }
    }
  }

  private moveToL3(key: string, entry: CacheEntry): void {
    if (this.l3Db && this.l3Statements.set) {
      const now = Date.now();
      if (now - entry.timestamp <= entry.ttl) {
        this.l3Statements.set.run(
          key,
          JSON.stringify(entry.value),
          entry.timestamp,
          L3_TTL, // Use L3 TTL
          entry.hits,
          entry.size,
        );
      }
    }
  }

  private estimateSize(value: any): number {
    // Simple size estimation
    const str = JSON.stringify(value);
    return str.length * 2; // Assuming 2 bytes per character
  }

  private startCleanupInterval(): void {
    // Cleanup expired L3 entries every 5 minutes
    setInterval(() => {
      if (this.l3Db && this.l3Statements.cleanup) {
        const now = Date.now();
        const result = this.l3Statements.cleanup.run(now);
        if (result.changes > 0) {
          console.log(`[QueryCache] Cleaned up ${result.changes} expired L3 entries`);
        }
      }
    }, 300000); // 5 minutes
  }
}
