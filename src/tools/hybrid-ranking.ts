export type HybridRankedHit<T> = {
  hit: T;
  finalScore: number;
  rankingSignals: { semanticScore: number; structuralBoost: number };
};

export function rerankSemanticHits<
  T extends { metadata?: any; similarity?: number; score?: number; path?: string; filePath?: string },
>(hits: T[], structuralFileSet: Set<string>, normalizePath: (p: string) => string): HybridRankedHit<T>[] {
  return hits
    .map((hit) => {
      const meta = hit.metadata ?? {};
      const rawPath = String(meta?.path ?? hit.path ?? hit.filePath ?? "");
      const normalizedPath = rawPath ? normalizePath(rawPath) : "";
      const semanticScore = Number(hit.similarity ?? hit.score ?? 0) || 0;
      const structuralBoost = normalizedPath && structuralFileSet.has(normalizedPath) ? 0.15 : 0;
      return { hit, finalScore: semanticScore + structuralBoost, rankingSignals: { semanticScore, structuralBoost } };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}
