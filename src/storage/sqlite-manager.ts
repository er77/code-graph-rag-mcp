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

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StorageMetrics } from '../types/storage.js';

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_DB_PATH = './data/codegraph.db';
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

export class SQLiteManager {
  private db: Database.Database | null = null;
  private config: Required<SQLiteConfig>;
  private queryCount = 0;
  private totalQueryTime = 0;
  
  constructor(config: SQLiteConfig = {}) {
    this.config = {
      path: config.path || DEFAULT_DB_PATH,
      readonly: config.readonly || false,
      memory: config.memory || false,
      verbose: config.verbose || false,
      timeout: config.timeout || BUSY_TIMEOUT
    };
  }
  
  /**
   * Initialize database connection with optimized settings
   */
  initialize(): void {
    if (this.db) {
      console.warn('[SQLiteManager] Database already initialized');
      return;
    }
    
    // Ensure directory exists
    if (!this.config.memory && !this.config.readonly) {
      const dir = dirname(this.config.path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    
    // Create database connection
    const dbPath = this.config.memory ? ':memory:' : this.config.path;
    this.db = new Database(dbPath, {
      readonly: this.config.readonly,
      verbose: this.config.verbose ? console.log : undefined,
      timeout: this.config.timeout
    });
    
    // Apply optimized PRAGMA settings
    this.applyOptimizations();
    
    console.log(`[SQLiteManager] Database initialized at ${dbPath}`);
  }
  
  /**
   * Apply optimized PRAGMA settings for commodity hardware
   */
  private applyOptimizations(): void {
    if (!this.db) throw new Error('Database not initialized');
    
    // WAL mode for concurrent reads during writes
    this.db.pragma('journal_mode = WAL');
    
    // 64MB cache for better performance
    this.db.pragma(`cache_size = -${CACHE_SIZE_KB}`);
    
    // NORMAL synchronous for balance between safety and speed
    this.db.pragma('synchronous = NORMAL');
    
    // Store temp tables in memory
    this.db.pragma('temp_store = MEMORY');
    
    // Memory-mapped I/O for faster access
    this.db.pragma(`mmap_size = ${MMAP_SIZE}`);
    
    // 4KB page size (optimal for most systems)
    this.db.pragma(`page_size = ${PAGE_SIZE}`);
    
    // Auto-checkpoint WAL after 1000 pages
    this.db.pragma(`wal_autocheckpoint = ${WAL_AUTOCHECKPOINT}`);
    
    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');
    
    // Analyze query optimizer statistics on first run
    if (!this.config.memory && !this.config.readonly) {
      try {
        this.db.exec('ANALYZE');
      } catch (error) {
        // ANALYZE may fail on empty database, ignore
        console.debug('[SQLiteManager] ANALYZE skipped (likely empty database)');
      }
    }
  }
  
  /**
   * Get database connection
   */
  getConnection(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }
  
  /**
   * Prepare a statement with timing
   */
  prepare<T = unknown>(sql: string): Database.Statement<T> {
    const db = this.getConnection();
    const statement = db.prepare<T>(sql);
    
    // Wrap run/get/all methods to track timing
    const originalRun = statement.run.bind(statement);
    const originalGet = statement.get.bind(statement);
    const originalAll = statement.all.bind(statement);
    
    statement.run = (...args: any[]) => {
      const start = Date.now();
      const result = originalRun(...args);
      this.recordQueryTime(Date.now() - start);
      return result;
    };
    
    statement.get = (...args: any[]) => {
      const start = Date.now();
      const result = originalGet(...args);
      this.recordQueryTime(Date.now() - start);
      return result;
    };
    
    statement.all = (...args: any[]) => {
      const start = Date.now();
      const result = originalAll(...args);
      this.recordQueryTime(Date.now() - start);
      return result;
    };
    
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
    console.log('[SQLiteManager] Running VACUUM...');
    const start = Date.now();
    
    db.exec('VACUUM');
    
    const duration = Date.now() - start;
    console.log(`[SQLiteManager] VACUUM completed in ${duration}ms`);
  }
  
  /**
   * Run ANALYZE to update query optimizer statistics
   */
  analyze(): void {
    const db = this.getConnection();
    console.log('[SQLiteManager] Running ANALYZE...');
    const start = Date.now();
    
    db.exec('ANALYZE');
    
    const duration = Date.now() - start;
    console.log(`[SQLiteManager] ANALYZE completed in ${duration}ms`);
  }
  
  /**
   * Checkpoint WAL file
   */
  checkpoint(): void {
    const db = this.getConnection();
    const result = db.pragma('wal_checkpoint(TRUNCATE)');
    console.log('[SQLiteManager] WAL checkpoint completed', result);
  }
  
  /**
   * Get database information
   */
  getInfo(): DatabaseInfo {
    const db = this.getConnection();
    
    return {
      version: db.pragma('user_version', { simple: true }) as string,
      pageSize: db.pragma('page_size', { simple: true }) as number,
      pageCount: db.pragma('page_count', { simple: true }) as number,
      sizeBytes: (db.pragma('page_count', { simple: true }) as number) * 
                 (db.pragma('page_size', { simple: true }) as number),
      journalMode: db.pragma('journal_mode', { simple: true }) as string,
      cacheSize: Math.abs(db.pragma('cache_size', { simple: true }) as number),
      walCheckpoint: db.pragma('wal_autocheckpoint', { simple: true }) as number
    };
  }
  
  /**
   * Get storage metrics
   */
  async getMetrics(): Promise<Partial<StorageMetrics>> {
    const info = this.getInfo();
    const db = this.getConnection();
    
    // Count entities and relationships
    const entityCount = db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };
    const relationshipCount = db.prepare('SELECT COUNT(*) as count FROM relationships').get() as { count: number };
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number };
    
    // Calculate index size (approximate)
    const indexInfo = db.prepare(`
      SELECT SUM(pgsize) as size 
      FROM dbstat 
      WHERE name LIKE 'idx_%'
    `).get() as { size: number } | undefined;
    
    return {
      totalEntities: entityCount?.count || 0,
      totalRelationships: relationshipCount?.count || 0,
      totalFiles: fileCount?.count || 0,
      databaseSizeMB: info.sizeBytes / (1024 * 1024),
      indexSizeMB: (indexInfo?.size || 0) / (1024 * 1024),
      averageQueryTimeMs: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0
    };
  }
  
  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[SQLiteManager] Database connection closed');
    }
  }
  
  /**
   * Check if database is open
   */
  isOpen(): boolean {
    return this.db !== null && this.db.open;
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
      this.db.function('log', (msg: string) => console.log(`[SQLite] ${msg}`));
      if (verbose) {
        this.db.pragma('vdbe_trace = ON');
      } else {
        this.db.pragma('vdbe_trace = OFF');
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