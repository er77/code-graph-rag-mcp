/**
 * TASK-20250105-VBA-JAVA-GO-PHASE2: Go Analyzer Tests
 *
 * Test suite for Go language analyzer functionality
 */

import { GoAnalyzer } from "../../src/parsers/go-analyzer";
import { TreeSitterParser } from "../../src/parsers/tree-sitter-parser";

describe("GoAnalyzer", () => {
  let parser: TreeSitterParser;
  let analyzer: GoAnalyzer;

  beforeAll(async () => {
    parser = new TreeSitterParser();
    await parser.initialize();
    analyzer = new GoAnalyzer();
  });

  it("should parse basic Go functions and packages", async () => {
    const code = `
package main

import (
  "fmt"
  "strings"
)

func add(a int, b int) int {
  return a + b
}

func PrintResult(value int) {
  fmt.Printf("Result: %d\\n", value)
}

func main() {
  result := add(5, 3)
  PrintResult(result)
}
    `;

    const filePath = "basic.go";
    const result = await parser.parse(filePath, code, "go-hash-2");

    expect(result.entities).toBeDefined();
    expect(result.entities.length).toBeGreaterThan(0);

    // Check for package
    const packages = result.entities.filter((e) => e.type === "module");
    expect(packages.length).toBe(1);
    expect(packages[0].name).toBe("main");

    // Check for functions
    const functionNames = result.entities.filter((e) => e.type === "function").map((e) => e.name);
    expect(functionNames).toContain("add");
    expect(functionNames).toContain("PrintResult");
    expect(functionNames).toContain("main");

    // Check for exported function (starts with capital)
    const printFunc = result.entities.find((e) => e.name === "PrintResult");
    expect(printFunc?.metadata?.isPublic).toBe(true);

    // Check for private function
    const addFunc = result.entities.find((e) => e.name === "add");
    expect(addFunc?.metadata?.isPublic).toBe(false);

    // Check for imports
    expect(result.relationships).toBeDefined();
    const imports = result.relationships?.filter((r) => r.type === "imports");
    expect(imports?.length).toBeGreaterThan(0);
    const importPaths = imports?.map((i) => i.to);
    expect(importPaths).toContain("fmt");
    expect(importPaths).toContain("strings");
  });

  it("should parse structs and interfaces", async () => {
    const code = `
package models

type Point struct {
  X int
  Y int
}

type Shape interface {
  Area() float64
  Perimeter() float64
}

type Rectangle struct {
  TopLeft Point
  BottomRight Point
}

func (r *Rectangle) Area() float64 {
  width := r.BottomRight.X - r.TopLeft.X
  height := r.BottomRight.Y - r.TopLeft.Y
  return float64(width * height)
}
    `;

    const filePath = "models.go";
    const result = await parser.parse(filePath, code, "go-hash-3");

    // Check for structs
    const structs = result.entities.filter((e) => e.type === "class");
    expect(structs.length).toBeGreaterThan(0);

    // Check for specific struct
    const pointStruct = result.entities.find((e) => e.name === "Point");
    expect(pointStruct).toBeDefined();
    expect(pointStruct?.type).toBe("class");

    // Check for struct fields
    const fields = result.entities.filter((e) => e.type === "property" && e.metadata?.parent?.includes("Point"));
    expect(fields.length).toBe(2);
    const fieldNames = fields.map((f) => f.name);
    expect(fieldNames).toContain("X");
    expect(fieldNames).toContain("Y");

    // Check for interfaces
    const interfaces = result.entities.filter((e) => e.type === "interface");
    expect(interfaces.length).toBeGreaterThan(0);

    const shapeInterface = result.entities.find((e) => e.name === "Shape");
    expect(shapeInterface).toBeDefined();

    // Check for methods
    const methods = result.entities.filter((e) => e.type === "method");
    expect(methods.length).toBeGreaterThan(0);

    const areaMethod = result.entities.find((e) => e.name === "Area" && e.type === "method");
    expect(areaMethod).toBeDefined();
    expect(areaMethod?.metadata?.receiver).toBe("Rectangle");
  });

  it("should parse constants and variables", async () => {
    const code = `
package config

const (
  Version = "1.0.0"
  MaxConnections = 100
  DefaultTimeout = 30
)

var (
  ServerName = "api-server"
  Port = 8080
)

const PI = 3.14159
var globalCounter int
    `;

    const filePath = "config.go";
    const result = await parser.parse(filePath, code, "go-hash-4");

    // Check for constants
    const constants = result.entities.filter((e) => e.type === "constant");
    expect(constants.length).toBeGreaterThan(0);

    const versionConst = result.entities.find((e) => e.name === "Version" && e.type === "constant");
    expect(versionConst).toBeDefined();
    expect(versionConst?.metadata?.value).toBe('"1.0.0"');

    // Check for variables
    const variables = result.entities.filter((e) => e.type === "variable");
    expect(variables.length).toBeGreaterThan(0);

    const serverNameVar = result.entities.find((e) => e.name === "ServerName" && e.type === "variable");
    expect(serverNameVar).toBeDefined();
    expect(serverNameVar?.metadata?.isPublic).toBe(true);

    const globalCounterVar = result.entities.find((e) => e.name === "globalCounter" && e.type === "variable");
    expect(globalCounterVar).toBeDefined();
    expect(globalCounterVar?.metadata?.isPublic).toBe(false);
  });

  it("should parse type aliases and embedded types", async () => {
    const code = `
package types

type UserID int64
type Username string

type User struct {
  ID UserID
  Name Username
}

type Admin struct {
  User // Embedded type
  Permissions []string
}
    `;

    const filePath = "types.go";
    const result = await parser.parse(filePath, code, "go-hash-5");

    // Check for type aliases
    const typedefs = result.entities.filter((e) => e.type === "typedef");
    expect(typedefs.length).toBeGreaterThan(0);

    const userIDType = result.entities.find((e) => e.name === "UserID" && e.type === "typedef");
    expect(userIDType).toBeDefined();

    // Check for struct embedding relationship
    const embedRelations = result.relationships?.filter((r) => r.type === "embeds");
    expect(embedRelations?.length).toBeGreaterThan(0);

    const adminEmbeds = embedRelations?.find((r) => r.from.includes("Admin"));
    expect(adminEmbeds).toBeDefined();
    expect(adminEmbeds?.to).toContain("User");
  });

  it("should handle goroutines and channels", async () => {
    const code = `
package concurrent

func ProcessItems(items []string) {
  ch := make(chan string, len(items))

  for _, item := range items {
    go func(s string) {
      // Process item in goroutine
      processed := processItem(s)
      ch <- processed
    }(item)
  }

  for i := 0; i < len(items); i++ {
    result := <-ch
    handleResult(result)
  }
}

func processItem(item string) string {
  return item
}

func handleResult(result string) {
  // Handle result
}
    `;

    const filePath = "concurrent.go";
    const result = await parser.parse(filePath, code, "go-hash-5");

    // Check for function calls (including goroutine calls)
    const callRelations = result.relationships?.filter((r) => r.type === "calls");
    expect(callRelations?.length).toBeGreaterThan(0);

    // Check that processItem and handleResult functions are detected
    const functions = result.entities.filter((e) => e.type === "function");
    const functionNames = functions.map((f) => f.name);
    expect(functionNames).toContain("ProcessItems");
    expect(functionNames).toContain("processItem");
    expect(functionNames).toContain("handleResult");
  });
});
