/**
 * TASK-004B: Vector Store Manager - Initialization Fixes Applied
 * TASK-002: Vector Store Manager with SQLite-vec
 * ADR-004: MCP CodeGraph Systematic Fixing Plan
 *
 * Manages vector storage and similarity search using sqlite-vec extension
 * Optimized for 384-dimensional vectors from all-MiniLM-L6-v2
 * FIXED: Initialization patterns and SQLite-vec loading issues
 *
 * External Dependencies:
 * - better-sqlite3: https://github.com/WiseLibs/better-sqlite3 - SQLite database interface
 * - sqlite-vec: https://github.com/asg017/sqlite-vec - Vector similarity extension
 *
 * Architecture References:
 * - Project Overview: doc/PROJECT_OVERVIEW.md
 * - Coding Standards: doc/CODING_STANDARD.md
 * - Architectural Decisions: doc/ARCHITECTURAL_DECISIONS.md
 * - Performance Guide: PERFORMANCE_GUIDE.md
 *
 * @task_id TASK-004B
 * @adr_ref ADR-004
 * @coding_standard Adheres to: doc/CODING_STANDARD.md
 * @history
 *  - 2025-09-14: Created by Dev-Agent - TASK-002: Vector store implementation with sqlite-vec
 *  - 2025-09-17: Fixed by Dev-Agent - TASK-004B: Optimized initialization and error handling
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import Database from "better-sqlite3";
import type { SimilarityResult, VectorEmbedding, VectorStoreConfig } from "../types/semantic.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_CONFIG: Partial<VectorStoreConfig> = {
  dimensions: 384,
  cacheSize: 64000, // 256MB cache
  walMode: true,
};

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================
interface VectorRow {
  id: string;
  content: string;
  vector: Buffer;
  metadata: string | null;
  created_at: number;
  distance?: number;
}

// =============================================================================
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================
function float32ArrayToBuffer(array: Float32Array): Buffer {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

function bufferToFloat32Array(buffer: Buffer): Float32Array {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

function dedupeById(items: VectorEmbedding[]): VectorEmbedding[] {
  const map = new Map<string, VectorEmbedding>();
  for (const e of items) map.set(e.id, e);
  return Array.from(map.values());
}
// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================
export class VectorStore {
  private db: Database.Database | null = null;
  private readonly config: VectorStoreConfig;
  private insertStmt: Database.Statement | null = null;
  private updateStmt: Database.Statement | null = null;
  private deleteStmt: Database.Statement | null = null;
  private insertVecStmt: Database.Statement | null = null;
  private deleteVecByIdStmt: Database.Statement | null = null;

  // TASK-004B: Initialization state management
  private isInitialized = false;
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;
  private extensionLoadAttempts = 0;
  private readonly MAX_EXTENSION_LOAD_ATTEMPTS = 3;
  private debugMode = process.env.VECTOR_STORE_DEBUG === "true";
  private sqliteVecEnabled = false;

  constructor(config: Partial<VectorStoreConfig> = {}) {
    this.config = {
      dbPath: config.dbPath || "./vectors.db",
      dimensions: config.dimensions || DEFAULT_CONFIG.dimensions!,
      cacheSize: config.cacheSize || DEFAULT_CONFIG.cacheSize,
      walMode: config.walMode ?? DEFAULT_CONFIG.walMode,
    };
  }

  /**
   * Initialize the vector store database
   * TASK-004B: Added singleton pattern and initialization guards
   */
  async initialize(): Promise<void> {
    // TASK-004B: Return early if already initialized
    if (this.isInitialized) {
      if (this.debugMode) {
        console.log(`[VectorStore] TASK-004B: Already initialized, returning early`);
      }
      return;
    }

    // TASK-004B: Return existing promise if already initializing
    if (this.isInitializing && this.initializationPromise) {
      if (this.debugMode) {
        console.log(`[VectorStore] TASK-004B: Initialization in progress, waiting...`);
      }
      return this.initializationPromise;
    }

    // TASK-004B: Set initialization state and create promise
    this.isInitializing = true;
    this.initializationPromise = this.initializeInternal();

    try {
      await this.initializationPromise;
      this.isInitialized = true;
      if (this.debugMode) {
        console.log(`[VectorStore] TASK-004B: Initialization completed successfully`);
      }
    } catch (error) {
      // Reset state on failure
      this.isInitializing = false;
      this.initializationPromise = null;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Internal initialization method
   * TASK-004B: Separated for better error handling
   */
  private async initializeInternal(): Promise<void> {
    try {
      // Create database connection
      this.db = new Database(this.config.dbPath);

      // TASK-004B: Load sqlite-vec extension with improved error handling
      await this.loadSqliteVecExtension();

      // Configure for optimal performance on commodity hardware
      if (this.config.walMode) {
        this.db.pragma("journal_mode = WAL");
      }
      this.db.pragma(`cache_size = ${this.config.cacheSize}`);
      this.db.pragma("temp_store = MEMORY");
      this.db.pragma("synchronous = NORMAL");

      // Create vector table with sqlite-vec optimization
      const hasVecExtension = this.checkVecExtension();
      this.sqliteVecEnabled = hasVecExtension;
      console.log(`[VectorStore] hasVecExtension: ${hasVecExtension}`);
      if (hasVecExtension) {
        // Create optimized table using sqlite-vec virtual table
        this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS vec_doc_embeddings USING vec0(
            id TEXT PRIMARY KEY,
            embedding float[${this.config.dimensions}]
          );

          CREATE TABLE IF NOT EXISTS doc_embeddings (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            metadata TEXT,
            created_at INTEGER NOT NULL
          );
        `);
      } else {
        // Fallback table structure
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS doc_embeddings (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            vector BLOB NOT NULL,
            metadata TEXT,
            created_at INTEGER NOT NULL
          );
        `);
      }

      // Create indexes
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_doc_embeddings_created
        ON doc_embeddings(created_at);

        CREATE INDEX IF NOT EXISTS idx_doc_embeddings_content
        ON doc_embeddings(content);
      `);

      // Prepare statements for better performance
      this.prepareStatements();

      console.log(`[VectorStore] Initialized with ${this.config.dimensions} dimensions`);
    } catch (error) {
      console.error("[VectorStore] Initialization failed:", error);
      throw new Error(`Failed to initialize vector store: ${error}`);
    }
  }

  /**
   * Prepare SQL statements for reuse
   */
  private prepareStatements(): void {
    if (!this.db) throw new Error("Database not initialized");
    const hasVecExtension = this.checkVecExtension();

    if (hasVecExtension) {
      this.insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO doc_embeddings (id, content, metadata, created_at)
        VALUES (?, ?, ?, ?)
      `);

      this.updateStmt = this.db.prepare(`
        UPDATE doc_embeddings
        SET metadata = ?, created_at = ?
        WHERE id = ?
      `);

      this.insertVecStmt = this.db.prepare(`
        INSERT INTO vec_doc_embeddings (id, embedding)
        VALUES (?, vec_f32(?))
      `);
      this.deleteVecByIdStmt = this.db.prepare(`
        DELETE FROM vec_doc_embeddings WHERE id = ?
      `);
    } else {
      this.insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO doc_embeddings (id, content, vector, metadata, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      this.updateStmt = this.db.prepare(`
        UPDATE doc_embeddings
        SET vector = ?, metadata = ?, created_at = ?
        WHERE id = ?
      `);
      this.insertVecStmt = null;
      this.deleteVecByIdStmt = null;
    }

    this.deleteStmt = this.db.prepare(`DELETE FROM doc_embeddings WHERE id = ?`);
  }

  /**
   * TASK-004B: Load sqlite-vec extension with improved error handling
   */
  private async loadSqliteVecExtension(): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    // Skip if already attempted max times
    if (this.extensionLoadAttempts >= this.MAX_EXTENSION_LOAD_ATTEMPTS) {
      if (this.debugMode) {
        console.log(
          `[VectorStore] TASK-004B: Max extension load attempts reached (${this.extensionLoadAttempts}), skipping`,
        );
      }
      return;
    }

    this.extensionLoadAttempts++;

    try {
      if (this.debugMode) {
        console.log(`[VectorStore] TASK-004B: Loading sqlite-vec extension (attempt ${this.extensionLoadAttempts})...`);
      }

      // Determine platform-specific extension file
      const platform = process.platform;
      let extensionFile = "vec0";
      if (platform === "win32") {
        extensionFile = "vec0.dll";
      } else if (platform === "darwin") {
        extensionFile = "vec0.dylib";
      } else {
        extensionFile = "vec0.so";
      }

      // Platform-specific package names for optionalDependencies
      const platformPackages = {
        "linux-x64": "sqlite-vec-linux-x64",
        "linux-arm64": "sqlite-vec-linux-arm64",
        "darwin-x64": "sqlite-vec-darwin-x64",
        "darwin-arm64": "sqlite-vec-darwin-arm64",
        "win32-x64": "sqlite-vec-windows-x64",
      };

      const arch = process.arch === "x64" ? "x64" : process.arch;
      const platformKey = `${platform}-${arch}` as keyof typeof platformPackages;
      const platformPackage = platformPackages[platformKey];

      const possiblePaths = [
        "sqlite-vec",
        platformPackage ? `./node_modules/${platformPackage}/${extensionFile}` : null,
        `./node_modules/sqlite-vec/dist/${extensionFile}`,
        `/usr/local/lib/${extensionFile}`,
        `./${extensionFile}`,
        "vec0",
      ].filter(Boolean) as string[];

      for (const path of possiblePaths) {
        try {
          this.db.loadExtension(path);
          console.log(`[VectorStore] TASK-004B: Loaded sqlite-vec extension from: ${path}`);
          return;
        } catch (error) {
          if (this.debugMode) {
            console.log(`[VectorStore] TASK-004B: Failed to load extension from ${path}:`, error);
          }
          // Continue to next path
        }
      }

      console.warn("[VectorStore] TASK-004B: sqlite-vec extension not loaded, using fallback implementation");
      console.warn("[VectorStore] For better performance, install sqlite-vec extension");
    } catch (error) {
      console.error(`[VectorStore] TASK-004B: Extension loading error (attempt ${this.extensionLoadAttempts}):`, error);
      if (this.extensionLoadAttempts >= this.MAX_EXTENSION_LOAD_ATTEMPTS) {
        console.warn("[VectorStore] TASK-004B: Max extension load attempts reached, proceeding with fallback");
      }
    }
  }

  /**
   * Insert a single embedding
   */
  async insert(embedding: VectorEmbedding): Promise<void> {
    if (!this.db || !this.insertStmt) throw new Error("Vector store not initialized");

    try {
      const hasVec = this.sqliteVecEnabled;
      const metadataStr = embedding.metadata ? JSON.stringify(embedding.metadata) : null;
      const timestamp = embedding.createdAt || Date.now();

      if (hasVec && this.insertVecStmt && this.deleteVecByIdStmt) {
        const tx = this.db.transaction((e: VectorEmbedding) => {
          this.deleteVecByIdStmt?.run(e.id);
          const vectorJson = JSON.stringify(Array.from(e.vector));
          this.insertVecStmt?.run(e.id, vectorJson);
          this.insertStmt?.run(e.id, e.content, metadataStr, timestamp);
        });
        tx(embedding);
      } else {
        const vectorBuffer = float32ArrayToBuffer(embedding.vector);
        this.insertStmt.run(embedding.id, embedding.content, vectorBuffer, metadataStr, timestamp);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[VectorStore] Insert failed:", message);
      throw error;
    }
  }

  /**
   * Batch insert multiple embeddings
   */
  async insertBatch(embeddings: VectorEmbedding[]): Promise<void> {
    if (!this.db || !this.insertStmt) throw new Error("Vector store not initialized");

    const hasVec = this.sqliteVecEnabled;
    const unique = dedupeById(embeddings);

    const insertMany = this.db.transaction((items: VectorEmbedding[]) => {
      for (const e of items) {
        const metadataStr = e.metadata ? JSON.stringify(e.metadata) : null;
        const timestamp = e.createdAt || Date.now();

        if (hasVec && this.insertVecStmt && this.deleteVecByIdStmt) {
          this.deleteVecByIdStmt.run(e.id);
          const vectorJson = JSON.stringify(Array.from(e.vector));
          this.insertVecStmt.run(e.id, vectorJson);
          this.insertStmt?.run(e.id, e.content, metadataStr, timestamp);
        } else {
          const vectorBuffer = float32ArrayToBuffer(e.vector);
          this.insertStmt?.run(e.id, e.content, vectorBuffer, metadataStr, timestamp);
        }
      }
    });

    try {
      insertMany(unique);
      console.log(`[VectorStore] Inserted batch of ${unique.length} embeddings`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[VectorStore] Batch insert failed:", message);
      throw error;
    }
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async search(queryVector: Float32Array, limit = 10): Promise<SimilarityResult[]> {
    if (!this.db) throw new Error("Vector store not initialized");

    try {
      const hasVecExtension = this.checkVecExtension();

      if (hasVecExtension) {
        const stmt = this.db.prepare(`
        SELECT e.id, e.content, e.metadata, distance
        FROM vec_doc_embeddings v
        JOIN doc_embeddings e ON v.id = e.id
        WHERE v.embedding MATCH vec_f32(?) AND k = ?
        ORDER BY distance
      `);

        const vectorJson = JSON.stringify(Array.from(queryVector));
        const rows = stmt.all(vectorJson, limit) as Array<{
          id: string;
          content: string;
          metadata: string | null;
          distance: number;
        }>;

        return rows.map((row) => {
          const sim = 1 / (1 + row.distance);
          return {
            id: row.id,
            content: row.content,
            similarity: sim,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          };
        });
      } else {
        return this.fallbackSearch(queryVector, limit);
      }
    } catch (error) {
      console.error("[VectorStore] Search failed:", error);

      if (this.sqliteVecEnabled) return [];
      return this.fallbackSearch(queryVector, limit);
    }
  }

  /**
   * Fallback search implementation without sqlite-vec
   */
  private async fallbackSearch(queryVector: Float32Array, limit: number): Promise<SimilarityResult[]> {
    if (!this.db) throw new Error("Database not initialized");

    let rows: VectorRow[] = [];
    if (this.sqliteVecEnabled) {
      const stmt = this.db.prepare(`
      SELECT e.id, e.content, e.metadata, v.embedding as vector
      FROM doc_embeddings e JOIN vec_doc_embeddings v ON v.id = e.id
    `);
      rows = stmt.all() as any;
    } else {
      const stmt = this.db.prepare(`SELECT id, content, vector, metadata FROM doc_embeddings`);
      rows = stmt.all() as any;
    }

    const results: Array<SimilarityResult & { score: number }> = [];
    for (const row of rows) {
      const vec = bufferToFloat32Array(row.vector as unknown as Buffer);
      const cos = this.cosineSimilarity(queryVector, vec); // [-1..1]
      const similarity = (cos + 1) / 2; // -> [0..1]
      results.push({
        id: row.id,
        content: row.content,
        similarity,
        score: similarity,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Advanced similarity search with filters and threshold
   */
  async searchWithFilters(
    queryVector: Float32Array,
    options: {
      limit?: number;
      threshold?: number;
      metadataFilter?: Record<string, unknown>;
      dateRange?: { start?: number; end?: number };
    } = {},
  ): Promise<SimilarityResult[]> {
    if (!this.db) throw new Error("Vector store not initialized");

    const { limit = 10, threshold = 0.0, metadataFilter, dateRange } = options;

    try {
      const hasVecExtension = this.checkVecExtension();

      if (hasVecExtension) {
        const conditions: string[] = [];
        const condVals: any[] = [];

        if (dateRange?.start != null) {
          conditions.push("e.created_at >= ?");
          condVals.push(dateRange.start);
        }
        if (dateRange?.end != null) {
          conditions.push("e.created_at <= ?");
          condVals.push(dateRange.end);
        }
        if (metadataFilter) {
          for (const [key, value] of Object.entries(metadataFilter)) {
            conditions.push(`json_extract(e.metadata, '$.${key}') = ?`);
            condVals.push(value);
          }
        }

        const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
        const stmt = this.db.prepare(`
        SELECT e.id, e.content, e.metadata, distance
        FROM vec_doc_embeddings v
        JOIN doc_embeddings e ON v.id = e.id
        WHERE v.embedding MATCH vec_f32(?) AND k = ?
          ${whereClause}
        ORDER BY distance
      `);

        const vectorJson = JSON.stringify(Array.from(queryVector));
        const rows = stmt.all(vectorJson, limit, ...condVals) as Array<{
          id: string;
          content: string;
          metadata: string | null;
          distance: number;
        }>;

        return rows
          .map((row) => ({
            id: row.id,
            content: row.content,
            similarity: Math.max(0, 1 - row.distance),
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          }))
          .filter((r) => r.similarity >= threshold);
      } else {
        return this.fallbackSearchWithFilters(queryVector, options);
      }
    } catch (error) {
      console.error("[VectorStore] Advanced search failed:", error);
      if (this.sqliteVecEnabled) return [];
      return this.fallbackSearchWithFilters(queryVector, options);
    }
  }

  /**
   * Fallback filtered search implementation
   */
  private async fallbackSearchWithFilters(
    queryVector: Float32Array,
    options: {
      limit?: number;
      threshold?: number;
      metadataFilter?: Record<string, unknown>;
      dateRange?: { start?: number; end?: number };
    },
  ): Promise<SimilarityResult[]> {
    if (!this.db) throw new Error("Database not initialized");

    const { limit = 10, threshold = 0.0, metadataFilter, dateRange } = options;

    const conditions: string[] = [];
    const params: any[] = [];
    if (dateRange?.start != null) {
      conditions.push("e.created_at >= ?");
      params.push(dateRange.start);
    }
    if (dateRange?.end != null) {
      conditions.push("e.created_at <= ?");
      params.push(dateRange.end);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    let rows: VectorRow[] = [];
    if (this.sqliteVecEnabled) {
      const stmt = this.db.prepare(`
      SELECT e.id, e.content, e.metadata, e.created_at, v.embedding as vector
      FROM doc_embeddings e JOIN vec_doc_embeddings v ON v.id = e.id
      ${whereClause.replaceAll("e.", "e.")}
    `);
      rows = stmt.all(...params) as any;
    } else {
      const stmt = this.db.prepare(`
      SELECT id, content, vector, metadata, created_at
      FROM doc_embeddings
      ${whereClause}
    `);
      rows = stmt.all(...params) as any;
    }

    const results: Array<SimilarityResult & { score: number }> = [];
    for (const row of rows) {
      if (metadataFilter && row.metadata) {
        const md = JSON.parse(row.metadata);
        let ok = true;
        for (const [k, v] of Object.entries(metadataFilter)) {
          if (md[k] !== v) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }

      const vec = bufferToFloat32Array(row.vector as unknown as Buffer);
      const similarity = this.cosineSimilarity(queryVector, vec);
      if (similarity >= threshold) {
        results.push({
          id: row.id,
          content: row.content,
          similarity,
          score: similarity,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    const len = a.length;
    if (len !== b.length) {
      throw new Error("Vectors must have the same dimension");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      const ai = a[i]!;
      const bi = b[i]!;
      dotProduct += ai * bi;
      normA += ai * ai;
      normB += bi * bi;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
  }

  /**
   * Check if sqlite-vec extension is available
   */
  private checkVecExtension(): boolean {
    if (!this.db) return false;

    try {
      const result = this.db
        .prepare(`
        SELECT EXISTS (
          SELECT 1 FROM pragma_function_list 
          WHERE name = 'vec_distance_cosine'
        ) as has_vec
      `)
        .get() as { has_vec: number };

      const enabled = result.has_vec === 1;
      if (enabled) {
        this.sqliteVecEnabled = true;
      }
      return enabled;
    } catch {
      return this.sqliteVecEnabled;
    }
  }

  /**
   * Get embedding by ID
   */
  async get(id: string): Promise<VectorEmbedding | null> {
    if (!this.db) throw new Error("Vector store not initialized");

    const row = this.sqliteVecEnabled
      ? (this.db
          .prepare(`
        SELECT e.id, e.content, e.metadata, e.created_at, v.embedding as vector
        FROM doc_embeddings e JOIN vec_doc_embeddings v ON v.id = e.id
        WHERE e.id = ?
      `)
          .get(id) as any)
      : (this.db.prepare(`SELECT * FROM doc_embeddings WHERE id = ?`).get(id) as any);

    if (!row) return null;

    const buf = row.vector as Buffer;
    return {
      id: row.id,
      content: row.content,
      vector: bufferToFloat32Array(buf),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    };
  }

  /**
   * Update an existing embedding
   */
  async update(id: string, vector: Float32Array, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.db || !this.updateStmt) throw new Error("Vector store not initialized");
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    if (this.sqliteVecEnabled && this.insertVecStmt && this.deleteVecByIdStmt) {
      const tx = this.db.transaction(() => {
        this.deleteVecByIdStmt?.run(id);
        this.insertVecStmt?.run(id, JSON.stringify(Array.from(vector)));
        this.updateStmt?.run(metadataStr, Date.now(), id);
      });
      tx();
    } else {
      const vectorBuffer = float32ArrayToBuffer(vector);
      this.updateStmt.run(vectorBuffer, metadataStr, Date.now(), id);
    }
  }

  /**
   * Delete an embedding
   */
  async delete(id: string): Promise<void> {
    if (!this.db || !this.deleteStmt) throw new Error("Vector store not initialized");

    const tx = this.db.transaction((theId: string) => {
      if (this.sqliteVecEnabled && this.deleteVecByIdStmt) {
        this.deleteVecByIdStmt.run(theId);
      }
      this.deleteStmt?.run(theId);
    });

    tx(id);
  }

  /**
   * Get total number of doc_embeddings
   */
  async count(): Promise<number> {
    if (!this.db) {
      throw new Error("Vector store not initialized");
    }

    const result = this.db.prepare("SELECT COUNT(*) as count FROM doc_embeddings").get() as { count: number };
    return result.count;
  }

  /**
   * Clear all doc_embeddings
   */
  async clear(): Promise<void> {
    if (!this.db) throw new Error("Vector store not initialized");

    const tx = this.db.transaction(() => {
      if (this.sqliteVecEnabled) {
        this.db?.exec("DELETE FROM vec_doc_embeddings");
      }
      this.db?.exec("DELETE FROM doc_embeddings");
    });

    tx();
    console.log("[VectorStore] Cleared all embeddings");
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log("[VectorStore] Database connection closed");
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalEmbeddings: number;
    dbSizeMB: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    if (!this.db) {
      throw new Error("Vector store not initialized");
    }

    const count = await this.count();

    const stats = this.db
      .prepare(`
      SELECT 
        MIN(created_at) as oldest,
        MAX(created_at) as newest,
        page_count * page_size / 1024.0 / 1024.0 as size_mb
      FROM doc_embeddings,
      (SELECT page_count * page_size as total FROM pragma_page_count(), pragma_page_size())
    `)
      .get() as { oldest: number | null; newest: number | null; size_mb: number };

    return {
      totalEmbeddings: count,
      dbSizeMB: stats.size_mb || 0,
      oldestEntry: stats.oldest,
      newestEntry: stats.newest,
    };
  }

  /**
   * Batch search for multiple query vectors
   */
  async batchSearch(queryVectors: Float32Array[], limit = 10): Promise<SimilarityResult[][]> {
    if (!this.db) {
      throw new Error("Vector store not initialized");
    }

    const results: SimilarityResult[][] = [];

    for (const queryVector of queryVectors) {
      const searchResults = await this.search(queryVector, limit);
      results.push(searchResults);
    }

    return results;
  }

  /**
   * Find vectors within a specific distance threshold (radius search)
   */
  async searchWithinRadius(queryVector: Float32Array, radius: number, limit = 100): Promise<SimilarityResult[]> {
    const threshold = Math.max(0, 1 - radius); // Convert radius to similarity threshold
    return this.searchWithFilters(queryVector, { limit, threshold });
  }

  /**
   * Get performance statistics for sqlite-vec extension
   */
  getVectorStats(): {
    hasExtension: boolean;
    extensionVersion?: string;
    optimizedOperations: boolean;
  } {
    if (!this.db) {
      return {
        hasExtension: false,
        optimizedOperations: false,
      };
    }

    const hasExtension = this.checkVecExtension();

    if (hasExtension) {
      try {
        // Try to get extension version if possible
        const versionResult = this.db
          .prepare(`
          SELECT vec_version() as version
        `)
          .get() as { version: string } | undefined;

        return {
          hasExtension: true,
          extensionVersion: versionResult?.version,
          optimizedOperations: true,
        };
      } catch {
        return {
          hasExtension: true,
          optimizedOperations: true,
        };
      }
    }

    return {
      hasExtension: false,
      optimizedOperations: false,
    };
  }
}
