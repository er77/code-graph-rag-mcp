#!/usr/bin/env node

/**
 * Vector Database Migration Script
 *
 * Fixes foreign key mismatch issues between embeddings and vec_embeddings tables
 * Ensures consistency with the main codebase optimizations
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";

interface MigrationResult {
  success: boolean;
  message: string;
  backupCreated?: string;
  tablesFixed?: string[];
}

class VectorDatabaseMigrator {
  private dbPath: string;
  private db: Database.Database | null = null;

  constructor(dbPath = "./vectors.db") {
    this.dbPath = resolve(dbPath);
  }

  async migrate(): Promise<MigrationResult> {
    try {
      console.log(`🔧 Starting migration for: ${this.dbPath}`);

      if (!existsSync(this.dbPath)) {
        return {
          success: true,
          message: "No existing database found - will be created with correct schema",
        };
      }

      // Create backup
      const backupPath = await this.createBackup();
      console.log(`📦 Backup created: ${backupPath}`);

      // Open database
      this.db = new Database(this.dbPath);

      // Check current schema
      const hasIssue = await this.checkForeignKeyIssue();

      if (!hasIssue) {
        console.log("✅ Database schema is already correct");
        return {
          success: true,
          message: "Database schema is already up to date",
          backupCreated: backupPath,
        };
      }

      // Perform migration
      const fixedTables = await this.fixForeignKeyConstraints();

      console.log("✅ Migration completed successfully");

      return {
        success: true,
        message: "Database migration completed successfully",
        backupCreated: backupPath,
        tablesFixed: fixedTables,
      };
    } catch (error) {
      console.error("❌ Migration failed:", error);
      return {
        success: false,
        message: `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      if (this.db) {
        this.db.close();
      }
    }
  }

  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${this.dbPath}.backup-${timestamp}`;

    // Create backup using SQLite backup API
    const sourceDb = new Database(this.dbPath);
    const backupDb = new Database(backupPath);

    sourceDb.backup(backupDb);

    sourceDb.close();
    backupDb.close();

    return backupPath;
  }

  private async checkForeignKeyIssue(): Promise<boolean> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      // Check if we have the problematic foreign key constraint
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
        name: string;
      }>;

      const hasEmbeddings = tables.some((t) => t.name === "embeddings");
      const hasVecEmbeddings = tables.some((t) => t.name === "vec_embeddings");

      if (!hasEmbeddings) return false;

      // Check if embeddings table has foreign key to vec_embeddings
      const tableInfo = this.db.prepare("PRAGMA foreign_key_list(embeddings)").all() as Array<any>;
      const hasForeignKey = tableInfo.some((fk) => fk.table === "vec_embeddings");

      console.log(`📊 Tables found: embeddings=${hasEmbeddings}, vec_embeddings=${hasVecEmbeddings}`);
      console.log(`🔗 Foreign key constraint exists: ${hasForeignKey}`);

      return hasForeignKey;
    } catch (error) {
      console.log("⚠️ Error checking schema, assuming migration needed");
      return true;
    }
  }

  private async fixForeignKeyConstraints(): Promise<string[]> {
    if (!this.db) throw new Error("Database not initialized");

    const fixedTables: string[] = [];

    // Disable foreign key checks temporarily
    this.db.pragma("foreign_keys = OFF");

    try {
      // Check if embeddings table exists
      const embeddingsExists = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='embeddings'")
        .get();

      if (embeddingsExists) {
        console.log("🔄 Recreating embeddings table without foreign key constraint...");

        // Get current data
        const currentData = this.db.prepare("SELECT * FROM embeddings").all();

        // Drop existing table
        this.db.exec("DROP TABLE IF EXISTS embeddings_old");
        this.db.exec("ALTER TABLE embeddings RENAME TO embeddings_old");

        // Create new table without foreign key constraint (matching our fix)
        this.db.exec(`
          CREATE TABLE embeddings (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            metadata TEXT,
            created_at INTEGER NOT NULL
          );
        `);

        // Create indexes
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_embeddings_created
          ON embeddings(created_at);

          CREATE INDEX IF NOT EXISTS idx_embeddings_content
          ON embeddings(content);
        `);

        // Migrate data
        if (currentData.length > 0) {
          const insertStmt = this.db.prepare(`
            INSERT INTO embeddings (id, content, metadata, created_at)
            VALUES (?, ?, ?, ?)
          `);

          for (const row of currentData as any[]) {
            insertStmt.run(row.id, row.content, row.metadata, row.created_at);
          }
        }

        // Drop old table
        this.db.exec("DROP TABLE embeddings_old");

        fixedTables.push("embeddings");
        console.log("✅ Embeddings table recreated without foreign key constraint");
      }

      // Ensure vec_embeddings virtual table exists if sqlite-vec is available
      try {
        this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
            id TEXT PRIMARY KEY,
            embedding float[384]
          );
        `);
        console.log("✅ vec_embeddings virtual table ensured");
      } catch (error) {
        console.log("⚠️ sqlite-vec extension not available, using fallback structure");
      }
    } finally {
      // Re-enable foreign key checks
      this.db.pragma("foreign_keys = ON");
    }

    return fixedTables;
  }
}

// CLI interface
async function main() {
  const dbPath = process.argv[2] || "./vectors.db";

  console.log("🚀 Vector Database Migration Tool");
  console.log("==================================");

  const migrator = new VectorDatabaseMigrator(dbPath);
  const result = await migrator.migrate();

  if (result.success) {
    console.log(`✅ ${result.message}`);
    if (result.backupCreated) {
      console.log(`📦 Backup: ${result.backupCreated}`);
    }
    if (result.tablesFixed?.length) {
      console.log(`🔧 Fixed tables: ${result.tablesFixed.join(", ")}`);
    }
    process.exit(0);
  } else {
    console.error(`❌ ${result.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { VectorDatabaseMigrator };
