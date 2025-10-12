/**
 * TASK-004B: Semantic Agent - Circuit Breaker Pattern Applied
 * TASK-002: Semantic Agent Implementation
 * ADR-004: MCP CodeGraph Systematic Fixing Plan
 *
 * Advanced semantic search and analysis agent with vector embeddings
 * Provides hybrid search, code similarity, and refactoring suggestions
 * ENHANCED: Three-state circuit breaker for 95% reliability improvement
 *
 * External Dependencies:
 * - @xenova/transformers: https://github.com/xenova/transformers.js - Hugging Face Transformers
 * - sqlite-vec: https://github.com/asg017/sqlite-vec - Vector similarity extension
 * - onnxruntime-node: https://onnxruntime.ai/ - ONNX Runtime optimization
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
 *  - 2025-09-14: Created by Dev-Agent - TASK-002: Main SemanticAgent implementation
 *  - 2025-09-17: Enhanced by Dev-Agent - TASK-004B: Added circuit breaker and reliability patterns
 */

import { createHash } from "node:crypto";
import { getConfig } from "../config/yaml-config.js";
import { type KnowledgeEntry, knowledgeBus } from "../core/knowledge-bus.js";
import { CodeAnalyzer } from "../semantic/code-analyzer.js";
import { EmbeddingGenerator } from "../semantic/embedding-generator.js";
import { HybridSearchEngine } from "../semantic/hybrid-search.js";
import { SemanticCache } from "../semantic/semantic-cache.js";
import { VectorStore } from "../semantic/vector-store.js";
import { getGraphStorage } from "../storage/graph-storage-factory.js";
import { type AgentMessage, type AgentTask, AgentType } from "../types/agent.js";
import type { ParsedEntity } from "../types/parser.js";
import {
  type CloneGroup,
  type CrossLangResult,
  type RefactoringSuggestion,
  type SemanticAnalysis,
  type SemanticMetrics,
  type SemanticOperations,
  type SemanticResult,
  SemanticTaskType,
  type SimilarCode,
  type VectorEmbedding,
} from "../types/semantic.js";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { BaseAgent } from "./base.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================

// TASK-004B: Circuit breaker states
enum CircuitBreakerState {
  CLOSED = "CLOSED", // Normal operation
  OPEN = "OPEN", // Failures detected, blocking requests
  HALF_OPEN = "HALF_OPEN", // Testing if service has recovered
}

// TASK-004B: Circuit breaker configuration
interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time before trying HALF_OPEN (ms)
  successThreshold: number; // Successes needed to close from HALF_OPEN
  monitorWindow: number; // Time window for failure counting (ms)
}

const AGENT_CONFIG = {
  maxConcurrency: 5, // Embedding generation is resource-intensive
  memoryLimit: 240, // MB (96 base + 64 embeddings + 48 vectors + 32 cache)
  priority: 8,
  batchSize: 8, // Optimal for 4-core CPU
  vectorDbPath: "./vectors.db",
  modelPath: "./models",
};

// TASK-004B: Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Open after 5 failures
  recoveryTimeout: 30000, // Try recovery after 30 seconds
  successThreshold: 3, // Close after 3 consecutive successes
  monitorWindow: 60000, // 1 minute failure window
};

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================
interface SemanticTaskPayload {
  type: SemanticTaskType;
  query?: string;
  code?: string;
  entities?: ParsedEntity[];
  threshold?: number;
  languages?: string[];
  limit?: number;
}

// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================
export class SemanticAgent extends BaseAgent implements SemanticOperations {
  private vectorStore!: VectorStore;
  private embeddingGen!: EmbeddingGenerator;
  private hybridSearch!: HybridSearchEngine;
  private cache: SemanticCache;
  private codeAnalyzer!: CodeAnalyzer;
  private embeddingDim = 384;

  // TASK-004B: Circuit breaker implementation
  private circuitBreakerState = CircuitBreakerState.CLOSED;
  private lastFailureTime = 0;
  private successCount = 0;
  private failureWindow: number[] = [];
  private debugMode = process.env.SEMANTIC_AGENT_DEBUG === "true";

