# Claude SDK Integration Architecture

## Architecture Placement

The Claude SDK integration forms the communication bridge between the MCP Server Codegraph and Claude-based AI assistants. It implements the Model Context Protocol (MCP) standard, enabling seamless tool discovery, execution, and result formatting for LLM consumption.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Claude Client  │ <->│   MCP Server    │ <->│  Code Graph     │
│  (Desktop/API)  │    │  (Claude SDK)   │    │   Database      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                v
                       ┌─────────────────┐
                       │  Tool Registry  │
                       │  & Validation   │
                       └─────────────────┘
```

## Usage Guidelines

### MCP Server Architecture
The server implements the standard MCP protocol with specialized tools for code graph operations:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export class CodeGraphMCPServer {
  private server: Server;
  private transport: StdioServerTransport;

  constructor(private graphDatabase: GraphDatabase) {
    this.server = new Server(
      {
        name: "mcp-server-codegraph",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},      // Future: template queries
          resources: {},    // Future: file content access
        },
      }
    );
    
    this.setupToolHandlers();
    this.setupErrorHandling();
  }
}
```

### Tool Registration and Schema Definition
```typescript
interface CodeGraphTools {
  // Core indexing
  index: IndexTool;
  
  // Entity queries
  list_file_entities: ListFileEntitiesTool;
  search_entities: SearchEntitiesTool;
  get_entity_details: GetEntityDetailsTool;
  
  // Relationship queries
  list_entity_relationships: ListEntityRelationshipsTool;
  find_references: FindReferencesTool;
  who_calls: WhoCallsTool;
  who_is_called_by: WhoIsCalledByTool;
  
  // Impact analysis
  impacted_by_change: ImpactedByChangeTool;
  find_dependencies: FindDependenciesTool;
  list_cycles: ListCyclesTool;
  
  // Repository insights
  repository_stats: RepositoryStatsTool;
  hotspot_analysis: HotspotAnalysisTool;
}

// Schema definition with Zod for validation
const ListFileEntitiesSchema = z.object({
  path: z.string()
    .describe("Relative path of the file from repository root"),
  entity_types: z.array(z.string())
    .optional()
    .describe("Filter by entity types (Function, Class, Variable, etc.)"),
  include_private: z.boolean()
    .default(true)
    .describe("Include private/internal entities")
});
```

## Coding Recommendations

### Tool Handler Pattern
```typescript
export class ToolHandlers {
  constructor(
    private graphDb: GraphDatabase,
    private logger: Logger
  ) {}

  async handleListFileEntities(args: ListFileEntitiesArgs): Promise<ToolResponse> {
    try {
      const { path, entity_types, include_private } = args;
      
      // Validate file exists and is indexed
      const file = await this.graphDb.getFile(path);
      if (!file) {
        return this.createErrorResponse(`File not found or not indexed: ${path}`);
      }

      // Build query with filters
      const entities = await this.graphDb.getFileEntities({
        filePath: path,
        entityTypes: entity_types,
        includePrivate: include_private
      });

      // Format for LLM consumption
      return this.createSuccessResponse({
        file_path: path,
        entity_count: entities.length,
        entities: entities.map(this.formatEntityForLLM),
        summary: this.generateEntitySummary(entities)
      });

    } catch (error) {
      this.logger.error('Error in list_file_entities', { path: args.path, error });
      return this.createErrorResponse(`Internal error: ${error.message}`);
    }
  }

  private formatEntityForLLM(entity: Entity): FormattedEntity {
    return {
      name: entity.name,
      type: entity.type,
      location: `${entity.startLine}-${entity.endLine}`,
      visibility: entity.visibility || 'public',
      signature: entity.signature,
      description: this.generateEntityDescription(entity)
    };
  }
}
```

