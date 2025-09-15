#!/usr/bin/env node

/**
 * TASK-002: MCP Server for Code Graph Analysis with Semantic Tools
 * Multi-agent LiteRAG architecture optimized for commodity hardware
 * 
 * This server implements 8 new semantic-aware MCP tools that leverage
 * QueryAgent and SemanticAgent for advanced code analysis capabilities.
 * 
 * @task_id TASK-002
 * @history
 *  - 2025-09-14: Enhanced by Dev-Agent - TASK-002: Added 8 new semantic MCP tools
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import os from "node:os";
import { join, normalize, resolve } from "node:path";

// Import our multi-agent components
import { ConductorOrchestrator } from './agents/conductor-orchestrator.js';
import { knowledgeBus } from './core/knowledge-bus.js';
import { resourceManager } from './core/resource-manager.js';
import { AgentTask } from './types/agent.js';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: code-graph-rag-mcp <directory>");
  process.exit(1);
}

function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

const directory = normalize(resolve(expandHome(args[0] as string)));

// Initialize resource manager with commodity hardware constraints
resourceManager.startMonitoring();

// Initialize conductor orchestrator lazily
let conductor: ConductorOrchestrator | null = null;

function getConductor(): ConductorOrchestrator {
  if (!conductor) {
    conductor = new ConductorOrchestrator({
      resourceConstraints: {
        maxMemoryMB: 1024, // 1GB for our process
        maxCpuPercent: 80,
        maxConcurrentAgents: 10,
        maxTaskQueueSize: 100
      },
      taskQueueLimit: 100,
      loadBalancingStrategy: 'least-loaded',
      complexityThreshold: 5, // Require approval for complexity > 5
      mandatoryDelegation: true // ENFORCE delegation to dev-agent or Dora
    });
  }
  return conductor;
}

// Helper functions for agent access - TASK-002
async function getQueryAgent(): Promise<any> {
  const cond = getConductor();
  await cond.initialize();
  let agent = cond.agents.get('query-agent');
  if (!agent) {
    // Import dynamically to avoid circular dependencies
    const { QueryAgent } = await import('./agents/query-agent.js');
    agent = new QueryAgent();
    await agent.initialize();
    cond.register(agent);
  }
  return agent;
}

async function getSemanticAgent(): Promise<any> {
  const cond = getConductor();
  await cond.initialize();
  let agent = cond.agents.get('semantic-agent');
  if (!agent) {
    // Import dynamically to avoid circular dependencies
    const { SemanticAgent } = await import('./agents/semantic-agent.js');
    agent = new SemanticAgent();
    await agent.initialize();
    cond.register(agent);
  }
  return agent;
}

// Tool schemas
const IndexToolSchema = z.object({
  directory: z.string().describe("Directory to index").optional(),
  incremental: z.boolean().describe("Perform incremental indexing").optional().default(false),
  excludePatterns: z.array(z.string()).describe("Patterns to exclude").optional()
});

const ListEntitiesToolSchema = z.object({
  filePath: z.string().describe("Path to the file to list entities from"),
  entityTypes: z.array(z.string()).describe("Types of entities to list").optional()
});

const ListRelationshipsToolSchema = z.object({
  entityName: z.string().describe("Name of the entity to find relationships for"),
  depth: z.number().describe("Depth of relationship traversal").optional().default(1),
  relationshipTypes: z.array(z.string()).describe("Types of relationships to include").optional()
});

const QueryToolSchema = z.object({
  query: z.string().describe("Natural language or structured query"),
  limit: z.number().describe("Maximum number of results").optional().default(10)
});

// New semantic tool schemas - TASK-002
const SemanticSearchSchema = z.object({
  query: z.string().describe("Natural language search query"),
  limit: z.number().optional().default(10).describe("Maximum results to return")
});

const FindSimilarCodeSchema = z.object({
  code: z.string().describe("Code snippet to find similar code for"),
  threshold: z.number().optional().default(0.7).describe("Similarity threshold (0-1)"),
  limit: z.number().optional().default(10).describe("Maximum results to return")
});

const AnalyzeCodeImpactSchema = z.object({
  entityId: z.string().describe("Entity ID to analyze impact for"),
  depth: z.number().optional().default(2).describe("Depth of impact analysis")
});

const DetectCodeClonesSchema = z.object({
  minSimilarity: z.number().optional().default(0.8).describe("Minimum similarity for clones"),
  scope: z.string().optional().default("all").describe("Scope: all, file, or module")
});

const SuggestRefactoringSchema = z.object({
  filePath: z.string().describe("File to analyze for refactoring"),
  focusArea: z.string().optional().describe("Specific area to focus on")
});

const CrossLanguageSearchSchema = z.object({
  query: z.string().describe("Search query"),
  languages: z.array(z.string()).optional().describe("Languages to search in")
});

const AnalyzeHotspotsSchema = z.object({
  metric: z.string().optional().default("complexity").describe("Metric: complexity, changes, or coupling"),
  limit: z.number().optional().default(10).describe("Maximum hotspots to return")
});

const FindRelatedConceptsSchema = z.object({
  entityId: z.string().describe("Entity to find related concepts for"),
  limit: z.number().optional().default(10).describe("Maximum results to return")
});

// Create MCP server
const server = new Server({
  name: "code-graph-rag-mcp",
  version: "2.0.0", // Bumped for multi-agent architecture
}, {
  capabilities: {
    tools: {},
    resources: {}
  }
});

// Handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "index",
        description: "Index a codebase using multi-agent parsing and analysis",
        inputSchema: zodToJsonSchema(IndexToolSchema) as any
      },
      {
        name: "list_file_entities",
        description: "List all entities (functions, classes, etc.) in a file",
        inputSchema: zodToJsonSchema(ListEntitiesToolSchema) as any
      },
      {
        name: "list_entity_relationships",
        description: "List all relationships for a specific entity",
        inputSchema: zodToJsonSchema(ListRelationshipsToolSchema) as any
      },
      {
        name: "query",
        description: "Query the code graph using natural language or structured queries",
        inputSchema: zodToJsonSchema(QueryToolSchema) as any
      },
      {
        name: "get_metrics",
        description: "Get system metrics and agent performance statistics",
        inputSchema: zodToJsonSchema(z.object({})) as any
      },
      // New semantic tools - TASK-002
      {
        name: "semantic_search",
        description: "Search code using natural language queries with semantic understanding",
        inputSchema: zodToJsonSchema(SemanticSearchSchema) as any
      },
      {
        name: "find_similar_code",
        description: "Find code similar to a given snippet using semantic analysis",
        inputSchema: zodToJsonSchema(FindSimilarCodeSchema) as any
      },
      {
        name: "analyze_code_impact",
        description: "Analyze the impact of changes to a specific entity",
        inputSchema: zodToJsonSchema(AnalyzeCodeImpactSchema) as any
      },
      {
        name: "detect_code_clones",
        description: "Find duplicate or similar code blocks across the codebase",
        inputSchema: zodToJsonSchema(DetectCodeClonesSchema) as any
      },
      {
        name: "suggest_refactoring",
        description: "Get refactoring suggestions for improving code quality",
        inputSchema: zodToJsonSchema(SuggestRefactoringSchema) as any
      },
      {
        name: "cross_language_search",
        description: "Search across multiple programming languages",
        inputSchema: zodToJsonSchema(CrossLanguageSearchSchema) as any
      },
      {
        name: "analyze_hotspots",
        description: "Find code hotspots based on complexity, changes, or coupling",
        inputSchema: zodToJsonSchema(AnalyzeHotspotsSchema) as any
      },
      {
        name: "find_related_concepts",
        description: "Find conceptually related code to a given entity",
        inputSchema: zodToJsonSchema(FindRelatedConceptsSchema) as any
      }
    ]
  };
});

// Handler for tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case "index": {
        const { directory: indexDir, incremental, excludePatterns } = IndexToolSchema.parse(args);
        const targetDir = indexDir || directory;
        
        // Create indexing task
        const task: AgentTask = {
          id: `index-${Date.now()}`,
          type: 'index',
          priority: 8,
          payload: {
            directory: targetDir,
            incremental,
            excludePatterns
          },
          createdAt: Date.now()
        };
        
        // Process through conductor with mandatory delegation
        const cond = getConductor();
        await cond.initialize();
        const result = await cond.process(task);
        
        // Publish to knowledge bus
        knowledgeBus.publish('index:completed', result, 'mcp-server');
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Indexing completed",
                result
              }, null, 2)
            }
          ]
        };
      }
      
      case "list_file_entities": {
        const { filePath, entityTypes } = ListEntitiesToolSchema.parse(args);
        
        // Query knowledge bus for cached results
        const cached = knowledgeBus.query(`entities:${filePath}`, 1);
        if (cached.length > 0) {
          const firstCache = cached[0];
          if (firstCache && Date.now() - firstCache.timestamp < 60000) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(firstCache.data, null, 2)
                }
              ]
            };
          }
        }
        
        // Create query task
        const task: AgentTask = {
          id: `list-entities-${Date.now()}`,
          type: 'query',
          priority: 5,
          payload: {
            operation: 'list_entities',
            filePath,
            entityTypes
          },
          createdAt: Date.now()
        };
        
        const cond = getConductor();
        const result = await cond.process(task);
        
        // Cache result
        knowledgeBus.publish(`entities:${filePath}`, result, 'mcp-server', 60000);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      
      case "list_entity_relationships": {
        const { entityName, depth, relationshipTypes } = ListRelationshipsToolSchema.parse(args);
        
        // Create relationship query task
        const task: AgentTask = {
          id: `list-relationships-${Date.now()}`,
          type: 'query',
          priority: 6,
          payload: {
            operation: 'list_relationships',
            entityName,
            depth,
            relationshipTypes
          },
          createdAt: Date.now()
        };
        
        const cond = getConductor();
        const result = await cond.process(task);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      
      case "query": {
        const { query, limit } = QueryToolSchema.parse(args);
        
        // Create semantic query task
        const task: AgentTask = {
          id: `semantic-query-${Date.now()}`,
          type: 'semantic',
          priority: 7,
          payload: {
            query,
            limit
          },
          createdAt: Date.now()
        };
        
        const cond = getConductor();
        const result = await cond.process(task);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      
      case "get_metrics": {
        const resourceStats = resourceManager.getCurrentUsage();
        const knowledgeStats = knowledgeBus.getStats();
        const cond = getConductor();
        const conductorMetrics = cond.getMetrics();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                resources: resourceStats,
                knowledge: knowledgeStats,
                conductor: conductorMetrics,
                agents: Array.from(cond.agents.values()).map(agent => ({
                  id: agent.id,
                  type: agent.type,
                  status: agent.status,
                  memoryUsage: agent.getMemoryUsage(),
                  cpuUsage: agent.getCpuUsage(),
                  queueSize: agent.getTaskQueue().length
                }))
              }, null, 2)
            }
          ]
        };
      }
      
      // New semantic tool handlers - TASK-002
      case "semantic_search": {
        const { query, limit } = SemanticSearchSchema.parse(args);
        
        // Check cache first
        const cacheKey = `semantic:search:${query}:${limit}`;
        const cached = knowledgeBus.query(cacheKey, 1);
        if (cached.length > 0) {
          const firstCache = cached[0];
          if (firstCache && Date.now() - firstCache.timestamp < 30000) { // 30s cache
            return {
              content: [{
                type: "text",
                text: JSON.stringify(firstCache.data, null, 2)
              }]
            };
          }
        }
        
        const task: AgentTask = {
          id: `semantic-search-${Date.now()}`,
          type: 'semantic',
          priority: 8,
          payload: { 
            operation: 'semantic_search', 
            query, 
            limit 
          },
          createdAt: Date.now()
        };
        
        const semanticAgent = await getSemanticAgent();
        const result = await semanticAgent.process(task);
        
        // Cache result
        knowledgeBus.publish(cacheKey, result, 'mcp-server', 30000);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case "find_similar_code": {
        const { code, threshold, limit } = FindSimilarCodeSchema.parse(args);
        
        const task: AgentTask = {
          id: `find-similar-${Date.now()}`,
          type: 'semantic',
          priority: 7,
          payload: { 
            operation: 'find_similar', 
            code, 
            threshold, 
            limit 
          },
          createdAt: Date.now()
        };
        
        const semanticAgent = await getSemanticAgent();
        const result = await semanticAgent.process(task);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case "analyze_code_impact": {
        const { entityId, depth } = AnalyzeCodeImpactSchema.parse(args);
        
        const task: AgentTask = {
          id: `impact-analysis-${Date.now()}`,
          type: 'query',
          priority: 8,
          payload: { 
            operation: 'impact_analysis', 
            entityId, 
            depth 
          },
          createdAt: Date.now()
        };
        
        // Use QueryAgent for dependency analysis
        const queryAgent = await getQueryAgent();
        const dependencies = await queryAgent.process(task);
        
        // Enhance with semantic understanding
        const semanticTask: AgentTask = {
          id: `semantic-impact-${Date.now()}`,
          type: 'semantic',
          priority: 7,
          payload: {
            operation: 'analyze_impact',
            dependencies,
            entityId
          },
          createdAt: Date.now()
        };
        
        const semanticAgent = await getSemanticAgent();
        const enhancedResult = await semanticAgent.process(semanticTask);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(enhancedResult, null, 2)
          }]
        };
      }
      
      case "detect_code_clones": {
        const { minSimilarity, scope } = DetectCodeClonesSchema.parse(args);
        
        const task: AgentTask = {
          id: `clone-detection-${Date.now()}`,
          type: 'semantic',
          priority: 6,
          payload: { 
            operation: 'detect_clones', 
            minSimilarity, 
            scope 
          },
          createdAt: Date.now()
        };
        
        const semanticAgent = await getSemanticAgent();
        const result = await semanticAgent.process(task);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case "suggest_refactoring": {
        const { filePath, focusArea } = SuggestRefactoringSchema.parse(args);
        
        const task: AgentTask = {
          id: `refactoring-${Date.now()}`,
          type: 'semantic',
          priority: 7,
          payload: { 
            operation: 'suggest_refactoring', 
            filePath, 
            focusArea 
          },
          createdAt: Date.now()
        };
        
        const semanticAgent = await getSemanticAgent();
        const result = await semanticAgent.process(task);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case "cross_language_search": {
        const { query, languages } = CrossLanguageSearchSchema.parse(args);
        
        const task: AgentTask = {
          id: `cross-lang-${Date.now()}`,
          type: 'semantic',
          priority: 7,
          payload: { 
            operation: 'cross_language_search', 
            query, 
            languages 
          },
          createdAt: Date.now()
        };
        
        const semanticAgent = await getSemanticAgent();
        const result = await semanticAgent.process(task);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case "analyze_hotspots": {
        const { metric, limit } = AnalyzeHotspotsSchema.parse(args);
        
        // Query for usage patterns
        const queryTask: AgentTask = {
          id: `hotspot-query-${Date.now()}`,
          type: 'query',
          priority: 7,
          payload: { 
            operation: 'find_hotspots', 
            metric, 
            limit 
          },
          createdAt: Date.now()
        };
        
        const queryAgent = await getQueryAgent();
        const hotspots = await queryAgent.process(queryTask);
        
        // Enhance with semantic analysis
        const semanticTask: AgentTask = {
          id: `hotspot-semantic-${Date.now()}`,
          type: 'semantic',
          priority: 6,
          payload: {
            operation: 'analyze_hotspots',
            hotspots,
            metric
          },
          createdAt: Date.now()
        };
        
        const semanticAgent = await getSemanticAgent();
        const enhancedResult = await semanticAgent.process(semanticTask);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(enhancedResult, null, 2)
          }]
        };
      }
      
      case "find_related_concepts": {
        const { entityId, limit } = FindRelatedConceptsSchema.parse(args);
        
        const task: AgentTask = {
          id: `related-concepts-${Date.now()}`,
          type: 'semantic',
          priority: 7,
          payload: { 
            operation: 'find_related_concepts', 
            entityId, 
            limit 
          },
          createdAt: Date.now()
        };
        
        const semanticAgent = await getSemanticAgent();
        const result = await semanticAgent.process(task);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: errorMessage
          }, null, 2)
        }
      ]
    };
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  if (conductor) {
    await conductor.shutdown();
  }
  resourceManager.stopMonitoring();
  process.exit(0);
});

// Start the server
async function main() {
  console.log(`Starting MCP Code Graph Server for directory: ${directory}`);
  console.log('Multi-agent LiteRAG architecture initialized');
  console.log(`Resource constraints: 1GB memory, 80% CPU, 10 concurrent agents`);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('MCP server running on stdio transport');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});