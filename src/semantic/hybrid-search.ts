/**
 * TASK-002: Hybrid Search Engine with Reciprocal Rank Fusion (RRF)
 * 
 * Combines structural and semantic search results using RRF algorithm
 * Optimized for balanced retrieval with configurable weights
 * 
 * Architecture References:
 * - Project Overview: doc/PROJECT_OVERVIEW.md
 * - Coding Standards: doc/CODING_STANDARD.md
 * - Architectural Decisions: doc/ARCHITECTURAL_DECISIONS.md
 * 
 * @task_id TASK-002
 * @history
 *  - 2025-09-14: Created by Dev-Agent - TASK-002: Hybrid search with RRF implementation
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { VectorStore } from './vector-store.js';
import { EmbeddingGenerator } from './embedding-generator.js';
import type { QueryAgent } from '../agents/query-agent.js';
import type { 
  HybridResult, 
  SimilarityResult, 
  FusionOptions,
  SemanticResult
} from '../types/semantic.js';

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_FUSION_OPTIONS: FusionOptions = {
  k: 60, // RRF constant
  structuralWeight: 0.6,
  semanticWeight: 0.4,
  limit: 10
};

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================
interface StructuralResult {
  id: string;
  path: string;
  type: string;
  name: string;
  score?: number;
  content?: string;
}

interface RankedResult {
  id: string;
  score: number;
  structuralRank?: number;
  semanticRank?: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================
function normalizeScores(results: RankedResult[]): RankedResult[] {
  const maxScore = Math.max(...results.map(r => r.score));
  const minScore = Math.min(...results.map(r => r.score));
  const range = maxScore - minScore || 1;
  
  return results.map(r => ({
    ...r,
    score: (r.score - minScore) / range
  }));
}

function deduplicateResults(results: RankedResult[]): RankedResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.id)) {
      return false;
    }
    seen.add(r.id);
    return true;
  });
}

// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================
export class HybridSearchEngine {
  private vectorStore: VectorStore;
  private embeddingGen: EmbeddingGenerator;
  private queryAgent: QueryAgent | null = null;
  private searchMetrics = {
    totalSearches: 0,
    avgSearchTime: 0,
    avgResultCount: 0
  };
  
  constructor(
    vectorStore: VectorStore,
    embeddingGen: EmbeddingGenerator,
    queryAgent?: QueryAgent
  ) {
    this.vectorStore = vectorStore;
    this.embeddingGen = embeddingGen;
    this.queryAgent = queryAgent || null;
  }
  
  /**
   * Set the query agent for structural search
   */
  setQueryAgent(queryAgent: QueryAgent): void {
    this.queryAgent = queryAgent;
  }
  
  /**
   * Perform hybrid search combining structural and semantic results
   */
  async search(
    query: string, 
    options: Partial<FusionOptions> = {}
  ): Promise<HybridResult[]> {
    const startTime = Date.now();
    const fusionOptions = { ...DEFAULT_FUSION_OPTIONS, ...options };
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingGen.generateEmbedding(query);
      
      // Parallel execution of structural and semantic search
      const [structuralResults, semanticResults] = await Promise.all([
        this.performStructuralSearch(query, fusionOptions.limit * 2),
        this.vectorStore.search(queryEmbedding, fusionOptions.limit * 2)
      ]);
      
      console.log(`[HybridSearch] Found ${structuralResults.length} structural and ${semanticResults.length} semantic results`);
      
      // Apply Reciprocal Rank Fusion
      const fusedResults = this.fuseResults(
        structuralResults,
        semanticResults,
        fusionOptions
      );
      
      // Update metrics
      const searchTime = Date.now() - startTime;
      this.updateMetrics(searchTime, fusedResults.length);
      
      console.log(`[HybridSearch] Returned ${fusedResults.length} results in ${searchTime}ms`);
      
      return fusedResults;
    } catch (error) {
      console.error('[HybridSearch] Search failed:', error);
      throw error;
    }
  }
  
  /**
   * Perform structural search using QueryAgent
   */
  private async performStructuralSearch(query: string, limit: number): Promise<StructuralResult[]> {
    if (!this.queryAgent) {
      console.warn('[HybridSearch] QueryAgent not available, skipping structural search');
      return [];
    }
    
    try {
      // Use QueryAgent to search for structural matches
      const task = {
        id: `search-${Date.now()}`,
        type: 'search',
        priority: 5,
        payload: { query, limit },
        createdAt: Date.now()
      };
      
      const results = await this.queryAgent.process(task) as StructuralResult[];
      return results || [];
    } catch (error) {
      console.error('[HybridSearch] Structural search failed:', error);
      return [];
    }
  }
  
  /**
   * Apply Reciprocal Rank Fusion to combine results
   */
  private fuseResults(
    structural: StructuralResult[],
    semantic: SimilarityResult[],
    options: FusionOptions
  ): HybridResult[] {
    const scores = new Map<string, RankedResult>();
    
    // Process structural results with RRF scoring
    structural.forEach((item, rank) => {
      const rrfScore = options.structuralWeight / (options.k + rank + 1);
      
      if (scores.has(item.id)) {
        const existing = scores.get(item.id)!;
        existing.score += rrfScore;
        existing.structuralRank = rank;
      } else {
        scores.set(item.id, {
          id: item.id,
          score: rrfScore,
          structuralRank: rank,
          content: item.content,
          metadata: { path: item.path, type: item.type, name: item.name }
        });
      }
    });
    
    // Process semantic results with RRF scoring
    semantic.forEach((item, rank) => {
      const rrfScore = options.semanticWeight / (options.k + rank + 1);
      
      if (scores.has(item.id)) {
        const existing = scores.get(item.id)!;
        existing.score += rrfScore;
        existing.semanticRank = rank;
        // Merge metadata
        if (item.metadata) {
          existing.metadata = { ...existing.metadata, ...item.metadata };
        }
      } else {
        scores.set(item.id, {
          id: item.id,
          score: rrfScore,
          semanticRank: rank,
          content: item.content,
          metadata: item.metadata
        });
      }
    });
    
    // Sort by combined score and limit
    const rankedResults = Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit);
    
    // Normalize scores and deduplicate
    const normalized = normalizeScores(rankedResults);
    const deduplicated = deduplicateResults(normalized);
    
    // Convert to HybridResult format
    return deduplicated.map(r => ({
      id: r.id,
      score: r.score,
      source: this.determineSource(r),
      content: r.content,
      metadata: r.metadata
    }));
  }
  
  /**
   * Determine the primary source of a result
   */
  private determineSource(result: RankedResult): 'structural' | 'semantic' | 'hybrid' {
    const hasStructural = result.structuralRank !== undefined;
    const hasSemantic = result.semanticRank !== undefined;
    
    if (hasStructural && hasSemantic) {
      return 'hybrid';
    } else if (hasStructural) {
      return 'structural';
    } else {
      return 'semantic';
    }
  }
  
  /**
   * Perform pure semantic search without structural component
   */
  async semanticSearch(query: string, limit = 10): Promise<SemanticResult> {
    const startTime = Date.now();
    
    try {
      const queryEmbedding = await this.embeddingGen.generateEmbedding(query);
      const results = await this.vectorStore.search(queryEmbedding, limit);
      
      const processingTime = Date.now() - startTime;
      
      return {
        query,
        results,
        processingTime
      };
    } catch (error) {
      console.error('[HybridSearch] Semantic search failed:', error);
      throw error;
    }
  }
  
  /**
   * Re-rank results based on custom scoring
   */
  async rerank(
    results: HybridResult[],
    query: string,
    scoreFunction?: (result: HybridResult, query: string) => number
  ): Promise<HybridResult[]> {
    if (!scoreFunction) {
      // Default re-ranking based on query terms
      scoreFunction = (result, q) => {
        const terms = q.toLowerCase().split(/\s+/);
        const content = (result.content || '').toLowerCase();
        
        let score = 0;
        for (const term of terms) {
          if (content.includes(term)) {
            score += 1;
          }
        }
        
        return score / terms.length;
      };
    }
    
    // Calculate new scores
    const reranked = results.map(r => ({
      ...r,
      score: r.score * 0.7 + scoreFunction(r, query) * 0.3
    }));
    
    // Sort by new scores
    return reranked.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Update search metrics
   */
  private updateMetrics(searchTime: number, resultCount: number): void {
    this.searchMetrics.totalSearches++;
    
    const prevAvgTime = this.searchMetrics.avgSearchTime;
    const prevAvgCount = this.searchMetrics.avgResultCount;
    const n = this.searchMetrics.totalSearches;
    
    this.searchMetrics.avgSearchTime = (prevAvgTime * (n - 1) + searchTime) / n;
    this.searchMetrics.avgResultCount = (prevAvgCount * (n - 1) + resultCount) / n;
  }
  
  /**
   * Get search metrics
   */
  getMetrics(): typeof this.searchMetrics {
    return { ...this.searchMetrics };
  }
  
  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.embeddingGen.clearCache();
    console.log('[HybridSearch] Caches cleared');
  }
}