import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";

function getIndexSource(): string {
  return readFileSync(join(process.cwd(), "src", "index.ts"), "utf8");
}

function expectRegex(src: string, pattern: RegExp) {
  expect(pattern.test(src)).toBe(true);
}

describe("Core tool handlers use response envelope helpers", () => {
  it("wraps core success paths via toolOk()", () => {
    const src = getIndexSource();

    expectRegex(src, /if \(name === "get_version"\)[\s\S]*?asMcpJson\(\s*toolOk\(/);
    expectRegex(src, /case "index":[\s\S]*?asMcpJson\(\s*toolOk\(/);
    expectRegex(src, /case "batch_index":[\s\S]*?asMcpJson\(\s*toolOk\(/);
    expectRegex(src, /case "semantic_search":[\s\S]*?asMcpJson\(\s*toolOk\(/);
    expectRegex(src, /case "query":[\s\S]*?asMcpJson\(\s*toolOk\(/);
    expectRegex(src, /case "get_graph":[\s\S]*?asMcpJson\(\s*toolOk\(/);
    expectRegex(src, /case "get_graph_health":[\s\S]*?asMcpJson\(\s*toolOk\(/);
  });

  it("wraps failure paths via toolFail()", () => {
    const src = getIndexSource();

    expect(src).toContain('toolFail("agent_busy"');
    expect(src).toContain('toolFail("tool_error"');
  });
});
