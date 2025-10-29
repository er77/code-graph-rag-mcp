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
    NODE_ENV: process.env.NODE_ENV || "development",
    MCP_EMBEDDING_ENABLED: process.env.MCP_EMBEDDING_ENABLED || "true",
    MCP_EMBEDDING_PROVIDER: process.env.MCP_EMBEDDING_PROVIDER || "transformers",
    MCP_EMBEDDING_FALLBACK: process.env.MCP_EMBEDDING_FALLBACK || "true",
  };

  // Make env globally available for embedding models
  (globalThis as any).env = safeEnv;
  return safeEnv;
}

// Initialize safe environment BEFORE any imports that might use embedding generator
createSafeEnvironment();

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Consolidated MCP SDK imports
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
// Schema and Node.js built-ins
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
// Import our multi-agent components
import { ConductorOrchestrator } from "./agents/conductor-orchestrator.js";
// TASK-001: Import new YAML configuration system
import { ConfigLoader, initializeConfig, validateConfig } from "./config/yaml-config.js";
import { knowledgeBus } from "./core/knowledge-bus.js";
import { resourceManager } from "./core/resource-manager.js";
import { getGraphStorage, initializeGraphStorage } from "./storage/graph-storage-factory.js";
import { getSQLiteManager } from "./storage/sqlite-manager.js";
import { collectAgentMetrics } from "./tools/agent-metrics.js";
// Import graph query functions
import { getGraphStats, queryGraphEntities } from "./tools/graph-query.js";
import { runJscpdCloneDetection } from "./tools/jscpd.js";
import type { AgentTask } from "./types/agent.js";
import { AgentType } from "./types/agent.js";
import { AgentBusyError } from "./types/errors.js";
import type { CloneGroup } from "./types/semantic.js";
import type { Entity, Relationship } from "./types/storage.js";
import { EntityType } from "./types/storage.js";
import { createRequestId, logger } from "./utils/logger.js";

// Parse command line arguments
const args = process.argv.slice(2);
let overrideConfigPath: string | undefined;
let helpRequested = false;
let versionRequested = false;
const positionalArgs: string[] = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;

  if (arg === "--config") {
    const next = args[++i];
    if (!next) {
      console.error("Error: --config requires a path argument");
      console.error("Usage: code-graph-rag-mcp [--config <path>] <directory>");
      process.exit(1);
    }
    overrideConfigPath = next;
  } else if (arg.startsWith("--config=")) {
    const value = arg.slice("--config=".length);
    if (!value) {
      console.error("Error: --config requires a non-empty path");
      console.error("Usage: code-graph-rag-mcp [--config <path>] <directory>");
      process.exit(1);
    }
    overrideConfigPath = value;
  } else if (arg === "--help" || arg === "-h") {
    helpRequested = true;
  } else if (arg === "--version" || arg === "-v") {
    versionRequested = true;
  } else if (arg.startsWith("-")) {
    console.error(`Unknown option: ${arg}`);
    console.error("Usage: code-graph-rag-mcp [--config <path>] <directory>");
    process.exit(1);
  } else {
    positionalArgs.push(arg);
  }
}

function printHelp() {
  console.log(`Code Graph RAG MCP Server

Usage:
  code-graph-rag-mcp [options] <directory>

Options:
  --config <path>   Use an alternate YAML configuration file
  --help, -h        Show this help message and exit
  --version, -v     Print version information and exit

Examples:
  code-graph-rag-mcp /path/to/project
  code-graph-rag-mcp --config config/production.yaml /repo
  code-graph-rag-mcp --version
`);
}

if (helpRequested) {
  printHelp();
  process.exit(0);
}

const versionInfo = getVersionInfo();

type NormalizedSemanticGroup = {
  id: string;
  cloneType: CloneGroup["cloneType"];
  avgSimilarity: number;
  files: Array<{
    filePath: string;
    occurrences: Array<{
      id: string;
      similarity: number;
      startLine?: number;
      snippet: string;
    }>;
  }>;
};

function parseSemanticMemberPath(
  memberId: string,
  memberPath: string | undefined,
): {
  filePath: string;
  startLine?: number;
} {
  let filePath = memberPath ?? "";
  let startLine: number | undefined;

  if (!filePath || filePath.startsWith("parsed:")) {
    const match = /^parsed:(.*?):(\d+):\d+$/.exec(memberId);
    if (match) {
      filePath = match[1] ?? filePath;
      startLine = Number.parseInt(match[2] ?? "", 10);
    }
  }

  if (!filePath && memberId.includes(":")) {
    filePath = memberId.split(":")[0] ?? memberId;
  }

  return { filePath, startLine };
}

function normalizeSemanticCloneGroups(
  groups: CloneGroup[],
  baseDir: string,
): {
  groups: NormalizedSemanticGroup[];
  skippedGroups: number;
} {
  const normalized: NormalizedSemanticGroup[] = [];
  let skippedGroups = 0;

  for (const group of groups) {
    const files = new Map<
      string,
      {
        filePath: string;
        occurrences: Array<{
          id: string;
          similarity: number;
          startLine?: number;
          snippet: string;
        }>;
      }
    >();

    for (const member of group.members) {
      const { filePath: rawPath, startLine } = parseSemanticMemberPath(member.id, member.path);
      const sanitizedPath =
        rawPath && baseDir && rawPath.startsWith(baseDir)
          ? relative(baseDir, rawPath) || rawPath
          : rawPath || member.id;
      const record =
        files.get(sanitizedPath) ??
        files.set(sanitizedPath, { filePath: sanitizedPath, occurrences: [] }).get(sanitizedPath)!;
      record.occurrences.push({
        id: member.id,
        similarity: member.similarity,
        startLine,
        snippet: member.content,
      });
    }

    if (files.size < 2) {
      skippedGroups += 1;
      continue;
    }

    normalized.push({
      id: group.id,
      cloneType: group.cloneType,
      avgSimilarity: group.avgSimilarity,
      files: Array.from(files.values()),
    });
  }

  return { groups: normalized, skippedGroups };
}

if (versionRequested) {
  console.log(
    `${versionInfo.name} ${versionInfo.version}\nNode ${versionInfo.nodeVersion} (${versionInfo.platform} ${versionInfo.arch})`,
  );
  process.exit(0);
}

if (positionalArgs.length < 1) {
  console.error("Usage: code-graph-rag-mcp [--config <path>] <directory>");
  process.exit(1);
}

function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return join(homedir(), filepath.slice(1));
  }
  return filepath;
}

if (overrideConfigPath) {
  ConfigLoader.setOverridePath(overrideConfigPath);
}

/**
 * Get version information from package.json
 */
