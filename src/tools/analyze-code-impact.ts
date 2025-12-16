import type { GraphStorageImpl } from "../storage/graph-storage.js";
import type { Relationship } from "../types/storage.js";

export type AnalyzeCodeImpactTraversal = {
  directDependents: Set<string>;
  transitiveDependents: Set<string>;
  outboundDependencies: Set<string>;
  depthUsed: number;
  rootRelationships: Relationship[];
};

export async function analyzeCodeImpactTraversal(
  storage: GraphStorageImpl,
  rootId: string,
  depth: number,
): Promise<AnalyzeCodeImpactTraversal> {
  const maxDepth = Math.max(1, Math.min(10, Number(depth ?? 2) || 2));
  const rootRels = await storage.getRelationshipsForEntity(rootId);

  const outboundIds = new Set<string>();
  const directIds = new Set<string>();

  for (const rel of rootRels) {
    if (rel.fromId === rootId) outboundIds.add(rel.toId);
    if (rel.toId === rootId) directIds.add(rel.fromId);
  }

  const visited = new Set<string>([rootId]);
  const queue: Array<{ id: string; level: number }> = Array.from(directIds).map((id) => ({ id, level: 1 }));
  for (const id of directIds) visited.add(id);

  const indirectIds = new Set<string>();

  while (queue.length) {
    const current = queue.shift()!;
    if (current.level >= maxDepth) continue;

    const rels = await storage.getRelationshipsForEntity(current.id);
    for (const rel of rels) {
      if (rel.toId !== current.id) continue;
      const dependentId = rel.fromId;
      if (!dependentId || visited.has(dependentId)) continue;
      visited.add(dependentId);
      const nextLevel = current.level + 1;
      if (nextLevel >= 2) indirectIds.add(dependentId);
      queue.push({ id: dependentId, level: nextLevel });
    }
  }

  return {
    directDependents: directIds,
    transitiveDependents: indirectIds,
    outboundDependencies: outboundIds,
    depthUsed: maxDepth,
    rootRelationships: rootRels,
  };
}