### Response Formatting for LLM Optimization
```typescript
export class ResponseFormatter {
  // Format responses to be LLM-friendly
  formatEntityListResponse(entities: Entity[]): string {
    if (entities.length === 0) {
      return "No entities found in the specified file.";
    }

    const grouped = this.groupEntitiesByType(entities);
    const sections = Object.entries(grouped).map(([type, items]) => {
      const formattedItems = items.map(entity => 
        `  - ${entity.name} (lines ${entity.startLine}-${entity.endLine})`
      ).join('\n');
      
      return `${type}s (${items.length}):\n${formattedItems}`;
    });

    return sections.join('\n\n');
  }

  formatRelationshipResponse(relationships: Relationship[]): string {
    if (relationships.length === 0) {
      return "No relationships found for the specified entity.";
    }

    const byType = this.groupRelationshipsByType(relationships);
    const sections = Object.entries(byType).map(([type, rels]) => {
      const formatted = rels.map(rel => 
        `  - ${rel.source.name} → ${rel.target.name} (${rel.target.file}:${rel.target.startLine})`
      ).join('\n');
      
      return `${type} relationships (${rels.length}):\n${formatted}`;
    });

    return sections.join('\n\n');
  }
}
```

### Error Handling and Validation
```typescript
export class MCPErrorHandler {
  static handleToolError(error: unknown, toolName: string, args: any): ToolResponse {
    // Log the error for debugging
    console.error(`Tool ${toolName} failed:`, error, 'Args:', args);

    if (error instanceof ValidationError) {
      return {
        content: [{ 
          type: "text", 
          text: `Invalid arguments for ${toolName}: ${error.message}` 
        }],
        isError: true
      };
    }

    if (error instanceof DatabaseError) {
      return {
        content: [{ 
          type: "text", 
          text: `Database error in ${toolName}. Please try re-indexing if the issue persists.` 
        }],
        isError: true
      };
    }

    // Generic error response
    return {
      content: [{ 
        type: "text", 
        text: `An unexpected error occurred in ${toolName}. Please check the server logs.` 
      }],
      isError: true
    };
  }
}
```

## Performance Considerations

### Commodity Hardware Optimizations

#### Response Streaming for Large Results
```typescript
export class StreamingResponse {
  async streamLargeEntityList(entities: Entity[]): AsyncGenerator<string> {
    const CHUNK_SIZE = 100;
    
    for (let i = 0; i < entities.length; i += CHUNK_SIZE) {
      const chunk = entities.slice(i, i + CHUNK_SIZE);
      const formatted = this.formatEntityChunk(chunk, i);
      yield formatted;
      
      // Yield control to prevent blocking
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  private formatEntityChunk(entities: Entity[], offset: number): string {
    return entities.map((entity, index) => 
      `${offset + index + 1}. ${entity.name} (${entity.type}) - ${entity.file}:${entity.startLine}`
    ).join('\n');
  }
}
```

#### Query Result Caching
```typescript
export class QueryCache {
  private cache = new Map<string, { result: any; timestamp: number }>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  async getCachedResult<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.TTL_MS) {
      return cached.result;
    }

    const result = await fetcher();
    this.cache.set(key, { result, timestamp: now });
    
    // Clean up old entries periodically
    this.cleanupExpiredEntries(now);
    
    return result;
  }

  private cleanupExpiredEntries(now: number): void {
    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) >= this.TTL_MS) {
        this.cache.delete(key);
      }
    }
  }
}
```

#### Memory-Efficient Tool Execution
```typescript
export class MemoryEfficientToolExecutor {
  private readonly maxConcurrentTools = 3;
  private activeTasks = new Set<Promise<any>>();

  async executeTool(toolName: string, args: any): Promise<ToolResponse> {
    // Wait if too many concurrent executions
    if (this.activeTasks.size >= this.maxConcurrentTools) {
      await Promise.race(this.activeTasks);
    }

    const task = this.executeToolInternal(toolName, args);
    this.activeTasks.add(task);
    
    task.finally(() => {
      this.activeTasks.delete(task);
    });

    return await task;
  }

  private async executeToolInternal(toolName: string, args: any): Promise<ToolResponse> {
    // Implementation with memory monitoring
    const initialMemory = process.memoryUsage().heapUsed;
    
    try {
      const result = await this.handlers[toolName](args);
      
      // Log memory usage for monitoring
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemory - initialMemory;
      
      if (memoryDelta > 50 * 1024 * 1024) { // 50MB threshold
        console.warn(`Tool ${toolName} used ${memoryDelta / 1024 / 1024}MB memory`);
      }
      
      return result;
    } finally {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }
}
```

## Integration Patterns