function getVersionInfo() {
  try {
    // Get the directory of the current file
    const currentFileUrl = import.meta.url;
    const currentFilePath = fileURLToPath(currentFileUrl);
    const currentDir = dirname(currentFilePath);

    // package.json is in the root, one level up from dist/
    const packageJsonPath = join(currentDir, "../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    return {
      name: packageJson.name || "@er77/code-graph-rag-mcp",
      version: packageJson.version || "unknown",
      description: packageJson.description || "",
      homepage: packageJson.homepage || "",
      repository: packageJson.repository?.url || "",
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };
  } catch (error) {
    // Fallback if package.json cannot be read
    return {
      name: "@er77/code-graph-rag-mcp",
      version: "unknown",
      description: "Multi-agent LiteRAG MCP server for advanced code graph analysis",
      homepage: "https://github.com/er77/code-graph-rag-mcp",
      repository: "git+https://github.com/er77/code-graph-rag-mcp.git",
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      error: error instanceof Error ? error.message : "Failed to read package.json",
    };
  }
}

const directory = normalize(resolve(expandHome(positionalArgs[0]!)));

type DebugRequest = {
  raw: string;
  parsed: unknown;
};

const debugRequestStrings = positionalArgs.slice(1);
const debugRequests: DebugRequest[] = [];
const isDebugMode = debugRequestStrings.length > 0;

