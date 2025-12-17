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

// Ensure stdout is reserved exclusively for MCP JSON-RPC messages (Codex/VSCode is strict).
import "./utils/stdio-console.js";

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import { type AppConfig, ConfigLoader, initializeConfig, validateConfig } from "./config/yaml-config.js";
import { knowledgeBus } from "./core/knowledge-bus.js";
import { resourceManager } from "./core/resource-manager.js";
import { getGraphStorage, initializeGraphStorage } from "./storage/graph-storage-factory.js";
import { getSQLiteManager, type SQLiteManager } from "./storage/sqlite-manager.js";
import { collectAgentMetrics } from "./tools/agent-metrics.js";
import { analyzeCodeImpactTraversal } from "./tools/analyze-code-impact.js";
import { getEntitySource } from "./tools/get-entity-source.js";
// Import graph query functions
import { getGraphStats, queryGraphEntities } from "./tools/graph-query.js";
import { rerankSemanticHits } from "./tools/hybrid-ranking.js";
import { runJscpdCloneDetection } from "./tools/jscpd.js";
import { ingestLernaGraph } from "./tools/lerna-graph-ingest.js";
import { getLernaProjectGraph } from "./tools/lerna-project-graph.js";
import { listEntityRelationshipsTraversal } from "./tools/list-entity-relationships.js";
import { resolveEntityCandidates } from "./tools/resolve-entity.js";
import type { AgentTask } from "./types/agent.js";
import { AgentType } from "./types/agent.js";
import { AgentBusyError } from "./types/errors.js";
import type { CloneGroup } from "./types/semantic.js";
import type { Entity, GraphQuery, Relationship } from "./types/storage.js";
import { EntityType } from "./types/storage.js";
import { decodeCursor, encodeCursor } from "./utils/cursor.js";
import { createRequestId, logger } from "./utils/logger.js";
import { appendGlobalTmpLog, getGlobalTmpLogDir, getGlobalTmpLogFile } from "./utils/tmp-log.js";
import { toolFail, toolOk } from "./utils/tool-response.js";

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
      console.error("Usage: code-graph-rag-mcp [--config <path>] [directory]");
      appendGlobalTmpLog("cli: missing --config path");
      process.exit(1);
    }
    overrideConfigPath = next;
  } else if (arg.startsWith("--config=")) {
    const value = arg.slice("--config=".length);
    if (!value) {
      console.error("Error: --config requires a non-empty path");
      console.error("Usage: code-graph-rag-mcp [--config <path>] [directory]");
      appendGlobalTmpLog("cli: empty --config value");
      process.exit(1);
    }
    overrideConfigPath = value;
  } else if (arg === "--help" || arg === "-h") {
    helpRequested = true;
  } else if (arg === "--version" || arg === "-v") {
    versionRequested = true;
  } else if (arg.startsWith("-")) {
    console.error(`Unknown option: ${arg}`);
    console.error("Usage: code-graph-rag-mcp [--config <path>] [directory]");
    appendGlobalTmpLog("cli: unknown option", { arg });
    process.exit(1);
  } else {
    positionalArgs.push(arg);
  }
}

function printHelp() {
  console.log(`Code Graph RAG MCP Server

Usage:
  code-graph-rag-mcp [options] [directory]

Options:
  --config <path>   Use an alternate YAML configuration file
  --help, -h        Show this help message and exit
  --version, -v     Print version information and exit

Examples:
  code-graph-rag-mcp /path/to/project
  code-graph-rag-mcp --config config/production.yaml /repo
  code-graph-rag-mcp               # use client roots (or cwd)
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

function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return join(homedir(), filepath.slice(1));
  }
  return filepath;
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

const rawFirstPositional = positionalArgs[0]?.trim();
const firstLooksLikeJson = rawFirstPositional
  ? rawFirstPositional.startsWith("{") || rawFirstPositional.startsWith("[")
  : false;
const directoryArg = rawFirstPositional && !firstLooksLikeJson ? positionalArgs[0] : undefined;
const directoryExplicit = Boolean(directoryArg);
let directory = normalize(resolve(expandHome(directoryArg ?? process.cwd())));

type DebugRequest = {
  raw: string;
  parsed: unknown;
};

const debugRequestStrings = directoryArg ? positionalArgs.slice(1) : positionalArgs;
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

// Defer heavy initialization until after the MCP stdio transport is connected.
let config: AppConfig | null = null;
let globalSQLiteManager: SQLiteManager | null = null;
let runtimeInitPromise: Promise<void> | null = null;
let runtimeInitialized = false;

function getConfigOrThrow(): AppConfig {
  if (!config) {
    throw new Error("Runtime not initialized (config missing)");
  }
  return config;
}

function getSQLiteManagerOrThrow(): SQLiteManager {
  if (!globalSQLiteManager) {
    throw new Error("Runtime not initialized (SQLiteManager missing)");
  }
  return globalSQLiteManager;
}

async function resolveDirectoryFromClientRoots(): Promise<string | null> {
  try {
    const rootsResult = await server.listRoots(undefined, { timeout: 1500 });
    for (const root of rootsResult.roots ?? []) {
      if (!root?.uri || typeof root.uri !== "string") continue;
      if (!root.uri.startsWith("file:")) continue;
      return normalize(fileURLToPath(root.uri));
    }
  } catch {
    return null;
  }
  return null;
}

async function ensureRuntimeInitialized(): Promise<void> {
  if (runtimeInitialized) return;

  if (!runtimeInitPromise) {
    runtimeInitPromise = (async () => {
      if (!directoryExplicit) {
        const resolved = await resolveDirectoryFromClientRoots();
        if (resolved) directory = resolved;
      }

      try {
        process.chdir(directory);
      } catch (error) {
        console.error(
          `[Main] Failed to chdir to ${directory}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (overrideConfigPath) {
        ConfigLoader.setOverridePath(overrideConfigPath);
      }

      const cfg = initializeConfig();

      const validation = validateConfig(cfg);
      if (!validation.valid) {
        console.error("[Config] Configuration validation failed:");
        for (const err of validation.errors) {
          console.error(`  - ${err}`);
        }
        throw new Error("Configuration validation failed");
      }

      config = cfg;

      console.error("[Main] Initializing global SQLiteManager with config:", cfg.database.path);
      const sqliteManager = getSQLiteManager(cfg.database);
      sqliteManager.initialize();
      globalSQLiteManager = sqliteManager;

      console.error("[Main] Initializing global GraphStorage");
      await initializeGraphStorage(sqliteManager);

      logger.systemEvent("MCP Server Starting", {
        directory,
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        configEnvironment: cfg.environment,
        embeddingEnabled: cfg.mcp.embedding?.enabled,
      });

      const conductorResources = cfg.conductor.resourceConstraints;
      resourceManager.startMonitoring();
      logger.systemEvent("Resource Manager Started", {
        maxMemoryMB: conductorResources.maxMemoryMB,
        maxCpuPercent: conductorResources.maxCpuPercent,
        embeddingFallback: cfg.mcp.embedding?.fallbackToMemory,
      });

      runtimeInitialized = true;
    })().finally(() => {
      runtimeInitPromise = null;
    });
  }

  await runtimeInitPromise;
}

// Initialize conductor orchestrator lazily
let conductor: ConductorOrchestrator | null = null;

async function getConductor(): Promise<ConductorOrchestrator> {
  await ensureRuntimeInitialized();
  if (!conductor) {
    // TASK-001: Use YAML configuration for conductor setup
    conductor = new ConductorOrchestrator(getConfigOrThrow().conductor ?? {});
  }
  return conductor;
}

let semanticAgentInstance: any | null = null;
let semanticAgentInitPromise: Promise<any> | null = null;

