/**
 * Rotated Debug Logger for MCP Server Activity
 *
 * Provides comprehensive logging with rotation for all MCP server activities
 * Stores logs in logs_llm folder with automatic rotation based on size and time
 */

import { existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { LoggerConfig } from "./logger-types.js";
import { LogLevel } from "./logger-types.js";

// =============================================================================
// LOGGING CONFIGURATION
// =============================================================================

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  stackTrace?: string;
  requestId?: string;
  duration?: number;
}

// Import centralized configuration
import { LOGGING_CONFIG } from "../config/logging-config.js";

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = LOGGING_CONFIG;

// =============================================================================
// LOGGER CLASS
// =============================================================================

export class RotatedLogger {
  private config: LoggerConfig;
  private currentLogFile: string;
  private logDir: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logDir = resolve(this.config.logDir);
    this.ensureLogDirectory();
    this.currentLogFile = this.getCurrentLogFile();
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getCurrentLogFile(): string {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    return join(this.logDir, `mcp-server-${dateStr}.log`);
  }

  private shouldRotate(): boolean {
    if (!this.config.enableRotation || !existsSync(this.currentLogFile)) {
      return false;
    }

    const stats = statSync(this.currentLogFile);
    return stats.size >= this.config.maxFileSize;
  }

  private rotateLogFile(): void {
    if (!existsSync(this.currentLogFile)) return;

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const rotatedFile = this.currentLogFile.replace(".log", `-${timestamp}.log`);

    try {
      renameSync(this.currentLogFile, rotatedFile);
      this.cleanupOldLogs();
    } catch (error) {
      console.error("Failed to rotate log file:", error);
    }
  }