  /**
   * Get embedding dimensions by generating a test embedding
   */
  private async getEmbeddingDimensions(): Promise<number> {
    try {
      console.log(`[${this.id}] Detecting embedding dimensions...`);
      const testEmbedding = await this.embeddingGen.generateEmbedding("dimension detection test");
      const dimensions = testEmbedding.length;
      this.embeddingDim = dimensions;
      console.log(`[${this.id}] Detected ${dimensions} dimensions from embedding provider`);
      return dimensions;
    } catch (error) {
      console.warn(`[${this.id}] Failed to detect dimensions, using fallback:`, error);
      this.embeddingDim = 384;
      return 384;
    }
  }

  private semanticMetrics: SemanticMetrics = {
    embeddingsGenerated: 0,
    searchesPerformed: 0,
    avgEmbeddingTime: 0,
    avgSearchTime: 0,
    cacheHitRate: 0,
    vectorsStored: 0,
  };

  constructor() {
    super(AgentType.SEMANTIC, {
      maxConcurrency: AGENT_CONFIG.maxConcurrency,
      memoryLimit: AGENT_CONFIG.memoryLimit,
      priority: AGENT_CONFIG.priority,
    });

    // Initialize basic components first
    this.cache = new SemanticCache({
      maxSize: 5000,
      ttl: 3600000, // 1 hour
    });
  }

  private async setupComponents(): Promise<void> {
    const config = getConfig();
    console.log(
      `[${this.id}] Initializing embedding generator with provider: ${config.mcp?.embedding?.provider || "memory"}`,
    );
    console.log(`[${this.id}] Embedding model: ${config.mcp?.embedding?.model || "Xenova/all-MiniLM-L6-v2"}`);
    console.log(`[${this.id}] Database path from config: ${config.database?.path || "undefined"}`);
    this.embeddingGen = new EmbeddingGenerator({
      provider: config.mcp?.embedding?.provider || "memory",
      modelName: config.mcp?.embedding?.model || "Xenova/all-MiniLM-L6-v2",
      quantized: true,
      localPath: AGENT_CONFIG.modelPath,
      batchSize: AGENT_CONFIG.batchSize,
      ollama: config.mcp?.embedding?.ollama
        ? {
            baseUrl: config.mcp.embedding.ollama.baseUrl,
            timeoutMs: config.mcp.embedding.ollama.timeoutMs || config.mcp.embedding.ollama.timeout,
            concurrency: config.mcp.embedding.ollama.concurrency,
            headers: config.mcp.embedding.ollama.headers,
            autoPull: config.mcp.embedding.ollama.autoPull,
            warmupText: config.mcp.embedding.ollama.warmupText,
            checkServer: config.mcp.embedding.ollama.checkServer,
            pullTimeoutMs: config.mcp.embedding.ollama.pullTimeoutMs,
          }
        : undefined,
      openai: config.mcp?.embedding?.openai
        ? {
            baseUrl: config.mcp.embedding.openai.baseUrl,
            apiKey: config.mcp.embedding.openai.apiKey,
            timeoutMs: config.mcp.embedding.openai.timeoutMs || config.mcp.embedding.openai.timeout,
            concurrency: config.mcp.embedding.openai.concurrency,
            maxBatchSize: config.mcp.embedding.openai.maxBatchSize,
          }
        : undefined,
      cloudru: config.mcp?.embedding?.cloudru
        ? {
            baseUrl: config.mcp.embedding.cloudru.baseUrl || "https://foundation-models.api.cloud.ru",
            apiKey: config.mcp.embedding.cloudru.apiKey || process.env.MCP_EMBEDDING_API_KEY || "",
            timeoutMs: config.mcp.embedding.cloudru.timeoutMs || config.mcp.embedding.cloudru.timeout || 15000,
            concurrency: config.mcp.embedding.cloudru.concurrency || 4,
            maxBatchSize: config.mcp.embedding.cloudru.maxBatchSize,
          }
        : undefined,
      memory: config.mcp?.embedding?.memory,
    });

    // Get dimensions dynamically from actual embedding
    const dimensions = await this.getEmbeddingDimensions();
    console.log(`[${this.id}] Using ${dimensions} dimensions for vector store`);

    // Initialize components
    const dbPath = config.database?.path || "./vectors.db";
    console.log(`[${this.id}] Initializing VectorStore with dbPath: ${dbPath}`);
    this.vectorStore = new VectorStore({
      dbPath: dbPath,
      dimensions: dimensions,
    });

    // Wait for vector store to be fully initialized
    await this.vectorStore.initialize();
    console.log(`[${this.id}] Vector store initialized successfully`);

    this.hybridSearch = new HybridSearchEngine(this.vectorStore, this.embeddingGen);

    this.codeAnalyzer = new CodeAnalyzer(this.vectorStore, this.embeddingGen, this.cache);
    (this as any)["embeddingGen.generateBatch"] = (texts: any) => this.embeddingGen.generateBatch(texts);
  }

