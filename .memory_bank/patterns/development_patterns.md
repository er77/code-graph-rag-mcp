# Development Patterns

## Overview

Essential development patterns for the Code Graph RAG MCP project, covering code organization, error handling, performance optimization, and best practices for multi-agent systems.

## 🏗️ Code Organization Patterns

### Module Structure Pattern

```typescript
// Standard module organization
src/
├── agents/          # Specialized agents
│   ├── base/       # Base agent classes
│   ├── conductor/  # Orchestration agents
│   ├── parser/     # Parsing agents
│   └── semantic/   # Vector/semantic agents
├── core/           # Core infrastructure
│   ├── database/   # Database abstractions
│   ├── messaging/  # Inter-agent communication
│   └── resource/   # Resource management
├── tools/          # MCP tool implementations
├── types/          # TypeScript type definitions
└── utils/          # Shared utilities
```

### Interface-First Design

```typescript
// Define interfaces before implementations
export interface CodeAnalysisAgent {
  readonly name: string;
  readonly capabilities: string[];
  readonly resourceRequirements: ResourceRequirements;
  
  canHandle(task: AnalysisTask): boolean;
  process(task: AnalysisTask): Promise<AgentResult>;
  getMetrics(): AgentMetrics;
}

// Implementation follows interface
export class ParserAgent implements CodeAnalysisAgent {
  readonly name = 'parser-agent';
  readonly capabilities = ['parse', 'extract-entities'];
  readonly resourceRequirements = {
    memoryMB: 128,
    cpuCores: 0.5
  };

  canHandle(task: AnalysisTask): boolean {
    return this.capabilities.includes(task.type);
  }

  async process(task: AnalysisTask): Promise<AgentResult> {
    // Implementation
  }
}
```

### Dependency Injection Pattern

```typescript
// Use constructor injection for dependencies
export class SemanticSearchTool {
  constructor(
    private vectorStore: VectorStore,
    private embeddingModel: EmbeddingModel,
    private graphDb: GraphDatabase,
    private logger: Logger = createLogger('semantic-search')
  ) {}

  async search(query: string): Promise<SearchResult[]> {
    this.logger.info(`Performing semantic search: ${query}`);
    // Implementation
  }
}

// Factory for dependency setup
export class ToolFactory {
  static createSemanticSearchTool(
    config: SemanticSearchConfig
  ): SemanticSearchTool {
    const vectorStore = new FAISSVectorStore(config.dimensions);
    const embeddingModel = new HuggingFaceEmbeddings(config.modelName);
    const graphDb = new GraphStorageImpl(config.dbManager);
    
    return new SemanticSearchTool(vectorStore, embeddingModel, graphDb);
  }
}
```

## 🛡️ Error Handling Patterns

### Graceful Degradation Pattern

```typescript
export class RobustParsingService {
  constructor(
    private primaryParser: TreeSitterParser,
    private fallbackParser: RegexParser,
    private logger: Logger
  ) {}

  async parseFile(filepath: string, content: string): Promise<ParseResult> {
    try {
      // Try primary parser
      return await this.primaryParser.parse(content, filepath);
      
    } catch (primaryError) {
      this.logger.warn(`Primary parser failed for ${filepath}, trying fallback`, {
        error: primaryError.message
      });
      
      try {
        // Fallback to regex parser
        const result = await this.fallbackParser.parse(content, filepath);
        result.warnings.push('Used fallback parser due to primary parser failure');
        return result;
        
      } catch (fallbackError) {
        this.logger.error(`All parsers failed for ${filepath}`, {
          primaryError: primaryError.message,
          fallbackError: fallbackError.message
        });
        
        // Return minimal result rather than throwing
        return {
          entities: [],
          relationships: [],
          filepath,
          errors: [primaryError.message, fallbackError.message],
          parseSuccess: false
        };
      }
    }
  }
}
```

### Circuit Breaker Pattern

