/**
 * TASK-20251005191500: C++ Language Analyzer
 *
 * Analyzer for C++ language supporting:
 * Phase 3 - Core C++ features:
 * - Classes (with access modifiers: public, private, protected, abstract, final)
 * - Methods (const, static, virtual, override, final, noexcept)
 * - Constructors and Destructors
 * - Namespaces
 * - Member variables and constants
 * - Operator overloading (basic)
 * - Single and multiple inheritance
 * - Friend declarations
 *
 * Phase 4 - Limited Template Support:
 * - Simple template class definitions
 * - Simple template function definitions
 * - Template parameter extraction
 * - Skips complex metaprogramming (SFINAE, variadic templates)
 *
 * Implementation uses semantic layer with lazy evaluation pattern
 * and comprehensive circuit breakers for safety.
 */

import type {
  ParsedEntity,
  TreeSitterNode,
  EntityRelationship,
} from "../types/parser.js";

// Circuit breaker constants
const MAX_RECURSION_DEPTH = 50;
const PARSE_TIMEOUT_MS = 5000;
const MAX_COMPLEXITY_SCORE = 100;
const MAX_TEMPLATE_DEPTH = 10;

// Complexity scoring for templates
interface ComplexityScore {
  templateDepth: number;
  nestedClasses: number;
  inheritanceDepth: number;
  operatorCount: number;
  total: number;
}

export class CppAnalyzer {
  private recursionDepth = 0;
  private parseStartTime = 0;
  private templateDepth = 0;
  private complexityScore: ComplexityScore = {
    templateDepth: 0,
    nestedClasses: 0,
    inheritanceDepth: 0,
    operatorCount: 0,
    total: 0
  };

  // Memoization cache for template patterns
  private templateCache = new Map<string, ParsedEntity>();

  /**
   * Helper: Convert tree-sitter position to ParsedEntity location
   */
  private getNodeLocation(node: TreeSitterNode) {
    return {
      start: {
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        index: node.startIndex
      },
      end: {
        line: node.endPosition.row + 1,
        column: node.endPosition.column,
        index: node.endIndex
      }
    };
  }

  /**
   * Main entry point for analyzing C++ code
   */
  async analyze(
    rootNode: TreeSitterNode,
    filePath: string
  ): Promise<{ entities: ParsedEntity[]; relationships: EntityRelationship[] }> {
    this.resetState();

    const entities: ParsedEntity[] = [];
    const relationships: EntityRelationship[] = [];

    try {
      // Phase 1: Syntactic extraction from CST
      this.extractEntities(rootNode, filePath, entities, relationships);

      // Phase 2: Build semantic graph with lazy evaluation
      this.buildSemanticGraph(entities, relationships);

    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        console.warn(`[CppAnalyzer] Circuit breaker triggered for ${filePath}: ${error.message}`);
      } else {
        console.error(`[CppAnalyzer] Error analyzing ${filePath}:`, error);
      }
      // Return partial results on error
    }

