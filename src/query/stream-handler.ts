/**
 * TASK-002: Streaming Response Handler
 *
 * Handles streaming of large query results with pagination and cursor-based iteration.
 * Provides memory-efficient processing for large datasets.
 *
 * External Dependencies:
 * - stream: Node.js built-in - Streaming interfaces
 *
 * Architecture References:
 * - Query Types: src/types/query.ts
 * - Storage Types: src/types/storage.ts
 *
 * @task_id TASK-002
 * @coding_standard Adheres to: doc/CODING_STANDARD.md
 * @history
 *  - 2025-01-14: Created by Dev-Agent - TASK-002: Initial StreamHandler implementation
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { StreamOptions } from "../types/query.js";
import type { Entity } from "../types/storage.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_HIGH_WATER_MARK = 16384; // 16KB
const YIELD_INTERVAL = 100; // Yield control every 100 items

// =============================================================================
// 3. STREAM HANDLER IMPLEMENTATION
// =============================================================================

export class StreamHandler {
  private activeStreams = new Map<string, StreamContext>();

  /**
   * Create a readable stream for entities
   */
  createEntityStream(source: AsyncIterable<Entity> | Entity[], options?: StreamOptions): Readable {
    const opts = this.normalizeOptions(options);

    return new Readable({
      objectMode: true,
      highWaterMark: opts.highWaterMark,
      async read() {
        try {
          let count = 0;
          const batch: Entity[] = [];

          if (Array.isArray(source)) {
            // Array source
            for (const entity of source) {
              batch.push(entity);
              count++;

              if (count >= opts.batchSize) {
                this.push(batch.slice());
                batch.length = 0;
                count = 0;

                // Yield control
                await new Promise((resolve) => setImmediate(resolve));
              }
            }
          } else {
            // Async iterable source
            for await (const entity of source) {
              batch.push(entity);
              count++;

              if (count >= opts.batchSize) {
                this.push(batch.slice());
                batch.length = 0;
                count = 0;

                // Yield control
                await new Promise((resolve) => setImmediate(resolve));
              }
            }
          }

          // Push remaining items
          if (batch.length > 0) {
            this.push(batch);
          }

          // Signal end of stream
          this.push(null);
        } catch (error) {
          this.destroy(error as Error);
        }
      },
    });
  }

  /**
   * Create a transform stream for processing entities
   */
  createTransformStream<T, R>(transformer: (item: T) => R | Promise<R>, options?: StreamOptions): Transform {
    const opts = this.normalizeOptions(options);
    let processedCount = 0;

    return new Transform({
      objectMode: true,
      highWaterMark: opts.highWaterMark,
      async transform(chunk: T | T[], _encoding, callback) {
        try {
          const items = Array.isArray(chunk) ? chunk : [chunk];
          const results: R[] = [];

          for (const item of items) {
            const result = await transformer(item);
            results.push(result);
            processedCount++;

            // Yield control periodically
            if (processedCount % YIELD_INTERVAL === 0) {
              await new Promise((resolve) => setImmediate(resolve));
            }
          }

          callback(null, results);
        } catch (error) {
          callback(error as Error);
        }
      },
    });
  }

  /**
   * Create a paginated stream with cursor support
   */
  createPaginatedStream<T>(
    fetcher: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>,
    options?: StreamOptions,
  ): Readable {
    const opts = this.normalizeOptions(options);
    let cursor: string | undefined;
    let isExhausted = false;

    return new Readable({
      objectMode: true,
      highWaterMark: opts.highWaterMark,
      async read() {
        if (isExhausted) {
          this.push(null);
          return;
        }

        try {
          const result = await fetcher(cursor);

          if (result.items.length === 0) {
            isExhausted = true;
            this.push(null);
            return;
          }

          // Push items in batches
          for (let i = 0; i < result.items.length; i += opts.batchSize) {
            const batch = result.items.slice(i, i + opts.batchSize);
            this.push(batch);

            // Yield control
            await new Promise((resolve) => setImmediate(resolve));
          }

          cursor = result.nextCursor;
          if (!cursor) {
            isExhausted = true;
          }
        } catch (error) {
          this.destroy(error as Error);
        }
      },
    });
  }

  /**
   * Stream large result sets with memory management
   */
  async *streamResults<T>(source: AsyncIterable<T> | T[], options?: StreamOptions): AsyncGenerator<T[], void, unknown> {
    const opts = this.normalizeOptions(options);
    let batch: T[] = [];
    let count = 0;
    let totalProcessed = 0;

    const items = Array.isArray(source) ? source : source;

    for await (const item of items) {
      batch.push(item);
      count++;
      totalProcessed++;

      if (count >= opts.batchSize) {
        yield batch;
        batch = [];
        count = 0;

        // Yield control to prevent blocking
        if (totalProcessed % YIELD_INTERVAL === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }
    }

    // Yield remaining items
    if (batch.length > 0) {
      yield batch;
    }
  }

  /**
   * Process stream with backpressure handling
   */
  async processStreamWithBackpressure<T>(
    source: Readable,
    processor: (item: T) => Promise<void>,
    options?: StreamOptions,
  ): Promise<void> {
    const opts = this.normalizeOptions(options);
    const processingQueue: Promise<void>[] = [];
    const maxConcurrent = 10;

    const processStream = new Writable({
      objectMode: true,
      highWaterMark: opts.highWaterMark,
      async write(chunk: T | T[], _encoding, callback) {
        try {
          const items = Array.isArray(chunk) ? chunk : [chunk];

          for (const item of items) {
            // Wait if too many concurrent operations
            if (processingQueue.length >= maxConcurrent) {
              await Promise.race(processingQueue);
            }

            // Start processing and track promise
            const promise = processor(item).then(() => {
              // Remove from queue when done
              const index = processingQueue.indexOf(promise);
              if (index > -1) {
                processingQueue.splice(index, 1);
              }
            });

            processingQueue.push(promise);
          }

          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
      async final(callback) {
        try {
          // Wait for all remaining processing
          await Promise.all(processingQueue);
          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
    });

    await pipeline(source, processStream);
  }

  /**
   * Create a stream context for tracking
   */
  createStreamContext(id: string): StreamContext {
    const context: StreamContext = {
      id,
      startTime: Date.now(),
      itemsProcessed: 0,
      bytesProcessed: 0,
      errors: [],
      status: "active",
    };

    this.activeStreams.set(id, context);
    return context;
  }

  /**
   * Get stream context
   */
  getStreamContext(id: string): StreamContext | undefined {
    return this.activeStreams.get(id);
  }

  /**
   * Close stream context
   */
  closeStreamContext(id: string): void {
    const context = this.activeStreams.get(id);
    if (context) {
      context.status = "closed";
      context.endTime = Date.now();

      // Clean up after delay
      setTimeout(() => {
        this.activeStreams.delete(id);
      }, 60000); // Keep for 1 minute for debugging
    }
  }

  /**
   * Get active stream statistics
   */
  getStreamStats(): {
    activeStreams: number;
    totalProcessed: number;
    totalErrors: number;
  } {
    let totalProcessed = 0;
    let totalErrors = 0;

    for (const context of this.activeStreams.values()) {
      if (context.status === "active") {
        totalProcessed += context.itemsProcessed;
        totalErrors += context.errors.length;
      }
    }

    return {
      activeStreams: Array.from(this.activeStreams.values()).filter((c) => c.status === "active").length,
      totalProcessed,
      totalErrors,
    };
  }

  // =============================================================================
  // 4. HELPER METHODS
  // =============================================================================

  private normalizeOptions(options?: StreamOptions): Required<StreamOptions> {
    return {
      batchSize: options?.batchSize || DEFAULT_BATCH_SIZE,
      highWaterMark: options?.highWaterMark || DEFAULT_HIGH_WATER_MARK,
      encoding: options?.encoding || "utf8",
    };
  }
}

// =============================================================================
// 5. TYPE DEFINITIONS
// =============================================================================

interface StreamContext {
  id: string;
  startTime: number;
  endTime?: number;
  itemsProcessed: number;
  bytesProcessed: number;
  errors: Error[];
  status: "active" | "paused" | "closed" | "error";
}
