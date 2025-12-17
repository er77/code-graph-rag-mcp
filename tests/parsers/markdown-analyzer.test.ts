import { describe, expect, it } from "@jest/globals";
import { TreeSitterParser } from "../../src/parsers/tree-sitter-parser";

describe("Markdown indexing (TreeSitterParser)", () => {
  it("extracts document + headings with contains relationships", async () => {
    const parser = new TreeSitterParser();
    await parser.initialize();

    const md = `# Title

Some text

## Section A
### Sub A1
`;

    const result = await parser.parse("README.md", md, "md-hash-1");

    expect(result.language).toBe("markdown");
    expect(result.entities.some((e) => e.type === "document")).toBe(true);
    expect(result.entities.some((e) => e.type === "heading" && e.name === "Title")).toBe(true);
    expect(result.entities.some((e) => e.type === "heading" && e.name === "Section A")).toBe(true);
    expect(result.relationships?.some((r) => r.type === "contains")).toBe(true);
  });
});