### With GraphDatabase Layer
```typescript
export class DatabaseIntegration {
  constructor(
    private db: GraphDatabase,
    private cache: QueryCache
  ) {}

  async getEntityWithRelationships(entityId: string): Promise<EntityWithRelationships> {
    const cacheKey = `entity_with_rels:${entityId}`;
    
    return await this.cache.getCachedResult(cacheKey, async () => {
      const [entity, relationships] = await Promise.all([
        this.db.getEntity(entityId),
        this.db.getEntityRelationships(entityId)
      ]);

      return {
        entity,
        relationships,
        relationshipCount: relationships.length,
        callGraph: this.buildCallGraph(relationships)
      };
    });
  }
}
```

### With Vector Store for Enhanced Search
```typescript
export class HybridSearchTool {
  async searchEntitiesHybrid(args: SearchEntitiesArgs): Promise<ToolResponse> {
    const { query, limit = 20, include_semantic = true } = args;
    
    // Parallel execution of structural and semantic search
    const [structuralResults, semanticResults] = await Promise.all([
      this.searchStructural(query, limit),
      include_semantic ? this.searchSemantic(query, limit) : []
    ]);

    // Merge and rank results
    const mergedResults = this.mergeSearchResults(structuralResults, semanticResults);
    
    return this.createSuccessResponse({
      query,
      total_results: mergedResults.length,
      results: mergedResults.slice(0, limit),
      search_types: include_semantic ? ['structural', 'semantic'] : ['structural']
    });
  }
}
```

### With LiteRAG Multi-Agent System
```typescript
export class AgentCoordinator {
  private agents: Map<string, ToolAgent> = new Map();

  constructor() {
    // Initialize specialized agents
    this.agents.set('parser', new ParsingAgent());
    this.agents.set('query', new QueryAgent());
    this.agents.set('analysis', new AnalysisAgent());
  }

  async processComplexQuery(query: ComplexQuery): Promise<ToolResponse> {
    // Decompose complex query into sub-tasks
    const tasks = this.decomposeQuery(query);
    
    // Assign tasks to appropriate agents
    const agentTasks = tasks.map(task => ({
      agent: this.selectAgent(task.type),
      task
    }));

    // Execute tasks in parallel where possible
    const results = await this.executeAgentTasks(agentTasks);
    
    // Synthesize final response
    return this.synthesizeResults(results);
  }
}
```

## Configuration Options

### Server Configuration
```typescript
interface MCPServerConfig {
  // Server settings
  maxConcurrentTools: number;
  responseTimeoutMs: number;
  cacheEnabled: boolean;
  cacheTTLMs: number;
  
  // Tool-specific settings
  maxResultsPerQuery: number;
  enableSemanticSearch: boolean;
  enableAdvancedAnalysis: boolean;
  
  // Performance settings
  streamingThreshold: number;    // Stream results above this count
  memoryWarningThresholdMB: number;
  gcEnabled: boolean;
}

// Environment-based configuration
const serverConfig: MCPServerConfig = {
  maxConcurrentTools: parseInt(process.env.MCP_MAX_CONCURRENT_TOOLS || '3'),
  responseTimeoutMs: parseInt(process.env.MCP_RESPONSE_TIMEOUT_MS || '30000'),
  cacheEnabled: process.env.MCP_CACHE_ENABLED !== 'false',
  cacheTTLMs: parseInt(process.env.MCP_CACHE_TTL_MS || '300000'),
  maxResultsPerQuery: parseInt(process.env.MCP_MAX_RESULTS || '1000'),
  enableSemanticSearch: process.env.MCP_SEMANTIC_SEARCH === 'true',
  enableAdvancedAnalysis: process.env.MCP_ADVANCED_ANALYSIS === 'true',
  streamingThreshold: parseInt(process.env.MCP_STREAMING_THRESHOLD || '100'),
  memoryWarningThresholdMB: parseInt(process.env.MCP_MEMORY_WARNING_MB || '50'),
  gcEnabled: process.env.MCP_GC_ENABLED === 'true'
};
```