async function getSemanticAgent(): Promise<any> {
  const cond = await getConductor();
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
  const cond = await getConductor();
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
  const cond = await getConductor();
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
    return null;
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

import {
  collectIndexableFiles,
  DEFAULT_INDEX_EXCLUDE_PATTERNS,
  DEFAULT_INDEX_PRUNE_DIR_NAMES,
} from "./utils/index-file-collection.js";

function mergeUniqueStrings(a: readonly string[], b: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of a) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  for (const value of b) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

function buildFindSourceFileCountCommand(targetDir: string): string {
  const pruneExpr = DEFAULT_INDEX_PRUNE_DIR_NAMES.map((name) => `-path "*/${name}" -o -path "*/${name}/*"`).join(
    " -o ",
  );

  const nameExpr = [
    '-name "*.js"',
    '-o -name "*.ts"',
    '-o -name "*.md"',
    '-o -name "*.mdx"',
    '-o -name "*.py"',
    '-o -name "*.java"',
    '-o -name "*.cpp"',
    '-o -name "*.c"',
    '-o -name "*.go"',
    '-o -name "*.rs"',
  ].join(" ");

  return `find "${targetDir}" \\( ${pruneExpr} \\) -prune -o -type f \\( ${nameExpr} \\) -print | wc -l`;
}

type BatchIndexSessionMeta = {
  version: 1;
  sessionId: string;
  directory: string;
  excludePatterns: string[];
  incremental: boolean;
  fullScan: boolean;
  reset: boolean;
  createdAt: number;
  updatedAt: number;
  cursor: number;
  totalFiles: number;
  filesPath: string;
  stats: {
    batches: number;
    attempted: number;
    indexed: number;
    skipped: number;
    lastBatchMs?: number;
    lastError?: string;
  };
};

type BatchIndexSessionState = {
  meta: BatchIndexSessionMeta;
  files: string[];
  inProgress: boolean;
};

const batchIndexSessions = new Map<string, BatchIndexSessionState>();

function createBatchIndexSessionId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getBatchIndexSessionsDir(): string {
  return join(getGlobalTmpLogDir(), "index-sessions");
}

function getBatchIndexSessionMetaPath(sessionId: string): string {
  return join(getBatchIndexSessionsDir(), `${sessionId}.json`);
}

function getBatchIndexSessionFilesPath(sessionId: string): string {
  return join(getBatchIndexSessionsDir(), `${sessionId}.files.json`);
}

function ensureBatchIndexSessionsDir(): string {
  const dir = getBatchIndexSessionsDir();
  mkdirSync(dir, { recursive: true });
  return dir;
}

function safeReadJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, { encoding: "utf8" })) as T;
}

function safeWriteJsonFile(filePath: string, data: unknown, pretty = true): void {
  const text = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  writeFileSync(filePath, text, { encoding: "utf8" });
}

function loadBatchIndexSession(sessionId: string): BatchIndexSessionState {
  const existing = batchIndexSessions.get(sessionId);
  if (existing) return existing;

  const metaPath = getBatchIndexSessionMetaPath(sessionId);
  if (!existsSync(metaPath)) {
    throw new Error(`Unknown batch_index sessionId: ${sessionId}`);
  }
  const meta = safeReadJsonFile<BatchIndexSessionMeta>(metaPath);
  const filesPath = meta.filesPath || getBatchIndexSessionFilesPath(sessionId);
  if (!existsSync(filesPath)) {
    throw new Error(`Missing batch_index session files for sessionId: ${sessionId}`);
  }
  const files = safeReadJsonFile<string[]>(filesPath);
  const state: BatchIndexSessionState = { meta, files, inProgress: false };
  batchIndexSessions.set(sessionId, state);
  return state;
}

function persistBatchIndexSessionMeta(meta: BatchIndexSessionMeta): void {
  meta.updatedAt = Date.now();
  safeWriteJsonFile(getBatchIndexSessionMetaPath(meta.sessionId), meta);
}

function deleteBatchIndexSession(sessionId: string): void {
  batchIndexSessions.delete(sessionId);
  const metaPath = getBatchIndexSessionMetaPath(sessionId);
  const filesPath = getBatchIndexSessionFilesPath(sessionId);
  rmSync(metaPath, { force: true });
  rmSync(filesPath, { force: true });
}

// Tool schemas
const IndexToolSchema = z.object({
  directory: z.string().describe("Directory to index").optional(),
  incremental: z.boolean().describe("Perform incremental indexing").optional().default(false),
  reset: z.boolean().describe("Clear existing graph before indexing").optional().default(false),
  excludePatterns: z
    .array(z.string())
    .describe("Patterns to exclude (merged with built-in defaults; tmp/ is always excluded)")
    .optional()
    .default([...DEFAULT_INDEX_EXCLUDE_PATTERNS]),
  fullScan: z.boolean().optional().default(false),
});

