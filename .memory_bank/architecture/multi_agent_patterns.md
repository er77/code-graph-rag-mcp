# Multi-Agent Patterns & LiteRAG Architecture

## Overview

LiteRAG (Lightweight Retrieval-Augmented Generation) patterns enable the MCP Server Codegraph to operate as a multi-agent system optimized for commodity hardware. This architecture distributes code analysis tasks across specialized agents while maintaining low resource overhead and efficient coordination.

## 🏗️ Architecture Components

### Agent Specialization Strategy

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │ -> │  Agent Router   │ -> │ Specialized     │
│   (Claude)      │    │  & Coordinator  │    │ Code Agents     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                v                        v
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Task Queue     │    │  Knowledge      │
                       │  & Scheduling   │    │  Sharing Bus    │
                       └─────────────────┘    └─────────────────┘
                                │                        │
                                v                        v
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Shared         │    │  Result         │
                       │  Resources      │    │  Aggregation    │
                       │  (DB, Cache)    │    │  & Synthesis    │
                       └─────────────────┘    └─────────────────┘
```

### Core Agent Types

```typescript
export enum AgentType {
  PARSER = 'parser',           // AST parsing and entity extraction
  INDEXER = 'indexer',         // Graph indexing and persistence
  QUERY = 'query',             // Graph traversal and search
  SEMANTIC = 'semantic',       // Vector operations and similarity
  ANALYSIS = 'analysis',       // Complex analysis patterns
  COORDINATOR = 'coordinator'  // Task orchestration
}

export interface CodeAnalysisAgent {
  name: string;
  capabilities: string[];
  resourceRequirements: ResourceRequirements;
  process(task: AnalysisTask): Promise<AgentResult>;
  canHandle(task: AnalysisTask): boolean;
}
```

## 🎯 Agent Implementations

### Lightweight Agent Base Class

```typescript
export abstract class LiteRAGAgent implements CodeAnalysisAgent {
  protected isActive: boolean = false;
  protected currentTask?: AnalysisTask;
  protected metrics: AgentMetrics = new AgentMetrics();

  constructor(
    public readonly name: string,
    public readonly capabilities: string[],
    public readonly resourceRequirements: ResourceRequirements
  ) {}

  abstract process(task: AnalysisTask): Promise<AgentResult>;

  async safeProcess(task: AnalysisTask): Promise<AgentResult> {
    this.isActive = true;
    this.currentTask = task;
    this.metrics.startTask();

    try {
      await this.validateResources();
      await this.prepareForTask(task);
      const result = await this.process(task);
      await this.cleanupAfterTask();
      
      this.metrics.completeTask(true);
      return result;

    } catch (error) {
      this.metrics.completeTask(false);
      throw new AgentExecutionError(this.name, task.id, error);
    } finally {
      this.isActive = false;
      this.currentTask = undefined;
    }
  }
}
```

### Parser Agent Implementation

```typescript
export class ParserAgent extends LiteRAGAgent {
  private treeParser: TreeSitterParser;
  private entityExtractor: EntityExtractor;

  constructor() {
    super('parser-agent', ['parse', 'extract-entities'], {
      memoryMB: 128,
      cpuCores: 0.5,
      diskMB: 10
    });
  }

  async process(task: AnalysisTask): Promise<AgentResult> {
    const parseTask = task as ParseTask;
    const results: ParseResult[] = [];

    // Process files in small batches to manage memory
    const batchSize = this.calculateOptimalBatchSize();
    
    for (let i = 0; i < parseTask.files.length; i += batchSize) {
      const batch = parseTask.files.slice(i, i + batchSize);
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);

      await this.yieldControl();
      await this.cleanupBatchResources();
    }

    return {
      agentName: this.name,
      taskId: task.id,
      success: true,
      data: results,
      metadata: {
        filesProcessed: parseTask.files.length,
        entitiesExtracted: results.reduce((sum, r) => sum + r.entities.length, 0),
        processingTimeMs: this.metrics.getLastTaskDuration()
      }
    };
  }

  private calculateOptimalBatchSize(): number {
    const availableMemory = this.getAvailableMemoryMB();
    // Conservative estimate: 10MB memory per file during parsing
    return Math.max(1, Math.floor(availableMemory / 10));
  }
}
```

### Query Agent Implementation

```typescript
export class QueryAgent extends LiteRAGAgent {
  private graphDb: GraphDatabase;
  private queryOptimizer: QueryOptimizer;
  private resultFormatter: ResultFormatter;