### Tool-Specific Configuration
```typescript
interface ToolConfiguration {
  [toolName: string]: {
    enabled: boolean;
    maxResults?: number;
    timeoutMs?: number;
    cacheTTLMs?: number;
    memoryLimitMB?: number;
  };
}

const toolConfig: ToolConfiguration = {
  'list_file_entities': {
    enabled: true,
    maxResults: 500,
    timeoutMs: 5000,
    cacheTTLMs: 300000
  },
  'find_references': {
    enabled: true,
    maxResults: 200,
    timeoutMs: 10000,
    cacheTTLMs: 600000
  },
  'impacted_by_change': {
    enabled: true,
    maxResults: 100,
    timeoutMs: 15000,
    memoryLimitMB: 100
  }
};
```

## Monitoring and Diagnostics

### Tool Usage Analytics
```typescript
export class ToolAnalytics {
  private metrics = new Map<string, ToolMetrics>();

  recordToolUsage(toolName: string, duration: number, success: boolean, resultCount: number): void {
    const metric = this.metrics.get(toolName) || this.createEmptyMetric();
    
    metric.totalCalls++;
    metric.totalDuration += duration;
    metric.successCount += success ? 1 : 0;
    metric.avgResultCount = (metric.avgResultCount + resultCount) / 2;
    metric.lastUsed = new Date();
    
    this.metrics.set(toolName, metric);
  }

  getToolStats(): ToolStats[] {
    return Array.from(this.metrics.entries()).map(([name, metric]) => ({
      toolName: name,
      totalCalls: metric.totalCalls,
      successRate: metric.successCount / metric.totalCalls,
      avgDurationMs: metric.totalDuration / metric.totalCalls,
      avgResultCount: metric.avgResultCount,
      lastUsed: metric.lastUsed
    }));
  }
}
```

### Health Monitoring
```typescript
export class MCPHealthMonitor {
  async checkHealth(): Promise<HealthReport> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      const dbHealth = await this.checkDatabaseHealth();
      const memoryUsage = process.memoryUsage();
      const toolStats = this.analytics.getToolStats();
      
      return {
        status: 'healthy',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        database: dbHealth,
        memory: {
          heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rssUsedMB: Math.round(memoryUsage.rss / 1024 / 1024)
        },
        tools: {
          totalTools: toolStats.length,
          activeTools: toolStats.filter(t => t.lastUsed > new Date(Date.now() - 3600000)).length,
          avgSuccessRate: toolStats.reduce((sum, t) => sum + t.successRate, 0) / toolStats.length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }
}
```

## Advanced Features

### Prompt Templates (Future Enhancement)
```typescript
interface PromptTemplate {
  name: string;
  description: string;
  template: string;
  parameters: ParameterDefinition[];
}

const codeAnalysisPrompts: PromptTemplate[] = [
  {
    name: "explain_function",
    description: "Generate explanation for a function based on its code and relationships",
    template: `
      Analyze the function "{{functionName}}" in file "{{filePath}}":
      
      Function Details:
      {{functionDetails}}
      
      Called By:
      {{callers}}
      
      Calls:
      {{callees}}
      
      Please explain what this function does, its role in the codebase, and any notable patterns.
    `,
    parameters: [
      { name: "functionName", type: "string", required: true },
      { name: "filePath", type: "string", required: true }
    ]
  }
];
```

### Resource Access (Future Enhancement)
```typescript
export class ResourceProvider {
  async getFileContent(uri: string): Promise<ResourceContent> {
    // Provide file content with proper permissions
    const content = await this.fileSystem.readFile(uri);
    
    return {
      uri,
      mimeType: 'text/plain',
      content: content,
      metadata: {
        size: content.length,
        lastModified: await this.fileSystem.getLastModified(uri),
        encoding: 'utf-8'
      }
    };
  }
}
```

### Advanced Tool Composition
```typescript
export class CompositeTools {
  async analyzeCodeChangeImpact(args: CodeChangeArgs): Promise<ToolResponse> {
    // Multi-step analysis combining several tools
    const steps = [
      () => this.findAffectedEntities(args.changedFiles),
      (entities) => this.findDependentCode(entities),
      (dependencies) => this.assessRiskLevel(dependencies),
      (risks) => this.generateRecommendations(risks)
    ];

    const results = await this.executeSteps(steps);
    
    return this.createSuccessResponse({
      impact_analysis: results,
      summary: this.generateImpactSummary(results),
      recommendations: results.recommendations
    });
  }
}
```