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
// 3. RUST ENTITY EXTRACTION (Layer 1)
// =============================================================================

export class RustAnalyzer {
  private metrics: AnalyzerMetrics = {
    entitiesExtracted: 0,
    relationshipsFound: 0,
    patternsIdentified: 0,
    parseTime: 0,
  };

  /**
   * Main entry point for Rust analysis
   */
  public async analyze(
    node: TreeSitterNode,
    filePath: string,
  ): Promise<{
    entities: ParsedEntity[];
    relationships: EntityRelationship[];
    imports: ImportDependency[];
    patterns: PatternAnalysis;
    metrics: AnalyzerMetrics;
  }> {
    const startTime = Date.now();
    const entities: ParsedEntity[] = [];
    const relationships: EntityRelationship[] = [];
    const imports: ImportDependency[] = [];

    // Extract all entity types
    this.extractModules(node, entities, relationships, filePath);
    this.extractStructs(node, entities, relationships, filePath);
    this.extractEnums(node, entities, relationships, filePath);
    this.extractTraits(node, entities, relationships, filePath);
    this.extractFunctions(node, entities, filePath);
    this.extractTypeAliases(node, entities, filePath);
    this.extractConstants(node, entities, filePath);
    this.extractMacros(node, entities, filePath);
    // Handle impl blocks even if no struct node was encountered
    this.extractImplBlocksGlobal(node, entities, relationships, filePath);

    // Extract imports/use statements
    this.extractUseStatements(node, imports, filePath);

    // Identify patterns (Layer 4)
    const patterns = this.identifyPatterns(node, entities);

    // Update metrics
    this.metrics.entitiesExtracted = entities.length;
    this.metrics.relationshipsFound = relationships.length;
    this.metrics.patternsIdentified =
      patterns.designPatterns.length +
      patterns.exceptionHandling.length +
      patterns.contextManagers.length +
      patterns.pythonIdioms.length +
      patterns.circularDependencies.length +
      (patterns.otherPatterns?.length || 0);
    this.metrics.parseTime = Math.max(1, Date.now() - startTime);

    return { entities, relationships, imports, patterns, metrics: this.metrics };
  }

