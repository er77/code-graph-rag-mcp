/**
 * Logger Types and Interfaces
 *
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LoggerConfig {
  logDir: string;
  maxFileSize: number; // bytes
  maxFiles: number;
  logLevel: LogLevel;
  enableRotation: boolean;
  enableTimestamp: boolean;
  enableStackTrace: boolean;
}

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
