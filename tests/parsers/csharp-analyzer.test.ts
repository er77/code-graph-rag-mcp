/**
 * TASK-20251005185121: C# Analyzer Test Suite
 *
 * Comprehensive tests for C# language analyzer
 * Validates entity extraction, relationship mapping, and pattern recognition
 *
 * @task_id TASK-20251005185121
 * @created 2025-10-05
 */

import { beforeAll, describe, expect, it } from "@jest/globals";
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

      expect(result.entities.some((e) => e.type === "interface")).toBe(true);
    });

    it("should extract structs", async () => {
      const mockNode = createMockNode("struct_declaration", "TestStruct");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.entities.some((e) => e.type === "struct")).toBe(true);
    });

    it("should extract enums", async () => {
      const mockNode = createMockNode("enum_declaration", "TestEnum");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.entities.some((e) => e.type === "enum")).toBe(true);
    });

    it("should extract methods with modifiers", async () => {
      const mockNode = createMockClassWithMethod("TestMethod", ["public", "async"]);
      const result = await analyzer.analyze(mockNode, "test.cs");

      const method = result.entities.find((e) => e.type === "method" && e.name === "TestMethod");
      expect(method).toBeDefined();
      expect(method?.metadata?.isAsync).toBe(true);
    });

    it("should extract properties", async () => {
      const mockNode = createMockClassWithProperty("TestProperty", "string", { get: true, set: true });
      const result = await analyzer.analyze(mockNode, "test.cs");

      const property = result.entities.find((e) => e.type === "property" && e.name === "TestProperty");
      expect(property).toBeDefined();
      expect(property?.metadata?.propertyType).toBe("string");
    });

    it("should extract records (C# 9+)", async () => {
      const mockNode = createMockNode("record_declaration", "TestRecord");
      const result = await analyzer.analyze(mockNode, "test.cs");

      const rec = result.entities.find((e) => e.name === "TestRecord" && e.metadata?.isRecord === true);
      expect(rec).toBeDefined();
      expect(rec?.type).toBe("class");
    });

    it("should extract delegates", async () => {
      const mockNode = createMockNode("delegate_declaration", "TestDelegate");
      const result = await analyzer.analyze(mockNode, "test.cs");

      const del = result.entities.find((e) => e.name === "TestDelegate" && e.metadata?.csharpKind === "delegate");
      expect(del).toBeDefined();
      expect(del?.type).toBe("typedef");
    });
  });

  describe("Relationship Extraction", () => {
    it("should extract inheritance relationships", async () => {
      const mockNode = createMockInheritanceNode("DerivedClass", "BaseClass");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0].type).toBe("extends");
    });

    it("should extract interface implementations", async () => {
      const mockNode = createMockImplementationNode("TestClass", "ITestInterface");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.relationships.some((r) => r.type === "extends")).toBe(true);
    });
  });

  describe("Pattern Recognition", () => {
    it("should identify Singleton pattern", async () => {
      const mockNode = createMockSingletonNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const singletonPattern = result.patterns.designPatterns.find((p) => p.pattern === "singleton");
      expect(singletonPattern).toBeDefined();
      expect(singletonPattern?.confidence).toBeGreaterThan(0.9);
    });

    it("should identify Repository pattern", async () => {
      const mockNode = createMockRepositoryNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const repoPattern = result.patterns.otherPatterns?.find((p) => p.kind === "repository");
      expect(repoPattern).toBeDefined();
    });

    it("should identify async/await patterns", async () => {
      const mockNode = createMockClassWithMethod("AsyncMethod", ["public", "async"]);
      const result = await analyzer.analyze(mockNode, "test.cs");

      const asyncPattern = result.patterns.otherPatterns?.find((p) => p.kind === "async_await");
      expect(asyncPattern).toBeDefined();
    });

    it("should identify LINQ patterns", async () => {
      const mockNode = createMockLINQNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.patterns.otherPatterns?.some((p) => p.kind === "linq_query" || p.kind === "linq_method")).toBe(
        true,
      );
    });

    it("should identify Dependency Injection patterns", async () => {
      const mockNode = createMockDINode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const diPattern = result.patterns.otherPatterns?.find((p) => p.kind === "constructor_injection");
      expect(diPattern).toBeDefined();
    });
  });

  describe("C# Specific Features", () => {
    it("should extract partial classes", async () => {
      const mockNode = createMockPartialClassNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const partialClass = result.entities.find((e) => e.type === "class" && e.name === "PartialClass");
      expect(partialClass?.metadata?.isPartial).toBe(true);
    });

    it("should extract extension methods", async () => {
      const mockNode = createMockClassWithMethod("ExtensionMethod", ["public", "static"]);
      const result = await analyzer.analyze(mockNode, "test.cs");

      const method = result.entities.find((e) => e.type === "method" && e.name === "ExtensionMethod");
      expect(method?.metadata?.modifiers).toContain("static");
    });

    it("should extract attributes", async () => {
      const mockNode = createMockAttributedClassNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      const entity = result.entities.find((e) => e.type === "class" && e.name === "AttributedClass");
      expect(entity?.metadata?.attributes).toContain("Serializable");
    });

    it("should extract events", async () => {
      const mockNode = createMockClassWithEvent("TestEvent", "EventHandler");
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.entities.some((e) => e.type === "event" && e.name === "TestEvent")).toBe(true);
    });

    it("should extract using statements", async () => {
      const mockNode = createMockUsingNode();
      const result = await analyzer.analyze(mockNode, "test.cs");

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].type).toBe("import");
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

// ===== Helpers

function makeNode(type: string, text = ""): TreeSitterNode {
  const n: any = {
    type,
    text,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: text.length },
    startIndex: 0,
    endIndex: text.length,
    childCount: 0,
    namedChildCount: 0,
    child: (_i: number) => null,
    namedChild: (_i: number) => null,
    parent: null,
    nextSibling: null,
    prevSibling: null,
    namedChildren: [] as TreeSitterNode[],
    children: [] as TreeSitterNode[],
    childForFieldName: (_field: string) => null,
  };
  return n as unknown as TreeSitterNode;
}