  constructor(graphDb: GraphDatabase) {
    super('query-agent', ['search', 'traverse', 'analyze'], {
      memoryMB: 64,
      cpuCores: 0.3,
      diskMB: 5
    });
    this.graphDb = graphDb;
  }

  async process(task: AnalysisTask): Promise<AgentResult> {
    const queryTask = task as QueryTask;
    
    // Optimize query for performance
    const optimizedQuery = await this.queryOptimizer.optimize(queryTask.query);
    
    // Execute with timeout and resource monitoring
    const result = await this.executeWithTimeout(
      () => this.executeQuery(optimizedQuery),
      queryTask.timeoutMs || 30000
    );

    return {
      agentName: this.name,
      taskId: task.id,
      success: true,
      data: this.resultFormatter.format(result, queryTask.format),
      metadata: {
        queryType: queryTask.query.type,
        resultCount: result.length,
        executionTimeMs: this.metrics.getLastTaskDuration(),
        cacheHit: result.fromCache || false
      }
    };
  }
}
```

## 🤝 Agent Coordination

### Task Graph Execution

```typescript
export class AgentCoordinator {
  private agents: Map<string, LiteRAGAgent> = new Map();
  private taskQueue: PriorityQueue<CoordinatedTask> = new PriorityQueue();
  private knowledgeSharing: KnowledgeSharingBus = new KnowledgeSharingBus();

  async executeComplexAnalysis(request: ComplexAnalysisRequest): Promise<AnalysisResult> {
    // Decompose complex request into agent tasks
    const taskGraph = await this.decomposeRequest(request);
    
    // Execute tasks respecting dependencies
    return await this.executeTaskGraph(taskGraph);
  }

  private async decomposeRequest(request: ComplexAnalysisRequest): Promise<TaskGraph> {
    const tasks: CoordinatedTask[] = [];

    switch (request.type) {
      case 'code-impact-analysis':
        tasks.push(
          // Step 1: Parse changed files
          this.createTask('parse', { files: request.changedFiles }, []),
          
          // Step 2: Find affected entities (depends on parse)
          this.createTask('query', { 
            type: 'find-entities', 
            files: request.changedFiles 
          }, ['parse']),
          
          // Step 3: Traverse dependencies (depends on find-entities)
          this.createTask('query', { 
            type: 'traverse-dependencies' 
          }, ['query-1']),
          
          // Step 4: Analyze semantic impact (parallel with structural)
          this.createTask('semantic', { 
            type: 'similarity-analysis' 
          }, ['query-1']),
          
          // Step 5: Synthesize results (depends on all previous)
          this.createTask('analysis', { 
            type: 'impact-synthesis' 
          }, ['query-2', 'semantic'])
        );
        break;

      case 'codebase-health-check':
        tasks.push(
          this.createTask('indexer', { type: 'validate-index' }, []),
          this.createTask('query', { type: 'find-cycles' }, ['indexer']),
          this.createTask('query', { type: 'find-hotspots' }, ['indexer']),
          this.createTask('analysis', { type: 'health-synthesis' }, ['query-1', 'query-2'])
        );
        break;
    }

    return new TaskGraph(tasks);
  }
}
```

### Resource-Aware Scheduling

```typescript
export class ResourceAwareScheduler {
  private resourceBudget: ResourceBudget;
  private activeAgents: Set<LiteRAGAgent> = new Set();

  constructor(totalResources: SystemResources) {
    this.resourceBudget = new ResourceBudget(totalResources);
  }

  async scheduleTask(task: AnalysisTask): Promise<LiteRAGAgent | null> {
    const requiredResources = this.estimateTaskResources(task);
    
    // Check if we have resources available
    if (!this.resourceBudget.canAllocate(requiredResources)) {
      // Try to free resources by completing quick tasks
      await this.tryCompleteQuickTasks();
      
      if (!this.resourceBudget.canAllocate(requiredResources)) {
        return null; // Queue the task
      }
    }

    // Find the most suitable agent
    const agent = await this.findOptimalAgent(task, requiredResources);
    
    if (agent) {
      this.resourceBudget.allocate(requiredResources);
      this.activeAgents.add(agent);
      
      // Set up resource monitoring
      this.monitorAgentResources(agent, requiredResources);
    }

    return agent;
  }
}
```

## 🔄 Knowledge Sharing

### Inter-Agent Communication

```typescript
export class KnowledgeSharingBus {
  private subscribers: Map<string, Set<AgentSubscriber>> = new Map();
  private knowledgeCache: Map<string, SharedKnowledge> = new Map();

