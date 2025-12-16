/**
 * Tool for querying the graph database directly via GraphStorage API
 */

import type { GraphStorageImpl } from "../storage/graph-storage.js";
import type { Entity, Relationship } from "../types/storage.js";

function likePattern(input: string): string {
  // Minimal escaping for LIKE; wrap with % for contains semantics
  const escaped = input.replace(/[%_]/g, (m) => `\\${m}`);
  return `%${escaped}%`;
}

export async function queryGraphEntities(
  storage: GraphStorageImpl,
  query?: string,
  limit: number = 100,
  offset: number = 0,
): Promise<{
  entities: Entity[];
  relationships: Relationship[];
  stats: {
    totalEntities: number;
    totalRelationships: number;
  };
}> {
  // Use the storage’s executeQuery to avoid raw SQL
  const q = await storage.executeQuery({
    type: "entity",
    limit,
    offset,
    filters: query
      ? {
          // Pass LIKE-compatible pattern via RegExp source consumed by storage
          name: new RegExp(likePattern(query)),
        }
      : undefined,
  });

  return {
    entities: q.entities,
    relationships: q.relationships,
    stats: {
      totalEntities: q.stats.totalEntities,
      totalRelationships: q.stats.totalRelationships,
    },
  };
}

export async function getGraphStats(storage: GraphStorageImpl): Promise<{
  entities: { total: number; byType: Record<string, number> };
  relationships: { total: number; byType: Record<string, number> };
  files: { total: number };
}> {
  // Use storage metrics for reliable totals; byType left empty to avoid raw SQL
  const metrics = await storage.getMetrics();
  return {
    entities: { total: metrics.totalEntities, byType: {} },
    relationships: { total: metrics.totalRelationships, byType: {} },
    files: { total: metrics.totalFiles },
  };
}
