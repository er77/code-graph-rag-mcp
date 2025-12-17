import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { collectIndexableFiles, DEFAULT_INDEX_EXCLUDE_PATTERNS } from "../../src/utils/index-file-collection.js";

describe("collectIndexableFiles", () => {
  it("includes markdown by default and respects default excludes", () => {
    const root = mkdtempSync(join(tmpdir(), "cgr-index-"));

    mkdirSync(join(root, "docs"), { recursive: true });
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, "node_modules", "left-pad"), { recursive: true });

    writeFileSync(join(root, "docs", "readme.md"), "# Hello\n");
    writeFileSync(join(root, "src", "app.ts"), "export const x = 1;\n");
    writeFileSync(join(root, "node_modules", "left-pad", "index.js"), "module.exports = {};\n");
    writeFileSync(join(root, "notes.txt"), "ignore me\n");

    const result = collectIndexableFiles(root, [...DEFAULT_INDEX_EXCLUDE_PATTERNS]);
    const rel = (p: string) =>
      p
        .slice(root.length + 1)
        .split("\\")
        .join("/");

    const relPaths = new Set(result.files.map(rel));
    expect(relPaths.has("docs/readme.md")).toBe(true);
    expect(relPaths.has("src/app.ts")).toBe(true);
    expect(relPaths.has("node_modules/left-pad/index.js")).toBe(false);
    expect(relPaths.has("notes.txt")).toBe(false);

    expect(result.stats.includedFiles).toBe(result.files.length);
    expect(result.stats.scannedFiles).toBeGreaterThanOrEqual(result.files.length);
  });
});