```typescript
export class CircuitBreakerService {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold = 5,
    private resetTimeoutMs = 60000
  ) {}

  async call<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit breaker
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
      
      return result;
      
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      
      throw error;
    }
  }
}

// Usage in vector store
export class ReliableVectorStore {
  private circuitBreaker = new CircuitBreakerService();

  constructor(private vectorStore: VectorStore) {}

  async search(query: number[], topK: number): Promise<SearchResult[]> {
    return await this.circuitBreaker.call(async () => {
      return await this.vectorStore.search(query, topK);
    });
  }
}
```

### Retry Pattern with Exponential Backoff

```typescript
export class RetryService {
  static async withExponentialBackoff<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
      retryCondition?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelayMs = 1000,
      maxDelayMs = 30000,
      retryCondition = () => true
    } = options;

    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries || !retryCondition(lastError)) {
          throw lastError;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt),
          maxDelayMs
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}

// Usage in database operations
export class ReliableDatabaseService {
  constructor(private db: SQLiteManager) {}

  async storeEntity(entity: Entity): Promise<void> {
    await RetryService.withExponentialBackoff(
      async () => {
        await this.db.run(
          'INSERT OR REPLACE INTO entities (id, name, type, file) VALUES (?, ?, ?, ?)',
          [entity.id, entity.name, entity.type, entity.file]
        );
      },
      {
        maxRetries: 3,
        retryCondition: (error) => error.message.includes('database is locked')
      }
    );
  }
}
```

## ⚡ Performance Patterns

### Batching Pattern

```typescript
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private timer?: NodeJS.Timeout;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private batchSize: number = 100,
    private flushIntervalMs: number = 1000
  ) {}

  async add(item: T): Promise<void> {
    this.queue.push(item);
    
    if (this.queue.length >= this.batchSize) {
      await this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.batchSize);
    
    try {
      await this.processor(batch);
    } catch (error) {
      console.error('Batch processing failed:', error);
      // Re-queue items or handle error appropriately
    }
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleFlush(): void {
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.flushIntervalMs);
    }
  }
}

// Usage for entity storage
export class BatchedEntityStorage {
  private batchProcessor: BatchProcessor<Entity, void>;

  constructor(private storage: GraphStorage) {
    this.batchProcessor = new BatchProcessor(
      async (entities) => {
        await this.storage.storeEntities(entities);
      },
      50, // batch size
      2000 // 2 second flush interval
    );
  }

  async storeEntity(entity: Entity): Promise<void> {
    await this.batchProcessor.add(entity);
  }
}
```

### Caching Pattern

```typescript
export class LRUCache<K, V> {
  private cache = new Map<K, CacheItem<V>>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // Check expiration
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, { ...item, accessedAt: Date.now() });
    
    return item.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    // Remove existing item
    this.cache.delete(key);

    // Add new item
    const item: CacheItem<V> = {
      value,
      accessedAt: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined
    };
    
    this.cache.set(key, item);

    // Evict if over capacity
    if (this.cache.size > this.maxSize) {
      this.evictOldest();
    }
  }

  private evictOldest(): void {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

interface CacheItem<V> {
  value: V;
  accessedAt: number;
  expiresAt?: number;
}

// Usage in parsing service
export class CachedParsingService {
  private parseCache = new LRUCache<string, ParseResult>(500);

  async parseFile(filepath: string, content: string): Promise<ParseResult> {
    const contentHash = this.computeHash(content);
    const cacheKey = `${filepath}:${contentHash}`;
    
    // Check cache first
    const cached = this.parseCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Parse and cache
    const result = await this.performParse(filepath, content);
    this.parseCache.set(cacheKey, result, 5 * 60 * 1000); // 5 minutes TTL
    
    return result;
  }
}
```

### Resource Pool Pattern

