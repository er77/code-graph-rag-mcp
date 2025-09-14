# Vector Store Architecture for Semantic Search

## Architecture Placement

The vector store component enables semantic search capabilities within the MCP Server Codegraph, working alongside the structural SQLite database to provide comprehensive code understanding. It transforms code entities into high-dimensional embeddings for similarity-based queries and contextual code analysis.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Code Entities │ -> │  Embedding      │ -> │  Vector Store   │
│   (Text/AST)    │    │  Generation     │    │  (FAISS/Chroma) │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  SQLite Graph   │ <->│ Hybrid Search   │ <->│ Semantic Query  │
│  (Structural)   │    │  Coordinator    │    │   Interface     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Usage Guidelines

### Embedding Strategy for Code
Code embeddings require specialized approaches to capture both syntactic and semantic meaning:

```typescript
export interface CodeEmbeddingStrategy {
  // Entity representation for embedding
  entityToText(entity: Entity): string;
  
  // Context-aware embedding with surrounding code
  entityWithContext(entity: Entity, context: CodeContext): string;
  
  // Multi-level embeddings (function, class, file)
  multiLevelEmbedding(entity: Entity): MultiLevelEmbedding;
}

export class CodeEntityEmbedder implements CodeEmbeddingStrategy {
  entityToText(entity: Entity): string {
    // Combine signature, documentation, and key structural elements
    const parts = [
      `${entity.type}: ${entity.name}`,
      entity.signature || '',
      entity.documentation || '',
      entity.comments?.join(' ') || ''
    ].filter(Boolean);
    
    return parts.join('\n');
  }

  entityWithContext(entity: Entity, context: CodeContext): string {
    const entityText = this.entityToText(entity);
    const contextualInfo = [
      `File: ${context.filePath}`,
      `Module: ${context.moduleName}`,
      `Dependencies: ${context.dependencies.join(', ')}`,
      `Called by: ${context.callers.slice(0, 3).join(', ')}`,
      `Calls: ${context.callees.slice(0, 3).join(', ')}`
    ].join('\n');
    
    return `${entityText}\n\nContext:\n${contextualInfo}`;
  }
}
```

### Vector Store Selection
Choose vector store based on deployment constraints and performance requirements:

```typescript
export abstract class VectorStore {
  abstract addEmbeddings(embeddings: Embedding[]): Promise<void>;
  abstract search(query: number[], topK: number): Promise<SearchResult[]>;
  abstract delete(ids: string[]): Promise<void>;
  abstract getStats(): Promise<VectorStoreStats>;
}

// Local deployment - FAISS
export class FAISSVectorStore extends VectorStore {
  constructor(
    private dimension: number = 384,    // all-MiniLM-L6-v2 dimension
    private indexType: 'Flat' | 'IVF' = 'Flat'
  ) {
    super();
    this.initializeIndex();
  }
}

// Cloud deployment - ChromaDB
export class ChromaVectorStore extends VectorStore {
  constructor(private client: ChromaApi) {
    super();
  }
}

// Embedded SQLite with vector extension
export class SQLiteVectorStore extends VectorStore {
  constructor(private db: Database) {
    super();
    // Uses sqlite-vec or similar extension
  }
}
```

## Coding Recommendations

### Embedding Pipeline Implementation
```typescript
export class EmbeddingPipeline {
  constructor(
    private embeddingModel: EmbeddingModel,
    private vectorStore: VectorStore,
    private batchSize: number = 100
  ) {}

  async processEntities(entities: Entity[]): Promise<void> {
    // Process in batches to manage memory
    for (let i = 0; i < entities.length; i += this.batchSize) {
      const batch = entities.slice(i, i + this.batchSize);
      await this.processBatch(batch);
      
      // Yield control to prevent blocking
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  private async processBatch(entities: Entity[]): Promise<void> {
    // Prepare text representations
    const textRepresentations = await Promise.all(
      entities.map(async entity => ({
        id: entity.id,
        text: await this.entityToEmbeddingText(entity),
        metadata: this.extractMetadata(entity)
      }))
    );

    // Generate embeddings
    const embeddings = await this.embeddingModel.embed(
      textRepresentations.map(r => r.text)
    );

    // Store in vector database
    const vectorEntries = embeddings.map((embedding, index) => ({
      id: textRepresentations[index].id,
      vector: embedding,
      metadata: textRepresentations[index].metadata
    }));

    await this.vectorStore.addEmbeddings(vectorEntries);
  }

  private async entityToEmbeddingText(entity: Entity): Promise<string> {
    // Get rich context for better embeddings
    const context = await this.getEntityContext(entity);
    return this.embeddingStrategy.entityWithContext(entity, context);
  }
}
```

