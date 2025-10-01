/**
 * TASK-001: YAML Configuration System
 * 
 * Centralized configuration management with YAML files and environment fallbacks.
 * Provides runtime validation and graceful degradation for missing dependencies.
 * 
 * Architecture Decision Record: ADR-001
 * Part of Method 3: Hybrid Targeted Fix with YAML Foundation
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

// =============================================================================
// 1. CONFIGURATION INTERFACES
// =============================================================================

export interface MCPConfig {
  embedding?: {
    model?: string;
    provider?: string;
    apiKey?: string;
    enabled?: boolean;
    fallbackToMemory?: boolean;
  };
  server?: {
    host?: string;
    port?: number;
    timeout?: number;
  };
  agents?: {
    maxConcurrent?: number;
    defaultTimeout?: number;
  };
}

export interface DatabaseConfig {
  path?: string;
  mode?: 'WAL' | 'DELETE' | 'TRUNCATE';
  cacheSize?: number;
  mmapSize?: number;
  synchronous?: 'OFF' | 'NORMAL' | 'FULL';
  tempStore?: 'DEFAULT' | 'FILE' | 'MEMORY';
}

export interface LoggingConfig {
  level?: 'debug' | 'info' | 'warn' | 'error';
  format?: 'json' | 'text';
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
  };
  incremental?: {
    enabled?: boolean;
    cacheSize?: number;
    cacheTTL?: number;
  };
}

export interface AppConfig {
  mcp: MCPConfig;
  database: DatabaseConfig;
  logging: LoggingConfig;
  parser: ParserConfig;
  environment: string;
  debug: boolean;
}

// =============================================================================
// 2. DEFAULT CONFIGURATION VALUES
// =============================================================================

const DEFAULT_CONFIG: AppConfig = {
  mcp: {
    embedding: {
      model: 'default',
      provider: 'memory',
      enabled: false,
      fallbackToMemory: true,
    },
    server: {
      host: 'localhost',
      port: 3000,
      timeout: 30000,
    },
    agents: {
      // Allow more registered agents by default; conductor still reuses by type
      maxConcurrent: 12,
      defaultTimeout: 15000,
    },
  },
  database: {
    path: './vectors.db',
    mode: 'WAL',
    cacheSize: 10000,
    mmapSize: 268435456, // 256MB
    synchronous: 'NORMAL',
    tempStore: 'MEMORY',
  },
  logging: {
    level: 'info',
    format: 'text',
    enableConsole: true,
    maxFileSize: '10MB',
    maxFiles: 5,
  },
  parser: {
    treeSitter: {
      enabled: true,
      languageConfigs: ['typescript', 'javascript', 'python', 'c', 'cpp'],
      maxFileSize: 1048576, // 1MB
      timeout: 5000,
    },
    incremental: {
      enabled: true,
      cacheSize: 1000,
      cacheTTL: 300000, // 5 minutes
    },
  },
  environment: 'development',
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
   * Check if embedding model is available
   */
  public isEmbeddingEnabled(): boolean {
    return this.config.mcp.embedding?.enabled === true;
  }

  /**
   * Get embedding configuration with fallback
   */
  public getEmbeddingConfig(): Required<MCPConfig['embedding']> {
    const embeddingConfig = this.config.mcp.embedding || {};
    return {
      model: embeddingConfig.model || 'default',
      provider: embeddingConfig.provider || 'memory',
      apiKey: embeddingConfig.apiKey || '',
      enabled: embeddingConfig.enabled || false,
      fallbackToMemory: embeddingConfig.fallbackToMemory !== false,
    };
  }

  // =============================================================================
  // 4. PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Resolve configuration file path based on environment
   */
  private resolveConfigPath(): string {
    const env = process.env.NODE_ENV || 'development';
    const configDir = resolve(process.cwd(), 'config');
    
    // Try environment-specific config first
    const envConfigPath = join(configDir, `${env}.yaml`);
    if (existsSync(envConfigPath)) {
      return envConfigPath;
    }

    // Fall back to default config
    const defaultConfigPath = join(configDir, 'default.yaml');
    if (existsSync(defaultConfigPath)) {
      return defaultConfigPath;
    }

    // No config file found - will use defaults with env variables
    return '';
  }

  /**
   * Load configuration from YAML file with environment variable fallbacks
   */
  private loadConfiguration(): AppConfig {
    let yamlConfig: Partial<AppConfig> = {};

    // Load YAML configuration if file exists
    if (this.configPath && existsSync(this.configPath)) {
      try {
        const yamlContent = readFileSync(this.configPath, 'utf8');
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
          model: yamlConfig.mcp?.embedding?.model 
            || process.env.MCP_EMBEDDING_MODEL 
            || DEFAULT_CONFIG.mcp.embedding?.model,
          provider: yamlConfig.mcp?.embedding?.provider 
            || process.env.MCP_EMBEDDING_PROVIDER 
            || DEFAULT_CONFIG.mcp.embedding?.provider,
          apiKey: yamlConfig.mcp?.embedding?.apiKey 
            || process.env.MCP_EMBEDDING_API_KEY 
            || DEFAULT_CONFIG.mcp.embedding?.apiKey,
          enabled: yamlConfig.mcp?.embedding?.enabled !== undefined
            ? yamlConfig.mcp?.embedding?.enabled
            : (process.env.MCP_EMBEDDING_ENABLED === 'true') || DEFAULT_CONFIG.mcp.embedding?.enabled,
          fallbackToMemory: yamlConfig.mcp?.embedding?.fallbackToMemory !== undefined
            ? yamlConfig.mcp?.embedding?.fallbackToMemory
            : (process.env.MCP_EMBEDDING_FALLBACK !== 'false') || DEFAULT_CONFIG.mcp.embedding?.fallbackToMemory,
        },
        server: {
          host: yamlConfig.mcp?.server?.host 
            || process.env.MCP_SERVER_HOST 
            || DEFAULT_CONFIG.mcp.server?.host,
          port: yamlConfig.mcp?.server?.port 
            || Number(process.env.MCP_SERVER_PORT) 
            || DEFAULT_CONFIG.mcp.server?.port,
          timeout: yamlConfig.mcp?.server?.timeout 
            || Number(process.env.MCP_SERVER_TIMEOUT) 
            || DEFAULT_CONFIG.mcp.server?.timeout,
        },
        agents: {
          maxConcurrent: yamlConfig.mcp?.agents?.maxConcurrent 
            || Number(process.env.MCP_MAX_CONCURRENT_AGENTS) 
            || DEFAULT_CONFIG.mcp.agents?.maxConcurrent,
          defaultTimeout: yamlConfig.mcp?.agents?.defaultTimeout 
            || Number(process.env.MCP_AGENT_TIMEOUT) 
            || DEFAULT_CONFIG.mcp.agents?.defaultTimeout,
        },
      },
      database: {
        path: yamlConfig.database?.path 
          || process.env.DATABASE_PATH 
          || DEFAULT_CONFIG.database?.path,
        mode: (yamlConfig.database?.mode as any) 
          || (process.env.DATABASE_MODE as any) 
          || DEFAULT_CONFIG.database?.mode,
        cacheSize: yamlConfig.database?.cacheSize 
          || Number(process.env.DATABASE_CACHE_SIZE) 
          || DEFAULT_CONFIG.database?.cacheSize,
        mmapSize: yamlConfig.database?.mmapSize 
          || Number(process.env.DATABASE_MMAP_SIZE) 
          || DEFAULT_CONFIG.database?.mmapSize,
        synchronous: (yamlConfig.database?.synchronous as any) 
          || (process.env.DATABASE_SYNCHRONOUS as any) 
          || DEFAULT_CONFIG.database?.synchronous,
        tempStore: (yamlConfig.database?.tempStore as any) 
          || (process.env.DATABASE_TEMP_STORE as any) 
          || DEFAULT_CONFIG.database?.tempStore,
      },
      logging: {
        level: (yamlConfig.logging?.level as any) 
          || (process.env.LOG_LEVEL as any) 
          || DEFAULT_CONFIG.logging?.level,
        format: (yamlConfig.logging?.format as any) 
          || (process.env.LOG_FORMAT as any) 
          || DEFAULT_CONFIG.logging?.format,
        outputFile: yamlConfig.logging?.outputFile 
          || process.env.LOG_FILE 
          || DEFAULT_CONFIG.logging?.outputFile,
        maxFileSize: yamlConfig.logging?.maxFileSize 
          || process.env.LOG_MAX_FILE_SIZE 
          || DEFAULT_CONFIG.logging?.maxFileSize,
        maxFiles: yamlConfig.logging?.maxFiles 
          || Number(process.env.LOG_MAX_FILES) 
          || DEFAULT_CONFIG.logging?.maxFiles,
        enableConsole: yamlConfig.logging?.enableConsole !== undefined
          ? yamlConfig.logging?.enableConsole
          : (process.env.LOG_ENABLE_CONSOLE !== 'false') || DEFAULT_CONFIG.logging?.enableConsole,
      },
      parser: {
        treeSitter: {
          enabled: yamlConfig.parser?.treeSitter?.enabled !== undefined
            ? yamlConfig.parser?.treeSitter?.enabled
            : (process.env.PARSER_TREE_SITTER_ENABLED !== 'false') || DEFAULT_CONFIG.parser.treeSitter?.enabled,
          languageConfigs: yamlConfig.parser?.treeSitter?.languageConfigs 
            || (process.env.PARSER_LANGUAGES?.split(',')) 
            || DEFAULT_CONFIG.parser.treeSitter?.languageConfigs,
          maxFileSize: yamlConfig.parser?.treeSitter?.maxFileSize 
            || Number(process.env.PARSER_MAX_FILE_SIZE) 
            || DEFAULT_CONFIG.parser.treeSitter?.maxFileSize,
          timeout: yamlConfig.parser?.treeSitter?.timeout 
            || Number(process.env.PARSER_TIMEOUT) 
            || DEFAULT_CONFIG.parser.treeSitter?.timeout,
        },
        incremental: {
          enabled: yamlConfig.parser?.incremental?.enabled !== undefined
            ? yamlConfig.parser?.incremental?.enabled
            : (process.env.PARSER_INCREMENTAL_ENABLED !== 'false') || DEFAULT_CONFIG.parser.incremental?.enabled,
          cacheSize: yamlConfig.parser?.incremental?.cacheSize 
            || Number(process.env.PARSER_CACHE_SIZE) 
            || DEFAULT_CONFIG.parser.incremental?.cacheSize,
          cacheTTL: yamlConfig.parser?.incremental?.cacheTTL 
            || Number(process.env.PARSER_CACHE_TTL) 
            || DEFAULT_CONFIG.parser.incremental?.cacheTTL,
        },
      },
      environment: yamlConfig.environment 
        || process.env.NODE_ENV 
        || DEFAULT_CONFIG.environment,
      debug: yamlConfig.debug !== undefined
        ? yamlConfig.debug
        : (process.env.DEBUG === 'true') || DEFAULT_CONFIG.debug,
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
    errors.push('Database path is required');
  }

  // Validate MCP configuration
  if (config.mcp.embedding?.enabled && !config.mcp.embedding.provider) {
    errors.push('Embedding provider is required when embedding is enabled');
  }

  // Validate logging configuration
  if (!['debug', 'info', 'warn', 'error'].includes(config.logging.level || '')) {
    errors.push('Invalid logging level');
  }

  // Validate parser configuration
  if (config.parser.treeSitter?.enabled && (!config.parser.treeSitter.languageConfigs || config.parser.treeSitter.languageConfigs.length === 0)) {
    errors.push('Language configurations required when tree-sitter is enabled');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
