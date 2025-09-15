/**
 * TASK-002: Semantic Agent Implementation
 * 
 * Advanced semantic search and analysis agent with vector embeddings
 * Provides hybrid search, code similarity, and refactoring suggestions
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
 * 
 * @task_id TASK-002
 * @history
 *  - 2025-09-14: Created by Dev-Agent - TASK-002: Main SemanticAgent implementation
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { BaseAgent } from './base.js';
import { AgentType, type AgentTask, type AgentMessage } from '../types/agent.js';
import { knowledgeBus, type KnowledgeEntry } from '../core/knowledge-bus.js';
import { VectorStore } from '../semantic/vector-store.js';
import { EmbeddingGenerator } from '../semantic/embedding-generator.js';
import { HybridSearchEngine } from '../semantic/hybrid-search.js';
import { SemanticCache } from '../semantic/semantic-cache.js';
import { CodeAnalyzer } from '../semantic/code-analyzer.js';
import type { ParsedEntity } from '../types/parser.js';
import type {
  SemanticOperations,
  SemanticResult,
  SimilarCode,
  CloneGroup,
  SemanticAnalysis,
  CrossLangResult,
  RefactoringSuggestion,
  SemanticTaskType,
  SemanticMetrics,
  VectorEmbedding
} from '../types/semantic.js';

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const AGENT_CONFIG = {
  maxConcurrency: 5, // Embedding generation is resource-intensive
  memoryLimit: 240, // MB (96 base + 64 embeddings + 48 vectors + 32 cache)
  priority: 8,
  batchSize: 8, // Optimal for 4-core CPU
  vectorDbPath: './vectors.db',
  modelPath: './models'
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
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================
function isSemanticTask(task: AgentTask): boolean {
  const payload = task.payload as SemanticTaskPayload;
  return Object.values(SemanticTaskType).includes(payload.type as SemanticTaskType);
}

// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================
export class SemanticAgent extends BaseAgent implements SemanticOperations {
  private vectorStore: VectorStore;
  private embeddingGen: EmbeddingGenerator;
  private hybridSearch: HybridSearchEngine;
  private cache: SemanticCache;
  private codeAnalyzer: CodeAnalyzer;
  
  private metrics: SemanticMetrics = {
    embeddingsGenerated: 0,
    searchesPerformed: 0,
    avgEmbeddingTime: 0,
    avgSearchTime: 0,
    cacheHitRate: 0,
    vectorsStored: 0
  };
  
  constructor() {
    super(AgentType.SEMANTIC, {
      maxConcurrency: AGENT_CONFIG.maxConcurrency,
      memoryLimit: AGENT_CONFIG.memoryLimit,
      priority: AGENT_CONFIG.priority
    });
    
    // Initialize components
    this.vectorStore = new VectorStore({
      dbPath: AGENT_CONFIG.vectorDbPath
    });
    
    this.embeddingGen = new EmbeddingGenerator({
      batchSize: AGENT_CONFIG.batchSize,
      localPath: AGENT_CONFIG.modelPath
    });
    
    this.cache = new SemanticCache({
      maxSize: 5000,
      ttl: 3600000 // 1 hour
    });
    
    this.hybridSearch = new HybridSearchEngine(
      this.vectorStore,
      this.embeddingGen
    );
    
    this.codeAnalyzer = new CodeAnalyzer(
      this.vectorStore,
      this.embeddingGen,
      this.cache
    );
  }
  
  /**
   * Initialize the semantic agent
   */
  protected async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing semantic components...`);
    
    // Initialize all components
    await this.vectorStore.initialize();
    await this.embeddingGen.initialize();
    
    // Subscribe to knowledge bus events
    this.subscribeToKnowledgeBus();
    
    // Update initial metrics
    this.metrics.vectorsStored = await this.vectorStore.count();
    
    console.log(`[${this.id}] Semantic agent initialized with ${this.metrics.vectorsStored} vectors`);
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
    return isSemanticTask(task);
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
      case 'index:complete':
        await this.handleNewEntities(message.payload as ParsedEntity[]);
        break;
        
      case 'search:request':
        await this.handleSearchRequest(message);
        break;
        
      default:
        console.log(`[${this.id}] Unknown message type: ${message.type}`);
    }
  }
  
  // Task handlers
  
  private async handleEmbedTask(payload: SemanticTaskPayload): Promise<Float32Array> {
    const startTime = Date.now();
    
    const embedding = await this.generateCodeEmbedding(payload.code || '');
    
    this.metrics.embeddingsGenerated++;
    this.updateEmbeddingTime(Date.now() - startTime);
    
    return embedding;
  }
  
  private async handleSearchTask(payload: SemanticTaskPayload): Promise<SemanticResult> {
    const startTime = Date.now();
    
    const result = await this.semanticSearch(
      payload.query || '',
      payload.limit
    );
    
    this.metrics.searchesPerformed++;
    this.updateSearchTime(Date.now() - startTime);
    
    return result;
  }
  
  private async handleAnalyzeTask(payload: SemanticTaskPayload): Promise<SemanticAnalysis> {
    return this.analyzeCodeSemantics(payload.code || '');
  }
  
  private async handleCloneDetectionTask(payload: SemanticTaskPayload): Promise<CloneGroup[]> {
    return this.detectClones(payload.threshold);
  }
  
  private async handleRefactorTask(payload: SemanticTaskPayload): Promise<RefactoringSuggestion[]> {
    return this.suggestRefactoring(payload.code || '');
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
    
    // Perform semantic search
    const result = await this.hybridSearch.semanticSearch(query, limit);
    
    // Cache the result
    this.cache.set(cacheKey, result, 600000); // 10 minutes TTL
    
    return result;
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
    return this.codeAnalyzer.generateCodeEmbedding(code);
  }
  
  async crossLanguageSearch(query: string, languages: string[]): Promise<CrossLangResult[]> {
    return this.codeAnalyzer.crossLanguageSearch(query, languages);
  }
  
  async suggestRefactoring(code: string): Promise<RefactoringSuggestion[]> {
    return this.codeAnalyzer.suggestRefactoring(code);
  }
  
  // Knowledge Bus integration
  
  private subscribeToKnowledgeBus(): void {
    // Subscribe to indexing completion events
    knowledgeBus.subscribe(
      this.id,
      'index:complete',
      this.handleIndexComplete.bind(this)
    );
    
    // Subscribe to entity updates
    knowledgeBus.subscribe(
      this.id,
      /^entity:.*/,
      this.handleEntityUpdate.bind(this)
    );
    
    console.log(`[${this.id}] Subscribed to knowledge bus events`);
  }
  
  private async handleIndexComplete(entry: KnowledgeEntry): Promise<void> {
    const entities = entry.data as ParsedEntity[];
    await this.handleNewEntities(entities);
  }
  
  private async handleEntityUpdate(entry: KnowledgeEntry): Promise<void> {
    const entity = entry.data as ParsedEntity;
    
    // Generate embedding for the updated entity
    const text = `${entity.name} ${entity.type} ${entity.signature || ''}`;
    const embedding = await this.embeddingGen.generateEmbedding(text);
    
    // Update vector store
    await this.vectorStore.update(entity.id, embedding, {
      path: entity.path,
      type: entity.type,
      name: entity.name
    });
    
    console.log(`[${this.id}] Updated embedding for entity: ${entity.id}`);
  }
  
  private async handleNewEntities(entities: ParsedEntity[]): Promise<void> {
    console.log(`[${this.id}] Processing ${entities.length} new entities for embedding`);
    
    // Prepare texts for embedding
    const texts = entities.map(e => 
      `${e.name} ${e.type} ${e.signature || ''}`
    );
    
    // Generate embeddings in batch
    const embeddings = await this.embeddingGen.generateBatch(texts);
    
    // Create vector embeddings
    const vectorEmbeddings: VectorEmbedding[] = entities.map((entity, i) => ({
      id: entity.id,
      content: texts[i],
      vector: embeddings[i],
      metadata: {
        path: entity.path,
        type: entity.type,
        name: entity.name,
        language: entity.language
      },
      createdAt: Date.now()
    }));
    
    // Store in vector database
    await this.vectorStore.insertBatch(vectorEmbeddings);
    
    // Update metrics
    this.metrics.embeddingsGenerated += embeddings.length;
    this.metrics.vectorsStored = await this.vectorStore.count();
    
    // Publish completion event
    knowledgeBus.publish(
      'semantic:embeddings:complete',
      { count: embeddings.length },
      this.id
    );
    
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
      type: 'search:response',
      payload: results,
      timestamp: Date.now(),
      correlationId: message.id
    });
  }
  
  // Metrics helpers
  
  private updateEmbeddingTime(time: number): void {
    const prev = this.metrics.avgEmbeddingTime;
    const count = this.metrics.embeddingsGenerated;
    this.metrics.avgEmbeddingTime = (prev * (count - 1) + time) / count;
  }
  
  private updateSearchTime(time: number): void {
    const prev = this.metrics.avgSearchTime;
    const count = this.metrics.searchesPerformed;
    this.metrics.avgSearchTime = (prev * (count - 1) + time) / count;
  }
  
  private updateCacheHitRate(hit: boolean): void {
    const cacheStats = this.cache.getStats();
    this.metrics.cacheHitRate = cacheStats.hitRate;
  }
  
  /**
   * Get semantic agent metrics
   */
  getSemanticMetrics(): SemanticMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Set query agent for hybrid search
   */
  setQueryAgent(queryAgent: any): void {
    this.hybridSearch.setQueryAgent(queryAgent);
    console.log(`[${this.id}] Query agent configured for hybrid search`);
  }
}