### Hybrid Search Implementation
```typescript
export class HybridSearchEngine {
  constructor(
    private vectorStore: VectorStore,
    private graphDatabase: GraphDatabase,
    private embeddingModel: EmbeddingModel
  ) {}

  async search(query: SearchQuery): Promise<HybridSearchResult[]> {
    // Parallel execution of structural and semantic search
    const [structuralResults, semanticResults] = await Promise.all([
      this.structuralSearch(query),
      this.semanticSearch(query)
    ]);

    // Merge and rank results using hybrid scoring
    return this.mergeResults(structuralResults, semanticResults, query);
  }

  private async semanticSearch(query: SearchQuery): Promise<SemanticResult[]> {
    // Convert query to embedding
    const queryEmbedding = await this.embeddingModel.embed([query.text]);
    
    // Search vector store
    const vectorResults = await this.vectorStore.search(
      queryEmbedding[0], 
      query.limit * 2  // Get more candidates for reranking
    );

    // Enrich with metadata from graph database
    return await Promise.all(
      vectorResults.map(async result => ({
        ...result,
        entity: await this.graphDatabase.getEntity(result.id),
        semanticScore: result.score
      }))
    );
  }

  private mergeResults(
    structural: StructuralResult[], 
    semantic: SemanticResult[], 
    query: SearchQuery
  ): HybridSearchResult[] {
    // Create unified result set
    const resultMap = new Map<string, HybridSearchResult>();
    
    // Add structural results
    for (const result of structural) {
      resultMap.set(result.entity.id, {
        entity: result.entity,
        structuralScore: result.score,
        semanticScore: 0,
        hybridScore: result.score * 0.7  // Weight structural results
      });
    }

    // Add or enhance with semantic results
    for (const result of semantic) {
      const existing = resultMap.get(result.entity.id);
      if (existing) {
        existing.semanticScore = result.semanticScore;
        existing.hybridScore = this.calculateHybridScore(
          existing.structuralScore,
          result.semanticScore
        );
      } else {
        resultMap.set(result.entity.id, {
          entity: result.entity,
          structuralScore: 0,
          semanticScore: result.semanticScore,
          hybridScore: result.semanticScore * 0.6  // Lower weight for semantic-only
        });
      }
    }

    // Sort by hybrid score and return top results
    return Array.from(resultMap.values())
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, query.limit);
  }

  private calculateHybridScore(structural: number, semantic: number): number {
    // Weighted combination with boost for matches in both
    const baseScore = structural * 0.6 + semantic * 0.4;
    const boostFactor = structural > 0 && semantic > 0 ? 1.2 : 1.0;
    return baseScore * boostFactor;
  }
}
```

### Incremental Updates for Vector Store
```typescript
export class IncrementalVectorUpdater {
  constructor(
    private vectorStore: VectorStore,
    private embeddingPipeline: EmbeddingPipeline
  ) {}

  async updateEntityEmbedding(entity: Entity): Promise<void> {
    try {
      // Remove old embedding if exists
      await this.vectorStore.delete([entity.id]);
      
      // Generate and store new embedding
      await this.embeddingPipeline.processEntities([entity]);
      
    } catch (error) {
      console.error(`Failed to update embedding for entity ${entity.id}:`, error);
      // Continue processing other entities
    }
  }

  async bulkUpdateEntities(entities: Entity[]): Promise<void> {
    // Group by file for efficient processing
    const fileGroups = this.groupEntitiesByFile(entities);
    
    for (const [filePath, fileEntities] of fileGroups) {
      try {
        // Remove all old embeddings for this file
        const entityIds = fileEntities.map(e => e.id);
        await this.vectorStore.delete(entityIds);
        
        // Re-embed all entities in the file (for consistency)
        await this.embeddingPipeline.processEntities(fileEntities);
        
      } catch (error) {
        console.error(`Failed to update embeddings for file ${filePath}:`, error);
      }
    }
  }
}
```

