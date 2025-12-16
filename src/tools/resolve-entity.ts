import { dirname } from "node:path";
import type { GraphStorageImpl } from "../storage/graph-storage.js";
import type { Entity, EntityType } from "../types/storage.js";

export type ResolveEntityCandidate = { entity: Entity; score: number; reasons: string[] };

export async function resolveEntityCandidates(options: {
  storage: GraphStorageImpl;
  name: string;
  filePathHint?: string;
  entityTypes?: EntityType[];
  limit: number;
}): Promise<ResolveEntityCandidate[]> {
  const { storage, name, filePathHint, entityTypes, limit } = options;
  const exactName = name.trim();
  const candidates: Entity[] = [];

  const exactQuery = await storage.executeQuery({
    type: "entity",
    filters: {
      ...(entityTypes ? { entityType: entityTypes } : {}),
      name: new RegExp(`^${escapeRegExp(exactName)}$`, "i"),
    },
    limit: 50,
  });
  candidates.push(...exactQuery.entities);

  if (candidates.length < limit) {
    const fuzzyQuery = await storage.executeQuery({
      type: "entity",
      filters: {
        ...(entityTypes ? { entityType: entityTypes } : {}),
        name: new RegExp(escapeRegExp(exactName), "i"),
      },
      limit: 200,
    });
    for (const e of fuzzyQuery.entities) {
      if (!candidates.some((c) => c.id === e.id)) candidates.push(e);
    }
  }

  const hintDir = filePathHint ? dirname(filePathHint) : undefined;
  return candidates
    .map((e) => {
      const reasons: string[] = [];
      let score = 0;

      if (e.name.toLowerCase() === exactName.toLowerCase()) {
        score += 100;
        reasons.push("exact_name");
      } else if (e.name.toLowerCase().includes(exactName.toLowerCase())) {
        score += 50;
        reasons.push("name_contains");
      }

      if (filePathHint && e.filePath === filePathHint) {
        score += 60;
        reasons.push("file_hint_exact");
      } else if (hintDir && e.filePath.startsWith(hintDir)) {
        score += 20;
        reasons.push("file_hint_dir");
      }

      score += Math.max(0, 10 - Math.min(10, Math.floor((e.location?.start?.line ?? 0) / 1000)));

      return { entity: e, score, reasons };
    })
    .sort((a, b) => b.score - a.score || String(a.entity.filePath).localeCompare(String(b.entity.filePath)));
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
