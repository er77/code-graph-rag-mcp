/**
 * TASK-004B: Embedding Generator - Stack Overflow Fixes Applied
 * TASK-002: Embedding Generator with Hugging Face Transformers
 * ADR-004: MCP CodeGraph Systematic Fixing Plan
 *
 * Generates 384-dimensional embeddings using all-MiniLM-L6-v2 model
 * Optimized for commodity hardware with ONNX runtime and quantization
 * FIXED: Recursive initialization patterns causing maximum call stack exceeded
 *
 * External Dependencies:
 * - @xenova/transformers: https://github.com/xenova/transformers.js - Hugging Face Transformers for JS
 * - onnxruntime-node: https://onnxruntime.ai/ - ONNX Runtime for optimized inference
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
 *  - 2025-09-14: Created by Dev-Agent - TASK-002: Embedding generator with all-MiniLM-L6-v2
 *  - 2025-09-17: Fixed by Dev-Agent - TASK-004B: Resolved initialization stack overflow patterns
 */
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type { EmbeddingConfig } from "../types/semantic.js";
import type { EmbeddingProvider } from "./providers/base.js";
import { createProvider } from "./providers/factory.js";
import { MemoryProvider } from "./providers/memory-provider.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
const DEFAULT_CONFIG: EmbeddingConfig = {
  modelName: DEFAULT_MODEL,
  quantized: true,
  localPath: "./models",
  batchSize: 8,
  provider: "memory",
};

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 5000;

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================
interface EmbeddingCache {
  text: string;
  embedding: Float32Array;
  timestamp: number;
  providerKey: string;
}

// =============================================================================
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, 512);
}

// =============================================================================
// 5. CORE BUSINESS LOGIC (ORCHESTRATOR)
// =============================================================================
export class EmbeddingGenerator {
  private provider: EmbeddingProvider | null = null;
  private fallback: EmbeddingProvider | null = null;

  private cache: Map<string, EmbeddingCache> = new Map();
  private config: EmbeddingConfig;
  private initPromise: Promise<void> | null = null;
  private isInitializing = false;

  private cacheHits = 0;
  private cacheMisses = 0;
  private debugMode = process.env.EMBEDDING_DEBUG === "true";

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private providerKey(): string {
    const info = this.provider?.info ?? this.fallback?.info;
    const dim = this.provider?.getDimension() ?? this.fallback?.getDimension() ?? 384;
    const name = info?.name ?? "memory";
    const model = info?.model ?? "deterministic-hash";
    return `${name}:${model}:${dim}`;
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.isInitializing = true;

    this.initPromise = (async () => {
      try {
        const providerName = this.config.provider ?? "memory";
        this.provider = createProvider({
          provider: providerName,
          modelName: this.config.modelName ?? DEFAULT_MODEL,
          transformers: {
            quantized: this.config.quantized,
            localPath: this.config.localPath,
          },
          ollama: this.config.ollama,
          openai: this.config.openai,
          cloudru: this.config.cloudru,
          memory: this.config.memory,
        });

        this.fallback = new MemoryProvider();

        try {
          await this.provider.initialize();
          if (this.debugMode) {
            console.log(
              `[EmbeddingGenerator] Provider initialized: ${this.provider.info.name} (${this.provider.info.model})`,
            );
          }
        } catch (e) {
          console.warn("[EmbeddingGenerator] Provider init failed, using memory fallback:", (e as Error)?.message || e);
          this.provider = this.fallback;
        }

        if (!this.provider) {
          this.provider = this.fallback;
        }
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.provider && !this.isInitializing) {
      await this.initialize();
    } else if (this.isInitializing && this.fallback) {
      if (this.debugMode) console.log("[EmbeddingGenerator] fallback during init");
      return this.fallback.embed(normalizeText(text));
    }

    const normalized = normalizeText(text);
    const key = `${this.providerKey()}:${hashText(normalized)}`;

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < DEFAULT_TTL_MS) {
      this.cacheHits++;
      return cached.embedding;
    }
    this.cacheMisses++;

    let embedding: Float32Array;
    try {
      embedding = await this.provider?.embed(normalized);
    } catch (e) {
      console.warn("[EmbeddingGenerator] embed failed, using fallback:", (e as Error)?.message || e);
      embedding = await this.fallback?.embed(normalized);
    }

    // Cache with simple LRU eviction
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      this.evictOldestCacheEntry();
    }
    this.cache.set(key, {
      text: normalized,
      embedding,
      timestamp: Date.now(),
      providerKey: this.providerKey(),
    });

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatch(texts: string[]): Promise<Float32Array[]> {
    if (!this.provider) {
      await this.initialize();
    }

    const results: Float32Array[] = [];
    const batchSize = this.config.batchSize ?? 8;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, Math.min(i + batchSize, texts.length));

      const toProcess: { index: number; text: string; key: string }[] = [];
      const batchResults: (Float32Array | null)[] = Array(batch.length).fill(null);

      for (let j = 0; j < batch.length; j++) {
        const normalized = normalizeText(batch[j] ?? "");
        const key = `${this.providerKey()}:${hashText(normalized)}`;
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < DEFAULT_TTL_MS) {
          this.cacheHits++;
          batchResults[j] = cached.embedding;
        } else {
          this.cacheMisses++;
          toProcess.push({ index: j, text: normalized, key });
        }
      }

