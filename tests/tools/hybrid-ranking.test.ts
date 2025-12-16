import { describe, expect, it } from "@jest/globals";
import { rerankSemanticHits } from "../../src/tools/hybrid-ranking.js";

describe("rerankSemanticHits", () => {
  it("boosts hits that match structural file set", () => {
    const hits = [
      { id: "1", similarity: 0.9, metadata: { path: "/a.ts" }, content: "A" },
      { id: "2", similarity: 0.92, metadata: { path: "/b.ts" }, content: "B" },
    ];
    const structural = new Set<string>(["/a.ts"]);
    const ranked = rerankSemanticHits(hits as any, structural, (p) => p);

    expect((ranked[0]!.hit as any).id).toBe("1");
    expect(ranked[0]!.rankingSignals.structuralBoost).toBeGreaterThan(0);
  });
});