  /**
   * Extract module declarations
   */
  private extractModules(
    node: TreeSitterNode,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    filePath: string,
  ): void {
    const moduleNodes = this.findNodes(node, "mod_item");

    for (const modNode of moduleNodes) {
      const name = this.resolveName(modNode);
      if (!name) continue;
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
            from: `${filePath}:module:${name}`,
            to: filePath,
            type: "contains",
            sourceFile: filePath,
            metadata: { line: location.start.line, nestedItems: nestedCount },
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
    filePath: string,
  ): void {
    const structNodes = this.findNodes(node, "struct_item");

    for (const structNode of structNodes) {
      const name = this.resolveName(structNode);
      if (!name) continue;
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
          rustType: "struct",
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
    _relationships: EntityRelationship[],
    filePath: string,
  ): void {
    const enumNodes = this.findNodes(node, "enum_item");

    for (const enumNode of enumNodes) {
      const name = this.resolveName(enumNode);
      if (!name) continue;
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
          rustType: "enum",
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
    filePath: string,
  ): void {
    const traitNodes = this.findNodes(node, "trait_item");

    for (const traitNode of traitNodes) {
      const name = this.resolveName(traitNode);
      if (!name) continue;
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
          rustType: "trait",
        },
      });

      // Create relationships for supertraits
      for (const supertrait of supertraits) {
        relationships.push({
          from: `${filePath}:trait:${name}`,
          to: `${filePath}:trait:${supertrait}`,
          type: "extends",
          sourceFile: filePath,
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
      const name = this.resolveName(fnNode);
      if (!name) continue;
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
          rustType: "function",
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
      const name = this.resolveName(typeNode);
      if (!name) continue;
      const location = this.getNodeLocation(typeNode);
      const visibility = this.extractVisibility(typeNode);
      const generics = this.extractGenerics(typeNode);
      const aliasedType = this.extractAliasedType(typeNode);

      entities.push({
        id: `${filePath}:type:${name}`,
        name,
        type: "typedef",
        filePath,
        location,
        metadata: {
          visibility,
          generics,
          aliasedType,
          rustType: "type_alias",
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
      const name = this.resolveName(constNode);
      if (!name) continue;
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
          rustType: "const",
        },
      });
    }

    // Extract static items
    const staticNodes = this.findNodes(node, "static_item");
    for (const staticNode of staticNodes) {
      const name = this.resolveName(staticNode);
      if (!name) continue;
      const location = this.getNodeLocation(staticNode);
      const visibility = this.extractVisibility(staticNode);
      const staticType = this.extractStaticType(staticNode);
      const isMutable = this.hasModifier(staticNode, "mut");

      entities.push({
        id: `${filePath}:static:${name}`,
        name,
        type: "variable", // Map static to variable for compatibility
        filePath,
        location,
        metadata: {
          visibility,
          staticType,
          isMutable,
          isStatic: true,
          rustType: "static",
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
      const name = this.resolveName(macroNode);
      if (!name) continue;
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
          rustType: "macro",
        },
      });
    }

    // Extract proc macros (attribute, derive, function-like)
    const procMacroNodes = this.findNodes(node, "attribute_item").filter((attr) => {
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
          rustType: "proc_macro",
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
    filePath: string,
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
            rustType: "field",
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
    filePath: string,
  ): string[] {
    const variants: string[] = [];
    const body = enumNode.childForFieldName("body");

    if (body) {
      const variantNodes = this.findNodes(body, "enum_variant");
      for (const variantNode of variantNodes) {
        const name = this.resolveName(variantNode);
        if (!name) continue;
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
            rustType: "enum_variant",
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
    filePath: string,
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
            rustType: "trait_method",
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
            rustType: "trait_method",
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
    filePath: string,
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
          type: "typedef", // Map associated type to typedef for compatibility
          filePath,
          location,
          metadata: {
            traitName,
            bounds,
            rustType: "associated_type",
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
    filePath: string,
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
          from: `${filePath}:struct:${typeName}`,
          to: `${filePath}:trait:${traitName}`,
          type: "implements",
          sourceFile: filePath,
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
                rustType: "impl_method",
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
                rustType: "impl_method",
              },
            });
          }
        }
      }
    }
  }

  /**
   * Extract impl blocks globally (even when no struct node provided)
   */
  private extractImplBlocksGlobal(
    node: TreeSitterNode,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    filePath: string,
  ): void {
    const implNodes = this.findNodes(node, "impl_item");
    for (const implNode of implNodes) {
      const typeNode = implNode.childForFieldName("type");
      const traitNode = implNode.childForFieldName("trait");
      const typeName = typeNode ? this.getNodeText(typeNode) : undefined;
      const traitName = traitNode ? this.getNodeText(traitNode) : undefined;

      // Relationship for trait impl
      if (typeName && traitName) {
        relationships.push({
          from: `${filePath}:struct:${typeName}`,
          to: `${filePath}:trait:${traitName}`,
          type: "implements",
          sourceFile: filePath,
        });
      }

      const body = implNode.childForFieldName("body");
      if (body) {
        const methods = this.findNodes(body, "function_item");
        for (const method of methods) {
          const nameNode = method.childForFieldName("name");
          if (!nameNode) continue;
          const methodName = this.getNodeText(nameNode);
          const location = this.getNodeLocation(method);

          entities.push({
            id: `${filePath}:impl:${typeName || "unknown"}:${traitName || "inherent"}:${methodName}`,
            name: methodName,
            type: "method",
            filePath,
            location,
            metadata: {
              implType: typeName || "",
              traitName,
              isTraitImpl: Boolean(traitName),
              isInherent: !traitName,
              rustType: "impl_method",
            },
          });
        }
      }
    }
  }

  /**
   * Extract use statements (imports)
   */
  private extractUseStatements(node: TreeSitterNode, importsList: ImportDependency[], filePath: string): void {
    const useNodes = this.findNodes(node, "use_declaration");

    for (const useNode of useNodes) {
      const visibility = this.extractVisibility(useNode);
      const importPaths = this.extractUseTree(useNode);
      const line = useNode.startPosition.row + 1;

      for (const full of importPaths) {
        const isWildcard = full.endsWith("::*");
        const path = isWildcard ? full.slice(0, -3) : full;
        const parts = path.split("::").filter(Boolean);

        let targetModule = path;
        let symbolName = "*";

        if (!isWildcard && parts.length > 1) {
          symbolName = parts[parts.length - 1] || "*";
          targetModule = parts.slice(0, -1).join("::");
        } else if (!isWildcard && parts.length === 1) {
          targetModule = "";
          symbolName = parts[0] || "*";
        }

        const importType: ImportDependency["importType"] =
          full.startsWith("self::") || full.startsWith("super::") ? "relative" : "absolute";

        importsList.push({
          sourceFile: filePath,
          targetModule: targetModule || path,
          importType,
          symbols: [{ name: symbolName }],
          line,
          isUsed: false,
          usageLocations: [],
          type: "use",
          metadata: { visibility },
        });
      }
    }

    // Extract extern crate declarations
    const externNodes = this.findNodes(node, "extern_crate_declaration");
    for (const externNode of externNodes) {
      const nameNode = externNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const line = externNode.startPosition.row + 1;
      importsList.push({
        sourceFile: filePath,
        targetModule: name,
        importType: "absolute",
        symbols: [{ name }],
        line,
        isUsed: false,
        usageLocations: [],
        type: "extern_crate",
        metadata: { isExternCrate: true },
      });
    }
  }

  /**
   * Identify Rust patterns (Layer 4)
   */
  private identifyPatterns(node: TreeSitterNode, entities: ParsedEntity[]): PatternAnalysis {
    const result: PatternAnalysis = {
      contextManagers: [],
      exceptionHandling: [],
      designPatterns: [],
      pythonIdioms: [],
      circularDependencies: [],
      otherPatterns: [],
    };

    // Identify Builder pattern
    const builderPattern = this.identifyBuilderPattern(entities);
    if (builderPattern) result.designPatterns.push(builderPattern);

    // Identify Iterator pattern
    const iteratorPattern = this.identifyIteratorPattern(node, entities);
    if (iteratorPattern) result.designPatterns.push(iteratorPattern);

    // Identify Error handling patterns
    const errorPatterns = this.identifyErrorHandlingPatterns(node);
    result.otherPatterns?.push(...errorPatterns);

    // Identify Ownership patterns
    const ownershipPatterns = this.identifyOwnershipPatterns(node);
    result.otherPatterns?.push(...ownershipPatterns);

    // Identify unsafe code blocks
    const unsafePatterns = this.identifyUnsafePatterns(node);
    result.otherPatterns?.push(...unsafePatterns);

    return result;
  }

  /**
   * Identify Builder pattern
   */
  private identifyBuilderPattern(entities: ParsedEntity[]): PatternAnalysis["designPatterns"][number] | null {
    for (const entity of entities) {
      if (entity.type !== "struct") continue;

      if (entity.name.endsWith("Builder")) {
        // Look for build() method
        const buildMethod = entities.find(
          (e) => e.type === "method" && e.metadata?.implType === entity.name && e.name === "build",
        );

        if (buildMethod) {
          return {
            pattern: "builder",
            confidence: 0.95,
            entities: [entity.id!, buildMethod.id!],
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
  private identifyIteratorPattern(
    node: TreeSitterNode,
    entities: ParsedEntity[],
  ): PatternAnalysis["designPatterns"][number] | null {
    // Try via methods
    const iteratorImpls = entities.filter(
      (e) => e.type === "method" && e.metadata?.traitName === "Iterator" && e.name === "next",
    );
    if (iteratorImpls.length > 0) {
      return {
        pattern: "iterator",
        confidence: 1.0,
        entities: iteratorImpls.map((e) => e.id!).filter(Boolean),
        description: `Found ${iteratorImpls.length} Iterator implementations`,
      };
    }
    // Fallback: find impl_item with trait "Iterator" in AST
    const impls = this.findNodes(node, "impl_item").filter((n) => {
      const traitNode = n.childForFieldName("trait");
      return traitNode && this.getNodeText(traitNode) === "Iterator";
    });
    if (impls.length > 0) {
      return {
        pattern: "iterator",
        confidence: 0.8,
        entities: [],
        description: `Found ${impls.length} Iterator impl blocks`,
      };
    }
    return null;
  }

  /**
   * Identify error handling patterns
   */
  private identifyErrorHandlingPatterns(node: TreeSitterNode): NonNullable<PatternAnalysis["otherPatterns"]> {
    const patterns: NonNullable<PatternAnalysis["otherPatterns"]> = [];

    // Count Result<T, E> usage
    const resultTypes = this.findNodes(node, "generic_type").filter((n) => {
      const typeNode = n.childForFieldName("type");
      const name = typeNode ? this.getNodeText(typeNode) : "";
      return name.includes("Result");
    });

    if (resultTypes.length > 0) {
      patterns.push({
        kind: "result_error_handling",
        confidence: 1.0,
        description: `Found ${resultTypes.length} Result type usages`,
        metadata: { count: resultTypes.length },
      });
    }

    // Count ? operator usage
    const tryOperators = this.findNodes(node, "try_expression");
    if (tryOperators.length > 0) {
      patterns.push({
        kind: "try_operator",
        confidence: 1.0,
        description: `Found ${tryOperators.length} ? operator usages`,
        metadata: { count: tryOperators.length },
      });
    }

    return patterns;
  }

  /**
   * Identify ownership patterns
   */
  private identifyOwnershipPatterns(node: TreeSitterNode): NonNullable<PatternAnalysis["otherPatterns"]> {
    const patterns: NonNullable<PatternAnalysis["otherPatterns"]> = [];

    // Count borrowing patterns
    const references = this.findNodes(node, "reference_type");
    const mutReferences = references.filter((r) => this.hasChild(r, "mutable_specifier"));

    if (references.length > 0) {
      patterns.push({
        kind: "borrowing",
        confidence: 1.0,
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
        kind: "lifetime_annotations",
        confidence: 1.0,
        description: `Found ${lifetimes.length} lifetime annotations`,
        metadata: { count: lifetimes.length },
      });
    }

    return patterns;
  }

  /**
   * Identify unsafe code blocks
   */
  private identifyUnsafePatterns(node: TreeSitterNode): NonNullable<PatternAnalysis["otherPatterns"]> {
    const patterns: NonNullable<PatternAnalysis["otherPatterns"]> = [];

    // Count unsafe blocks
    const unsafeBlocks = this.findNodes(node, "unsafe_block");
    const unsafeFunctions = this.findNodes(node, "function_item").filter((f) => this.hasModifier(f, "unsafe"));
    const unsafeTraits = this.findNodes(node, "trait_item").filter((t) => this.hasModifier(t, "unsafe"));
    const unsafeImpls = this.findNodes(node, "impl_item").filter((i) => this.hasModifier(i, "unsafe"));

    const totalUnsafe = unsafeBlocks.length + unsafeFunctions.length + unsafeTraits.length + unsafeImpls.length;

    if (totalUnsafe > 0) {
      patterns.push({
        kind: "unsafe_code",
        confidence: 1.0,
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
   * Get location of a node - now returns proper format
   */
  private getNodeLocation(node: TreeSitterNode): {
    start: { line: number; column: number; index: number };
    end: { line: number; column: number; index: number };
  } {
    return {
      start: {
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        index: node.startIndex,
      },
      end: {
        line: node.endPosition.row + 1,
        column: node.endPosition.column,
        index: node.endIndex,
      },
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
        const isMut = selfNode ? this.hasChild(selfNode, "mutable_specifier") : false;
        const isRef = selfNode ? this.hasChild(selfNode, "&") : false;

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
        if (pathNode) {
          const fullPath = prefix ? `${prefix}::${this.getNodeText(pathNode)}` : this.getNodeText(pathNode);
          paths.push(fullPath);
        }
      } else if (tree.type === "scoped_use_list") {
        const pathNode = tree.childForFieldName("path");
        const listNode = tree.childForFieldName("list");
        const newPrefix = pathNode
          ? prefix
            ? `${prefix}::${this.getNodeText(pathNode)}`
            : this.getNodeText(pathNode)
          : prefix;

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

  /**
   * Resolve entity name robustly:
   * 1) field name via childForFieldName("name")
   * 2) first immediate identifier/type_identifier child
   * 3) fallback to node.text (if non-empty)
   */
  private resolveName(node: TreeSitterNode): string | null {
    try {
      const nameField = node.childForFieldName?.("name");
      if (nameField) {
        const t = this.getNodeText(nameField);
        if (t) return t;
      }
    } catch {
      // ignore
    }

    // Try immediate identifier/type_identifier
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === "identifier" || child.type === "type_identifier") {
        const t = this.getNodeText(child);
        if (t) return t;
      }
    }

    // Fallback to node.text
    const txt = (node.text || "").trim();
    return txt.length > 0 ? txt : null;
  }
}

// Export default instance
export default new RustAnalyzer();

type AnalyzerMetrics = {
  entitiesExtracted: number;
  relationshipsFound: number;
  patternsIdentified: number;
  parseTime: number;
};
