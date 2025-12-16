import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";

function getIndexSource(): string {
  return readFileSync(join(process.cwd(), "src", "index.ts"), "utf8");
}

function sliceAfter(haystack: string, needle: string, maxLen = 1200): string {
  const idx = haystack.indexOf(needle);
  if (idx < 0) return "";
  return haystack.slice(idx, Math.min(haystack.length, idx + maxLen));
}

describe("MCP tool descriptions (agent guidance)", () => {
  it("includes structured guidance for core tools", () => {
    const src = getIndexSource();

    for (const toolName of [
      "index",
      "batch_index",
      "list_file_entities",
      "resolve_entity",
      "get_entity_source",
      "semantic_search",
      "query",
      "get_graph_health",
    ]) {
      const window = sliceAfter(src, `name: "${toolName}"`);
      expect(window).toContain("description:");
      expect(window).toContain("Use when:");
      expect(window).toContain("Typical flow:");
      expect(window).toContain("Output:");
    }
  });
});
