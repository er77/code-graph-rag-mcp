/**
 * Centralized Logging Configuration
 *
 * Provides configuration for the rotated logging system
 */

import { resolve } from 'path';
import { LoggerConfig, LogLevel } from '../utils/logger.js';

// Get the root directory of the project
const projectRoot = process.cwd().includes('examples/')
  ? resolve(process.cwd(), '../..')
  : process.cwd();

export const LOGGING_CONFIG: LoggerConfig = {
  logDir: resolve(projectRoot, 'logs_llm'),
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 20, // Keep more files for comprehensive debugging
  logLevel: LogLevel.DEBUG, // Capture all activity
  enableRotation: true,
  enableTimestamp: true,
  enableStackTrace: true
};

export const MCP_LOG_CATEGORIES = {
  SYSTEM: 'SYSTEM',
  MCP_REQUEST: 'MCP_REQUEST',
  MCP_RESPONSE: 'MCP_RESPONSE',
  MCP_ERROR: 'MCP_ERROR',
  AGENT_ACTIVITY: 'AGENT_ACTIVITY',
  PARSE_ACTIVITY: 'PARSE_ACTIVITY',
  QUERY_ACTIVITY: 'QUERY_ACTIVITY',
  PERFORMANCE: 'PERFORMANCE'
} as const;

export type MCPLogCategory = typeof MCP_LOG_CATEGORIES[keyof typeof MCP_LOG_CATEGORIES];