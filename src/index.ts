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
    MCP_EMBEDDING_ENABLED: process.env.MCP_EMBEDDING_ENABLED || 'false',
    MCP_EMBEDDING_PROVIDER: process.env.MCP_EMBEDDING_PROVIDER || 'memory',
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
  let agent = cond.agents.get("query-agent");
  if (!agent) {
    // Import dynamically to avoid circular dependencies
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
  let agent = cond.agents.get("semantic-agent");
  if (!agent) {
    // Import dynamically to avoid circular dependencies
    const { SemanticAgent } = await import("./agents/semantic-agent.js");

    // TASK-001: Initialize SemanticAgent with YAML configuration
    // Configuration will be handled during agent initialization
    agent = new SemanticAgent();

    await agent.initialize();
    cond.register(agent);
  }
  return agent;
}

async function getDevAgent(): Promise<any> {
  const cond = getConductor();
  await cond.initialize();
  let agent = cond.agents.get("dev-agent");
  if (!agent) {
    // Import dynamically to avoid circular dependencies
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
  let agent = cond.agents.get("dora-agent");
  if (!agent) {
    // Import dynamically to avoid circular dependencies
    const { DoraAgent } = await import("./agents/dora-agent.js");
    agent = new DoraAgent();
    await agent.initialize();
    cond.register(agent);
  }
  return agent;
}

// Tool schemas
const IndexToolSchema = z.object({
  directory: z.string().describe("Directory to index").optional(),
  incremental: z.boolean().describe("Perform incremental indexing").optional().default(false),
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

// Create MCP server
const server = new Server(
  {
    name: "code-graph-rag-mcp",
    version: "2.0.0", // Bumped for multi-agent architecture
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
        const { directory: indexDir, incremental, excludePatterns } = IndexToolSchema.parse(args);
        const targetDir = indexDir || directory;

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
        const { entityName, depth, relationshipTypes } = ListRelationshipsToolSchema.parse(args);

        // Create relationship query task
        const task: AgentTask = {
          id: `list-relationships-${Date.now()}`,
          type: "query",
          priority: 6,
          payload: {
            operation: "list_relationships",
            entityName,
            depth,
            relationshipTypes,
          },
          createdAt: Date.now(),
        };

        const cond = getConductor();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(cond.process(task), timeoutMs, "list_entity_relationships", requestId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "query": {
        const { query, limit } = QueryToolSchema.parse(args);

        // Create semantic query task
        const task: AgentTask = {
          id: `semantic-query-${Date.now()}`,
          type: "semantic",
          priority: 7,
          payload: {
            query,
            limit,
          },
          createdAt: Date.now(),
        };

        const cond = getConductor();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(cond.process(task), timeoutMs, "query", requestId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
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

        const task: AgentTask = {
          id: `semantic-search-${Date.now()}`,
          type: "semantic",
          priority: 8,
          payload: {
            operation: "semantic_search",
            query,
            limit,
          },
          createdAt: Date.now(),
        };

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(semanticAgent.process(task), timeoutMs, "semantic_search", requestId);

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

        const task: AgentTask = {
          id: `find-similar-${Date.now()}`,
          type: "semantic",
          priority: 7,
          payload: {
            operation: "find_similar",
            code,
            threshold,
            limit,
          },
          createdAt: Date.now(),
        };

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(semanticAgent.process(task), timeoutMs, "find_similar_code", requestId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "analyze_code_impact": {
        const { entityId, depth } = AnalyzeCodeImpactSchema.parse(args);

        const task: AgentTask = {
          id: `impact-analysis-${Date.now()}`,
          type: "query",
          priority: 8,
          payload: {
            operation: "impact_analysis",
            entityId,
            depth,
          },
          createdAt: Date.now(),
        };

        // Use QueryAgent for dependency analysis
        const queryAgent = await getQueryAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const dependencies = await withTimeout(queryAgent.process(task), timeoutMs, "analyze_code_impact:query", requestId);

        // Enhance with semantic understanding
        const semanticTask: AgentTask = {
          id: `semantic-impact-${Date.now()}`,
          type: "semantic",
          priority: 7,
          payload: {
            operation: "analyze_impact",
            dependencies,
            entityId,
          },
          createdAt: Date.now(),
        };

        const semanticAgent = await getSemanticAgent();
        const enhancedResult = await withTimeout(
          semanticAgent.process(semanticTask),
          timeoutMs,
          "analyze_code_impact:semantic",
          requestId,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(enhancedResult, null, 2),
            },
          ],
        };
      }

      case "detect_code_clones": {
        const { minSimilarity, scope } = DetectCodeClonesSchema.parse(args);

        const task: AgentTask = {
          id: `clone-detection-${Date.now()}`,
          type: "semantic",
          priority: 6,
          payload: {
            operation: "detect_clones",
            minSimilarity,
            scope,
          },
          createdAt: Date.now(),
        };

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(semanticAgent.process(task), timeoutMs, "detect_code_clones", requestId);

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
        const { filePath, focusArea } = SuggestRefactoringSchema.parse(args);

        const task: AgentTask = {
          id: `refactoring-${Date.now()}`,
          type: "semantic",
          priority: 7,
          payload: {
            operation: "suggest_refactoring",
            filePath,
            focusArea,
          },
          createdAt: Date.now(),
        };

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(semanticAgent.process(task), timeoutMs, "suggest_refactoring", requestId);

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

        const task: AgentTask = {
          id: `cross-lang-${Date.now()}`,
          type: "semantic",
          priority: 7,
          payload: {
            operation: "cross_language_search",
            query,
            languages,
          },
          createdAt: Date.now(),
        };

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(semanticAgent.process(task), timeoutMs, "cross_language_search", requestId);

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

        // Query for usage patterns
        const queryTask: AgentTask = {
          id: `hotspot-query-${Date.now()}`,
          type: "query",
          priority: 7,
          payload: {
            operation: "find_hotspots",
            metric,
            limit,
          },
          createdAt: Date.now(),
        };

        const queryAgent = await getQueryAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const hotspots = await withTimeout(queryAgent.process(queryTask), timeoutMs, "analyze_hotspots:query", requestId);

        // Enhance with semantic analysis
        const semanticTask: AgentTask = {
          id: `hotspot-semantic-${Date.now()}`,
          type: "semantic",
          priority: 6,
          payload: {
            operation: "analyze_hotspots",
            hotspots,
            metric,
          },
          createdAt: Date.now(),
        };

        const semanticAgent = await getSemanticAgent();
        const enhancedResult = await withTimeout(
          semanticAgent.process(semanticTask),
          timeoutMs,
          "analyze_hotspots:semantic",
          requestId,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(enhancedResult, null, 2),
            },
          ],
        };
      }

      case "find_related_concepts": {
        const { entityId, limit } = FindRelatedConceptsSchema.parse(args);

        const task: AgentTask = {
          id: `related-concepts-${Date.now()}`,
          type: "semantic",
          priority: 7,
          payload: {
            operation: "find_related_concepts",
            entityId,
            limit,
          },
          createdAt: Date.now(),
        };

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const result = await withTimeout(semanticAgent.process(task), timeoutMs, "find_related_concepts", requestId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
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

  // Initialize core agents to ensure they're available for delegation
  try {
    await getDevAgent();
    await getDoraAgent();
    await getSemanticAgent();
    console.log("Core agents initialized: DevAgent, DoraAgent, SemanticAgent");
  } catch (error) {
    console.error("Failed to initialize core agents:", error);
    logger.error("AGENT_INIT", "Failed to initialize core agents", { error: (error as Error).message });
  }

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
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  logger.critical("MCP Server Startup Failed", error.message, undefined, undefined, error);
  process.exit(1);
});
