import type { GraphStorageImpl } from "../storage/graph-storage.js";
import type { Entity, Relationship } from "../types/storage.js";

export type ListEntityRelationshipsResult = {
  root: Entity;
  nodes: Map<string, Entity>;
  relationships: Relationship[];
  depthUsed: number;
  relationshipTypesUsed: string[] | null;
};

export async function listEntityRelationshipsTraversal(
  storage: GraphStorageImpl,
  root: Entity,
  options: { depth?: number; relationshipTypes?: string[] },
): Promise<ListEntityRelationshipsResult> {
  const maxDepth = Math.max(1, Math.min(10, Number(options.depth ?? 1) || 1));
  const typeFilter = options.relationshipTypes?.length ? new Set(options.relationshipTypes) : null;

  const visited = new Set<string>();
  const queue: Array<{ id: string; level: number }> = [{ id: root.id, level: 0 }];
  const allRelationships: Relationship[] = [];
  const relSeen = new Set<string>();

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const rels = await storage.getRelationshipsForEntity(current.id);
    for (const rel of rels) {
      if (typeFilter && !typeFilter.has(rel.type)) continue;
      const key = rel.id || `${rel.fromId}|${rel.toId}|${rel.type}`;
      if (!relSeen.has(key)) {
        relSeen.add(key);
        allRelationships.push(rel);
      }

      const neighborId = rel.fromId === current.id ? rel.toId : rel.fromId;
      if (!neighborId || visited.has(neighborId)) continue;
      if (current.level + 1 <= maxDepth) {
        queue.push({ id: neighborId, level: current.level + 1 });
      }
    }
  }

  const nodes = new Map<string, Entity>();
  for (const id of visited) {
    const e = id === root.id ? root : await storage.getEntity(id);
    if (e) nodes.set(id, e);
  }

  return {
    root,
    nodes,
    relationships: allRelationships,
    depthUsed: maxDepth,
    relationshipTypesUsed: typeFilter ? Array.from(typeFilter) : null,
  };
}