  private cleanupOldLogs(): void {
    try {
      const files = readdirSync(this.logDir)
        .filter((f) => f.startsWith("mcp-server-") && f.endsWith(".log"))
        .map((f) => ({
          name: f,
          path: join(this.logDir, f),
          mtime: statSync(join(this.logDir, f)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the most recent files
      const filesToDelete = files.slice(this.config.maxFiles);
      for (const file of filesToDelete) {
        try {
          unlinkSync(file.path);
        } catch (error) {
          console.error(`Failed to delete old log file ${file.name}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to cleanup old logs:", error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.config.enableTimestamp) {
      parts.push(`[${entry.timestamp}]`);
    }

    parts.push(`[${LogLevel[entry.level]}]`);
    parts.push(`[${entry.category}]`);

    if (entry.requestId) {
      parts.push(`[${entry.requestId}]`);
    }

    parts.push(entry.message);

    if (entry.data) {
      parts.push(`DATA: ${JSON.stringify(entry.data, null, 2)}`);
    }

    if (entry.duration !== undefined) {
      parts.push(`DURATION: ${entry.duration}ms`);
    }

    if (entry.stackTrace && this.config.enableStackTrace) {
      parts.push(`STACK: ${entry.stackTrace}`);
    }

    return `${parts.join(" ")}\n`;
  }

  private writeLog(entry: LogEntry): void {
    if (entry.level < this.config.logLevel) {
      return; // Skip logs below configured level
    }

    // Check if we need to rotate
    if (this.shouldRotate()) {
      this.rotateLogFile();
      this.currentLogFile = this.getCurrentLogFile();
    }

    try {
      const logLine = this.formatLogEntry(entry);
      writeFileSync(this.currentLogFile, logLine, { flag: "a" });
    } catch (error) {
      console.error("Failed to write log:", error);
    }
  }

  // =============================================================================
  // PUBLIC LOGGING METHODS
  // =============================================================================

  debug(category: string, message: string, data?: any, requestId?: string): void {
    this.log(LogLevel.DEBUG, category, message, data, requestId);
  }

  info(category: string, message: string, data?: any, requestId?: string): void {
    this.log(LogLevel.INFO, category, message, data, requestId);
  }

  warn(category: string, message: string, data?: any, requestId?: string): void {
    this.log(LogLevel.WARN, category, message, data, requestId);
  }

  error(category: string, message: string, data?: any, requestId?: string, error?: Error): void {
    const stackTrace = error?.stack || (this.config.enableStackTrace ? new Error().stack : undefined);
    this.log(LogLevel.ERROR, category, message, data, requestId, stackTrace);
  }

  critical(category: string, message: string, data?: any, requestId?: string, error?: Error): void {
    const stackTrace = error?.stack || (this.config.enableStackTrace ? new Error().stack : undefined);
    this.log(LogLevel.CRITICAL, category, message, data, requestId, stackTrace);
  }

  private log(
    level: LogLevel,
    category: string,
    message: string,
    data?: any,
    requestId?: string,
    stackTrace?: string,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      stackTrace,
      requestId,
    };

    this.writeLog(entry);
  }

  // =============================================================================
  // MCP-SPECIFIC LOGGING METHODS
  // =============================================================================

  mcpRequest(method: string, params: any, requestId: string): void {
    this.info("MCP_REQUEST", `Incoming MCP request: ${method}`, { method, params }, requestId);
  }

  mcpResponse(method: string, result: any, duration: number, requestId: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      category: "MCP_RESPONSE",
      message: `MCP response: ${method}`,
      data: { method, result },
      requestId,
      duration,
    };
    this.writeLog(entry);
  }

  mcpError(method: string, error: Error, requestId: string): void {
    this.error("MCP_ERROR", `MCP request failed: ${method}`, { method, error: error.message }, requestId, error);
  }

  agentActivity(agentId: string, activity: string, data?: any, requestId?: string): void {
    this.debug("AGENT_ACTIVITY", `Agent ${agentId}: ${activity}`, { agentId, ...data }, requestId);
  }

  parseActivity(filePath: string, language: string, entitiesFound: number, duration: number, requestId?: string): void {
    this.info(
      "PARSE_ACTIVITY",
      `Parsed ${filePath}`,
      {
        filePath,
        language,
        entitiesFound,
        duration,
      },
      requestId,
    );
  }

  queryActivity(query: string, results: number, duration: number, requestId?: string): void {
    this.info(
      "QUERY_ACTIVITY",
      `Query executed`,
      {
        query: query.substring(0, 200), // Truncate long queries
        results,
        duration,
      },
      requestId,
    );
  }

  performanceMetrics(component: string, metrics: any, requestId?: string): void {
    this.debug("PERFORMANCE", `Performance metrics for ${component}`, metrics, requestId);
  }

  systemEvent(event: string, data?: any): void {
    this.info("SYSTEM", event, data);
  }

  // =============================================================================
  // INCIDENT/RECOVERY LOGGING (for SYSTEM_HANG_RECOVERY_PLAN)
  // =============================================================================

  incident(event: string, data?: any, requestId?: string, error?: Error): void {
    if (error) {
      this.error("INCIDENT", event, { ...data, error: error.message }, requestId, error);
    } else {
      this.warn("INCIDENT", event, data, requestId);
    }
  }

  recovery(event: string, data?: any, requestId?: string): void {
    this.info("RECOVERY", event, data, requestId);
  }
}

// =============================================================================
// SINGLETON LOGGER INSTANCE
// =============================================================================

export const logger = new RotatedLogger();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function logMCPOperation<T>(operation: string, fn: (requestId: string) => Promise<T>, params?: any): Promise<T> {
  const requestId = createRequestId();
  const startTime = Date.now();

  logger.mcpRequest(operation, params, requestId);

  return fn(requestId)
    .then((result) => {
      const duration = Date.now() - startTime;
      logger.mcpResponse(operation, result, duration, requestId);
      return result;
    })
    .catch((error) => {
      logger.mcpError(operation, error, requestId);
      throw error;
    });
}

// Re-export types for backward compatibility
export type { LoggerConfig } from "./logger-types.js";
export { LogLevel } from "./logger-types.js";