## Performance Considerations

### Commodity Hardware Optimizations

#### Memory-Efficient Embedding Generation
```typescript
export class MemoryEfficientEmbedder {
  private embeddingQueue: EmbeddingTask[] = [];
  private readonly maxBatchSize = 50;  // Adjust based on available RAM
  private readonly maxConcurrentBatches = 2;

  async queueEmbedding(entity: Entity): Promise<void> {
    this.embeddingQueue.push({ entity, promise: null });
    
    if (this.embeddingQueue.length >= this.maxBatchSize) {
      await this.processBatch();
    }
  }

  private async processBatch(): Promise<void> {
    const batch = this.embeddingQueue.splice(0, this.maxBatchSize);
    if (batch.length === 0) return;

    try {
      // Monitor memory usage
      const initialMemory = process.memoryUsage().heapUsed;
      
      const texts = batch.map(task => this.entityToText(task.entity));
      const embeddings = await this.embeddingModel.embed(texts);
      
      // Store embeddings
      await this.storeEmbeddings(batch, embeddings);
      
      // Memory monitoring
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsed = finalMemory - initialMemory;
      
      if (memoryUsed > 100 * 1024 * 1024) { // 100MB threshold
        console.warn(`High memory usage in embedding batch: ${memoryUsed / 1024 / 1024}MB`);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
    } catch (error) {
      console.error('Embedding batch failed:', error);
      // Handle batch failure without losing all progress
    }
  }
}
```

#### Efficient Vector Store Operations
```typescript
export class OptimizedFAISS {
  private index: faiss.Index;
  private metadata: Map<number, EntityMetadata> = new Map();
  private readonly dimension: number;

  constructor(dimension: number = 384) {
    this.dimension = dimension;
    // Use IndexFlatIP for commodity hardware (inner product similarity)
    this.index = new faiss.IndexFlatIP(dimension);
  }

  async addEmbeddings(embeddings: Embedding[]): Promise<void> {
    const vectors = new Float32Array(embeddings.length * this.dimension);
    
    // Pack vectors efficiently
    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      const offset = i * this.dimension;
      
      for (let j = 0; j < this.dimension; j++) {
        vectors[offset + j] = embedding.vector[j];
      }
      
      // Store metadata separately
      this.metadata.set(this.index.ntotal + i, embedding.metadata);
    }

    // Batch add to FAISS index
    this.index.add(vectors);
  }

  async search(queryVector: number[], topK: number): Promise<SearchResult[]> {
    const query = new Float32Array(queryVector);
    const { scores, labels } = this.index.search(query, topK);
    
    const results: SearchResult[] = [];
    for (let i = 0; i < topK && i < labels.length; i++) {
      const label = labels[i];
      const metadata = this.metadata.get(label);
      
      if (metadata) {
        results.push({
          id: metadata.entityId,
          score: scores[i],
          metadata
        });
      }
    }
    
    return results;
  }
}
```

#### Caching and Persistence
```typescript
export class VectorStoreCache {
  private embeddingCache = new Map<string, CachedEmbedding>();
  private readonly maxCacheSize = 10000;  // Adjust based on available memory

  async getCachedEmbedding(entityId: string, contentHash: string): Promise<number[] | null> {
    const cached = this.embeddingCache.get(entityId);
    
    if (cached && cached.contentHash === contentHash) {
      // Update access time for LRU eviction
      cached.lastAccessed = Date.now();
      return cached.embedding;
    }
    
    return null;
  }

  cacheEmbedding(entityId: string, contentHash: string, embedding: number[]): void {
    // Implement LRU eviction
    if (this.embeddingCache.size >= this.maxCacheSize) {
      this.evictOldestEntries();
    }
    
    this.embeddingCache.set(entityId, {
      embedding,
      contentHash,
      lastAccessed: Date.now(),
      createdAt: Date.now()
    });
  }

  private evictOldestEntries(): void {
    const entries = Array.from(this.embeddingCache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove oldest 20%
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.embeddingCache.delete(entries[i][0]);
    }
  }
}
```

### Performance Targets
- **Embedding Generation**: >50 entities/second on 4-core CPU
- **Vector Search**: <100ms for queries returning 20 results
- **Memory Usage**: <512MB for vector store with 10k entities
- **Storage**: <1MB per 1000 entity embeddings

