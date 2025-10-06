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
// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================
export class VectorStore {
  private db: Database.Database | null = null;
  private readonly config: VectorStoreConfig;
  private insertStmt: Database.Statement | null = null;
  private updateStmt: Database.Statement | null = null;
  private deleteStmt: Database.Statement | null = null;

  // TASK-004B: Initialization state management
  private isInitialized = false;
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;
  private extensionLoadAttempts = 0;
  private readonly MAX_EXTENSION_LOAD_ATTEMPTS = 3;
  private debugMode = process.env.VECTOR_STORE_DEBUG === 'true';

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

      if (hasVecExtension) {
        // Create optimized table using sqlite-vec virtual table
        this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
            id TEXT PRIMARY KEY,
            embedding float[${this.config.dimensions}]
          );

          CREATE TABLE IF NOT EXISTS embeddings (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            metadata TEXT,
            created_at INTEGER NOT NULL
          );
        `);
      } else {
        // Fallback table structure
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS embeddings (
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
        CREATE INDEX IF NOT EXISTS idx_embeddings_created
        ON embeddings(created_at);

        CREATE INDEX IF NOT EXISTS idx_embeddings_content
        ON embeddings(content);
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
      // Prepared statements for sqlite-vec virtual table
      this.insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO embeddings (id, content, metadata, created_at)
        VALUES (?, ?, ?, ?)
      `);

      this.updateStmt = this.db.prepare(`
        UPDATE embeddings
        SET metadata = ?, created_at = ?
        WHERE id = ?
      `);
    } else {
      // Fallback prepared statements
      this.insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO embeddings (id, content, vector, metadata, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      this.updateStmt = this.db.prepare(`
        UPDATE embeddings
        SET vector = ?, metadata = ?, created_at = ?
        WHERE id = ?
      `);
    }

    this.deleteStmt = this.db.prepare(`
      DELETE FROM embeddings WHERE id = ?
    `);

    // Note: Search statement will be created dynamically based on extension availability
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
        console.log(`[VectorStore] TASK-004B: Max extension load attempts reached (${this.extensionLoadAttempts}), skipping`);
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
    if (!this.db || !this.insertStmt) {
      throw new Error("Vector store not initialized");
    }

    try {
      const hasVecExtension = this.checkVecExtension();
      const metadataStr = embedding.metadata ? JSON.stringify(embedding.metadata) : null;
      const timestamp = embedding.createdAt || Date.now();

      if (hasVecExtension) {
        // Use sqlite-vec virtual table
        const insertVecStmt = this.db.prepare(`
          INSERT OR REPLACE INTO vec_embeddings (id, embedding)
          VALUES (?, ?)
        `);

        // Insert vector into vec_embeddings virtual table
        insertVecStmt.run(embedding.id, Array.from(embedding.vector));

        // Insert metadata into embeddings table
        this.insertStmt.run(embedding.id, embedding.content, metadataStr, timestamp);
      } else {
        // Fallback to BLOB storage
        const vectorBuffer = float32ArrayToBuffer(embedding.vector);
        this.insertStmt.run(embedding.id, embedding.content, vectorBuffer, metadataStr, timestamp);
      }
    } catch (error) {
      console.error("[VectorStore] Insert failed:", error);
      throw error;
    }
  }

  /**
   * Batch insert multiple embeddings
   */
  async insertBatch(embeddings: VectorEmbedding[]): Promise<void> {
    if (!this.db || !this.insertStmt) {
      throw new Error("Vector store not initialized");
    }

    const insertMany = this.db.transaction((items: VectorEmbedding[]) => {
      for (const embedding of items) {
        const vectorBuffer = float32ArrayToBuffer(embedding.vector);
        const metadataStr = embedding.metadata ? JSON.stringify(embedding.metadata) : null;

        this.insertStmt!.run(
          embedding.id,
          embedding.content,
          vectorBuffer,
          metadataStr,
          embedding.createdAt || Date.now(),
        );
      }
    });

    try {
      insertMany(embeddings);
      console.log(`[VectorStore] Inserted batch of ${embeddings.length} embeddings`);
    } catch (error) {
      console.error("[VectorStore] Batch insert failed:", error);
      throw error;
    }
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async search(queryVector: Float32Array, limit = 10): Promise<SimilarityResult[]> {
    if (!this.db) {
      throw new Error("Vector store not initialized");
    }

    try {
      const hasVecExtension = this.checkVecExtension();

      if (hasVecExtension) {
        // Use sqlite-vec virtual table for efficient KNN search
        const stmt = this.db.prepare(`
          SELECT
            e.id,
            e.content,
            e.metadata,
            v.distance
          FROM vec_embeddings v
          JOIN embeddings e ON v.id = e.id
          WHERE v.embedding MATCH ?
          ORDER BY v.distance
          LIMIT ?
        `);

        const queryArray = Array.from(queryVector);
        const results = stmt.all(queryArray, limit) as Array<{
          id: string;
          content: string;
          metadata: string | null;
          distance: number;
        }>;

        return results.map((row) => ({
          id: row.id,
          content: row.content,
          similarity: Math.max(0, 1 - row.distance), // Convert distance to similarity (0-1)
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }));
      } else {
        // Fallback: Load all vectors and compute similarity in memory
        return this.fallbackSearch(queryVector, limit);
      }
    } catch (error) {
      console.error("[VectorStore] Search failed:", error);
      // If sqlite-vec search fails, fallback to traditional search
      console.log("[VectorStore] Falling back to traditional search method");
      return this.fallbackSearch(queryVector, limit);
    }
  }

  /**
   * Fallback search implementation without sqlite-vec
   */
  private async fallbackSearch(queryVector: Float32Array, limit: number): Promise<SimilarityResult[]> {
    if (!this.db) throw new Error("Database not initialized");

    const hasVecExtension = this.checkVecExtension();
    const results: Array<SimilarityResult & { score: number }> = [];

    if (hasVecExtension) {
      // With sqlite-vec: need to join with vec_embeddings table
      const stmt = this.db.prepare(`
        SELECT e.id, e.content, e.metadata, v.embedding
        FROM embeddings e
        LEFT JOIN vec_embeddings v ON e.id = v.id
      `);

      const rows = stmt.all() as Array<{
        id: string;
        content: string;
        metadata: string | null;
        embedding: any;
      }>;

      for (const row of rows) {
        if (!row.embedding) continue;
        const vector = new Float32Array(row.embedding);
        const similarity = this.cosineSimilarity(queryVector, vector);

        results.push({
          id: row.id,
          content: row.content,
          similarity,
          score: similarity,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        });
      }
    } else {
      // Fallback mode: vector stored in embeddings table
      const stmt = this.db.prepare(`
        SELECT id, content, vector, metadata
        FROM embeddings
      `);

      const rows = stmt.all() as VectorRow[];

      for (const row of rows) {
        const vector = bufferToFloat32Array(row.vector);
        const similarity = this.cosineSimilarity(queryVector, vector);

        results.push({
          id: row.id,
          content: row.content,
          similarity,
          score: similarity,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        });
      }
    }

    // Sort by similarity and limit
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
    if (!this.db) {
      throw new Error("Vector store not initialized");
    }

    const { limit = 10, threshold = 0.0, metadataFilter, dateRange } = options;

    try {
      const hasVecExtension = this.checkVecExtension();

      if (hasVecExtension) {
        // Build WHERE conditions
        const conditions: string[] = [];
        const params: any[] = [Array.from(queryVector)];

        if (dateRange?.start != null) {
          conditions.push("e.created_at >= ?");
          params.push(dateRange.start);
        }

        if (dateRange?.end != null) {
          conditions.push("e.created_at <= ?");
          params.push(dateRange.end);
        }

        if (metadataFilter) {
          // Simple JSON key-value matching
          for (const [key, value] of Object.entries(metadataFilter)) {
            conditions.push(`json_extract(e.metadata, '$.${key}') = ?`);
            params.push(value);
          }
        }

        const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

        params.push(limit);

        const stmt = this.db.prepare(`
          SELECT
            e.id,
            e.content,
            e.metadata,
            v.distance
          FROM vec_embeddings v
          JOIN embeddings e ON v.id = e.id
          WHERE v.embedding MATCH ?
            ${whereClause}
          ORDER BY v.distance
          LIMIT ?
        `);

        const results = stmt.all(...params) as Array<{
          id: string;
          content: string;
          metadata: string | null;
          distance: number;
        }>;

        return results
          .map((row) => ({
            id: row.id,
            content: row.content,
            similarity: Math.max(0, 1 - row.distance),
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          }))
          .filter((result) => result.similarity >= threshold);
      } else {
        // Fallback with filters applied in memory
        return this.fallbackSearchWithFilters(queryVector, options);
      }
    } catch (error) {
      console.error("[VectorStore] Advanced search failed:", error);
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
    const hasVecExtension = this.checkVecExtension();

    // Build WHERE conditions for SQL
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    let rows: any[];

    if (hasVecExtension) {
      // sqlite-vec mode: JOIN with vec_embeddings table
      const stmt = this.db.prepare(`
        SELECT e.id, e.content, e.metadata, e.created_at, v.embedding
        FROM embeddings e
        LEFT JOIN vec_embeddings v ON e.id = v.id
        ${whereClause}
      `);
      rows = stmt.all(...params);
    } else {
      // Fallback mode: vector stored in embeddings table
      const stmt = this.db.prepare(`
        SELECT id, content, vector, metadata, created_at
        FROM embeddings e
        ${whereClause}
      `);
      rows = stmt.all(...params) as VectorRow[];
    }

    const results: Array<SimilarityResult & { score: number }> = [];

    for (const row of rows) {
      // Apply metadata filter
      if (metadataFilter && row.metadata) {
        const metadata = JSON.parse(row.metadata);
        let matches = true;

        for (const [key, value] of Object.entries(metadataFilter)) {
          if (metadata[key] !== value) {
            matches = false;
            break;
          }
        }

        if (!matches) continue;
      }

      // Get vector based on schema type
      let vector: Float32Array;
      if (hasVecExtension) {
        if (!row.embedding) continue; // Skip entries without embeddings
        vector = new Float32Array(row.embedding);
      } else {
        vector = bufferToFloat32Array(row.vector);
      }

      const similarity = this.cosineSimilarity(queryVector, vector);

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

    // Sort by similarity and limit
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

      return result.has_vec === 1;
    } catch {
      return false;
    }
  }

  /**
   * Get embedding by ID
   */
  async get(id: string): Promise<VectorEmbedding | null> {
    if (!this.db) {
      throw new Error("Vector store not initialized");
    }

    const hasVecExtension = this.checkVecExtension();

    if (hasVecExtension) {
      // With sqlite-vec: need to join with vec_embeddings table
      const stmt = this.db.prepare(`
        SELECT e.id, e.content, e.metadata, e.created_at, v.embedding
        FROM embeddings e
        LEFT JOIN vec_embeddings v ON e.id = v.id
        WHERE e.id = ?
      `);

      const row = stmt.get(id) as any;
      if (!row) return null;

      // Convert embedding from sqlite-vec format to Float32Array
      const vector = row.embedding ? new Float32Array(row.embedding) : new Float32Array(this.config.dimensions);

      return {
        id: row.id,
        content: row.content,
        vector,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        createdAt: row.created_at,
      };
    } else {
      // Fallback mode: vector stored in embeddings table
      const stmt = this.db.prepare(`
        SELECT * FROM embeddings WHERE id = ?
      `);

      const row = stmt.get(id) as VectorRow | undefined;
      if (!row) return null;

      return {
        id: row.id,
        content: row.content,
        vector: bufferToFloat32Array(row.vector),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        createdAt: row.created_at,
      };
    }
  }

  /**
   * Update an existing embedding
   */
  async update(id: string, vector: Float32Array, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.db || !this.updateStmt) {
      throw new Error("Vector store not initialized");
    }

    const vectorBuffer = float32ArrayToBuffer(vector);
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    this.updateStmt.run(vectorBuffer, metadataStr, Date.now(), id);
  }

  /**
   * Delete an embedding
   */
  async delete(id: string): Promise<void> {
    if (!this.db || !this.deleteStmt) {
      throw new Error("Vector store not initialized");
    }

    this.deleteStmt.run(id);
  }

  /**
   * Get total number of embeddings
   */
  async count(): Promise<number> {
    if (!this.db) {
      throw new Error("Vector store not initialized");
    }

    const result = this.db.prepare("SELECT COUNT(*) as count FROM embeddings").get() as { count: number };
    return result.count;
  }

  /**
   * Clear all embeddings
   */
  async clear(): Promise<void> {
    if (!this.db) {
      throw new Error("Vector store not initialized");
    }

    this.db.exec("DELETE FROM embeddings");
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
      FROM embeddings,
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