function createIdentifierNode(name: string): TreeSitterNode {
  return makeNode("identifier", name);
}

function createModifierNode(text: string): TreeSitterNode {
  return makeNode("modifier", text);
}

function createMockNode(type: string, name: string): TreeSitterNode {
  const node = makeNode(type, name);
  node.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode(name);
    return null;
  };
  return node;
}

function createMockClassWithMethod(methodName: string, modifiers: string[]): TreeSitterNode {
  const cls = createMockNode("class_declaration", "Container");
  const method = makeNode("method_declaration", methodName);

  method.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode(methodName);
    if (field === "type") return createIdentifierNode("void");
    if (field === "parameters") {
      const list = makeNode("parameter_list", "()");
      list.childCount = 0;
      list.child = () => null;
      return list;
    }
    return null;
  };
  method.childCount = modifiers.length;
  method.child = (index: number) => (index < modifiers.length ? createModifierNode(modifiers[index]) : null);

  cls.childCount = 1;
  cls.child = (i: number) => (i === 0 ? method : null);
  return cls;
}

function createMockClassWithProperty(
  name: string,
  type: string,
  access: { get?: boolean; set?: boolean; init?: boolean } = {},
): TreeSitterNode {
  const cls = createMockNode("class_declaration", "Container");
  const prop = makeNode("property_declaration", name);

  const accessors = makeNode("accessor_list", "");
  const accs: TreeSitterNode[] = [];
  if (access.get) accs.push(makeNode("get_accessor", "get"));
  if (access.set) accs.push(makeNode("set_accessor", "set"));
  if (access.init) accs.push(makeNode("init_accessor", "init"));
  accessors.childCount = accs.length;
  accessors.child = (i: number) => accs[i] ?? null;

  prop.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode(name);
    if (field === "type") return createIdentifierNode(type);
    if (field === "accessors") return accessors;
    return null;
  };

  cls.childCount = 1;
  cls.child = (i: number) => (i === 0 ? prop : null);
  return cls;
}

function createParameterNode(name: string, type: string): TreeSitterNode {
  const param = makeNode("parameter", `${type} ${name}`);
  param.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode(name);
    if (field === "type") return createIdentifierNode(type);
    return null;
  };
  return param;
}

function createParametersList(params: Array<{ name: string; type: string }>): TreeSitterNode {
  const list = makeNode("parameter_list", "");
  const paramNodes = params.map((p) => createParameterNode(p.name, p.type));
  list.childCount = paramNodes.length;
  list.child = (i: number) => paramNodes[i] ?? null;
  return list;
}

function createMockInheritanceNode(derived: string, base: string): TreeSitterNode {
  const node = createMockNode("class_declaration", derived);

  const baseTypeNode = makeNode("base_type", base);
  const baseList = makeNode("base_list", "");
  baseList.childCount = 1;
  baseList.child = () => baseTypeNode;

  node.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode(derived);
    if (field === "bases") return baseList;
    return null;
  };

  return node;
}

