/**
 * TASK-002: QueryAgent for Graph Traversal and Relationships
 *
 * High-performance query agent for graph traversal and relationship analysis.
 * Supports concurrent queries, multi-level caching, and streaming responses.
 *
 * External Dependencies:
 * - nanoid: https://github.com/ai/nanoid - Secure unique ID generation
 * - p-limit: https://github.com/sindresorhus/p-limit - Concurrency control
 *
 * Architecture References:
 * - Base Agent: src/agents/base.ts
 * - Agent Types: src/types/agent.ts
 * - Query Types: src/types/query.ts
 * - Knowledge Bus: src/core/knowledge-bus.ts
 *
 * @task_id TASK-002
 * @coding_standard Adheres to: doc/CODING_STANDARD.md
 * @history
 *  - 2025-01-14: Created by Dev-Agent - TASK-002: Initial QueryAgent implementation
 */

import { nanoid } from "nanoid";
import pLimit from "p-limit";
import { getConfig } from "../config/yaml-config.js";
import { type KnowledgeEntry, knowledgeBus } from "../core/knowledge-bus.js";
import { ConnectionPool } from "../query/connection-pool.js";
import { GraphQueryProcessor } from "../query/graph-query-processor.js";
import { QueryCache } from "../query/query-cache.js";
import { getSQLiteManager } from "../storage/sqlite-manager.js";
import { type AgentMessage, type AgentTask, AgentType } from "../types/agent.js";
import type {
  Change,
  Cycle,
  DependencyTree,
  Entity,
  EntityFilter,
  Graph,
  GraphQuery,
  Hotspot,
  ImpactAnalysis,
  Path,
  QueryOperations,
  Relationship,
  RippleEffect,
} from "../types/query.js";
import type { RelationType } from "../types/storage.js";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { BaseAgent } from "./base.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
function getQueryAgentConfig() {
  const config = getConfig();
  return {
    maxConcurrency: config.queryAgent?.maxConcurrency ?? 10,
    memoryLimit: config.queryAgent?.memoryLimit ?? 112, // MB (64 base + 32 cache + 16 connections)
    priority: config.queryAgent?.priority ?? 9,
    simpleQueryTimeout: config.queryAgent?.simpleQueryTimeout ?? 100,
    complexQueryTimeout: config.queryAgent?.complexQueryTimeout ?? 1000,
    cacheWarmupSize: config.queryAgent?.cacheWarmupSize ?? 100,
  };
}

const QUERY_AGENT_CONFIG = getQueryAgentConfig();

// =============================================================================
// 3. QUERY AGENT IMPLEMENTATION
// =============================================================================

export class QueryAgent extends BaseAgent implements QueryOperations {
  private queryProcessor!: GraphQueryProcessor;
  private cache!: QueryCache;
  private connectionPool!: ConnectionPool;
  private concurrencyLimiter = pLimit(QUERY_AGENT_CONFIG.maxConcurrency);
  private subscriptionIds: string[] = [];
  private queryMetrics = {
    totalQueries: 0,
    totalTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };
  private readonly defaultMaxConcurrency: number;

  constructor() {
    super(AgentType.QUERY, {
      maxConcurrency: QUERY_AGENT_CONFIG.maxConcurrency,
      memoryLimit: QUERY_AGENT_CONFIG.memoryLimit,
      priority: QUERY_AGENT_CONFIG.priority,
    });
    this.defaultMaxConcurrency = QUERY_AGENT_CONFIG.maxConcurrency;
  }

  // =============================================================================
  // 4. LIFECYCLE METHODS
  // =============================================================================

