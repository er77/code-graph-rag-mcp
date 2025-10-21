/**
 * TASK-20251005185121: Rust Analyzer Test Suite
 *
 * Comprehensive tests for Rust language analyzer
 * Validates entity extraction, relationship mapping, and pattern recognition
 *
 * @task_id TASK-20251005185121
 * @created 2025-10-05
 */

import { beforeAll, describe, expect, it } from "@jest/globals";
import { RustAnalyzer } from "../../src/parsers/rust-analyzer";
import type { TreeSitterNode } from "../../src/types/parser";

describe("RustAnalyzer", () => {
  let analyzer: RustAnalyzer;

  beforeAll(() => {
    analyzer = new RustAnalyzer();
  });

  describe("Entity Extraction", () => {
    it("should extract structs", async () => {
      const mockNode = createMockNode("struct_item", "TestStruct");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe("struct");
      expect(result.entities[0].name).toBe("TestStruct");
    });

    it("should extract enums", async () => {
      const mockNode = createMockNode("enum_item", "TestEnum");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some((e) => e.type === "enum")).toBe(true);
    });

    it("should extract traits", async () => {
      const mockNode = createMockNode("trait_item", "TestTrait");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some((e) => e.type === "trait")).toBe(true);
    });

    it("should extract functions", async () => {
      const mockNode = createMockFunctionNode("test_function", false, false);
      const result = await analyzer.analyze(mockNode, "test.rs");

      const func = result.entities.find((e) => e.type === "function");
      expect(func).toBeDefined();
      expect(func?.name).toBe("test_function");
    });

    it("should extract async functions", async () => {
      const mockNode = createMockFunctionNode("async_function", true, false);
      const result = await analyzer.analyze(mockNode, "test.rs");

      const func = result.entities.find((e) => e.type === "function");
      expect(func?.metadata?.isAsync).toBe(true);
    });

    it("should extract modules", async () => {
      const mockNode = createMockNode("mod_item", "test_module");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some((e) => e.type === "module")).toBe(true);
    });

    it("should extract type aliases", async () => {
      const mockNode = createMockNode("type_item", "MyType");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some((e) => e.type === "typedef")).toBe(true);
    });

    it("should extract constants", async () => {
      const mockNode = createMockNode("const_item", "MY_CONST");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some((e) => e.type === "constant")).toBe(true);
    });

    it("should extract static items", async () => {
      const mockNode = createMockNode("static_item", "MY_STATIC");
      const result = await analyzer.analyze(mockNode, "test.rs");

      const st = result.entities.find((e) => e.metadata?.isStatic);
      expect(st).toBeDefined();
    });

    it("should extract macros", async () => {
      const mockNode = createMockNode("macro_definition", "my_macro");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some((e) => e.type === "macro")).toBe(true);
    });
  });

  describe("Relationship Extraction", () => {
    it("should extract trait implementations", async () => {
      const mockNode = createMockImplNode("TestStruct", "TestTrait");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.relationships.some((r) => r.type === "implements")).toBe(true);
    });

    it("should extract trait extensions", async () => {
      const mockNode = createMockTraitExtensionNode("SubTrait", "SuperTrait");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.relationships.some((r) => r.type === "inherits")).toBe(true);
    });

    it("should extract module containment", async () => {
      const mockNode = createMockNestedModuleNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.relationships.some((r) => r.type === "contains")).toBe(true);
    });
  });

  describe("Rust-Specific Features", () => {
    it("should extract lifetimes", async () => {
      const mockNode = createMockLifetimeNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const entity = result.entities.find((e) => e.type === "struct");
      expect(entity?.metadata?.lifetimes).toContain("'a");
    });

    it("should extract generics", async () => {
      const mockNode = createMockGenericNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const entity = result.entities.find((e) => e.type === "struct");
      expect(entity?.metadata?.generics).toContain("T");
    });

    it("should extract derive macros", async () => {
      const mockNode = createMockDeriveNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const entity = result.entities.find((e) => e.type === "struct");
      expect(entity?.metadata?.derives).toContain("Debug");
      expect(entity?.metadata?.derives).toContain("Clone");
    });

    it("should extract visibility modifiers", async () => {
      const mockNode = createMockVisibilityNode("pub");
      const result = await analyzer.analyze(mockNode, "test.rs");

      const entity = result.entities[0];
      expect(entity?.metadata?.visibility).toBe("pub");
    });

    it("should extract unsafe functions", async () => {
      const mockNode = createMockFunctionNode("unsafe_function", false, true);
      const result = await analyzer.analyze(mockNode, "test.rs");

      const func = result.entities.find((e) => e.type === "function");
      expect(func?.metadata?.isUnsafe).toBe(true);
    });

    it("should extract enum variants", async () => {
      const mockNode = createMockEnumWithVariantsNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const enumEntity = result.entities.find((e) => e.type === "enum");
      expect(enumEntity?.metadata?.variants).toContain("Variant1");
      expect(enumEntity?.metadata?.variants).toContain("Variant2");
    });

    it("should extract struct fields", async () => {
      const mockNode = createMockStructWithFieldsNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some((e) => e.type === "field")).toBe(true);
    });

    it("should extract trait methods", async () => {
      const mockNode = createMockTraitWithMethodsNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const methods = result.entities.filter((e) => e.type === "method");
      expect(methods.length).toBeGreaterThan(0);
    });

    it("should extract associated types", async () => {
      const mockNode = createMockAssociatedTypeNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some((e) => e.type === "typedef")).toBe(true);
    });

    it("should extract use statements", async () => {
      const mockNode = createMockUseNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].type).toBe("use");
    });
  });

  describe("Pattern Recognition", () => {
    it("should identify Builder pattern", async () => {
      const mockNode = createMockBuilderNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const builderPattern = result.patterns.designPatterns.find((p) => p.pattern === "builder");
      expect(builderPattern).toBeDefined();
      expect(builderPattern?.confidence).toBeGreaterThan(0.9);
    });

    it("should identify Iterator pattern", async () => {
      const mockNode = createMockIteratorNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const iteratorPattern = result.patterns.designPatterns.find((p) => p.pattern === "iterator");
      expect(iteratorPattern).toBeDefined();
    });

    it("should identify Result error handling", async () => {
      const mockNode = createMockResultNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const resultPattern = result.patterns.otherPatterns?.find((p) => p.kind === "result_error_handling");
      expect(resultPattern).toBeDefined();
    });

    it("should identify borrowing patterns", async () => {
      const mockNode = createMockBorrowingNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const borrowPattern = result.patterns.otherPatterns?.find((p) => p.kind === "borrowing");
      expect(borrowPattern).toBeDefined();
    });

    it("should identify unsafe code blocks", async () => {
      const mockNode = createMockUnsafeNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const unsafePattern = result.patterns.otherPatterns?.find((p) => p.kind === "unsafe_code");
      expect(unsafePattern).toBeDefined();
    });

    it("should identify lifetime annotations", async () => {
      const mockNode = createMockLifetimeAnnotationNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const lifetimePattern = result.patterns.otherPatterns?.find((p) => p.kind === "lifetime_annotations");
      expect(lifetimePattern).toBeDefined();
    });
  });

  describe("Performance Metrics", () => {
    it("should track parsing metrics", async () => {
      const mockNode = createMockComplexNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

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
    startIndex: 0,
    endIndex: name.length,
    childCount: 0,
    child: () => null,
    namedChild: () => null,
    namedChildren: [],
    namedChildCount: 0,
    parent: null,
    nextSibling: null,
    previousSibling: null,
    firstChild: null,
    lastChild: null,
    firstNamedChild: null,
    lastNamedChild: null,
    descendantForPosition: () => ({}) as TreeSitterNode,
    descendantsOfType: () => [],
    children: [],
    childForFieldName: (field: string) => {
      if (field === "name") {
        return createMockNode("identifier", name);
      }
      return null;
    },
  };
}

function createMockFunctionNode(name: string, isAsync: boolean, isUnsafe: boolean): TreeSitterNode {
  const node = createMockNode("function_item", name);
  let modifierCount = 0;
  if (isAsync) modifierCount++;
  if (isUnsafe) modifierCount++;

  node.childCount = modifierCount;
  node.child = (index: number) => {
    if (isAsync && index === 0) return createMockNode("async", "async");
    if (isUnsafe && index === (isAsync ? 1 : 0)) return createMockNode("unsafe", "unsafe");
    return null;
  };
  return node;
}

function createMockImplNode(typeName: string, traitName: string): TreeSitterNode {
  const node = createMockNode("impl_item", "");
  node.childForFieldName = (field: string) => {
    if (field === "type") return createMockNode("type_identifier", typeName);
    if (field === "trait") return createMockNode("type_identifier", traitName);
    if (field === "body") {
      return {
        ...createMockNode("declaration_list", ""),
        childCount: 1,
        child: () => createMockNode("function_item", "next"),
      };
    }
    return null;
  };
  return node;
}

function createMockTraitExtensionNode(subTrait: string, superTrait: string): TreeSitterNode {
  const node = createMockNode("trait_item", subTrait);
  node.childForFieldName = (field: string) => {
    if (field === "name") return createMockNode("identifier", subTrait);
    if (field === "supertraits") {
      return {
        ...createMockNode("trait_bounds", ""),
        childCount: 1,
        child: () => createMockNode("type", superTrait),
      };
    }
    return null;
  };
  return node;
}

function createMockNestedModuleNode(): TreeSitterNode {
  const node = createMockNode("mod_item", "parent_module");
  node.childForFieldName = (field: string) => {
    if (field === "body") {
      return {
        ...createMockNode("declaration_list", ""),
        childCount: 1,
        child: () => createMockNode("mod_item", "nested_module"),
      };
    }
    return null;
  };
  return node;
}

function createMockLifetimeNode(): TreeSitterNode {
  const node = createMockNode("struct_item", "LifetimeStruct");
  node.childForFieldName = (field: string) => {
    if (field === "type_parameters") {
      return {
        ...createMockNode("type_parameters", ""),
        childCount: 1,
        child: () => createMockNode("lifetime", "'a"),
      };
    }
    return null;
  };
  return node;
}

function createMockGenericNode(): TreeSitterNode {
  const node = createMockNode("struct_item", "GenericStruct");
  node.childForFieldName = (field: string) => {
    if (field === "type_parameters") {
      return {
        ...createMockNode("type_parameters", ""),
        childCount: 1,
        child: () => ({
          ...createMockNode("type_parameter", ""),
          childForFieldName: (f: string) => (f === "name" ? createMockNode("type_identifier", "T") : null),
        }),
      };
    }
    return null;
  };
  return node;
}

function createMockDeriveNode(): TreeSitterNode {
  const node = createMockNode("struct_item", "DeriveStruct");

  const attr = {
    ...createMockNode("attribute_item", "derive"),
    childForFieldName: (field: string) => {
      if (field === "path") {
        return createMockNode("identifier", "derive");
      }
      if (field === "arguments") {
        return {
          ...createMockNode("arguments", ""),
          childCount: 2,
          child: (i: number) => createMockNode("identifier", i === 0 ? "Debug" : "Clone"),
        };
      }
      return null;
    },
  };

  node.childCount = 1;
  node.children = [attr];
  node.child = (i: number) => (i === 0 ? attr : null);
  return node;
}

function createMockVisibilityNode(visibility: string): TreeSitterNode {
  const node = createMockNode("struct_item", "VisibleStruct");
  node.childForFieldName = (field: string) => {
    if (field === "visibility_modifier") {
      return createMockNode("visibility_modifier", visibility);
    }
    if (field === "name") {
      return createMockNode("identifier", "VisibleStruct");
    }
    return null;
  };
  return node;
}

function createMockEnumWithVariantsNode(): TreeSitterNode {
  const node = createMockNode("enum_item", "TestEnum");
  node.childForFieldName = (field: string) => {
    if (field === "body") {
      return {
        ...createMockNode("enum_variant_list", ""),
        childCount: 2,
        child: (i: number) => ({
          ...createMockNode("enum_variant", ""),
          childForFieldName: () => createMockNode("identifier", i === 0 ? "Variant1" : "Variant2"),
        }),
      };
    }
    return null;
  };
  return node;
}

function createMockStructWithFieldsNode(): TreeSitterNode {
  const node = createMockNode("struct_item", "FieldStruct");
  node.childForFieldName = (field: string) => {
    if (field === "body") {
      return {
        ...createMockNode("field_declaration_list", ""),
        childCount: 1,
        child: () => createMockNode("field_declaration", "field1"),
      };
    }
    return null;
  };
  return node;
}

function createMockTraitWithMethodsNode(): TreeSitterNode {
  const node = createMockNode("trait_item", "MethodTrait");
  node.childForFieldName = (field: string) => {
    if (field === "body") {
      return {
        ...createMockNode("declaration_list", ""),
        childCount: 1,
        child: () => createMockNode("function_signature_item", "trait_method"),
      };
    }
    return null;
  };
  return node;
}

function createMockAssociatedTypeNode(): TreeSitterNode {
  const node = createMockNode("trait_item", "AssocTrait");
  node.childForFieldName = (field: string) => {
    if (field === "body") {
      return {
        ...createMockNode("declaration_list", ""),
        childCount: 1,
        child: () => createMockNode("associated_type", "Output"),
      };
    }
    return null;
  };
  return node;
}

function createMockUseNode(): TreeSitterNode {
  const node = createMockNode("use_declaration", "");
  node.childForFieldName = (field: string) => {
    if (field === "argument") {
      return createMockNode("use_tree", "std::collections::HashMap");
    }
    return null;
  };
  return node;
}

function createMockBuilderNode(): TreeSitterNode {
  const structNode = createMockNode("struct_item", "TestBuilder");
  const implNode = createMockNode("impl_item", "");
  implNode.childForFieldName = (field: string) => {
    if (field === "type") return createMockNode("type_identifier", "TestBuilder");
    if (field === "body") {
      const body = createMockNode("declaration_list", "");
      body.childCount = 1;
      body.child = () => {
        const fn = createMockNode("function_item", "build");
        fn.childForFieldName = (f: string) => (f === "name" ? createMockNode("identifier", "build") : null);
        return fn;
      };
      return body;
    }
    return null;
  };
  const root = createMockNode("source_file", "");
  root.childCount = 2;
  root.child = (i: number) => (i === 0 ? structNode : implNode);
  return root;
}

function createMockIteratorNode(): TreeSitterNode {
  // impl Iterator for IterType { fn next(&mut self) {} }
  const impl = createMockNode("impl_item", "");
  impl.childForFieldName = (field: string) => {
    if (field === "trait") return createMockNode("type_identifier", "Iterator");
    if (field === "type") return createMockNode("type_identifier", "IterType");
    if (field === "body") {
      const body = createMockNode("declaration_list", "");
      body.childCount = 1;
      body.child = () => {
        const fn = createMockNode("function_item", "next");
        fn.childForFieldName = (f: string) => (f === "name" ? createMockNode("identifier", "next") : null);
        return fn;
      };
      return body;
    }
    return null;
  };
  return impl;
}

function createMockResultNode(): TreeSitterNode {
  const node = createMockNode("generic_type", "");
  node.childForFieldName = (field: string) => {
    if (field === "type") return createMockNode("type_identifier", "Result");
    return null;
  };
  return node;
}

function createMockBorrowingNode(): TreeSitterNode {
  return createMockNode("reference_type", "");
}

function createMockUnsafeNode(): TreeSitterNode {
  return createMockNode("unsafe_block", "");
}

function createMockLifetimeAnnotationNode(): TreeSitterNode {
  return createMockNode("lifetime", "'a");
}

function createMockComplexNode(): TreeSitterNode {
  const node = createMockNode("source_file", "");
  node.childCount = 5;
  node.child = (index: number) => {
    switch (index) {
      case 0:
        return createMockNode("struct_item", "Struct1");
      case 1:
        return createMockNode("enum_item", "Enum1");
      case 2:
        return createMockNode("trait_item", "Trait1");
      case 3:
        return createMockNode("function_item", "function1");
      case 4:
        return createMockNode("mod_item", "module1");
      default:
        return null;
    }
  };
  return node;
}