function createMockImplementationNode(className: string, interfaceName: string): TreeSitterNode {
  return createMockInheritanceNode(className, interfaceName);
}

function createMockSingletonNode(): TreeSitterNode {
  const cls = createMockNode("class_declaration", "SingletonClass");

  // Static Instance property
  const prop = makeNode("property_declaration", "Instance");
  prop.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode("Instance");
    if (field === "type") return createIdentifierNode("SingletonClass");
    if (field === "accessors") {
      const accessors = makeNode("accessor_list", "");
      accessors.childCount = 1;
      accessors.child = () => makeNode("get_accessor", "get");
      return accessors;
    }
    return null;
  };
  prop.childCount = 1;
  prop.child = (i: number) => (i === 0 ? createModifierNode("static") : null);

  // "Constructor" as method with private modifier
  const ctor = makeNode("method_declaration", "SingletonClass");
  ctor.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode("SingletonClass");
    if (field === "type") return createIdentifierNode("void");
    if (field === "parameters") return createParametersList([]);
    return null;
  };
  ctor.childCount = 1;
  ctor.child = (i: number) => (i === 0 ? createModifierNode("private") : null);

  cls.childCount = 2;
  cls.child = (i: number) => (i === 0 ? prop : i === 1 ? ctor : null);

  return cls;
}

function createMockRepositoryNode(): TreeSitterNode {
  const cls = createMockNode("class_declaration", "UserRepository");

  const createMethod = makeNode("method_declaration", "Create");
  createMethod.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode("Create");
    if (field === "type") return createIdentifierNode("void");
    if (field === "parameters") return createParametersList([]);
    return null;
  };

  const getMethod = makeNode("method_declaration", "Get");
  getMethod.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode("Get");
    if (field === "type") return createIdentifierNode("void");
    if (field === "parameters") return createParametersList([]);
    return null;
  };

  cls.childCount = 2;
  cls.child = (i: number) => (i === 0 ? createMethod : i === 1 ? getMethod : null);

  return cls;
}

function createMockLINQNode(): TreeSitterNode {
  return makeNode("query_expression", "");
}

function createMockDINode(): TreeSitterNode {
  const cls = createMockNode("class_declaration", "ServiceClass");
  const ctor = makeNode("method_declaration", "ServiceClass");
  ctor.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode("ServiceClass");
    if (field === "type") return createIdentifierNode("void");
    if (field === "parameters") return createParametersList([{ name: "logger", type: "ILogger" }]);
    return null;
  };
  cls.childCount = 1;
  cls.child = (i: number) => (i === 0 ? ctor : null);
  return cls;
}

function createMockPartialClassNode(): TreeSitterNode {
  const cls = createMockNode("class_declaration", "PartialClass");
  cls.childCount = 1;
  cls.child = (i: number) => (i === 0 ? createModifierNode("partial") : null);
  return cls;
}

function createMockAttributedClassNode(): TreeSitterNode {
  const cls = createMockNode("class_declaration", "AttributedClass");

  const attribute = makeNode("attribute", "Serializable");
  attribute.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode("Serializable");
    return null;
  };

  const attrList = makeNode("attribute_list", "");
  attrList.childCount = 1;
  attrList.child = (i: number) => (i === 0 ? attribute : null);

  cls.childCount = 1;
  cls.child = (i: number) => (i === 0 ? attrList : null);

  return cls;
}

function createMockClassWithEvent(name: string, type: string): TreeSitterNode {
  const cls = createMockNode("class_declaration", "Container");
  const evt = makeNode("event_declaration", name);
  evt.childForFieldName = (field: string) => {
    if (field === "name") return createIdentifierNode(name);
    if (field === "type") return createIdentifierNode(type);
    return null;
  };
  cls.childCount = 1;
  cls.child = (i: number) => (i === 0 ? evt : null);
  return cls;
}

function createMockUsingNode(): TreeSitterNode {
  const node = makeNode("using_directive", "");
  node.childForFieldName = (field: string) => {
    if (field === "name") return makeNode("qualified_name", "System");
    return null;
  };
  return node;
}

function createMockComplexNode(): TreeSitterNode {
  const node = makeNode("compilation_unit", "");
  const childs: TreeSitterNode[] = [
    createMockNode("class_declaration", "Class1"),
    createMockNode("interface_declaration", "Interface1"),
    createMockNode("struct_declaration", "Struct1"),
    createMockNode("enum_declaration", "Enum1"),
  ];
  node.childCount = childs.length;
  node.child = (i: number) => childs[i] ?? null;
  return node;
}
