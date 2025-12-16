import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";

describe("Tool response envelope (smoke)", () => {
  it("uses toolOk/toolFail helpers in dispatcher", () => {
    const src = readFileSync(join(process.cwd(), "src", "index.ts"), "utf8");
    expect(src).toContain("toolOk(");
    expect(src).toContain("toolFail(");
    expect(src).toContain('toolFail("agent_busy"');
    expect(src).toContain('toolFail("tool_error"');
  });
});
