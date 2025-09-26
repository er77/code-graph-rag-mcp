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

// TASK-001: Environment variable fallback for embedding model - MUST BE FIRST
function createSafeEnvironment() {
  // Provide safe defaults for environment variables that might be undefined
  const safeEnv = {
    ...process.env,
    // Ensure these are defined to prevent "env is not defined" errors
    NODE_ENV: process.env.NODE_ENV || 'development',
    MCP_EMBEDDING_ENABLED: process.env.MCP_EMBEDDING_ENABLED || 'true',
    MCP_EMBEDDING_PROVIDER: process.env.MCP_EMBEDDING_PROVIDER || 'transformers',
    MCP_EMBEDDING_FALLBACK: process.env.MCP_EMBEDDING_FALLBACK || 'true',
  };

  // Make env globally available for embedding models
  (globalThis as any).env = safeEnv;
  return safeEnv;
}

// Initialize safe environment BEFORE any imports that might use embedding generator
createSafeEnvironment();

import { homedir } from "node:os";
import { join, normalize, resolve } from "node:path";
// Consolidated MCP SDK imports
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
// Schema and Node.js built-ins
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// TASK-001: Import new YAML configuration system
import { initializeConfig, validateConfig } from "./config/yaml-config.js";

// Import our multi-agent components
import { ConductorOrchestrator } from "./agents/conductor-orchestrator.js";
import { knowledgeBus } from "./core/knowledge-bus.js";
import { resourceManager } from "./core/resource-manager.js";
import type { AgentTask } from "./types/agent.js";
import { AgentType } from "./types/agent.js";
import { createRequestId, logger } from "./utils/logger.js";

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: code-graph-rag-mcp <directory>");
  process.exit(1);
}

function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return join(homedir(), filepath.slice(1));
  }
  return filepath;
}

const directory = normalize(resolve(expandHome(args[0] as string)));

// TASK-001: Initialize YAML configuration system
const config = initializeConfig();

