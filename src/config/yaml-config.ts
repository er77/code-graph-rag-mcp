/**
 * TASK-001: YAML Configuration System
 *
 * Centralized configuration management with YAML files and environment
 * fallbacks. Provides runtime validation and graceful degradation for missing
 * dependencies.
 *
 * Architecture Decision Record: ADR-001
 * Part of Method 3: Hybrid Targeted Fix with YAML Foundation
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

// =============================================================================
// 1. CONFIGURATION INTERFACES
// =============================================================================

export interface MCPConfig {
  embedding?: {
    model?: string;
    provider?: "memory" | "transformers" | "ollama" | "openai" | "cloudru";
    apiKey?: string;
    enabled?: boolean;
    fallbackToMemory?: boolean;

    // NEW:
    ollama?: {
      baseUrl?: string;
      timeout?: number;
      timeoutMs?: number;
      concurrency?: number;
      headers?: Record<string, string>;
      autoPull?: boolean;
      warmupText?: string;
      checkServer?: boolean;
      pullTimeoutMs?: number;
    };
    openai?: {
      baseUrl?: string;
      apiKey?: string;
      timeout?: number;
      timeoutMs?: number;
      concurrency?: number;
      maxBatchSize?: number;
    };
    cloudru?: {
      baseUrl?: string;
      apiKey?: string;
      timeout?: number;
      timeoutMs?: number;
      concurrency?: number;
      maxBatchSize?: number;
    };
    transformers?: { quantized?: boolean; localPath?: string };
    memory?: { dimension?: number };
  };
  server?: { host?: string; port?: number; timeout?: number };
  agents?: {
    maxConcurrent?: number;
    defaultTimeout?: number;
    useParser?: boolean; // MCP_USE_PARSER
    devIndexBatch?: number; // MCP_DEV_INDEX_BATCH
  };
  semantic?: {
    cacheWarmupLimit?: number;
    popularEntitiesTopic?: string;
  };
}

// Resolved embedding configuration returned to callers
export interface EmbeddingConfigResolved {
  model: string;
  provider: "memory" | "transformers" | "ollama" | string;
  apiKey: string;
  enabled: boolean;
  fallbackToMemory: boolean;
  ollama?: {
    baseUrl?: string;
    timeout?: number;
    timeoutMs?: number;
    concurrency?: number;
    headers?: Record<string, string>;
    autoPull?: boolean;
    warmupText?: string;
    checkServer?: boolean;
    pullTimeoutMs?: number;
  };
  openai?: {
    baseUrl?: string;
    apiKey?: string;
    timeout?: number;
    timeoutMs?: number;
    concurrency?: number;
    maxBatchSize?: number;
  };
  cloudru?: {
    baseUrl?: string;
    apiKey?: string;
    timeout?: number;
    timeoutMs?: number;
    concurrency?: number;
    maxBatchSize?: number;
  };
  transformers?: { quantized?: boolean; localPath?: string };
  memory?: { dimension?: number };
}

export interface DatabaseConfig {
  path?: string;
  mode?: "WAL" | "DELETE" | "TRUNCATE";
  cacheSize?: number;
  mmapSize?: number;
  synchronous?: "OFF" | "NORMAL" | "FULL";
  tempStore?: "DEFAULT" | "FILE" | "MEMORY";
}

export interface LoggingConfig {
  level?: "debug" | "info" | "warn" | "error";
  format?: "json" | "text";
  outputFile?: string;
  maxFileSize?: string;
  maxFiles?: number;
  enableConsole?: boolean;
}

export interface ParserConfig {
  treeSitter?: {
    enabled?: boolean;
    languageConfigs?: string[];
    maxFileSize?: number;
    timeout?: number;
    bufferSize?: number;
  };
  incremental?: { enabled?: boolean; cacheSize?: number; cacheTTL?: number };
  agent?: {
    maxConcurrency?: number;
    memoryLimit?: number;
    priority?: number;
    batchSize?: number;
    cacheSize?: number;
    workerPoolSize?: number;
  };
}

export interface IndexerConfig {
  maxConcurrency?: number;
  memoryLimit?: number;
  priority?: number;
  batchSize?: number;
  cacheSize?: number;
  cacheTTL?: number;
}

export interface AgentRuntimeConfig {
  maxConcurrency?: number;
  memoryLimit?: number;
  priority?: number;
}

export type DevAgentConfig = AgentRuntimeConfig;
export type DoraAgentConfig = AgentRuntimeConfig;

export interface QueryAgentConfig extends AgentRuntimeConfig {
  simpleQueryTimeout?: number;
  complexQueryTimeout?: number;
  cacheWarmupSize?: number;
}

export interface SemanticAgentConfig extends AgentRuntimeConfig {
  batchSize?: number;
  modelPath?: string;
}

export interface AgentResourceConstraints {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxConcurrentAgents: number;
  maxTaskQueueSize: number;
}

export interface CoordinatorConfig extends AgentRuntimeConfig {
  taskQueueLimit?: number;
  loadBalancingStrategy?: "round-robin" | "least-loaded" | "priority";
  resourceConstraints: AgentResourceConstraints;
}

export interface ConductorConfig extends CoordinatorConfig {
  complexityThreshold?: number;
  mandatoryDelegation?: boolean;
}

export interface AppConfig {
  mcp: MCPConfig;
  database: DatabaseConfig;
  logging: LoggingConfig;
  parser: ParserConfig;
  indexer: IndexerConfig;
  devAgent: DevAgentConfig;
  doraAgent: DoraAgentConfig;
  queryAgent: QueryAgentConfig;
  semanticAgent: SemanticAgentConfig;
  coordinator: CoordinatorConfig;
  conductor: ConductorConfig;
  environment: string;
  debug: boolean;
}

// =============================================================================
// 2. DEFAULT CONFIGURATION VALUES
// =============================================================================

function expandTildePath(input: string | undefined): string | undefined {
  if (!input) return input;
  if (input === "~") return homedir();
  if (input.startsWith("~/") || input.startsWith("~\\")) return join(homedir(), input.slice(2));
  return input;
}

function selectDatabasePath(
  yamlPath: string | undefined,
  envPath: string | undefined,
  defaultPath: string | undefined,
): string | undefined {
  // Prefer env override during tests to avoid writing outside the repo by default.
  if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) {
    return envPath || yamlPath || defaultPath;
  }
  return yamlPath || envPath || defaultPath;
}

const DEFAULT_CONFIG: AppConfig = {
  mcp: {
    embedding: {
      model: "default",
      provider: "memory",
      enabled: false,
      fallbackToMemory: true,
    },
    server: {
      host: "localhost",
      port: 3000,
      timeout: 30000,
    },
    agents: {
      // Allow more registered agents by default; conductor still reuses by type
      maxConcurrent: 12,
      defaultTimeout: 15000,
      useParser: true, // MCP_USE_PARSER: Enable ParserAgent by default
      devIndexBatch: 100, // MCP_DEV_INDEX_BATCH: Default batch size for indexing
    },
    semantic: {
      cacheWarmupLimit: 50,
      popularEntitiesTopic: "semantic:warmup:entities",
    },
  },
  database: {
    // Per-repo default (resolved relative to the workspace root after process.chdir()).
    // Keeps codebases isolated by default and avoids global DB mixing.
    path: "./.code-graph-rag/vectors.db",
    mode: "WAL",
    cacheSize: 10000,
    mmapSize: 268435456, // 256MB
    synchronous: "NORMAL",
    tempStore: "MEMORY",
  },
  logging: {
    level: "info",
    format: "text",
    enableConsole: true,
    maxFileSize: "10MB",
    maxFiles: 5,
  },
  parser: {
    treeSitter: {
      enabled: true,
      languageConfigs: [
        "typescript",
        "javascript",
        "python",
        "c",
        "cpp",
        "csharp",
        "java",
        "rust",
        "go",
        "kotlin",
        "vba",
      ],
      maxFileSize: 1048576, // 1MB
      timeout: 5000,
      bufferSize: 1024 * 1024, // 1MB buffer
    },
    incremental: {
      enabled: true,
      cacheSize: 1000,
      cacheTTL: 300000, // 5 minutes
    },
    agent: {
      maxConcurrency: 4,
      memoryLimit: 512,
      priority: 8,
      batchSize: 10,
      cacheSize: 104857600, // 100MB
      workerPoolSize: 2,
    },
  },
  indexer: {
    maxConcurrency: 2,
    memoryLimit: 512,
    priority: 7,
    batchSize: 1000,
    cacheSize: 52428800, // 50MB
    cacheTTL: 300000, // 5 minutes
  },
  devAgent: {
    maxConcurrency: 3,
    memoryLimit: 256,
    priority: 7,
  },
  doraAgent: {
    maxConcurrency: 2,
    memoryLimit: 128,
    priority: 6,
  },
  queryAgent: {
    maxConcurrency: 10,
    memoryLimit: 112,
    priority: 9,
    simpleQueryTimeout: 100,
    complexQueryTimeout: 1000,
    cacheWarmupSize: 100,
  },
  semanticAgent: {
    maxConcurrency: 5,
    memoryLimit: 240,
    priority: 8,
    batchSize: 8,
    modelPath: "./models",
  },
  coordinator: {
    maxConcurrency: 100,
    memoryLimit: 128,
    priority: 10,
    taskQueueLimit: 100,
    loadBalancingStrategy: "least-loaded",
    resourceConstraints: {
      maxMemoryMB: 1024,
      maxCpuPercent: 80,
      maxConcurrentAgents: 10,
      maxTaskQueueSize: 100,
    },
  },
  conductor: {
    maxConcurrency: 100,
    memoryLimit: 128,
    priority: 10,
    taskQueueLimit: 100,
    loadBalancingStrategy: "least-loaded",
    resourceConstraints: {
      maxMemoryMB: 1024,
      maxCpuPercent: 80,
      maxConcurrentAgents: 10,
      maxTaskQueueSize: 100,
    },
    complexityThreshold: 8,
    mandatoryDelegation: true,
  },
  environment: "development",
  debug: false,
};

// =============================================================================
// 3. CONFIGURATION LOADER CLASS
// =============================================================================

export class ConfigLoader {
  private static instance: ConfigLoader;
  private static overridePath: string | undefined;
  private config: AppConfig;
  private configPath: string;

  private constructor() {
    this.configPath = this.resolveConfigPath();
    this.config = this.loadConfiguration();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  public static setOverridePath(path?: string): void {
    ConfigLoader.overridePath = path ? resolve(process.cwd(), path) : undefined;
    if (ConfigLoader.instance) {
      ConfigLoader.instance.configPath = ConfigLoader.instance.resolveConfigPath();
      ConfigLoader.instance.reload();
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Reload configuration from files
   */
  public reload(): void {
    this.config = this.loadConfiguration();
  }

  /**
   * Get specific configuration section
   */
  public getMCPConfig(): MCPConfig {
    return this.config.mcp;
  }

  public getDatabaseConfig(): DatabaseConfig {
    return this.config.database;
  }

  public getLoggingConfig(): LoggingConfig {
    return this.config.logging;
  }

  public getParserConfig(): ParserConfig {
    return this.config.parser;
  }

  /**
   * Get agent-specific configuration
   */
  public getAgentsConfig() {
    return this.config.mcp.agents || {};
  }

  /**
   * Check if ParserAgent should be used
   */
  public shouldUseParser(): boolean {
    return this.config.mcp.agents?.useParser ?? true;
  }

  /**
   * Get dev index batch size
   */
  public getDevIndexBatchSize(): number {
    return this.config.mcp.agents?.devIndexBatch ?? 100;
  }

  /**
   * Check if embedding model is available
   */
  public isEmbeddingEnabled(): boolean {
    return this.config.mcp.embedding?.enabled === true;
  }

  /**
   * Get embedding configuration with fallback
   */
  public getEmbeddingConfig(): EmbeddingConfigResolved {
    const embeddingConfig = this.config.mcp.embedding || {};
    return {
      model: embeddingConfig.model || "default",
      provider: (embeddingConfig.provider as any) || "memory",
      apiKey: embeddingConfig.apiKey || "",
      enabled: embeddingConfig.enabled || false,
      fallbackToMemory: embeddingConfig.fallbackToMemory !== false,
      ollama: embeddingConfig.ollama || undefined,
      openai: embeddingConfig.openai || undefined,
      cloudru: embeddingConfig.cloudru || undefined,
      transformers: embeddingConfig.transformers || undefined,
      memory: embeddingConfig.memory || undefined,
    };
  }

  // =============================================================================
  // 4. PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Resolve configuration file path based on environment
   */
  private resolveConfigPath(): string {
    if (ConfigLoader.overridePath) {
      if (!existsSync(ConfigLoader.overridePath)) {
        console.error(`[Config] Override config file not found: ${ConfigLoader.overridePath}`);
        process.exit(1);
      }
      return ConfigLoader.overridePath;
    }

    const env = process.env.NODE_ENV || "development";
    const configDir = resolve(process.cwd(), "config");

    // Try environment-specific config first
    const envConfigPath = join(configDir, `${env}.yaml`);
    if (existsSync(envConfigPath)) {
      return envConfigPath;
    }

    // Fall back to default config
    const defaultConfigPath = join(configDir, "default.yaml");
    if (existsSync(defaultConfigPath)) {
      return defaultConfigPath;
    }

    // No config file found - will use defaults with env variables
    return "";
  }

  /**
   * Load configuration from YAML file with environment variable fallbacks
   */
  private loadConfiguration(): AppConfig {
    let yamlConfig: Partial<AppConfig> = {};

    // Load YAML configuration if file exists
    if (this.configPath && existsSync(this.configPath)) {
      try {
        const yamlContent = readFileSync(this.configPath, "utf8");
        yamlConfig = parseYaml(yamlContent) || {};
        console.log(`[Config] Loaded configuration from: ${this.configPath}`);
      } catch (error) {
        console.warn(`[Config] Failed to load YAML config: ${error instanceof Error ? error.message : error}`);
        console.warn(`[Config] Falling back to environment variables and defaults`);
      }
    } else {
      console.log(`[Config] No YAML config found, using environment variables and defaults`);
    }

    // Merge with defaults and environment variables
    return this.mergeWithEnvironment(yamlConfig);
  }

  /**
   * Merge YAML config with environment variables and defaults
   */
  private mergeWithEnvironment(yamlConfig: Partial<AppConfig>): AppConfig {
    const config: AppConfig = {
      mcp: {
        embedding: {
          model:
            yamlConfig.mcp?.embedding?.model || process.env.MCP_EMBEDDING_MODEL || DEFAULT_CONFIG.mcp.embedding?.model,
          provider: (yamlConfig.mcp?.embedding?.provider ||
            process.env.MCP_EMBEDDING_PROVIDER ||
            DEFAULT_CONFIG.mcp.embedding?.provider) as "memory" | "transformers" | "ollama" | "openai" | "cloudru",
          apiKey:
            yamlConfig.mcp?.embedding?.apiKey ||
            process.env.MCP_EMBEDDING_API_KEY ||
            DEFAULT_CONFIG.mcp.embedding?.apiKey,
          enabled:
            yamlConfig.mcp?.embedding?.enabled !== undefined
              ? yamlConfig.mcp?.embedding?.enabled
              : process.env.MCP_EMBEDDING_ENABLED === "true" || DEFAULT_CONFIG.mcp.embedding?.enabled,
          fallbackToMemory:
            yamlConfig.mcp?.embedding?.fallbackToMemory !== undefined
              ? yamlConfig.mcp?.embedding?.fallbackToMemory
              : process.env.MCP_EMBEDDING_FALLBACK !== "false" || DEFAULT_CONFIG.mcp.embedding?.fallbackToMemory,
          ollama: yamlConfig.mcp?.embedding?.ollama || {
            baseUrl: process.env.OLLAMA_BASE_URL || undefined,
            timeout: Number(process.env.OLLAMA_TIMEOUT_MS) || undefined,
            timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS) || undefined,
            concurrency: Number(process.env.OLLAMA_CONCURRENCY) || undefined,
            headers: undefined,
            autoPull: process.env.OLLAMA_AUTO_PULL !== "false",
            warmupText: process.env.OLLAMA_WARMUP_TEXT || undefined,
            checkServer: process.env.OLLAMA_CHECK_SERVER !== "false",
            pullTimeoutMs: Number(process.env.OLLAMA_PULL_TIMEOUT_MS) || undefined,
          },
          openai: yamlConfig.mcp?.embedding?.openai || {
            baseUrl: process.env.OPENAI_BASE_URL || undefined,
            apiKey: process.env.OPENAI_API_KEY || undefined,
            timeout: Number(process.env.OPENAI_TIMEOUT_MS) || undefined,
            timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS) || undefined,
            concurrency: Number(process.env.OPENAI_CONCURRENCY) || undefined,
            maxBatchSize: Number(process.env.OPENAI_MAX_BATCH_SIZE) || undefined,
          },
          cloudru: yamlConfig.mcp?.embedding?.cloudru || {
            baseUrl: process.env.CLOUDRU_BASE_URL || undefined,
            apiKey: process.env.CLOUDRU_API_KEY || undefined,
            timeout: Number(process.env.CLOUDRU_TIMEOUT_MS) || undefined,
            timeoutMs: Number(process.env.CLOUDRU_TIMEOUT_MS) || undefined,
            concurrency: Number(process.env.CLOUDRU_CONCURRENCY) || undefined,
            maxBatchSize: Number(process.env.CLOUDRU_MAX_BATCH_SIZE) || undefined,
          },
          transformers: {
            quantized:
              yamlConfig.mcp?.embedding?.transformers?.quantized !== undefined
                ? yamlConfig.mcp?.embedding?.transformers?.quantized
                : process.env.TRANSFORMERS_QUANTIZED !== "false" || undefined,
            localPath:
              yamlConfig.mcp?.embedding?.transformers?.localPath || process.env.TRANSFORMERS_LOCAL_PATH || undefined,
          },
          memory: {
            dimension:
              yamlConfig.mcp?.embedding?.memory?.dimension || Number(process.env.MEMORY_EMBED_DIM) || undefined,
          },
        },
        server: {
          host: yamlConfig.mcp?.server?.host || process.env.MCP_SERVER_HOST || DEFAULT_CONFIG.mcp.server?.host,
          port: yamlConfig.mcp?.server?.port || Number(process.env.MCP_SERVER_PORT) || DEFAULT_CONFIG.mcp.server?.port,
          timeout:
            yamlConfig.mcp?.server?.timeout ||
            Number(process.env.MCP_SERVER_TIMEOUT) ||
            DEFAULT_CONFIG.mcp.server?.timeout,
        },
        agents: {
          maxConcurrent:
            yamlConfig.mcp?.agents?.maxConcurrent ||
            Number(process.env.MCP_MAX_CONCURRENT_AGENTS) ||
            DEFAULT_CONFIG.mcp.agents?.maxConcurrent,
          defaultTimeout:
            yamlConfig.mcp?.agents?.defaultTimeout ||
            Number(process.env.MCP_AGENT_TIMEOUT) ||
            DEFAULT_CONFIG.mcp.agents?.defaultTimeout,
          useParser:
            yamlConfig.mcp?.agents?.useParser !== undefined
              ? yamlConfig.mcp?.agents?.useParser
              : process.env.MCP_USE_PARSER !== "0" || DEFAULT_CONFIG.mcp.agents?.useParser,
          devIndexBatch:
            yamlConfig.mcp?.agents?.devIndexBatch ||
            Number(process.env.MCP_DEV_INDEX_BATCH) ||
            DEFAULT_CONFIG.mcp.agents?.devIndexBatch,
        },
        semantic: {
          cacheWarmupLimit:
            yamlConfig.mcp?.semantic?.cacheWarmupLimit !== undefined
              ? yamlConfig.mcp.semantic.cacheWarmupLimit
              : process.env.MCP_SEMANTIC_WARMUP_LIMIT !== undefined
                ? Number(process.env.MCP_SEMANTIC_WARMUP_LIMIT)
                : DEFAULT_CONFIG.mcp.semantic?.cacheWarmupLimit,
          popularEntitiesTopic:
            yamlConfig.mcp?.semantic?.popularEntitiesTopic ||
            process.env.MCP_SEMANTIC_WARMUP_TOPIC ||
            DEFAULT_CONFIG.mcp.semantic?.popularEntitiesTopic,
        },
      },
      database: {
        path: expandTildePath(
          selectDatabasePath(yamlConfig.database?.path, process.env.DATABASE_PATH, DEFAULT_CONFIG.database?.path),
        ),
        mode: (yamlConfig.database?.mode as any) || (process.env.DATABASE_MODE as any) || DEFAULT_CONFIG.database?.mode,
        cacheSize:
          yamlConfig.database?.cacheSize ||
          Number(process.env.DATABASE_CACHE_SIZE) ||
          DEFAULT_CONFIG.database?.cacheSize,
        mmapSize:
          yamlConfig.database?.mmapSize || Number(process.env.DATABASE_MMAP_SIZE) || DEFAULT_CONFIG.database?.mmapSize,
        synchronous:
          (yamlConfig.database?.synchronous as any) ||
          (process.env.DATABASE_SYNCHRONOUS as any) ||
          DEFAULT_CONFIG.database?.synchronous,
        tempStore:
          (yamlConfig.database?.tempStore as any) ||
          (process.env.DATABASE_TEMP_STORE as any) ||
          DEFAULT_CONFIG.database?.tempStore,
      },
      logging: {
        level: (yamlConfig.logging?.level as any) || (process.env.LOG_LEVEL as any) || DEFAULT_CONFIG.logging?.level,
        format:
          (yamlConfig.logging?.format as any) || (process.env.LOG_FORMAT as any) || DEFAULT_CONFIG.logging?.format,
        outputFile: yamlConfig.logging?.outputFile || process.env.LOG_FILE || DEFAULT_CONFIG.logging?.outputFile,
        maxFileSize:
          yamlConfig.logging?.maxFileSize || process.env.LOG_MAX_FILE_SIZE || DEFAULT_CONFIG.logging?.maxFileSize,
        maxFiles: yamlConfig.logging?.maxFiles || Number(process.env.LOG_MAX_FILES) || DEFAULT_CONFIG.logging?.maxFiles,
        enableConsole:
          yamlConfig.logging?.enableConsole !== undefined
            ? yamlConfig.logging?.enableConsole
            : process.env.LOG_ENABLE_CONSOLE !== "false" || DEFAULT_CONFIG.logging?.enableConsole,
      },
      parser: {
        treeSitter: {
          enabled:
            yamlConfig.parser?.treeSitter?.enabled !== undefined
              ? yamlConfig.parser?.treeSitter?.enabled
              : process.env.PARSER_TREE_SITTER_ENABLED !== "false" || DEFAULT_CONFIG.parser.treeSitter?.enabled,
          languageConfigs:
            yamlConfig.parser?.treeSitter?.languageConfigs ||
            process.env.PARSER_LANGUAGES?.split(",") ||
            DEFAULT_CONFIG.parser.treeSitter?.languageConfigs,
          maxFileSize:
            yamlConfig.parser?.treeSitter?.maxFileSize ||
            Number(process.env.PARSER_MAX_FILE_SIZE) ||
            DEFAULT_CONFIG.parser.treeSitter?.maxFileSize,
          timeout:
            yamlConfig.parser?.treeSitter?.timeout ||
            Number(process.env.PARSER_TIMEOUT) ||
            DEFAULT_CONFIG.parser.treeSitter?.timeout,
          bufferSize:
            yamlConfig.parser?.treeSitter?.bufferSize ||
            Number(process.env.PARSER_BUFFER_SIZE) ||
            DEFAULT_CONFIG.parser.treeSitter?.bufferSize,
        },
        incremental: {
          enabled:
            yamlConfig.parser?.incremental?.enabled !== undefined
              ? yamlConfig.parser?.incremental?.enabled
              : process.env.PARSER_INCREMENTAL_ENABLED !== "false" || DEFAULT_CONFIG.parser.incremental?.enabled,
          cacheSize:
            yamlConfig.parser?.incremental?.cacheSize ||
            Number(process.env.PARSER_CACHE_SIZE) ||
            DEFAULT_CONFIG.parser.incremental?.cacheSize,
          cacheTTL:
            yamlConfig.parser?.incremental?.cacheTTL ||
            Number(process.env.PARSER_CACHE_TTL) ||
            DEFAULT_CONFIG.parser.incremental?.cacheTTL,
        },
        agent: {
          maxConcurrency:
            yamlConfig.parser?.agent?.maxConcurrency ||
            Number(process.env.PARSER_AGENT_MAX_CONCURRENCY) ||
            DEFAULT_CONFIG.parser.agent?.maxConcurrency,
          memoryLimit:
            yamlConfig.parser?.agent?.memoryLimit ||
            Number(process.env.PARSER_AGENT_MEMORY_LIMIT) ||
            DEFAULT_CONFIG.parser.agent?.memoryLimit,
          priority:
            yamlConfig.parser?.agent?.priority ||
            Number(process.env.PARSER_AGENT_PRIORITY) ||
            DEFAULT_CONFIG.parser.agent?.priority,
          batchSize:
            yamlConfig.parser?.agent?.batchSize ||
            Number(process.env.PARSER_AGENT_BATCH_SIZE) ||
            DEFAULT_CONFIG.parser.agent?.batchSize,
          cacheSize:
            yamlConfig.parser?.agent?.cacheSize ||
            Number(process.env.PARSER_AGENT_CACHE_SIZE) ||
            DEFAULT_CONFIG.parser.agent?.cacheSize,
          workerPoolSize:
            yamlConfig.parser?.agent?.workerPoolSize ||
            Number(process.env.PARSER_AGENT_WORKER_POOL_SIZE) ||
            DEFAULT_CONFIG.parser.agent?.workerPoolSize,
        },
      },
      indexer: {
        maxConcurrency:
          yamlConfig.indexer?.maxConcurrency ||
          Number(process.env.INDEXER_AGENT_MAX_CONCURRENCY) ||
          DEFAULT_CONFIG.indexer?.maxConcurrency,
        memoryLimit:
          yamlConfig.indexer?.memoryLimit ||
          Number(process.env.INDEXER_AGENT_MEMORY_LIMIT) ||
          DEFAULT_CONFIG.indexer?.memoryLimit,
        priority:
          yamlConfig.indexer?.priority ||
          Number(process.env.INDEXER_AGENT_PRIORITY) ||
          DEFAULT_CONFIG.indexer?.priority,
        batchSize:
          yamlConfig.indexer?.batchSize ||
          Number(process.env.INDEXER_AGENT_BATCH_SIZE) ||
          DEFAULT_CONFIG.indexer?.batchSize,
        cacheSize:
          yamlConfig.indexer?.cacheSize ||
          Number(process.env.INDEXER_AGENT_CACHE_SIZE) ||
          DEFAULT_CONFIG.indexer?.cacheSize,
        cacheTTL:
          yamlConfig.indexer?.cacheTTL ||
          Number(process.env.INDEXER_AGENT_CACHE_TTL) ||
          DEFAULT_CONFIG.indexer?.cacheTTL,
      },
      devAgent: {
        maxConcurrency:
          yamlConfig.devAgent?.maxConcurrency ||
          Number(process.env.DEV_AGENT_MAX_CONCURRENCY) ||
          DEFAULT_CONFIG.devAgent.maxConcurrency,
        memoryLimit:
          yamlConfig.devAgent?.memoryLimit ||
          Number(process.env.DEV_AGENT_MEMORY_LIMIT) ||
          DEFAULT_CONFIG.devAgent.memoryLimit,
        priority:
          yamlConfig.devAgent?.priority || Number(process.env.DEV_AGENT_PRIORITY) || DEFAULT_CONFIG.devAgent.priority,
      },
      doraAgent: {
        maxConcurrency:
          yamlConfig.doraAgent?.maxConcurrency ||
          Number(process.env.DORA_AGENT_MAX_CONCURRENCY) ||
          DEFAULT_CONFIG.doraAgent.maxConcurrency,
        memoryLimit:
          yamlConfig.doraAgent?.memoryLimit ||
          Number(process.env.DORA_AGENT_MEMORY_LIMIT) ||
          DEFAULT_CONFIG.doraAgent.memoryLimit,
        priority:
          yamlConfig.doraAgent?.priority ||
          Number(process.env.DORA_AGENT_PRIORITY) ||
          DEFAULT_CONFIG.doraAgent.priority,
      },
      queryAgent: {
        maxConcurrency:
          yamlConfig.queryAgent?.maxConcurrency ||
          Number(process.env.QUERY_AGENT_MAX_CONCURRENCY) ||
          DEFAULT_CONFIG.queryAgent.maxConcurrency,
        memoryLimit:
          yamlConfig.queryAgent?.memoryLimit ||
          Number(process.env.QUERY_AGENT_MEMORY_LIMIT) ||
          DEFAULT_CONFIG.queryAgent.memoryLimit,
        priority:
          yamlConfig.queryAgent?.priority ||
          Number(process.env.QUERY_AGENT_PRIORITY) ||
          DEFAULT_CONFIG.queryAgent.priority,
        simpleQueryTimeout:
          yamlConfig.queryAgent?.simpleQueryTimeout ||
          Number(process.env.QUERY_AGENT_SIMPLE_TIMEOUT) ||
          DEFAULT_CONFIG.queryAgent.simpleQueryTimeout,
        complexQueryTimeout:
          yamlConfig.queryAgent?.complexQueryTimeout ||
          Number(process.env.QUERY_AGENT_COMPLEX_TIMEOUT) ||
          DEFAULT_CONFIG.queryAgent.complexQueryTimeout,
        cacheWarmupSize:
          yamlConfig.queryAgent?.cacheWarmupSize ||
          Number(process.env.QUERY_AGENT_CACHE_WARMUP) ||
          DEFAULT_CONFIG.queryAgent.cacheWarmupSize,
      },
      semanticAgent: {
        maxConcurrency:
          yamlConfig.semanticAgent?.maxConcurrency ||
          Number(process.env.SEMANTIC_AGENT_MAX_CONCURRENCY) ||
          DEFAULT_CONFIG.semanticAgent.maxConcurrency,
        memoryLimit:
          yamlConfig.semanticAgent?.memoryLimit ||
          Number(process.env.SEMANTIC_AGENT_MEMORY_LIMIT) ||
          DEFAULT_CONFIG.semanticAgent.memoryLimit,
        priority:
          yamlConfig.semanticAgent?.priority ||
          Number(process.env.SEMANTIC_AGENT_PRIORITY) ||
          DEFAULT_CONFIG.semanticAgent.priority,
        batchSize:
          yamlConfig.semanticAgent?.batchSize ||
          Number(process.env.SEMANTIC_AGENT_BATCH_SIZE) ||
          DEFAULT_CONFIG.semanticAgent.batchSize,
        modelPath:
          yamlConfig.semanticAgent?.modelPath ||
          process.env.SEMANTIC_AGENT_MODEL_PATH ||
          DEFAULT_CONFIG.semanticAgent.modelPath,
      },
      coordinator: {
        maxConcurrency:
          yamlConfig.coordinator?.maxConcurrency ||
          Number(process.env.COORDINATOR_MAX_CONCURRENCY) ||
          DEFAULT_CONFIG.coordinator.maxConcurrency,
        memoryLimit:
          yamlConfig.coordinator?.memoryLimit ||
          Number(process.env.COORDINATOR_MEMORY_LIMIT) ||
          DEFAULT_CONFIG.coordinator.memoryLimit,
        priority:
          yamlConfig.coordinator?.priority ||
          Number(process.env.COORDINATOR_PRIORITY) ||
          DEFAULT_CONFIG.coordinator.priority,
        taskQueueLimit:
          yamlConfig.coordinator?.taskQueueLimit ||
          Number(process.env.COORDINATOR_TASK_QUEUE_LIMIT) ||
          DEFAULT_CONFIG.coordinator.taskQueueLimit,
        loadBalancingStrategy:
          (yamlConfig.coordinator?.loadBalancingStrategy as any) ||
          (process.env.COORDINATOR_LOAD_BALANCING_STRATEGY as any) ||
          DEFAULT_CONFIG.coordinator.loadBalancingStrategy,
        resourceConstraints: {
          maxMemoryMB:
            yamlConfig.coordinator?.resourceConstraints?.maxMemoryMB ||
            Number(process.env.COORDINATOR_MAX_MEMORY_MB) ||
            DEFAULT_CONFIG.coordinator.resourceConstraints?.maxMemoryMB,
          maxCpuPercent:
            yamlConfig.coordinator?.resourceConstraints?.maxCpuPercent ||
            Number(process.env.COORDINATOR_MAX_CPU_PERCENT) ||
            DEFAULT_CONFIG.coordinator.resourceConstraints?.maxCpuPercent,
          maxConcurrentAgents:
            yamlConfig.coordinator?.resourceConstraints?.maxConcurrentAgents ||
            Number(process.env.COORDINATOR_MAX_CONCURRENT_AGENTS) ||
            yamlConfig.mcp?.agents?.maxConcurrent ||
            Number(process.env.MCP_MAX_CONCURRENT_AGENTS) ||
            DEFAULT_CONFIG.coordinator.resourceConstraints?.maxConcurrentAgents,
          maxTaskQueueSize:
            yamlConfig.coordinator?.resourceConstraints?.maxTaskQueueSize ||
            Number(process.env.COORDINATOR_MAX_TASK_QUEUE_SIZE) ||
            DEFAULT_CONFIG.coordinator.resourceConstraints?.maxTaskQueueSize,
        },
      },
      conductor: {
        maxConcurrency:
          yamlConfig.conductor?.maxConcurrency ||
          Number(process.env.CONDUCTOR_MAX_CONCURRENCY) ||
          DEFAULT_CONFIG.conductor.maxConcurrency,
        memoryLimit:
          yamlConfig.conductor?.memoryLimit ||
          Number(process.env.CONDUCTOR_MEMORY_LIMIT) ||
          DEFAULT_CONFIG.conductor.memoryLimit,
        priority:
          yamlConfig.conductor?.priority || Number(process.env.CONDUCTOR_PRIORITY) || DEFAULT_CONFIG.conductor.priority,
        taskQueueLimit:
          yamlConfig.conductor?.taskQueueLimit ||
          Number(process.env.CONDUCTOR_TASK_QUEUE_LIMIT) ||
          DEFAULT_CONFIG.conductor.taskQueueLimit,
        loadBalancingStrategy:
          (yamlConfig.conductor?.loadBalancingStrategy as any) ||
          (process.env.CONDUCTOR_LOAD_BALANCING_STRATEGY as any) ||
          DEFAULT_CONFIG.conductor.loadBalancingStrategy,
        resourceConstraints: {
          maxMemoryMB:
            yamlConfig.conductor?.resourceConstraints?.maxMemoryMB ||
            Number(process.env.CONDUCTOR_MAX_MEMORY_MB) ||
            DEFAULT_CONFIG.conductor.resourceConstraints?.maxMemoryMB,
          maxCpuPercent:
            yamlConfig.conductor?.resourceConstraints?.maxCpuPercent ||
            Number(process.env.CONDUCTOR_MAX_CPU_PERCENT) ||
            DEFAULT_CONFIG.conductor.resourceConstraints?.maxCpuPercent,
          maxConcurrentAgents:
            yamlConfig.conductor?.resourceConstraints?.maxConcurrentAgents ||
            Number(process.env.CONDUCTOR_MAX_CONCURRENT_AGENTS) ||
            yamlConfig.mcp?.agents?.maxConcurrent ||
            Number(process.env.MCP_MAX_CONCURRENT_AGENTS) ||
            DEFAULT_CONFIG.conductor.resourceConstraints?.maxConcurrentAgents,
          maxTaskQueueSize:
            yamlConfig.conductor?.resourceConstraints?.maxTaskQueueSize ||
            Number(process.env.CONDUCTOR_MAX_TASK_QUEUE_SIZE) ||
            DEFAULT_CONFIG.conductor.resourceConstraints?.maxTaskQueueSize,
        },
        complexityThreshold:
          yamlConfig.conductor?.complexityThreshold ||
          Number(process.env.CONDUCTOR_COMPLEXITY_THRESHOLD) ||
          DEFAULT_CONFIG.conductor.complexityThreshold,
        mandatoryDelegation:
          yamlConfig.conductor?.mandatoryDelegation !== undefined
            ? yamlConfig.conductor?.mandatoryDelegation
            : process.env.CONDUCTOR_MANDATORY_DELEGATION !== "false" &&
              (process.env.CONDUCTOR_MANDATORY_DELEGATION === "true" || DEFAULT_CONFIG.conductor.mandatoryDelegation),
      },
      environment: yamlConfig.environment || process.env.NODE_ENV || DEFAULT_CONFIG.environment,
      debug: yamlConfig.debug !== undefined ? yamlConfig.debug : process.env.DEBUG === "true" || DEFAULT_CONFIG.debug,
    };

    return config;
  }
}