const BatchIndexSchema = z.object({
  sessionId: z.string().optional().describe("Resume an existing batch indexing session"),
  directory: z.string().optional().describe("Directory to index (new sessions only; defaults to server root)"),
  excludePatterns: z
    .array(z.string())
    .optional()
    .default([...DEFAULT_INDEX_EXCLUDE_PATTERNS])
    .describe("Patterns to exclude (merged with built-in defaults; tmp/ is always excluded)"),
  incremental: z.boolean().optional().default(true).describe("Reindex only changed files (mtime-based)"),
  fullScan: z.boolean().optional().default(false).describe("Disable incremental filtering and index everything"),
  reset: z.boolean().optional().default(false).describe("Clear the graph before starting a new session"),
  maxFilesPerBatch: z.number().int().positive().max(500).optional().default(25).describe("Max files per tool call"),
  statusOnly: z.boolean().optional().default(false).describe("Return current progress without processing a batch"),
  abort: z.boolean().optional().default(false).describe("Abort and delete the session"),
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

const ResolveEntitySchema = z.object({
  name: z.string().min(1).describe("Entity name to resolve (ambiguous names may return multiple candidates)"),
  filePathHint: z.string().optional().describe("Optional file path hint to boost matching candidates"),
  entityTypes: z.array(z.string()).optional().describe("Optional entity types to filter to"),
  limit: z.number().int().positive().max(50).optional().default(10).describe("Maximum candidates to return"),
});

const GetEntitySourceSchema = z
  .object({
    entityId: z.string().optional().describe("Exact entity ID (preferred)"),
    entityName: z.string().optional().describe("Entity name to resolve if entityId is not provided"),
    filePathHint: z.string().optional().describe("Optional file path hint when resolving by name"),
    contextLines: z.number().int().min(0).max(200).optional().default(5).describe("Extra context lines before/after"),
    maxBytes: z
      .number()
      .int()
      .min(1024)
      .max(512000)
      .optional()
      .default(64000)
      .describe("Max bytes returned for snippet"),
  })
  .refine((value) => Boolean(value.entityId || value.entityName), {
    message: "Provide either entityId or entityName",
    path: ["entityId"],
  });

const QueryToolSchema = z.object({
  query: z.string().describe("Natural language or structured query"),
  limit: z.number().describe("Maximum number of results (page size when cursor is used)").optional().default(10),
  cursor: z.string().optional().describe("Opaque cursor for pagination"),
  pageSize: z.number().int().positive().max(200).optional().describe("Page size (overrides limit)"),
});

// New semantic tool schemas - TASK-002
const SemanticSearchSchema = z.object({
  query: z.string().describe("Natural language search query"),
  limit: z.number().optional().default(10).describe("Maximum results to return (page size when cursor is used)"),
  cursor: z.string().optional().describe("Opaque cursor for pagination"),
  pageSize: z.number().int().positive().max(200).optional().describe("Page size (overrides limit)"),
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

const AnalyzeModuleDependentsSchema = z.object({
  moduleSource: z.string().describe("Module import source (e.g. ./editorWebWorker.js)"),
  limit: z.number().optional().default(100).describe("Maximum number of importers to return"),
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
  limit: z.number().optional().default(100).describe("Maximum entities to return (page size when cursor is used)"),
  cursor: z.string().optional().describe("Opaque cursor for pagination"),
  pageSize: z.number().int().positive().max(500).optional().describe("Page size (overrides limit)"),
});

const GetGraphStatsSchema = z.object({});
const GetLernaProjectGraphSchema = z.object({
  directory: z
    .string()
    .optional()
    .describe("Workspace directory to run the Lerna graph command from (defaults to server root)."),
  ingest: z.boolean().optional().default(false).describe("Store package nodes and dependencies in graph storage."),
  force: z.boolean().optional().default(false).describe("Bypass caches and force a fresh Lerna graph command."),
});
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
  excludePatterns: z
    .array(z.string())
    .describe("Patterns to exclude during indexing (merged with built-in defaults; tmp/ is always excluded)")
    .optional()
    .default([...DEFAULT_INDEX_EXCLUDE_PATTERNS]),
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

// Defer heavy initialization until after the client has completed MCP initialization.
server.oninitialized = () => {
  (async () => {
    try {
      await getDevAgent();
      await getDoraAgent();
      if (process.env.MCP_DEBUG_DISABLE_SEMANTIC !== "1") {
        await getSemanticAgent();
      }
      console.error("Core agents initialized (background): DevAgent, DoraAgent, SemanticAgent");
    } catch (error) {
      console.error("Background agent init failed:", error);
      logger.error(
        "AGENT_INIT",
        "Background agent initialization failed",
        { error: error instanceof Error ? error.message : String(error) },
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  })();
};

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

// Keep compile-time types light for large Zod schemas (performance/memory).
const toJsonSchema = (schema: z.ZodTypeAny) => (zodToJsonSchema as any)(schema) as any;

function asMcpJson(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function toolMeta(requestId: string, startTime: number, extra?: Record<string, unknown>) {
  return { requestId, ms: Date.now() - startTime, ...extra };
}

async function collectRelationsWithin(storage: Awaited<ReturnType<typeof getGraphStorage>>, entityIds: Set<string>) {
  const rels: Relationship[] = [];
  const seen = new Set<string>();
  for (const id of entityIds) {
    const rs = await storage.getRelationshipsForEntity(id);
    for (const r of rs) {
      if (!entityIds.has(r.fromId) || !entityIds.has(r.toId)) continue;
      const key = r.id || `${r.fromId}|${r.toId}|${r.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rels.push(r);
    }
  }
  return rels;
}

function annotateStructuralMatch(summary: ReturnType<typeof mapEntitySummary>, q: string) {
  const queryText = q.trim();
  const qLower = queryText.toLowerCase();
  const nameLower = String((summary as any).name ?? "").toLowerCase();

  let matchType: "exact_name" | "name_contains" | "query_contains" | "unknown" = "unknown";
  if (qLower && nameLower === qLower) matchType = "exact_name";
  else if (qLower && nameLower.includes(qLower)) matchType = "name_contains";
  else if (qLower?.includes(nameLower) && nameLower.length >= 3) matchType = "query_contains";

  return { ...summary, matchType };
}

// Handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema as any, async () => {
  return {
    tools: [
      {
        name: "index",
        description:
          "Use when: you want a one-shot index of a repo and your client can tolerate a long-running tool call. Avoid when: strict transports may time out—use batch_index instead. Typical flow: clean_index → index or batch_index. Output: JSON status + counts; indexing is required for most graph tools.",
        inputSchema: toJsonSchema(IndexToolSchema),
      },
      {
        name: "batch_index",
        description:
          "Use when: you need reliable indexing on strict clients/timeouts. Typical flow: batch_index(reset:true) → keep calling batch_index(sessionId) until done:true. Output: progress + stats + next arguments; returns sessionId for resumable sessions.",
        inputSchema: toJsonSchema(BatchIndexSchema),
      },
      {
        name: "list_file_entities",
        description:
          "Use when: you have a file and need the exact entityId for follow-up graph tools. Typical flow: list_file_entities(filePath) → pick entityId → list_entity_relationships/analyze_code_impact. Output: entity list with locations/metadata; requires indexing.",
        inputSchema: toJsonSchema(ListEntitiesToolSchema),
      },
      {
        name: "list_entity_relationships",
        description:
          "Use when: you need structural neighbors (imports/references/containment) for an entityId/entityName. Typical flow: list_file_entities → list_entity_relationships(depth, relationshipTypes) → analyze_code_impact. Output: entity + relationships; may be sparse if a relationship type is not indexed for that language.",
        inputSchema: toJsonSchema(ListRelationshipsToolSchema),
      },
      {
        name: "resolve_entity",
        description:
          "Use when: a name is ambiguous and you need the correct entityId before deeper graph tools. Typical flow: resolve_entity(name, filePathHint) → pick entityId → get_entity_source/list_entity_relationships. Output: ranked candidates with reasons; requires indexing.",
        inputSchema: toJsonSchema(ResolveEntitySchema),
      },
      {
        name: "get_entity_source",
        description:
          "Use when: you need the exact source snippet for an entity to ground answers. Typical flow: resolve_entity/list_file_entities → get_entity_source(entityId, contextLines) → analyze_code_impact. Output: snippet + line ranges; requires file access and indexing.",
        inputSchema: toJsonSchema(GetEntitySourceSchema),
      },
      {
        name: "query",
        description:
          "Use when: you want a best-effort hybrid answer (semantic + structural) for discovery. Typical flow: query → refine with list_file_entities/list_entity_relationships/analyze_code_impact. Output: combined semantic and structural matches (semantic may be unavailable/disabled).",
        inputSchema: toJsonSchema(QueryToolSchema),
      },
      {
        name: "get_metrics",
        description:
          "Use when: you need runtime resource usage and agent queue snapshots for debugging. Typical flow: get_metrics → get_agent_metrics for deeper agent telemetry. Output: CPU/memory/resource manager + knowledge bus stats.",
        inputSchema: toJsonSchema(z.object({})),
      },
      {
        name: "get_version",
        description:
          "Use when: you need server version/runtime info (node/platform/memory/uptime) for debugging. Output: version + runtime details; does not require indexing.",
        inputSchema: toJsonSchema(z.object({})),
      },
      // New semantic tools - TASK-002
      {
        name: "semantic_search",
        description:
          "Use when: you want semantic discovery across the codebase. Typical flow: semantic_search → list_file_entities (for exact IDs) → list_entity_relationships. Output: ranked matches; semantic may be disabled; ground results with graph/source follow-ups.",
        inputSchema: toJsonSchema(SemanticSearchSchema),
      },
      {
        name: "find_similar_code",
        description:
          "Use when: you have a snippet and want near-duplicate or conceptually similar code. Typical flow: find_similar_code → open candidate file(s) → suggest_refactoring/detect_code_clones. Output: ranked similar snippets with scores (semantic must be available).",
        inputSchema: toJsonSchema(FindSimilarCodeSchema),
      },
      {
        name: "analyze_code_impact",
        description:
          "Use when: you need a reverse-dependency view (who uses/depends on this). Typical flow: list_file_entities → analyze_code_impact(entityId, filePath hint) → inspect affected files. Output: dependents and affected files; requires indexing.",
        inputSchema: toJsonSchema(AnalyzeCodeImpactSchema),
      },
      {
        name: "list_module_importers",
        description:
          "Use when: you care about module-level dependents (who imports ./x). Typical flow: list_module_importers(moduleSource) → inspect importer files/entities. Output: importing files/entities; requires indexing.",
        inputSchema: toJsonSchema(AnalyzeModuleDependentsSchema),
      },
      {
        name: "detect_code_clones",
        description:
          "Use when: you want semantic clone groups across the codebase. Typical flow: detect_code_clones → prioritize hotspots → suggest_refactoring. Output: clone groups; consider jscpd_detect_clones for fast tokenizer-based scanning.",
        inputSchema: toJsonSchema(DetectCodeClonesSchema),
      },
      {
        name: "jscpd_detect_clones",
        description:
          "Use when: you want fast, tokenizer-based duplicate detection (no embeddings). Typical flow: jscpd_detect_clones(paths, formats) → review clone blocks → refactor. Output: clone blocks with locations; best for quick duplication sweeps.",
        inputSchema: toJsonSchema(JscpdCloneDetectionSchema),
      },
      {
        name: "suggest_refactoring",
        description:
          "Use when: you want refactoring suggestions for a file or snippet. Typical flow: identify target via semantic_search/query → suggest_refactoring(filePath, focusArea/entityId). Output: suggestions; validate against real code context.",
        inputSchema: toJsonSchema(SuggestRefactoringSchema),
      },
      {
        name: "cross_language_search",
        description:
          "Use when: you want discovery constrained to specific languages. Typical flow: cross_language_search(query, languages) → open results → list_file_entities. Output: results filtered by language set; semantic must be available for best quality.",
        inputSchema: toJsonSchema(CrossLanguageSearchSchema),
      },
      {
        name: "analyze_hotspots",
        description:
          "Use when: you want a quick list of risky areas (complexity/changes/coupling). Typical flow: analyze_hotspots(metric) → inspect top files/entities → suggest_refactoring. Output: ranked hotspots with the chosen metric.",
        inputSchema: toJsonSchema(AnalyzeHotspotsSchema),
      },
      {
        name: "find_related_concepts",
        description:
          "Use when: you want conceptually related code for an entity (semantic neighbors). Typical flow: list_file_entities → find_related_concepts(entityId) → open candidates. Output: related entities/snippets; semantic must be available.",
        inputSchema: toJsonSchema(FindRelatedConceptsSchema),
      },
      {
        name: "get_graph",
        description:
          "Use when: you need a bounded snapshot of entities and relationships for inspection/debugging. Avoid when: exporting entire large graphs—use a query filter/limit. Output: entities + relations + stats; requires indexing.",
        inputSchema: toJsonSchema(GetGraphSchema),
      },
      {
        name: "get_graph_stats",
        description:
          "Use when: you need counts/summary stats for the indexed graph. Typical flow: get_graph_stats → get_graph_health if counts look suspicious. Output: counts and DB metrics; requires indexing.",
        inputSchema: toJsonSchema(GetGraphStatsSchema),
      },
      {
        name: "lerna_project_graph",
        description:
          "Use when: you want a package/workspace dependency graph from Lerna config. Typical flow: lerna_project_graph(force?) → optionally ingest → query graph. Output: package DAG; may require Lerna setup in the repo.",
        inputSchema: toJsonSchema(GetLernaProjectGraphSchema),
      },
      {
        name: "reset_graph",
        description:
          "Use when: you need a clean slate (schema reset, corrupted index, or changing indexing config). Typical flow: reset_graph → clean_index/batch_index. Output: confirmation; destructive to indexed data.",
        inputSchema: toJsonSchema(z.object({})),
      },
      {
        name: "clean_index",
        description:
          "Use when: you want a guaranteed clean rebuild (reset + full index). Typical flow: clean_index → query/semantic_search. Output: indexing result; may time out on strict clients—use batch_index if needed.",
        inputSchema: toJsonSchema(CleanIndexSchema),
      },
      {
        name: "get_graph_health",
        description:
          "Use when: you need to verify DB health (counts + sample read). Typical flow: get_graph_health → if unhealthy, clean_index/reset_graph. Output: health status, totals, and sample verification.",
        inputSchema: toJsonSchema(GetGraphHealthSchema),
      },
      {
        name: "get_agent_metrics",
        description:
          "Use when: you need per-agent telemetry (queues, memory, CPU) to debug slow/failed tool calls. Typical flow: get_agent_metrics → adjust concurrency/memory limits. Output: agent snapshots and coordinator metrics.",
        inputSchema: toJsonSchema(GetAgentMetricsSchema),
      },
      {
        name: "get_bus_stats",
        description:
          "Use when: you need to debug caching/events and topic growth. Typical flow: get_bus_stats → clear_bus_topic for hot/large topics. Output: topic/entry/subscription counts.",
        inputSchema: toJsonSchema(GetBusStatsSchema),
      },
      {
        name: "clear_bus_topic",
        description:
          "Use when: you need to invalidate cached knowledge bus entries for a topic. Typical flow: get_bus_stats → clear_bus_topic(topic). Output: confirmation + updated stats.",
        inputSchema: toJsonSchema(ClearBusTopicSchema),
      },
    ],
  };
});

async function executeToolCall(name: string, args: unknown, requestId: string, startTime: number) {
  try {
    if (name === "get_version") {
      const versionInfo = getVersionInfo();
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();

      return asMcpJson(
        toolOk(
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
            runtimeInitialized,
            configEnvironment: config?.environment ?? null,
          },
          toolMeta(requestId, startTime),
        ),
      );
    }

    await ensureRuntimeInitialized();

    {
      const config = getConfigOrThrow();
      const globalSQLiteManager = getSQLiteManagerOrThrow();

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

          // Indexing requires a DevAgent; initialize it on-demand so indexing is never "queued" due to background init timing.
          await getDevAgent();

          // Always merge user exclude patterns with built-in defaults (tmp/ and other work dirs are always excluded).
          const enhancedExcludePatterns = mergeUniqueStrings(DEFAULT_INDEX_EXCLUDE_PATTERNS, excludePatterns);

          // Check codebase size and add adaptive patterns
          try {
            const { execSync } = await import("node:child_process");
            const fileCount = execSync(buildFindSourceFileCountCommand(targetDir), { encoding: "utf8" }).trim();
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
              for (const pattern of [
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
              ]) {
                if (!enhancedExcludePatterns.includes(pattern)) enhancedExcludePatterns.push(pattern);
              }
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
                if (!enhancedExcludePatterns.includes("__batch_processing_enabled__")) {
                  enhancedExcludePatterns.push("__batch_processing_enabled__"); // Special marker for batch processing
                }
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
              fullScan,
              excludePatterns: enhancedExcludePatterns,
            },
            createdAt: Date.now(),
          };

          // Process through conductor with mandatory delegation
          const cond = await getConductor();
          await cond.initialize();
          const configuredTimeout = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 600000;
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
              excludePatterns: enhancedExcludePatterns,
              entitiesFound: Array.isArray((result as any)?.entities) ? (result as any).entities.length : 0,
            },
            requestId,
          );

          // Publish to knowledge bus
          knowledgeBus.publish("index:completed", result, "mcp-server");

          const duration = Date.now() - startTime;
          logger.mcpResponse(name, result, duration, requestId);

          return asMcpJson(toolOk({ message: "Indexing completed", result }, toolMeta(requestId, startTime)));
        }

        case "batch_index": {
          const {
            sessionId: sessionIdArg,
            directory: indexDir,
            excludePatterns,
            incremental,
            fullScan,
            reset,
            maxFilesPerBatch,
            statusOnly,
            abort,
          } = BatchIndexSchema.parse(args);

          const enhancedExcludePatterns = mergeUniqueStrings(DEFAULT_INDEX_EXCLUDE_PATTERNS, excludePatterns);
          const targetDir = indexDir || directory;

          try {
            ensureBatchIndexSessionsDir();
          } catch (error) {
            throw new Error(
              `batch_index could not create sessions dir under tmp: ${error instanceof Error ? error.message : String(error)}`,
            );
          }

          if (abort) {
            if (!sessionIdArg) {
              return asMcpJson(
                toolFail(
                  "invalid_args",
                  "batch_index abort requires sessionId",
                  { tool: "batch_index", abort: true },
                  toolMeta(requestId, startTime),
                ),
              );
            }

            deleteBatchIndexSession(sessionIdArg);
            appendGlobalTmpLog("batch_index: session aborted", { sessionId: sessionIdArg });
            return asMcpJson(toolOk({ sessionId: sessionIdArg, aborted: true }, toolMeta(requestId, startTime)));
          }

          let session: BatchIndexSessionState;

          if (sessionIdArg) {
            session = loadBatchIndexSession(sessionIdArg);
          } else {
            if (reset) {
              const storage = await getGraphStorage(globalSQLiteManager);
              await storage.clear();
              logger.systemEvent("Graph storage cleared before batch_index", { directory: targetDir });
            }

            const sessionId = createBatchIndexSessionId();
            const filesPath = getBatchIndexSessionFilesPath(sessionId);
            const meta: BatchIndexSessionMeta = {
              version: 1,
              sessionId,
              directory: targetDir,
              excludePatterns: enhancedExcludePatterns,
              incremental,
              fullScan,
              reset,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              cursor: 0,
              totalFiles: 0,
              filesPath,
              stats: { batches: 0, attempted: 0, indexed: 0, skipped: 0 },
            };

            const collected = collectIndexableFiles(targetDir, enhancedExcludePatterns);
            const files = collected.files;
            meta.totalFiles = files.length;

            logger.info(
              "INDEXING",
              "File collection stats (batch_index)",
              { directory: targetDir, totalFiles: files.length, ...collected.stats },
              requestId,
            );

            safeWriteJsonFile(filesPath, files, false);
            persistBatchIndexSessionMeta(meta);

            session = { meta, files, inProgress: false };
            batchIndexSessions.set(sessionId, session);

            appendGlobalTmpLog("batch_index: session created", {
              sessionId,
              directory: targetDir,
              totalFiles: files.length,
              incremental,
              fullScan,
            });
          }

          if (session.inProgress) {
            return asMcpJson(
              toolFail(
                "session_busy",
                "batch_index session is already running",
                { sessionId: session.meta.sessionId },
                toolMeta(requestId, startTime),
              ),
            );
          }

          const total = session.meta.totalFiles;
          const cursor = session.meta.cursor;
          const percent = total > 0 ? Math.min(100, Math.round((cursor / total) * 10000) / 100) : 100;
          const done = cursor >= total;

          if (statusOnly || done) {
            return asMcpJson(
              toolOk(
                {
                  sessionId: session.meta.sessionId,
                  directory: session.meta.directory,
                  progress: { percent, cursor, totalFiles: total, done },
                  stats: session.meta.stats,
                  next: done
                    ? null
                    : {
                        tool: "batch_index",
                        arguments: { sessionId: session.meta.sessionId, maxFilesPerBatch },
                      },
                },
                toolMeta(requestId, startTime),
              ),
            );
          }

          const batchFiles = session.files.slice(cursor, cursor + maxFilesPerBatch);
          if (batchFiles.length === 0) {
            return asMcpJson(
              toolOk(
                {
                  sessionId: session.meta.sessionId,
                  directory: session.meta.directory,
                  progress: { percent: 100, cursor: total, totalFiles: total, done: true },
                  stats: session.meta.stats,
                  next: null,
                },
                toolMeta(requestId, startTime),
              ),
            );
          }

          session.inProgress = true;
          const batchStart = Date.now();
          try {
            // Ensure DevAgent exists before delegating; otherwise Conductor may queue the task.
            await getDevAgent();

            const task: AgentTask = {
              id: `batch-index-${session.meta.sessionId}-${Date.now()}`,
              type: "index",
              priority: 8,
              payload: {
                directory: session.meta.directory,
                files: batchFiles,
                incremental: session.meta.incremental,
                fullScan: session.meta.fullScan,
                excludePatterns: session.meta.excludePatterns,
              },
              createdAt: Date.now(),
            };

            const cond = await getConductor();
            await cond.initialize();

            const configuredTimeout = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 600000;
            const timeoutMs = Math.min(configuredTimeout, 12000);
            const result = await withTimeout(cond.process(task), timeoutMs, "batch_index", requestId);

            const batchMs = Date.now() - batchStart;
            const filesProcessed = (() => {
              const r = result as any;
              if (typeof r?.filesProcessed === "number") return r.filesProcessed;
              if (Array.isArray(r?.results)) {
                return r.results.reduce((sum: number, item: any) => sum + Number(item?.filesProcessed ?? 0), 0);
              }
              return 0;
            })();
            const skipped = Math.max(0, batchFiles.length - filesProcessed);

            session.meta.cursor += batchFiles.length;
            session.meta.stats.batches += 1;
            session.meta.stats.attempted += batchFiles.length;
            session.meta.stats.indexed += Math.max(0, filesProcessed);
            session.meta.stats.skipped += skipped;
            session.meta.stats.lastBatchMs = batchMs;
            session.meta.stats.lastError = undefined;
            persistBatchIndexSessionMeta(session.meta);

            appendGlobalTmpLog("batch_index: batch processed", {
              sessionId: session.meta.sessionId,
              directory: session.meta.directory,
              batchFiles: batchFiles.length,
              filesProcessed,
              skipped,
              cursor: session.meta.cursor,
              totalFiles: session.meta.totalFiles,
              ms: batchMs,
            });

            const nextPercent =
              session.meta.totalFiles > 0
                ? Math.min(100, Math.round((session.meta.cursor / session.meta.totalFiles) * 10000) / 100)
                : 100;
            const nextDone = session.meta.cursor >= session.meta.totalFiles;

            return asMcpJson(
              toolOk(
                {
                  sessionId: session.meta.sessionId,
                  directory: session.meta.directory,
                  batch: {
                    maxFilesPerBatch,
                    attempted: batchFiles.length,
                    filesProcessed,
                    skipped,
                    ms: batchMs,
                  },
                  progress: {
                    percent: nextPercent,
                    cursor: session.meta.cursor,
                    totalFiles: session.meta.totalFiles,
                    done: nextDone,
                  },
                  stats: session.meta.stats,
                  result,
                  next: nextDone
                    ? null
                    : {
                        tool: "batch_index",
                        arguments: { sessionId: session.meta.sessionId, maxFilesPerBatch },
                      },
                },
                toolMeta(requestId, startTime),
              ),
            );
          } catch (error) {
            const errMessage = error instanceof Error ? error.message : String(error);
            session.meta.stats.lastError = errMessage;
            persistBatchIndexSessionMeta(session.meta);
            appendGlobalTmpLog("batch_index: batch failed", { sessionId: session.meta.sessionId, error: errMessage });
            throw error;
          } finally {
            session.inProgress = false;
          }
        }

        case "reset_graph": {
          const storage = await getGraphStorage(globalSQLiteManager);
          await storage.clear();
          logger.systemEvent("Graph storage cleared via tool");
          return asMcpJson(toolOk({ message: "Graph storage cleared" }, toolMeta(requestId, startTime)));
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

          // Ensure DevAgent exists before delegating; otherwise Conductor may queue the task.
          await getDevAgent();

          // Perform index with reset semantics (already cleared), non-incremental
          const enhancedExcludePatterns = mergeUniqueStrings(DEFAULT_INDEX_EXCLUDE_PATTERNS, excludePatterns);

          // Adaptive patterns as in index tool
          try {
            const { execSync } = await import("node:child_process");
            const fileCount = execSync(buildFindSourceFileCountCommand(targetDir), { encoding: "utf8" }).trim();
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
              for (const pattern of [
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
              ]) {
                if (!enhancedExcludePatterns.includes(pattern)) enhancedExcludePatterns.push(pattern);
              }
            }

            if (!fullScan) {
              if (numFiles > 2000) {
                logger.info(
                  "INDEXING",
                  "Large codebase detected, enabling batch processing (clean_index)",
                  { fileCount: numFiles },
                  requestId,
                );
                if (!enhancedExcludePatterns.includes("__batch_processing_enabled__")) {
                  enhancedExcludePatterns.push("__batch_processing_enabled__");
                }
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
              fullScan,
              excludePatterns: enhancedExcludePatterns,
            },
            createdAt: Date.now(),
          };

          const cond = await getConductor();
          await cond.initialize();
          const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 600000;
          const result = await withTimeout(cond.process(task), timeoutMs, "clean_index", requestId);

          if (process.env.MCP_DEBUG_DISABLE_SEMANTIC !== "1") {
            await ensureSemanticsReady(1, 5000);
          }

          knowledgeBus.publish("index:completed", result, "mcp-server");
          const duration = Date.now() - startTime;
          logger.mcpResponse(name, result, duration, requestId);

          return asMcpJson(toolOk({ message: "Clean indexing completed", result }, toolMeta(requestId, startTime)));
        }

        case "list_file_entities": {
          const { filePath, entityTypes } = ListEntitiesToolSchema.parse(args);
          const targetFilePath = normalizeInputPath(filePath);

          const cacheKey = `entities:${targetFilePath}`;
          const cached = knowledgeBus.query(cacheKey, 1);
          if (cached.length > 0) {
            const entry = cached[0];
            if (entry && Date.now() - entry.timestamp < 60000) {
              return asMcpJson(toolOk(entry.data, toolMeta(requestId, startTime, { cached: true })));
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

          return asMcpJson(toolOk(response, toolMeta(requestId, startTime, { cached: false })));
        }
        case "list_entity_relationships": {
          const {
            entityId: directId,
            entityName,
            depth,
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
            return asMcpJson(
              toolFail(
                "not_found",
                `Entity not found: ${entityName ?? directId ?? ""}`,
                { entityName, entityId: directId },
                toolMeta(requestId, startTime),
              ),
            );
          }

          const traversal = await listEntityRelationshipsTraversal(storage, entity, { depth, relationshipTypes });

          const nodes = Array.from(traversal.nodes.values())
            .map((e) => mapEntitySummary(e))
            .sort(
              (a: any, b: any) =>
                String(a.filePath).localeCompare(String(b.filePath)) || String(a.name).localeCompare(String(b.name)),
            );

          return asMcpJson(
            toolOk(
              {
                entity: mapEntitySummary(entity),
                relationships: summarizeRelationships(traversal.relationships, traversal.nodes),
                nodes,
                depthUsed: traversal.depthUsed,
                relationshipTypesUsed: traversal.relationshipTypesUsed,
                stats: { nodeCount: traversal.nodes.size, edgeCount: traversal.relationships.length },
              },
              toolMeta(requestId, startTime),
            ),
          );
        }

        case "resolve_entity": {
          const { name: rawName, filePathHint, entityTypes, limit } = ResolveEntitySchema.parse(args);
          const storage = await getGraphStorage(globalSQLiteManager);
          const normalizedHint = filePathHint ? normalizeInputPath(filePathHint) : undefined;
          const normalizedTypes = normalizeEntityTypes(entityTypes);

          const exactName = rawName.trim();
          const scored = await resolveEntityCandidates({
            storage,
            name: exactName,
            filePathHint: normalizedHint,
            entityTypes: normalizedTypes,
            limit: limit ?? 10,
          });

          return asMcpJson(
            toolOk(
              {
                name: exactName,
                filePathHint: normalizedHint ?? null,
                entityTypes: normalizedTypes ?? null,
                candidates: scored
                  .slice(0, limit ?? 10)
                  .map((c) => ({ entity: mapEntitySummary(c.entity), score: c.score, reasons: c.reasons })),
              },
              toolMeta(requestId, startTime),
            ),
          );
        }

        case "get_entity_source": {
          const { entityId, entityName, filePathHint, contextLines, maxBytes } = GetEntitySourceSchema.parse(args);
          const storage = await getGraphStorage(globalSQLiteManager);
          const resolvedHintPath = filePathHint ? normalizeInputPath(filePathHint) : undefined;

          let entity: Entity | null = null;
          if (entityId) {
            entity = await storage.getEntity(entityId);
          }
          if (!entity) {
            entity = await resolveEntityWithHint(storage, entityName ?? entityId ?? "", resolvedHintPath);
          }
          if (!entity) {
            return asMcpJson(
              toolFail(
                "not_found",
                `Entity not found: ${entityId ?? entityName ?? ""}`,
                { entityId: entityId ?? null, entityName: entityName ?? null, filePathHint: resolvedHintPath ?? null },
                toolMeta(requestId, startTime),
              ),
            );
          }

          const targetFilePath = normalizeInputPath(entity.filePath) ?? entity.filePath;
          try {
            const extracted = await getEntitySource({
              storage,
              entity,
              filePath: targetFilePath,
              contextLines,
              maxBytes,
            });

            return asMcpJson(
              toolOk(
                {
                  entity: mapEntitySummary(entity),
                  filePath: targetFilePath,
                  entityRange: extracted.entityRange,
                  snippetRange: extracted.snippetRange,
                  snippet: extracted.snippet,
                  truncated: extracted.truncated,
                },
                toolMeta(requestId, startTime),
                extracted.truncated ? ["snippet_truncated"] : undefined,
              ),
            );
          } catch (error) {
            return asMcpJson(
              toolFail(
                "file_read_failed",
                `Cannot read file: ${targetFilePath}`,
                { filePath: targetFilePath, error: error instanceof Error ? error.message : String(error) },
                toolMeta(requestId, startTime),
              ),
            );
          }
        }

        case "query": {
          const { query, limit, cursor, pageSize } = QueryToolSchema.parse(args);
          await ensureSemanticsReady(1, 20000);
          const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 600000;
          const effectivePageSize = pageSize ?? limit ?? 10;
          const cursorState = decodeCursor<{ so?: number; go?: number }>(cursor) ?? {};
          const semanticOffset = Math.max(0, Number(cursorState.so ?? 0) || 0);
          const structuralOffset = Math.max(0, Number(cursorState.go ?? 0) || 0);

          let semanticAll: any[] = [];
          let semanticFailed = false;
          let semanticProcessingTime: number | undefined;

          try {
            const semanticAgent = await getSemanticAgent();
            const fetchLimit = Math.min(500, semanticOffset + effectivePageSize + 1);
            const semanticResult = await withTimeout(
              semanticAgent.semanticSearch(query, fetchLimit),
              timeoutMs,
              "query:semantic_search",
              requestId,
            );
            semanticAll = Array.isArray(semanticResult) ? semanticResult : ((semanticResult as any)?.results ?? []);
            semanticProcessingTime = (semanticResult as any)?.processingTime;
          } catch (error) {
            logger.warn(
              "SEMANTIC_QUERY",
              "Semantic search fallback engaged",
              { query, error: (error as Error).message },
              requestId,
            );
            semanticFailed = true;
            semanticAll = [];
          }

          const storage = await getGraphStorage(globalSQLiteManager);
          const structuralRaw = await queryGraphEntities(storage, query, effectivePageSize + 1, structuralOffset);
          const hasMoreStructural = structuralRaw.entities.length > effectivePageSize;
          const structuralEntitiesPage = hasMoreStructural
            ? structuralRaw.entities.slice(0, effectivePageSize)
            : structuralRaw.entities;
          const structuralFileSet = new Set(
            structuralEntitiesPage.map((e) => normalizeInputPath(e.filePath) ?? e.filePath).filter(Boolean),
          );
          const entityIdSet = new Set(structuralEntitiesPage.map((e) => e.id));
          const relations = await collectRelationsWithin(storage, entityIdSet);

          const semanticNormalized = rerankSemanticHits(
            semanticAll,
            structuralFileSet,
            (p) => normalizeInputPath(p) ?? p,
          ).map((ranked) => {
            const hit: any = ranked.hit as any;
            const meta: any = hit?.metadata ?? {};
            const rawPath = String(meta?.path ?? hit?.path ?? hit?.filePath ?? "");
            const normalizedPath = rawPath ? (normalizeInputPath(rawPath) ?? rawPath) : "";
            const content = String(hit?.content ?? "");
            return {
              id: hit?.id,
              filePath: normalizedPath || null,
              score: ranked.rankingSignals.semanticScore,
              finalScore: ranked.finalScore,
              excerpt: content ? content.slice(0, 400) : "",
              metadata: meta ?? null,
              rankingSignals: ranked.rankingSignals,
              raw: hit,
            };
          });

          const semanticSlice = semanticNormalized.slice(semanticOffset, semanticOffset + effectivePageSize);
          const hasMoreSemantic = semanticNormalized.length > semanticOffset + effectivePageSize;

          const nextCursor =
            hasMoreSemantic || hasMoreStructural
              ? encodeCursor({
                  so: semanticOffset + (hasMoreSemantic ? effectivePageSize : 0),
                  go: structuralOffset + (hasMoreStructural ? effectivePageSize : 0),
                })
              : null;

          return asMcpJson(
            toolOk(
              {
                semantic: {
                  items: semanticSlice,
                  nextCursor,
                  total: semanticNormalized.length,
                },
                structural: {
                  items: structuralEntitiesPage
                    .map((entity) => annotateStructuralMatch(mapEntitySummary(entity), query))
                    .sort(
                      (a: any, b: any) =>
                        String(a.filePath).localeCompare(String(b.filePath)) ||
                        String(a.name).localeCompare(String(b.name)),
                    ),
                  nextCursor,
                  total: structuralRaw.stats.totalEntities,
                },
                stats: {
                  semanticFailed,
                  semanticProcessingTime,
                  structural: structuralRaw.stats,
                  relationsCount: relations.length,
                },
                relations,
                paging: {
                  cursor: cursor ?? null,
                  nextCursor,
                  pageSize: effectivePageSize,
                  offsets: { semanticOffset, structuralOffset },
                  hasMoreSemantic,
                  hasMoreStructural,
                  semanticFailed,
                },
              },
              toolMeta(requestId, startTime),
            ),
          );
        }

        case "get_metrics": {
          const resourceStats = resourceManager.getCurrentUsage();
          const knowledgeStats = knowledgeBus.getStats();
          const cond = await getConductor();
          const conductorMetrics = cond.getMetrics();

          return asMcpJson(
            toolOk(
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
              toolMeta(requestId, startTime),
            ),
          );
        }

        // New semantic tool handlers - TASK-002
        case "semantic_search": {
          const { query, limit, cursor, pageSize } = SemanticSearchSchema.parse(args);
          await ensureSemanticsReady(1, 20000);

          const effectivePageSize = pageSize ?? limit ?? 10;
          const cursorState = decodeCursor<{ o?: number }>(cursor) ?? {};
          const offset = Math.max(0, Number(cursorState.o ?? 0) || 0);

          // Check cache first
          const cacheKey = `semantic:search:${query}:${effectivePageSize}:${offset}`;
          const cached = knowledgeBus.query(cacheKey, 1);
          if (cached.length > 0) {
            const firstCache = cached[0];
            if (firstCache && Date.now() - firstCache.timestamp < 30000) {
              // 30s cache
              return asMcpJson(toolOk(firstCache.data, toolMeta(requestId, startTime, { cached: true })));
            }
          }

          const semanticAgent = await getSemanticAgent();
          const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 600000;
          const fetchLimit = Math.min(500, offset + effectivePageSize + 1);
          const result = await withTimeout(
            semanticAgent.semanticSearch(query, fetchLimit),
            timeoutMs,
            "semantic_search",
            requestId,
          );

          // Cache result
          const all = Array.isArray(result) ? result : ((result as any)?.results ?? []);
          const items = all.slice(offset, offset + effectivePageSize);
          const hasMore = all.length > offset + effectivePageSize;
          const nextCursor = hasMore ? encodeCursor({ o: offset + effectivePageSize }) : null;

          const payload = {
            query,
            items,
            page: { offset, pageSize: effectivePageSize, nextCursor },
            processingTime: (result as any)?.processingTime,
          };

          knowledgeBus.publish(cacheKey, payload, "mcp-server", 30000);
          return asMcpJson(toolOk(payload, toolMeta(requestId, startTime, { cached: false })));
        }

        case "find_similar_code": {
          const { code, threshold, limit } = FindSimilarCodeSchema.parse(args);
          await ensureSemanticsReady(1, 20000);
          const semanticAgent = await getSemanticAgent();
          const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 600000;
          const sim = await withTimeout(
            semanticAgent.findSimilarCode(code, threshold ?? 0.5),
            timeoutMs,
            "find_similar_code",
            requestId,
          );
          const result = Array.isArray(sim) && limit ? sim.slice(0, limit) : sim;

          return asMcpJson(toolOk(result, toolMeta(requestId, startTime)));
        }

        // analyze_code_impact handled below (single implementation with fallback)

        case "detect_code_clones": {
          const { minSimilarity } = DetectCodeClonesSchema.parse(args);
          await ensureSemanticsReady(1, 20000);
          const semanticAgent = await getSemanticAgent();
          const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 600000;
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

          return asMcpJson(toolOk(combined, toolMeta(requestId, startTime)));
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

          return asMcpJson(toolOk(result, toolMeta(requestId, startTime)));
        }

        case "suggest_refactoring": {
          const { filePath, focusArea, entityId, startLine, endLine } = SuggestRefactoringSchema.parse(args);
          const targetFilePath = normalizeInputPath(filePath);

          const semanticAgent = await getSemanticAgent();
          const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 600000;

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
            return asMcpJson(
              toolFail(
                "file_read_failed",
                `Cannot read file: ${targetFilePath}`,
                { filePath: targetFilePath },
                toolMeta(requestId, startTime),
              ),
            );
          }

          if (startLine != null && endLine != null) {
            const { snippet, range } = sliceByLines(fileText, startLine, endLine);
            const suggestions = await runSuggest(snippet);
            analyzed.push({ range, suggestions });

            return asMcpJson(
              toolOk(
                { filePath: targetFilePath, focus: { mode: "range", range }, analyzed },
                toolMeta(requestId, startTime),
              ),
            );
          }

          if (entityId) {
            const ent = await storage.getEntity(entityId);
            if (!ent) {
              return asMcpJson(
                toolFail(
                  "not_found",
                  `Entity not found by id: ${entityId}`,
                  { entityId },
                  toolMeta(requestId, startTime),
                ),
              );
            }

            const { snippet, range } = sliceByEntity(fileText, ent);
            const suggestions = await runSuggest(snippet);
            analyzed.push({ entity: mapEntitySummary(ent), range, suggestions });

            return asMcpJson(
              toolOk(
                { filePath: targetFilePath, focus: { mode: "entityId", entityId: ent.id }, analyzed },
                toolMeta(requestId, startTime),
              ),
            );
          }

          if (focusArea) {
            const ent = await resolveEntityWithHint(storage, focusArea, targetFilePath);
            if (ent) {
              const { snippet, range } = sliceByEntity(fileText, ent);
              const suggestions = await runSuggest(snippet);
              analyzed.push({ entity: mapEntitySummary(ent), range, suggestions });

              return asMcpJson(
                toolOk(
                  { filePath: targetFilePath, focus: { mode: "focusArea", focusArea }, analyzed },
                  toolMeta(requestId, startTime),
                ),
              );
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

            return asMcpJson(
              toolOk({ filePath: targetFilePath, focus: { mode: "file" }, analyzed }, toolMeta(requestId, startTime)),
            );
          }

          for (const ent of sorted) {
            const { snippet, range } = sliceByEntity(fileText, ent);
            const suggestions = await runSuggest(snippet);
            analyzed.push({ entity: mapEntitySummary(ent), range, suggestions });
          }

          return asMcpJson(
            toolOk(
              { filePath: targetFilePath, focus: { mode: "auto-top-entities", count: analyzed.length }, analyzed },
              toolMeta(requestId, startTime),
            ),
          );
        }

        case "cross_language_search": {
          const { query, languages } = CrossLanguageSearchSchema.parse(args);
          await ensureSemanticsReady(1, 20000);
          const semanticAgent = await getSemanticAgent();
          const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 600000;
          const result = await withTimeout(
            semanticAgent.crossLanguageSearch(query, languages || []),
            timeoutMs,
            "cross_language_search",
            requestId,
          );

          return asMcpJson(toolOk(result, toolMeta(requestId, startTime)));
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
              metric === "complexity"
                ? entry.total * 2
                : metric === "coupling"
                  ? entry.incoming * 3
                  : entry.outgoing * 3;
            hotspots.push({
              entity: mapEntitySummary(entity),
              metrics: { incoming: entry.incoming, outgoing: entry.outgoing, total: entry.total },
              score: Math.round(baseScore + metricScore),
            });
          }

          return asMcpJson(
            toolOk(
              { metric, limit: limit ?? 10, hotspots, sampleSize: relationshipSample.relationships.length },
              toolMeta(requestId, startTime),
            ),
          );
        }

        case "find_related_concepts": {
          const { entityId, limit } = FindRelatedConceptsSchema.parse(args);
          await ensureSemanticsReady(1, 20000);
          const storage = await getGraphStorage(globalSQLiteManager);
          const entity = await resolveEntity(storage, entityId);
          if (!entity) {
            return asMcpJson(
              toolFail("not_found", `Entity not found: ${entityId}`, { entityId }, toolMeta(requestId, startTime)),
            );
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
              typeof (entity as any).location?.end?.index === "number"
                ? (entity as any).location.end.index
                : full.length;
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
            const timeoutMs = config.mcp.agents?.defaultTimeout || config.mcp.server?.timeout || 600000;
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

          return asMcpJson(
            toolOk(
              { entity: { id: entity.id, name: entity.name, filePath: entityFilePath }, related: results },
              toolMeta(requestId, startTime),
            ),
          );
        }

        case "get_graph": {
          const { query, limit, cursor, pageSize } = GetGraphSchema.parse(args);
          const effectivePageSize = pageSize ?? limit ?? 100;
          const cursorState = decodeCursor<{ o?: number }>(cursor) ?? {};
          const offset = Math.max(0, Number(cursorState.o ?? 0) || 0);

          // Use direct database query instead of going through agents
          const storage = await getGraphStorage(globalSQLiteManager);
          const raw = await queryGraphEntities(storage, query, effectivePageSize + 1, offset);
          const hasMore = raw.entities.length > effectivePageSize;
          const entities = hasMore ? raw.entities.slice(0, effectivePageSize) : raw.entities;
          const idSet = new Set(entities.map((e) => e.id));
          const relations = await collectRelationsWithin(storage, idSet);

          logger.info(
            "GRAPH_QUERY",
            `Retrieved graph with ${entities.length} entities and ${relations.length} relationships`,
            {
              query,
              limit: effectivePageSize,
              offset,
              stats: raw.stats,
            },
            requestId,
          );

          return asMcpJson(
            toolOk(
              {
                query,
                page: {
                  offset,
                  pageSize: effectivePageSize,
                  nextCursor: hasMore ? encodeCursor({ o: offset + effectivePageSize }) : null,
                },
                entities,
                relations,
                stats: {
                  totalNodes: raw.stats.totalEntities,
                  totalRelations: raw.stats.totalRelationships,
                },
              },
              toolMeta(requestId, startTime),
            ),
          );
        }

        case "analyze_code_impact": {
          const { entityId, filePath: hintFilePath, depth } = AnalyzeCodeImpactSchema.parse(args);
          const storage = await getGraphStorage(globalSQLiteManager);
          const resolvedHintPath = hintFilePath ? normalizeInputPath(hintFilePath) : undefined;

          let entity = await storage.getEntity(entityId);
          if (!entity) {
            entity = await resolveEntityWithHint(storage, entityId, resolvedHintPath);
          }

          if (!entity) {
            return asMcpJson(
              toolFail("not_found", `Entity not found: ${entityId}`, { entityId }, toolMeta(requestId, startTime)),
            );
          }

          const traversal = await analyzeCodeImpactTraversal(storage, entity.id, depth ?? 2);

          const directEntities = (
            await Promise.all(Array.from(traversal.directDependents).map((id) => storage.getEntity(id)))
          ).filter((e): e is Entity => Boolean(e));
          const indirectEntities = (
            await Promise.all(Array.from(traversal.transitiveDependents).map((id) => storage.getEntity(id)))
          ).filter((e): e is Entity => Boolean(e));

          const visibleDirectEntities = directEntities.filter((e) => !(e.metadata as any)?.isExternal);
          const visibleIndirectEntities = indirectEntities.filter((e) => !(e.metadata as any)?.isExternal);

          const affectedFiles = new Set<string>();
          for (const sample of [...visibleDirectEntities, ...visibleIndirectEntities]) {
            affectedFiles.add(normalizeInputPath(sample.filePath) ?? sample.filePath);
          }

          const totalImpact = visibleDirectEntities.length + visibleIndirectEntities.length;
          const riskLevel =
            totalImpact > 50 ? "critical" : totalImpact > 20 ? "high" : totalImpact > 5 ? "medium" : "low";

          const outboundSummaries = (
            await Promise.all(
              Array.from(traversal.outboundDependencies).map(async (id) => {
                const dep = await storage.getEntity(id);
                return dep ? mapEntitySummary(dep) : null;
              }),
            )
          ).filter((item): item is ReturnType<typeof mapEntitySummary> => Boolean(item));

          const impact = {
            source: mapEntitySummary(entity),
            directImpacts: visibleDirectEntities.map((item) => mapEntitySummary(item)),
            indirectImpacts: visibleIndirectEntities.map((item) => mapEntitySummary(item)),
            outboundDependencies: outboundSummaries,
            affectedFiles: Array.from(affectedFiles),
            riskLevel,
            depthUsed: traversal.depthUsed,
            totals: {
              direct: visibleDirectEntities.length,
              indirect: visibleIndirectEntities.length,
              outbound: traversal.outboundDependencies.size,
            },
          };

          return asMcpJson(toolOk(impact, toolMeta(requestId, startTime)));
        }

        case "list_module_importers": {
          const { moduleSource, limit } = AnalyzeModuleDependentsSchema.parse(args);
          const storage = await getGraphStorage(globalSQLiteManager);
          const query: GraphQuery = {
            type: "entity",
            filters: {
              entityType: EntityType.IMPORT,
              importSource: moduleSource,
            } as any,
            limit,
          };

          const result = await storage.executeQuery(query);

          const limited = result.entities;

          const affectedFiles = Array.from(new Set(limited.map((e) => normalizeInputPath(e.filePath) ?? e.filePath)));

          const payload = {
            moduleSource,
            directImpacts: limited.map((e) => mapEntitySummary(e)),
            indirectImpacts: [],
            affectedFiles,
            riskLevel: limited.length > 20 ? "high" : limited.length > 5 ? "medium" : "low",
            totals: {
              direct: limited.length,
            },
          };

          return asMcpJson(toolOk(payload, toolMeta(requestId, startTime)));
        }

        case "get_graph_stats": {
          const storage = await getGraphStorage(globalSQLiteManager);
          const stats = await getGraphStats(storage);

          logger.info("GRAPH_STATS", "Retrieved graph statistics", stats, requestId);

          return asMcpJson(toolOk(stats, toolMeta(requestId, startTime)));
        }

        case "lerna_project_graph": {
          const { directory: inputDir, ingest, force } = GetLernaProjectGraphSchema.parse(args ?? {});
          const targetDir = normalizeInputPath(inputDir) ?? directory;
          const result = await getLernaProjectGraph(targetDir, { force });

          if (result.ok) {
            let ingestSummary:
              | {
                  packageCount: number;
                  relationshipCount: number;
                  skippedPackages: number;
                  removedPackages: number;
                }
              | undefined;

            if (ingest) {
              const storage = await getGraphStorage(globalSQLiteManager);
              ingestSummary = await ingestLernaGraph(storage, result.graph);
            }

            logger.info(
              "LERNA_GRAPH",
              "Generated Lerna project graph",
              {
                cwd: result.cwd,
                lernaVersion: result.lernaVersion,
                nodes: Object.keys(result.graph).length,
                ingestSummary,
                cached: result.cached ?? false,
                force,
              },
              requestId,
            );

            return asMcpJson(
              toolOk(
                {
                  cwd: result.cwd,
                  lernaVersion: result.lernaVersion,
                  nodeCount: Object.keys(result.graph).length,
                  graph: result.graph,
                  ingestSummary,
                  cached: result.cached ?? false,
                  force,
                },
                toolMeta(requestId, startTime),
              ),
            );
          }

          logger.warn(
            "LERNA_GRAPH",
            "Lerna project graph unavailable",
            {
              cwd: result.cwd,
              reason: result.reason,
              message: result.message,
              cached: result.cached ?? false,
              force,
            },
            requestId,
          );

          return asMcpJson(
            toolFail(
              "lerna_graph_unavailable",
              result.message || "Lerna project graph unavailable",
              {
                cwd: result.cwd,
                reason: result.reason,
                stdout: result.stdout,
                stderr: result.stderr,
                cached: result.cached ?? false,
                force,
              },
              toolMeta(requestId, startTime),
            ),
          );
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

          return asMcpJson(
            toolOk(
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
              toolMeta(requestId, startTime),
            ),
          );
        }

        case "get_agent_metrics": {
          GetAgentMetricsSchema.parse(args ?? {});

          const cond = await getConductor();
          await cond.initialize();

          const snapshot = await collectAgentMetrics({
            conductor: cond,
            resourceManager,
            knowledgeBus,
          });

          return asMcpJson(toolOk(snapshot, toolMeta(requestId, startTime)));
        }

        case "get_bus_stats": {
          GetBusStatsSchema.parse(args ?? {});

          const stats = knowledgeBus.getStats();

          return asMcpJson(toolOk(stats, toolMeta(requestId, startTime)));
        }

        case "clear_bus_topic": {
          const { topic } = ClearBusTopicSchema.parse(args ?? {});

          knowledgeBus.clearTopic(topic);
          const stats = knowledgeBus.getStats();

          return asMcpJson(toolOk({ topicCleared: topic, stats }, toolMeta(requestId, startTime)));
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
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

      return asMcpJson(toolFail("agent_busy", errorMessage, error.details, toolMeta(requestId, startTime)));
    }

    logger.mcpError(name, error instanceof Error ? error : new Error(errorMessage), requestId);

    return asMcpJson(toolFail("tool_error", errorMessage, undefined, toolMeta(requestId, startTime)));
  }
}

// Handler for tool execution
server.setRequestHandler(CallToolRequestSchema as any, async (request: any) => {
  const { name, arguments: args } = request.params;
  const requestId = createRequestId();
  const startTime = Date.now();

  logger.mcpRequest(name, args, requestId);

  return executeToolCall(name, args, requestId, startTime);
});

async function processDebugRequests(requests: DebugRequest[]): Promise<void> {
  for (const { parsed, raw } of requests) {
    let callRequest: any;
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

    process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
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
  appendGlobalTmpLog("server: main() starting", {
    cwd: process.cwd(),
    argv: process.argv.slice(2),
    directory,
    directoryExplicit,
    debugMode: debugRequests.length > 0,
    tmpLogFile: getGlobalTmpLogFile(),
  });

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
    toolsCount: 26,
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

  // Background initialization starts from `server.oninitialized`.
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  appendGlobalTmpLog("server: startup failed", { error: error instanceof Error ? error.message : String(error) });
  logger.critical("MCP Server Startup Failed", error.message, undefined, undefined, error);
  process.exit(1);
});