// Validate configuration at startup
const validation = validateConfig(config);
if (!validation.valid) {
  console.error("[Config] Configuration validation failed:");
  for (const error of validation.errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

// Initialize logging system with config
logger.systemEvent("MCP Server Starting", {
  directory,
  nodeVersion: process.version,
  platform: process.platform,
  pid: process.pid,
  configEnvironment: config.environment,
  embeddingEnabled: config.mcp.embedding?.enabled,
});

// Initialize resource manager with configuration constraints
resourceManager.startMonitoring();
logger.systemEvent("Resource Manager Started", {
  maxMemoryMB: 1024,
  maxCpuPercent: 80,
  embeddingFallback: config.mcp.embedding?.fallbackToMemory,
});

// Initialize conductor orchestrator lazily
let conductor: ConductorOrchestrator | null = null;

function getConductor(): ConductorOrchestrator {
  if (!conductor) {
    // TASK-001: Use YAML configuration for conductor setup
    const mcpConfig = config.mcp;
    conductor = new ConductorOrchestrator({
      resourceConstraints: {
        maxMemoryMB: 1024, // 1GB for our process
        maxCpuPercent: 80,
        maxConcurrentAgents: mcpConfig.agents?.maxConcurrent || 10,
        maxTaskQueueSize: 100,
      },
      taskQueueLimit: 100,
      loadBalancingStrategy: "least-loaded",
      complexityThreshold: 8, // Require approval for complexity > 8 (allow indexing to proceed)
      mandatoryDelegation: true, // ENFORCE delegation to dev-agent or Dora
      // embeddingConfig will be handled in agent initialization
    });
  }
  return conductor;
}

// Helper functions for agent access - TASK-002
async function getQueryAgent(): Promise<any> {
  const cond = getConductor();
  await cond.initialize();
  // Reuse existing by type to avoid duplicate registrations
  let agent = cond.getAgentsByType(AgentType.QUERY)[0];
  if (!agent) {
    const { QueryAgent } = await import("./agents/query-agent.js");
    agent = new QueryAgent();
    await agent.initialize();
    cond.register(agent);
  }
  return agent;
}

async function getSemanticAgent(): Promise<any> {
  const cond = getConductor();
  await cond.initialize();
  let agent = cond.getAgentsByType(AgentType.SEMANTIC)[0];
  if (!agent) {
    const { SemanticAgent } = await import("./agents/semantic-agent.js");
    agent = new SemanticAgent();
    await agent.initialize();
    cond.register(agent);
  }
  return agent;
}

async function getDevAgent(): Promise<any> {
  const cond = getConductor();
  await cond.initialize();
  let agent = cond.getAgentsByType(AgentType.DEV)[0];
  if (!agent) {
    const { DevAgent } = await import("./agents/dev-agent.js");
    agent = new DevAgent();
    await agent.initialize();
    cond.register(agent);
  }
  return agent;
}

async function getDoraAgent(): Promise<any> {
  const cond = getConductor();
  await cond.initialize();
  let agent = cond.getAgentsByType(AgentType.DORA)[0];
  if (!agent) {
    const { DoraAgent } = await import("./agents/dora-agent.js");
    agent = new DoraAgent();
    await agent.initialize();
    cond.register(agent);
  }
  return agent;
}

// Import graph query functions
import { queryGraphEntities, getGraphStats } from "./tools/graph-query.js";
import { getGraphStorage } from "./storage/graph-storage-factory.js";

// GraphStorage singleton is now managed by graph-storage-factory.ts

// Tool schemas
const IndexToolSchema = z.object({
  directory: z.string().describe("Directory to index").optional(),
  incremental: z.boolean().describe("Perform incremental indexing").optional().default(false),
  reset: z.boolean().describe("Clear existing graph before indexing").optional().default(false),
  excludePatterns: z.array(z.string()).describe("Patterns to exclude").optional().default([
    // Standard ignore patterns for large codebases
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "out/**",
    ".next/**",
    ".nuxt/**",
    "coverage/**",
    ".nyc_output/**",
    "__pycache__/**",
    "*.pyc",
    ".pytest_cache/**",
    "venv/**",
    "env/**",
    ".venv/**",
    ".env/**",
    "vendor/**",
    "target/**",
    ".gradle/**",
    ".idea/**",
    ".vscode/**",
    "*.log",
    "*.tmp",
    "*.cache",
    ".DS_Store",
    "Thumbs.db"
  ]),
});

const ListEntitiesToolSchema = z.object({
  filePath: z.string().describe("Path to the file to list entities from"),
  entityTypes: z.array(z.string()).describe("Types of entities to list").optional(),
});

const ListRelationshipsToolSchema = z.object({
  entityName: z.string().describe("Name of the entity to find relationships for"),
  depth: z.number().describe("Depth of relationship traversal").optional().default(1),
  relationshipTypes: z.array(z.string()).describe("Types of relationships to include").optional(),
});

const QueryToolSchema = z.object({
  query: z.string().describe("Natural language or structured query"),
  limit: z.number().describe("Maximum number of results").optional().default(10),
});

// New semantic tool schemas - TASK-002
const SemanticSearchSchema = z.object({
  query: z.string().describe("Natural language search query"),
  limit: z.number().optional().default(10).describe("Maximum results to return"),
});

const FindSimilarCodeSchema = z.object({
  code: z.string().describe("Code snippet to find similar code for"),
  threshold: z.number().optional().default(0.7).describe("Similarity threshold (0-1)"),
  limit: z.number().optional().default(10).describe("Maximum results to return"),
});

const AnalyzeCodeImpactSchema = z.object({
  entityId: z.string().describe("Entity ID to analyze impact for"),
  depth: z.number().optional().default(2).describe("Depth of impact analysis"),
});

const DetectCodeClonesSchema = z.object({
  minSimilarity: z.number().optional().default(0.8).describe("Minimum similarity for clones"),
  scope: z.string().optional().default("all").describe("Scope: all, file, or module"),
});

const SuggestRefactoringSchema = z.object({
  filePath: z.string().describe("File to analyze for refactoring"),
  focusArea: z.string().optional().describe("Specific area to focus on"),
});

const CrossLanguageSearchSchema = z.object({
  query: z.string().describe("Search query"),
  languages: z.array(z.string()).optional().describe("Languages to search in"),
});

const AnalyzeHotspotsSchema = z.object({
  metric: z.string().optional().default("complexity").describe("Metric: complexity, changes, or coupling"),
  limit: z.number().optional().default(10).describe("Maximum hotspots to return"),
});

const FindRelatedConceptsSchema = z.object({
  entityId: z.string().describe("Entity to find related concepts for"),
  limit: z.number().optional().default(10).describe("Maximum results to return"),
});

const GetGraphSchema = z.object({
  query: z.string().optional().describe("Optional search query"),
  limit: z.number().optional().default(100).describe("Maximum entities to return"),
});

const GetGraphStatsSchema = z.object({});
const GetGraphHealthSchema = z.object({
  minEntities: z.number().optional().default(1).describe("Minimum entity count for healthy status"),
  minRelationships: z.number().optional().default(0).describe("Minimum relationship count for healthy status"),
  sample: z.number().optional().default(1).describe("Sample size to fetch for verification")
});

// Convenience tool: clean index (reset + index)
const CleanIndexSchema = z.object({
  directory: z.string().describe("Directory to index after reset").optional(),
  excludePatterns: z
    .array(z.string())
    .describe("Patterns to exclude during indexing")
    .optional()
    .default([]),
});

// Create MCP server
const server = new Server(
  {
    name: "code-graph-rag-mcp",
    version: "2.4.1",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// Helper: enforce operation timeouts per SYSTEM_HANG_RECOVERY_PLAN
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string, requestId: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      logger.incident("Operation timeout", { label, timeoutMs: ms }, requestId, err);
      reject(err);
    }, ms);
  });
  try {
    // Race the operation against the timeout
    const result = await Promise.race([promise, timeout]);
    return result as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "index",
        description: "Index a codebase using multi-agent parsing and analysis",
        inputSchema: zodToJsonSchema(IndexToolSchema) as any,
      },
      {
        name: "list_file_entities",
        description: "List all entities (functions, classes, etc.) in a file",
        inputSchema: zodToJsonSchema(ListEntitiesToolSchema) as any,
      },
      {
        name: "list_entity_relationships",
        description: "List all relationships for a specific entity",
        inputSchema: zodToJsonSchema(ListRelationshipsToolSchema) as any,
      },
      {
        name: "query",
        description: "Query the code graph using natural language or structured queries",
        inputSchema: zodToJsonSchema(QueryToolSchema) as any,
      },
      {
        name: "get_metrics",
        description: "Get system metrics and agent performance statistics",
        inputSchema: zodToJsonSchema(z.object({})) as any,
      },
      // New semantic tools - TASK-002
      {
        name: "semantic_search",
        description: "Search code using natural language queries with semantic understanding",
        inputSchema: zodToJsonSchema(SemanticSearchSchema) as any,
      },
      {
        name: "find_similar_code",
        description: "Find code similar to a given snippet using semantic analysis",
        inputSchema: zodToJsonSchema(FindSimilarCodeSchema) as any,
      },
      {
        name: "analyze_code_impact",
        description: "Analyze the impact of changes to a specific entity",
        inputSchema: zodToJsonSchema(AnalyzeCodeImpactSchema) as any,
      },
      {
        name: "detect_code_clones",
        description: "Find duplicate or similar code blocks across the codebase",
        inputSchema: zodToJsonSchema(DetectCodeClonesSchema) as any,
      },
      {
        name: "suggest_refactoring",
        description: "Get refactoring suggestions for improving code quality",
        inputSchema: zodToJsonSchema(SuggestRefactoringSchema) as any,
      },
      {
        name: "cross_language_search",
        description: "Search across multiple programming languages",
        inputSchema: zodToJsonSchema(CrossLanguageSearchSchema) as any,
      },
      {
        name: "analyze_hotspots",
        description: "Find code hotspots based on complexity, changes, or coupling",
        inputSchema: zodToJsonSchema(AnalyzeHotspotsSchema) as any,
      },
      {
        name: "find_related_concepts",
        description: "Find conceptually related code to a given entity",
        inputSchema: zodToJsonSchema(FindRelatedConceptsSchema) as any,
      },
      {
        name: "get_graph",
        description: "Get the code graph with all entities and relationships",
        inputSchema: zodToJsonSchema(GetGraphSchema) as any,
      },
      {
        name: "get_graph_stats",
        description: "Get statistics about the code graph",
        inputSchema: zodToJsonSchema(GetGraphStatsSchema) as any,
      },
      {
        name: "reset_graph",
        description: "Clear all graph data (entities, relationships, files)",
        inputSchema: zodToJsonSchema(z.object({})) as any,
      },
      {
        name: "clean_index",
        description: "Reset graph and then perform a full index",
        inputSchema: zodToJsonSchema(CleanIndexSchema) as any,
      },
      {
        name: "get_graph_health",
        description: "Health check for graph storage (totals + sample)",
        inputSchema: zodToJsonSchema(GetGraphHealthSchema) as any,
      },
    ],
  };
});

