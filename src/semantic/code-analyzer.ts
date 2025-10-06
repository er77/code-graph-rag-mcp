/**
 * TASK-002: Semantic Code Analyzer
 *
 * Analyzes code semantics for similarity detection, clone detection, and refactoring suggestions
 * Provides advanced code understanding capabilities beyond structural analysis
 *
 * Architecture References:
 * - Project Overview: doc/PROJECT_OVERVIEW.md
 * - Coding Standards: doc/CODING_STANDARD.md
 * - Architectural Decisions: doc/ARCHITECTURAL_DECISIONS.md
 *
 * @task_id TASK-002
 * @history
 *  - 2025-09-14: Created by Dev-Agent - TASK-002: Semantic code analysis implementation
 */

import type {
  CloneGroup,
  CrossLangResult,
  RefactoringSuggestion,
  SemanticAnalysis,
  SimilarCode,
} from "../types/semantic.js";
import type { EmbeddingGenerator } from "./embedding-generator.js";
import type { SemanticCache } from "./semantic-cache.js";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type { VectorStore } from "./vector-store.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const CLONE_TYPE_THRESHOLDS = {
  type1: 0.95, // Exact clones
  type2: 0.85, // Renamed clones
  type3: 0.75, // Gapped clones
  type4: 0.65, // Semantic clones
};

const COMPLEXITY_WEIGHTS = {
  lines: 0.1,
  branches: 0.3,
  loops: 0.2,
  functions: 0.2,
  classes: 0.2,
};

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================
interface CodeMetrics {
  lines: number;
  branches: number;
  loops: number;
  functions: number;
  classes: number;
  complexity: number;
}

interface CodePattern {
  pattern: string;
  type: "antipattern" | "smell" | "improvement";
  description: string;
  suggestion: string;
}

