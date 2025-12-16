import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";

describe("query tool paging and ranking signals (source-level)", () => {
  it("includes paging metadata and matchType annotation", () => {
    const src = readFileSync(join(process.cwd(), "src", "index.ts"), "utf8");
    expect(src).toContain('case "query":');
    expect(src).toContain("paging:");
    expect(src).toContain("matchType");
    expect(src).toContain("cursor:");
    expect(src).toContain("pageSize:");
  });
});