// Handler for tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const requestId = createRequestId();
  const startTime = Date.now();

  logger.mcpRequest(name, args, requestId);

  try {
    switch (name) {
      case "index": {
        const { directory: indexDir, incremental, excludePatterns, reset } = IndexToolSchema.parse(args);
        const targetDir = indexDir || directory;

        // Optional reset
        if (reset) {
          const storage = await getGraphStorage();
          await storage.clear();
          logger.systemEvent("Graph storage cleared before indexing", { directory: targetDir });
        }

        // Enhanced exclude patterns for large codebases
        const enhancedExcludePatterns = [...excludePatterns];

        // Check codebase size and add adaptive patterns
        try {
          const { execSync } = await import('child_process');
          const fileCount = execSync(`find "${targetDir}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" -o -name "*.cpp" -o -name "*.c" -o -name "*.go" -o -name "*.rs" \\) | wc -l`, { encoding: 'utf8' }).trim();
          const numFiles = parseInt(fileCount);

          logger.info("INDEXING", `Detected ${numFiles} source files in codebase`, { directory: targetDir, fileCount: numFiles }, requestId);

          // Adjust resource allocation based on codebase size
          const { execSync: execSync2 } = await import('child_process');
          const projectSizeBytes = execSync2(`du -sb "${targetDir}" | cut -f1`, { encoding: 'utf8' }).trim();
          const projectSizeMB = Math.floor(parseInt(projectSizeBytes) / (1024 * 1024));
          resourceManager.adjustForCodebaseSize(numFiles, projectSizeMB);

          // For very large codebases (>2000 files), add more aggressive patterns
          if (numFiles > 2000) {
            logger.info("INDEXING", "Large codebase detected, adding additional exclude patterns", { fileCount: numFiles }, requestId);
            enhancedExcludePatterns.push(
              "**/test/**", "**/tests/**", "**/*_test.*", "**/*_spec.*", "**/*.test.*", "**/*.spec.*",
              "**/docs/**", "**/doc/**", "**/documentation/**",
              "**/examples/**", "**/example/**", "**/demo/**", "**/demos/**",
              "**/migrations/**", "**/scripts/**", "**/tools/**",
              "**/*.min.js", "**/*.min.css", "**/bundle.*", "**/vendor.*"
            );
          }

          // For extremely large codebases (>5000 files), enable incremental by default
          if (numFiles > 5000 && !incremental) {
            logger.info("INDEXING", "Extremely large codebase detected, recommending incremental mode", { fileCount: numFiles }, requestId);
          }

          // For very large codebases (>2000 files), enable batch processing
          if (numFiles > 2000) {
            logger.info("INDEXING", "Large codebase detected, enabling batch processing", { fileCount: numFiles }, requestId);
            // Set batch processing metadata
            enhancedExcludePatterns.push("__batch_processing_enabled__"); // Special marker for batch processing
          }
        } catch (error) {
          logger.warn("INDEXING", "Could not detect codebase size, using default patterns", { error: (error as Error).message }, requestId);
        }

        // Create indexing task with enhanced exclude patterns
        const task: AgentTask = {
          id: `index-${Date.now()}`,
          type: "index",
          priority: 8,
          payload: {
            directory: targetDir,
            incremental,
            excludePatterns: enhancedExcludePatterns,
          },
          createdAt: Date.now(),
        };

        // Process through conductor with mandatory delegation
        const cond = getConductor();
        await cond.initialize();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(cond.process(task), timeoutMs, "index", requestId);

        // Log indexing activity
        logger.agentActivity(
          "conductor",
          "indexing completed",
          {
            directory: targetDir,
            incremental,
            excludePatterns,
            entitiesFound: Array.isArray((result as any)?.entities) ? (result as any).entities.length : 0,
          },
          requestId,
        );

        // Publish to knowledge bus
        knowledgeBus.publish("index:completed", result, "mcp-server");

        const duration = Date.now() - startTime;
        logger.mcpResponse(name, result, duration, requestId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Indexing completed",
                  result,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "reset_graph": {
        const storage = await getGraphStorage();
        await storage.clear();
        logger.systemEvent("Graph storage cleared via tool");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, message: "Graph storage cleared" }, null, 2),
            },
          ],
        };
      }

      case "clean_index": {
        const { directory: indexDir, excludePatterns } = CleanIndexSchema.parse(args);
        const targetDir = indexDir || directory;

        // Reset graph first
        const storage = await getGraphStorage();
        await storage.clear();
        logger.systemEvent("Graph storage cleared before clean index", { directory: targetDir });

        // Perform index with reset semantics (already cleared), non-incremental
        const enhancedExcludePatterns = [...(excludePatterns || [])];

        // Adaptive patterns as in index tool
        try {
          const { execSync } = await import('child_process');
          const fileCount = execSync(`find "${targetDir}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" -o -name "*.cpp" -o -name "*.c" -o -name "*.go" -o -name "*.rs" \\) | wc -l`, { encoding: 'utf8' }).trim();
          const numFiles = parseInt(fileCount);
          logger.info(
            "INDEXING",
            `Detected ${numFiles} source files in codebase (clean_index)`,
            { directory: targetDir, fileCount: numFiles },
            requestId,
          );
          const { execSync: execSync2 } = await import('child_process');
          const projectSizeBytes = execSync2(`du -sb "${targetDir}" | cut -f1`, { encoding: 'utf8' }).trim();
          const projectSizeMB = Math.floor(parseInt(projectSizeBytes) / (1024 * 1024));
          resourceManager.adjustForCodebaseSize(numFiles, projectSizeMB);
          if (numFiles > 2000) {
            enhancedExcludePatterns.push(
              "**/test/**", "**/tests/**", "**/*_test.*", "**/*_spec.*", "**/*.test.*", "**/*.spec.*",
              "**/docs/**", "**/doc/**", "**/documentation/**",
              "**/examples/**", "**/example/**", "**/demo/**", "**/demos/**",
              "**/migrations/**", "**/scripts/**", "**/tools/**",
              "**/*.min.js", "**/*.min.css", "**/bundle.*", "**/vendor.*"
            );
            enhancedExcludePatterns.push("__batch_processing_enabled__");
          }
        } catch (error) {
          logger.warn("INDEXING", "Could not detect codebase size (clean_index), using default patterns", { error: (error as Error).message }, requestId);
        }

        const task: AgentTask = {
          id: `clean-index-${Date.now()}`,
          type: "index",
          priority: 8,
          payload: {
            directory: targetDir,
            incremental: false,
            excludePatterns: enhancedExcludePatterns,
          },
          createdAt: Date.now(),
        };

        const cond = getConductor();
        await cond.initialize();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(cond.process(task), timeoutMs, "clean_index", requestId);

        knowledgeBus.publish("index:completed", result, "mcp-server");
        const duration = Date.now() - startTime;
        logger.mcpResponse(name, result, duration, requestId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "Clean indexing completed",
                  result,
                },
                null,
                2,
              ),
            },
          ],
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
                  text: JSON.stringify(firstCache.data, null, 2),
                },
              ],
            };
          }
        }

        // Create query task
        const task: AgentTask = {
          id: `list-entities-${Date.now()}`,
          type: "query",
          priority: 5,
          payload: {
            operation: "list_entities",
            filePath,
            entityTypes,
          },
          createdAt: Date.now(),
        };

        const cond = getConductor();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(cond.process(task), timeoutMs, "list_file_entities", requestId);

        // Cache result
        knowledgeBus.publish(`entities:${filePath}`, result, "mcp-server", 60000);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_entity_relationships": {
        const { entityName, relationshipTypes } = ListRelationshipsToolSchema.parse(args);
        const queryAgent = await getQueryAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        // Find entity by name (first match)
        const matches = await withTimeout(
          queryAgent.listEntities({ name: entityName }),
          timeoutMs,
          "list_entity_relationships:lookup",
          requestId,
        );
        if (!Array.isArray(matches) || matches.length === 0) {
          return { content: [{ type: "text", text: JSON.stringify({ success: false, error: `Entity not found: ${entityName}` }, null, 2) }] };
        }
        const entity = matches[0];
        let rels: any = await withTimeout(
          queryAgent.getRelationships(entity.id),
          timeoutMs,
          "list_entity_relationships:get",
          requestId,
        );
        if (Array.isArray(relationshipTypes) && relationshipTypes.length > 0) {
          rels = rels.filter((r: any) => relationshipTypes.includes(r.type));
        }
        return {
          content: [
            { type: "text", text: JSON.stringify({ entity: { id: entity.id, name: entity.name, filePath: entity.filePath }, relationships: rels }, null, 2) },
          ],
        };
      }

      case "query": {
        const { query, limit } = QueryToolSchema.parse(args);
        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(
          semanticAgent.semanticSearch(query, limit),
          timeoutMs,
          "query:semantic_search",
          requestId,
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
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
              text: JSON.stringify(
                {
                  resources: resourceStats,
                  knowledge: knowledgeStats,
                  conductor: conductorMetrics,
                  agents: Array.from(cond.agents.values()).map((agent) => ({
                    id: agent.id,
                    type: agent.type,
                    status: agent.status,
                    memoryUsage: agent.getMemoryUsage(),
                    cpuUsage: agent.getCpuUsage(),
                    queueSize: agent.getTaskQueue().length,
                  })),
                },
                null,
                2,
              ),
            },
          ],
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
          if (firstCache && Date.now() - firstCache.timestamp < 30000) {
            // 30s cache
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(firstCache.data, null, 2),
                },
              ],
            };
          }
        }

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(
          semanticAgent.semanticSearch(query, limit),
          timeoutMs,
          "semantic_search",
          requestId,
        );

        // Cache result
        knowledgeBus.publish(cacheKey, result, "mcp-server", 30000);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "find_similar_code": {
        const { code, threshold, limit } = FindSimilarCodeSchema.parse(args);

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const sim = await withTimeout(
          semanticAgent.findSimilarCode(code, threshold ?? 0.7),
          timeoutMs,
          "find_similar_code",
          requestId,
        );
        const result = Array.isArray(sim) && limit ? sim.slice(0, limit) : sim;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // analyze_code_impact handled below (single implementation with fallback)

      case "detect_code_clones": {
        const { minSimilarity } = DetectCodeClonesSchema.parse(args);

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(
          semanticAgent.detectClones(minSimilarity),
          timeoutMs,
          "detect_code_clones",
          requestId,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "suggest_refactoring": {
        const { filePath } = SuggestRefactoringSchema.parse(args);

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        // For now, read file content and pass to suggestRefactoring (optional if focusArea provided)
        const fs = await import('node:fs/promises');
        let code = '';
        try { code = await fs.readFile(filePath, 'utf8'); } catch {}
        const result = await withTimeout(
          semanticAgent.suggestRefactoring(code),
          timeoutMs,
          "suggest_refactoring",
          requestId,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "cross_language_search": {
        const { query, languages } = CrossLanguageSearchSchema.parse(args);

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(
          semanticAgent.crossLanguageSearch(query, languages || []),
          timeoutMs,
          "cross_language_search",
          requestId,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "analyze_hotspots": {
        const { metric, limit } = AnalyzeHotspotsSchema.parse(args);
        const queryAgent = await getQueryAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        // Direct call to get hotspots array, with task fallback when missing
        let rawHotspots: any;
        if (typeof (queryAgent as any).analyzeHotspots === 'function') {
          rawHotspots = await withTimeout((queryAgent as any).analyzeHotspots(), timeoutMs, "analyze_hotspots:query", requestId);
        } else {
          const task: AgentTask = {
            id: `hotspots-${Date.now()}`,
            type: "query:analysis",
            priority: 7,
            payload: { type: "hotspots", params: {} },
            createdAt: Date.now(),
          };
          rawHotspots = await withTimeout((queryAgent as any).process(task), timeoutMs, "analyze_hotspots:query", requestId);
        }
        const hotspots = Array.isArray(rawHotspots) && typeof limit === 'number' ? rawHotspots.slice(0, limit) : rawHotspots;

        // Semantic enrichment over hotspot entities/snippets
        const semanticAgent = await getSemanticAgent();
        const enriched = await withTimeout(
          semanticAgent.analyzeHotspots(hotspots, metric),
          timeoutMs,
          "analyze_hotspots:semantic",
          requestId,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(enriched, null, 2),
            },
          ],
        };
      }

      case "find_related_concepts": {
        const { entityId, limit } = FindRelatedConceptsSchema.parse(args);
        const storage = await getGraphStorage();
        const entity = await storage.getEntity(entityId);
        if (!entity) {
          return { content: [ { type: "text", text: JSON.stringify({ success: false, error: `Entity not found: ${entityId}` }, null, 2) } ] };
        }

        // Read code snippet for this entity using stored location
        const fs = await import('node:fs/promises');
        let snippet = '';
        try {
          const full = await fs.readFile(entity.filePath, 'utf8');
          const startIdx = typeof (entity as any).location?.start?.index === 'number' ? (entity as any).location.start.index : 0;
          const endIdx = typeof (entity as any).location?.end?.index === 'number' ? (entity as any).location.end.index : full.length;
          if (endIdx > startIdx && endIdx - startIdx < 10000) {
            snippet = full.slice(startIdx, endIdx);
          } else {
            // Fallback to line range if indices are missing
            const sLine = (entity as any).location?.start?.line ? (entity as any).location.start.line - 1 : 0;
            const eLine = (entity as any).location?.end?.line ? (entity as any).location.end.line : sLine + 10;
            const lines = full.split(/\r?\n/);
            snippet = lines.slice(Math.max(0, sLine), Math.min(lines.length, eLine)).join('\n');
            if (snippet.length > 10000) snippet = snippet.slice(0, 10000);
          }
        } catch {
          // If read fails, return empty
          snippet = '';
        }

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const sim = await withTimeout(
          semanticAgent.findSimilarCode(snippet, 0.65),
          timeoutMs,
          "find_related_concepts",
          requestId,
        );
        const results = Array.isArray(sim) && limit ? sim.slice(0, limit) : sim;
        return {
          content: [ { type: "text", text: JSON.stringify({ entity: { id: entity.id, name: entity.name, filePath: entity.filePath }, related: results }, null, 2) } ],
        };
      }

      case "get_graph": {
        const { query, limit } = GetGraphSchema.parse(args);

        // Use direct database query instead of going through agents
        const storage = await getGraphStorage();
        const result = await queryGraphEntities(storage, query, limit);

        logger.info("GRAPH_QUERY", `Retrieved graph with ${result.entities.length} entities and ${result.relationships.length} relationships`, {
          query,
          limit,
          stats: result.stats,
        }, requestId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                entities: result.entities,
                relations: result.relationships,
                stats: {
                  totalNodes: result.stats.totalEntities,
                  totalRelations: result.stats.totalRelationships,
                },
              }, null, 2),
            },
          ],
        };
      }

      case "analyze_code_impact": {
        const { entityId } = AnalyzeCodeImpactSchema.parse(args);
        const queryAgent = await getQueryAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        let impact: any;
        if (typeof (queryAgent as any).getImpactedEntities === 'function') {
          impact = await withTimeout((queryAgent as any).getImpactedEntities(entityId), timeoutMs, "analyze_code_impact", requestId);
        } else {
          const task: AgentTask = {
            id: `impact-${Date.now()}`,
            type: "query:analysis",
            priority: 8,
            payload: { type: "impact", params: { entityId } },
            createdAt: Date.now(),
          };
          impact = await withTimeout((queryAgent as any).process(task), timeoutMs, "analyze_code_impact", requestId);
        }
        return { content: [ { type: "text", text: JSON.stringify(impact, null, 2) } ] };
      }

      case "get_graph_stats": {
        const storage = await getGraphStorage();
        const stats = await getGraphStats(storage);

        logger.info("GRAPH_STATS", "Retrieved graph statistics", stats, requestId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      case "get_graph_health": {
        const { minEntities, minRelationships, sample } = GetGraphHealthSchema.parse(args ?? {});
        const storage = await getGraphStorage();
        const metrics = await storage.getMetrics();

        // Try a tiny sample query to ensure read path is functional
        const sampleQuery = await storage.executeQuery({ type: "entity", limit: Math.max(1, sample) });

        const healthy =
          (metrics.totalEntities ?? 0) >= minEntities &&
          (metrics.totalRelationships ?? 0) >= minRelationships &&
          sampleQuery.entities.length >= Math.min(1, sample);

        const reason = healthy
          ? "OK"
          : `Mismatch: totals e=${metrics.totalEntities}, r=${metrics.totalRelationships}, sample=${sampleQuery.entities.length}`;

        logger.info(
          "GRAPH_HEALTH",
          "Graph health check",
          {
            healthy,
            reason,
            totals: {
              entities: metrics.totalEntities,
              relationships: metrics.totalRelationships,
              files: metrics.totalFiles,
            },
            sampleCount: sampleQuery.entities.length,
          },
          requestId,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  healthy,
                  reason,
                  totals: {
                    entities: metrics.totalEntities,
                    relationships: metrics.totalRelationships,
                    files: metrics.totalFiles,
                  },
                  sampleCount: sampleQuery.entities.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.mcpError(name, error instanceof Error ? error : new Error(errorMessage), requestId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: errorMessage,
            },
            null,
            2,
          ),
        },
      ],
    };
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  logger.systemEvent("MCP Server Shutdown Initiated");

  if (conductor) {
    await conductor.shutdown();
    logger.systemEvent("Conductor Shutdown Complete");
  }

  resourceManager.stopMonitoring();
  logger.systemEvent("Resource Manager Stopped");
  logger.systemEvent("MCP Server Shutdown Complete");

  process.exit(0);
});

