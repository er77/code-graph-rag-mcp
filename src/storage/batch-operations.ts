/**
 * TASK-001: Batch Operations for High-Performance Data Processing
 *
 * Optimized batch processing for entities and relationships.
 * Designed for efficient bulk operations on commodity hardware.
 *
 * Architecture References:
 * - Storage Types: src/types/storage.ts
 * - Graph Storage: src/storage/graph-storage.ts
 * - SQLite Manager: src/storage/sqlite-manager.ts
 */

import { createHash } from "node:crypto";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type Database from "better-sqlite3";
import type { BatchResult, Entity, ParsedEntity, Relationship } from "../types/storage.js";
import { RelationType } from "../types/storage.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_BATCH_SIZE = 1000;
const MAX_BATCH_SIZE = 5000;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 100; // ms
const ID_LENGTH = 12;

// =============================================================================
// 3. BATCH OPERATIONS CLASS
// =============================================================================

export class BatchOperations {
  private batchSize: number;
  private db: Database.Database;

  constructor(db: Database.Database, batchSize = DEFAULT_BATCH_SIZE) {
    this.db = db;
    this.batchSize = Math.min(batchSize, MAX_BATCH_SIZE);
  }

  // ---------------------------------------------------------------------------
  // Helpers: stable keys/ids
  // ---------------------------------------------------------------------------

  private entityKey(e: Entity): string {
    const s = e.location?.start?.index ?? -1;
    const eIdx = e.location?.end?.index ?? -1;
    const key = `${e.filePath}|${e.type}|${e.name}|${s}-${eIdx}`;
    return key;
  }

  private stableEntityId(e: Entity): string {
    const key = this.entityKey(e);
    return createHash("sha256").update(key).digest("base64url").slice(0, ID_LENGTH);
  }

  private relationshipKey(r: { fromId: string; toId: string; type: RelationType }): string {
    return `${r.fromId}|${r.toId}|${r.type}`;
  }

  private stableRelationshipId(r: { fromId: string; toId: string; type: RelationType }): string {
    return createHash("sha256").update(this.relationshipKey(r)).digest("base64url").slice(0, ID_LENGTH);
  }

