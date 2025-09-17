/**
 * TASK-001: Incremental Parser Module
 *
 * Handles incremental parsing with content hashing and caching.
 * Uses xxhash for ultra-fast hashing and LRU cache for warm restarts.
 *
 * Architecture References:
 * - Parser Types: src/types/parser.ts
 * - Tree-sitter Parser: src/parsers/tree-sitter-parser.ts
 */

import { createHash } from "node:crypto";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { promises as fs } from "node:fs";
import { LRUCache } from "lru-cache";
// Removed: xxhash-wasm dependency - using native crypto for better performance
import type { CacheEntry, FileChange, ParseResult, ParserOptions, ParserStats } from "../types/parser.js";
import { TreeSitterParser } from "./tree-sitter-parser.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_TIMEOUT_MS = 5000;

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================
type HashFunction = (data: string) => string;

interface BatchResult {
  results: ParseResult[];
  errors: Array<{ file: string; error: Error }>;
  stats: {
    total: number;
    succeeded: number;
    failed: number;
    fromCache: number;
    totalTimeMs: number;
  };
}

// =============================================================================
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================

// Removed: stringToUint8Array - no longer needed with native crypto

/**
 * Create a timeout promise
 */
function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);
}

// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================

/**
 * Incremental parser with advanced caching and batch processing
 */
export class IncrementalParser {
  private parser: TreeSitterParser;
  private cache: LRUCache<string, CacheEntry>;
  private hashFunction: HashFunction | null = null;
  private stats: ParserStats;
  private fileHashes: Map<string, string> = new Map();

  constructor(cacheSize: number = DEFAULT_CACHE_SIZE) {
    // TASK-001: Initialize parser and cache
    this.parser = new TreeSitterParser();

    this.cache = new LRUCache<string, CacheEntry>({
      maxSize: cacheSize,
      sizeCalculation: (entry) => entry.size,
      dispose: (entry) => {
        // Clean up when evicted
        console.log(`[IncrementalParser] Evicted cache entry: ${entry.hash}`);
      },
    });

    this.stats = {
      filesParsed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgParseTimeMs: 0,
      totalParseTimeMs: 0,
      throughput: 0,
      cacheMemoryMB: 0,
      errorCount: 0,
    };
  }

  /**
   * Initialize the parser and hash function
   */
  async initialize(): Promise<void> {
    console.log("[IncrementalParser] Initializing...");

    // Initialize tree-sitter parser
    await this.parser.initialize();

    // Initialize native crypto hash function for fast hashing
    this.hashFunction = (content: string) => {
      return createHash("sha256").update(content).digest("hex").substring(0, 16);
    };

    console.log("[IncrementalParser] Initialization complete");
  }

  /**
   * Compute content hash using native crypto
   */
  computeFileHash(content: string): string {
    if (!this.hashFunction) {
      // Direct fallback to crypto hash
      return createHash("sha256").update(content).digest("hex").substring(0, 16);
    }

    return this.hashFunction(content);
  }