    return { entities, relationships };
  }

  /**
   * Reset analyzer state for new file
   */
  private resetState(): void {
    this.recursionDepth = 0;
    this.parseStartTime = Date.now();
    this.templateDepth = 0;
    this.complexityScore = {
      templateDepth: 0,
      nestedClasses: 0,
      inheritanceDepth: 0,
      operatorCount: 0,
      total: 0
    };
    this.templateCache.clear();
  }

  /**
   * Check circuit breakers
   */
  private checkCircuitBreakers(): void {
    // Recursion depth check
    if (this.recursionDepth > MAX_RECURSION_DEPTH) {
      throw new CircuitBreakerError(`Maximum recursion depth ${MAX_RECURSION_DEPTH} exceeded`);
    }

    // Timeout check
    const elapsedTime = Date.now() - this.parseStartTime;
    if (elapsedTime > PARSE_TIMEOUT_MS) {
      throw new CircuitBreakerError(`Parse timeout ${PARSE_TIMEOUT_MS}ms exceeded`);
    }

    // Complexity score check
    this.complexityScore.total =
      this.complexityScore.templateDepth * 10 +
      this.complexityScore.nestedClasses * 5 +
      this.complexityScore.inheritanceDepth * 3 +
      this.complexityScore.operatorCount * 2;

    if (this.complexityScore.total > MAX_COMPLEXITY_SCORE) {
      throw new CircuitBreakerError(`Complexity score ${this.complexityScore.total} exceeds limit ${MAX_COMPLEXITY_SCORE}`);
    }

    // Template depth check
    if (this.templateDepth > MAX_TEMPLATE_DEPTH) {
      throw new CircuitBreakerError(`Template depth ${this.templateDepth} exceeds limit ${MAX_TEMPLATE_DEPTH}`);
    }
  }

  /**
   * Extract entities from the CST
   */
  private extractEntities(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    namespace: string = ""
  ): void {
    this.recursionDepth++;
    this.checkCircuitBreakers();

    try {
      switch (node.type) {
        case "translation_unit":
          // Root node - process all children
          for (const child of node.children) {
            this.extractEntities(child, filePath, entities, relationships, namespace);
          }
          break;

        case "namespace_definition":
          this.extractNamespace(node, filePath, entities, relationships);
          break;

        case "class_specifier":
        case "struct_specifier":
          this.extractClass(node, filePath, entities, relationships, namespace);
          break;

        case "function_definition":
          this.extractFunction(node, filePath, entities, relationships, namespace, false);
          break;

        case "template_declaration":
          this.extractTemplate(node, filePath, entities, relationships, namespace);
          break;

        case "using_declaration":
        case "using_directive":
        case "alias_declaration":
          this.extractUsing(node, filePath, entities, relationships, namespace);
          break;

        case "enum_specifier":
          this.extractEnum(node, filePath, entities, relationships, namespace);
          break;

        case "declaration":
          // Process declarations that might contain classes, functions, etc.
          for (const child of node.children) {
            this.extractEntities(child, filePath, entities, relationships, namespace);
          }
          break;

        default:
          // Recursively process other node types
          for (const child of node.children) {
            if (child.type !== "comment" && child.type !== "preproc_include") {
              this.extractEntities(child, filePath, entities, relationships, namespace);
            }
          }
      }
    } finally {
      this.recursionDepth--;
    }
  }

  /**
   * Extract namespace entities
   */
  private extractNamespace(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[]
  ): void {
    const nameNode = node.childForFieldName("name");
    const bodyNode = node.childForFieldName("body");

    if (nameNode && bodyNode) {
      const namespaceName = nameNode.text;

      const entity: ParsedEntity = {
        name: namespaceName,
        type: "class", // Using 'class' since 'namespace' isn't in the type union
        location: this.getNodeLocation(node),
        modifiers: ["namespace"]
      };

      entities.push(entity);

      // Process namespace contents
      for (const child of bodyNode.children) {
        this.extractEntities(child, filePath, entities, relationships, namespaceName);
      }
    }
  }

  /**
   * Extract class/struct entities
   */
  private extractClass(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    namespace: string
  ): void {
    const nameNode = node.childForFieldName("name");
    const bodyNode = node.childForFieldName("body");

    if (!nameNode) return;

    const className = nameNode.text;
    const fullName = namespace ? `${namespace}::${className}` : className;

    // Track nested class complexity
    if (namespace.includes("::")) {
      this.complexityScore.nestedClasses++;
    }

    // Collect modifiers for the class
    const modifiers: string[] = [];
    if (node.type === "struct_specifier") modifiers.push("struct");
    if (this.isAbstractClass(node)) modifiers.push("abstract");
    if (this.isFinalClass(node)) modifiers.push("final");

    const entity: ParsedEntity = {
      name: fullName,
      type: "class",
      location: this.getNodeLocation(node),
      modifiers: modifiers.length > 0 ? modifiers : undefined
    };

    entities.push(entity);

    // Extract base classes (inheritance)
    const baseList = node.childForFieldName("base_class_clause");
    if (baseList) {
      this.extractInheritance(baseList, fullName, relationships, filePath);
    }

    // Process class body
    if (bodyNode) {
      this.extractClassMembers(bodyNode, fullName, filePath, entities, relationships);
    }
  }

  /**
   * Extract class members (methods, fields, etc.)
   */
  private extractClassMembers(
    bodyNode: TreeSitterNode,
    className: string,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[]
  ): void {
    let currentAccessSpecifier = "private"; // Default for class, "public" for struct

    for (const child of bodyNode.children) {
      switch (child.type) {
        case "access_specifier":
          // Update current access level
          const specifierNode = child.firstChild;
          if (specifierNode) {
            currentAccessSpecifier = specifierNode.text.replace(":", "");
          }
          break;

        case "function_definition":
          this.extractMethod(child, className, filePath, entities, relationships, currentAccessSpecifier);
          break;

        case "field_declaration":
          this.extractField(child, className, filePath, entities, relationships, currentAccessSpecifier);
          break;

        case "friend_declaration":
          this.extractFriend(child, className, relationships, filePath);
          break;

        case "using_declaration":
          // Handle using declarations within class
          this.extractUsing(child, filePath, entities, relationships, className);
          break;

        case "template_declaration":
          // Member templates
          this.templateDepth++;
          if (this.templateDepth <= MAX_TEMPLATE_DEPTH) {
            this.extractTemplate(child, filePath, entities, relationships, className);
          }
          this.templateDepth--;
          break;

        case "declaration":
          // Process nested declarations
          for (const decl of child.children) {
            if (decl.type === "function_definition") {
              this.extractMethod(decl, className, filePath, entities, relationships, currentAccessSpecifier);
            } else if (decl.type === "field_declaration") {
              this.extractField(decl, className, filePath, entities, relationships, currentAccessSpecifier);
            }
          }
          break;
      }
    }
  }

  /**
   * Extract method/function entities
   */
  private extractMethod(
    node: TreeSitterNode,
    className: string,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    accessSpecifier: string = "public"
  ): void {
    const declaratorNode = node.childForFieldName("declarator");
    if (!declaratorNode) return;

    const functionName = this.extractFunctionName(declaratorNode);
    if (!functionName) return;

    const fullName = `${className}::${functionName}`;

    // Check for operator overloading
    const isOperator = functionName.startsWith("operator");
    if (isOperator) {
      this.complexityScore.operatorCount++;
    }

    // Check for special methods
    const isConstructor = functionName === className.split("::").pop();
    const isDestructor = functionName.startsWith("~");

    // Extract method qualifiers
    const qualifiers = this.extractMethodQualifiers(node);

    // Collect modifiers
    const modifiers: string[] = [];
    if (accessSpecifier !== "public") modifiers.push(accessSpecifier);
    if (qualifiers.isStatic) modifiers.push("static");
    if (qualifiers.isConst) modifiers.push("const");
    if (qualifiers.isVirtual) modifiers.push("virtual");
    if (qualifiers.isOverride) modifiers.push("override");
    if (qualifiers.isFinal) modifiers.push("final");
    if (qualifiers.isNoexcept) modifiers.push("noexcept");
    if (isOperator) modifiers.push("operator");

    // Determine the correct type for ParsedEntity
    let entityType: ParsedEntity["type"] = "method";
    if (isConstructor || isDestructor) {
      entityType = "method"; // No specific constructor/destructor in the type union
    }

    const entity: ParsedEntity = {
      name: fullName,
      type: entityType,
      location: this.getNodeLocation(node),
      modifiers: modifiers.length > 0 ? modifiers : undefined
    };

    entities.push(entity);

    // Create relationship to parent class
    relationships.push({
      from: fullName,
      to: className,
      type: "member_of"
    });
  }

  /**
   * Extract field/member variable entities
   */
  private extractField(
    node: TreeSitterNode,
    className: string,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    accessSpecifier: string
  ): void {
    const declaratorNode = node.childForFieldName("declarator");
    if (!declaratorNode) return;

    const fieldName = this.extractFieldName(declaratorNode);
    if (!fieldName) return;

    const fullName = `${className}::${fieldName}`;

    // Check if it's static or const
    const isStatic = node.text.includes("static");
    const isConst = node.text.includes("const");
    const isMutable = node.text.includes("mutable");

    // Collect modifiers
    const modifiers: string[] = [];
    if (accessSpecifier !== "public") modifiers.push(accessSpecifier);
    if (isStatic) modifiers.push("static");
    if (isConst) modifiers.push("const");
    if (isMutable) modifiers.push("mutable");

    const entity: ParsedEntity = {
      name: fullName,
      type: "property", // Using 'property' for fields
      location: this.getNodeLocation(node),
      modifiers: modifiers.length > 0 ? modifiers : undefined
    };

    entities.push(entity);

    // Create relationship to parent class
    relationships.push({
      from: fullName,
      to: className,
      type: "member_of"
    });
  }

  /**
   * Extract function entities (non-member functions)
   */
  private extractFunction(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    namespace: string,
    isTemplate: boolean = false
  ): void {
    const declaratorNode = node.childForFieldName("declarator");
    if (!declaratorNode) return;

    const functionName = this.extractFunctionName(declaratorNode);
    if (!functionName) return;

    const fullName = namespace ? `${namespace}::${functionName}` : functionName;

    // Collect modifiers
    const modifiers: string[] = [];
    if (isTemplate) modifiers.push("template");
    if (node.text.includes("inline")) modifiers.push("inline");
    if (node.text.includes("extern")) modifiers.push("extern");

    const entity: ParsedEntity = {
      name: fullName,
      type: "function",
      location: this.getNodeLocation(node),
      modifiers: modifiers.length > 0 ? modifiers : undefined
    };

    entities.push(entity);

    // If in namespace, create relationship
    if (namespace) {
      relationships.push({
        from: fullName,
        to: namespace,
        type: "member_of"
      });
    }
  }

  /**
   * Extract template entities (Phase 4 - Limited support)
   */
  private extractTemplate(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    namespace: string
  ): void {
    // Increase template depth for circuit breaker
    this.templateDepth++;
    this.complexityScore.templateDepth++;

    // Check if we should skip complex templates
    if (this.templateDepth > MAX_TEMPLATE_DEPTH) {
      console.warn(`[CppAnalyzer] Skipping deeply nested template at depth ${this.templateDepth}`);
      this.templateDepth--;
      return;
    }

    const parametersNode = node.childForFieldName("parameters");
    const declarationNode = node.children.find(
      child => child.type === "class_specifier" ||
               child.type === "struct_specifier" ||
               child.type === "function_definition"
    );

    if (!declarationNode) {
      this.templateDepth--;
      return;
    }

    // Extract template parameters (simple support only)
    const templateParams = this.extractTemplateParameters(parametersNode);

    // Skip variadic templates and complex SFINAE patterns
    if (this.isComplexTemplate(templateParams, node.text)) {
      console.warn(`[CppAnalyzer] Skipping complex template pattern`);
      this.templateDepth--;
      return;
    }

    // Generate cache key for memoization
    const cacheKey = `${namespace}::${declarationNode.type}::${templateParams}`;

    // Check memoization cache
    if (this.templateCache.has(cacheKey)) {
      entities.push(this.templateCache.get(cacheKey)!);
      this.templateDepth--;
      return;
    }

    // Process the template declaration
    if (declarationNode.type === "class_specifier" || declarationNode.type === "struct_specifier") {
      this.extractClass(declarationNode, filePath, entities, relationships, namespace);
      // Mark the last entity as a template
      if (entities.length > 0) {
        const lastEntity = entities[entities.length - 1];
        if (!lastEntity.modifiers) lastEntity.modifiers = [];
        lastEntity.modifiers.push("template");
        if (templateParams) {
          lastEntity.modifiers.push(`template<${templateParams}>`);
        }
        this.templateCache.set(cacheKey, lastEntity);
      }
    } else if (declarationNode.type === "function_definition") {
      this.extractFunction(declarationNode, filePath, entities, relationships, namespace, true);
      // Mark the last entity as a template
      if (entities.length > 0) {
        const lastEntity = entities[entities.length - 1];
        if (!lastEntity.modifiers) lastEntity.modifiers = [];
        lastEntity.modifiers.push("template");
        if (templateParams) {
          lastEntity.modifiers.push(`template<${templateParams}>`);
        }
        this.templateCache.set(cacheKey, lastEntity);
      }
    }

    this.templateDepth--;
  }

  /**
   * Extract using declarations and directives
   */
  private extractUsing(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    namespace: string
  ): void {
    // Extract the name being used
    const nameNode = node.children.find(child =>
      child.type === "qualified_identifier" ||
      child.type === "identifier"
    );

    if (nameNode) {
      const targetName = nameNode.text;

      // Create a using relationship
      if (namespace) {
        relationships.push({
          from: namespace,
          to: targetName,
          type: "uses"
        });
      }
    }
  }

  /**
   * Extract enum entities
   */
  private extractEnum(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    namespace: string
  ): void {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;

    const enumName = nameNode.text;
    const fullName = namespace ? `${namespace}::${enumName}` : enumName;

    // Collect modifiers
    const modifiers: string[] = [];
    if (node.text.includes("class") || node.text.includes("struct")) {
      modifiers.push("scoped");
    }

    const entity: ParsedEntity = {
      name: fullName,
      type: "enum", // This is a valid type in ParsedEntity
      location: this.getNodeLocation(node),
      modifiers: modifiers.length > 0 ? modifiers : undefined
    };

    entities.push(entity);

    // Extract enum values
    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      for (const child of bodyNode.children) {
        if (child.type === "enumerator") {
          const enumeratorName = child.childForFieldName("name");
          if (enumeratorName) {
            const valueName = `${fullName}::${enumeratorName.text}`;
            entities.push({
              name: valueName,
              type: "constant", // Using 'constant' for enum values
              location: this.getNodeLocation(child),
              modifiers: ["enum_value"]
            });

            relationships.push({
              from: valueName,
              to: fullName,
              type: "member_of"
            });
          }
        }
      }
    }
  }

  /**
   * Extract inheritance relationships
   */
  private extractInheritance(
    baseListNode: TreeSitterNode,
    derivedClass: string,
    relationships: EntityRelationship[],
    filePath: string
  ): void {
    let inheritanceDepth = 0;

    for (const child of baseListNode.children) {
      if (child.type === "base_class_specifier" || child.type === "base_specifier") {
        inheritanceDepth++;

        // Track inheritance depth for complexity
        this.complexityScore.inheritanceDepth = Math.max(
          this.complexityScore.inheritanceDepth,
          inheritanceDepth
        );

        // Check for virtual inheritance
        const isVirtual = child.text.includes("virtual");

        // Extract access specifier (public, protected, private)
        let accessSpecifier = "private"; // default for class
        if (child.text.includes("public")) accessSpecifier = "public";
        else if (child.text.includes("protected")) accessSpecifier = "protected";

        // Find the base class name
        const baseNameNode = child.children.find(
          node => node.type === "type_identifier" ||
                  node.type === "qualified_identifier"
        );

        if (baseNameNode) {
          const baseClassName = baseNameNode.text;

          relationships.push({
            from: derivedClass,
            to: baseClassName,
            type: "inherits"
          });
        }
      }
    }
  }

  /**
   * Extract friend relationships
   */
  private extractFriend(
    node: TreeSitterNode,
    className: string,
    relationships: EntityRelationship[],
    filePath: string
  ): void {
    // Find the friend declaration target
    const friendTarget = node.children.find(
      child => child.type === "type_identifier" ||
               child.type === "qualified_identifier" ||
               child.type === "function_definition"
    );

    if (friendTarget) {
      const friendName = friendTarget.type === "function_definition"
        ? this.extractFunctionName(friendTarget.childForFieldName("declarator"))
        : friendTarget.text;

      if (friendName) {
        relationships.push({
          from: className,
          to: friendName,
          type: "friend_of"
        });
      }
    }
  }

  /**
   * Build semantic graph with lazy evaluation (Phase 2)
   */
  private buildSemanticGraph(
    entities: ParsedEntity[],
    relationships: EntityRelationship[]
  ): void {
    // This is where we would build a richer semantic graph
    // For now, we're keeping the syntactic information
    // Future enhancement: Add type resolution, symbol tables, etc.

    // Validate relationships
    const entityNames = new Set(entities.map(e => e.name));

    // Remove invalid relationships
    const validRelationships = relationships.filter(rel => {
      // Keep relationships even if target doesn't exist (might be external)
      return rel.from && rel.to;
    });

    // Update relationships array
    relationships.length = 0;
    relationships.push(...validRelationships);
  }

  /**
   * Helper: Extract function name from declarator
   */
  private extractFunctionName(declaratorNode: TreeSitterNode | null): string | null {
    if (!declaratorNode) return null;

    // Handle different declarator types
    if (declaratorNode.type === "function_declarator") {
      const nameNode = declaratorNode.childForFieldName("declarator");
      if (nameNode?.type === "identifier") {
        return nameNode.text;
      } else if (nameNode?.type === "qualified_identifier") {
        return nameNode.text.split("::").pop() || null;
      } else if (nameNode?.type === "operator_name") {
        return nameNode.text;
      } else if (nameNode?.type === "destructor_name") {
        return nameNode.text;
      } else if (nameNode) {
        return this.extractFunctionName(nameNode);
      }
    } else if (declaratorNode.type === "identifier") {
      return declaratorNode.text;
    } else if (declaratorNode.type === "qualified_identifier") {
      return declaratorNode.text.split("::").pop() || null;
    } else if (declaratorNode.type === "operator_name") {
      return declaratorNode.text;
    } else if (declaratorNode.type === "destructor_name") {
      return declaratorNode.text;
    } else if (declaratorNode.type === "reference_declarator" ||
               declaratorNode.type === "pointer_declarator") {
      // Handle reference and pointer declarators
      const innerDeclarator = declaratorNode.childForFieldName("declarator");
      return this.extractFunctionName(innerDeclarator);
    }

    return null;
  }

  /**
   * Helper: Extract field name from declarator
   */
  private extractFieldName(declaratorNode: TreeSitterNode | null): string | null {
    if (!declaratorNode) return null;

    if (declaratorNode.type === "identifier") {
      return declaratorNode.text;
    } else if (declaratorNode.type === "array_declarator") {
      const nameNode = declaratorNode.childForFieldName("declarator");
      return this.extractFieldName(nameNode);
    } else if (declaratorNode.type === "pointer_declarator" ||
               declaratorNode.type === "reference_declarator") {
      const innerDeclarator = declaratorNode.childForFieldName("declarator");
      return this.extractFieldName(innerDeclarator);
    }

    return null;
  }

  /**
   * Helper: Extract method qualifiers
   */
  private extractMethodQualifiers(node: TreeSitterNode): {
    isStatic: boolean;
    isConst: boolean;
    isVirtual: boolean;
    isOverride: boolean;
    isFinal: boolean;
    isNoexcept: boolean;
  } {
    const text = node.text;

    return {
      isStatic: text.includes("static"),
      isConst: /\bconst\s*[{;]/.test(text) || /\)\s*const/.test(text),
      isVirtual: text.includes("virtual"),
      isOverride: text.includes("override"),
      isFinal: text.includes("final"),
      isNoexcept: text.includes("noexcept")
    };
  }

  /**
   * Helper: Check if class is abstract
   */
  private isAbstractClass(node: TreeSitterNode): boolean {
    // A class is abstract if it has pure virtual methods (= 0)
    return node.text.includes("= 0");
  }

  /**
   * Helper: Check if class is final
   */
  private isFinalClass(node: TreeSitterNode): boolean {
    // Check for final keyword after class name
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      const nextNode = nameNode.nextSibling;
      return nextNode?.text === "final";
    }
    return false;
  }

  /**
   * Helper: Extract template parameters (simple support)
   */
  private extractTemplateParameters(parametersNode: TreeSitterNode | null): string {
    if (!parametersNode) return "";

    const params: string[] = [];
    for (const child of parametersNode.children) {
      if (child.type === "template_parameter" ||
          child.type === "type_template_parameter" ||
          child.type === "template_template_parameter") {
        // Extract parameter name
        const nameNode = child.childForFieldName("name");
        if (nameNode) {
          params.push(nameNode.text);
        }
      }
    }

    return params.join(", ");
  }

  /**
   * Helper: Check if template is too complex to analyze
   */
  private isComplexTemplate(templateParams: string, nodeText: string): boolean {
    // Skip variadic templates
    if (templateParams.includes("...") || nodeText.includes("...")) {
      return true;
    }

    // Skip SFINAE patterns (enable_if, is_same, etc.)
    const sfainaePatterns = [
      "enable_if",
      "is_same",
      "is_base_of",
      "conditional",
      "decay",
      "remove_reference",
      "typename std::enable_if"
    ];

    for (const pattern of sfainaePatterns) {
      if (nodeText.includes(pattern)) {
        return true;
      }
    }

    // Skip complex template metaprogramming patterns
    if (nodeText.includes("template<template")) {
      return true;
    }

    return false;
  }
}

/**
 * Custom error for circuit breaker triggers
 */
class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}