```typescript
export class ResourcePool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();
  private waiting: Array<{
    resolve: (resource: T) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(
    private createResource: () => Promise<T>,
    private destroyResource: (resource: T) => Promise<void>,
    private maxSize: number = 10,
    private idleTimeoutMs: number = 300000 // 5 minutes
  ) {}

  async acquire(): Promise<T> {
    // Return available resource if any
    if (this.available.length > 0) {
      const resource = this.available.pop()!;
      this.inUse.add(resource);
      return resource;
    }

    // Create new resource if under limit
    if (this.inUse.size < this.maxSize) {
      const resource = await this.createResource();
      this.inUse.add(resource);
      return resource;
    }

    // Wait for resource to become available
    return new Promise((resolve, reject) => {
      this.waiting.push({ resolve, reject });
    });
  }

  async release(resource: T): Promise<void> {
    if (!this.inUse.has(resource)) {
      throw new Error('Resource not in use');
    }

    this.inUse.delete(resource);

    // Give to waiting request if any
    const waiter = this.waiting.shift();
    if (waiter) {
      this.inUse.add(resource);
      waiter.resolve(resource);
      return;
    }

    // Return to available pool
    this.available.push(resource);
    
    // Schedule idle timeout
    setTimeout(async () => {
      const index = this.available.indexOf(resource);
      if (index !== -1) {
        this.available.splice(index, 1);
        await this.destroyResource(resource);
      }
    }, this.idleTimeoutMs);
  }
}

// Usage for database connections
export class DatabaseConnectionPool {
  private pool: ResourcePool<Database>;

  constructor(dbPath: string, maxConnections: number = 5) {
    this.pool = new ResourcePool(
      async () => {
        const db = new Database(dbPath);
        // Configure connection
        return db;
      },
      async (db) => {
        db.close();
      },
      maxConnections
    );
  }

  async withConnection<T>(operation: (db: Database) => Promise<T>): Promise<T> {
    const db = await this.pool.acquire();
    try {
      return await operation(db);
    } finally {
      await this.pool.release(db);
    }
  }
}
```

## 🤖 Agent Patterns

### Command Pattern for Agent Tasks

```typescript
export interface AgentCommand {
  execute(): Promise<AgentResult>;
  undo?(): Promise<void>;
  canUndo(): boolean;
}

export class ParseFileCommand implements AgentCommand {
  constructor(
    private agent: ParserAgent,
    private filepath: string,
    private content: string
  ) {}

  async execute(): Promise<AgentResult> {
    return await this.agent.parseFile(this.filepath, this.content);
  }

  canUndo(): boolean {
    return false; // Parsing is read-only
  }
}

export class StoreEntitiesCommand implements AgentCommand {
  private storedEntities: Entity[] = [];

  constructor(
    private storage: GraphStorage,
    private entities: Entity[]
  ) {}

  async execute(): Promise<AgentResult> {
    this.storedEntities = [...this.entities];
    await this.storage.storeEntities(this.entities);
    return { success: true, data: this.entities };
  }

  async undo(): Promise<void> {
    if (this.storedEntities.length > 0) {
      const entityIds = this.storedEntities.map(e => e.id);
      await this.storage.deleteEntities(entityIds);
    }
  }

  canUndo(): boolean {
    return this.storedEntities.length > 0;
  }
}

// Command executor with undo support
export class CommandExecutor {
  private history: AgentCommand[] = [];
  private maxHistorySize = 100;

  async execute(command: AgentCommand): Promise<AgentResult> {
    const result = await command.execute();
    
    if (command.canUndo()) {
      this.history.push(command);
      
      // Limit history size
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }
    }
    
    return result;
  }

  async undo(): Promise<void> {
    const command = this.history.pop();
    if (command && command.undo) {
      await command.undo();
    }
  }
}
```

### Observer Pattern for Agent Communication