  /**
   * Parse a single file with caching
   */
  async parseFile(filePath: string, content?: string, options: ParserOptions = {}): Promise<ParseResult> {
    const startTime = Date.now();

    try {
      // Read content if not provided
      if (content === undefined) {
        content = await fs.readFile(filePath, "utf-8");
      }

      // Compute hash
      const contentHash = this.computeFileHash(content);

      // Check cache if enabled
      if (options.useCache !== false) {
        const cached = this.getFromCache(filePath, contentHash);
        if (cached) {
          this.stats.cacheHits++;
          return cached;
        }
      }

      this.stats.cacheMisses++;

      // Parse the file
      const result = await timeout(
        this.parser.parse(filePath, content, contentHash),
        options.timeoutMs || DEFAULT_TIMEOUT_MS,
      );

      // Store in cache
      this.addToCache(filePath, contentHash, result);

      // Update stats
      this.updateStats(result.parseTimeMs);

      // Store hash for incremental updates
      this.fileHashes.set(filePath, contentHash);

      return result;
    } catch (error) {
      this.stats.errorCount++;
      console.error(`[IncrementalParser] Error parsing ${filePath}:`, error);

      return {
        filePath,
        language: "javascript",
        entities: [],
        contentHash: "",
        timestamp: Date.now(),
        parseTimeMs: Date.now() - startTime,
        errors: [
          {
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  /**
   * Process files in batches for optimal performance
   */
  async parseBatch(files: string[], options: ParserOptions = {}): Promise<BatchResult> {
    const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    const results: ParseResult[] = [];
    const errors: Array<{ file: string; error: Error }> = [];
    const startTime = Date.now();
    let fromCache = 0;

    console.log(`[IncrementalParser] Processing ${files.length} files in batches of ${batchSize}`);

    // Process in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      // TASK-001: Process batch in parallel for maximum throughput
      const batchPromises = batch.map((file) =>
        this.parseFile(file, undefined, options)
          .then((result) => {
            if (result.fromCache) fromCache++;
            results.push(result);
          })
          .catch((error) => {
            errors.push({ file, error });
          }),
      );

      await Promise.all(batchPromises);

      // Update throughput stats
      const elapsed = Date.now() - startTime;
      this.stats.throughput = (results.length / elapsed) * 1000;

      // Log progress
      if ((i + batchSize) % 100 === 0 || i + batchSize >= files.length) {
        console.log(
          `[IncrementalParser] Progress: ${Math.min(i + batchSize, files.length)}/${files.length} ` +
            `(${Math.round(this.stats.throughput)} files/sec)`,
        );
      }
    }

    const totalTimeMs = Date.now() - startTime;

    return {
      results,
      errors,
      stats: {
        total: files.length,
        succeeded: results.length,
        failed: errors.length,
        fromCache,
        totalTimeMs,
      },
    };
  }

  /**
   * Process incremental changes
   */
  async processIncremental(changes: FileChange[], options: ParserOptions = {}): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    console.log(`[IncrementalParser] Processing ${changes.length} incremental changes`);

    for (const change of changes) {
      const { filePath, changeType, content } = change;

      switch (changeType) {
        case "created":
        case "modified":
          if (content) {
            // TASK-001: Use incremental parsing for modified files
            const newHash = this.computeFileHash(content);
            const oldHash = this.fileHashes.get(filePath);

            if (oldHash && oldHash === newHash) {
              // Content unchanged, get from cache
              const cached = this.getFromCache(filePath, newHash);
              if (cached) {
                results.push(cached);
                continue;
              }
            }

            // Parse with incremental support if edits provided
            let result: ParseResult;
            if (change.edits && change.edits.length > 0) {
              result = await this.parser.parseIncremental(filePath, content, newHash, change.edits);
            } else {
              result = await this.parseFile(filePath, content, options);
            }

            results.push(result);
            this.fileHashes.set(filePath, newHash);
          }
          break;

        case "deleted":
          // Remove from cache and hash map
          this.removeFromCache(filePath);
          this.fileHashes.delete(filePath);
          break;
      }
    }

    return results;
  }

  /**
   * Get parsed result from cache
   */
  private getFromCache(filePath: string, contentHash: string): ParseResult | null {
    const cacheKey = `${filePath}:${contentHash}`;
    const entry = this.cache.get(cacheKey);

    if (entry) {
      return {
        ...entry.result,
        timestamp: Date.now(),
        fromCache: true,
      };
    }

    return null;
  }

  /**
   * Add parsed result to cache
   */
  private addToCache(filePath: string, contentHash: string, result: ParseResult): void {
    const cacheKey = `${filePath}:${contentHash}`;
    const size = JSON.stringify(result).length;

    const entry: CacheEntry = {
      hash: contentHash,
      result,
      cachedAt: Date.now(),
      size,
    };

    this.cache.set(cacheKey, entry);
    this.updateCacheStats();
  }

  /**
   * Remove file from cache
   */
  private removeFromCache(filePath: string): void {
    // Remove all entries for this file
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${filePath}:`)) {
        this.cache.delete(key);
      }
    }
    this.updateCacheStats();
  }

  /**
   * Update parser statistics
   */
  private updateStats(parseTimeMs: number): void {
    this.stats.filesParsed++;
    this.stats.totalParseTimeMs += parseTimeMs;
    this.stats.avgParseTimeMs = this.stats.totalParseTimeMs / this.stats.filesParsed;
  }

  /**
   * Update cache statistics
   */
  private updateCacheStats(): void {
    this.stats.cacheMemoryMB = this.cache.calculatedSize / 1024 / 1024;
  }

  /**
   * Get parser statistics
   */
  getStats(): ParserStats {
    return { ...this.stats };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.fileHashes.clear();
    this.parser.clearCache();
    this.updateCacheStats();
    console.log("[IncrementalParser] Cache cleared");
  }

  /**
   * Warm restart from cached data
   */
  async warmRestart(cacheData: Array<{ file: string; hash: string; result: ParseResult }>): Promise<void> {
    console.log(`[IncrementalParser] Warming cache with ${cacheData.length} entries`);

    for (const { file, hash, result } of cacheData) {
      this.addToCache(file, hash, result);
      this.fileHashes.set(file, hash);
    }

    console.log(`[IncrementalParser] Cache warmed, hit rate target: >80%`);
  }

  /**
   * Export cache for persistence
   */
  exportCache(): Array<{ file: string; hash: string; result: ParseResult }> {
    const exported: Array<{ file: string; hash: string; result: ParseResult }> = [];

    for (const [key, entry] of this.cache.entries()) {
      const [file] = key.split(":");
      if (file) {
        exported.push({
          file,
          hash: entry.hash,
          result: entry.result,
        });
      }
    }

    return exported;
  }
}