// Debug signal: dump runtime state (aligns with SYSTEM_HANG_RECOVERY_PLAN)
process.on("SIGUSR1", async () => {
  try {
    const snapshot: any = {
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };
    if (conductor) {
      snapshot.conductor = {
        pendingTasks: (conductor as any).pendingTasks?.size ?? undefined,
        agents: Array.from(conductor.agents.values()).map((a) => ({
          id: a.id,
          type: a.type,
          status: a.status,
          memMB: a.getMemoryUsage(),
          queue: a.getTaskQueue().length,
          lastActivity: (a as any).getMetrics ? (a as any).getMetrics().lastActivity : undefined,
        })),
      };
    }
    logger.incident("SIGUSR1 dump", snapshot);
  } catch (err) {
    logger.incident("SIGUSR1 dump failed", {}, undefined, err as Error);
  }
});

// Start the server
async function main() {
  console.log(`Starting MCP Code Graph Server for directory: ${directory}`);
  console.log("Multi-agent LiteRAG architecture initialized");
  console.log(`Resource constraints: 1GB memory, 80% CPU, 10 concurrent agents`);

  // Connect transport FIRST for fast readiness
  logger.systemEvent("MCP Server Transport Connecting", { transport: "stdio" });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("MCP server running on stdio transport");
  logger.systemEvent("MCP Server Ready", {
    directory,
    transport: "stdio",
    toolsCount: 13,
    readyTime: Date.now(),
  });

  // Defer heavy agent initialization in the background
  (async () => {
    try {
      await getDevAgent();
      await getDoraAgent();
      await getSemanticAgent();
      console.log("Core agents initialized (background): DevAgent, DoraAgent, SemanticAgent");
    } catch (error) {
      console.error("Background agent init failed:", error);
      logger.error("AGENT_INIT", "Background agent initialization failed", { error: (error as Error).message });
    }
  })();
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  logger.critical("MCP Server Startup Failed", error.message, undefined, undefined, error);
  process.exit(1);
});
