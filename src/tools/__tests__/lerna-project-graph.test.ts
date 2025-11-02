import { getLernaProjectGraph } from "../lerna-project-graph.js";

describe("getLernaProjectGraph", () => {
  it("returns missing-config when the workspace lacks lerna setup", async () => {
    const result = await getLernaProjectGraph(process.cwd());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing-config");
      expect(result.message).toMatch(/No lerna\.json/);
      expect(result.cached ?? false).toBe(false);

      const cachedResult = await getLernaProjectGraph(process.cwd());
      expect(cachedResult.ok).toBe(false);
      if (!cachedResult.ok) {
        expect(cachedResult.reason).toBe("missing-config");
        expect(cachedResult.cached).toBe(true);

        const forcedResult = await getLernaProjectGraph(process.cwd(), { force: true });
        expect(forcedResult.ok).toBe(false);
        if (!forcedResult.ok) {
          expect(forcedResult.reason).toBe("missing-config");
          expect(forcedResult.cached ?? false).toBe(false);
        }
      }
    }
  });
});
