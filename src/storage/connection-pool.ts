/**
 * TASK-001: Connection Pool for SQLite Database
 *
 * Manages multiple database connections for concurrent operations.
 * Optimized for commodity hardware with limited resources.
 *
 * Architecture References:
 * - Storage Types: src/types/storage.ts
 * - SQLite Manager: src/storage/sqlite-manager.ts
 */

import { EventEmitter } from "node:events";
import { homedir } from "node:os";
import { join } from "node:path";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type Database from "better-sqlite3";
import type { ConnectionPool, PoolStats } from "../types/storage.js";
import { SQLiteManager } from "./sqlite-manager.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_MAX_CONNECTIONS = 5;
const DEFAULT_MIN_CONNECTIONS = 1;
const DEFAULT_ACQUIRE_TIMEOUT = 5000; // ms
const DEFAULT_IDLE_TIMEOUT = 30000; // ms
const CONNECTION_TEST_INTERVAL = 10000; // ms

// =============================================================================
// 3. CONNECTION WRAPPER
// =============================================================================

interface PooledConnection {
  id: string;
  db: Database.Database;
  manager: SQLiteManager;
  inUse: boolean;
  lastUsed: number;
  createdAt: number;
  queryCount: number;
}

// =============================================================================
// 4. CONNECTION POOL IMPLEMENTATION
// =============================================================================

export class SQLiteConnectionPool extends EventEmitter implements ConnectionPool<SQLiteManager> {
  private connections: Map<string, PooledConnection> = new Map();
  private waitQueue: Array<{
    resolve: (conn: SQLiteManager) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];

  private config: Required<SQLitePoolConfig>;
  private stats = {
    totalCreated: 0,
    totalDestroyed: 0,
    totalTimeouts: 0,
    totalAcquired: 0,
    totalReleased: 0,
  };

  private healthCheckInterval?: NodeJS.Timeout;
  private closed = false;

  constructor(config: SQLitePoolConfig = {}) {
    super();

    this.config = {
      dbPath: config.dbPath || join(homedir(), ".code-graph-rag", "codegraph.db"),
      maxConnections: config.maxConnections || DEFAULT_MAX_CONNECTIONS,
      minConnections: config.minConnections || DEFAULT_MIN_CONNECTIONS,
      acquireTimeout: config.acquireTimeout || DEFAULT_ACQUIRE_TIMEOUT,
      idleTimeout: config.idleTimeout || DEFAULT_IDLE_TIMEOUT,
      readonly: config.readonly || false,
      verbose: config.verbose || false,
    };

    // Validate configuration
    if (this.config.minConnections > this.config.maxConnections) {
      throw new Error("minConnections cannot be greater than maxConnections");
    }

    // Initialize minimum connections
    this.initializePool();
  }

