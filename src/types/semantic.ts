/**
 * TASK-002: Semantic Agent Type Definitions
 *
 * Type definitions for semantic search and vector operations
 * Supports 384-dimensional vectors with all-MiniLM-L6-v2 model
 *
 * Architecture References:
 * - Project Overview: doc/PROJECT_OVERVIEW.md
 * - Coding Standards: doc/CODING_STANDARD.md
 * - Architectural Decisions: doc/ARCHITECTURAL_DECISIONS.md
 *
 * @task_id TASK-002
 * @history
 *  - 2025-09-14: Created by Dev-Agent - TASK-002: Initial semantic types
 * implementation
 */

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
export const VECTOR_DIMENSIONS = 384; // all-MiniLM-L6-v2 dimensions
export const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
export const MAX_BATCH_SIZE = 8; // Optimal for 4-core CPU
export const MAX_CACHE_ENTRIES = 5000;

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================

/**
 * Vector embedding representation
 */
export interface VectorEmbedding {
  id: string;
  content: string;
  vector: Float32Array;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

/**
 * Similarity search result
 */
export interface SimilarityResult {
  id: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

/**
 * Hybrid search result combining structural and semantic
 */
export interface HybridResult {
  id: string;
  score: number;
  source: "structural" | "semantic" | "hybrid";
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Semantic analysis result
 */
export interface SemanticAnalysis {
  entities: string[];
  concepts: string[];
  complexity: number;
  semanticType: "function" | "class" | "module" | "utility" | "test";
  summary: string;
}

/**
 * Similar code detection result
 */
export interface SimilarCode {
  id: string;
  path: string;
  content: string;
  similarity: number;
  type: "exact" | "near" | "semantic";
}

/**
 * Code clone group
 */
export interface CloneGroup {
  id: string;
  members: SimilarCode[];
  avgSimilarity: number;
  cloneType: "type1" | "type2" | "type3" | "type4"; // Exact, renamed, gapped, semantic
}

/**
 * Cross-language search result
 */
export interface CrossLangResult {
  id: string;
  language: string;
  path: string;
  content: string;
  similarity: number;
}

/**
 * Refactoring suggestion
 */
export interface RefactoringSuggestion {
  type: "extract" | "rename" | "move" | "combine" | "simplify";
  description: string;
  impact: "low" | "medium" | "high";
  confidence: number;
  code?: string;
}

/**
 * RRF fusion options
 */
export interface FusionOptions {
  k: number; // RRF constant (default 60)
  structuralWeight: number;
  semanticWeight: number;
  limit: number;
}

/**
 * Semantic operation results
 */
export interface SemanticResult {
  query: string;
  results: SimilarityResult[];
  processingTime: number;
}

/**
 * Cache entry for embeddings
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  hits: number;
  ttl?: number;
}

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
  dbPath: string;
  dimensions: number;
  cacheSize?: number;
  walMode?: boolean;
}

/**
 * Embedding generator configuration
 */
export type EmbeddingProviderKind = "memory" | "transformers" | "ollama" | "openai" | "cloudru";

export interface EmbeddingConfig {
  modelName: string;
  quantized: boolean;
  localPath?: string;
  batchSize: number;

  provider?: EmbeddingProviderKind; // default: 'memory'
  ollama?: {
    baseUrl?: string;
    timeoutMs?: number;
    concurrency?: number;
    headers?: Record<string, string>;
    autoPull?: boolean;
    warmupText?: string;
    checkServer?: boolean;
    pullTimeoutMs?: number;
  };
  openai?: {
    baseUrl?: string;
    apiKey?: string;
    timeoutMs?: number;
    concurrency?: number;
    maxBatchSize?: number;
  };
  cloudru?: {
    baseUrl?: string;
    apiKey?: string;
    timeoutMs?: number;
    concurrency?: number;
    maxBatchSize?: number;
  };
  memory?: {
    dimension?: number;
  };
}

/**
 * Semantic operations interface
 */
export interface SemanticOperations {
  // Basic semantic search
  semanticSearch(query: string, limit?: number): Promise<SemanticResult>;

  // Code similarity
  findSimilarCode(code: string, threshold?: number): Promise<SimilarCode[]>;
  detectClones(minSimilarity?: number): Promise<CloneGroup[]>;

  // Semantic analysis
  analyzeCodeSemantics(code: string): Promise<SemanticAnalysis>;
  generateCodeEmbedding(code: string): Promise<Float32Array>;

  // Cross-language search
  crossLanguageSearch(query: string, languages: string[]): Promise<CrossLangResult[]>;

  // Refactoring suggestions
  suggestRefactoring(code: string): Promise<RefactoringSuggestion[]>;
}

/**
 * Semantic task types
 */
export enum SemanticTaskType {
  EMBED = "embed",
  SEARCH = "search",
  ANALYZE = "analyze",
  CLONE_DETECT = "clone_detect",
  REFACTOR = "refactor",
}

/**
 * Semantic agent metrics
 */
export interface SemanticMetrics {
  embeddingsGenerated: number;
  searchesPerformed: number;
  avgEmbeddingTime: number;
  avgSearchTime: number;
  cacheHitRate: number;
  vectorsStored: number;
}
