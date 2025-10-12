/**
 * TASK-002: Database Connection Pool
 *
 * Manages SQLite database connections with pooling for optimal performance.
 * Implements connection acquisition, release, and health checking.
 *
 * External Dependencies:
 * - better-sqlite3: https://github.com/WiseLibs/better-sqlite3 - SQLite3 bindings
 *
 * Architecture References:
 * - Query Types: src/types/query.ts
 * - SQLite Manager: src/storage/sqlite-manager.ts
 *
 * @task_id TASK-002
 * @coding_standard Adheres to: doc/CODING_STANDARD.md
 * @history
 *  - 2025-01-14: Created by Dev-Agent - TASK-002: Initial ConnectionPool implementation
 */

import { EventEmitter } from "node:events";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type Database from "better-sqlite3";
import type { SQLiteManager } from "../storage/sqlite-manager.js";
import type { ConnectionPoolConfig } from "../types/query.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const DEFAULT_CONFIG: ConnectionPoolConfig = {
  maxConnections: 4, // Optimal for 4-core CPU
  minConnections: 1,
  acquireTimeout: 5000, // 5 seconds
  idleTimeout: 30000, // 30 seconds
  connectionTestInterval: 60000, // 1 minute
};

// =============================================================================
// 3. CONNECTION POOL IMPLEMENTATION
// =============================================================================

export class ConnectionPool extends EventEmitter {
  private config: ConnectionPoolConfig;
  private connections: PooledConnection[] = [];
  private waitingQueue: Array<{
    resolve: (conn: Database.Database) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private isShuttingDown = false;
  private testInterval?: NodeJS.Timeout;
  private sqliteManager: SQLiteManager;

  constructor(config: Partial<ConnectionPoolConfig> & { sqliteManager: SQLiteManager }) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sqliteManager = config.sqliteManager;
    console.log("[ConnectionPool] Using provided SQLiteManager");
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    if (this.connections.length > 0) {
      throw new Error("Connection pool already initialized");
    }

    console.log(
      `[ConnectionPool] Initializing with ${this.config.minConnections}-${this.config.maxConnections} connections`,
    );

    // Create minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      const connection = this.createConnection(`conn-${i}`);
      this.connections.push(connection);
    }

    // Start health check interval
    this.startHealthCheck();