  /**
   * Insert entities in batches with transaction support
   * - Local deduplication by entityKey
   * - Stable IDs based on key
   */
  async insertEntities(
    entities: Entity[],
    onProgress?: (processed: number, total: number) => void,
  ): Promise<BatchResult> {
    const start = Date.now();
    const errors: Array<{ item: unknown; error: string }> = [];
    let totalProcessed = 0;

    // Log database path for debugging
    console.log("[BatchOperations] Database path:", this.db.name || "unknown");

    const insertStmt = this.db.prepare(`
      INSERT INTO entities
      (id, name, type, file_path, location, metadata, hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        file_path = excluded.file_path,
        location = excluded.location,
        metadata = excluded.metadata,
        hash = COALESCE(excluded.hash, entities.hash),
        updated_at = excluded.updated_at
    `);

    const seen = new Set<string>();
    const uniq: Entity[] = [];
    for (const e of entities) {
      const key = this.entityKey(e);
      if (!seen.has(key)) {
        seen.add(key);
        uniq.push(e);
      }
    }

    // Process in batches
    for (let i = 0; i < uniq.length; i += this.batchSize) {
      const batch = uniq.slice(i, Math.min(i + this.batchSize, uniq.length));

      // Retry logic for batch processing
      let attempts = 0;
      let batchSuccess = false;

      while (attempts < RETRY_ATTEMPTS && !batchSuccess) {
        try {
          const transaction = this.db.transaction((batch: Entity[]) => {
            for (const entity of batch) {
              const now = Date.now();
              const id = this.stableEntityId(entity);

              insertStmt.run(
                id,
                entity.name,
                entity.type,
                entity.filePath,
                JSON.stringify(entity.location),
                JSON.stringify(entity.metadata || {}),
                entity.hash,
                entity.createdAt || now,
                entity.updatedAt || now,
              );
            }
          });

          transaction(batch);
          totalProcessed += batch.length;
          batchSuccess = true;

          // Report progress
          if (onProgress) {
            onProgress(totalProcessed, uniq.length);
          }
        } catch (error) {
          attempts++;

          if (attempts >= RETRY_ATTEMPTS) {
            // Log failed batch items
            for (const entity of batch) {
              errors.push({
                item: entity,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          } else {
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * attempts));
          }
        }
      }
    }

    return {
      processed: totalProcessed,
      failed: errors.length,
      errors,
      timeMs: Date.now() - start,
    };
  }

  /**
   * Insert relationships in batches
   * - Local deduplication by relationshipKey
   * - Stable IDs based on key
   */
  async insertRelationships(
    relationships: Relationship[],
    onProgress?: (processed: number, total: number) => void,
  ): Promise<BatchResult> {
    const start = Date.now();
    const errors: Array<{ item: unknown; error: string }> = [];
    let totalProcessed = 0;

    const insertStmt = this.db.prepare(`
      INSERT INTO relationships
      (id, from_id, to_id, type, metadata)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        metadata = COALESCE(excluded.metadata, relationships.metadata)
    `);

    const seen = new Set<string>();
    const uniq: Relationship[] = [];
    for (const r of relationships) {
      const key = this.relationshipKey({ fromId: r.fromId, toId: r.toId, type: r.type });
      if (!seen.has(key)) {
        seen.add(key);
        uniq.push(r);
      }
    }

    // Process in batches
    for (let i = 0; i < uniq.length; i += this.batchSize) {
      const batch = uniq.slice(i, Math.min(i + this.batchSize, uniq.length));

      let attempts = 0;
      let batchSuccess = false;

      while (attempts < RETRY_ATTEMPTS && !batchSuccess) {
        try {
          const transaction = this.db.transaction((batch: Relationship[]) => {
            for (const rel of batch) {
              const id = this.stableRelationshipId({ fromId: rel.fromId, toId: rel.toId, type: rel.type });
              insertStmt.run(id, rel.fromId, rel.toId, rel.type, rel.metadata ? JSON.stringify(rel.metadata) : null);
            }
          });

          transaction(batch);
          totalProcessed += batch.length;
          batchSuccess = true;

          // Report progress
          if (onProgress) {
            onProgress(totalProcessed, uniq.length);
          }
        } catch (error) {
          attempts++;

          if (attempts >= RETRY_ATTEMPTS) {
            for (const rel of batch) {
              errors.push({
                item: rel,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * attempts));
          }
        }
      }
    }

    return {
      processed: totalProcessed,
      failed: errors.length,
      errors,
      timeMs: Date.now() - start,
    };
  }

  /**
   * Delete entities in batches
   */
  async deleteEntities(
    entityIds: string[],
    onProgress?: (processed: number, total: number) => void,
  ): Promise<BatchResult> {
    const start = Date.now();
    const errors: Array<{ item: unknown; error: string }> = [];
    let totalProcessed = 0;

    const deleteStmt = this.db.prepare("DELETE FROM entities WHERE id = ?");

    // Process in batches
    for (let i = 0; i < entityIds.length; i += this.batchSize) {
      const batch = entityIds.slice(i, Math.min(i + this.batchSize, entityIds.length));

      try {
        const transaction = this.db.transaction((batch: string[]) => {
          for (const id of batch) {
            deleteStmt.run(id);
          }
        });

        transaction(batch);
        totalProcessed += batch.length;

        if (onProgress) {
          onProgress(totalProcessed, entityIds.length);
        }
      } catch (error) {
        for (const id of batch) {
          errors.push({
            item: id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return {
      processed: totalProcessed,
      failed: errors.length,
      errors,
      timeMs: Date.now() - start,
    };
  }

  /**
   * Update entities in batches
   */
  async updateEntities(
    updates: Array<{ id: string; changes: Partial<Entity> }>,
    onProgress?: (processed: number, total: number) => void,
  ): Promise<BatchResult> {
    const start = Date.now();
    const errors: Array<{ item: unknown; error: string }> = [];
    let totalProcessed = 0;

    const updateStmt = this.db.prepare(`
      UPDATE entities 
      SET name = COALESCE(?, name),
          type = COALESCE(?, type),
          location = COALESCE(?, location),
          metadata = COALESCE(?, metadata),
          hash = COALESCE(?, hash),
          updated_at = ?
      WHERE id = ?
    `);

    // Process in batches
    for (let i = 0; i < updates.length; i += this.batchSize) {
      const batch = updates.slice(i, Math.min(i + this.batchSize, updates.length));

      try {
        const transaction = this.db.transaction((batch: typeof updates) => {
          for (const update of batch) {
            const now = Date.now();
            updateStmt.run(
              update.changes.name || null,
              update.changes.type || null,
              update.changes.location ? JSON.stringify(update.changes.location) : null,
              update.changes.metadata ? JSON.stringify(update.changes.metadata) : null,
              update.changes.hash || null,
              now,
              update.id,
            );
          }
        });

        transaction(batch);
        totalProcessed += batch.length;

        if (onProgress) {
          onProgress(totalProcessed, updates.length);
        }
      } catch (error) {
        for (const update of batch) {
          errors.push({
            item: update,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return {
      processed: totalProcessed,
      failed: errors.length,
      errors,
      timeMs: Date.now() - start,
    };
  }

  /**
   * Build relationships from parsed entities
   */
  async buildRelationshipsFromEntities(entities: ParsedEntity[], filePath: string): Promise<Relationship[]> {
    const relationships: Relationship[] = [];
    const entityMap = new Map<string, string>(); // name -> id mapping

    // First pass: create entity ID mapping
    for (const entity of entities) {
      const id = `${filePath}:${entity.name}:${entity.location.start.line}`;
      entityMap.set(entity.name, id);
    }

    // Second pass: create relationships
    for (const entity of entities) {
      const fromId = entityMap.get(entity.name)!;

      // Import relationships
      if (entity.type === "import" && entity.importData) {
        for (const specifier of entity.importData.specifiers) {
          const toId = `import:${entity.importData.source}:${specifier.imported || specifier.local}`;
          relationships.push({
            id: this.stableRelationshipId({ fromId, toId, type: RelationType.IMPORTS }),
            fromId,
            toId,
            type: RelationType.IMPORTS,
            metadata: {
              line: entity.location.start.line,
              column: entity.location.start.column,
              context: `Import from ${entity.importData.source}`,
            },
          });
        }
      }

      // Reference relationships
      if (entity.references) {
        for (const ref of entity.references) {
          const toId = entityMap.get(ref);
          if (toId) {
            relationships.push({
              id: this.stableRelationshipId({ fromId, toId, type: RelationType.REFERENCES }),
              fromId,
              toId,
              type: RelationType.REFERENCES,
              metadata: {
                line: entity.location.start.line,
                column: entity.location.start.column,
              },
            });
          }
        }
      }

      // Parent-child relationships
      if (entity.children) {
        for (const child of entity.children) {
          const childId = entityMap.get(child.name);
          if (childId) {
            relationships.push({
              id: this.stableRelationshipId({ fromId, toId: childId, type: RelationType.CONTAINS }),
              fromId,
              toId: childId,
              type: RelationType.CONTAINS,
              metadata: {
                line: child.location.start.line,
                column: child.location.start.column,
              },
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Optimize batch size based on performance metrics
   */
  optimizeBatchSize(avgTimeMs: number, targetTimeMs = 100): void {
    if (avgTimeMs > targetTimeMs && this.batchSize > 100) {
      // Reduce batch size if too slow
      this.batchSize = Math.max(100, Math.floor(this.batchSize * 0.8));
    } else if (avgTimeMs < targetTimeMs * 0.5 && this.batchSize < MAX_BATCH_SIZE) {
      // Increase batch size if too fast
      this.batchSize = Math.min(MAX_BATCH_SIZE, Math.floor(this.batchSize * 1.2));
    }

    console.log(`[BatchOperations] Optimized batch size to ${this.batchSize}`);
  }

  /**
   * Get current batch size
   */
  getBatchSize(): number {
    return this.batchSize;
  }

  /**
   * Set batch size
   */
  setBatchSize(size: number): void {
    this.batchSize = Math.min(Math.max(1, size), MAX_BATCH_SIZE);
  }
}
