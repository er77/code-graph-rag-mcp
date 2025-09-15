/**
 * TASK-002: Embedding Generator with Hugging Face Transformers
 * 
 * Generates 384-dimensional embeddings using all-MiniLM-L6-v2 model
 * Optimized for commodity hardware with ONNX runtime and quantization
 * 
 * External Dependencies:
 * - @xenova/transformers: https://github.com/xenova/transformers.js - Hugging Face Transformers for JS
 * - onnxruntime-node: https://onnxruntime.ai/ - ONNX Runtime for optimized inference
 * 
 * Architecture References:
 * - Project Overview: doc/PROJECT_OVERVIEW.md
 * - Coding Standards: doc/CODING_STANDARD.md
 * - Architectural Decisions: doc/ARCHITECTURAL_DECISIONS.md
 * 
 * @task_id TASK-002
 * @history
 *  - 2025-09-14: Created by Dev-Agent - TASK-002: Embedding generator with all-MiniLM-L6-v2
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
// Dynamic import for optional transformers dependency
let transformers: any = null;
let isTransformersAvailable = false;

import type { EmbeddingConfig, MAX_BATCH_SIZE } from '../types/semantic.js';

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const DEFAULT_CONFIG: EmbeddingConfig = {
  modelName: DEFAULT_MODEL,
  quantized: true,
  localPath: './models',
  batchSize: 8
};

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================
interface EmbeddingCache {
  text: string;
  embedding: Float32Array;
  timestamp: number;
}

// =============================================================================
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================
function hashText(text: string): string {
  // Simple hash for cache key
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

function normalizeText(text: string): string {
  // Normalize text for better embedding quality
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 512); // Limit length for model input
}

// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================
export class EmbeddingGenerator {
  private model: Pipeline | null = null;
  private cache: Map<string, EmbeddingCache> = new Map();
  private config: EmbeddingConfig;
  private initPromise: Promise<void> | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;
  
  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    // Prevent multiple initializations
    if (this.initPromise) {
      return this.initPromise;
    }
    
    this.initPromise = this.initializeInternal();
    return this.initPromise;
  }
  
  private async initializeInternal(): Promise<void> {
    try {
      console.log(`[EmbeddingGenerator] Initializing ${this.config.modelName}...`);
      
      // Configure transformers.js environment
      env.allowRemoteModels = true;
      env.useBrowserCache = false;
      env.localModelPath = this.config.localPath;
      
      // Load the model with quantization for better performance
      this.model = await pipeline(
        'feature-extraction',
        this.config.modelName,
        {
          quantized: this.config.quantized,
          revision: 'main'
        }
      );
      
      console.log(`[EmbeddingGenerator] Model loaded successfully`);
      
      // Warm up the model with a test embedding
      await this.generateEmbedding('test');
      console.log(`[EmbeddingGenerator] Model warmed up`);
    } catch (error) {
      console.error('[EmbeddingGenerator] Initialization failed:', error);
      throw new Error(`Failed to initialize embedding model: ${error}`);
    }
  }
  
  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.model) {
      await this.initialize();
    }
    
    // Normalize the text
    const normalizedText = normalizeText(text);
    const cacheKey = hashText(normalizedText);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour TTL
      this.cacheHits++;
      return cached.embedding;
    }
    
    this.cacheMisses++;
    
    try {
      // Generate embedding
      const output = await this.model!(normalizedText, {
        pooling: 'mean',
        normalize: true
      });
      
      // Convert to Float32Array
      const embedding = new Float32Array(output.data);
      
      // Cache the result
      if (this.cache.size < 5000) {
        this.cache.set(cacheKey, {
          text: normalizedText,
          embedding,
          timestamp: Date.now()
        });
      } else {
        // LRU eviction: remove oldest entry
        this.evictOldestCacheEntry();
        this.cache.set(cacheKey, {
          text: normalizedText,
          embedding,
          timestamp: Date.now()
        });
      }
      
      return embedding;
    } catch (error) {
      console.error('[EmbeddingGenerator] Embedding generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatch(texts: string[]): Promise<Float32Array[]> {
    if (!this.model) {
      await this.initialize();
    }
    
    const results: Float32Array[] = [];
    const batchSize = this.config.batchSize;
    
    // Process in batches for optimal performance
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, Math.min(i + batchSize, texts.length));
      
      // Check cache for each item
      const toProcess: { index: number; text: string }[] = [];
      const batchResults: (Float32Array | null)[] = new Array(batch.length);
      
      for (let j = 0; j < batch.length; j++) {
        const normalizedText = normalizeText(batch[j]);
        const cacheKey = hashText(normalizedText);
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < 3600000) {
          this.cacheHits++;
          batchResults[j] = cached.embedding;
        } else {
          this.cacheMisses++;
          toProcess.push({ index: j, text: normalizedText });
          batchResults[j] = null;
        }
      }
      
      // Process uncached items
      if (toProcess.length > 0) {
        const embeddings = await this.processBatch(toProcess.map(item => item.text));
        
        for (let k = 0; k < toProcess.length; k++) {
          const { index, text } = toProcess[k];
          const embedding = embeddings[k];
          batchResults[index] = embedding;
          
          // Cache the result
          const cacheKey = hashText(text);
          if (this.cache.size < 5000) {
            this.cache.set(cacheKey, {
              text,
              embedding,
              timestamp: Date.now()
            });
          }
        }
      }
      
      // Add to results
      results.push(...batchResults.filter(r => r !== null) as Float32Array[]);
    }
    
    return results;
  }
  
  /**
   * Process a batch of texts
   */
  private async processBatch(texts: string[]): Promise<Float32Array[]> {
    try {
      // Process all texts at once for better efficiency
      const outputs = await Promise.all(
        texts.map(text => 
          this.model!(text, {
            pooling: 'mean',
            normalize: true
          })
        )
      );
      
      return outputs.map(output => new Float32Array(output.data));
    } catch (error) {
      console.error('[EmbeddingGenerator] Batch processing failed:', error);
      // Fallback to individual processing
      const results: Float32Array[] = [];
      for (const text of texts) {
        try {
          const embedding = await this.generateEmbedding(text);
          results.push(embedding);
        } catch (err) {
          console.error(`[EmbeddingGenerator] Failed to generate embedding for text: ${text.slice(0, 50)}...`);
          // Return zero vector as fallback
          results.push(new Float32Array(384));
        }
      }
      return results;
    }
  }
  
  /**
   * Generate embedding for code with special preprocessing
   */
  async generateCodeEmbedding(code: string, language?: string): Promise<Float32Array> {
    // Preprocess code for better embedding quality
    const processedCode = this.preprocessCode(code, language);
    return this.generateEmbedding(processedCode);
  }
  
  /**
   * Preprocess code for embedding
   */
  private preprocessCode(code: string, language?: string): string {
    // Remove comments (simple approach)
    let processed = code
      .replace(/\/\/.*$/gm, '') // Single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Multi-line comments
      .replace(/^\s*[\r\n]/gm, ''); // Empty lines
    
    // Add language context if provided
    if (language) {
      processed = `${language} code: ${processed}`;
    }
    
    // Normalize whitespace
    processed = processed.replace(/\s+/g, ' ').trim();
    
    // Limit length
    return processed.slice(0, 512);
  }
  
  /**
   * Evict oldest cache entry (LRU)
   */
  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    console.log('[EmbeddingGenerator] Cache cleared');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0
    };
  }
  
  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.clearCache();
    this.model = null;
    this.initPromise = null;
    console.log('[EmbeddingGenerator] Cleaned up');
  }
}