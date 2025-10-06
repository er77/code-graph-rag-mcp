/**
 * PythonAnalyzer Test Suite
 *
 * Tests for the Python code analyzer methods.
 */

import { describe, expect, test, beforeEach } from "@jest/globals";
import { PythonAnalyzer } from "../python-analyzer.js";

describe("PythonAnalyzer", () => {
  let analyzer: PythonAnalyzer;

  beforeEach(() => {
    analyzer = new PythonAnalyzer();
    // Reset static dependency cache before each test
    (PythonAnalyzer as any).dependencyCache = new Map<string, Set<string>>();
  });

  describe("resolveImportPath", () => {
    test.each([
      { importModule: "package.sub.mod", fromFile: "pkg/sub/module.py", expected: "package/sub/mod" },
      { importModule: ".utils",          fromFile: "pkg/sub/module.py", expected: "pkg/sub/utils" },
      { importModule: "..core",          fromFile: "pkg/sub/module.py", expected: "pkg/core" },
      { importModule: "...",             fromFile: "pkg/sub/module.py", expected: "pkg" },
      { importModule: ".",               fromFile: "pkg/sub/module.py", expected: "pkg/sub" },
      { importModule: ".utils",          fromFile: "pkg\\sub\\module.py", expected: "pkg/sub/utils" },
    ])("maps importModule '$importModule' from '$fromFile' to '$expected'", ({ importModule, fromFile, expected }) => {
      const result = (analyzer as any).resolveImportPath(importModule, fromFile);
      expect(result).toBe(expected);
    });

    test("returns undefined for empty importModule", () => {
      const result = (analyzer as any).resolveImportPath("", "pkg/sub/module.py");
      expect(result).toBeUndefined();
    });
  });

  describe("resolveClassPath", () => {
    test.each([
      { className: "pkg.mod.BaseClass", fromFile: "pkg/sub/module.py", expected: "pkg/mod" },
      { className: "BaseClass",         fromFile: "pkg/sub/module.py", expected: "pkg/sub/module" },
      { className: "top.level.Name",    fromFile: "anything/here.py",   expected: "top/level" },
      { className: "",                  fromFile: "pkg/sub/module.py",  expected: "pkg/sub/module" },
    ])("maps className '$className' from '$fromFile' to '$expected'", ({ className, fromFile, expected }) => {
      const result = (analyzer as any).resolveClassPath(className, fromFile);
      expect(result).toBe(expected);
    });
  });

  describe("cached dependencies and cycles", () => {
    test("addCachedDependencies merges cached deps and seeds cache for current file", () => {
      // Pre-seed cache with C -> D
      (PythonAnalyzer as any).dependencyCache.set("C", new Set(["D"]));

      // Graph for file A: A -> B
      const graphA = new Map<string, Set<string>>();
      graphA.set("A", new Set(["B"]));
      (analyzer as any).addCachedDependencies(graphA, "A");

      // Cache should contain edges A -> B
      const cache = (PythonAnalyzer as any).dependencyCache;
      expect(cache.get("A") instanceof Set).toBe(true);
      expect(cache.get("A")!.has("B")).toBe(true);

      // Graph should also include cached edges C -> D
      expect(graphA.get("C") instanceof Set).toBe(true);
      expect(graphA.get("C")!.has("D")).toBe(true);
    });

    test("findAllCycles detects cycle across two files using cache (A <-> B)", () => {
      // Step 1: analyze A -> B and cache it
      const graphA = new Map<string, Set<string>>();
      graphA.set("A", new Set(["B"]));
      (analyzer as any).addCachedDependencies(graphA, "A");

      // Step 2: analyze B -> A and merge cached A -> B
      const graphB = new Map<string, Set<string>>();
      graphB.set("B", new Set(["A"]));
      (analyzer as any).addCachedDependencies(graphB, "B");

      // Ensure cycle edges exist
      expect(graphB.get("A")?.has("B")).toBe(true);
      expect(graphB.get("B")?.has("A")).toBe(true);

      const cycles = (analyzer as any).findAllCycles(graphB);
      expect(cycles.length).toBeGreaterThan(0);

      const hasAB = cycles.some((c: any) => {
        const nodes = new Set(c.path);
        return nodes.has("A") && nodes.has("B");
      });
      expect(hasAB).toBe(true);
    });
  });

  describe("detectCircularDependencies integration", () => {
    const mkImp = (sourceFile: string, targetModule: string) => ({
      sourceFile,
      targetModule,
      importType: "absolute",
      symbols: [],
      line: 1,
      isUsed: false,
      usageLocations: [],
    });

    test("import cycle A <-> B is detected", () => {
      // 1) Analyze A.py first to seed cache A -> B
      const contextA: any = {
        filePath: "A.py",
        imports: [mkImp("A.py", "B")],
        classes: new Map(),
        relationships: [],
      };
      (analyzer as any).buildDependencyGraph(contextA);

      // 2) Now analyze B.py with import A (cycle B -> A)
      const contextB: any = {
        filePath: "B.py",
        imports: [mkImp("B.py", "A")],
        classes: new Map(),
        relationships: [],
      };

      const results = (analyzer as any).detectCircularDependencies(contextB);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Should classify as "import" and severity "error" for short cycle
      expect(results.some((r: any) => r.type === "import")).toBe(true);
      expect(results.some((r: any) => r.severity === "error")).toBe(true);

      // Cycle includes A and B
      const hasAB = results.some((r: any) => {
        const set = new Set(r.cycle);
        return set.has("A") && set.has("B");
      });
      expect(hasAB).toBe(true);
    });

    test("inheritance cycle classification when B derives from A.Base", () => {
      // 1) Seed cache with A -> B
      const contextA: any = {
        filePath: "A.py",
        imports: [mkImp("A.py", "B")],
        classes: new Map(),
        relationships: [],
      };
      (analyzer as any).buildDependencyGraph(contextA);

      // 2) B -> A and B has class Sub(A.Base)
      const classesB = new Map<string, any>([
        [
          "Sub",
          {
            classType: "regular",
            baseClasses: ["A.Base"], 
            mro: [],
            abstractMethods: [],
            magicMethods: [],
            properties: [],
            classDecorators: [],
            methods: [],
            location: undefined,
          },
        ],
      ]);

      const contextB: any = {
        filePath: "B.py",
        imports: [mkImp("B.py", "A")],
        classes: classesB,
        relationships: [],
      };

      const results = (analyzer as any).detectCircularDependencies(contextB);
      expect(results.length).toBeGreaterThan(0);

      // Prefer "inheritance" classification when inheritance is present
      expect(results.some((r: any) => r.type === "inheritance")).toBe(true);
    });

    test("reference cycle classification when graph comes from cache only", () => {
      // 1) Manually seed cache with a cycle A <-> B
      (PythonAnalyzer as any).dependencyCache = new Map<string, Set<string>>([
        ["A", new Set(["B"])],
        ["B", new Set(["A"])],
      ]);

      // 2) Context without imports, but with a references relationship B -> A
      const contextRef: any = {
        filePath: "B.py",
        imports: [],
        classes: new Map(),
        relationships: [
          {
            from: "B",
            to: "A",
            type: "references",
            sourceFile: "B",
            targetFile: "A",
          },
        ],
      };

      const results = (analyzer as any).detectCircularDependencies(contextRef);
      expect(results.length).toBeGreaterThan(0);

      // No imports and no inheritance => should classify as "reference"
      expect(results.some((r: any) => r.type === "reference")).toBe(true);
    });
  });
});