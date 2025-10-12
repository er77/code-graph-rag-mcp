/**
 * Graph Storage Factory - Singleton GraphStorage instance
 *
 * Ensures all components use the same GraphStorageImpl instance
 * to prevent database state mismatch issues.
 *
 * TASK-034: Fix circular bug by ensuring single GraphStorage instance
 */

import { GraphStorageImpl } from "./graph-storage.js";
import { runMigrations } from "./schema-migrations.js";
import type { SQLiteManager } from "./sqlite-manager.js";
import { getSQLiteManager } from "./sqlite-manager.js";

let graphStorage: GraphStorageImpl | null = null;
let boundManager: SQLiteManager | null = null;

export async function getGraphStorage(sqliteManager?: SQLiteManager): Promise<GraphStorageImpl> {
  const manager = sqliteManager ?? getSQLiteManager();

  const needNewInstance = !graphStorage || boundManager !== manager;
  if (needNewInstance) {
    console.log("[GraphStorageFactory] Creating NEW GraphStorage singleton instance");
    if (!manager.isOpen()) {
      manager.initialize();
    }
    runMigrations(manager);
    const storage = new GraphStorageImpl(manager);
    graphStorage = storage;
    boundManager = manager;

    await storage.initialize();
    return storage;
  }

  console.log("[GraphStorageFactory] Returning EXISTING GraphStorage singleton instance");

  const storage = graphStorage as GraphStorageImpl;
  await storage.initialize();
  return storage;
}

export async function initializeGraphStorage(sqliteManager: SQLiteManager): Promise<GraphStorageImpl> {
  return getGraphStorage(sqliteManager);
}

export function resetGraphStorage(): void {
  graphStorage = null;
  boundManager = null;
}
