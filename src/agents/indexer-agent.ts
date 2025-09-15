/**
 * TASK-001: Indexer Agent Implementation
 * 
 * Core indexer agent responsible for storing and querying the code graph.
 * Subscribes to parse events and maintains the graph database.
 * 
 * Architecture References:
 * - Base Agent: src/agents/base.ts
 * - Agent Types: src/types/agent.ts
 * - Storage Types: src/types/storage.ts
 * - Knowledge Bus: src/core/knowledge-bus.ts
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { BaseAgent } from './base.js';
import { AgentType, type AgentTask, type AgentMessage } from '../types/agent.js';
import type { ParsedEntity, ParseResult } from '../types/parser.js';
import type { 
  Entity, 
  Relationship, 
  GraphQuery, 
  GraphQueryResult,
  EntityChange,
  FileInfo,
  BatchResult
} from '../types/storage.js';
import { parsedEntityToEntity, EntityType, RelationType } from '../types/storage.js';
import { knowledgeBus, type KnowledgeEntry } from '../core/knowledge-bus.js';
import { getSQLiteManager, type SQLiteManager } from '../storage/sqlite-manager.js';
import { runMigrations } from '../storage/schema-migrations.js';
import { GraphStorageImpl } from '../storage/graph-storage.js';
import { BatchOperations } from '../storage/batch-operations.js';
import { getCacheManager, type QueryCacheManager } from '../storage/cache-manager.js';
import { nanoid } from 'nanoid';

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const INDEXER_CONFIG = {
  maxConcurrency: 2,      // Database write operations
  memoryLimit: 512,       // MB for graph operations
  priority: 7,
  batchSize: 1000,
  cacheSize: 50 * 1024 * 1024, // 50MB cache
  cacheTTL: 5 * 60 * 1000      // 5 minutes
};

// =============================================================================
// 3. INDEXER TASK TYPES
// =============================================================================

export interface IndexerTask extends AgentTask {
  type: 'index:entities' | 'index:incremental' | 'query:graph' | 'query:subgraph';
  payload: {
    entities?: ParsedEntity[];
    filePath?: string;
    changes?: EntityChange[];
    query?: GraphQuery;
    entityId?: string;
    depth?: number;
  };
}

// =============================================================================
// 4. INDEXER AGENT IMPLEMENTATION
// =============================================================================

export class IndexerAgent extends BaseAgent {
  private sqliteManager!: SQLiteManager;
  private graphStorage!: GraphStorageImpl;
  private batchOps!: BatchOperations;
  private cacheManager!: QueryCacheManager;
  private subscriptionIds: string[] = [];
  private indexingStats = {
    entitiesIndexed: 0,
    relationshipsCreated: 0,
    filesProcessed: 0,
    totalIndexTime: 0,
    lastIndexTime: 0
  };
  
  constructor() {
    super(AgentType.INDEXER, INDEXER_CONFIG);
    console.log(`[IndexerAgent] Created with ID: ${this.id}`);
  }
  
  /**
   * Initialize the indexer agent
   */
  protected async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing Indexer Agent...`);
    
    // Initialize SQLite manager
    this.sqliteManager = getSQLiteManager();
    this.sqliteManager.initialize();
    
    // Run database migrations
    runMigrations(this.sqliteManager);
    
    // Initialize storage components
    this.graphStorage = new GraphStorageImpl(this.sqliteManager);
    this.batchOps = new BatchOperations(
      this.sqliteManager.getConnection(),
      INDEXER_CONFIG.batchSize
    );
    this.cacheManager = getCacheManager({
      maxSize: INDEXER_CONFIG.cacheSize,
      defaultTTL: INDEXER_CONFIG.cacheTTL
    });
    
    // Subscribe to parse complete events
    this.subscribeToParseEvents();
    
    console.log(`[${this.id}] Indexer Agent initialized successfully`);
  }
  
  /**
   * Subscribe to parser events via knowledge bus
   */
  private subscribeToParseEvents(): void {
    // Subscribe to parse complete events
    const parseCompleteId = knowledgeBus.subscribe(
      this.id,
      'parse:complete',
      async (entry: KnowledgeEntry) => {
        await this.handleParseComplete(entry);
      }
    );
    this.subscriptionIds.push(parseCompleteId);
    
    // Subscribe to parse batch complete events
    const parseBatchId = knowledgeBus.subscribe(
      this.id,
      'parse:batch:complete',
      async (entry: KnowledgeEntry) => {
        await this.handleParseBatchComplete(entry);
      }
    );
    this.subscriptionIds.push(parseBatchId);
    
    console.log(`[${this.id}] Subscribed to parse events`);
  }
  
  /**
   * Handle parse complete event
   */
  private async handleParseComplete(entry: KnowledgeEntry): Promise<void> {
    const parseResult = entry.data as ParseResult;
    console.log(`[${this.id}] Received parse result for ${parseResult.filePath}`);
    
    // Create indexing task
    const task: IndexerTask = {
      id: nanoid(12),
      type: 'index:entities',
      priority: 5,
      payload: {
        entities: parseResult.entities,
        filePath: parseResult.filePath
      },
      createdAt: Date.now()
    };
    
    // Process the task
    await this.process(task);
  }
  
  /**
   * Handle parse batch complete event
   */
  private async handleParseBatchComplete(entry: KnowledgeEntry): Promise<void> {
    const results = entry.data as ParseResult[];
    console.log(`[${this.id}] Received batch parse results for ${results.length} files`);
    
    for (const result of results) {
      const task: IndexerTask = {
        id: nanoid(12),
        type: 'index:entities',
        priority: 5,
        payload: {
          entities: result.entities,
          filePath: result.filePath
        },
        createdAt: Date.now()
      };
      
      await this.process(task);
    }
  }
  
  /**
   * Check if agent can process the task
   */
  protected canProcessTask(task: AgentTask): boolean {
    const indexerTask = task as IndexerTask;
    return [
      'index:entities',
      'index:incremental',
      'query:graph',
      'query:subgraph'
    ].includes(indexerTask.type);
  }
  
  /**
   * Process indexer tasks
   */
  protected async processTask(task: AgentTask): Promise<unknown> {
    const indexerTask = task as IndexerTask;
    
    switch (indexerTask.type) {
      case 'index:entities':
        return await this.indexEntities(
          indexerTask.payload.entities!,
          indexerTask.payload.filePath!
        );
        
      case 'index:incremental':
        return await this.incrementalUpdate(indexerTask.payload.changes!);
        
      case 'query:graph':
        return await this.queryGraph(indexerTask.payload.query!);
        
      case 'query:subgraph':
        return await this.querySubgraph(
          indexerTask.payload.entityId!,
          indexerTask.payload.depth || 2
        );
        
      default:
        throw new Error(`Unknown task type: ${indexerTask.type}`);
    }
  }
  
  /**
   * Index entities and build relationships
   */
  async indexEntities(entities: ParsedEntity[], filePath: string): Promise<BatchResult> {
    const startTime = Date.now();
    console.log(`[${this.id}] Indexing ${entities.length} entities from ${filePath}`);
    
    // Convert parsed entities to storage entities
    const storageEntities: Entity[] = [];
    const fileHash = nanoid(8); // In production, use actual file hash
    
    for (const parsed of entities) {
      const entity = {
        ...parsedEntityToEntity(parsed, filePath, fileHash),
        id: nanoid(12),
        createdAt: Date.now(),
        updatedAt: Date.now()
      } as Entity;
      
      storageEntities.push(entity);
    }
    
    // Insert entities in batch
    const entityResult = await this.batchOps.insertEntities(
      storageEntities,
      (processed, total) => {
        console.log(`[${this.id}] Progress: ${processed}/${total} entities`);
      }
    );
    
    // Build and insert relationships
    const relationships = await this.buildRelationships(entities, filePath, storageEntities);
    const relResult = await this.batchOps.insertRelationships(
      relationships,
      (processed, total) => {
        console.log(`[${this.id}] Progress: ${processed}/${total} relationships`);
      }
    );
    
    // Update file info
    const fileInfo: FileInfo = {
      path: filePath,
      hash: fileHash,
      lastIndexed: Date.now(),
      entityCount: storageEntities.length
    };
    await this.graphStorage.updateFileInfo(fileInfo);
    
    // Clear relevant cache entries
    this.cacheManager.clear();
    
    // Update statistics
    const indexTime = Date.now() - startTime;
    this.indexingStats.entitiesIndexed += entityResult.processed;
    this.indexingStats.relationshipsCreated += relResult.processed;
    this.indexingStats.filesProcessed++;
    this.indexingStats.totalIndexTime += indexTime;
    this.indexingStats.lastIndexTime = indexTime;
    
    // Publish indexing complete event
    knowledgeBus.publish(
      'index:complete',
      {
        filePath,
        entities: entityResult.processed,
        relationships: relResult.processed,
        timeMs: indexTime
      },
      this.id
    );
    
    console.log(`[${this.id}] Indexed ${entityResult.processed} entities and ${relResult.processed} relationships in ${indexTime}ms`);
    
    return entityResult;
  }
  
  /**
   * Build relationships from parsed entities
   */
  private async buildRelationships(
    parsedEntities: ParsedEntity[],
    filePath: string,
    storageEntities: Entity[]
  ): Promise<Relationship[]> {
    const relationships: Relationship[] = [];
    const entityMap = new Map<string, string>(); // name -> id mapping
    
    // Build entity map
    for (const entity of storageEntities) {
      entityMap.set(`${entity.name}:${entity.location.start.line}`, entity.id);
    }
    
    // Create relationships
    for (let i = 0; i < parsedEntities.length; i++) {
      const parsed = parsedEntities[i];
      const entity = storageEntities[i];
      
      // Import relationships
      if (parsed.type === 'import' && parsed.importData) {
        for (const specifier of parsed.importData.specifiers) {
          relationships.push({
            id: nanoid(12),
            fromId: entity.id,
            toId: `external:${parsed.importData.source}:${specifier.imported || specifier.local}`,
            type: RelationType.IMPORTS,
            metadata: {
              line: parsed.location.start.line,
              column: parsed.location.start.column,
              context: `Import from ${parsed.importData.source}`
            }
          });
        }
      }
      
      // Reference relationships
      if (parsed.references) {
        for (const ref of parsed.references) {
          // Try to find referenced entity in current file
          const refKey = Array.from(entityMap.keys()).find(key => key.startsWith(`${ref}:`));
          if (refKey) {
            relationships.push({
              id: nanoid(12),
              fromId: entity.id,
              toId: entityMap.get(refKey)!,
              type: RelationType.REFERENCES,
              metadata: {
                line: parsed.location.start.line,
                column: parsed.location.start.column
              }
            });
          }
        }
      }
      
      // Parent-child relationships
      if (parsed.children) {
        for (const child of parsed.children) {
          const childKey = `${child.name}:${child.location.start.line}`;
          const childId = entityMap.get(childKey);
          if (childId) {
            relationships.push({
              id: nanoid(12),
              fromId: entity.id,
              toId: childId,
              type: RelationType.CONTAINS,
              metadata: {
                line: child.location.start.line,
                column: child.location.start.column
              }
            });
          }
        }
      }
    }
    
    return relationships;
  }
  
  /**
   * Perform incremental update for changed entities
   */
  async incrementalUpdate(changes: EntityChange[]): Promise<BatchResult> {
    console.log(`[${this.id}] Processing ${changes.length} incremental changes`);
    
    const toAdd: Entity[] = [];
    const toUpdate: Array<{ id: string; changes: Partial<Entity> }> = [];
    const toDelete: string[] = [];
    
    for (const change of changes) {
      switch (change.type) {
        case 'added':
          if (change.entity) {
            toAdd.push(change.entity);
          }
          break;
          
        case 'modified':
          if (change.entity && change.entityId) {
            toUpdate.push({
              id: change.entityId,
              changes: change.entity
            });
          }
          break;
          
        case 'deleted':
          if (change.entityId) {
            toDelete.push(change.entityId);
          }
          break;
      }
    }
    
    // Process changes
    let processed = 0;
    let failed = 0;
    const errors: Array<{ item: unknown; error: string }> = [];
    
    if (toAdd.length > 0) {
      const result = await this.batchOps.insertEntities(toAdd);
      processed += result.processed;
      failed += result.failed;
      errors.push(...result.errors);
    }
    
    if (toUpdate.length > 0) {
      const result = await this.batchOps.updateEntities(toUpdate);
      processed += result.processed;
      failed += result.failed;
      errors.push(...result.errors);
    }
    
    if (toDelete.length > 0) {
      const result = await this.batchOps.deleteEntities(toDelete);
      processed += result.processed;
      failed += result.failed;
      errors.push(...result.errors);
    }
    
    // Clear cache after updates
    this.cacheManager.clear();
    
    return {
      processed,
      failed,
      errors,
      timeMs: 0
    };
  }
  
  /**
   * Query the graph
   */
  async queryGraph(query: GraphQuery): Promise<GraphQueryResult> {
    // Check cache
    const cacheKey = QueryCacheManager.createKey(query);
    const cached = this.cacheManager.get<GraphQueryResult>(cacheKey);
    if (cached) {
      console.log(`[${this.id}] Cache hit for graph query`);
      return cached;
    }
    
    // Execute query
    console.log(`[${this.id}] Executing graph query`);
    const result = await this.graphStorage.executeQuery(query);
    
    // Cache result
    this.cacheManager.set(cacheKey, result);
    
    return result;
  }
  
  /**
   * Query subgraph for an entity
   */
  async querySubgraph(entityId: string, depth: number): Promise<GraphQueryResult> {
    // Check cache
    const cacheKey = QueryCacheManager.createKey({ entityId, depth });
    const cached = this.cacheManager.get<GraphQueryResult>(cacheKey);
    if (cached) {
      console.log(`[${this.id}] Cache hit for subgraph query`);
      return cached;
    }
    
    // Execute query
    console.log(`[${this.id}] Getting subgraph for ${entityId} with depth ${depth}`);
    const result = await this.graphStorage.getSubgraph(entityId, depth);
    
    // Cache result
    this.cacheManager.set(cacheKey, result);
    
    return result;
  }
  
  /**
   * Handle incoming messages
   */
  protected async handleMessage(message: AgentMessage): Promise<void> {
    console.log(`[${this.id}] Received message: ${message.type} from ${message.from}`);
    
    switch (message.type) {
      case 'index:request':
        // Handle indexing request
        const task: IndexerTask = {
          id: message.id,
          type: 'index:entities',
          priority: 5,
          payload: message.payload,
          createdAt: Date.now()
        };
        await this.process(task);
        break;
        
      case 'query:request':
        // Handle query request
        const queryTask: IndexerTask = {
          id: message.id,
          type: 'query:graph',
          priority: 8,
          payload: message.payload,
          createdAt: Date.now()
        };
        const result = await this.process(queryTask);
        
        // Send response
        await this.send({
          id: nanoid(12),
          from: this.id,
          to: message.from,
          type: 'query:response',
          payload: result,
          timestamp: Date.now(),
          correlationId: message.id
        });
        break;
        
      default:
        console.warn(`[${this.id}] Unknown message type: ${message.type}`);
    }
  }
  
  /**
   * Shutdown the indexer agent
   */
  protected async onShutdown(): Promise<void> {
    console.log(`[${this.id}] Shutting down Indexer Agent...`);
    
    // Unsubscribe from knowledge bus
    for (const id of this.subscriptionIds) {
      knowledgeBus.unsubscribe(id);
    }
    
    // Run final maintenance
    await this.graphStorage.analyze();
    
    // Close database connection
    this.sqliteManager.close();
    
    // Clear cache
    this.cacheManager.clear();
    
    console.log(`[${this.id}] Indexer Agent shutdown complete`);
    console.log(`[${this.id}] Final stats:`, this.indexingStats);
  }
  
  /**
   * Get indexing statistics
   */
  getIndexingStats(): typeof this.indexingStats {
    return { ...this.indexingStats };
  }
  
  /**
   * Get storage metrics
   */
  async getStorageMetrics() {
    return await this.graphStorage.getMetrics();
  }
  
  /**
   * Perform maintenance operations
   */
  async performMaintenance(): Promise<void> {
    console.log(`[${this.id}] Performing maintenance...`);
    
    // Vacuum database
    await this.graphStorage.vacuum();
    
    // Analyze for query optimization
    await this.graphStorage.analyze();
    
    // Prune cache
    this.cacheManager.prune();
    
    // Optimize batch size based on performance
    const avgTime = this.indexingStats.totalIndexTime / Math.max(1, this.indexingStats.filesProcessed);
    this.batchOps.optimizeBatchSize(avgTime);
    
    console.log(`[${this.id}] Maintenance complete`);
  }
}