      // Process uncached
      if (toProcess.length > 0) {
        let embeddings: Float32Array[] = [];
        try {
          if (typeof this.provider?.embedBatch === "function") {
            embeddings = await this.provider?.embedBatch?.(toProcess.map((t) => t.text));
          } else {
            // sequential fallback
            embeddings = [];
            for (const item of toProcess) {
              try {
                embeddings.push(await this.provider?.embed(item.text));
              } catch (e) {
                console.warn("[EmbeddingGenerator] embed failed in batch, using fallback:", (e as Error)?.message || e);
                embeddings.push(await this.fallback?.embed(item.text));
              }
            }
          }
        } catch (_e) {
          embeddings = await this.fallback?.embedBatch?.(toProcess.map((t) => t.text));
        }

        toProcess.forEach((item, k) => {
          const embedding = embeddings[k] ?? new Float32Array(this.provider?.getDimension() ?? 384);
          batchResults[item.index] = embedding;
          if (this.cache.size >= MAX_CACHE_ENTRIES) this.evictOldestCacheEntry();
          this.cache.set(item.key, {
            text: item.text,
            embedding,
            timestamp: Date.now(),
            providerKey: this.providerKey(),
          });
        });
      }

      results.push(...batchResults.filter((r): r is Float32Array => r !== null));
    }

    return results;
  }

  setBatchSize(size: number): void {
    const normalized = Number.isFinite(size) ? Math.max(1, Math.floor(size)) : (this.config.batchSize ?? 8);
    this.config.batchSize = normalized;
    if (this.debugMode) {
      console.log(`[EmbeddingGenerator] Batch size updated to ${normalized}`);
    }
  }

  /**
   * Generate embedding for code with special preprocessing
   */
  async generateCodeEmbedding(code: string, language?: string): Promise<Float32Array> {
    const processed = this.preprocessCode(code, language);
    return this.generateEmbedding(processed);
  }

  private preprocessCode(code: string, language?: string): string {
    let processed = code
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*[\r\n]/gm, "");

    if (language) processed = `${language} code: ${processed}`;
    return processed.replace(/\s+/g, " ").trim().slice(0, 512);
  }

  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) this.cache.delete(oldestKey);
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    console.log("[EmbeddingGenerator] Cache cleared");
  }

  getCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }

  async cleanup(): Promise<void> {
    this.clearCache();
    await this.provider?.close?.();
    await this.fallback?.close?.();
    this.provider = null;
    this.fallback = null;
    this.initPromise = null;
    console.log("[EmbeddingGenerator] Cleaned up");
  }
}
