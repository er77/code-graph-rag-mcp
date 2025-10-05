/**
 * TASK-20251005185121: Rust Analyzer Module
 *
 * Comprehensive Rust code analysis following the python-analyzer.ts pattern.
 * Implements multi-layer analysis architecture:
 * Layer 1: Basic entity extraction (structs, functions, traits)
 * Layer 2: Advanced Rust features (ownership, lifetimes, macros)
 * Layer 3: Relationship mapping (trait implementations, module hierarchy)
 * Layer 4: Pattern recognition (design patterns, Rust idioms)
 *
 * Architecture References:
 * - Python Analyzer Pattern: src/parsers/python-analyzer.ts
 * - Enhanced Parser Types: src/types/parser.ts
 * - ADR-002: C# and Rust Language Support
 *
 * @task_id TASK-20251005185121
 * @adr_ref ADR-002
 * @created 2025-10-05
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type {
  EntityRelationship,
  ImportDependency,
  ParsedEntity,
  PatternAnalysis,
  TreeSitterNode,
} from "../types/parser.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================

// Rust visibility modifiers
const VISIBILITY_MODIFIERS = ["pub", "pub(crate)", "pub(super)", "pub(self)"];

// Common Rust attributes
const COMMON_ATTRIBUTES = [
  "derive",
  "cfg",
  "test",
  "allow",
  "warn",
  "deny",
  "forbid",
  "deprecated",
  "must_use",
  "inline",
  "cold",
  "no_mangle",
];

// Common derive macros
const COMMON_DERIVES = [
  "Debug",
  "Clone",
  "Copy",
  "PartialEq",
  "Eq",
  "PartialOrd",
  "Ord",
  "Hash",
  "Default",
  "Serialize",
  "Deserialize",
];

// Rust ownership keywords
const OWNERSHIP_KEYWORDS = ["mut", "ref", "move", "&", "&mut"];

// Common Rust patterns
const RUST_PATTERNS = {
  BUILDER: ["Builder", "build"],
  ITERATOR: ["Iterator", "IntoIterator", "next"],
  RESULT: ["Result", "Ok", "Err"],
  OPTION: ["Option", "Some", "None"],
};

// =============================================================================
// 3. RUST ENTITY EXTRACTION (Layer 1)
// =============================================================================

export class RustAnalyzer {
  private metrics = {
    entitiesExtracted: 0,
    relationshipsFound: 0,
    patternsIdentified: 0,
    parseTime: 0,
  };

  /**
   * Main entry point for Rust analysis
   */
  public async analyze(node: TreeSitterNode, filePath: string): Promise<{
    entities: ParsedEntity[];
    relationships: EntityRelationship[];
    imports: ImportDependency[];
    patterns: PatternAnalysis[];
    metrics: typeof this.metrics;
  }> {
    const startTime = Date.now();
    const entities: ParsedEntity[] = [];
    const relationships: EntityRelationship[] = [];
    const imports: ImportDependency[] = [];
    const patterns: PatternAnalysis[] = [];

    // Extract all entity types
    this.extractModules(node, entities, relationships, filePath);
    this.extractStructs(node, entities, relationships, filePath);
    this.extractEnums(node, entities, relationships, filePath);
    this.extractTraits(node, entities, relationships, filePath);
    this.extractFunctions(node, entities, filePath);
    this.extractTypeAliases(node, entities, filePath);
    this.extractConstants(node, entities, filePath);
    this.extractMacros(node, entities, filePath);

    // Extract imports/use statements
    this.extractUseStatements(node, imports, filePath);

    // Identify patterns (Layer 4)
    patterns.push(...this.identifyPatterns(node, entities));

    // Update metrics
    this.metrics.entitiesExtracted = entities.length;
    this.metrics.relationshipsFound = relationships.length;
    this.metrics.patternsIdentified = patterns.length;
    this.metrics.parseTime = Date.now() - startTime;

    return { entities, relationships, imports, patterns, metrics: this.metrics };
  }

  /**
   * Extract module declarations
   */
  private extractModules(
    node: TreeSitterNode,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    filePath: string
  ): void {
    const moduleNodes = this.findNodes(node, "mod_item");

    for (const modNode of moduleNodes) {
      const nameNode = modNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(modNode);
      const visibility = this.extractVisibility(modNode);
      const isInline = this.hasBody(modNode);

      entities.push({
        id: `${filePath}:module:${name}`,
        name,
        type: "module",
        filePath,
        location,
        metadata: {
          visibility,
          isInline,
        },
      });

      // If module has a body, extract nested items
      if (isInline) {
        const body = modNode.childForFieldName("body");
        if (body) {
          const nestedCount = this.countNestedItems(body);
          relationships.push({
            source: `${filePath}:module:${name}`,
            target: filePath,
            type: "contains",
            metadata: { nestedItems: nestedCount },
          });
        }
      }
    }
  }

  /**
   * Extract struct declarations
   */
  private extractStructs(
    node: TreeSitterNode,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    filePath: string
  ): void {
    const structNodes = this.findNodes(node, "struct_item");

    for (const structNode of structNodes) {
      const nameNode = structNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(structNode);
      const visibility = this.extractVisibility(structNode);
      const generics = this.extractGenerics(structNode);
      const lifetimes = this.extractLifetimes(structNode);
      const derives = this.extractDerives(structNode);
      const fields = this.extractStructFields(structNode, name, entities, filePath);

      // Determine struct type
      const isTuple = this.isTupleStruct(structNode);
      const isUnit = fields.length === 0 && !isTuple;

      entities.push({
        id: `${filePath}:struct:${name}`,
        name,
        type: "struct",
        filePath,
        location,
        metadata: {
          visibility,
          generics,
          lifetimes,
          derives,
          fieldCount: fields.length,
          isTuple,
          isUnit,
        },
      });

      // Extract trait implementations for this struct
      this.extractImplBlocks(node, name, entities, relationships, filePath);
    }
  }

  /**
   * Extract enum declarations
   */
  private extractEnums(
    node: TreeSitterNode,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    filePath: string
  ): void {
    const enumNodes = this.findNodes(node, "enum_item");

    for (const enumNode of enumNodes) {
      const nameNode = enumNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(enumNode);
      const visibility = this.extractVisibility(enumNode);
      const generics = this.extractGenerics(enumNode);
      const lifetimes = this.extractLifetimes(enumNode);
      const derives = this.extractDerives(enumNode);
      const variants = this.extractEnumVariants(enumNode, name, entities, filePath);

      entities.push({
        id: `${filePath}:enum:${name}`,
        name,
        type: "enum",
        filePath,
        location,
        metadata: {
          visibility,
          generics,
          lifetimes,
          derives,
          variants,
          variantCount: variants.length,
        },
      });
    }
  }

  /**
   * Extract trait declarations
   */
  private extractTraits(
    node: TreeSitterNode,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    filePath: string
  ): void {
    const traitNodes = this.findNodes(node, "trait_item");

    for (const traitNode of traitNodes) {
      const nameNode = traitNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(traitNode);
      const visibility = this.extractVisibility(traitNode);
      const generics = this.extractGenerics(traitNode);
      const bounds = this.extractTraitBounds(traitNode);
      const supertraits = this.extractSupertraits(traitNode);

      // Extract trait methods
      const methods = this.extractTraitMethods(traitNode, name, entities, filePath);
      const associatedTypes = this.extractAssociatedTypes(traitNode, name, entities, filePath);

      entities.push({
        id: `${filePath}:trait:${name}`,
        name,
        type: "trait",
        filePath,
        location,
        metadata: {
          visibility,
          generics,
          bounds,
          supertraits,
          methodCount: methods.length,
          associatedTypeCount: associatedTypes.length,
        },
      });

      // Create relationships for supertraits
      for (const supertrait of supertraits) {
        relationships.push({
          source: `${filePath}:trait:${name}`,
          target: `${filePath}:trait:${supertrait}`,
          type: "extends",
          metadata: { filePath },
        });
      }
    }
  }

  /**
   * Extract function declarations
   */
  private extractFunctions(node: TreeSitterNode, entities: ParsedEntity[], filePath: string): void {
    const functionNodes = this.findNodes(node, "function_item");

    for (const fnNode of functionNodes) {
      const nameNode = fnNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(fnNode);
      const visibility = this.extractVisibility(fnNode);
      const isAsync = this.hasModifier(fnNode, "async");
      const isConst = this.hasModifier(fnNode, "const");
      const isUnsafe = this.hasModifier(fnNode, "unsafe");
      const generics = this.extractGenerics(fnNode);
      const lifetimes = this.extractLifetimes(fnNode);
      const parameters = this.extractFunctionParameters(fnNode);
      const returnType = this.extractReturnType(fnNode);

      entities.push({
        id: `${filePath}:function:${name}`,
        name,
        type: "function",
        filePath,
        location,
        metadata: {
          visibility,
          isAsync,
          isConst,
          isUnsafe,
          generics,
          lifetimes,
          parameters,
          returnType,
        },
      });
    }
  }

  /**
   * Extract type aliases
   */
  private extractTypeAliases(node: TreeSitterNode, entities: ParsedEntity[], filePath: string): void {
    const typeNodes = this.findNodes(node, "type_item");

    for (const typeNode of typeNodes) {
      const nameNode = typeNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(typeNode);
      const visibility = this.extractVisibility(typeNode);
      const generics = this.extractGenerics(typeNode);
      const aliasedType = this.extractAliasedType(typeNode);

      entities.push({
        id: `${filePath}:type:${name}`,
        name,
        type: "type_alias",
        filePath,
        location,
        metadata: {
          visibility,
          generics,
          aliasedType,
        },
      });
    }
  }

  /**
   * Extract constants
   */
  private extractConstants(node: TreeSitterNode, entities: ParsedEntity[], filePath: string): void {
    // Extract const items
    const constNodes = this.findNodes(node, "const_item");
    for (const constNode of constNodes) {
      const nameNode = constNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(constNode);
      const visibility = this.extractVisibility(constNode);
      const constType = this.extractConstType(constNode);

      entities.push({
        id: `${filePath}:const:${name}`,
        name,
        type: "constant",
        filePath,
        location,
        metadata: {
          visibility,
          constType,
          isConst: true,
        },
      });
    }

    // Extract static items
    const staticNodes = this.findNodes(node, "static_item");
    for (const staticNode of staticNodes) {
      const nameNode = staticNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(staticNode);
      const visibility = this.extractVisibility(staticNode);
      const staticType = this.extractStaticType(staticNode);
      const isMutable = this.hasModifier(staticNode, "mut");

      entities.push({
        id: `${filePath}:static:${name}`,
        name,
        type: "static",
        filePath,
        location,
        metadata: {
          visibility,
          staticType,
          isMutable,
          isStatic: true,
        },
      });
    }
  }

  /**
   * Extract macro definitions
   */
  private extractMacros(node: TreeSitterNode, entities: ParsedEntity[], filePath: string): void {
    // Extract macro_rules! definitions
    const macroRulesNodes = this.findNodes(node, "macro_definition");
    for (const macroNode of macroRulesNodes) {
      const nameNode = macroNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(macroNode);
      const visibility = this.extractVisibility(macroNode);
      const rules = this.extractMacroRules(macroNode);

      entities.push({
        id: `${filePath}:macro:${name}`,
        name,
        type: "macro",
        filePath,
        location,
        metadata: {
          visibility,
          macroType: "macro_rules",
          ruleCount: rules.length,
        },
      });
    }

    // Extract proc macros (attribute, derive, function-like)
    const procMacroNodes = this.findNodes(node, "attribute_item").filter(attr => {
      const name = this.getAttributeName(attr);
      return name === "proc_macro" || name === "proc_macro_derive" || name === "proc_macro_attribute";
    });

    for (const procMacro of procMacroNodes) {
      const parent = procMacro.parent;
      if (!parent) continue;

      const nameNode = parent.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(parent);
      const macroType = this.getAttributeName(procMacro);

      entities.push({
        id: `${filePath}:proc_macro:${name}`,
        name,
        type: "macro",
        filePath,
        location,
        metadata: {
          macroType,
          isProcMacro: true,
        },
      });
    }
  }

  /**
   * Extract struct fields
   */
  private extractStructFields(
    structNode: TreeSitterNode,
    structName: string,
    entities: ParsedEntity[],
    filePath: string
  ): ParsedEntity[] {
    const fields: ParsedEntity[] = [];
    const body = structNode.childForFieldName("body");

    if (body) {
      const fieldNodes = this.findNodes(body, "field_declaration");
      for (const fieldNode of fieldNodes) {
        const nameNode = fieldNode.childForFieldName("name");
        if (!nameNode) continue;

        const name = this.getNodeText(nameNode);
        const location = this.getNodeLocation(fieldNode);
        const visibility = this.extractVisibility(fieldNode);
        const fieldType = this.extractFieldType(fieldNode);
        const attributes = this.extractAttributes(fieldNode);

        const field: ParsedEntity = {
          id: `${filePath}:struct:${structName}:field:${name}`,
          name,
          type: "field",
          filePath,
          location,
          metadata: {
            structName,
            fieldType,
            visibility,
            attributes,
          },
        };

        fields.push(field);
        entities.push(field);
      }
    }

    return fields;
  }

  /**
   * Extract enum variants
   */
  private extractEnumVariants(
    enumNode: TreeSitterNode,
    enumName: string,
    entities: ParsedEntity[],
    filePath: string
  ): string[] {
    const variants: string[] = [];
    const body = enumNode.childForFieldName("body");

    if (body) {
      const variantNodes = this.findNodes(body, "enum_variant");
      for (const variantNode of variantNodes) {
        const nameNode = variantNode.childForFieldName("name");
        if (!nameNode) continue;

        const name = this.getNodeText(nameNode);
        const location = this.getNodeLocation(variantNode);

        // Check variant type
        const hasFields = this.hasChild(variantNode, "field_declaration_list");
        const hasTuple = this.hasChild(variantNode, "ordered_field_declaration_list");
        const discriminant = this.extractDiscriminant(variantNode);

        variants.push(name);

        entities.push({
          id: `${filePath}:enum:${enumName}:variant:${name}`,
          name,
          type: "enum_variant",
          filePath,
          location,
          metadata: {
            enumName,
            hasFields,
            hasTuple,
            discriminant,
          },
        });
      }
    }

    return variants;
  }

  /**
   * Extract trait methods
   */
  private extractTraitMethods(
    traitNode: TreeSitterNode,
    traitName: string,
    entities: ParsedEntity[],
    filePath: string
  ): ParsedEntity[] {
    const methods: ParsedEntity[] = [];
    const body = traitNode.childForFieldName("body");

    if (body) {
      const methodNodes = this.findNodes(body, "function_signature_item");
      const defaultMethodNodes = this.findNodes(body, "function_item");

      // Abstract methods (signatures only)
      for (const methodNode of methodNodes) {
        const nameNode = methodNode.childForFieldName("name");
        if (!nameNode) continue;

        const name = this.getNodeText(nameNode);
        const location = this.getNodeLocation(methodNode);
        const parameters = this.extractFunctionParameters(methodNode);
        const returnType = this.extractReturnType(methodNode);

        const method: ParsedEntity = {
          id: `${filePath}:trait:${traitName}:method:${name}`,
          name,
          type: "method",
          filePath,
          location,
          metadata: {
            traitName,
            parameters,
            returnType,
            isAbstract: true,
            hasDefaultImpl: false,
          },
        };

        methods.push(method);
        entities.push(method);
      }

      // Default implementations
      for (const methodNode of defaultMethodNodes) {
        const nameNode = methodNode.childForFieldName("name");
        if (!nameNode) continue;

        const name = this.getNodeText(nameNode);
        const location = this.getNodeLocation(methodNode);
        const parameters = this.extractFunctionParameters(methodNode);
        const returnType = this.extractReturnType(methodNode);

        const method: ParsedEntity = {
          id: `${filePath}:trait:${traitName}:method:${name}`,
          name,
          type: "method",
          filePath,
          location,
          metadata: {
            traitName,
            parameters,
            returnType,
            isAbstract: false,
            hasDefaultImpl: true,
          },
        };

        methods.push(method);
        entities.push(method);
      }
    }

    return methods;
  }

  /**
   * Extract associated types
   */
  private extractAssociatedTypes(
    traitNode: TreeSitterNode,
    traitName: string,
    entities: ParsedEntity[],
    filePath: string
  ): ParsedEntity[] {
    const types: ParsedEntity[] = [];
    const body = traitNode.childForFieldName("body");

    if (body) {
      const typeNodes = this.findNodes(body, "associated_type");
      for (const typeNode of typeNodes) {
        const nameNode = typeNode.childForFieldName("name");
        if (!nameNode) continue;

        const name = this.getNodeText(nameNode);
        const location = this.getNodeLocation(typeNode);
        const bounds = this.extractTypeBounds(typeNode);

        const associatedType: ParsedEntity = {
          id: `${filePath}:trait:${traitName}:type:${name}`,
          name,
          type: "associated_type",
          filePath,
          location,
          metadata: {
            traitName,
            bounds,
          },
        };

        types.push(associatedType);
        entities.push(associatedType);
      }
    }

    return types;
  }

  /**
   * Extract impl blocks for a type
   */
  private extractImplBlocks(
    node: TreeSitterNode,
    typeName: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    filePath: string
  ): void {
    const implNodes = this.findNodes(node, "impl_item");

    for (const implNode of implNodes) {
      const typeNode = implNode.childForFieldName("type");
      if (!typeNode) continue;

      const implType = this.getNodeText(typeNode);
      if (!implType.includes(typeName)) continue;

      // Check if it's a trait implementation
      const traitNode = implNode.childForFieldName("trait");
      if (traitNode) {
        const traitName = this.getNodeText(traitNode);

        relationships.push({
          source: `${filePath}:struct:${typeName}`,
          target: `${filePath}:trait:${traitName}`,
          type: "implements",
          metadata: { filePath },
        });

        // Extract implemented methods
        const body = implNode.childForFieldName("body");
        if (body) {
          const methods = this.findNodes(body, "function_item");
          for (const method of methods) {
            const nameNode = method.childForFieldName("name");
            if (!nameNode) continue;

            const methodName = this.getNodeText(nameNode);
            const location = this.getNodeLocation(method);

            entities.push({
              id: `${filePath}:impl:${typeName}:${traitName}:${methodName}`,
              name: methodName,
              type: "method",
              filePath,
              location,
              metadata: {
                implType: typeName,
                traitName,
                isTraitImpl: true,
              },
            });
          }
        }
      } else {
        // Inherent implementation
        const body = implNode.childForFieldName("body");
        if (body) {
          const methods = this.findNodes(body, "function_item");
          for (const method of methods) {
            const nameNode = method.childForFieldName("name");
            if (!nameNode) continue;

            const methodName = this.getNodeText(nameNode);
            const location = this.getNodeLocation(method);
            const visibility = this.extractVisibility(method);

            entities.push({
              id: `${filePath}:impl:${typeName}:${methodName}`,
              name: methodName,
              type: "method",
              filePath,
              location,
              metadata: {
                implType: typeName,
                visibility,
                isInherent: true,
              },
            });
          }
        }
      }
    }
  }

  /**
   * Extract use statements (imports)
   */
  private extractUseStatements(node: TreeSitterNode, imports: ImportDependency[], filePath: string): void {
    const useNodes = this.findNodes(node, "use_declaration");

    for (const useNode of useNodes) {
      const visibility = this.extractVisibility(useNode);
      const imports = this.extractUseTree(useNode);

      for (const importPath of imports) {
        imports.push({
          source: filePath,
          target: importPath,
          type: "use",
          metadata: {
            visibility,
          },
        });
      }
    }

    // Extract extern crate declarations
    const externNodes = this.findNodes(node, "extern_crate_declaration");
    for (const externNode of externNodes) {
      const nameNode = externNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      imports.push({
        source: filePath,
        target: name,
        type: "extern_crate",
        metadata: {},
      });
    }
  }

  /**
   * Identify Rust patterns (Layer 4)
   */
  private identifyPatterns(node: TreeSitterNode, entities: ParsedEntity[]): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];

    // Identify Builder pattern
    const builderPattern = this.identifyBuilderPattern(entities);
    if (builderPattern) patterns.push(builderPattern);

    // Identify Iterator pattern
    const iteratorPatterns = this.identifyIteratorPattern(entities);
    patterns.push(...iteratorPatterns);

    // Identify Error handling patterns
    const errorPatterns = this.identifyErrorHandlingPatterns(node);
    patterns.push(...errorPatterns);

    // Identify Ownership patterns
    const ownershipPatterns = this.identifyOwnershipPatterns(node);
    patterns.push(...ownershipPatterns);

    // Identify unsafe code blocks
    const unsafePatterns = this.identifyUnsafePatterns(node);
    patterns.push(...unsafePatterns);

    return patterns;
  }

  /**
   * Identify Builder pattern
   */
  private identifyBuilderPattern(entities: ParsedEntity[]): PatternAnalysis | null {
    for (const entity of entities) {
      if (entity.type !== "struct") continue;

      if (entity.name.endsWith("Builder")) {
        // Look for build() method
        const buildMethod = entities.find(
          e => e.type === "method" && e.metadata?.implType === entity.name && e.name === "build"
        );

        if (buildMethod) {
          return {
            type: "builder",
            confidence: 0.95,
            entities: [entity.id, buildMethod.id],
            description: `Builder pattern detected in struct ${entity.name}`,
          };
        }
      }
    }

    return null;
  }

  /**
   * Identify Iterator pattern
   */
  private identifyIteratorPattern(entities: ParsedEntity[]): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];

    // Look for Iterator trait implementations
    const iteratorImpls = entities.filter(
      e => e.type === "method" && e.metadata?.traitName === "Iterator" && e.name === "next"
    );

    if (iteratorImpls.length > 0) {
      patterns.push({
        type: "iterator",
        confidence: 1.0,
        entities: iteratorImpls.map(e => e.id),
        description: `Found ${iteratorImpls.length} Iterator implementations`,
        metadata: {
          count: iteratorImpls.length,
        },
      });
    }

    return patterns;
  }

  /**
   * Identify error handling patterns
   */
  private identifyErrorHandlingPatterns(node: TreeSitterNode): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];

    // Count Result<T, E> usage
    const resultTypes = this.findNodes(node, "generic_type").filter(n => {
      const name = this.getNodeText(n.childForFieldName("type") || n);
      return name.includes("Result");
    });

    if (resultTypes.length > 0) {
      patterns.push({
        type: "result_error_handling",
        confidence: 1.0,
        entities: [],
        description: `Found ${resultTypes.length} Result type usages`,
        metadata: {
          count: resultTypes.length,
        },
      });
    }

    // Count ? operator usage
    const tryOperators = this.findNodes(node, "try_expression");
    if (tryOperators.length > 0) {
      patterns.push({
        type: "try_operator",
        confidence: 1.0,
        entities: [],
        description: `Found ${tryOperators.length} ? operator usages`,
        metadata: {
          count: tryOperators.length,
        },
      });
    }

    return patterns;
  }

  /**
   * Identify ownership patterns
   */
  private identifyOwnershipPatterns(node: TreeSitterNode): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];

    // Count borrowing patterns
    const references = this.findNodes(node, "reference_type");
    const mutReferences = references.filter(r => this.hasChild(r, "mutable_specifier"));

    if (references.length > 0) {
      patterns.push({
        type: "borrowing",
        confidence: 1.0,
        entities: [],
        description: `Found ${references.length} references (${mutReferences.length} mutable)`,
        metadata: {
          totalReferences: references.length,
          mutableReferences: mutReferences.length,
        },
      });
    }

    // Count lifetime annotations
    const lifetimes = this.findNodes(node, "lifetime");
    if (lifetimes.length > 0) {
      patterns.push({
        type: "lifetime_annotations",
        confidence: 1.0,
        entities: [],
        description: `Found ${lifetimes.length} lifetime annotations`,
        metadata: {
          count: lifetimes.length,
        },
      });
    }

    return patterns;
  }

  /**
   * Identify unsafe code blocks
   */
  private identifyUnsafePatterns(node: TreeSitterNode): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];

    // Count unsafe blocks
    const unsafeBlocks = this.findNodes(node, "unsafe_block");
    const unsafeFunctions = this.findNodes(node, "function_item").filter(f =>
      this.hasModifier(f, "unsafe")
    );
    const unsafeTraits = this.findNodes(node, "trait_item").filter(t =>
      this.hasModifier(t, "unsafe")
    );
    const unsafeImpls = this.findNodes(node, "impl_item").filter(i =>
      this.hasModifier(i, "unsafe")
    );

    const totalUnsafe = unsafeBlocks.length + unsafeFunctions.length + unsafeTraits.length + unsafeImpls.length;

    if (totalUnsafe > 0) {
      patterns.push({
        type: "unsafe_code",
        confidence: 1.0,
        entities: [],
        description: `Found ${totalUnsafe} unsafe code usages`,
        metadata: {
          unsafeBlocks: unsafeBlocks.length,
          unsafeFunctions: unsafeFunctions.length,
          unsafeTraits: unsafeTraits.length,
          unsafeImpls: unsafeImpls.length,
        },
      });
    }

    return patterns;
  }

  // =============================================================================
  // 4. HELPER METHODS
  // =============================================================================

  /**
   * Find all nodes of a specific type
   */
  private findNodes(node: TreeSitterNode, type: string): TreeSitterNode[] {
    const results: TreeSitterNode[] = [];
    const visit = (n: TreeSitterNode) => {
      if (n.type === type) {
        results.push(n);
      }
      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) visit(child);
      }
    };
    visit(node);
    return results;
  }

  /**
   * Get text content of a node
   */
  private getNodeText(node: TreeSitterNode): string {
    return node.text || "";
  }

  /**
   * Get location of a node
   */
  private getNodeLocation(node: TreeSitterNode): { line: number; column: number } {
    return {
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
    };
  }

  /**
   * Extract visibility modifier
   */
  private extractVisibility(node: TreeSitterNode): string {
    const visNode = node.childForFieldName("visibility_modifier");
    return visNode ? this.getNodeText(visNode) : "private";
  }

  /**
   * Check if node has specific modifier
   */
  private hasModifier(node: TreeSitterNode, modifier: string): boolean {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === modifier) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract generic parameters
   */
  private extractGenerics(node: TreeSitterNode): string[] {
    const generics: string[] = [];
    const genericNode = node.childForFieldName("type_parameters");

    if (genericNode) {
      const params = this.findNodes(genericNode, "type_parameter");
      for (const param of params) {
        const nameNode = param.childForFieldName("name");
        if (nameNode) {
          generics.push(this.getNodeText(nameNode));
        }
      }
    }

    return generics;
  }

  /**
   * Extract lifetime parameters
   */
  private extractLifetimes(node: TreeSitterNode): string[] {
    const lifetimes: string[] = [];
    const genericNode = node.childForFieldName("type_parameters");

    if (genericNode) {
      const params = this.findNodes(genericNode, "lifetime");
      for (const param of params) {
        lifetimes.push(this.getNodeText(param));
      }
    }

    return lifetimes;
  }

  /**
   * Extract derive attributes
   */
  private extractDerives(node: TreeSitterNode): string[] {
    const derives: string[] = [];
    const attributes = this.findNodes(node, "attribute_item");

    for (const attr of attributes) {
      if (this.getAttributeName(attr) === "derive") {
        const args = attr.childForFieldName("arguments");
        if (args) {
          const tokens = this.findNodes(args, "identifier");
          for (const token of tokens) {
            derives.push(this.getNodeText(token));
          }
        }
      }
    }

    return derives;
  }

  /**
   * Extract attributes
   */
  private extractAttributes(node: TreeSitterNode): string[] {
    const attributes: string[] = [];
    const attrNodes = this.findNodes(node, "attribute_item");

    for (const attr of attrNodes) {
      attributes.push(this.getAttributeName(attr));
    }

    return attributes;
  }

  /**
   * Get attribute name
   */
  private getAttributeName(node: TreeSitterNode): string {
    const pathNode = node.childForFieldName("path");
    return pathNode ? this.getNodeText(pathNode) : "";
  }

  /**
   * Check if struct is a tuple struct
   */
  private isTupleStruct(node: TreeSitterNode): boolean {
    const body = node.childForFieldName("body");
    return body ? body.type === "ordered_field_declaration_list" : false;
  }

  /**
   * Check if node has a body
   */
  private hasBody(node: TreeSitterNode): boolean {
    return node.childForFieldName("body") !== null;
  }

  /**
   * Check if node has child of specific type
   */
  private hasChild(node: TreeSitterNode, type: string): boolean {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === type) {
        return true;
      }
    }
    return false;
  }

  /**
   * Count nested items in a module
   */
  private countNestedItems(node: TreeSitterNode): number {
    const itemTypes = [
      "function_item",
      "struct_item",
      "enum_item",
      "trait_item",
      "impl_item",
      "type_item",
      "const_item",
      "static_item",
      "mod_item",
    ];

    let count = 0;
    for (const type of itemTypes) {
      count += this.findNodes(node, type).length;
    }

    return count;
  }

  /**
   * Extract trait bounds
   */
  private extractTraitBounds(node: TreeSitterNode): string[] {
    const bounds: string[] = [];
    const boundsNode = node.childForFieldName("bounds");

    if (boundsNode) {
      const boundNodes = this.findNodes(boundsNode, "trait_bound");
      for (const bound of boundNodes) {
        bounds.push(this.getNodeText(bound));
      }
    }

    return bounds;
  }

  /**
   * Extract supertraits
   */
  private extractSupertraits(node: TreeSitterNode): string[] {
    const supertraits: string[] = [];
    const boundsNode = node.childForFieldName("supertraits");

    if (boundsNode) {
      const traitNodes = this.findNodes(boundsNode, "type");
      for (const trait of traitNodes) {
        supertraits.push(this.getNodeText(trait));
      }
    }

    return supertraits;
  }

  /**
   * Extract function parameters
   */
  private extractFunctionParameters(node: TreeSitterNode): Array<{ name: string; type: string }> {
    const parameters: Array<{ name: string; type: string }> = [];
    const paramList = node.childForFieldName("parameters");

    if (paramList) {
      const params = this.findNodes(paramList, "parameter");
      for (const param of params) {
        const pattern = param.childForFieldName("pattern");
        const typeNode = param.childForFieldName("type");

        if (pattern && typeNode) {
          parameters.push({
            name: this.getNodeText(pattern),
            type: this.getNodeText(typeNode),
          });
        }
      }

      // Check for self parameter
      const selfParam = this.findNodes(paramList, "self_parameter");
      if (selfParam.length > 0) {
        const selfNode = selfParam[0];
        const isMut = this.hasChild(selfNode, "mutable_specifier");
        const isRef = this.hasChild(selfNode, "&");

        let selfType = "self";
        if (isRef && isMut) selfType = "&mut self";
        else if (isRef) selfType = "&self";
        else if (isMut) selfType = "mut self";

        parameters.unshift({
          name: "self",
          type: selfType,
        });
      }
    }

    return parameters;
  }

  /**
   * Extract return type
   */
  private extractReturnType(node: TreeSitterNode): string {
    const returnNode = node.childForFieldName("return_type");
    return returnNode ? this.getNodeText(returnNode) : "()";
  }

  /**
   * Extract field type
   */
  private extractFieldType(node: TreeSitterNode): string {
    const typeNode = node.childForFieldName("type");
    return typeNode ? this.getNodeText(typeNode) : "unknown";
  }

  /**
   * Extract discriminant value from enum variant
   */
  private extractDiscriminant(node: TreeSitterNode): string | undefined {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === "=") {
        const nextChild = node.child(i + 1);
        if (nextChild) {
          return this.getNodeText(nextChild);
        }
      }
    }
    return undefined;
  }

  /**
   * Extract type bounds for associated type
   */
  private extractTypeBounds(node: TreeSitterNode): string[] {
    const bounds: string[] = [];
    const boundsNode = node.childForFieldName("bounds");

    if (boundsNode) {
      bounds.push(this.getNodeText(boundsNode));
    }

    return bounds;
  }

  /**
   * Extract aliased type
   */
  private extractAliasedType(node: TreeSitterNode): string {
    const typeNode = node.childForFieldName("type");
    return typeNode ? this.getNodeText(typeNode) : "unknown";
  }

  /**
   * Extract const type
   */
  private extractConstType(node: TreeSitterNode): string {
    const typeNode = node.childForFieldName("type");
    return typeNode ? this.getNodeText(typeNode) : "unknown";
  }

  /**
   * Extract static type
   */
  private extractStaticType(node: TreeSitterNode): string {
    const typeNode = node.childForFieldName("type");
    return typeNode ? this.getNodeText(typeNode) : "unknown";
  }

  /**
   * Extract macro rules
   */
  private extractMacroRules(node: TreeSitterNode): string[] {
    const rules: string[] = [];
    const body = node.childForFieldName("body");

    if (body) {
      const ruleNodes = this.findNodes(body, "macro_rule");
      for (const rule of ruleNodes) {
        rules.push(this.getNodeText(rule));
      }
    }

    return rules;
  }

  /**
   * Extract use tree (handles nested imports)
   */
  private extractUseTree(node: TreeSitterNode): string[] {
    const paths: string[] = [];

    const processUseTree = (tree: TreeSitterNode, prefix: string = ""): void => {
      if (tree.type === "use_wildcard") {
        paths.push(`${prefix}::*`);
      } else if (tree.type === "use_list") {
        for (let i = 0; i < tree.childCount; i++) {
          const child = tree.child(i);
          if (child && child.type !== "{" && child.type !== "}" && child.type !== ",") {
            processUseTree(child, prefix);
          }
        }
      } else if (tree.type === "use_as_clause") {
        const pathNode = tree.childForFieldName("path");
        const aliasNode = tree.childForFieldName("alias");
        if (pathNode) {
          const fullPath = prefix ? `${prefix}::${this.getNodeText(pathNode)}` : this.getNodeText(pathNode);
          paths.push(fullPath);
        }
      } else if (tree.type === "scoped_use_list") {
        const pathNode = tree.childForFieldName("path");
        const listNode = tree.childForFieldName("list");
        const newPrefix = pathNode ?
          (prefix ? `${prefix}::${this.getNodeText(pathNode)}` : this.getNodeText(pathNode)) :
          prefix;

        if (listNode) {
          processUseTree(listNode, newPrefix);
        }
      } else {
        const text = this.getNodeText(tree);
        if (text && text !== "use" && text !== ";") {
          const fullPath = prefix ? `${prefix}::${text}` : text;
          paths.push(fullPath);
        }
      }
    };

    const tree = node.childForFieldName("argument");
    if (tree) {
      processUseTree(tree);
    }

    return paths;
  }
}

// Export default instance
export default new RustAnalyzer();