// =============================================================================
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================
function extractCodeMetrics(code: string): CodeMetrics {
  const lines = code.split("\n").length;
  const branches = (code.match(/if\s*\(|else\s*{|switch\s*\(|case\s+/g) || []).length;
  const loops = (code.match(/for\s*\(|while\s*\(|do\s*{/g) || []).length;
  const functions = (code.match(/function\s+\w+|=>\s*{|async\s+function/g) || []).length;
  const classes = (code.match(/class\s+\w+/g) || []).length;

  const complexity =
    lines * COMPLEXITY_WEIGHTS.lines +
    branches * COMPLEXITY_WEIGHTS.branches +
    loops * COMPLEXITY_WEIGHTS.loops +
    functions * COMPLEXITY_WEIGHTS.functions +
    classes * COMPLEXITY_WEIGHTS.classes;

  return { lines, branches, loops, functions, classes, complexity };
}

function determineSemanticType(code: string): SemanticAnalysis["semanticType"] {
  const lowerCode = code.toLowerCase();

  if (lowerCode.includes("test") || lowerCode.includes("spec")) {
    return "test";
  } else if (lowerCode.includes("class")) {
    return "class";
  } else if (lowerCode.includes("function") || lowerCode.includes("=>")) {
    return "function";
  } else if (lowerCode.includes("export") || lowerCode.includes("module")) {
    return "module";
  } else {
    return "utility";
  }
}

function extractEntities(code: string): string[] {
  const entities: string[] = [];

  // Extract function names
  const funcMatches = code.match(/function\s+(\w+)/g) || [];
  entities.push(...funcMatches.map((m) => m.replace("function ", "")));

  // Extract class names
  const classMatches = code.match(/class\s+(\w+)/g) || [];
  entities.push(...classMatches.map((m) => m.replace("class ", "")));

  // Extract variable names
  const varMatches = code.match(/(?:const|let|var)\s+(\w+)/g) || [];
  entities.push(...varMatches.map((m) => m.replace(/(?:const|let|var)\s+/, "")));

  return [...new Set(entities)]; // Remove duplicates
}

// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================
export class CodeAnalyzer {
  private vectorStore: VectorStore;
  private embeddingGen: EmbeddingGenerator;
  private cache: SemanticCache;
  private patterns: CodePattern[] = [];

  constructor(vectorStore: VectorStore, embeddingGen: EmbeddingGenerator, cache: SemanticCache) {
    this.vectorStore = vectorStore;
    this.embeddingGen = embeddingGen;
    this.cache = cache;
    this.initializePatterns();
  }

  /**
   * Initialize code patterns for analysis
   */
  private initializePatterns(): void {
    this.patterns = [
      {
        pattern: "nested_loops",
        type: "smell",
        description: "Deeply nested loops detected",
        suggestion: "Consider extracting inner loops into separate functions",
      },
      {
        pattern: "long_function",
        type: "smell",
        description: "Function exceeds recommended length",
        suggestion: "Break down into smaller, focused functions",
      },
      {
        pattern: "duplicate_logic",
        type: "antipattern",
        description: "Similar logic appears multiple times",
        suggestion: "Extract common logic into a reusable function",
      },
      {
        pattern: "complex_condition",
        type: "smell",
        description: "Complex conditional expression",
        suggestion: "Extract condition into a well-named variable or function",
      },
    ];
  }

  /**
   * Analyze code semantics
   */
  async analyzeCodeSemantics(code: string): Promise<SemanticAnalysis> {
    // Check cache first
    const cacheKey = `analysis:${code.slice(0, 100)}`;
    const cached = this.cache.get<SemanticAnalysis>(cacheKey);
    if (cached) {
      return cached;
    }

    // Extract metrics and entities
    const metrics = extractCodeMetrics(code);
    const entities = extractEntities(code);
    const semanticType = determineSemanticType(code);

    // Extract concepts using simple heuristics
    const concepts = this.extractConcepts(code);

    // Generate summary
    const summary = this.generateSummary(code, entities, semanticType);

    const analysis: SemanticAnalysis = {
      entities,
      concepts,
      complexity: metrics.complexity,
      semanticType,
      summary,
    };

    // Cache the result
    this.cache.set(cacheKey, analysis, 3600000); // 1 hour TTL

    return analysis;
  }

  /**
   * Find similar code snippets
   */
  async findSimilarCode(code: string, threshold = 0.5): Promise<SimilarCode[]> {
    // Generate embedding for the code
    const embedding = await this.embeddingGen.generateCodeEmbedding(code);

    // Search for similar vectors
    const results = await this.vectorStore.search(embedding, 20);

    // Filter by threshold and map to SimilarCode format
    const similarCode: SimilarCode[] = results
      .filter((r) => r.similarity >= threshold)
      .map((r) => ({
        id: r.id,
        path: (r.metadata?.path as string) || "",
        content: r.content,
        similarity: r.similarity,
        type: this.determineSimilarityType(r.similarity),
      }));

    return similarCode;
  }

  /**
   * Detect code clones in the codebase
   */
  async detectClones(minSimilarity = 0.65): Promise<CloneGroup[]> {
    // Get total count
    const totalCount = await this.vectorStore.count();

    if (totalCount === 0) {
      return [];
    }

    // Limit clone detection to avoid performance issues on large codebases
    const maxSamples = Math.min(100, totalCount);
    const cloneGroupMap: Map<string, Set<string>> = new Map();
    const processedPairs: Set<string> = new Set();

    console.log(`[CodeAnalyzer] Analyzing ${maxSamples} code fragments for clones (threshold: ${minSimilarity})`);

    // Sample vectors by getting random entities
    // We'll use a simple approach: search with random small vectors to get diverse samples
    const sampleVectors: Array<{ id: string; vector: Float32Array; content: string; metadata: any }> = [];

    // Get sample embeddings using multiple random searches
    for (let i = 0; i < Math.min(5, Math.ceil(maxSamples / 20)); i++) {
      const randomVector = new Float32Array(384).map(() => Math.random() - 0.5);
      const results = await this.vectorStore.search(randomVector, 20);

      for (const result of results) {
        if (sampleVectors.length >= maxSamples) break;
        if (!sampleVectors.some(v => v.id === result.id)) {
          // Reconstruct vector by doing another search with this result as query
          const entity = await this.vectorStore.get(result.id);
          if (entity) {
            sampleVectors.push({
              id: result.id,
              vector: entity.vector,
              content: result.content,
              metadata: result.metadata
            });
          }
        }
      }
    }

    // For each sample, find similar code
    for (const sample of sampleVectors) {
      const similar = await this.vectorStore.search(sample.vector, 50);

      for (const match of similar) {
        // Skip self-matches
        if (match.id === sample.id) continue;

        // Only process if similarity meets threshold
        if (match.similarity < minSimilarity) continue;

        // Create unique pair key (sorted to avoid duplicates)
        const pairKey = [sample.id, match.id].sort().join('|');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        // Find or create clone group
        let groupId: string | null = null;
        for (const [gid, members] of cloneGroupMap) {
          if (members.has(sample.id) || members.has(match.id)) {
            groupId = gid;
            members.add(sample.id);
            members.add(match.id);
            break;
          }
        }

        if (!groupId) {
          groupId = `clone-${cloneGroupMap.size + 1}`;
          cloneGroupMap.set(groupId, new Set([sample.id, match.id]));
        }
      }
    }

    // Convert to CloneGroup format
    const cloneGroups: CloneGroup[] = [];
    for (const [groupId, memberIds] of cloneGroupMap) {
      if (memberIds.size < 2) continue; // Skip groups with single member

      const members = Array.from(memberIds);
      const clones = await Promise.all(
        members.map(async (id) => {
          const embedding = await this.vectorStore.get(id);
          return {
            id,
            path: (embedding?.metadata?.path as string) || "",
            content: embedding?.content || "",
            similarity: minSimilarity, // Approximate
          };
        })
      );

      cloneGroups.push({
        id: groupId,
        type: this.determineCloneType(minSimilarity),
        members: clones,
        size: members.length,
      });
    }

    console.log(`[CodeAnalyzer] Found ${cloneGroups.length} clone groups`);
    return cloneGroups;
  }

  /**
   * Cross-language semantic search
   */
  async crossLanguageSearch(query: string, languages: string[]): Promise<CrossLangResult[]> {
    // Generate query embedding
    const embedding = await this.embeddingGen.generateEmbedding(query);

    // Search across all languages
    const results = await this.vectorStore.search(embedding, 50);

    // Filter by language and map to CrossLangResult
    const crossLangResults: CrossLangResult[] = results
      .filter((r) => {
        const lang = r.metadata?.language as string;
        return languages.includes(lang);
      })
      .map((r) => ({
        id: r.id,
        language: (r.metadata?.language as string) || "unknown",
        path: (r.metadata?.path as string) || "",
        content: r.content,
        similarity: r.similarity,
      }));

    return crossLangResults;
  }

  /**
   * Suggest refactoring opportunities
   */
  async suggestRefactoring(code: string): Promise<RefactoringSuggestion[]> {
    const suggestions: RefactoringSuggestion[] = [];
    const metrics = extractCodeMetrics(code);

    // Check for long functions
    if (metrics.lines > 50) {
      suggestions.push({
        type: "extract",
        description: "Function is too long",
        impact: "medium",
        confidence: 0.8,
        code: "// Consider breaking this function into smaller pieces",
      });
    }

    // Check for complex conditions
    if (metrics.branches > 10) {
      suggestions.push({
        type: "simplify",
        description: "High cyclomatic complexity detected",
        impact: "high",
        confidence: 0.9,
        code: "// Consider using early returns or extracting complex conditions",
      });
    }

    // Check for duplicate code
    const similarCode = await this.findSimilarCode(code, 0.85);
    if (similarCode.length > 1) {
      suggestions.push({
        type: "combine",
        description: `Found ${similarCode.length} similar code fragments`,
        impact: "high",
        confidence: 0.85,
        code: "// Consider extracting common functionality into a shared function",
      });
    }

    // Check for naming improvements
    const entities = extractEntities(code);
    for (const entity of entities) {
      if (entity.length < 3 || entity === "tmp" || entity === "temp") {
        suggestions.push({
          type: "rename",
          description: `Poor variable name: '${entity}'`,
          impact: "low",
          confidence: 0.7,
        });
      }
    }

    // Check against known patterns
    for (const pattern of this.patterns) {
      if (this.matchesPattern(code, pattern)) {
        suggestions.push({
          type: pattern.type === "antipattern" ? "extract" : "simplify",
          description: pattern.description,
          impact: pattern.type === "antipattern" ? "high" : "medium",
          confidence: 0.75,
          code: `// ${pattern.suggestion}`,
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate code embedding
   */
  async generateCodeEmbedding(code: string): Promise<Float32Array> {
    return this.embeddingGen.generateCodeEmbedding(code);
  }

  // Private helper methods

  private extractConcepts(code: string): string[] {
    const concepts: string[] = [];

    // Extract programming concepts
    if (code.includes("async") || code.includes("await")) {
      concepts.push("asynchronous");
    }
    if (code.includes("Promise")) {
      concepts.push("promises");
    }
    if (code.includes("class")) {
      concepts.push("object-oriented");
    }
    if (code.includes("=>")) {
      concepts.push("functional");
    }
    if (code.includes("test") || code.includes("expect")) {
      concepts.push("testing");
    }
    if (code.includes("try") && code.includes("catch")) {
      concepts.push("error-handling");
    }

    return concepts;
  }

  private generateSummary(code: string, entities: string[], semanticType: SemanticAnalysis["semanticType"]): string {
    const lines = code.split("\n").length;
    const mainEntity = entities[0] || "code";

    return `${semanticType} containing ${entities.length} entities (${lines} lines). Main entity: ${mainEntity}`;
  }

  private determineSimilarityType(similarity: number): SimilarCode["type"] {
    if (similarity >= CLONE_TYPE_THRESHOLDS.type1) {
      return "exact";
    } else if (similarity >= CLONE_TYPE_THRESHOLDS.type2) {
      return "near";
    } else {
      return "semantic";
    }
  }

  private determineCloneType(similarity: number): CloneGroup["type"] {
    if (similarity >= CLONE_TYPE_THRESHOLDS.type1) {
      return "type1"; // Exact clones
    } else if (similarity >= CLONE_TYPE_THRESHOLDS.type2) {
      return "type2"; // Renamed clones
    } else if (similarity >= CLONE_TYPE_THRESHOLDS.type3) {
      return "type3"; // Gapped clones
    } else {
      return "type4"; // Semantic clones
    }
  }

  private matchesPattern(code: string, pattern: CodePattern): boolean {
    // Simplified pattern matching - in production would use AST analysis
    switch (pattern.pattern) {
      case "nested_loops":
        return (code.match(/for\s*\([^)]*\)\s*{[^}]*for\s*\(/g) || []).length > 0;
      case "long_function":
        return code.split("\n").length > 50;
      case "complex_condition":
        return (code.match(/if\s*\([^)]{50,}\)/g) || []).length > 0;
      default:
        return false;
    }
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    patternsLoaded: number;
    cacheStats: ReturnType<SemanticCache["getStats"]>;
  } {
    return {
      patternsLoaded: this.patterns.length,
      cacheStats: this.cache.getStats(),
    };
  }
}
