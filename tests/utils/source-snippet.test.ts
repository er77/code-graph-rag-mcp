import { describe, expect, it } from "@jest/globals";
import { extractSourceSnippetFromText } from "../../src/utils/source-snippet.js";

describe("extractSourceSnippetFromText", () => {
  it("extracts a snippet with context lines", () => {
    const text = ["l1", "l2", "l3", "l4", "l5", "l6"].join("\n");
    const res = extractSourceSnippetFromText({ text, startLine: 3, endLine: 4, contextLines: 1, maxBytes: 1000 });

    expect(res.snippet).toBe(["l2", "l3", "l4", "l5"].join("\n"));
    expect(res.snippetRange).toEqual({ startLine: 2, endLine: 5 });
    expect(res.entityRange).toEqual({ startLine: 3, endLine: 4 });
    expect(res.truncated).toBe(false);
  });

  it("truncates large snippets by maxBytes", () => {
    const text = "a".repeat(10_000);
    const res = extractSourceSnippetFromText({ text, startLine: 1, endLine: 1, contextLines: 0, maxBytes: 1024 });
    expect(res.truncated).toBe(true);
    expect(res.snippet.length).toBeLessThanOrEqual(1024);
  });
});