```typescript
export interface AgentObserver {
  onAgentEvent(event: AgentEvent): Promise<void>;
}

export interface AgentEvent {
  type: string;
  agentName: string;
  data: any;
  timestamp: number;
}

export class AgentEventBus {
  private observers = new Map<string, AgentObserver[]>();

  subscribe(eventType: string, observer: AgentObserver): void {
    if (!this.observers.has(eventType)) {
      this.observers.set(eventType, []);
    }
    this.observers.get(eventType)!.push(observer);
  }

  unsubscribe(eventType: string, observer: AgentObserver): void {
    const observers = this.observers.get(eventType);
    if (observers) {
      const index = observers.indexOf(observer);
      if (index !== -1) {
        observers.splice(index, 1);
      }
    }
  }

  async publish(event: AgentEvent): Promise<void> {
    const observers = this.observers.get(event.type) || [];
    
    // Notify all observers in parallel
    await Promise.all(
      observers.map(observer =>
        observer.onAgentEvent(event).catch(error =>
          console.error(`Observer error for event ${event.type}:`, error)
        )
      )
    );
  }
}

// Usage in agents
export class ObservableAgent implements CodeAnalysisAgent {
  constructor(
    private eventBus: AgentEventBus,
    public readonly name: string
  ) {}

  async process(task: AnalysisTask): Promise<AgentResult> {
    // Publish task started event
    await this.eventBus.publish({
      type: 'task_started',
      agentName: this.name,
      data: { taskId: task.id, taskType: task.type },
      timestamp: Date.now()
    });

    try {
      const result = await this.performTask(task);
      
      // Publish task completed event
      await this.eventBus.publish({
        type: 'task_completed',
        agentName: this.name,
        data: { taskId: task.id, result },
        timestamp: Date.now()
      });
      
      return result;
      
    } catch (error) {
      // Publish task failed event
      await this.eventBus.publish({
        type: 'task_failed',
        agentName: this.name,
        data: { taskId: task.id, error: error.message },
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  protected abstract performTask(task: AnalysisTask): Promise<AgentResult>;
}
```

### Strategy Pattern for Agent Selection

```typescript
export interface AgentSelectionStrategy {
  selectAgent(task: AnalysisTask, availableAgents: CodeAnalysisAgent[]): CodeAnalysisAgent | null;
}

export class LoadBalancedSelectionStrategy implements AgentSelectionStrategy {
  selectAgent(task: AnalysisTask, availableAgents: CodeAnalysisAgent[]): CodeAnalysisAgent | null {
    const capableAgents = availableAgents.filter(agent => agent.canHandle(task));
    
    if (capableAgents.length === 0) return null;
    
    // Select agent with lowest current load
    return capableAgents.reduce((leastLoaded, current) => {
      const currentLoad = this.getAgentLoad(current);
      const leastLoadedLoad = this.getAgentLoad(leastLoaded);
      return currentLoad < leastLoadedLoad ? current : leastLoaded;
    });
  }

  private getAgentLoad(agent: CodeAnalysisAgent): number {
    // Implementation would check agent's current task queue or resource usage
    return agent.getMetrics().activeTasks;
  }
}

export class PriorityBasedSelectionStrategy implements AgentSelectionStrategy {
  constructor(private agentPriorities: Map<string, number>) {}

  selectAgent(task: AnalysisTask, availableAgents: CodeAnalysisAgent[]): CodeAnalysisAgent | null {
    const capableAgents = availableAgents.filter(agent => agent.canHandle(task));
    
    if (capableAgents.length === 0) return null;
    
    // Select agent with highest priority
    return capableAgents.reduce((highest, current) => {
      const currentPriority = this.agentPriorities.get(current.name) || 0;
      const highestPriority = this.agentPriorities.get(highest.name) || 0;
      return currentPriority > highestPriority ? current : highest;
    });
  }
}

// Usage in coordinator
export class AgentCoordinator {
  constructor(
    private agents: CodeAnalysisAgent[],
    private selectionStrategy: AgentSelectionStrategy
  ) {}

  async executeTask(task: AnalysisTask): Promise<AgentResult> {
    const selectedAgent = this.selectionStrategy.selectAgent(task, this.agents);
    
    if (!selectedAgent) {
      throw new Error(`No agent available for task type: ${task.type}`);
    }
    
    return await selectedAgent.process(task);
  }

  setSelectionStrategy(strategy: AgentSelectionStrategy): void {
    this.selectionStrategy = strategy;
  }
}
```