## Integration Patterns

### With Graph Database
```typescript
export class GraphVectorIntegration {
  async enhancedEntitySearch(query: string, filters: EntityFilter): Promise<Entity[]> {
    // First filter structurally using SQLite
    const structuralCandidates = await this.graphDb.getEntitiesWithFilters(filters);
    
    if (structuralCandidates.length <= 100) {
      // Small result set - use hybrid search
      return await this.hybridSearch.search({
        text: query,
        candidates: structuralCandidates,
        limit: filters.limit
      });
    } else {
      // Large result set - use vector search first, then validate structure
      const semanticResults = await this.vectorStore.search(
        await this.embeddingModel.embed([query]),
        filters.limit * 3
      );
      
      // Filter semantic results against structural constraints
      return await this.validateStructuralConstraints(semanticResults, filters);
    }
  }
}
```

### With MCP Tools
```typescript
export class SemanticMCPTools {
  async semanticEntitySearch(args: SemanticSearchArgs): Promise<ToolResponse> {
    const { query, entity_types, similarity_threshold = 0.7 } = args;
    
    try {
      // Combine semantic and structural search
      const results = await this.hybridSearch.search({
        text: query,
        entityTypes: entity_types,
        minSimilarity: similarity_threshold,
        limit: 50
      });

      // Format for LLM consumption
      const formattedResults = results.map(result => ({
        entity: {
          name: result.entity.name,
          type: result.entity.type,
          file: result.entity.file,
          location: `${result.entity.startLine}-${result.entity.endLine}`
        },
        relevance: {
          semantic_score: result.semanticScore,
          structural_score: result.structuralScore,
          hybrid_score: result.hybridScore
        },
        context: this.generateContextSummary(result.entity)
      }));

      return {
        content: [{ 
          type: "text", 
          text: this.formatSemanticSearchResults(formattedResults) 
        }]
      };

    } catch (error) {
      return this.createErrorResponse(`Semantic search failed: ${error.message}`);
    }
  }

  private formatSemanticSearchResults(results: SemanticSearchResult[]): string {
    if (results.length === 0) {
      return "No semantically similar entities found for the given query.";
    }

    const sections = results.map((result, index) => {
      const relevanceScore = Math.round(result.relevance.hybrid_score * 100);
      return `${index + 1}. ${result.entity.name} (${result.entity.type}) - ${relevanceScore}% match
   File: ${result.entity.file}:${result.entity.location}
   Context: ${result.context}`;
    });

    return `Found ${results.length} semantically relevant entities:\n\n${sections.join('\n\n')}`;
  }
}
```

### With LiteRAG Architecture
```typescript
export class SemanticCodeAgent {
  constructor(
    private vectorStore: VectorStore,
    private graphDatabase: GraphDatabase,
    private embeddingModel: EmbeddingModel
  ) {}

  async analyzeCodeSimilarity(targetEntity: Entity): Promise<CodeSimilarityAnalysis> {
    // Generate embedding for target entity
    const targetEmbedding = await this.generateEntityEmbedding(targetEntity);
    
    // Find similar entities
    const similarEntities = await this.vectorStore.search(targetEmbedding, 20);
    
    // Analyze similarity patterns
    const patterns = await this.analyzeSimilarityPatterns(similarEntities);
    
    // Generate insights
    return {
      targetEntity,
      similarEntities: similarEntities.slice(0, 10),
      patterns,
      recommendations: this.generateRecommendations(patterns)
    };
  }

  private async analyzeSimilarityPatterns(entities: SearchResult[]): Promise<SimilarityPattern[]> {
    // Group by similarity type
    const patterns: SimilarityPattern[] = [];
    
    // Analyze by entity type
    const typeGroups = this.groupByType(entities);
    for (const [type, group] of typeGroups) {
      if (group.length >= 3) {
        patterns.push({
          type: 'entity_type',
          value: type,
          entities: group,
          strength: this.calculatePatternStrength(group)
        });
      }
    }

    // Analyze by file patterns
    const filePatterns = this.analyzeFilePatterns(entities);
    patterns.push(...filePatterns);

    return patterns;
  }
}
```

## Configuration Options