  /**
   * Initialize the connection pool
   */
  private async initializePool(): Promise<void> {
    console.log(`[ConnectionPool] Initializing with ${this.config.minConnections} connections`);

    for (let i = 0; i < this.config.minConnections; i++) {
      await this.createConnection();
    }

    // Start health check interval
    this.startHealthCheck();
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<PooledConnection> {
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error("Maximum connections reached");
    }

    const id = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const manager = new SQLiteManager({
      path: this.config.dbPath,
      readonly: this.config.readonly,
      verbose: this.config.verbose,
    });

    manager.initialize();

    const connection: PooledConnection = {
      id,
      db: manager.getConnection(),
      manager,
      inUse: false,
      lastUsed: Date.now(),
      createdAt: Date.now(),
      queryCount: 0,
    };

    this.connections.set(id, connection);
    this.stats.totalCreated++;

    this.emit("connection:created", id);
    console.log(`[ConnectionPool] Created connection ${id}`);

    return connection;
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<SQLiteManager> {
    if (this.closed) {
      throw new Error("Connection pool is closed");
    }

    // Try to find an idle connection
    for (const conn of this.connections.values()) {
      if (!conn.inUse) {
        conn.inUse = true;
        conn.lastUsed = Date.now();
        conn.queryCount++;
        this.stats.totalAcquired++;

        this.emit("connection:acquired", conn.id);
        return conn.manager;
      }
    }

    // Try to create a new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      const conn = await this.createConnection();
      conn.inUse = true;
      conn.queryCount++;
      this.stats.totalAcquired++;

      this.emit("connection:acquired", conn.id);
      return conn.manager;
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }

        this.stats.totalTimeouts++;
        reject(new Error("Connection acquire timeout"));
      }, this.config.acquireTimeout);

      this.waitQueue.push({ resolve, reject, timeout });
      this.emit("connection:waiting", this.waitQueue.length);
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(manager: SQLiteManager): void {
    // Find the connection by manager
    let connection: PooledConnection | undefined;

    for (const conn of this.connections.values()) {
      if (conn.manager === manager) {
        connection = conn;
        break;
      }
    }

    if (!connection) {
      console.warn("[ConnectionPool] Attempted to release unknown connection");
      return;
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();
    this.stats.totalReleased++;

    this.emit("connection:released", connection.id);

    // Check if anyone is waiting for a connection
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      clearTimeout(waiter.timeout);

      connection.inUse = true;
      connection.queryCount++;
      this.stats.totalAcquired++;

      waiter.resolve(connection.manager);
    }
  }

  /**
   * Destroy a specific connection
   */
  destroy(manager: SQLiteManager): void {
    // Find and remove the connection
    let connectionId: string | undefined;

    for (const [id, conn] of this.connections) {
      if (conn.manager === manager) {
        connectionId = id;
        break;
      }
    }

    if (!connectionId) {
      console.warn("[ConnectionPool] Attempted to destroy unknown connection");
      return;
    }

    const connection = this.connections.get(connectionId)!;

    try {
      connection.manager.close();
    } catch (error) {
      console.error(`[ConnectionPool] Error closing connection ${connectionId}:`, error);
    }

    this.connections.delete(connectionId);
    this.stats.totalDestroyed++;

    this.emit("connection:destroyed", connectionId);
    console.log(`[ConnectionPool] Destroyed connection ${connectionId}`);

    // Create a replacement if below minimum
    if (this.connections.size < this.config.minConnections && !this.closed) {
      this.createConnection().catch((error) => {
        console.error("[ConnectionPool] Error creating replacement connection:", error);
      });
    }
  }

  /**
   * Drain and close all connections
   */
  async drain(): Promise<void> {
    console.log("[ConnectionPool] Draining pool...");
    this.closed = true;

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Reject all waiting requests
    for (const waiter of this.waitQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("Connection pool is draining"));
    }
    this.waitQueue = [];

    // Wait for all connections to be released
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();

    while (this.hasActiveConnections() && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Close all connections
    for (const conn of this.connections.values()) {
      try {
        conn.manager.close();
      } catch (error) {
        console.error(`[ConnectionPool] Error closing connection ${conn.id}:`, error);
      }
    }

    this.connections.clear();
    console.log("[ConnectionPool] Pool drained");
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    let active = 0;
    let idle = 0;

    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        active++;
      } else {
        idle++;
      }
    }

    return {
      total: this.connections.size,
      active,
      idle,
      waiting: this.waitQueue.length,
      timeouts: this.stats.totalTimeouts,
    };
  }

  /**
   * Check if there are active connections
   */
  private hasActiveConnections(): boolean {
    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        return true;
      }
    }
    return false;
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, CONNECTION_TEST_INTERVAL);
    this.healthCheckInterval.unref?.();
  }

  /**
   * Perform health check on connections
   */
  private performHealthCheck(): void {
    const now = Date.now();
    const toDestroy: string[] = [];

    for (const [id, conn] of this.connections) {
      // Remove idle connections above minimum
      if (
        !conn.inUse &&
        this.connections.size > this.config.minConnections &&
        now - conn.lastUsed > this.config.idleTimeout
      ) {
        toDestroy.push(id);
        continue;
      }

      // Test connection health
      if (!conn.inUse) {
        try {
          conn.db.pragma("user_version");
        } catch (error) {
          console.error(`[ConnectionPool] Connection ${id} failed health check:`, error);
          toDestroy.push(id);
        }
      }
    }

    // Destroy unhealthy or idle connections
    for (const id of toDestroy) {
      const conn = this.connections.get(id);
      if (conn) {
        this.destroy(conn.manager);
      }
    }
  }

  /**
   * Execute a function with a pooled connection
   */
  async withConnection<T>(fn: (manager: SQLiteManager) => Promise<T>): Promise<T> {
    const connection = await this.acquire();

    try {
      return await fn(connection);
    } finally {
      this.release(connection);
    }
  }
}

// =============================================================================
// 5. CONFIGURATION INTERFACE
// =============================================================================

export interface SQLitePoolConfig {
  dbPath?: string;
  maxConnections?: number;
  minConnections?: number;
  acquireTimeout?: number;
  idleTimeout?: number;
  readonly?: boolean;
  verbose?: boolean;
}

// =============================================================================
// 6. SINGLETON INSTANCE
// =============================================================================

let poolInstance: SQLiteConnectionPool | null = null;

/**
 * Get singleton connection pool instance
 */
export function getConnectionPool(config?: SQLitePoolConfig): SQLiteConnectionPool {
  if (!poolInstance) {
    poolInstance = new SQLiteConnectionPool(config);
  }
  return poolInstance;
}

/**
 * Reset singleton instance (mainly for testing)
 */
export async function resetConnectionPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.drain();
    poolInstance = null;
  }
}
