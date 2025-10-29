import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runJscpdCloneDetection } from "../../src/tools/jscpd.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(currentDir, "../fixtures/jscpd-clones");

describe("JSCPD clone detection tool", () => {
  it("detects duplicated code blocks within fixtures", async () => {
    const result = await runJscpdCloneDetection({
      paths: [fixtureRoot],
      formats: ["ts"],
      minTokens: 5,
      minLines: 3,
    });

    expect(result.clones.length).toBeGreaterThan(0);
    expect(result.summary.cloneCount).toBeGreaterThan(0);
    expect(result.summary.totalLinesAnalyzed).toBeGreaterThan(0);
    expect(result.summary.duplicatedLines).toBeGreaterThan(0);
    const firstDetail = result.summary.clones[0];
    expect(firstDetail).toBeDefined();
    expect(firstDetail?.snippetA.length ?? 0).toBeGreaterThan(0);
    expect(firstDetail?.snippetB.length ?? 0).toBeGreaterThan(0);

    const firstClone = result.clones[0];
    expect(firstClone.duplicationA.sourceId).toContain("alpha.ts");
    expect(firstClone.duplicationB.sourceId).toContain("beta.ts");
    expect(result.statistic.total.clones).toBeGreaterThan(0);
  });
});