### Vector Store Configuration
```typescript
interface VectorStoreConfig {
  // Model configuration
  embeddingModel: 'all-MiniLM-L6-v2' | 'all-mpnet-base-v2' | 'code-search-net';
  embeddingDimension: number;
  
  // Storage configuration
  backend: 'faiss' | 'chroma' | 'sqlite-vec';
  persistencePath: string;
  
  // Performance configuration
  batchSize: number;
  maxCacheSize: number;
  indexType: 'flat' | 'ivf' | 'hnsw';
  
  // Search configuration
  defaultTopK: number;
  similarityThreshold: number;
  hybridWeights: {
    structural: number;
    semantic: number;
  };
}

// Environment-based configuration
const vectorConfig: VectorStoreConfig = {
  embeddingModel: (process.env.CODEGRAPH_EMBEDDING_MODEL as any) || 'all-MiniLM-L6-v2',
  embeddingDimension: parseInt(process.env.CODEGRAPH_EMBEDDING_DIM || '384'),
  backend: (process.env.CODEGRAPH_VECTOR_BACKEND as any) || 'faiss',
  persistencePath: process.env.CODEGRAPH_VECTOR_PATH || './vectors',
  batchSize: parseInt(process.env.CODEGRAPH_VECTOR_BATCH_SIZE || '100'),
  maxCacheSize: parseInt(process.env.CODEGRAPH_VECTOR_CACHE_SIZE || '10000'),
  indexType: (process.env.CODEGRAPH_VECTOR_INDEX as any) || 'flat',
  defaultTopK: parseInt(process.env.CODEGRAPH_VECTOR_TOP_K || '20'),
  similarityThreshold: parseFloat(process.env.CODEGRAPH_SIMILARITY_THRESHOLD || '0.7'),
  hybridWeights: {
    structural: parseFloat(process.env.CODEGRAPH_STRUCTURAL_WEIGHT || '0.6'),
    semantic: parseFloat(process.env.CODEGRAPH_SEMANTIC_WEIGHT || '0.4')
  }
};
```

## Monitoring and Diagnostics

### Vector Store Health Monitoring
```typescript
export class VectorStoreMonitor {
  async getVectorStoreStats(): Promise<VectorStoreStats> {
    const [vectorStats, embeddingStats, searchStats] = await Promise.all([
      this.getVectorStats(),
      this.getEmbeddingStats(),
      this.getSearchStats()
    ]);

    return {
      vectors: vectorStats,
      embeddings: embeddingStats,
      search: searchStats,
      timestamp: new Date()
    };
  }

  private async getVectorStats(): Promise<VectorStats> {
    return {
      totalVectors: await this.vectorStore.count(),
      dimension: this.vectorStore.getDimension(),
      indexType: this.vectorStore.getIndexType(),
      memoryUsageMB: await this.vectorStore.getMemoryUsage() / 1024 / 1024
    };
  }

  async performHealthCheck(): Promise<VectorHealthReport> {
    const startTime = Date.now();
    
    try {
      // Test embedding generation
      const testEmbedding = await this.embeddingModel.embed(['test query']);
      
      // Test vector search
      const searchResults = await this.vectorStore.search(testEmbedding[0], 5);
      
      // Test cache performance
      const cacheHitRate = this.embeddingCache.getHitRate();
      
      return {
        status: 'healthy',
        responseTimeMs: Date.now() - startTime,
        embeddingGeneration: testEmbedding.length > 0,
        vectorSearch: searchResults.length >= 0,
        cacheHitRate,
        lastHealthCheck: new Date()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTimeMs: Date.now() - startTime,
        error: error.message,
        lastHealthCheck: new Date()
      };
    }
  }
}
```

## Future Enhancements

### Advanced Embedding Strategies
- **Code-specific embeddings**: Train on code-specific datasets (CodeBERT, GraphCodeBERT)
- **Multi-modal embeddings**: Combine code structure, documentation, and usage patterns
- **Dynamic embeddings**: Update embeddings based on code evolution and usage patterns

### Scalability Improvements
- **Distributed vector search**: Shard vectors across multiple nodes
- **Hierarchical embeddings**: Multi-level embeddings (file, class, function)
- **Approximation algorithms**: Use LSH or other approximation techniques for very large codebases

### Enhanced Semantic Features
- **Code clone detection**: Find semantically similar code blocks
- **API usage analysis**: Semantic search for API usage patterns
- **Documentation generation**: Use semantic understanding for automated documentation