for (const raw of debugRequestStrings) {
  const trimmed = raw.trim();
  if (!trimmed) continue;
  try {
    debugRequests.push({ raw: trimmed, parsed: JSON.parse(trimmed) });
  } catch (error) {
    console.error(`[Debug] Failed to parse JSON request: ${trimmed}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (isDebugMode) {
  process.env.MCP_DEBUG_MODE = process.env.MCP_DEBUG_MODE ?? "1";
  if (!process.env.PARSER_DISABLE_CACHE) {
    process.env.PARSER_DISABLE_CACHE = "1";
  }
  process.env.MCP_DEBUG_DISABLE_SEMANTIC = process.env.MCP_DEBUG_DISABLE_SEMANTIC ?? "1";
}

function normalizeInputPath(rawPath: string): string;
function normalizeInputPath(rawPath?: string | null): string | undefined;
function normalizeInputPath(rawPath?: string | null): string | undefined {
  if (!rawPath) return undefined;
  const expanded = expandHome(rawPath);
  const target = isAbsolute(expanded) ? expanded : resolve(directory, expanded);
  return normalize(target);
}

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

// Initialize global SQLiteManager with database configuration
console.log("[Main] Initializing global SQLiteManager with config:", config.database.path);
const globalSQLiteManager = getSQLiteManager(config.database);
globalSQLiteManager.initialize();

// Initialize global GraphStorage
console.log("[Main] Initializing global GraphStorage");
await initializeGraphStorage(globalSQLiteManager);

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
const conductorResources = config.conductor.resourceConstraints;
resourceManager.startMonitoring();
logger.systemEvent("Resource Manager Started", {
  maxMemoryMB: conductorResources.maxMemoryMB,
  maxCpuPercent: conductorResources.maxCpuPercent,
  embeddingFallback: config.mcp.embedding?.fallbackToMemory,
});

// Initialize conductor orchestrator lazily
let conductor: ConductorOrchestrator | null = null;

function getConductor(): ConductorOrchestrator {
  if (!conductor) {
    // TASK-001: Use YAML configuration for conductor setup
    conductor = new ConductorOrchestrator(config.conductor ?? {});
  }
  return conductor;
}

let semanticAgentInstance: any | null = null;
let semanticAgentInitPromise: Promise<any> | null = null;

async function getSemanticAgent(): Promise<any> {
  const cond = getConductor();
  await cond.initialize();

  if (semanticAgentInstance) return semanticAgentInstance;
  if (semanticAgentInitPromise) return semanticAgentInitPromise;

  semanticAgentInitPromise = (async () => {
    let agent = cond.getAgentsByType(AgentType.SEMANTIC)[0];
    if (!agent) {
      const { SemanticAgent } = await import("./agents/semantic-agent.js");
      agent = new SemanticAgent();
      await agent.initialize();
      cond.register(agent);
    }
    semanticAgentInstance = agent;
    return agent;
  })().finally(() => {
    semanticAgentInitPromise = null;
  });

  return semanticAgentInitPromise;
}

let devAgentInstance: any | null = null;
let devAgentInitPromise: Promise<any> | null = null;

async function getDevAgent(): Promise<any> {
  const cond = getConductor();
  await cond.initialize();

  if (devAgentInstance) return devAgentInstance;
  if (devAgentInitPromise) return devAgentInitPromise;

  devAgentInitPromise = (async () => {
    let agent = cond.getAgentsByType(AgentType.DEV)[0];
    if (!agent) {
      const { DevAgent } = await import("./agents/dev-agent.js");
      agent = new DevAgent();
      await agent.initialize();
      cond.register(agent);
    }
    devAgentInstance = agent;
    return agent;
  })().finally(() => {
    devAgentInitPromise = null;
  });

  return devAgentInitPromise;
}

let doraAgentInstance: any | null = null;
let doraAgentInitPromise: Promise<any> | null = null;

async function getDoraAgent(): Promise<any> {
  const cond = getConductor();
  await cond.initialize();

  if (doraAgentInstance) return doraAgentInstance;
  if (doraAgentInitPromise) return doraAgentInitPromise;

  doraAgentInitPromise = (async () => {
    let agent = cond.getAgentsByType(AgentType.DORA)[0];
    if (!agent) {
      const { DoraAgent } = await import("./agents/dora-agent.js");
      agent = new DoraAgent();
      await agent.initialize();
      cond.register(agent);
    }
    doraAgentInstance = agent;
    return agent;
  })().finally(() => {
    doraAgentInitPromise = null;
  });

  return doraAgentInitPromise;
}

async function ensureSemanticsReady(minVectors = 1, timeoutMs = 15000): Promise<boolean> {
  if (process.env.MCP_DEBUG_DISABLE_SEMANTIC === "1") {
    return true;
  }
  const agent = await getSemanticAgent();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const metrics = typeof agent.getSemanticMetrics === "function" ? agent.getSemanticMetrics() : undefined;
      if (metrics && metrics.vectorsStored >= minVectors) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function toPosixPath(p?: string): string {
  return (p || "").replace(/\\/g, "/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveEntity(
  storage: Awaited<ReturnType<typeof getGraphStorage>>,
  identifier: string,
): Promise<Entity | null> {
  const direct = await storage.getEntity(identifier);
  if (direct) return direct;

  const query = await storage.executeQuery({
    type: "entity",
    filters: { name: new RegExp(escapeRegExp(identifier), "i") },
    limit: 5,
  });
  if (query.entities.length > 0) {
    return query.entities[0]!;
  }

  const fallback = await storage.executeQuery({ type: "entity", limit: 1 });
  return fallback.entities[0] ?? null;
}

async function resolveEntityWithHint(
  storage: Awaited<ReturnType<typeof getGraphStorage>>,
  name: string,
  hintFilePath?: string,
): Promise<Entity | null> {
  const esc = (s: string) => escapeRegExp(s);
  const resolvedHintPath = hintFilePath ? normalizeInputPath(hintFilePath) : undefined;

  if (resolvedHintPath) {
    const hintLower = toPosixPath(resolvedHintPath).toLowerCase();

    const exact = await storage.executeQuery({
      type: "entity",
      filters: {
        filePath: resolvedHintPath,
        name: new RegExp(`^${esc(name)}$`, "i"),
      },
      limit: 5,
    });
    if (exact.entities.length > 0) {
      exact.entities.sort((a, b) => (a.filePath?.length ?? 0) - (b.filePath?.length ?? 0));
      return exact.entities[0]!;
    }

    const fuzzy = await storage.executeQuery({
      type: "entity",
      filters: { name: new RegExp(`^${esc(name)}$`, "i") },
      limit: 30,
    });

    const badPaths = [
      "/dist/",
      "/build/",
      "/out/",
      "/.next/",
      "/.nuxt/",
      "/coverage/",
      "/node_modules/",
      "/tmp/",
      "/temp/",
      "/archives/",
      "/archive/",
      ".zip",
      ".tar",
      ".gz",
      ".tgz",
      ".rar",
      ".7z",
      ".xz",
      ".bz2",
      ".zst",
    ];

    const ranked = fuzzy.entities
      .map((e) => {
        const p = toPosixPath(e.filePath).toLowerCase();
        let score = 0;
        if (p === hintLower) score += 5;
        else if (p.endsWith(hintLower)) score += 4;
        else if (p.includes(hintLower)) score += 3;

        if (badPaths.some((b) => p.includes(b))) score -= 2;
        else score += 1;

        return { e, score };
      })
      .sort((a, b) => b.score - a.score || (a.e.filePath?.length ?? 0) - (b.e.filePath?.length ?? 0));

    const top = ranked[0];
    if (top && top.score > 0) {
      return top.e ?? null;
    }
  }

  const query = await storage.executeQuery({
    type: "entity",
    filters: { name: new RegExp(esc(name), "i") },
    limit: 20,
  });
  if (query.entities.length === 0) {
    const fb = await storage.executeQuery({ type: "entity", limit: 1 });
    return fb.entities[0] ?? null;
  }

  const badPaths = [
    "/dist/",
    "/build/",
    "/out/",
    "/.next/",
    "/.nuxt/",
    "/coverage/",
    "/node_modules/",
    "/tmp/",
    "/temp/",
    "/archives/",
    "/archive/",
    ".zip",
    ".tar",
    ".gz",
    ".tgz",
    ".rar",
    ".7z",
    ".xz",
    ".bz2",
    ".zst",
  ];

  const ranked = query.entities
    .map((e) => {
      const p = toPosixPath(e.filePath).toLowerCase();
      let score = 0;
      if (e.name?.toLowerCase() === name.toLowerCase()) score += 1;
      if (badPaths.some((b) => p.includes(b))) score -= 2;
      else score += 1;
      return { e, score };
    })
    .sort((a, b) => b.score - a.score || (a.e.filePath?.length ?? 0) - (b.e.filePath?.length ?? 0));

  return ranked[0]?.e ?? null;
}

function mapEntitySummary(entity: Entity) {
  const normalizedPath = normalizeInputPath(entity.filePath) ?? entity.filePath;
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    filePath: normalizedPath,
    location: entity.location,
    metadata: entity.metadata,
  };
}

function summarizeRelationships(relationships: Relationship[], neighbors: Map<string, Entity>) {
  return relationships.map((rel) => ({
    id: rel.id,
    type: rel.type,
    from: {
      id: rel.fromId,
      name: neighbors.get(rel.fromId)?.name ?? null,
    },
    to: {
      id: rel.toId,
      name: neighbors.get(rel.toId)?.name ?? null,
    },
    metadata: rel.metadata,
  }));
}

function normalizeEntityTypes(types?: string[]): EntityType[] | undefined {
  if (!types?.length) return undefined;

  const allowed = new Set<string>(Object.values(EntityType));
  const normalized: EntityType[] = [];

  for (const value of types) {
    const lower = value.toLowerCase();
    if (allowed.has(lower)) {
      normalized.push(lower as EntityType);
    }
  }

  return normalized.length > 0 ? normalized : undefined;
}

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
    "**/test/**",
    "**/tests/**",
    "**/__tests__/**",
    "**/.memory_bank/**",
    "tmp/**",
    "temp/**",
    "**/tmp/**",
    "**/temp/**",
    "*.log",
    "*.tmp",
    "*.cache",
    "**/*.md",
    "*.zip",
    "*.tar",
    "*.tar.gz",
    "*.tgz",
    "*.gz",
    "*.bz2",
    "*.xz",
    "*.7z",
    "*.rar",
    "*.zst",
    ".DS_Store",
    "Thumbs.db",
  ]),
  fullScan: z.boolean().optional().default(false),
});

const ListEntitiesToolSchema = z.object({
  filePath: z.string().describe("Path to the file to list entities from"),
  entityTypes: z.array(z.string()).describe("Types of entities to list").optional(),
});

const ListRelationshipsToolSchema = z
  .object({
    entityId: z.string().optional().describe("Exact entity ID to find relationships for"),
    entityName: z.string().optional().describe("Name of the entity to find relationships for"),
    filePath: z.string().optional().describe("Optional file path hint to disambiguate entity"),
    depth: z.number().optional().default(1).describe("Depth of relationship traversal"),
    relationshipTypes: z.array(z.string()).optional().describe("Types of relationships to include"),
  })
  .refine((value) => Boolean(value.entityId || value.entityName), {
    message: "Provide either entityId or entityName",
    path: ["entityId"],
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
  threshold: z.number().optional().default(0.5).describe("Similarity threshold (0-1)"),
  limit: z.number().optional().default(10).describe("Maximum results to return"),
});

const AnalyzeCodeImpactSchema = z.object({
  entityId: z.string().describe("Entity ID or name to analyze impact for"),
  filePath: z.string().optional().describe("Optional file path hint to disambiguate entity"),
  depth: z.number().optional().default(2).describe("Depth of impact analysis"),
});

const DetectCodeClonesSchema = z.object({
  minSimilarity: z.number().optional().default(0.8).describe("Minimum similarity for clones"),
  scope: z.string().optional().default("all").describe("Scope: all, file, or module"),
});

const JscpdCloneDetectionSchema = z.object({
  paths: z
    .array(z.string())
    .nonempty()
    .optional()
    .describe("Directories or files to scan. Relative paths resolve against the server root."),
  pattern: z.string().optional().describe("Glob pattern to apply within each path (default **/*)."),
  ignore: z.array(z.string()).optional().describe("Glob patterns to exclude from scanning."),
  formats: z
    .array(z.string().regex(/^[^.]+$/))
    .optional()
    .describe("File extensions to include without dots (e.g. ['ts','js'])."),
  minLines: z.number().int().min(1).optional().describe("Minimum lines per clone block."),
  maxLines: z.number().int().min(1).optional().describe("Maximum lines per clone block."),
  minTokens: z.number().int().min(1).optional().describe("Minimum tokens per clone (interpreted as lines)."),
  ignoreCase: z.boolean().optional().describe("Lowercase tokens before comparison."),
});

const SuggestRefactoringSchema = z
  .object({
    filePath: z.string().describe("File to analyze for refactoring"),
    focusArea: z.string().optional().describe("Specific entity name to focus on"),
    entityId: z.string().optional().describe("Exact entity ID to analyze"),
    startLine: z.number().int().min(1).optional().describe("1-based start line for manual selection"),
    endLine: z.number().int().min(1).optional().describe("1-based end line (exclusive)"),
  })
  .refine(
    (v) =>
      (v.startLine == null && v.endLine == null) ||
      (v.startLine != null && v.endLine != null && v.startLine < v.endLine),
    {
      message: "startLine and endLine must both be provided and startLine < endLine",
      path: ["startLine"],
    },
  );

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
  sample: z.number().optional().default(1).describe("Sample size to fetch for verification"),
});

const GetBusStatsSchema = z.object({});
const ClearBusTopicSchema = z.object({
  topic: z
    .string()
    .min(1)
    .describe("Exact knowledge bus topic to clear (use wildcards via knowledgeBus.query for inspection)"),
});

// Convenience tool: clean index (reset + index)
const CleanIndexSchema = z.object({
  directory: z.string().describe("Directory to index after reset").optional(),
  excludePatterns: z.array(z.string()).describe("Patterns to exclude during indexing").optional().default([]),
  fullScan: z.boolean().optional().default(false),
});

const GetAgentMetricsSchema = z.object({});

// Create MCP server
const server = new Server(
  {
    name: versionInfo.name,
    version: versionInfo.version,
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
        description:
          "List parsed entities within a single file (imports, functions, classes, etc.); use as the entry point to discover stable entity identifiers before running relationship queries.",
        inputSchema: zodToJsonSchema(ListEntitiesToolSchema) as any,
      },
      {
        name: "list_entity_relationships",
        description:
          "List outgoing relationships for an entity (imports, references, containment). Provide either the entity id (preferred) or name+file path to inspect its dependencies.",
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
      {
        name: "get_version",
        description: "Get MCP server version information and runtime details",
        inputSchema: zodToJsonSchema(z.object({})) as any,
      },
      // New semantic tools - TASK-002
      {
        name: "semantic_search",
        description:
          "Search the codebase using natural language keywords or file/module paths. Useful for discovery before diving into structural graph queries.",
        inputSchema: zodToJsonSchema(SemanticSearchSchema) as any,
      },
      {
        name: "find_similar_code",
        description: "Find code similar to a given snippet using semantic analysis",
        inputSchema: zodToJsonSchema(FindSimilarCodeSchema) as any,
      },
      {
        name: "analyze_code_impact",
        description:
          "Discover entities and files that depend on a given symbol. Use together with list_file_entities to obtain the precise entity id for impact analysis.",
        inputSchema: zodToJsonSchema(AnalyzeCodeImpactSchema) as any,
      },
      {
        name: "detect_code_clones",
        description: "Find duplicate or similar code blocks across the codebase",
        inputSchema: zodToJsonSchema(DetectCodeClonesSchema) as any,
      },
      {
        name: "jscpd_detect_clones",
        description: "Run JSCPD clone detection using a lightweight tokenizer",
        inputSchema: zodToJsonSchema(JscpdCloneDetectionSchema) as any,
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
      {
        name: "get_agent_metrics",
        description: "Collect runtime telemetry for conductor and registered agents",
        inputSchema: zodToJsonSchema(GetAgentMetricsSchema) as any,
      },
      {
        name: "get_bus_stats",
        description: "Inspect knowledge bus statistics (topics, entries, subscriptions)",
        inputSchema: zodToJsonSchema(GetBusStatsSchema) as any,
      },
      {
        name: "clear_bus_topic",
        description: "Remove cached knowledge entries for a specific topic",
        inputSchema: zodToJsonSchema(ClearBusTopicSchema) as any,
      },
    ],
  };
});

async function executeToolCall(name: string, args: unknown, requestId: string, startTime: number) {
  try {
    switch (name) {
      case "index": {
        const { directory: indexDir, incremental, excludePatterns, reset, fullScan } = IndexToolSchema.parse(args);
        const targetDir = indexDir || directory;

        // Optional reset
        if (reset) {
          const storage = await getGraphStorage(globalSQLiteManager);
          await storage.clear();
          logger.systemEvent("Graph storage cleared before indexing", { directory: targetDir });
        }

        if (process.env.MCP_DEBUG_DISABLE_SEMANTIC !== "1") {
          await getSemanticAgent();
        }

        // Enhanced exclude patterns for large codebases
        const enhancedExcludePatterns = [...excludePatterns];

        // Check codebase size and add adaptive patterns
        try {
          const { execSync } = await import("node:child_process");
          const fileCount = execSync(
            `find "${targetDir}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" -o -name "*.cpp" -o -name "*.c" -o -name "*.go" -o -name "*.rs" \\) | wc -l`,
            { encoding: "utf8" },
          ).trim();
          const numFiles = parseInt(fileCount, 10);

          logger.info(
            "INDEXING",
            `Detected ${numFiles} source files in codebase`,
            { directory: targetDir, fileCount: numFiles },
            requestId,
          );

          // Adjust resource allocation based on codebase size
          const { execSync: execSync2 } = await import("node:child_process");
          const projectSizeBytes = execSync2(`du -sb "${targetDir}" | cut -f1`, { encoding: "utf8" }).trim();
          const projectSizeMB = Math.floor(parseInt(projectSizeBytes, 10) / (1024 * 1024));
          resourceManager.adjustForCodebaseSize(numFiles, projectSizeMB);

          // For very large codebases (>2000 files), add more aggressive patterns
          if (numFiles > 2000) {
            logger.info(
              "INDEXING",
              "Large codebase detected, adding additional exclude patterns",
              { fileCount: numFiles },
              requestId,
            );
            enhancedExcludePatterns.push(
              "**/test/**",
              "**/tests/**",
              "**/*_test.*",
              "**/*_spec.*",
              "**/*.test.*",
              "**/*.spec.*",
              "**/docs/**",
              "**/doc/**",
              "**/documentation/**",
              "**/examples/**",
              "**/example/**",
              "**/demo/**",
              "**/demos/**",
              "**/migrations/**",
              "**/scripts/**",
              "**/tools/**",
              "**/*.min.js",
              "**/*.min.css",
              "**/bundle.*",
              "**/vendor.*",
            );
          }

          // For extremely large codebases (>5000 files), enable incremental by default
          if (numFiles > 5000 && !incremental) {
            logger.info(
              "INDEXING",
              "Extremely large codebase detected, recommending incremental mode",
              { fileCount: numFiles },
              requestId,
            );
          }

          if (!fullScan) {
            if (numFiles > 2000) {
              logger.info(
                "INDEXING",
                "Large codebase detected, enabling batch processing",
                { fileCount: numFiles },
                requestId,
              );
              enhancedExcludePatterns.push("__batch_processing_enabled__"); // Special marker for batch processing
            }
          } else {
            logger.info("INDEXING", "Full scan requested, batch mode disabled", { fileCount: numFiles }, requestId);
          }
        } catch (error) {
          logger.warn(
            "INDEXING",
            "Could not detect codebase size, using default patterns",
            { error: (error as Error).message },
            requestId,
          );
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
        const configuredTimeout = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const timeoutMs = isDebugMode ? Math.max(configuredTimeout, 120000) : configuredTimeout;
        const result = await withTimeout(cond.process(task), timeoutMs, "index", requestId);

        if (process.env.MCP_DEBUG_DISABLE_SEMANTIC !== "1") {
          await ensureSemanticsReady(1, 5000);
        }

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
        const storage = await getGraphStorage(globalSQLiteManager);
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
        const { directory: indexDir, excludePatterns, fullScan } = CleanIndexSchema.parse(args);
        const targetDir = indexDir || directory;

        // Reset graph first
        const storage = await getGraphStorage(globalSQLiteManager);
        await storage.clear();
        logger.systemEvent("Graph storage cleared before clean index", { directory: targetDir });

        if (process.env.MCP_DEBUG_DISABLE_SEMANTIC !== "1") {
          await getSemanticAgent();
        }

        // Perform index with reset semantics (already cleared), non-incremental
        const enhancedExcludePatterns = [...(excludePatterns || [])];

        // Adaptive patterns as in index tool
        try {
          const { execSync } = await import("node:child_process");
          const fileCount = execSync(
            `find "${targetDir}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" -o -name "*.cpp" -o -name "*.c" -o -name "*.go" -o -name "*.rs" \\) | wc -l`,
            { encoding: "utf8" },
          ).trim();
          const numFiles = parseInt(fileCount, 10);
          logger.info(
            "INDEXING",
            `Detected ${numFiles} source files in codebase (clean_index)`,
            { directory: targetDir, fileCount: numFiles },
            requestId,
          );
          const { execSync: execSync2 } = await import("node:child_process");
          const projectSizeBytes = execSync2(`du -sb "${targetDir}" | cut -f1`, { encoding: "utf8" }).trim();
          const projectSizeMB = Math.floor(parseInt(projectSizeBytes, 10) / (1024 * 1024));
          resourceManager.adjustForCodebaseSize(numFiles, projectSizeMB);
          if (numFiles > 2000) {
            enhancedExcludePatterns.push(
              "**/test/**",
              "**/tests/**",
              "**/*_test.*",
              "**/*_spec.*",
              "**/*.test.*",
              "**/*.spec.*",
              "**/docs/**",
              "**/doc/**",
              "**/documentation/**",
              "**/examples/**",
              "**/example/**",
              "**/demo/**",
              "**/demos/**",
              "**/migrations/**",
              "**/scripts/**",
              "**/tools/**",
              "**/*.min.js",
              "**/*.min.css",
              "**/bundle.*",
              "**/vendor.*",
            );
          }

          if (!fullScan) {
            if (numFiles > 2000) {
              logger.info(
                "INDEXING",
                "Large codebase detected, enabling batch processing (clean_index)",
                { fileCount: numFiles },
                requestId,
              );
              enhancedExcludePatterns.push("__batch_processing_enabled__");
            }
          } else {
            logger.info(
              "INDEXING",
              "Full scan requested, batch mode disabled (clean_index)",
              { fileCount: numFiles },
              requestId,
            );
          }
        } catch (error) {
          logger.warn(
            "INDEXING",
            "Could not detect codebase size (clean_index), using default patterns",
            { error: (error as Error).message },
            requestId,
          );
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

        if (process.env.MCP_DEBUG_DISABLE_SEMANTIC !== "1") {
          await ensureSemanticsReady(1, 5000);
        }

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
        const targetFilePath = normalizeInputPath(filePath);

        const cacheKey = `entities:${targetFilePath}`;
        const cached = knowledgeBus.query(cacheKey, 1);
        if (cached.length > 0) {
          const entry = cached[0];
          if (entry && Date.now() - entry.timestamp < 60000) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(entry.data, null, 2),
                },
              ],
            };
          }
        }

        const storage = await getGraphStorage(globalSQLiteManager);
        const normalizedEntityTypes = normalizeEntityTypes(entityTypes);
        const query = await storage.executeQuery({
          type: "entity",
          filters: {
            filePath: targetFilePath,
            ...(normalizedEntityTypes ? { entityType: normalizedEntityTypes } : {}),
          },
          limit: 500,
        });

        const entities = query.entities
          .slice()
          .sort((a, b) => (a.location.start.index ?? 0) - (b.location.start.index ?? 0))
          .map((entity) => mapEntitySummary(entity));

        const response = {
          filePath: targetFilePath,
          total: entities.length,
          entities,
          stats: query.stats,
        };

        knowledgeBus.publish(cacheKey, response, "mcp-server", 60000);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }
      case "list_entity_relationships": {
        const {
          entityId: directId,
          entityName,
          relationshipTypes,
          filePath: hintFilePath,
        } = ListRelationshipsToolSchema.parse(args);
        const storage = await getGraphStorage(globalSQLiteManager);
        const resolvedHintPath = hintFilePath ? normalizeInputPath(hintFilePath) : undefined;

        let entity: Entity | null = null;
        if (directId) {
          entity = await storage.getEntity(directId);
        }
        if (!entity) {
          entity = await resolveEntityWithHint(storage, entityName ?? directId ?? "", resolvedHintPath);
        }
        if (!entity) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: false, error: `Entity not found: ${entityName}` }, null, 2),
              },
            ],
          };
        }

        const relationships = await storage.getRelationshipsForEntity(entity.id);
        const filtered =
          Array.isArray(relationshipTypes) && relationshipTypes.length > 0
            ? relationships.filter((rel) => relationshipTypes.includes(rel.type))
            : relationships;

        const neighborIds = new Set<string>();
        for (const rel of filtered) {
          neighborIds.add(rel.fromId);
          neighborIds.add(rel.toId);
        }

        const neighborMap = new Map<string, Entity>();
        neighborMap.set(entity.id, entity);
        for (const id of neighborIds) {
          if (neighborMap.has(id)) continue;
          const neighbor = await storage.getEntity(id);
          if (neighbor) {
            neighborMap.set(id, neighbor);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  entity: mapEntitySummary(entity),
                  relationships: summarizeRelationships(filtered, neighborMap),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "query": {
        const { query, limit } = QueryToolSchema.parse(args);
        await ensureSemanticsReady(1, 20000);
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        let semanticResult: unknown = [];

        try {
          const semanticAgent = await getSemanticAgent();
          semanticResult = await withTimeout(
            semanticAgent.semanticSearch(query, limit),
            timeoutMs,
            "query:semantic_search",
            requestId,
          );
        } catch (error) {
          logger.warn(
            "SEMANTIC_QUERY",
            "Semantic search fallback engaged",
            { query, error: (error as Error).message },
            requestId,
          );
          semanticResult = [];
        }

        const storage = await getGraphStorage(globalSQLiteManager);
        const structural = await queryGraphEntities(storage, query, limit ?? 10);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  semantic: semanticResult,
                  structural: {
                    entities: structural.entities.map((entity) => mapEntitySummary(entity)),
                    relationships: structural.relationships.length,
                    stats: structural.stats,
                  },
                },
                null,
                2,
              ),
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

      case "get_version": {
        const versionInfo = getVersionInfo();
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  server: {
                    name: versionInfo.name,
                    version: versionInfo.version,
                    description: versionInfo.description,
                    homepage: versionInfo.homepage,
                    repository: versionInfo.repository,
                  },
                  runtime: {
                    nodeVersion: versionInfo.nodeVersion,
                    platform: versionInfo.platform,
                    arch: versionInfo.arch,
                    pid: process.pid,
                    uptime: {
                      seconds: Math.floor(uptime),
                      formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
                    },
                  },
                  memory: {
                    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                    external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
                  },
                  indexedDirectory: directory,
                  configEnvironment: config.environment,
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
        await ensureSemanticsReady(1, 20000);

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
        await ensureSemanticsReady(1, 20000);
        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const sim = await withTimeout(
          semanticAgent.findSimilarCode(code, threshold ?? 0.5),
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
        await ensureSemanticsReady(1, 20000);
        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
        const semanticResult = await withTimeout<CloneGroup[]>(
          semanticAgent.detectClones(minSimilarity),
          timeoutMs,
          "detect_code_clones",
          requestId,
        );

        const jscpdResult = await runJscpdCloneDetection({
          paths: [directory],
          minTokens: 20,
          minLines: 3,
          ignore: [
            "node_modules/**",
            "dist/**",
            "coverage/**",
            "tmp/**",
            "**/tmp/**",
            "**/__tests__/**",
            "**/tests/**",
            "**/*.d.ts",
          ],
        });

        const semanticNormalized = normalizeSemanticCloneGroups(semanticResult, directory);

        const combined = {
          semantic: {
            totalGroups: semanticNormalized.groups.length,
            skippedGroups: semanticNormalized.skippedGroups,
            groups: semanticNormalized.groups,
            raw: semanticResult,
          },
          jscpd: {
            summary: jscpdResult.summary,
            clones: jscpdResult.summary.clones,
          },
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(combined, null, 2),
            },
          ],
        };
      }

      case "jscpd_detect_clones": {
        const parsed = JscpdCloneDetectionSchema.parse(args);
        const rawPaths = parsed.paths && parsed.paths.length > 0 ? parsed.paths : [directory];
        const resolvedPaths = rawPaths
          .map((p) => normalizeInputPath(p) ?? directory)
          .filter((p): p is string => Boolean(p));

        const result = await runJscpdCloneDetection({
          paths: resolvedPaths,
          pattern: parsed.pattern,
          ignore: parsed.ignore,
          formats: parsed.formats?.map((fmt) => fmt.toLowerCase()),
          minLines: parsed.minLines,
          maxLines: parsed.maxLines,
          minTokens: parsed.minTokens,
          ignoreCase: parsed.ignoreCase,
        });

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
        const { filePath, focusArea, entityId, startLine, endLine } = SuggestRefactoringSchema.parse(args);
        const targetFilePath = normalizeInputPath(filePath);

        const semanticAgent = await getSemanticAgent();
        const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;

        const fs = await import("node:fs/promises");
        const storage = await getGraphStorage(globalSQLiteManager);

        const MAX_SNIPPET = 10000;

        const readFileSafe = async (p: string) => {
          const normalizedPath = normalizeInputPath(p);
          try {
            return await fs.readFile(normalizedPath, "utf8");
          } catch {
            return "";
          }
        };

        const sliceByLines = (text: string, sLine: number, eLine: number) => {
          const lines = text.split(/\r?\n/);
          const startIdx = Math.max(1, Math.min(sLine, lines.length));
          const endIdx = Math.max(startIdx + 1, Math.min(eLine, lines.length + 1)); // end exclusive
          const snippet = lines.slice(startIdx - 1, endIdx - 1).join("\n");
          return { snippet, range: { startLine: startIdx, endLine: endIdx } };
        };

        const sliceByEntity = (text: string, e: Entity) => {
          const loc: any = (e as any).location ?? {};
          let snippet = "";
          let range: { startIndex?: number; endIndex?: number; startLine?: number; endLine?: number } | undefined;

          if (typeof loc.start?.index === "number" && typeof loc.end?.index === "number") {
            const start = Math.max(0, Math.min(loc.start.index, text.length));
            const end = Math.max(start, Math.min(loc.end.index, text.length));
            snippet = text.slice(start, end);
            range = { startIndex: start, endIndex: end };
          } else if (typeof loc.start?.line === "number" && typeof loc.end?.line === "number") {
            const res = sliceByLines(text, loc.start.line, loc.end.line);
            snippet = res.snippet;
            range = { startLine: res.range.startLine, endLine: res.range.endLine };
          } else {
            snippet = text;
          }
          return { snippet, range };
        };

        const runSuggest = async (snippet: string) => {
          const limited = snippet.length > MAX_SNIPPET ? snippet.slice(0, MAX_SNIPPET) : snippet;
          return await withTimeout(
            semanticAgent.suggestRefactoring(limited),
            timeoutMs,
            "suggest_refactoring",
            requestId,
          );
        };

        const analyzed: Array<{
          entity?: ReturnType<typeof mapEntitySummary>;
          range?: { startLine?: number; endLine?: number; startIndex?: number; endIndex?: number };
          suggestions: unknown;
        }> = [];

        const fileText = await readFileSafe(targetFilePath);

        if (!fileText) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: false, error: `Cannot read file: ${targetFilePath}` }, null, 2),
              },
            ],
          };
        }

        if (startLine != null && endLine != null) {
          const { snippet, range } = sliceByLines(fileText, startLine, endLine);
          const suggestions = await runSuggest(snippet);
          analyzed.push({ range, suggestions });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ filePath: targetFilePath, focus: { mode: "range", range }, analyzed }, null, 2),
              },
            ],
          };
        }

        if (entityId) {
          const ent = await storage.getEntity(entityId);
          if (!ent) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ success: false, error: `Entity not found by id: ${entityId}` }, null, 2),
                },
              ],
            };
          }

          const { snippet, range } = sliceByEntity(fileText, ent);
          const suggestions = await runSuggest(snippet);
          analyzed.push({ entity: mapEntitySummary(ent), range, suggestions });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { filePath: targetFilePath, focus: { mode: "entityId", entityId: ent.id }, analyzed },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        if (focusArea) {
          const ent = await resolveEntityWithHint(storage, focusArea, targetFilePath);
          if (ent) {
            const { snippet, range } = sliceByEntity(fileText, ent);
            const suggestions = await runSuggest(snippet);
            analyzed.push({ entity: mapEntitySummary(ent), range, suggestions });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { filePath: targetFilePath, focus: { mode: "focusArea", focusArea }, analyzed },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
        }

        const query = await storage.executeQuery({
          type: "entity",
          filters: { filePath: targetFilePath },
          limit: 500,
        });

        const sorted = query.entities
          .filter((e) => (e as any).location?.start != null && (e as any).location?.end != null)
          .map((e) => {
            const s = (e as any).location?.start?.index ?? 0;
            const ed = (e as any).location?.end?.index ?? 0;
            return { e, len: Math.max(0, ed - s) };
          })
          .sort((a, b) => b.len - a.len)
          .slice(0, 3)
          .map((x) => x.e);

        if (sorted.length === 0) {
          const suggestions = await runSuggest(fileText);
          analyzed.push({ range: { startIndex: 0, endIndex: Math.min(fileText.length, MAX_SNIPPET) }, suggestions });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ filePath: targetFilePath, focus: { mode: "file" }, analyzed }, null, 2),
              },
            ],
          };
        }

        for (const ent of sorted) {
          const { snippet, range } = sliceByEntity(fileText, ent);
          const suggestions = await runSuggest(snippet);
          analyzed.push({ entity: mapEntitySummary(ent), range, suggestions });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { filePath: targetFilePath, focus: { mode: "auto-top-entities", count: analyzed.length }, analyzed },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "cross_language_search": {
        const { query, languages } = CrossLanguageSearchSchema.parse(args);
        await ensureSemanticsReady(1, 20000);
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
        const storage = await getGraphStorage(globalSQLiteManager);
        const relationshipSample = await storage.executeQuery({ type: "relationship", limit: 10000 });

        const counts = new Map<string, { incoming: number; outgoing: number }>();
        for (const rel of relationshipSample.relationships) {
          const from = counts.get(rel.fromId) ?? { incoming: 0, outgoing: 0 };
          from.outgoing += 1;
          counts.set(rel.fromId, from);

          const to = counts.get(rel.toId) ?? { incoming: 0, outgoing: 0 };
          to.incoming += 1;
          counts.set(rel.toId, to);
        }

        const ranked = Array.from(counts.entries())
          .map(([id, data]) => ({ id, ...data, total: data.incoming + data.outgoing }))
          .sort((a, b) => b.total - a.total)
          .slice(0, limit ?? 10);

        const hotspots = [] as Array<{
          entity: ReturnType<typeof mapEntitySummary>;
          metrics: { incoming: number; outgoing: number; total: number };
          score: number;
        }>;

        for (const entry of ranked) {
          const entity = await storage.getEntity(entry.id);
          if (!entity) continue;
          const baseScore = entry.total * 10 + entry.incoming * 5;
          const metricScore =
            metric === "complexity" ? entry.total * 2 : metric === "coupling" ? entry.incoming * 3 : entry.outgoing * 3;
          hotspots.push({
            entity: mapEntitySummary(entity),
            metrics: { incoming: entry.incoming, outgoing: entry.outgoing, total: entry.total },
            score: Math.round(baseScore + metricScore),
          });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  metric,
                  limit: limit ?? 10,
                  hotspots,
                  sampleSize: relationshipSample.relationships.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "find_related_concepts": {
        const { entityId, limit } = FindRelatedConceptsSchema.parse(args);
        await ensureSemanticsReady(1, 20000);
        const storage = await getGraphStorage(globalSQLiteManager);
        const entity = await resolveEntity(storage, entityId);
        if (!entity) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: false, error: `Entity not found: ${entityId}` }, null, 2),
              },
            ],
          };
        }

        // Read code snippet for this entity using stored location
        const fs = await import("node:fs/promises");
        const entityFilePath = normalizeInputPath(entity.filePath) ?? entity.filePath;
        let snippet = "";
        try {
          const full = await fs.readFile(entityFilePath, "utf8");
          const startIdx =
            typeof (entity as any).location?.start?.index === "number" ? (entity as any).location.start.index : 0;
          const endIdx =
            typeof (entity as any).location?.end?.index === "number" ? (entity as any).location.end.index : full.length;
          if (endIdx > startIdx && endIdx - startIdx < 10000) {
            snippet = full.slice(startIdx, endIdx);
          } else {
            // Fallback to line range if indices are missing
            const sLine = (entity as any).location?.start?.line ? (entity as any).location.start.line - 1 : 0;
            const eLine = (entity as any).location?.end?.line ? (entity as any).location.end.line : sLine + 10;
            const lines = full.split(/\r?\n/);
            snippet = lines.slice(Math.max(0, sLine), Math.min(lines.length, eLine)).join("\n");
            if (snippet.length > 10000) snippet = snippet.slice(0, 10000);
          }
        } catch {
          // If read fails, return empty
          snippet = "";
        }

        let results: unknown = [];
        try {
          const semanticAgent = await getSemanticAgent();
          const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 30000;
          const sim = await withTimeout(
            semanticAgent.findSimilarCode(snippet, 0.65),
            timeoutMs,
            "find_related_concepts",
            requestId,
          );
          results = Array.isArray(sim) && limit ? sim.slice(0, limit) : sim;
        } catch (error) {
          logger.warn(
            "SEMANTIC_RELATED",
            "Related concepts fallback",
            { entityId, error: (error as Error).message },
            requestId,
          );
          results = [];
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { entity: { id: entity.id, name: entity.name, filePath: entityFilePath }, related: results },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "get_graph": {
        const { query, limit } = GetGraphSchema.parse(args);

        // Use direct database query instead of going through agents
        const storage = await getGraphStorage(globalSQLiteManager);
        const result = await queryGraphEntities(storage, query, limit);

        logger.info(
          "GRAPH_QUERY",
          `Retrieved graph with ${result.entities.length} entities and ${result.relationships.length} relationships`,
          {
            query,
            limit,
            stats: result.stats,
          },
          requestId,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  entities: result.entities,
                  relations: result.relationships,
                  stats: {
                    totalNodes: result.stats.totalEntities,
                    totalRelations: result.stats.totalRelationships,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "analyze_code_impact": {
        const { entityId, filePath: hintFilePath } = AnalyzeCodeImpactSchema.parse(args);
        const storage = await getGraphStorage(globalSQLiteManager);
        const resolvedHintPath = hintFilePath ? normalizeInputPath(hintFilePath) : undefined;

        let entity = await storage.getEntity(entityId);
        if (!entity) {
          entity = await resolveEntityWithHint(storage, entityId, resolvedHintPath);
        }

        if (!entity) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: false, error: `Entity not found: ${entityId}` }, null, 2),
              },
            ],
          };
        }

        const relationships = await storage.getRelationshipsForEntity(entity.id);
        const directIds = new Set<string>();
        const outboundIds = new Set<string>();

        for (const rel of relationships) {
          if (rel.toId === entity.id) {
            directIds.add(rel.fromId);
          }
          if (rel.fromId === entity.id) {
            outboundIds.add(rel.toId);
          }
        }

        const directEntities = (await Promise.all(Array.from(directIds).map((id) => storage.getEntity(id)))).filter(
          (e): e is Entity => Boolean(e),
        );

        const indirectIds = new Set<string>();
        for (const direct of directEntities) {
          const rels = await storage.getRelationshipsForEntity(direct.id);
          for (const rel of rels) {
            const candidate = rel.fromId === direct.id ? rel.toId : rel.fromId;
            if (candidate !== entity.id && !directIds.has(candidate)) {
              indirectIds.add(candidate);
            }
          }
        }

        const indirectEntities = (await Promise.all(Array.from(indirectIds).map((id) => storage.getEntity(id)))).filter(
          (e): e is Entity => Boolean(e),
        );

        const affectedFiles = new Set<string>();
        for (const sample of [...directEntities, ...indirectEntities]) {
          affectedFiles.add(normalizeInputPath(sample.filePath) ?? sample.filePath);
        }

        const totalImpact = directEntities.length + indirectEntities.length;
        const riskLevel =
          totalImpact > 50 ? "critical" : totalImpact > 20 ? "high" : totalImpact > 5 ? "medium" : "low";

        const outboundSummaries = (
          await Promise.all(
            Array.from(outboundIds).map(async (id) => {
              const dep = await storage.getEntity(id);
              return dep ? mapEntitySummary(dep) : null;
            }),
          )
        ).filter((item): item is ReturnType<typeof mapEntitySummary> => Boolean(item));

        const impact = {
          source: mapEntitySummary(entity),
          directImpacts: directEntities.map((item) => mapEntitySummary(item)),
          indirectImpacts: indirectEntities.map((item) => mapEntitySummary(item)),
          outboundDependencies: outboundSummaries,
          affectedFiles: Array.from(affectedFiles),
          riskLevel,
          totals: {
            direct: directEntities.length,
            indirect: indirectEntities.length,
            outbound: outboundIds.size,
          },
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(impact, null, 2),
            },
          ],
        };
      }

      case "get_graph_stats": {
        const storage = await getGraphStorage(globalSQLiteManager);
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
        const storage = await getGraphStorage(globalSQLiteManager);
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

      case "get_agent_metrics": {
        GetAgentMetricsSchema.parse(args ?? {});

        const cond = getConductor();
        await cond.initialize();

        const snapshot = await collectAgentMetrics({
          conductor: cond,
          resourceManager,
          knowledgeBus,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        };
      }

      case "get_bus_stats": {
        GetBusStatsSchema.parse(args ?? {});

        const stats = knowledgeBus.getStats();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      case "clear_bus_topic": {
        const { topic } = ClearBusTopicSchema.parse(args ?? {});

        knowledgeBus.clearTopic(topic);
        const stats = knowledgeBus.getStats();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  topicCleared: topic,
                  stats,
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

    if (error instanceof AgentBusyError) {
      logger.info(
        "AGENT_BUSY",
        `Agent ${error.details.agentId} busy while handling ${name}`,
        { details: error.details },
        requestId,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                errorType: "agent_busy",
                error: errorMessage,
                details: error.details,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

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
}

// Handler for tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const requestId = createRequestId();
  const startTime = Date.now();

  logger.mcpRequest(name, args, requestId);

  return executeToolCall(name, args, requestId, startTime);
});

async function processDebugRequests(requests: DebugRequest[]): Promise<void> {
  for (const { parsed, raw } of requests) {
    let callRequest: z.infer<typeof CallToolRequestSchema>;
    try {
      callRequest = CallToolRequestSchema.parse(parsed);
    } catch (error) {
      console.error(`[Debug] Invalid tools/call request payload: ${raw}`);
      throw error;
    }

    const { name, arguments: args } = callRequest.params;
    const parsedObj = parsed as Record<string, unknown>;
    const responseIdValue = parsedObj?.id;
    const responseId =
      typeof responseIdValue === "string" || typeof responseIdValue === "number" ? responseIdValue : createRequestId();
    const requestId = typeof responseId === "string" ? responseId : String(responseId);
    const startTime = Date.now();

    logger.mcpRequest(name, args, requestId);
    const result = await executeToolCall(name, args, requestId, startTime);

    const response = {
      jsonrpc: "2.0",
      id: responseId,
      result,
    };

    console.log(JSON.stringify(response, null, 2));
  }
}

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

  if (debugRequests.length > 0) {
    try {
      await getDevAgent();
      await getDoraAgent();
      if (process.env.MCP_DEBUG_DISABLE_SEMANTIC !== "1") {
        await getSemanticAgent();
      }
      await processDebugRequests(debugRequests);
      console.log("[Debug] Completed processing supplied requests.");
      process.exit(0);
    } catch (error) {
      console.error("[Debug] Request execution failed:", error instanceof Error ? error.message : error);
      logger.error(
        "DEBUG_MODE",
        "Debug request execution failed",
        { error: error instanceof Error ? error.message : String(error) },
        undefined,
        error instanceof Error ? error : undefined,
      );
      process.exit(1);
    }
    return;
  }

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
