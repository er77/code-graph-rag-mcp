/**
 * TASK-20251005185121: C# Analyzer Test Suite
 *
 * Comprehensive tests for C# language analyzer
 * Validates entity extraction, relationship mapping, and pattern recognition
 *
 * @task_id TASK-20251005185121
 * @created 2025-10-05
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import { CSharpAnalyzer } from "../../src/parsers/csharp-analyzer";
import type { TreeSitterNode } from "../../src/types/parser";

describe("CSharpAnalyzer", () => {
  let analyzer: CSharpAnalyzer;

  beforeAll(() => {
    analyzer = new CSharpAnalyzer();
  });

  describe("Entity Extraction", () => {
    it("should extract classes", async () => {
      const mockNode = createMockNode("class_declaration", "TestClass");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe("class");
      expect(result.entities[0].name).toBe("TestClass");
    });

    it("should extract interfaces", async () => {
      const mockNode = createMockNode("interface_declaration", "ITestInterface");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.entities.some(e => e.type === "interface")).toBe(true);
    });

    it("should extract structs", async () => {
      const mockNode = createMockNode("struct_declaration", "TestStruct");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.entities.some(e => e.type === "struct")).toBe(true);
    });

    it("should extract enums", async () => {
      const mockNode = createMockNode("enum_declaration", "TestEnum");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.entities.some(e => e.type === "enum")).toBe(true);
    });

    it("should extract methods with modifiers", async () => {
      const mockNode = createMockMethodNode("TestMethod", ["public", "async"]);
      const result = await analyzer.analyze(mockNode, "test.cs");

      const method = result.entities.find(e => e.type === "method");
      expect(method).toBeDefined();
      expect(method?.metadata?.isAsync).toBe(true);
    });

    it("should extract properties", async () => {
      const mockNode = createMockPropertyNode("TestProperty", "string");
      const result = await analyzer.analyze(mockNode, "test.cs");

      const property = result.entities.find(e => e.type === "property");
      expect(property).toBeDefined();
      expect(property?.metadata?.propertyType).toBe("string");
    });

    it("should extract records (C# 9+)", async () => {
      const mockNode = createMockNode("record_declaration", "TestRecord");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.entities.some(e => e.type === "record")).toBe(true);
    });

    it("should extract delegates", async () => {
      const mockNode = createMockNode("delegate_declaration", "TestDelegate");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.entities.some(e => e.type === "delegate")).toBe(true);
    });
  });

  describe("Relationship Extraction", () => {
    it("should extract inheritance relationships", async () => {
      const mockNode = createMockInheritanceNode("DerivedClass", "BaseClass");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0].type).toBe("inherits");
    });

    it("should extract interface implementations", async () => {
      const mockNode = createMockImplementationNode("TestClass", "ITestInterface");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.relationships.some(r => r.type === "inherits")).toBe(true);
    });
  });

  describe("Pattern Recognition", () => {
    it("should identify Singleton pattern", async () => {
      const mockNode = createMockSingletonNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const singletonPattern = result.patterns.find(p => p.type === "singleton");
      expect(singletonPattern).toBeDefined();
      expect(singletonPattern?.confidence).toBeGreaterThan(0.9);
    });

    it("should identify Repository pattern", async () => {
      const mockNode = createMockRepositoryNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const repoPattern = result.patterns.find(p => p.type === "repository");
      expect(repoPattern).toBeDefined();
    });

    it("should identify async/await patterns", async () => {
      const mockNode = createMockAsyncMethodNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const asyncPattern = result.patterns.find(p => p.type === "async_await");
      expect(asyncPattern).toBeDefined();
    });

    it("should identify LINQ patterns", async () => {
      const mockNode = createMockLINQNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.patterns.some(p => p.type === "linq_query" || p.type === "linq_method")).toBe(true);
    });

    it("should identify Dependency Injection patterns", async () => {
      const mockNode = createMockDINode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const diPattern = result.patterns.find(p => p.type === "constructor_injection");
      expect(diPattern).toBeDefined();
    });
  });

  describe("C# Specific Features", () => {
    it("should extract partial classes", async () => {
      const mockNode = createMockPartialClassNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const partialClass = result.entities.find(e => e.type === "class");
      expect(partialClass?.metadata?.isPartial).toBe(true);
    });

    it("should extract extension methods", async () => {
      const mockNode = createMockExtensionMethodNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const method = result.entities.find(e => e.type === "method");
      expect(method?.metadata?.modifiers).toContain("static");
    });

    it("should extract attributes", async () => {
      const mockNode = createMockAttributedClassNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const entity = result.entities.find(e => e.type === "class");
      expect(entity?.metadata?.attributes).toContain("Serializable");
    });

    it("should extract events", async () => {
      const mockNode = createMockEventNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.entities.some(e => e.type === "event")).toBe(true);
    });

    it("should extract using statements", async () => {
      const mockNode = createMockUsingNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].type).toBe("using");
    });
  });

  describe("Performance Metrics", () => {
    it("should track parsing metrics", async () => {
      const mockNode = createMockComplexNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.metrics.entitiesExtracted).toBeGreaterThan(0);
      expect(result.metrics.relationshipsFound).toBeGreaterThanOrEqual(0);
      expect(result.metrics.patternsIdentified).toBeGreaterThanOrEqual(0);
      expect(result.metrics.parseTime).toBeGreaterThan(0);
    });
  });
});

// Helper functions to create mock nodes for testing
function createMockNode(type: string, name: string): TreeSitterNode {
  return {
    type,
    text: name,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: name.length },
    childCount: 0,
    child: () => null,
    namedChildren: [],
    childForFieldName: (field: string) => {
      if (field === "name") {
        return { text: name, type: "identifier" } as TreeSitterNode;
      }
      return null;
    },
  } as TreeSitterNode;
}

function createMockMethodNode(name: string, modifiers: string[]): TreeSitterNode {
  const node = createMockNode("method_declaration", name);
  let modifierIndex = 0;
  node.child = (index: number) => {
    if (index < modifiers.length) {
      return { text: modifiers[index], type: "modifier" } as TreeSitterNode;
    }
    return null;
  };
  node.childCount = modifiers.length;
  return node;
}

function createMockPropertyNode(name: string, type: string): TreeSitterNode {
  const node = createMockNode("property_declaration", name);
  node.childForFieldName = (field: string) => {
    if (field === "name") return { text: name, type: "identifier" } as TreeSitterNode;
    if (field === "type") return { text: type, type: "predefined_type" } as TreeSitterNode;
    return null;
  };
  return node;
}

function createMockInheritanceNode(derived: string, base: string): TreeSitterNode {
  const node = createMockNode("class_declaration", derived);
  node.childForFieldName = (field: string) => {
    if (field === "name") return { text: derived, type: "identifier" } as TreeSitterNode;
    if (field === "bases") {
      return {
        type: "base_list",
        childCount: 1,
        child: () => ({ text: base, type: "base_type" } as TreeSitterNode),
      } as TreeSitterNode;
    }
    return null;
  };
  return node;
}

function createMockImplementationNode(className: string, interfaceName: string): TreeSitterNode {
  return createMockInheritanceNode(className, interfaceName);
}

function createMockSingletonNode(): TreeSitterNode {
  const node = createMockNode("class_declaration", "SingletonClass");
  // Add properties and methods that would indicate singleton pattern
  return node;
}

function createMockRepositoryNode(): TreeSitterNode {
  return createMockNode("class_declaration", "UserRepository");
}

function createMockAsyncMethodNode(): TreeSitterNode {
  return createMockMethodNode("AsyncMethod", ["public", "async"]);
}

function createMockLINQNode(): TreeSitterNode {
  const node = createMockNode("query_expression", "");
  node.type = "query_expression";
  return node;
}

function createMockDINode(): TreeSitterNode {
  const node = createMockNode("class_declaration", "ServiceClass");
  // Add constructor with interface parameters
  return node;
}

function createMockPartialClassNode(): TreeSitterNode {
  return createMockMethodNode("PartialClass", ["public", "partial"]);
}

function createMockExtensionMethodNode(): TreeSitterNode {
  return createMockMethodNode("ExtensionMethod", ["public", "static"]);
}

function createMockAttributedClassNode(): TreeSitterNode {
  const node = createMockNode("class_declaration", "AttributedClass");
  // Add attribute nodes
  return node;
}

function createMockEventNode(): TreeSitterNode {
  return createMockNode("event_declaration", "TestEvent");
}

function createMockUsingNode(): TreeSitterNode {
  const node = createMockNode("using_directive", "");
  node.childForFieldName = (field: string) => {
    if (field === "name") return { text: "System", type: "qualified_name" } as TreeSitterNode;
    return null;
  };
  return node;
}

function createMockComplexNode(): TreeSitterNode {
  // Create a complex node with multiple entities
  const node = createMockNode("compilation_unit", "");
  node.childCount = 5;
  node.child = (index: number) => {
    switch (index) {
      case 0: return createMockNode("class_declaration", "Class1");
      case 1: return createMockNode("interface_declaration", "Interface1");
      case 2: return createMockNode("struct_declaration", "Struct1");
      case 3: return createMockNode("enum_declaration", "Enum1");
      case 4: return createMockMethodNode("Method1", ["public"]);
      default: return null;
    }
  };
  return node;
}