import { TreeSitterParser } from "../../src/parsers/tree-sitter-parser";
import type { EntityRelationship } from "../../src/types/parser";

describe("KotlinAnalyzer", () => {
  let parser: TreeSitterParser;

  beforeAll(async () => {
    parser = new TreeSitterParser();
    await parser.initialize();
  });

  afterEach(() => {
    parser.clearCache();
  });

  it("extracts Kotlin entities and relationships", async () => {
    const code = `
      package p.q

      import kotlin.collections.List
      import kotlin.io.println as p

      typealias Str = String

      interface I {
        fun f(): Int
      }

      data class A(val x: Int) : I {
        companion object {
          const val CONST = 1
        }

        override fun f(): Int {
          g()
          return x
        }
      }

      fun g() { p("hi") }

      fun Int.ext(): Int = this + 1
    `;

    const res = await parser.parse("sample.kt", code, "hash");
    expect(res.language).toBe("kotlin");

    const ids = new Set(res.entities.map((e) => e.id));

    expect(ids.has("sample.kt:package:p.q")).toBe(true);
    expect(ids.has("sample.kt:typealias:Str")).toBe(true);
    expect(ids.has("sample.kt:class:I")).toBe(true);
    expect(ids.has("sample.kt:class:A")).toBe(true);
    expect(ids.has("sample.kt:class:A:property:x")).toBe(true);
    expect(ids.has("sample.kt:class:A.Companion:property:CONST")).toBe(true);
    expect(ids.has("sample.kt:class:A:method:f")).toBe(true);
    expect(ids.has("sample.kt:function:g")).toBe(true);

    const relationships = (res as any).relationships as EntityRelationship[] | undefined;
    expect(relationships?.some((r) => r.type === "imports" && r.to.includes("kotlin.collections.List"))).toBe(true);
    expect(
      relationships?.some((r) => r.type === "calls" && r.from === "sample.kt:class:A:method:f" && r.to === "g"),
    ).toBe(true);
  });
});
