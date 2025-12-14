import { TreeSitterParser } from "../../src/parsers/tree-sitter-parser";
import type { SupportedLanguage } from "../../src/types/parser";

describe("Language loaders resolve grammars correctly", () => {
  let parser: TreeSitterParser;

  beforeAll(async () => {
    parser = new TreeSitterParser();
    await parser.initialize();
  });

  afterEach(() => {
    parser.clearCache();
  });

  const samples: Array<{ file: string; code: string; expected: SupportedLanguage }> = [
    { file: "a.js", code: "export function f(){ return 1 }", expected: "javascript" },
    { file: "a.jsx", code: "export default function C(){ return <div/> }", expected: "jsx" },
    { file: "a.ts", code: "export function sum(a:number,b:number){return a+b}", expected: "typescript" },
    { file: "a.tsx", code: "export function C(){ return <div/> }", expected: "tsx" },
    { file: "a.py", code: "def foo(x):\n  return x", expected: "python" },
    { file: "a.c", code: "int main(){return 0;}", expected: "c" },
    { file: "a.cpp", code: "int main(){return 0;}", expected: "cpp" },
    { file: "a.rs", code: "fn main() {}", expected: "rust" },
    { file: "a.cs", code: "class A{ static void Main(){} }", expected: "csharp" },
    { file: "a.go", code: "package main\nfunc main(){}", expected: "go" },
    { file: "a.java", code: "class A { public static void main(String[] a){} }", expected: "java" },
    { file: "a.kt", code: "package p\nclass A { fun f(x:Int):Int { return x } }", expected: "kotlin" },
  ];

  it.each(samples)("loads grammar for %s and parses", async ({ file, code, expected }) => {
    const res = await parser.parse(file, code, "hash");
    expect(res.language).toBe(expected);
    if (
      expected === "javascript" ||
      expected === "jsx" ||
      expected === "typescript" ||
      expected === "tsx" ||
      expected === "kotlin"
    ) {
      expect(res.entities.length).toBeGreaterThan(0);
    }
  });
});