// =============================================================================
// 5. UTILITY FUNCTIONS
// =============================================================================

/**
 * Get global configuration instance
 */
export function getConfig(): AppConfig {
  return ConfigLoader.getInstance().getConfig();
}

/**
 * Get MCP configuration with embedding safety check
 */
export function getMCPConfigSafe(): MCPConfig & { embeddingAvailable: boolean } {
  const config = ConfigLoader.getInstance();
  const mcpConfig = config.getMCPConfig();

  return {
    ...mcpConfig,
    embeddingAvailable: config.isEmbeddingEnabled(),
  };
}

/**
 * Initialize configuration system
 */
export function initializeConfig(): AppConfig {
  const config = ConfigLoader.getInstance().getConfig();

  console.log(`[Config] Environment: ${config.environment}`);
  console.log(`[Config] Debug mode: ${config.debug}`);
  console.log(`[Config] Embedding enabled: ${config.mcp.embedding?.enabled}`);
  console.log(`[Config] Database path: ${config.database.path}`);

  return config;
}

// =============================================================================
// 6. VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate configuration at startup
 */
export function validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate database configuration
  if (!config.database.path) {
    errors.push("Database path is required");
  }

  // Validate MCP configuration
  if (config.mcp.embedding?.enabled && !config.mcp.embedding.provider) {
    errors.push("Embedding provider is required when embedding is enabled");
  }

  // Validate logging configuration
  if (!["debug", "info", "warn", "error"].includes(config.logging.level || "")) {
    errors.push("Invalid logging level");
  }

  // Validate parser configuration
  if (
    config.parser.treeSitter?.enabled &&
    (!config.parser.treeSitter.languageConfigs || config.parser.treeSitter.languageConfigs.length === 0)
  ) {
    errors.push("Language configurations required when tree-sitter is enabled");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
