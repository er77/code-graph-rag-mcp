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
let initialization: { manager: SQLiteManager; promise: Promise<GraphStorageImpl> } | null = null;

export async function getGraphStorage(sqliteManager?: SQLiteManager): Promise<GraphStorageImpl> {
  const manager = sqliteManager ?? getSQLiteManager();

  if (!graphStorage || boundManager !== manager) {
    if (initialization && initialization.manager === manager) {
      return initialization.promise;
    }

    const promise = (async () => {
      console.log("[GraphStorageFactory] Creating NEW GraphStorage singleton instance");
      if (!manager.isOpen()) {
        manager.initialize();
      }
      runMigrations(manager);
      graphStorage = new GraphStorageImpl(manager);
      boundManager = manager;
      await graphStorage.initialize();
      return graphStorage;
    })();

    initialization = { manager, promise };
    try {
      return await promise;
    } finally {
      if (initialization?.manager === manager) {
        initialization = null;
      }
    }
  }

  console.log("[GraphStorageFactory] Returning EXISTING GraphStorage singleton instance");

  await graphStorage.initialize();
  return graphStorage;
}

export async function initializeGraphStorage(sqliteManager: SQLiteManager): Promise<GraphStorageImpl> {
  return getGraphStorage(sqliteManager);
}

export function resetGraphStorage(): void {
  graphStorage = null;
  boundManager = null;
  initialization = null;
}
