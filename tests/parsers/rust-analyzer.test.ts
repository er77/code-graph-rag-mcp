/**
 * TASK-20251005185121: Rust Analyzer Test Suite
 *
 * Comprehensive tests for Rust language analyzer
 * Validates entity extraction, relationship mapping, and pattern recognition
 *
 * @task_id TASK-20251005185121
 * @created 2025-10-05
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
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

      expect(result.entities.some(e => e.type === "enum")).toBe(true);
    });

    it("should extract traits", async () => {
      const mockNode = createMockNode("trait_item", "TestTrait");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some(e => e.type === "trait")).toBe(true);
    });

    it("should extract functions", async () => {
      const mockNode = createMockFunctionNode("test_function", false, false);
      const result = await analyzer.analyze(mockNode, "test.rs");

      const func = result.entities.find(e => e.type === "function");
      expect(func).toBeDefined();
      expect(func?.name).toBe("test_function");
    });

    it("should extract async functions", async () => {
      const mockNode = createMockFunctionNode("async_function", true, false);
      const result = await analyzer.analyze(mockNode, "test.rs");

      const func = result.entities.find(e => e.type === "function");
      expect(func?.metadata?.isAsync).toBe(true);
    });

    it("should extract modules", async () => {
      const mockNode = createMockNode("mod_item", "test_module");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some(e => e.type === "module")).toBe(true);
    });

    it("should extract type aliases", async () => {
      const mockNode = createMockNode("type_item", "MyType");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some(e => e.type === "type_alias")).toBe(true);
    });

    it("should extract constants", async () => {
      const mockNode = createMockNode("const_item", "MY_CONST");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some(e => e.type === "constant")).toBe(true);
    });

    it("should extract static items", async () => {
      const mockNode = createMockNode("static_item", "MY_STATIC");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some(e => e.type === "static")).toBe(true);
    });

    it("should extract macros", async () => {
      const mockNode = createMockNode("macro_definition", "my_macro");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some(e => e.type === "macro")).toBe(true);
    });
  });

  describe("Relationship Extraction", () => {
    it("should extract trait implementations", async () => {
      const mockNode = createMockImplNode("TestStruct", "TestTrait");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.relationships.some(r => r.type === "implements")).toBe(true);
    });

    it("should extract trait extensions", async () => {
      const mockNode = createMockTraitExtensionNode("SubTrait", "SuperTrait");
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.relationships.some(r => r.type === "extends")).toBe(true);
    });

    it("should extract module containment", async () => {
      const mockNode = createMockNestedModuleNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.relationships.some(r => r.type === "contains")).toBe(true);
    });
  });

  describe("Rust-Specific Features", () => {
    it("should extract lifetimes", async () => {
      const mockNode = createMockLifetimeNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const entity = result.entities.find(e => e.type === "struct");
      expect(entity?.metadata?.lifetimes).toContain("'a");
    });

    it("should extract generics", async () => {
      const mockNode = createMockGenericNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const entity = result.entities.find(e => e.type === "struct");
      expect(entity?.metadata?.generics).toContain("T");
    });

    it("should extract derive macros", async () => {
      const mockNode = createMockDeriveNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const entity = result.entities.find(e => e.type === "struct");
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

      const func = result.entities.find(e => e.type === "function");
      expect(func?.metadata?.isUnsafe).toBe(true);
    });

    it("should extract enum variants", async () => {
      const mockNode = createMockEnumWithVariantsNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const enumEntity = result.entities.find(e => e.type === "enum");
      expect(enumEntity?.metadata?.variants).toContain("Variant1");
      expect(enumEntity?.metadata?.variants).toContain("Variant2");
    });

    it("should extract struct fields", async () => {
      const mockNode = createMockStructWithFieldsNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some(e => e.type === "field")).toBe(true);
    });

    it("should extract trait methods", async () => {
      const mockNode = createMockTraitWithMethodsNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const methods = result.entities.filter(e => e.type === "method");
      expect(methods.length).toBeGreaterThan(0);
    });

    it("should extract associated types", async () => {
      const mockNode = createMockAssociatedTypeNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      expect(result.entities.some(e => e.type === "associated_type")).toBe(true);
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

      const builderPattern = result.patterns.find(p => p.type === "builder");
      expect(builderPattern).toBeDefined();
      expect(builderPattern?.confidence).toBeGreaterThan(0.9);
    });

    it("should identify Iterator pattern", async () => {
      const mockNode = createMockIteratorNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const iteratorPattern = result.patterns.find(p => p.type === "iterator");
      expect(iteratorPattern).toBeDefined();
    });

    it("should identify Result error handling", async () => {
      const mockNode = createMockResultNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const resultPattern = result.patterns.find(p => p.type === "result_error_handling");
      expect(resultPattern).toBeDefined();
    });

    it("should identify borrowing patterns", async () => {
      const mockNode = createMockBorrowingNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const borrowPattern = result.patterns.find(p => p.type === "borrowing");
      expect(borrowPattern).toBeDefined();
    });

    it("should identify unsafe code blocks", async () => {
      const mockNode = createMockUnsafeNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const unsafePattern = result.patterns.find(p => p.type === "unsafe_code");
      expect(unsafePattern).toBeDefined();
    });

    it("should identify lifetime annotations", async () => {
      const mockNode = createMockLifetimeAnnotationNode();
      const result = await analyzer.analyze(mockNode, "test.rs");

      const lifetimePattern = result.patterns.find(p => p.type === "lifetime_annotations");
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

function createMockFunctionNode(name: string, isAsync: boolean, isUnsafe: boolean): TreeSitterNode {
  const node = createMockNode("function_item", name);
  let modifierCount = 0;
  if (isAsync) modifierCount++;
  if (isUnsafe) modifierCount++;

  node.childCount = modifierCount;
  node.child = (index: number) => {
    if (isAsync && index === 0) return { type: "async", text: "async" } as TreeSitterNode;
    if (isUnsafe && index === (isAsync ? 1 : 0)) return { type: "unsafe", text: "unsafe" } as TreeSitterNode;
    return null;
  };
  return node;
}

function createMockImplNode(typeName: string, traitName: string): TreeSitterNode {
  const node = createMockNode("impl_item", "");
  node.childForFieldName = (field: string) => {
    if (field === "type") return { text: typeName, type: "type_identifier" } as TreeSitterNode;
    if (field === "trait") return { text: traitName, type: "type_identifier" } as TreeSitterNode;
    return null;
  };
  return node;
}

function createMockTraitExtensionNode(subTrait: string, superTrait: string): TreeSitterNode {
  const node = createMockNode("trait_item", subTrait);
  node.childForFieldName = (field: string) => {
    if (field === "name") return { text: subTrait, type: "identifier" } as TreeSitterNode;
    if (field === "supertraits") {
      return {
        type: "trait_bounds",
        childCount: 1,
        child: () => ({ text: superTrait, type: "type" } as TreeSitterNode),
      } as TreeSitterNode;
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
        type: "declaration_list",
        childCount: 1,
        child: () => createMockNode("mod_item", "nested_module"),
      } as TreeSitterNode;
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
        type: "type_parameters",
        childCount: 1,
        child: () => ({ text: "'a", type: "lifetime" } as TreeSitterNode),
      } as TreeSitterNode;
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
        type: "type_parameters",
        childCount: 1,
        child: () => ({
          type: "type_parameter",
          childForFieldName: () => ({ text: "T", type: "type_identifier" } as TreeSitterNode),
        } as TreeSitterNode),
      } as TreeSitterNode;
    }
    return null;
  };
  return node;
}

function createMockDeriveNode(): TreeSitterNode {
  const node = createMockNode("struct_item", "DeriveStruct");
  // Add derive attribute
  return node;
}

function createMockVisibilityNode(visibility: string): TreeSitterNode {
  const node = createMockNode("struct_item", "VisibleStruct");
  node.childForFieldName = (field: string) => {
    if (field === "visibility_modifier") {
      return { text: visibility, type: "visibility_modifier" } as TreeSitterNode;
    }
    if (field === "name") {
      return { text: "VisibleStruct", type: "identifier" } as TreeSitterNode;
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
        type: "enum_variant_list",
        childCount: 2,
        child: (i: number) => ({
          type: "enum_variant",
          childForFieldName: () => ({
            text: i === 0 ? "Variant1" : "Variant2",
            type: "identifier"
          } as TreeSitterNode),
        } as TreeSitterNode),
      } as TreeSitterNode;
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
        type: "field_declaration_list",
        childCount: 1,
        child: () => createMockNode("field_declaration", "field1"),
      } as TreeSitterNode;
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
        type: "declaration_list",
        childCount: 1,
        child: () => createMockNode("function_signature_item", "trait_method"),
      } as TreeSitterNode;
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
        type: "declaration_list",
        childCount: 1,
        child: () => createMockNode("associated_type", "Output"),
      } as TreeSitterNode;
    }
    return null;
  };
  return node;
}

function createMockUseNode(): TreeSitterNode {
  const node = createMockNode("use_declaration", "");
  node.childForFieldName = (field: string) => {
    if (field === "argument") {
      return { text: "std::collections::HashMap", type: "use_tree" } as TreeSitterNode;
    }
    return null;
  };
  return node;
}

function createMockBuilderNode(): TreeSitterNode {
  const node = createMockNode("struct_item", "TestBuilder");
  // Add build method impl
  return node;
}

function createMockIteratorNode(): TreeSitterNode {
  const node = createMockNode("impl_item", "");
  node.childForFieldName = (field: string) => {
    if (field === "trait") return { text: "Iterator", type: "type_identifier" } as TreeSitterNode;
    return null;
  };
  return node;
}

function createMockResultNode(): TreeSitterNode {
  const node = createMockNode("generic_type", "");
  node.childForFieldName = (field: string) => {
    if (field === "type") return { text: "Result", type: "type_identifier" } as TreeSitterNode;
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
      case 0: return createMockNode("struct_item", "Struct1");
      case 1: return createMockNode("enum_item", "Enum1");
      case 2: return createMockNode("trait_item", "Trait1");
      case 3: return createMockNode("function_item", "function1");
      case 4: return createMockNode("mod_item", "module1");
      default: return null;
    }
  };
  return node;
}