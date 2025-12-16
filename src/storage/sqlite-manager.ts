/**
 * TASK-001: SQLite Manager with Optimized Configuration
 *
 * Manages SQLite database connections with optimizations for commodity hardware.
 * Implements recommended PRAGMA settings for performance on 4-core CPU, 8GB RAM systems.
 *
 * External Dependencies:
 * - better-sqlite3: https://github.com/WiseLibs/better-sqlite3 - Fast synchronous SQLite3 bindings
 *
 * Architecture References:
 * - Storage Types: src/types/storage.ts
 * - Agent Types: src/types/agent.ts
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type Database from "better-sqlite3";
import type { StorageMetrics } from "../types/storage.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_DB_PATH = join(homedir(), ".code-graph-rag", "codegraph.db");
const WAL_AUTOCHECKPOINT = 1000; // Pages before auto-checkpoint
const CACHE_SIZE_KB = 64000; // 64MB cache
const MMAP_SIZE = 30000000000; // 30GB mmap
const PAGE_SIZE = 4096; // 4KB pages
const BUSY_TIMEOUT = 5000; // 5 seconds

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================

export interface SQLiteConfig {
  path?: string;
  readonly?: boolean;
  memory?: boolean;
  verbose?: boolean;
  timeout?: number;
}

export interface DatabaseInfo {
  version: string;
  pageSize: number;
  pageCount: number;
  sizeBytes: number;
  journalMode: string;
  cacheSize: number;
  walCheckpoint: number;
}

// =============================================================================
// 4. SQLITE MANAGER IMPLEMENTATION
// =============================================================================

const require = createRequire(import.meta.url);

function wrapWithTiming<F extends (...a: any[]) => any>(fn: F, ctx: any, record: (ms: number) => void): F {
  return ((...a: any[]) => {
    const start = Date.now();
    const res = (fn as any).apply(ctx, a);
    record(Date.now() - start);
    return res;
  }) as F;
}

export class SQLiteManager {
  private db: Database.Database | null = null;
  private config: Required<SQLiteConfig>;
  private queryCount = 0;
  private totalQueryTime = 0;

  private static cachedModule: typeof Database | null = null;
  private static rebuildAttempted = false;

  constructor(config: SQLiteConfig = {}) {
    this.config = {
      path: config.path || process.env.DATABASE_PATH || DEFAULT_DB_PATH,
      readonly: config.readonly || false,
      memory: config.memory || false,
      verbose: config.verbose || false,
      timeout: config.timeout || BUSY_TIMEOUT,
    };
  }

  /**
   * Initialize database connection with optimized settings
   */
  initialize(): void {
    if (this.db) {
      console.warn("[SQLiteManager] Database already initialized");
      return;
    }

    // Log database path for debugging
    console.log(`[SQLiteManager] Configured database path: ${this.config.path}`);

    // Ensure directory exists
    if (!this.config.memory && !this.config.readonly) {
      const dir = dirname(this.config.path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Create database connection
    const dbPath = this.config.memory ? ":memory:" : this.config.path;
    const DatabaseModule = SQLiteManager.loadBetterSqlite3();

    this.db = new DatabaseModule(dbPath, {
      readonly: this.config.readonly,
      verbose: this.config.verbose ? console.log : undefined,
      timeout: this.config.timeout,
    });

    // Apply optimized PRAGMA settings
    this.applyOptimizations();
    this.ensureEmbeddingsTable();

    console.log(`[SQLiteManager] Database initialized at ${dbPath}`);
  }

  private static loadBetterSqlite3(): typeof Database {
    if (SQLiteManager.cachedModule) {
      return SQLiteManager.cachedModule;
    }

    const tryLoad = () => require("better-sqlite3") as typeof Database;

    try {
      SQLiteManager.cachedModule = tryLoad();
      return SQLiteManager.cachedModule;
    } catch (error) {
      if (!SQLiteManager.rebuildAttempted && SQLiteManager.isNativeModuleError(error)) {
        SQLiteManager.rebuildAttempted = true;
        const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
        const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
        console.warn(
          "[SQLiteManager] better-sqlite3 failed to load due to native module mismatch. Attempting automatic rebuild...",
        );
        const rebuild = spawnSync(npmCommand, ["rebuild", "better-sqlite3"], {
          cwd: packageRoot,
          stdio: "inherit",
        });
        if (rebuild.status === 0) {
          try {
            const resolvedPath = require.resolve("better-sqlite3");
            if (require.cache[resolvedPath]) {
              delete require.cache[resolvedPath];
            }
          } catch {
            // ignore cache resolve errors
          }
          try {
            SQLiteManager.cachedModule = tryLoad();
            console.log("[SQLiteManager] Automatic rebuild succeeded. Using rebuilt better-sqlite3 binary.");
            return SQLiteManager.cachedModule;
          } catch (retryError) {
            throw SQLiteManager.createLoadError(retryError, true);
          }
        }

        throw SQLiteManager.createLoadError(error, true);
      }

      throw SQLiteManager.createLoadError(error);
    }
  }

  private static isNativeModuleError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message ?? "";
    return message.includes("NODE_MODULE_VERSION") || (error as any).code === "ERR_DLOPEN_FAILED";
  }

  private static createLoadError(originalError: unknown, attemptedRebuild = false): Error {
    const instructions =
      "Automatic rebuild of better-sqlite3 failed. Please run `npm rebuild better-sqlite3` in the @er77/code-graph-rag-mcp installation directory.";
    const message = attemptedRebuild
      ? `[SQLiteManager] Failed to rebuild better-sqlite3 automatically. ${instructions}`
      : `[SQLiteManager] Failed to load better-sqlite3. ${instructions}`;
    const error = new Error(message);
    (error as any).cause = originalError;
    return error;
  }

  private ensureEmbeddingsTable(): void {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        entity_id TEXT,
        content TEXT NOT NULL,
        metadata TEXT,
        vector_data BLOB,
        model_name TEXT NOT NULL DEFAULT 'default',
        created_at INTEGER NOT NULL
      );
    `);

    const columns = this.db.prepare("PRAGMA table_info(embeddings)").all() as Array<{ name: string }>;
    const ensureColumn = (name: string, definition: string, postUpdate?: string) => {
      if (!columns.some((c) => c.name === name)) {
        this.db?.exec(`ALTER TABLE embeddings ADD COLUMN ${definition}`);
        if (postUpdate) {
          this.db?.exec(postUpdate);
        }
      }
    };

    ensureColumn("entity_id", "entity_id TEXT");
    ensureColumn("metadata", "metadata TEXT", "UPDATE embeddings SET metadata = '{}' WHERE metadata IS NULL");
    ensureColumn("vector_data", "vector_data BLOB");
    ensureColumn(
      "model_name",
      "model_name TEXT DEFAULT 'default'",
      "UPDATE embeddings SET model_name = 'default' WHERE model_name IS NULL",
    );
    ensureColumn("created_at", "created_at INTEGER DEFAULT (strftime('%s','now'))");

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON embeddings(entity_id);
      CREATE INDEX IF NOT EXISTS idx_embeddings_model ON embeddings(model_name);
      CREATE INDEX IF NOT EXISTS idx_embeddings_created ON embeddings(created_at);
      CREATE INDEX IF NOT EXISTS idx_embeddings_content ON embeddings(content);
    `);
  }

  /**
   * Apply optimized PRAGMA settings for commodity hardware
   */
  private applyOptimizations(): void {
    if (!this.db) throw new Error("Database not initialized");

    // Read-only connections cannot run many PRAGMAs that mutate connection or database state.
    if (this.config.readonly) {
      try {
        this.db.pragma("foreign_keys = ON");
      } catch {
        // Best-effort: some SQLite builds may disallow PRAGMA changes in readonly mode.
      }
      return;
    }

    // 64MB cache for better performance
    this.db.pragma(`cache_size = -${CACHE_SIZE_KB}`);

    // Store temp tables in memory
    this.db.pragma("temp_store = MEMORY");

    // Memory-mapped I/O for faster access
    this.db.pragma(`mmap_size = ${MMAP_SIZE}`);

    // WAL mode and related PRAGMAs require a writable connection.
    if (!this.config.readonly && !this.config.memory) {
      // WAL mode for concurrent reads during writes
      this.db.pragma("journal_mode = WAL");

      // NORMAL synchronous for balance between safety and speed
      this.db.pragma("synchronous = NORMAL");

      // 4KB page size (optimal for most systems)
      this.db.pragma(`page_size = ${PAGE_SIZE}`);

      // Auto-checkpoint WAL after 1000 pages
      this.db.pragma(`wal_autocheckpoint = ${WAL_AUTOCHECKPOINT}`);
    }

    // Enable foreign key constraints
    this.db.pragma("foreign_keys = ON");

    // Analyze query optimizer statistics on first run
    if (!this.config.memory && !this.config.readonly) {
      try {
        this.db.exec("ANALYZE");
      } catch (_error) {
        // ANALYZE may fail on empty database, ignore
        console.debug("[SQLiteManager] ANALYZE skipped (likely empty database)");
      }
    }
  }

  /**
   * Get database connection
   */
  getConnection(): Database.Database {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  /**
   * Prepare a statement with timing
   */
  prepare<BindParams extends unknown[] | Record<string, unknown> = unknown[], Result = unknown>(
    sql: string,
  ): Database.Statement<BindParams, Result> {
    const db = this.getConnection();
    const statement = db.prepare<BindParams, Result>(sql);

    statement.run = wrapWithTiming(statement.run, statement, (ms) => this.recordQueryTime(ms)) as typeof statement.run;
    statement.get = wrapWithTiming(statement.get, statement, (ms) => this.recordQueryTime(ms)) as typeof statement.get;
    statement.all = wrapWithTiming(statement.all, statement, (ms) => this.recordQueryTime(ms)) as typeof statement.all;
    return statement;
  }
  /**
   * Execute a transaction
   */
  transaction<T>(fn: () => T): T {
    const db = this.getConnection();
    const start = Date.now();

    const transaction = db.transaction(fn);
    const result = transaction();

    this.recordQueryTime(Date.now() - start);
    return result;
  }

  /**
   * Run VACUUM to optimize database
   */
  vacuum(): void {
    const db = this.getConnection();
    console.log("[SQLiteManager] Running VACUUM...");
    const start = Date.now();

    db.exec("VACUUM");

    const duration = Date.now() - start;
    console.log(`[SQLiteManager] VACUUM completed in ${duration}ms`);
  }

  /**
   * Run ANALYZE to update query optimizer statistics
   */
  analyze(): void {
    const db = this.getConnection();
    console.log("[SQLiteManager] Running ANALYZE...");
    const start = Date.now();

    db.exec("ANALYZE");

    const duration = Date.now() - start;
    console.log(`[SQLiteManager] ANALYZE completed in ${duration}ms`);
  }

  /**
   * Checkpoint WAL file
   */
  checkpoint(): void {
    const db = this.getConnection();
    const result = db.pragma("wal_checkpoint(TRUNCATE)");
    console.log("[SQLiteManager] WAL checkpoint completed", result);
  }

  /**
   * Get database information
   */
  getInfo(): DatabaseInfo {
    const db = this.getConnection();

    return {
      version: db.pragma("user_version", { simple: true }) as string,
      pageSize: db.pragma("page_size", { simple: true }) as number,
      pageCount: db.pragma("page_count", { simple: true }) as number,
      sizeBytes:
        (db.pragma("page_count", { simple: true }) as number) * (db.pragma("page_size", { simple: true }) as number),
      journalMode: db.pragma("journal_mode", { simple: true }) as string,
      cacheSize: Math.abs(db.pragma("cache_size", { simple: true }) as number),
      walCheckpoint: db.pragma("wal_autocheckpoint", { simple: true }) as number,
    };
  }

  /**
   * Get storage metrics
   */
  async getMetrics(): Promise<Partial<StorageMetrics>> {
    const info = this.getInfo();
    const db = this.getConnection();

    // Count entities and relationships
    const entityCount = db.prepare("SELECT COUNT(*) as count FROM entities").get() as { count: number };
    const relationshipCount = db.prepare("SELECT COUNT(*) as count FROM relationships").get() as { count: number };
    const fileCount = db.prepare("SELECT COUNT(*) as count FROM files").get() as { count: number };

    // Calculate index size (approximate)
    const indexInfo = db
      .prepare(`
      SELECT SUM(pgsize) as size 
      FROM dbstat 
      WHERE name LIKE 'idx_%'
    `)
      .get() as { size: number } | undefined;

    return {
      totalEntities: entityCount?.count || 0,
      totalRelationships: relationshipCount?.count || 0,
      totalFiles: fileCount?.count || 0,
      databaseSizeMB: info.sizeBytes / (1024 * 1024),
      indexSizeMB: (indexInfo?.size || 0) / (1024 * 1024),
      averageQueryTimeMs: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log("[SQLiteManager] Database connection closed");
    }
  }

  /**
   * Check if database is open
   */
  isOpen(): boolean {
    return this.db?.open ?? false;
  }

  /**
   * Record query time for metrics
   */
  private recordQueryTime(timeMs: number): void {
    this.queryCount++;
    this.totalQueryTime += timeMs;
  }

  /**
   * Reset query metrics
   */
  resetMetrics(): void {
    this.queryCount = 0;
    this.totalQueryTime = 0;
  }

  /**
   * Enable or disable verbose logging
   */
  setVerbose(verbose: boolean): void {
    if (this.db) {
      this.db.function("log", (msg: string) => console.log(`[SQLite] ${msg}`));
      if (verbose) {
        this.db.pragma("vdbe_trace = ON");
      } else {
        this.db.pragma("vdbe_trace = OFF");
      }
    }
  }
}

// =============================================================================
// 5. SINGLETON INSTANCE
// =============================================================================

let instance: SQLiteManager | null = null;

/**
 * Get singleton SQLiteManager instance
 */
export function getSQLiteManager(config?: SQLiteConfig): SQLiteManager {
  if (!instance) {
    instance = new SQLiteManager(config);
  }
  return instance;
}

/**
 * Reset singleton instance (mainly for testing)
 */
export function resetSQLiteManager(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
