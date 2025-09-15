/**
 * TASK-001: Schema Migrations for SQLite Database
 * 
 * Manages database schema versioning and migrations.
 * Ensures database structure is up-to-date and consistent.
 * 
 * Architecture References:
 * - Storage Types: src/types/storage.ts
 * - SQLite Manager: src/storage/sqlite-manager.ts
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { SQLiteManager } from './sqlite-manager.js';

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const MIGRATIONS_TABLE = 'migrations';
const CURRENT_VERSION = 1;

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================

export interface Migration {
  version: number;
  description: string;
  up: string;
  down?: string;
  checksum?: string;
}

export interface MigrationRecord {
  version: number;
  applied_at: number;
  checksum: string;
}

// =============================================================================
// 4. MIGRATION DEFINITIONS
// =============================================================================

export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema with entities, relationships, and files',
    up: `
      -- Entities table for storing code elements
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        location TEXT NOT NULL,  -- JSON: {start: {line, column, index}, end: {...}}
        metadata TEXT,            -- JSON: {modifiers, returnType, parameters, etc.}
        hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      -- Indexes for efficient entity queries
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_file ON entities(file_path);
      CREATE INDEX IF NOT EXISTS idx_entities_hash ON entities(hash);
      CREATE INDEX IF NOT EXISTS idx_entities_type_name ON entities(type, name);
      
      -- Relationships table for entity connections
      CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL,
        metadata TEXT,            -- JSON: {line, column, context}
        FOREIGN KEY (from_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (to_id) REFERENCES entities(id) ON DELETE CASCADE
      );
      
      -- Indexes for efficient relationship queries
      CREATE INDEX IF NOT EXISTS idx_rel_from ON relationships(from_id);
      CREATE INDEX IF NOT EXISTS idx_rel_to ON relationships(to_id);
      CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(type);
      CREATE INDEX IF NOT EXISTS idx_rel_from_type ON relationships(from_id, type);
      CREATE INDEX IF NOT EXISTS idx_rel_to_type ON relationships(to_id, type);
      
      -- Files table for tracking indexed files
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        last_indexed INTEGER NOT NULL,
        entity_count INTEGER NOT NULL DEFAULT 0
      );
      
      -- Index for finding outdated files
      CREATE INDEX IF NOT EXISTS idx_files_indexed ON files(last_indexed);
      
      -- Query cache table for performance
      CREATE TABLE IF NOT EXISTS query_cache (
        cache_key TEXT PRIMARY KEY,
        result TEXT NOT NULL,      -- JSON serialized result
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        hit_count INTEGER DEFAULT 0
      );
      
      -- Index for cache expiration
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON query_cache(expires_at);
      
      -- Full-text search virtual table for entity names and metadata
      CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
        id UNINDEXED,
        name,
        type,
        file_path,
        metadata,
        content=entities,
        content_rowid=rowid
      );
      
      -- Triggers to keep FTS index in sync
      CREATE TRIGGER IF NOT EXISTS entities_fts_insert 
      AFTER INSERT ON entities 
      BEGIN
        INSERT INTO entities_fts(rowid, id, name, type, file_path, metadata)
        VALUES (new.rowid, new.id, new.name, new.type, new.file_path, new.metadata);
      END;
      
      CREATE TRIGGER IF NOT EXISTS entities_fts_delete 
      AFTER DELETE ON entities 
      BEGIN
        DELETE FROM entities_fts WHERE rowid = old.rowid;
      END;
      
      CREATE TRIGGER IF NOT EXISTS entities_fts_update 
      AFTER UPDATE ON entities 
      BEGIN
        DELETE FROM entities_fts WHERE rowid = old.rowid;
        INSERT INTO entities_fts(rowid, id, name, type, file_path, metadata)
        VALUES (new.rowid, new.id, new.name, new.type, new.file_path, new.metadata);
      END;
    `,
    down: `
      DROP TRIGGER IF EXISTS entities_fts_update;
      DROP TRIGGER IF EXISTS entities_fts_delete;
      DROP TRIGGER IF EXISTS entities_fts_insert;
      DROP TABLE IF EXISTS entities_fts;
      DROP TABLE IF EXISTS query_cache;
      DROP TABLE IF EXISTS files;
      DROP TABLE IF EXISTS relationships;
      DROP TABLE IF EXISTS entities;
    `
  }
];

// =============================================================================
// 5. SCHEMA MIGRATION MANAGER
// =============================================================================

export class SchemaMigration {
  private db: Database.Database;
  
  constructor(private sqliteManager: SQLiteManager) {
    this.db = sqliteManager.getConnection();
  }
  
  /**
   * Initialize migrations table
   */
  private initMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL,
        checksum TEXT NOT NULL
      )
    `);
  }
  
  /**
   * Get current database version
   */
  getCurrentVersion(): number {
    this.initMigrationsTable();
    
    const result = this.db.prepare(`
      SELECT MAX(version) as version 
      FROM ${MIGRATIONS_TABLE}
    `).get() as { version: number | null };
    
    return result.version || 0;
  }
  
  /**
   * Check if migration has been applied
   */
  isMigrationApplied(version: number): boolean {
    const result = this.db.prepare(`
      SELECT 1 
      FROM ${MIGRATIONS_TABLE} 
      WHERE version = ?
    `).get(version);
    
    return result !== undefined;
  }
  
  /**
   * Calculate checksum for migration
   */
  private calculateChecksum(migration: Migration): string {
    const content = `${migration.version}:${migration.description}:${migration.up}`;
    return createHash('sha256').update(content).digest('hex');
  }
  
  /**
   * Apply a single migration
   */
  private applyMigration(migration: Migration): void {
    console.log(`[SchemaMigration] Applying migration ${migration.version}: ${migration.description}`);
    
    const checksum = this.calculateChecksum(migration);
    
    // Execute migration in a transaction
    const transaction = this.db.transaction(() => {
      // Run migration SQL
      this.db.exec(migration.up);
      
      // Record migration
      this.db.prepare(`
        INSERT INTO ${MIGRATIONS_TABLE} (version, applied_at, checksum)
        VALUES (?, ?, ?)
      `).run(migration.version, Date.now(), checksum);
    });
    
    transaction();
    
    console.log(`[SchemaMigration] Migration ${migration.version} applied successfully`);
  }
  
  /**
   * Rollback a single migration
   */
  private rollbackMigration(migration: Migration): void {
    if (!migration.down) {
      throw new Error(`Migration ${migration.version} does not support rollback`);
    }
    
    console.log(`[SchemaMigration] Rolling back migration ${migration.version}: ${migration.description}`);
    
    // Execute rollback in a transaction
    const transaction = this.db.transaction(() => {
      // Run rollback SQL
      this.db.exec(migration.down);
      
      // Remove migration record
      this.db.prepare(`
        DELETE FROM ${MIGRATIONS_TABLE} 
        WHERE version = ?
      `).run(migration.version);
    });
    
    transaction();
    
    console.log(`[SchemaMigration] Migration ${migration.version} rolled back successfully`);
  }
  
  /**
   * Run pending migrations
   */
  migrate(): void {
    this.initMigrationsTable();
    
    const currentVersion = this.getCurrentVersion();
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    
    if (pendingMigrations.length === 0) {
      console.log('[SchemaMigration] Database is up to date');
      return;
    }
    
    console.log(`[SchemaMigration] Running ${pendingMigrations.length} pending migrations`);
    
    // Sort by version to ensure correct order
    pendingMigrations.sort((a, b) => a.version - b.version);
    
    for (const migration of pendingMigrations) {
      this.applyMigration(migration);
    }
    
    // Update database version pragma
    this.db.pragma(`user_version = ${CURRENT_VERSION}`);
    
    console.log(`[SchemaMigration] All migrations completed. Database at version ${CURRENT_VERSION}`);
  }
  
  /**
   * Rollback to a specific version
   */
  rollbackTo(targetVersion: number): void {
    const currentVersion = this.getCurrentVersion();
    
    if (targetVersion >= currentVersion) {
      console.log('[SchemaMigration] Target version is not lower than current version');
      return;
    }
    
    const migrationsToRollback = migrations
      .filter(m => m.version > targetVersion && m.version <= currentVersion)
      .sort((a, b) => b.version - a.version); // Reverse order for rollback
    
    for (const migration of migrationsToRollback) {
      if (this.isMigrationApplied(migration.version)) {
        this.rollbackMigration(migration);
      }
    }
    
    // Update database version pragma
    this.db.pragma(`user_version = ${targetVersion}`);
    
    console.log(`[SchemaMigration] Rolled back to version ${targetVersion}`);
  }
  
  /**
   * Reset database (rollback all migrations)
   */
  reset(): void {
    console.log('[SchemaMigration] Resetting database...');
    this.rollbackTo(0);
    
    // Drop migrations table
    this.db.exec(`DROP TABLE IF EXISTS ${MIGRATIONS_TABLE}`);
    
    console.log('[SchemaMigration] Database reset complete');
  }
  
  /**
   * Get migration history
   */
  getHistory(): MigrationRecord[] {
    this.initMigrationsTable();
    
    const records = this.db.prepare(`
      SELECT version, applied_at, checksum 
      FROM ${MIGRATIONS_TABLE}
      ORDER BY version DESC
    `).all() as MigrationRecord[];
    
    return records;
  }
  
  /**
   * Verify migration checksums
   */
  verifyIntegrity(): boolean {
    const history = this.getHistory();
    let valid = true;
    
    for (const record of history) {
      const migration = migrations.find(m => m.version === record.version);
      if (!migration) {
        console.error(`[SchemaMigration] Migration ${record.version} not found in definitions`);
        valid = false;
        continue;
      }
      
      const expectedChecksum = this.calculateChecksum(migration);
      if (record.checksum !== expectedChecksum) {
        console.error(`[SchemaMigration] Checksum mismatch for migration ${record.version}`);
        valid = false;
      }
    }
    
    return valid;
  }
}

// =============================================================================
// 6. UTILITY FUNCTIONS
// =============================================================================

/**
 * Run migrations on a SQLiteManager instance
 */
export function runMigrations(sqliteManager: SQLiteManager): void {
  const migration = new SchemaMigration(sqliteManager);
  migration.migrate();
}

/**
 * Check if database needs migration
 */
export function needsMigration(sqliteManager: SQLiteManager): boolean {
  const migration = new SchemaMigration(sqliteManager);
  const currentVersion = migration.getCurrentVersion();
  return currentVersion < CURRENT_VERSION;
}