## 📊 Monitoring Patterns

### Health Check Pattern

```typescript
export interface HealthCheck {
  name: string;
  check(): Promise<HealthResult>;
}

export interface HealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  metrics?: Record<string, number>;
  timestamp: number;
}

export class DatabaseHealthCheck implements HealthCheck {
  name = 'database';

  constructor(private db: SQLiteManager) {}

  async check(): Promise<HealthResult> {
    try {
      const start = Date.now();
      const result = await this.db.get('SELECT 1');
      const responseTime = Date.now() - start;

      return {
        status: responseTime < 100 ? 'healthy' : 'degraded',
        message: `Database responding in ${responseTime}ms`,
        metrics: { responseTimeMs: responseTime },
        timestamp: Date.now()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database error: ${error.message}`,
        timestamp: Date.now()
      };
    }
  }
}

export class VectorStoreHealthCheck implements HealthCheck {
  name = 'vector-store';

  constructor(private vectorStore: VectorStore) {}

  async check(): Promise<HealthResult> {
    try {
      const start = Date.now();
      const testVector = Array(384).fill(0); // Test embedding
      await this.vectorStore.search(testVector, 1);
      const responseTime = Date.now() - start;

      return {
        status: responseTime < 200 ? 'healthy' : 'degraded',
        metrics: { responseTimeMs: responseTime },
        timestamp: Date.now()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Vector store error: ${error.message}`,
        timestamp: Date.now()
      };
    }
  }
}

export class HealthMonitor {
  private healthChecks: HealthCheck[] = [];

  addHealthCheck(check: HealthCheck): void {
    this.healthChecks.push(check);
  }

  async checkHealth(): Promise<Record<string, HealthResult>> {
    const results: Record<string, HealthResult> = {};
    
    await Promise.all(
      this.healthChecks.map(async check => {
        try {
          results[check.name] = await check.check();
        } catch (error) {
          results[check.name] = {
            status: 'unhealthy',
            message: `Health check failed: ${error.message}`,
            timestamp: Date.now()
          };
        }
      })
    );
    
    return results;
  }

  async getOverallHealth(): Promise<HealthResult> {
    const checks = await this.checkHealth();
    const statuses = Object.values(checks).map(r => r.status);
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }
    
    return {
      status: overallStatus,
      message: `${statuses.filter(s => s === 'healthy').length}/${statuses.length} services healthy`,
      timestamp: Date.now()
    };
  }
}
```

### Metrics Collection Pattern

```typescript
export interface MetricCollector {
  collect(): Promise<Metric[]>;
}

export interface Metric {
  name: string;
  value: number;
  unit?: string;
  labels?: Record<string, string>;
  timestamp: number;
}

export class AgentMetricsCollector implements MetricCollector {
  constructor(private agents: CodeAnalysisAgent[]) {}

  async collect(): Promise<Metric[]> {
    const metrics: Metric[] = [];
    
    for (const agent of this.agents) {
      const agentMetrics = agent.getMetrics();
      
      metrics.push(
        {
          name: 'agent_tasks_completed',
          value: agentMetrics.tasksCompleted,
          labels: { agent: agent.name },
          timestamp: Date.now()
        },
        {
          name: 'agent_tasks_active',
          value: agentMetrics.activeTasks,
          labels: { agent: agent.name },
          timestamp: Date.now()
        },
        {
          name: 'agent_memory_usage',
          value: agentMetrics.memoryUsageMB,
          unit: 'MB',
          labels: { agent: agent.name },
          timestamp: Date.now()
        }
      );
    }
    
    return metrics;
  }
}

export class MetricsRegistry {
  private collectors: MetricCollector[] = [];
  private metrics: Metric[] = [];

  addCollector(collector: MetricCollector): void {
    this.collectors.push(collector);
  }

  async collectMetrics(): Promise<void> {
    const allMetrics = await Promise.all(
      this.collectors.map(collector => collector.collect())
    );
    
    this.metrics = allMetrics.flat();
  }

  getMetrics(): Metric[] {
    return [...this.metrics];
  }

  getMetricsByName(name: string): Metric[] {
    return this.metrics.filter(m => m.name === name);
  }
}
```

## 🔧 Configuration Patterns

### Configuration Builder Pattern

```typescript
export class SystemConfigBuilder {
  private config: Partial<SystemConfig> = {};

  database(options: DatabaseConfig): this {
    this.config.database = options;
    return this;
  }

  agents(options: AgentConfig): this {
    this.config.agents = options;
    return this;
  }

  vectorStore(options: VectorStoreConfig): this {
    this.config.vectorStore = options;
    return this;
  }

  performance(options: PerformanceConfig): this {
    this.config.performance = options;
    return this;
  }

  build(): SystemConfig {
    return {
      database: this.config.database || this.getDefaultDatabaseConfig(),
      agents: this.config.agents || this.getDefaultAgentConfig(),
      vectorStore: this.config.vectorStore || this.getDefaultVectorStoreConfig(),
      performance: this.config.performance || this.getDefaultPerformanceConfig()
    };
  }

  private getDefaultDatabaseConfig(): DatabaseConfig {
    return {
      path: './code-graph.db',
      maxConnections: 5,
      busyTimeoutMs: 30000
    };
  }

  // ... other default config methods
}

// Usage
const config = new SystemConfigBuilder()
  .database({ path: ':memory:', maxConnections: 3 })
  .agents({ maxConcurrent: 4, timeoutMs: 30000 })
  .vectorStore({ backend: 'faiss', dimensions: 384 })
  .build();
```

### Environment-based Configuration

```typescript
export class EnvironmentConfig {
  static load(): SystemConfig {
    return {
      database: {
        path: process.env.DB_PATH || './code-graph.db',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '5'),
        busyTimeoutMs: parseInt(process.env.DB_TIMEOUT_MS || '30000')
      },
      agents: {
        maxConcurrent: parseInt(process.env.AGENTS_MAX_CONCURRENT || '4'),
        timeoutMs: parseInt(process.env.AGENTS_TIMEOUT_MS || '30000'),
        enableCaching: process.env.AGENTS_ENABLE_CACHING !== 'false'
      },
      vectorStore: {
        backend: (process.env.VECTOR_BACKEND as VectorBackend) || 'faiss',
        dimensions: parseInt(process.env.VECTOR_DIMENSIONS || '384'),
        indexType: (process.env.VECTOR_INDEX_TYPE as IndexType) || 'flat'
      },
      performance: {
        memoryLimitMB: parseInt(process.env.MEMORY_LIMIT_MB || '1024'),
        cpuThreshold: parseFloat(process.env.CPU_THRESHOLD || '0.8'),
        enableOptimizations: process.env.ENABLE_OPTIMIZATIONS !== 'false'
      }
    };
  }

  static validate(config: SystemConfig): void {
    if (!config.database.path) {
      throw new Error('Database path is required');
    }
    
    if (config.agents.maxConcurrent < 1) {
      throw new Error('Agent max concurrent must be at least 1');
    }
    
    if (config.vectorStore.dimensions < 1) {
      throw new Error('Vector dimensions must be positive');
    }
  }
}
```

---

## Related Documentation
- [Agent Delegation Patterns](./agent_delegation.md)
- [Architectural Decisions](./architectural_decisions.md)
- [Development Workflow](../workflows/development_workflow.md)
- [Contributing Guide](../guides/contributing.md)