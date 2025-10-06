/**
 * Graph Storage Factory - Singleton GraphStorage instance
 *
 * Ensures all components use the same GraphStorageImpl instance
 * to prevent database state mismatch issues.
 *
 * TASK-034: Fix circular bug by ensuring single GraphStorage instance
 */

import { GraphStorageImpl } from './graph-storage.js';
import { getSQLiteManager } from './sqlite-manager.js';
import { runMigrations } from './schema-migrations.js';

// Global singleton instance
let graphStorage: GraphStorageImpl | null = null;

/**
 * Get the singleton GraphStorage instance
 * Used by both IndexerAgent and MCP tools to ensure consistent database state
 */
export async function getGraphStorage(): Promise<GraphStorageImpl> {
  if (!graphStorage) {
    console.log('[GraphStorageFactory] Creating NEW GraphStorage singleton instance');
    // Use singleton SQLiteManager to ensure same database connection
    const sqliteManager = getSQLiteManager();
    sqliteManager.initialize();

    // Run database migrations to ensure tables exist
    runMigrations(sqliteManager);

    // Create single GraphStorageImpl instance
    graphStorage = new GraphStorageImpl(sqliteManager);
  } else {
    console.log('[GraphStorageFactory] Returning EXISTING GraphStorage singleton instance');
  }
  // Ensure storage is ready (re-prepare statements if manager was reset)
  await graphStorage.initialize();
  return graphStorage;
}

/**
 * Reset the singleton (used for testing)
 */
export function resetGraphStorage(): void {
  graphStorage = null;
}