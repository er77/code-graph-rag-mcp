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

export interface AppConfig {
  mcp: MCPConfig;
  database: DatabaseConfig;
  logging: LoggingConfig;
  parser: ParserConfig;
  indexer: IndexerConfig;
  environment: string;
  debug: boolean;
}

// =============================================================================
// 2. DEFAULT CONFIGURATION VALUES
// =============================================================================

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
    path: "./vectors.db",
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
      languageConfigs: ["typescript", "javascript", "python", "c", "cpp"],
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
  environment: "development",
  debug: false,
};

// =============================================================================
// 3. CONFIGURATION LOADER CLASS
// =============================================================================

export class ConfigLoader {
  private static instance: ConfigLoader;
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
        path: yamlConfig.database?.path || process.env.DATABASE_PATH || DEFAULT_CONFIG.database?.path,
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