  protected async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing QueryAgent...`);

    // Initialize components
    const sqliteManager = getSQLiteManager();
    this.connectionPool = new ConnectionPool({
      maxConnections: 4,
      minConnections: 1,
      acquireTimeout: 5000,
      idleTimeout: 30000,
      connectionTestInterval: 60000,
      sqliteManager,
    });
    await this.connectionPool.initialize();

    this.cache = new QueryCache();
    await this.cache.initialize();

    this.queryProcessor = new GraphQueryProcessor(this.connectionPool, this.cache);

    // Subscribe to knowledge bus events
    this.subscribeToKnowledgeBus();

    // Warm up cache with common queries
    await this.warmupCache();

    console.log(`[${this.id}] QueryAgent initialized successfully`);
  }

  protected async onShutdown(): Promise<void> {
    console.log(`[${this.id}] Shutting down QueryAgent...`);

    // Cleanup resources
    try {
      for (const id of this.subscriptionIds) {
        knowledgeBus.unsubscribe(id);
      }
    } catch {
      // ignore unsubscribe errors during shutdown
    } finally {
      this.subscriptionIds = [];
    }

    await this.cache.shutdown();
    await this.connectionPool.shutdown();

    console.log(`[${this.id}] QueryAgent shutdown complete`);
  }

  // =============================================================================
  // 5. TASK PROCESSING
  // =============================================================================

  protected canProcessTask(task: AgentTask): boolean {
    return task.type.startsWith("query:");
  }

  protected async processTask(task: AgentTask): Promise<unknown> {
    const startTime = Date.now();

    try {
      let result: unknown;

      switch (task.type) {
        case "query:entity":
          result = await this.handleEntityQuery(task.payload as EntityFilter);
          break;
        case "query:relationships":
          result = await this.handleRelationshipQuery(task.payload as { entityId: string; type?: RelationType });
          break;
        case "query:traversal":
          result = await this.handleTraversalQuery(task.payload as { type: string; params: unknown });
          break;
        case "query:analysis":
          result = await this.handleAnalysisQuery(task.payload as { type: string; params: unknown });
          break;
        default:
          throw new Error(`Unknown query task type: ${task.type}`);
      }

      const duration = Date.now() - startTime;
      this.updateMetrics(duration, true);

      // Publish result to knowledge bus
      knowledgeBus.publish(
        `query:result:${task.id}`,
        result,
        this.id,
        300000, // 5 minute TTL
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, false);
      throw error;
    }
  }

  protected async handleMessage(message: AgentMessage): Promise<void> {
    if (message.type === "query:execute") {
      const task: AgentTask = {
        id: nanoid(),
        type: `query:${(message.payload as any).type}`,
        priority: 9,
        payload: message.payload,
        createdAt: Date.now(),
      };

      await this.process(task);
    }
  }

  // =============================================================================
  // 6. QUERY OPERATIONS IMPLEMENTATION
  // =============================================================================

  async getEntity(id: string): Promise<Entity | null> {
    return this.concurrencyLimiter(async () => {
      const query: GraphQuery = {
        id: nanoid(),
        type: "entity",
        operation: "getEntity",
        params: { id },
        hash: `entity:${id}`,
        timestamp: Date.now(),
      };

      const result = await this.queryProcessor.executeQuery(query);
      return result.data as Entity | null;
    });
  }

  async listEntities(filter: EntityFilter): Promise<Entity[]> {
    return this.concurrencyLimiter(async () => {
      const query: GraphQuery = {
        id: nanoid(),
        type: "entity",
        operation: "listEntities",
        params: filter as Record<string, unknown>,
        hash: `entities:${JSON.stringify(filter)}`,
        timestamp: Date.now(),
      };

      const result = await this.queryProcessor.executeQuery(query);
      return result.data as Entity[];
    });
  }

  async getRelationships(entityId: string, type?: RelationType): Promise<Relationship[]> {
    return this.concurrencyLimiter(async () => {
      const query: GraphQuery = {
        id: nanoid(),
        type: "relationship",
        operation: "getRelationships",
        params: { entityId, type },
        hash: `relationships:${entityId}:${type || "all"}`,
        timestamp: Date.now(),
      };

      const result = await this.queryProcessor.executeQuery(query);
      return result.data as Relationship[];
    });
  }

  async getRelatedEntities(entityId: string, depth: number): Promise<Entity[]> {
    return this.concurrencyLimiter(async () => {
      const query: GraphQuery = {
        id: nanoid(),
        type: "traversal",
        operation: "getRelatedEntities",
        params: { entityId, depth },
        hash: `related:${entityId}:${depth}`,
        timestamp: Date.now(),
      };

      const result = await this.queryProcessor.executeQuery(query);
      return result.data as Entity[];
    });
  }

  async findPath(fromId: string, toId: string): Promise<Path | null> {
    return this.concurrencyLimiter(async () => {
      const query: GraphQuery = {
        id: nanoid(),
        type: "traversal",
        operation: "findPath",
        params: { fromId, toId },
        hash: `path:${fromId}:${toId}`,
        timestamp: Date.now(),
      };

      const result = await this.queryProcessor.executeQuery(query);
      return result.data as Path | null;
    });
  }

  async getSubgraph(rootId: string, depth: number): Promise<Graph> {
    return this.concurrencyLimiter(async () => {
      const query: GraphQuery = {
        id: nanoid(),
        type: "traversal",
        operation: "getSubgraph",
        params: { rootId, depth },
        hash: `subgraph:${rootId}:${depth}`,
        timestamp: Date.now(),
      };

      const result = await this.queryProcessor.executeQuery(query);
      return result.data as Graph;
    });
  }

  async findDependencies(entityId: string): Promise<DependencyTree> {
    return this.concurrencyLimiter(async () => {
      const query: GraphQuery = {
        id: nanoid(),
        type: "analysis",
        operation: "findDependencies",
        params: { entityId },
        hash: `dependencies:${entityId}`,
        timestamp: Date.now(),
      };

      const result = await this.queryProcessor.executeQuery(query);
      return result.data as DependencyTree;
    });
  }

  async detectCycles(): Promise<Cycle[]> {
    return this.concurrencyLimiter(async () => {
      const query: GraphQuery = {
        id: nanoid(),
        type: "analysis",
        operation: "detectCycles",
        params: {},
        hash: "cycles:all",
        timestamp: Date.now(),
      };

      const result = await this.queryProcessor.executeQuery(query);
      return result.data as Cycle[];
    });
  }

  async analyzeHotspots(): Promise<Hotspot[]> {
    return this.concurrencyLimiter(async () => {
      const query: GraphQuery = {
        id: nanoid(),
        type: "analysis",
        operation: "analyzeHotspots",
        params: {},
        hash: "hotspots:all",
        timestamp: Date.now(),
      };

      const result = await this.queryProcessor.executeQuery(query);
      return result.data as Hotspot[];
    });
  }

  async getImpactedEntities(entityId: string): Promise<ImpactAnalysis> {
    return this.concurrencyLimiter(async () => {
      const query: GraphQuery = {
        id: nanoid(),
        type: "analysis",
        operation: "getImpactedEntities",
        params: { entityId },
        hash: `impact:${entityId}`,
        timestamp: Date.now(),
      };

      const result = await this.queryProcessor.executeQuery(query);
      return result.data as ImpactAnalysis;
    });
  }

  async calculateChangeRipple(changes: Change[]): Promise<RippleEffect> {
    return this.concurrencyLimiter(async () => {
      const changeIds = changes
        .map((c) => c.entityId)
        .sort()
        .join(",");
      const query: GraphQuery = {
        id: nanoid(),
        type: "analysis",
        operation: "calculateChangeRipple",
        params: { changes },
        hash: `ripple:${changeIds}`,
        timestamp: Date.now(),
      };

      const result = await this.queryProcessor.executeQuery(query);
      return result.data as RippleEffect;
    });
  }

  // =============================================================================
  // 7. HELPER METHODS
  // =============================================================================

  private async handleEntityQuery(filter: EntityFilter): Promise<Entity[]> {
    return this.listEntities(filter);
  }

  private async handleRelationshipQuery(params: { entityId: string; type?: RelationType }): Promise<Relationship[]> {
    return this.getRelationships(params.entityId, params.type);
  }

  private async handleTraversalQuery(params: { type: string; params: any }): Promise<unknown> {
    switch (params.type) {
      case "path":
        return this.findPath(params.params.fromId, params.params.toId);
      case "subgraph":
        return this.getSubgraph(params.params.rootId, params.params.depth);
      case "related":
        return this.getRelatedEntities(params.params.entityId, params.params.depth);
      default:
        throw new Error(`Unknown traversal type: ${params.type}`);
    }
  }

  private async handleAnalysisQuery(params: { type: string; params: any }): Promise<unknown> {
    switch (params.type) {
      case "dependencies":
        return this.findDependencies(params.params.entityId);
      case "cycles":
        return this.detectCycles();
      case "hotspots":
        return this.analyzeHotspots();
      case "impact":
        return this.getImpactedEntities(params.params.entityId);
      case "ripple":
        return this.calculateChangeRipple(params.params.changes);
      default:
        throw new Error(`Unknown analysis type: ${params.type}`);
    }
  }

  private subscribeToKnowledgeBus(): void {
    // Subscribe to index updates
    this.subscriptionIds.push(knowledgeBus.subscribe(this.id, "index:updated", this.handleIndexUpdate.bind(this)));

    // Subscribe to cache invalidation requests
    this.subscriptionIds.push(
      knowledgeBus.subscribe(this.id, "cache:invalidate", this.handleCacheInvalidation.bind(this)),
    );

    // Subscribe to query requests
    this.subscriptionIds.push(knowledgeBus.subscribe(this.id, /^query:request:.*/, this.handleQueryRequest.bind(this)));

    // Subscribe to resource adjustments
    this.subscriptionIds.push(
      knowledgeBus.subscribe(this.id, "resources:adjusted", this.handleResourceAdjustment.bind(this)),
    );
  }

  private async handleIndexUpdate(entry: KnowledgeEntry): Promise<void> {
    console.log(`[${this.id}] Handling index update: ${entry.topic}`);

    // Invalidate affected cache entries
    const affectedQueries = await this.cache.findAffectedQueries(entry.data);
    await this.cache.invalidate(affectedQueries);

    // Publish cache invalidation event
    knowledgeBus.publish("cache:invalidated", { queries: affectedQueries, reason: "index_update" }, this.id);
  }

  private async handleCacheInvalidation(entry: KnowledgeEntry): Promise<void> {
    const { queries } = entry.data as { queries: string[] };
    console.log(`[${this.id}] Invalidating ${queries.length} cache entries`);
    await this.cache.invalidate(queries);
  }

  private async handleQueryRequest(entry: KnowledgeEntry): Promise<void> {
    const message: AgentMessage = {
      id: nanoid(),
      from: entry.source,
      to: this.id,
      type: "query:execute",
      payload: entry.data,
      timestamp: Date.now(),
    };

    await this.receive(message);
  }

  private handleResourceAdjustment(entry: KnowledgeEntry): void {
    const data = entry.data as {
      newAgentLimit?: number;
    };

    if (typeof data.newAgentLimit === "number" && Number.isFinite(data.newAgentLimit)) {
      const adjustedConcurrency = Math.max(1, Math.min(this.defaultMaxConcurrency * 2, Math.floor(data.newAgentLimit)));
      if (this.capabilities.maxConcurrency !== adjustedConcurrency) {
        console.log(
          `[${this.id}] Adjusting concurrency from ${this.capabilities.maxConcurrency} to ${adjustedConcurrency} (resources:adjusted)`,
        );
        this.capabilities.maxConcurrency = adjustedConcurrency;
        this.concurrencyLimiter = pLimit(adjustedConcurrency);
      }
    }
  }

  private async warmupCache(): Promise<void> {
    console.log(`[${this.id}] Warming up cache...`);

    // Pre-load commonly accessed entities
    const commonQueries = [
      { type: "entity", operation: "listEntities", params: { type: "class" } },
      { type: "entity", operation: "listEntities", params: { type: "function" } },
      { type: "analysis", operation: "analyzeHotspots", params: {} },
    ];

    for (const queryDef of commonQueries) {
      try {
        const query: GraphQuery = {
          id: nanoid(),
          type: queryDef.type as any,
          operation: queryDef.operation,
          params: queryDef.params,
          hash: `warmup:${queryDef.operation}`,
          timestamp: Date.now(),
        };

        await this.queryProcessor.executeQuery(query);
      } catch (error) {
        console.warn(`[${this.id}] Cache warmup failed for ${queryDef.operation}:`, error);
      }
    }

    console.log(`[${this.id}] Cache warmup complete`);
  }

  private updateMetrics(duration: number, success: boolean): void {
    this.queryMetrics.totalQueries++;
    this.queryMetrics.totalTime += duration;

    if (success) {
      const cacheStats = this.cache.getStats();
      this.queryMetrics.cacheHits = cacheStats.totalHits;
      this.queryMetrics.cacheMisses = cacheStats.totalMisses;
    }
  }

  /**
   * Get query performance metrics
   */
  getQueryMetrics(): {
    totalQueries: number;
    averageResponseTime: number;
    cacheHitRate: number;
  } {
    const cacheStats = this.cache.getStats();

    const totalCacheRequests = cacheStats.totalHits + cacheStats.totalMisses;
    const cacheHitRate = totalCacheRequests > 0 ? cacheStats.totalHits / totalCacheRequests : 0;

    return {
      totalQueries: this.queryMetrics.totalQueries,
      averageResponseTime:
        this.queryMetrics.totalQueries > 0 ? this.queryMetrics.totalTime / this.queryMetrics.totalQueries : 0,
      cacheHitRate,
    };
  }
}
