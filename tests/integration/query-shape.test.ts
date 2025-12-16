import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";

describe("query tool output contract", () => {
  it("includes Page<T>-shaped semantic + structural within data", () => {
    const src = readFileSync(join(process.cwd(), "src", "index.ts"), "utf8");
    expect(src).toContain('case "query"');
    expect(src).toContain("semantic: {");
    expect(src).toContain("items:");
    expect(src).toContain("nextCursor");
    expect(src).toContain("structural: {");
    expect(src).toContain("stats:");
  });
});