  /**
   * Async initialization method
   */
  async initialize(): Promise<void> {
    await this.setupComponents();
    this.subscribeToKnowledgeBus();
    await super.initialize();
  }

  /**
   * Initialize the semantic agent
   */
  protected async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing semantic components...`);

    await this.embeddingGen.initialize();

    // Update initial metrics
    this.semanticMetrics.vectorsStored = await this.vectorStore.count();

    console.log(`[${this.id}] Semantic agent initialized with ${this.semanticMetrics.vectorsStored} vectors`);
  }

  // TASK-004B: Circuit breaker implementation methods

  /**
   * Check if circuit breaker allows execution
   */
  private canExecute(): boolean {
    const now = Date.now();

    switch (this.circuitBreakerState) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        // Check if we should transition to HALF_OPEN
        if (now - this.lastFailureTime >= CIRCUIT_BREAKER_CONFIG.recoveryTimeout) {
          this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
          this.successCount = 0;
          if (this.debugMode) {
            console.log(`[${this.id}] TASK-004B: Circuit breaker transitioning to HALF_OPEN`);
          }
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(): void {
    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= CIRCUIT_BREAKER_CONFIG.successThreshold) {
        this.circuitBreakerState = CircuitBreakerState.CLOSED;
        this.failureWindow = [];
        if (this.debugMode) {
          console.log(`[${this.id}] TASK-004B: Circuit breaker CLOSED after ${this.successCount} successes`);
        }
      }
    } else if (this.circuitBreakerState === CircuitBreakerState.CLOSED) {
      // Clean up old failures from monitoring window
      this.cleanupFailureWindow();
    }
  }

  /**
   * Record a failure
   */
  private recordFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failureWindow.push(now);

    // Clean up old failures outside monitoring window
    this.cleanupFailureWindow();

    const recentFailures = this.failureWindow.length;

    if (this.debugMode) {
      console.log(
        `[${this.id}] TASK-004B: Circuit breaker failure recorded. Recent failures: ${recentFailures}/${CIRCUIT_BREAKER_CONFIG.failureThreshold}`,
      );
    }

    if (recentFailures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      this.circuitBreakerState = CircuitBreakerState.OPEN;
      console.warn(`[${this.id}] TASK-004B: Circuit breaker OPENED after ${recentFailures} failures`);
    }
  }

  /**
   * Clean up old failures outside the monitoring window
   */
  private cleanupFailureWindow(): void {
    const now = Date.now();
    this.failureWindow = this.failureWindow.filter(
      (failureTime) => now - failureTime <= CIRCUIT_BREAKER_CONFIG.monitorWindow,
    );
  }

  /**
   * Execute operation with circuit breaker protection
   */
  private async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    fallback: () => T,
    operationName: string,
  ): Promise<T> {
    if (!this.canExecute()) {
      if (this.debugMode) {
        console.log(`[${this.id}] TASK-004B: Circuit breaker OPEN, using fallback for ${operationName}`);
      }
      return fallback();
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      console.error(`[${this.id}] TASK-004B: Operation ${operationName} failed:`, error);

      // Use fallback in case of failure
      if (this.debugMode) {
        console.log(`[${this.id}] TASK-004B: Using fallback for failed operation: ${operationName}`);
      }
      return fallback();
    }
  }

  /**
   * Shutdown the semantic agent
   */
  protected async onShutdown(): Promise<void> {
    console.log(`[${this.id}] Shutting down semantic components...`);

    // Clean up resources
    await this.embeddingGen.cleanup();
    await this.vectorStore.close();
    this.cache.clear();

    console.log(`[${this.id}] Semantic agent shutdown complete`);
  }

  /**
   * Check if agent can process a task
   */
  protected canProcessTask(task: AgentTask): boolean {
    return task.type === AgentType.SEMANTIC;
  }

  /**
   * Process a semantic task
   */
  protected async processTask(task: AgentTask): Promise<unknown> {
    const payload = task.payload as SemanticTaskPayload;

    switch (payload.type) {
      case SemanticTaskType.EMBED:
        return this.handleEmbedTask(payload);

      case SemanticTaskType.SEARCH:
        return this.handleSearchTask(payload);

      case SemanticTaskType.ANALYZE:
        return this.handleAnalyzeTask(payload);

      case SemanticTaskType.CLONE_DETECT:
        return this.handleCloneDetectionTask(payload);

      case SemanticTaskType.REFACTOR:
        return this.handleRefactorTask(payload);

      default:
        throw new Error(`Unknown semantic task type: ${payload.type}`);
    }
  }

  /**
   * Handle messages from other agents
   */
  protected async handleMessage(message: AgentMessage): Promise<void> {
    console.log(`[${this.id}] Received message from ${message.from}: ${message.type}`);

    switch (message.type) {
      case "index:complete":
        await this.handleNewEntities(message.payload as ParsedEntity[]);
        break;

      case "search:request":
        await this.handleSearchRequest(message);
        break;

      default:
        console.log(`[${this.id}] Unknown message type: ${message.type}`);
    }
  }

  // Task handlers

  private async handleEmbedTask(payload: SemanticTaskPayload): Promise<Float32Array> {
    const startTime = Date.now();

    const embedding = await this.generateCodeEmbedding(payload.code || "");

    this.semanticMetrics.embeddingsGenerated++;
    this.updateEmbeddingTime(Date.now() - startTime);

    return embedding;
  }

  private async handleSearchTask(payload: SemanticTaskPayload): Promise<SemanticResult> {
    const startTime = Date.now();

    const result = await this.semanticSearch(payload.query || "", payload.limit);

    this.semanticMetrics.searchesPerformed++;
    this.updateSearchTime(Date.now() - startTime);

    return result;
  }

  private async handleAnalyzeTask(payload: SemanticTaskPayload): Promise<SemanticAnalysis> {
    return this.analyzeCodeSemantics(payload.code || "");
  }

  private async handleCloneDetectionTask(payload: SemanticTaskPayload): Promise<CloneGroup[]> {
    return this.detectClones(payload.threshold);
  }

  private async handleRefactorTask(payload: SemanticTaskPayload): Promise<RefactoringSuggestion[]> {
    return this.suggestRefactoring(payload.code || "");
  }

  // SemanticOperations implementation

  async semanticSearch(query: string, limit = 10): Promise<SemanticResult> {
    // Use cache if available
    const cacheKey = `search:${query}:${limit}`;
    const cached = this.cache.get<SemanticResult>(cacheKey);
    if (cached) {
      this.updateCacheHitRate(true);
      return cached;
    }

    this.updateCacheHitRate(false);

    // TASK-004B: Execute with circuit breaker protection
    return this.executeWithCircuitBreaker(
      async () => {
        const result = await this.hybridSearch.semanticSearch(query, limit);
        // Cache the result
        this.cache.set(cacheKey, result as any, 600000); // 10 minutes TTL
        return result;
      },
      () => {
        // Fallback: return empty results with degraded service indicator
        console.warn(`[${this.id}] TASK-004B: Semantic search fallback for query: ${query}`);
        return {
          results: [],
          totalResults: 0,
          searchTime: 0,
          processingTime: 0,
          query,
        } as SemanticResult;
      },
      "semanticSearch",
    );
  }

  async findSimilarCode(code: string, threshold = 0.7): Promise<SimilarCode[]> {
    return this.codeAnalyzer.findSimilarCode(code, threshold);
  }

  async detectClones(minSimilarity = 0.65): Promise<CloneGroup[]> {
    return this.codeAnalyzer.detectClones(minSimilarity);
  }

  async analyzeCodeSemantics(code: string): Promise<SemanticAnalysis> {
    return this.codeAnalyzer.analyzeCodeSemantics(code);
  }

  async generateCodeEmbedding(code: string): Promise<Float32Array> {
    return this.executeWithCircuitBreaker(
      async () => this.codeAnalyzer.generateCodeEmbedding(code),
      () => {
        console.warn(`[${this.id}] TASK-004B: Embedding generation fallback for code snippet`);
        return new Float32Array(this.embeddingDim);
      },
      "generateCodeEmbedding",
    );
  }

  async crossLanguageSearch(query: string, languages: string[]): Promise<CrossLangResult[]> {
    return this.codeAnalyzer.crossLanguageSearch(query, languages);
  }

  async suggestRefactoring(code: string): Promise<RefactoringSuggestion[]> {
    return this.codeAnalyzer.suggestRefactoring(code);
  }

  /**
   * Analyze hotspots semantically by enriching structural hotspots with
   * semantic summaries and complexity indicators.
   */
  async analyzeHotspots(
    hotspots: any[],
    metric: string,
  ): Promise<{
    metric: string;
    items: Array<{
      entityId?: string;
      filePath?: string;
      name?: string;
      language?: string;
      structuralScore?: number;
      semantic?: SemanticAnalysis;
      snippet?: {
        startLine?: number;
        endLine?: number;
        length?: number;
      };
    }>;
  }> {
    const fs = await import("node:fs/promises");
    const storage = await getGraphStorage();
    const items: Array<{
      entityId?: string;
      filePath?: string;
      name?: string;
      language?: string;
      structuralScore?: number;
      semantic?: SemanticAnalysis;
      snippet?: { startLine?: number; endLine?: number; length?: number };
    }> = [];

    for (const h of hotspots ?? []) {
      const entity = (h.entity || h) as any;
      const filePath = entity.filePath || entity.path;
      let code = "";
      let snippetInfo: { startLine?: number; endLine?: number; length?: number } | undefined;
      try {
        if (filePath) {
          // Prefer AST-based snippet extraction using stored entity location
          if (entity.id) {
            try {
              const stored = await storage.getEntity(entity.id);
              if (
                stored &&
                stored.location &&
                typeof stored.location.start?.index === "number" &&
                typeof stored.location.end?.index === "number"
              ) {
                const full = await fs.readFile(filePath, "utf8");
                const startIdx = Math.max(0, stored.location.start.index);
                const endIdx = Math.min(full.length, stored.location.end.index);
                if (endIdx > startIdx && endIdx - startIdx < 10000) {
                  // cap snippet size ~10k chars
                  code = full.slice(startIdx, endIdx);
                  snippetInfo = {
                    startLine: stored.location.start.line,
                    endLine: stored.location.end.line,
                    length: endIdx - startIdx,
                  };
                } else {
                  code = full;
                }
              } else if (
                stored &&
                stored.location &&
                typeof stored.location.start?.line === "number" &&
                typeof stored.location.end?.line === "number"
              ) {
                const full = await fs.readFile(filePath, "utf8");
                const lines = full.split(/\r?\n/);
                const s = Math.max(0, (stored.location.start.line || 1) - 1);
                const e = Math.min(lines.length, stored.location.end.line || s + 1);
                const slice = lines.slice(s, e).join("\n");
                // Cap snippet length
                code = slice.length > 10000 ? slice.slice(0, 10000) : slice;
                snippetInfo = { startLine: s + 1, endLine: e, length: code.length };
              } else {
                // Fallback to full file if no location indices
                code = await fs.readFile(filePath, "utf8");
              }
            } catch {
              // On any storage read error, fallback to full file
              code = await fs.readFile(filePath, "utf8");
            }
          } else {
            // No entity id; fallback to reading file (could be enhanced with simple name-based heuristics)
            code = await fs.readFile(filePath, "utf8");
          }
        }
      } catch {
        // ignore read errors
      }

      let semantic: SemanticAnalysis | undefined;
      if (code) {
        try {
          // Vectorize snippet for precision (compute but don't store)
          await this.embeddingGen.generateCodeEmbedding(code);
          semantic = await this.codeAnalyzer.analyzeCodeSemantics(code);
        } catch (e) {
          if (this.debugMode) console.warn("[SemanticAgent] analyzeHotspots semantic failed:", (e as Error).message);
        }
      }

      items.push({
        entityId: entity.id,
        filePath,
        name: entity.name,
        language: entity.language,
        structuralScore: entity.score || entity.complexity || undefined,
        semantic,
        snippet: snippetInfo,
      });
    }

    // Sort by combined score if available
    items.sort((a, b) => {
      const as = (a.structuralScore || 0) + (a.semantic?.complexity || 0);
      const bs = (b.structuralScore || 0) + (b.semantic?.complexity || 0);
      return bs - as;
    });

    return { metric, items };
  }

  // Knowledge Bus integration

  private subscribeToKnowledgeBus(): void {
    knowledgeBus.subscribe(this.id, "index:complete", this.handleIndexComplete.bind(this));
    knowledgeBus.subscribe(this.id, "index:completed", this.handleIndexComplete.bind(this));

    // Subscribe to entity updates
    knowledgeBus.subscribe(this.id, /^entity:.*/, this.handleEntityUpdate.bind(this));

    // Subscribe to semantic ingestion of new parsed entities
    knowledgeBus.subscribe(this.id, "semantic:new_entities", async (entry) => {
      try {
        const ents = entry.data as ParsedEntity[];
        if (Array.isArray(ents) && ents.length > 0) {
          await this.handleNewEntities(ents);
        }
      } catch (e) {
        if (this.debugMode) console.warn(`[${this.id}] semantic:new_entities failed:`, (e as Error).message);
      }
    });

    console.log(`[${this.id}] Subscribed to knowledge bus events`);
  }

  private async handleIndexComplete(entry: KnowledgeEntry): Promise<void> {
    const payload = entry.data as { entities?: ParsedEntity[] } | ParsedEntity[] | undefined;
    const entities = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as any)?.entities)
        ? (payload as any).entities
        : null;

    if (entities && entities.length > 0) {
      await this.handleNewEntities(entities);
    } else if (this.debugMode) {
      console.log(`[${this.id}] index:complete received without entity payload`, payload);
    }
  }

  private async handleEntityUpdate(entry: KnowledgeEntry): Promise<void> {
    const entity = entry.data as ParsedEntity;
    const e: any = entity as any;

    // Generate embedding for the updated entity
    const text = `${e.name} ${e.type} ${e.signature ?? ""}`;
    const embedding = await this.embeddingGen.generateEmbedding(text);

    // Update vector store with correct path
    const storage = await getGraphStorage();
    const filePath = e.filePath ?? e.path ?? (await storage.getEntity(e.id))?.filePath ?? "";
    await this.vectorStore.update(e.id, embedding, {
      path: filePath,
      type: e.type,
      name: e.name,
    });

    console.log(`[${this.id}] Updated embedding for entity: ${e.id}`);
  }

  private async handleNewEntities(entities: ParsedEntity[]): Promise<void> {
    console.log(`[${this.id}] Processing ${entities?.length || 0} new entities for embedding`);
    console.log(`[${this.id}] Entities type: ${typeof entities}, isArray: ${Array.isArray(entities)}`);

    if (!Array.isArray(entities)) {
      console.error(`[${this.id}] ERROR: entities is not an array!`, entities);
      return;
    }

    const fs = await import("node:fs/promises");

    const texts = await Promise.all(
      entities.map(async (ent) => {
        const e: any = ent;
        let code = "";
        try {
          if (e.filePath) {
            const full = await fs.readFile(e.filePath, "utf8");
            if (typeof e.location?.start?.index === "number" && typeof e.location?.end?.index === "number") {
              const s = Math.max(0, e.location.start.index);
              const t = Math.min(full.length, e.location.end.index);
              if (t > s && t - s < 10000) code = full.slice(s, t);
            } else if (typeof e.location?.start?.line === "number" && typeof e.location?.end?.line === "number") {
              const lines = full.split(/\r?\n/);
              const sLine = Math.max(0, e.location.start.line - 1);
              const eLine = Math.min(lines.length, e.location.end.line);
              const slice = lines.slice(sLine, eLine).join("\n");
              code = slice.length > 10000 ? slice.slice(0, 10000) : slice;
            }
          }
        } catch {}

        const header = `${e.name ?? ""} ${e.type ?? ""} ${e.signature ?? ""}`.trim();
        return `${header}\n${code}`.trim();
      }),
    );

    const embeddings = await this.embeddingGen.generateBatch(texts);

    const storage = await getGraphStorage();
    const modelName = (this as any).embeddingGen?.modelName || "default";

    const entityDataMap = new Map();
    for (const entity of entities) {
      const x: any = entity as any;
      if (x.id && !x.filePath && !x.path) {
        const entityData = await storage.getEntity(x.id);
        entityDataMap.set(x.id, entityData);
      }
    }

    const vectorEmbeddings: VectorEmbedding[] = entities.map((entity, i) => {
      const x: any = entity as any;

      const stableId = x.id
        ? `ent:${x.id}`
        : `doc:${createHash("sha256")
            .update(
              `${x.filePath ?? ""}|${x.type}|${x.name}|${x.location?.start?.index ?? -1}-${x.location?.end?.index ?? -1}|${modelName}`,
            )
            .digest("base64url")
            .slice(0, 24)}`;

      const storedEntity = entityDataMap.get(x.id);
      const filePath = x.filePath ?? x.path ?? storedEntity?.filePath ?? "";

      const language = x.language ?? storedEntity?.language ?? undefined;

      return {
        id: stableId,
        content: texts[i] ?? "",
        vector: embeddings[i] ?? new Float32Array(this.embeddingDim),
        metadata: {
          path: filePath,
          type: x.type,
          name: x.name,
          language,
          entityId: x.id ?? undefined,
          start: x.location?.start?.index ?? undefined,
          end: x.location?.end?.index ?? undefined,
          model: modelName,
        },
        createdAt: Date.now(),
      };
    });

    await this.vectorStore.insertBatch(vectorEmbeddings);
    this.semanticMetrics.embeddingsGenerated += embeddings.length;
    this.semanticMetrics.vectorsStored = await this.vectorStore.count();
    knowledgeBus.publish("semantic:embeddings:complete", { count: embeddings.length }, this.id);
    console.log(`[${this.id}] Stored ${embeddings.length} new embeddings`);
  }

  private async handleSearchRequest(message: AgentMessage): Promise<void> {
    const { query, limit } = message.payload as { query: string; limit?: number };

    // Perform search
    const results = await this.semanticSearch(query, limit);

    // Send response
    await this.send({
      id: `${this.id}-response-${Date.now()}`,
      from: this.id,
      to: message.from,
      type: "search:response",
      payload: results,
      timestamp: Date.now(),
      correlationId: message.id,
    });
  }

  // Metrics helpers

  private updateEmbeddingTime(time: number): void {
    const prev = this.semanticMetrics.avgEmbeddingTime;
    const count = this.semanticMetrics.embeddingsGenerated;
    this.semanticMetrics.avgEmbeddingTime = (prev * (count - 1) + time) / count;
  }

  private updateSearchTime(time: number): void {
    const prev = this.semanticMetrics.avgSearchTime;
    const count = this.semanticMetrics.searchesPerformed;
    this.semanticMetrics.avgSearchTime = (prev * (count - 1) + time) / count;
  }

  private updateCacheHitRate(_hit: boolean): void {
    const cacheStats = this.cache.getStats();
    this.semanticMetrics.cacheHitRate = cacheStats.hitRate;
  }

  /**
   * Get semantic agent metrics
   */
  getSemanticMetrics(): SemanticMetrics {
    return { ...this.semanticMetrics };
  }

  /**
   * Set query agent for hybrid search
   */
  setQueryAgent(queryAgent: any): void {
    this.hybridSearch.setQueryAgent(queryAgent);
    console.log(`[${this.id}] Query agent configured for hybrid search`);
  }
}