  async broadcast(topic: string, knowledge: SharedKnowledge): Promise<void> {
    // Cache knowledge for future agents
    this.knowledgeCache.set(`${topic}:${knowledge.id}`, knowledge);
    
    // Notify interested agents
    const subscribers = this.subscribers.get(topic) || new Set();
    
    // Async notification to avoid blocking
    const notifications = Array.from(subscribers).map(subscriber =>
      this.notifySubscriber(subscriber, knowledge).catch(error =>
        console.warn(`Failed to notify subscriber ${subscriber.agentName}:`, error)
      )
    );
    
    await Promise.allSettled(notifications);
  }

  async getRelevantKnowledge(topic: string, context: QueryContext): Promise<SharedKnowledge[]> {
    const allKnowledge = Array.from(this.knowledgeCache.values());
    
    return allKnowledge
      .filter(knowledge => knowledge.topic === topic)
      .filter(knowledge => this.isRelevantToContext(knowledge, context))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10); // Limit to prevent memory issues
  }
}
```

## ⚡ Performance Optimizations

### Commodity Hardware Optimizations

```typescript
export class CommodityHardwareOptimizer {
  private readonly maxConcurrentAgents: number;
  private readonly memoryThreshold: number;
  private readonly cpuThreshold: number;

  constructor() {
    // Auto-detect system capabilities
    const totalMemory = os.totalmem() / 1024 / 1024; // MB
    const cpuCores = os.cpus().length;
    
    // Conservative allocation for commodity hardware
    this.maxConcurrentAgents = Math.max(2, Math.floor(cpuCores * 0.75));
    this.memoryThreshold = Math.floor(totalMemory * 0.6); // Use 60% of available memory
    this.cpuThreshold = 0.8; // 80% CPU usage threshold
  }

  async optimizeAgentExecution(): Promise<void> {
    const currentUsage = await this.getCurrentResourceUsage();
    
    if (currentUsage.memory > this.memoryThreshold) {
      await this.triggerMemoryOptimization();
    }
    
    if (currentUsage.cpuPercent > this.cpuThreshold) {
      await this.throttleAgentExecution();
    }
  }

  private async triggerMemoryOptimization(): Promise<void> {
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Clear caches
    await this.clearLeastRecentlyUsedCaches();
    
    // Pause non-critical agents
    await this.pauseNonCriticalAgents();
  }
}
```

### Agent Pool Management

```typescript
export class LiteRAGAgentPool {
  private agents: Map<AgentType, CodeAnalysisAgent[]> = new Map();
  private taskQueue: TaskQueue = new TaskQueue();
  private resourceMonitor: ResourceMonitor = new ResourceMonitor();

  constructor(private config: AgentPoolConfig) {
    this.initializeAgents();
    this.startResourceMonitoring();
  }

  private initializeAgents(): void {
    // Create lightweight agent instances
    this.createAgentPool(AgentType.PARSER, ParserAgent, 2);
    this.createAgentPool(AgentType.INDEXER, IndexerAgent, 1);
    this.createAgentPool(AgentType.QUERY, QueryAgent, 3);
    this.createAgentPool(AgentType.SEMANTIC, SemanticAgent, 1);
    this.createAgentPool(AgentType.ANALYSIS, AnalysisAgent, 2);
  }

  async assignTask(task: AnalysisTask): Promise<AgentResult> {
    // Find available agent with required capabilities
    const agentType = this.determineRequiredAgent(task);
    const agent = await this.getAvailableAgent(agentType);
    
    if (!agent) {
      // Queue task if no agents available
      return await this.taskQueue.enqueue(task);
    }

    return await this.executeWithMonitoring(agent, task);
  }
}
```

## 🔧 Configuration

### Agent Pool Configuration

```typescript
interface LiteRAGConfig {
  // Agent pool settings
  maxAgents: {
    parser: number;
    indexer: number;
    query: number;
    semantic: number;
    analysis: number;
  };
  
