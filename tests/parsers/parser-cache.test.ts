import { TreeSitterParser } from "../../src/parsers/tree-sitter-parser";

describe("TreeSitterParser cache isolation by internal content hash", () => {
  let parser: TreeSitterParser;

  beforeAll(async () => {
    parser = new TreeSitterParser();
    await parser.initialize();
  });

  afterEach(() => {
    parser.clearCache();
  });

  it("should not return cached result for same filePath and same external hash if content differs", async () => {
    const filePath = "test.c";
    const extHash = "same-hash";

    const code1 = `
#include <stdio.h>
int add(int a, int b) { return a + b; }
`;

    const code2 = `
#include <stdlib.h>
int sub(int a, int b) { return a - b; }
`;

    const r1 = await parser.parse(filePath, code1, extHash);
    const r2 = await parser.parse(filePath, code2, extHash);

    
    const f1 = r1.entities.find((e) => e.type === "function" && e.name === "add");
    const f2 = r2.entities.find((e) => e.type === "function" && e.name === "sub");
    expect(f1).toBeDefined();
    expect(f2).toBeDefined();

    const inc1 = (r1.relationships || []).filter((rel) => rel.type === "imports").map((rel) => rel.to);
    const inc2 = (r2.relationships || []).filter((rel) => rel.type === "imports").map((rel) => rel.to);
    expect(inc1).toContain("stdio.h");
    expect(inc2).toContain("stdlib.h");
  });
});