    this.emit("initialized", {
      connections: this.connections.length,
      config: this.config,
    });
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<Database.Database> {
    if (this.isShuttingDown) {
      throw new Error("Connection pool is shutting down");
    }

    // Try to get an available connection
    const connection = this.getAvailableConnection();

    if (connection) {
      connection.inUse = true;
      connection.lastUsed = Date.now();
      this.emit("connection:acquired", { id: connection.id });
      return connection.db;
    }

    // Create new connection if under limit
    if (this.connections.length < this.config.maxConnections) {
      const newConnection = this.createConnection(`conn-${this.connections.length}`);
      newConnection.inUse = true;
      newConnection.lastUsed = Date.now();
      this.connections.push(newConnection);

      this.emit("connection:created", { id: newConnection.id });
      this.emit("connection:acquired", { id: newConnection.id });

      return newConnection.db;
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from waiting queue
        const index = this.waitingQueue.findIndex((w) => w.resolve === resolve);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
        }

        reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeout}ms`));
      }, this.config.acquireTimeout);

      const waiter = {
        resolve: (conn: Database.Database) => {
          clearTimeout(timeoutId);
          resolve(conn);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timestamp: Date.now(),
      };

      this.waitingQueue.push(waiter);
      this.emit("connection:waiting", { queueLength: this.waitingQueue.length });
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(db: Database.Database): void {
    const connection = this.connections.find((c) => c.db === db);

    if (!connection) {
      console.warn("[ConnectionPool] Attempted to release unknown connection");
      return;
    }

    if (!connection.inUse) {
      console.warn(`[ConnectionPool] Connection ${connection.id} was not in use`);
      return;
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();

    this.emit("connection:released", { id: connection.id });

    // Process waiting queue
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!;
      connection.inUse = true;
      connection.lastUsed = Date.now();

      waiter.resolve(connection.db);
      this.emit("connection:acquired", {
        id: connection.id,
        waitTime: Date.now() - waiter.timestamp,
      });
    }

    // Check if connection should be closed due to idle timeout
    this.scheduleIdleCheck();
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    inUse: number;
    available: number;
    waiting: number;
    created: number;
    closed: number;
  } {
    const inUse = this.connections.filter((c) => c.inUse).length;
    const available = this.connections.filter((c) => !c.inUse).length;

    return {
      total: this.connections.length,
      inUse,
      available,
      waiting: this.waitingQueue.length,
      created: this.connections.filter((c) => c.db).length,
      closed: this.connections.filter((c) => !c.db).length,
    };
  }

  /**
   * Test all connections
   */
  async testConnections(): Promise<{
    healthy: number;
    unhealthy: number;
    repaired: number;
  }> {
    let healthy = 0;
    let unhealthy = 0;
    let repaired = 0;

    for (const connection of this.connections) {
      if (connection.inUse) {
        continue; // Skip connections in use
      }

      try {
        // Test connection with simple query
        connection.db.prepare("SELECT 1").get();
        healthy++;
      } catch (error) {
        unhealthy++;
        console.warn(`[ConnectionPool] Connection ${connection.id} is unhealthy:`, error);

        // Try to repair connection
        try {
          connection.db.close();
          connection.db = this.sqliteManager.getConnection();
          repaired++;
          console.log(`[ConnectionPool] Connection ${connection.id} repaired`);
        } catch (repairError) {
          console.error(`[ConnectionPool] Failed to repair connection ${connection.id}:`, repairError);
        }
      }
    }

    this.emit("health:checked", { healthy, unhealthy, repaired });

    return { healthy, unhealthy, repaired };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    console.log("[ConnectionPool] Shutting down...");
    this.isShuttingDown = true;

    // Stop health checks
    if (this.testInterval) {
      clearInterval(this.testInterval);
      this.testInterval = undefined;
    }

    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      waiter.reject(new Error("Connection pool is shutting down"));
    }
    this.waitingQueue = [];

    // Wait for all connections to be released (with timeout)
    const timeout = 5000;
    const startTime = Date.now();

    while (this.connections.some((c) => c.inUse)) {
      if (Date.now() - startTime > timeout) {
        console.warn("[ConnectionPool] Force closing connections in use");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Close all connections
    for (const connection of this.connections) {
      try {
        connection.db.close();
      } catch (error) {
        console.error(`[ConnectionPool] Error closing connection ${connection.id}:`, error);
      }
    }

    this.connections = [];
    this.emit("shutdown");

    console.log("[ConnectionPool] Shutdown complete");
  }

  // =============================================================================
  // 4. HELPER METHODS
  // =============================================================================

  private createConnection(id: string): PooledConnection {
    this.sqliteManager.initialize();
    const db = this.sqliteManager.getConnection();

    // Apply optimizations
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("cache_size = -64000"); // 64MB
    db.pragma("temp_store = MEMORY");
    db.pragma("mmap_size = 30000000000"); // 30GB

    return {
      id,
      db,
      inUse: false,
      created: Date.now(),
      lastUsed: Date.now(),
    };
  }

  private getAvailableConnection(): PooledConnection | null {
    return this.connections.find((c) => !c.inUse) || null;
  }

  private scheduleIdleCheck(): void {
    // Check for idle connections that can be closed
    if (this.connections.length > this.config.minConnections) {
      setTimeout(() => {
        this.closeIdleConnections();
      }, this.config.idleTimeout);
    }
  }

  private closeIdleConnections(): void {
    const now = Date.now();
    const toClose: PooledConnection[] = [];

    for (const connection of this.connections) {
      if (
        !connection.inUse &&
        this.connections.length > this.config.minConnections &&
        now - connection.lastUsed > this.config.idleTimeout
      ) {
        toClose.push(connection);
      }
    }

    for (const connection of toClose) {
      try {
        connection.db.close();
        const index = this.connections.indexOf(connection);
        if (index > -1) {
          this.connections.splice(index, 1);
        }

        this.emit("connection:closed", {
          id: connection.id,
          reason: "idle_timeout",
        });

        console.log(`[ConnectionPool] Closed idle connection ${connection.id}`);
      } catch (error) {
        console.error(`[ConnectionPool] Error closing connection ${connection.id}:`, error);
      }
    }
  }

  private startHealthCheck(): void {
    this.testInterval = setInterval(() => {
      this.testConnections().catch((error) => {
        console.error("[ConnectionPool] Health check failed:", error);
      });
    }, this.config.connectionTestInterval);
  }
}

// =============================================================================
// 5. TYPE DEFINITIONS
// =============================================================================

interface PooledConnection {
  id: string;
  db: Database.Database;
  inUse: boolean;
  created: number;
  lastUsed: number;
}