  // Resource constraints
  resourceLimits: {
    totalMemoryMB: number;
    maxCpuPercent: number;
    maxConcurrentTasks: number;
  };
  
  // Task scheduling
  scheduling: {
    taskTimeout: number;
    priorityLevels: number;
    queueSizeLimit: number;
  };
  
  // Knowledge sharing
  knowledgeSharing: {
    enabled: boolean;
    cacheSizeLimit: number;
    shareAcrossInstances: boolean;
  };
}

// Environment-based configuration
const literagConfig: LiteRAGConfig = {
  maxAgents: {
    parser: parseInt(process.env.LITERAG_MAX_PARSER_AGENTS || '2'),
    indexer: parseInt(process.env.LITERAG_MAX_INDEXER_AGENTS || '1'),
    query: parseInt(process.env.LITERAG_MAX_QUERY_AGENTS || '3'),
    semantic: parseInt(process.env.LITERAG_MAX_SEMANTIC_AGENTS || '1'),
    analysis: parseInt(process.env.LITERAG_MAX_ANALYSIS_AGENTS || '2')
  },
  resourceLimits: {
    totalMemoryMB: parseInt(process.env.LITERAG_MEMORY_LIMIT_MB || '512'),
    maxCpuPercent: parseFloat(process.env.LITERAG_CPU_LIMIT || '0.8'),
    maxConcurrentTasks: parseInt(process.env.LITERAG_MAX_CONCURRENT_TASKS || '5')
  }
};
```

## 📊 Monitoring & Analytics

### Agent Performance Monitoring

```typescript
export class AgentPerformanceMonitor {
  private agentMetrics: Map<string, AgentMetrics> = new Map();
  private systemMetrics: SystemMetrics = new SystemMetrics();

  async getAgentStats(): Promise<AgentStatsReport> {
    const agents = Array.from(this.agentMetrics.entries()).map(([name, metrics]) => ({
      agentName: name,
      tasksCompleted: metrics.totalTasks,
      successRate: metrics.successRate,
      avgExecutionTimeMs: metrics.avgExecutionTime,
      currentMemoryUsageMB: metrics.currentMemoryUsage,
      peakMemoryUsageMB: metrics.peakMemoryUsage,
      isActive: metrics.isActive,
      lastTaskCompletedAt: metrics.lastTaskCompleted
    }));

    return {
      agents,
      system: await this.systemMetrics.getCurrentStats(),
      coordination: await this.getCoordinationStats(),
      timestamp: new Date()
    };
  }

  async detectPerformanceAnomalies(): Promise<PerformanceAnomaly[]> {
    const anomalies: PerformanceAnomaly[] = [];
    
    // Check for stuck agents
    for (const [name, metrics] of this.agentMetrics) {
      if (metrics.isActive && metrics.getCurrentTaskDuration() > 60000) {
        anomalies.push({
          type: 'stuck_agent',
          agentName: name,
          severity: 'high',
          description: `Agent ${name} has been running for over 60 seconds`,
          recommendation: 'Consider restarting the agent or increasing task timeout'
        });
      }
    }

    return anomalies;
  }
}
```

## 🔮 Future Enhancements

### Advanced Agent Patterns
- **Hierarchical Agents**: Multi-level agent hierarchies for complex analysis
- **Learning Agents**: Agents that improve performance based on historical data
- **Fault-Tolerant Coordination**: Automatic recovery from agent failures

### Scalability Improvements
- **Distributed Agent Pools**: Agents running across multiple machines
- **Elastic Scaling**: Dynamic agent creation/destruction based on load
- **Cloud Integration**: Integration with serverless functions for burst capacity

### Enhanced Coordination
- **Graph-Based Task Dependencies**: More sophisticated task dependency modeling
- **Predictive Resource Allocation**: ML-based resource requirement prediction
- **Cross-Instance Coordination**: Coordination across multiple MCP server instances

---

## Related Documentation
- [MCP Integration Architecture](./mcp_integration.md)
- [Vector Store Architecture](./vector_store.md)
- [Tree-sitter Integration](./tree_sitter_integration.md)
- [Agent Delegation Patterns](../patterns/agent_delegation.md)