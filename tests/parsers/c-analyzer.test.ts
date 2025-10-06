/**
 * TASK-20251005191500: C Analyzer Tests
 *
 * Test suite for C language analyzer functionality
 */

import { CAnalyzer } from "../../src/parsers/c-analyzer";
import { TreeSitterParser } from "../../src/parsers/tree-sitter-parser";
import path from "path";

describe("CAnalyzer", () => {
  let parser: TreeSitterParser;
  let analyzer: CAnalyzer;

  beforeAll(async () => {
    parser = new TreeSitterParser();
    await parser.initialize();
    analyzer = new CAnalyzer();
  });

  it("should parse basic C functions", async () => {
    const code = `
#include <stdio.h>

int add(int a, int b) {
  return a + b;
}

static void print_result(int value) {
  printf("Result: %d\\n", value);
}

int main() {
  int result = add(5, 3);
  print_result(result);
  return 0;
}
    `;

    const filePath = "test.c";
    const result = await parser.parse(filePath, code, "test-hash");

    expect(result.entities).toBeDefined();
    expect(result.entities.length).toBeGreaterThan(0);

    // Check for functions
    const functionNames = result.entities.filter(e => e.type === "function").map(e => e.name);
    expect(functionNames).toContain("add");
    expect(functionNames).toContain("print_result");
    expect(functionNames).toContain("main");

    // Check for static modifier
    const printFunc = result.entities.find(e => e.name === "print_result");
    expect(printFunc?.modifiers).toContain("static");

    // Check for includes
    expect(result.relationships).toBeDefined();
    const includes = result.relationships?.filter(r => r.type === "imports");
    expect(includes?.length).toBeGreaterThan(0);
    expect(includes?.[0].to).toBe("stdio.h");
  });

  it("should parse structs and enums", async () => {
    const code = `
typedef struct {
  int x;
  int y;
} Point;

enum Color {
  RED,
  GREEN,
  BLUE
};

struct Rectangle {
  Point topLeft;
  Point bottomRight;
  enum Color fillColor;
};
    `;

    const filePath = "test.c";
    const result = await parser.parse(filePath, code, "test-hash");

    // Check for structs
    const structs = result.entities.filter(e => e.type === "class");
    expect(structs.length).toBeGreaterThan(0);

    // Check for struct with fields
    const rectangle = result.entities.find(e => e.name === "struct Rectangle");
    expect(rectangle).toBeDefined();
    expect(rectangle?.children).toBeDefined();
    expect(rectangle?.children?.length).toBeGreaterThan(0);

    // Check for enums
    const enums = result.entities.filter(e => e.type === "enum");
    expect(enums.length).toBeGreaterThan(0);

    const colorEnum = result.entities.find(e => e.name === "enum Color");
    expect(colorEnum).toBeDefined();
    expect(colorEnum?.children).toBeDefined();
    expect(colorEnum?.children?.map(c => c.name)).toContain("RED");
    expect(colorEnum?.children?.map(c => c.name)).toContain("GREEN");
    expect(colorEnum?.children?.map(c => c.name)).toContain("BLUE");

    // Check for typedef
    const typedefs = result.entities.filter(e => e.type === "type");
    expect(typedefs.length).toBeGreaterThan(0);
  });

  it("should parse macros and preprocessor directives", async () => {
    const code = `
#define MAX_SIZE 100
#define MIN(a, b) ((a) < (b) ? (a) : (b))

#ifdef DEBUG
  #define LOG(msg) printf("Debug: %s\\n", msg)
#else
  #define LOG(msg)
#endif

const int buffer_size = MAX_SIZE;
    `;

    const filePath = "test.c";
    const result = await parser.parse(filePath, code, "test-hash");

    // Check for macros
    const macros = result.entities.filter(e => e.name.startsWith("#define"));
    expect(macros.length).toBeGreaterThan(0);

    expect(result.entities.some(e => e.name === "#define MAX_SIZE")).toBe(true);
    expect(result.entities.some(e => e.name === "#define MIN()")).toBe(true);

    // Check for constant
    const constants = result.entities.filter(e => e.type === "constant");
    expect(constants.some(c => c.name === "buffer_size")).toBe(true);
  });

  it("should handle unions", async () => {
    const code = `
union Data {
  int i;
  float f;
  char str[20];
};
    `;

    const filePath = "test.c";
    const result = await parser.parse(filePath, code, "test-hash");

    // Check for union
    const unions = result.entities.filter(e => e.name.startsWith("union"));
    expect(unions.length).toBe(1);
    expect(unions[0].name).toBe("union Data");
  });

  it("should handle function pointers and complex declarations", async () => {
    const code = `
typedef int (*compare_func)(const void*, const void*);

int compare_ints(const void* a, const void* b) {
  return *(int*)a - *(int*)b;
}

void qsort_wrapper(void* base, size_t num, size_t size, compare_func cmp) {
  // Implementation
}
    `;

    const filePath = "test.c";
    const result = await parser.parse(filePath, code, "test-hash");

    // Check for typedef of function pointer
    const typedefs = result.entities.filter(e => e.type === "type");
    expect(typedefs.some(t => t.name === "compare_func")).toBe(true);

    // Check for functions
    const functions = result.entities.filter(e => e.type === "function");
    expect(functions.some(f => f.name === "compare_ints")).toBe(true);
    expect(functions.some(f => f.name === "qsort_wrapper")).toBe(true);
  });

  it("should handle inline and extern functions", async () => {
    const code = `
inline int max(int a, int b) {
  return a > b ? a : b;
}

extern void external_function(int param);

extern int global_variable;
    `;

    const filePath = "test.c";
    const result = await parser.parse(filePath, code, "test-hash");

    // Check for inline function
    const maxFunc = result.entities.find(e => e.name === "max");
    expect(maxFunc).toBeDefined();
    expect(maxFunc?.modifiers).toContain("inline");

    // Check for extern function
    const externFunc = result.entities.find(e => e.name === "external_function");
    expect(externFunc).toBeDefined();
    expect(externFunc?.modifiers).toContain("extern");

    // Check for extern variable
    const externVar = result.entities.find(e => e.name === "global_variable");
    expect(externVar).toBeDefined();
  });

  it("should respect circuit breaker for deeply nested structures", async () => {
    // Create a deeply nested structure that would trigger circuit breaker
    let code = "#include <stdio.h>\n";
    for (let i = 0; i < 60; i++) {
      code += `struct Level${i} {\n`;
    }
    for (let i = 0; i < 60; i++) {
      code += `};\n`;
    }

    const filePath = "test.c";

    // Should not throw, but return partial results
    const result = await parser.parse(filePath, code, "test-hash");
    expect(result).toBeDefined();
    expect(result.entities).toBeDefined();
  });

  it("should handle multiple includes", async () => {
    const code = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "local_header.h"
#include "../other/header.h"
    `;

    const filePath = "test.c";
    const result = await parser.parse(filePath, code, "test-hash");

    // Check relationships for includes
    expect(result.relationships).toBeDefined();
    const includes = result.relationships?.filter(r => r.type === "imports");
    expect(includes?.length).toBe(5);

    const includePaths = includes?.map(i => i.to);
    expect(includePaths).toContain("stdio.h");
    expect(includePaths).toContain("stdlib.h");
    expect(includePaths).toContain("string.h");
    expect(includePaths).toContain("local_header.h");
    expect(includePaths).toContain("../other/header.h");
  });
});