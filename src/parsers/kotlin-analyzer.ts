/**
 * Kotlin Language Analyzer for code-graph-rag-mcp
 *
 * Comprehensive Kotlin support covering ALL language features:
 *
 * Declarations:
 * - Packages and imports (with aliases)
 * - Classes (regular, data, sealed, inner, value, annotation, enum)
 * - Interfaces (regular and functional/SAM)
 * - Object declarations (singletons)
 * - Companion objects
 * - Functions (top-level, member, extension, suspend, inline, infix, operator, tailrec)
 * - Properties (top-level, member, extension, const, lateinit, delegated)
 * - Constructors (primary and secondary)
 * - Init blocks
 * - Type aliases
 * - Enum entries
 * - Getters/Setters
 *
 * Expressions:
 * - Lambda expressions
 * - Anonymous functions
 * - Object expressions (anonymous classes)
 * - Callable references (::)
 * - Local functions
 *
 * Relationships:
 * - Inheritance (extends)
 * - Implementation (implements)
 * - Member relationships
 * - Method calls
 * - Import dependencies
 * - Callable references
 * - Property delegation
 * - Override relationships
 * - Companion relationships
 * - Type constraints
 * - Type alias relationships
 *
 * Implementation uses circuit breakers for safety and follows the proven
 * pattern from Java analyzer with Kotlin-specific adaptations.
 *
 * Architecture References:
 * - ADR-006: Kotlin Language Support (tree-sitter + KotlinAnalyzer)
 *
 * @adr_ref ADR-006
 */

import type { EntityRelationship, ParsedEntity, TreeSitterNode } from "../types/parser.js";

// Circuit breaker constants
const MAX_RECURSION_DEPTH = 50;
const VERBOSE = process.env.KOTLIN_ANALYZER_VERBOSE === "1";
const PARSE_TIMEOUT_MS = VERBOSE ? 30000 : 10000;

// Verbose logging - enable for debugging
const log = (level: string, ...args: any[]) => {
  if (VERBOSE) {
    const timestamp = new Date().toISOString().split("T")[1];
    console.log(`[${timestamp}][KotlinAnalyzer][${level}]`, ...args);
  }
};

// Custom error class for circuit breaker failures
class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class KotlinAnalyzer {
  // Circuit breaker state
  private recursionDepth = 0;
  private parseStartTime = 0;

  // Context tracking
  private currentPackage = "";
  private currentClass: string | null = null;
  private currentFunction: string | null = null;
  private classStack: string[] = [];

  /**
   * Helper: Convert tree-sitter position to ParsedEntity location
   */
  private getNodeLocation(node: TreeSitterNode) {
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
   * Ensure a module entity exists for the current package
   */
  private ensurePackageEntity(filePath: string, entities: ParsedEntity[]): string {
    const pkg = this.currentPackage || "(default)";
    const moduleId = `${filePath}:package:${pkg}`;

    const exists = entities.some((e) => e.id === moduleId);
    if (!exists) {
      entities.push({
        id: moduleId,
        name: pkg,
        type: "module",
        filePath,
        location: {
          start: { line: 1, column: 0, index: 0 },
          end: { line: 1, column: 0, index: 0 },
        },
        metadata: { isPackage: true },
      });
    }
    return moduleId;
  }

  /**
   * Main entry point for analyzing Kotlin code
   */
  async analyze(
    rootNode: TreeSitterNode,
    filePath: string,
  ): Promise<{ entities: ParsedEntity[]; relationships: EntityRelationship[] }> {
    log("INFO", `>>> ANALYZE START: ${filePath}`);
    log("DEBUG", `Root node type: ${rootNode.type}, children: ${rootNode.childCount}`);

    this.resetState();

    const entities: ParsedEntity[] = [];
    const relationships: EntityRelationship[] = [];

    try {
      log("DEBUG", "Starting entity extraction...");
      this.extractEntities(rootNode, filePath, entities, relationships);
      log(
        "INFO",
        `<<< ANALYZE END: ${filePath} - Extracted ${entities.length} entities, ${relationships.length} relationships`,
      );
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        log("WARN", `Circuit breaker triggered for ${filePath}: ${error.message}`);
        console.warn(`[KotlinAnalyzer] Circuit breaker triggered for ${filePath}: ${error.message}`);
      } else {
        log("ERROR", `Error analyzing ${filePath}:`, error);
        console.error(`[KotlinAnalyzer] Error analyzing ${filePath}:`, error);
      }
    }

    return { entities, relationships };
  }

  /**
   * Reset analyzer state for new file
   */
  private resetState(): void {
    this.recursionDepth = 0;
    this.parseStartTime = Date.now();
    this.currentPackage = "";
    this.currentClass = null;
    this.currentFunction = null;
    this.classStack = [];
  }

  /**
   * Check circuit breakers
   */
  private checkCircuitBreakers(): void {
    if (this.recursionDepth > MAX_RECURSION_DEPTH) {
      log("ERROR", `Circuit breaker: max recursion depth ${MAX_RECURSION_DEPTH} exceeded!`);
      throw new CircuitBreakerError(`Maximum recursion depth ${MAX_RECURSION_DEPTH} exceeded`);
    }

    const elapsedTime = Date.now() - this.parseStartTime;

    // Warn at 80% of timeout
    if (elapsedTime > PARSE_TIMEOUT_MS * 0.8 && elapsedTime < PARSE_TIMEOUT_MS) {
      log("WARN", `Approaching timeout: ${elapsedTime}ms / ${PARSE_TIMEOUT_MS}ms`);
    }

    if (elapsedTime > PARSE_TIMEOUT_MS) {
      log("ERROR", `Circuit breaker: parse timeout ${PARSE_TIMEOUT_MS}ms exceeded!`);
      throw new CircuitBreakerError(`Parse timeout ${PARSE_TIMEOUT_MS}ms exceeded`);
    }
  }

  /**
   * Push class context for nested classes
   */
  private pushClassContext(className: string): void {
    if (this.currentClass) {
      this.classStack.push(this.currentClass);
    }
    this.currentClass = this.currentClass ? `${this.currentClass}.${className}` : className;
  }

  /**
   * Pop class context after processing nested class
   */
  private popClassContext(): void {
    this.currentClass = this.classStack.pop() || null;
  }

  /**
   * Extract entities from Kotlin AST
   */
  private extractEntities(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    this.recursionDepth++;

    // Log every 10 depth levels to avoid excessive logging
    if (this.recursionDepth % 10 === 1 || this.recursionDepth <= 3) {
      log("TRACE", `extractEntities: depth=${this.recursionDepth}, type=${node.type}, children=${node.childCount}`);
    }

    this.checkCircuitBreakers();

    try {
      switch (node.type) {
        case "source_file":
          log("DEBUG", `Processing source_file with ${node.childCount} children`);
          // Process source file (root node)
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
              this.extractEntities(child, filePath, entities, relationships);
            }
          }
          break;

        case "package_header":
          log("DEBUG", `Found package_header`);
          this.extractPackage(node, filePath, entities);
          break;

        case "import_header":
        case "import_list":
          log("TRACE", `Found ${node.type}`);
          this.extractImports(node, filePath, entities, relationships);
          break;

        case "class_declaration":
          log("DEBUG", `Found class_declaration`);
          this.extractClass(node, filePath, entities, relationships);
          break;

        case "object_declaration":
          log("DEBUG", `Found object_declaration`);
          this.extractObject(node, filePath, entities, relationships);
          break;

        case "companion_object":
          log("DEBUG", `Found companion_object`);
          this.extractCompanionObject(node, filePath, entities, relationships);
          break;

        case "function_declaration":
          log("DEBUG", `Found function_declaration`);
          this.extractFunction(node, filePath, entities, relationships);
          break;

        case "property_declaration":
          log("TRACE", `Found property_declaration`);
          this.extractProperty(node, filePath, entities, relationships);
          break;

        case "secondary_constructor":
          if (this.currentClass) {
            log("DEBUG", `Found secondary_constructor in ${this.currentClass}`);
            this.extractSecondaryConstructor(node, filePath, entities, relationships);
          }
          break;

        case "anonymous_initializer":
          if (this.currentClass) {
            log("DEBUG", `Found anonymous_initializer in ${this.currentClass}`);
            this.extractInitBlock(node, filePath, entities, relationships);
          }
          break;

        case "type_alias":
          log("DEBUG", `Found type_alias`);
          this.extractTypeAlias(node, filePath, entities, relationships);
          break;

        case "enum_entry":
          if (this.currentClass) {
            log("TRACE", `Found enum_entry in ${this.currentClass}`);
            this.extractEnumEntry(node, filePath, entities, relationships);
          }
          break;

        case "lambda_literal":
          log("TRACE", `Found lambda_literal`);
          this.extractLambda(node, filePath, entities, relationships);
          break;

        case "anonymous_function":
          log("TRACE", `Found anonymous_function`);
          this.extractAnonymousFunction(node, filePath, entities, relationships);
          break;

        case "object_literal":
          log("TRACE", `Found object_literal`);
          this.extractObjectLiteral(node, filePath, entities, relationships);
          break;

        default:
          // Recursively process children for unhandled node types
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
              this.extractEntities(child, filePath, entities, relationships);
            }
          }
      }
    } finally {
      this.recursionDepth--;
    }
  }

  /**
   * Extract package declaration
   */
  private extractPackage(node: TreeSitterNode, filePath: string, entities: ParsedEntity[]): void {
    log("TRACE", `extractPackage: node.text="${node.text.substring(0, 50)}..."`);

    const identifierNode = node.namedChildren.find((c) => c.type === "identifier" || c.type === "simple_identifier");

    // Try to get full package name from the node text
    let packageName = "";
    if (identifierNode) {
      packageName = identifierNode.text;
    } else {
      // Extract from node text: "package org.example.app"
      const match = node.text.match(/package\s+([\w.]+)/);
      if (match?.[1]) {
        packageName = match[1];
      }
    }

    if (packageName) {
      this.currentPackage = packageName;
      log("DEBUG", `Extracted package: ${packageName}`);

      entities.push({
        id: `${filePath}:package:${packageName}`,
        name: packageName,
        type: "module",
        filePath,
        location: this.getNodeLocation(node),
        metadata: {
          isPackage: true,
        },
      });
    } else {
      log("WARN", `Could not extract package name from: ${node.text.substring(0, 100)}`);
    }
  }

  /**
   * Extract imports and create relationships
   */
  private extractImports(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    // Handle import_list by processing children
    if (node.type === "import_list") {
      for (const child of node.namedChildren) {
        if (child.type === "import_header") {
          this.extractImports(child, filePath, entities, relationships);
        }
      }
      return;
    }

    // Extract import path
    const identifierNode = node.namedChildren.find((c) => c.type === "identifier" || c.type === "simple_identifier");

    let importPath = "";
    let alias: string | undefined;
    let isWildcard = false;

    // Try to parse from node text
    const nodeText = node.text;
    const aliasMatch = nodeText.match(/import\s+([\w.]+)\s+as\s+(\w+)/);
    const wildcardMatch = nodeText.match(/import\s+([\w.]+)\.\*/);
    const simpleMatch = nodeText.match(/import\s+([\w.]+)/);

    if (aliasMatch?.[1] && aliasMatch[2]) {
      importPath = aliasMatch[1];
      alias = aliasMatch[2];
    } else if (wildcardMatch?.[1]) {
      importPath = wildcardMatch[1];
      isWildcard = true;
    } else if (simpleMatch?.[1]) {
      importPath = simpleMatch[1];
    } else if (identifierNode) {
      importPath = identifierNode.text;
    }

    if (importPath) {
      const fromId = this.ensurePackageEntity(filePath, entities);

      relationships.push({
        from: fromId,
        to: importPath,
        type: "imports",
        metadata: {
          isWildcard,
          alias,
        },
      });
    }
  }

  /**
   * Extract class declaration (including data, sealed, enum, annotation, inner, value classes)
   */
  private extractClass(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    log("TRACE", `extractClass: starting, namedChildren=${node.namedChildren.length}`);

    // Get class name
    const nameNode = node.namedChildren.find((c) => c.type === "type_identifier" || c.type === "simple_identifier");
    const className = nameNode?.text;

    if (!className) {
      log("WARN", `extractClass: could not find class name in: ${node.text.substring(0, 100)}`);
      return;
    }

    log("DEBUG", `extractClass: found class "${className}"`);

    // Get modifiers
    const modifiers = this.extractModifiers(node);

    // Determine class type from modifiers or keywords
    const isData = modifiers.includes("data");
    const isSealed = modifiers.includes("sealed");
    const isInner = modifiers.includes("inner");
    const isValue = modifiers.includes("value");
    const isAnnotation = modifiers.includes("annotation");
    const isEnum = modifiers.includes("enum");
    const isAbstract = modifiers.includes("abstract");
    const isOpen = modifiers.includes("open");
    const isFinal = !isOpen && !isAbstract && !isSealed;
    const isExpect = modifiers.includes("expect");
    const isActual = modifiers.includes("actual");

    // Check if it's an interface or fun interface
    const nodeText = node.text;
    const isInterface = nodeText.includes("interface ") && !nodeText.includes("class ");
    const isFunctionalInterface = nodeText.includes("fun interface ");

    // Push class context for nested processing
    this.pushClassContext(className);
    const fullClassName = this.currentClass!;
    const classId = `${filePath}:class:${fullClassName}`;

    const entityType = isInterface ? "interface" : "class";

    const entity: ParsedEntity = {
      id: classId,
      name: fullClassName,
      type: entityType,
      filePath,
      location: this.getNodeLocation(node),
      modifiers,
      metadata: {
        isData,
        isSealed,
        isInner,
        isValue,
        isAnnotation,
        isEnum,
        isAbstract,
        isOpen,
        isFinal,
        isExpect,
        isActual,
        isInterface,
        isFunctionalInterface,
        package: this.currentPackage,
        isInnerClass: this.classStack.length > 0,
      },
    };

    entities.push(entity);

    // Extract primary constructor if present
    const primaryConstructor = node.namedChildren.find((c) => c.type === "primary_constructor");
    if (primaryConstructor) {
      this.extractPrimaryConstructor(primaryConstructor, filePath, entities, relationships, fullClassName);
    }

    // Extract inheritance (delegation_specifier)
    const delegationSpecifiers = node.namedChildren.filter((c) => c.type === "delegation_specifier");
    for (const spec of delegationSpecifiers) {
      this.extractInheritance(spec, classId, filePath, relationships, isInterface);
    }

    // Extract type parameters
    const typeParams = node.namedChildren.find((c) => c.type === "type_parameters");
    if (typeParams) {
      const typeParamList = this.extractTypeParameters(typeParams);
      if (typeParamList.length > 0) {
        (entity.metadata as any).typeParameters = typeParamList;
      }
    }

    // Extract type constraints (where clause)
    const typeConstraints = node.namedChildren.find((c) => c.type === "type_constraints");
    if (typeConstraints) {
      const constraints = this.extractTypeConstraints(typeConstraints);
      if (constraints.length > 0) {
        (entity.metadata as any).typeConstraints = constraints;
      }
    }

    // Process class body
    const classBody = node.namedChildren.find((c) => c.type === "class_body" || c.type === "enum_class_body");
    if (classBody) {
      for (const child of classBody.namedChildren) {
        this.extractEntities(child, filePath, entities, relationships);
      }
    }

    // Pop class context
    this.popClassContext();
  }

  /**
   * Extract object declaration (singleton)
   */
  private extractObject(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    const nameNode = node.namedChildren.find((c) => c.type === "type_identifier" || c.type === "simple_identifier");
    const objectName = nameNode?.text;

    if (!objectName) return;

    const modifiers = this.extractModifiers(node);

    this.pushClassContext(objectName);
    const fullObjectName = this.currentClass!;
    const objectId = `${filePath}:class:${fullObjectName}`;

    const entity: ParsedEntity = {
      id: objectId,
      name: fullObjectName,
      type: "class",
      filePath,
      location: this.getNodeLocation(node),
      modifiers,
      metadata: {
        isSingleton: true,
        isObject: true,
        package: this.currentPackage,
      },
    };

    entities.push(entity);

    // Extract inheritance
    const delegationSpecifiers = node.namedChildren.filter((c) => c.type === "delegation_specifier");
    for (const spec of delegationSpecifiers) {
      this.extractInheritance(spec, objectId, filePath, relationships, false);
    }

    // Process object body
    const objectBody = node.namedChildren.find((c) => c.type === "class_body");
    if (objectBody) {
      for (const child of objectBody.namedChildren) {
        this.extractEntities(child, filePath, entities, relationships);
      }
    }

    this.popClassContext();
  }

  /**
   * Extract companion object
   */
  private extractCompanionObject(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    const parentClass = this.currentClass;
    if (!parentClass) return;

    // Get companion object name (optional)
    const nameNode = node.namedChildren.find((c) => c.type === "type_identifier" || c.type === "simple_identifier");
    const companionName = nameNode?.text || "Companion";

    const modifiers = this.extractModifiers(node);

    const fullCompanionName = `${parentClass}.${companionName}`;
    const companionId = `${filePath}:class:${fullCompanionName}`;
    const parentClassId = `${filePath}:class:${parentClass}`;

    const entity: ParsedEntity = {
      id: companionId,
      name: fullCompanionName,
      type: "class",
      filePath,
      location: this.getNodeLocation(node),
      modifiers,
      metadata: {
        isCompanion: true,
        companionName,
        parentClass,
        package: this.currentPackage,
      },
    };

    entities.push(entity);

    // Create companion_of relationship
    relationships.push({
      from: companionId,
      to: parentClassId,
      type: "contains",
      metadata: {
        memberType: "companion",
      },
    });

    // Process companion body with temporary class context
    const previousClass = this.currentClass;
    this.currentClass = fullCompanionName;

    const companionBody = node.namedChildren.find((c) => c.type === "class_body");
    if (companionBody) {
      for (const child of companionBody.namedChildren) {
        this.extractEntities(child, filePath, entities, relationships);
      }
    }

    this.currentClass = previousClass;
  }

  /**
   * Extract function declaration
   */
  private extractFunction(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    log("TRACE", `extractFunction: starting`);

    const nameNode = node.namedChildren.find((c) => c.type === "simple_identifier");
    const functionName = nameNode?.text;

    if (!functionName) {
      log("TRACE", `extractFunction: no function name found`);
      return;
    }

    log("DEBUG", `extractFunction: found function "${functionName}" in ${this.currentClass || "top-level"}`);

    const modifiers = this.extractModifiers(node);

    // Check for extension function (receiver_type)
    const receiverType = this.extractReceiverType(node);
    const isExtension = !!receiverType;

    // Extract function modifiers
    const isSuspend = modifiers.includes("suspend");
    const isInline = modifiers.includes("inline");
    const isInfix = modifiers.includes("infix");
    const isOperator = modifiers.includes("operator");
    const isTailrec = modifiers.includes("tailrec");
    const isExternal = modifiers.includes("external");
    const isOverride = modifiers.includes("override");
    const isExpect = modifiers.includes("expect");
    const isActual = modifiers.includes("actual");

    // Determine if top-level or member
    const isTopLevel = !this.currentClass;
    const isLocal = !!this.currentFunction;

    // Track local functions
    const previousFunction = this.currentFunction;

    let fullFunctionName: string;
    let functionId: string;

    if (isLocal && previousFunction) {
      fullFunctionName = `${previousFunction}.${functionName}`;
      functionId = `${filePath}:function:${fullFunctionName}`;
    } else if (this.currentClass) {
      fullFunctionName = `${this.currentClass}.${functionName}`;
      functionId = `${filePath}:class:${this.currentClass}:method:${functionName}`;
    } else {
      fullFunctionName = functionName;
      functionId = `${filePath}:function:${functionName}`;
    }

    // Extract return type
    const returnTypeNode = node.namedChildren.find((c) => c.type === "type");
    const returnType = returnTypeNode?.text;

    // Extract parameters
    const paramsNode = node.namedChildren.find((c) => c.type === "function_value_parameters");
    const parameters = paramsNode ? this.extractParameters(paramsNode) : [];

    // Extract type parameters
    const typeParamsNode = node.namedChildren.find((c) => c.type === "type_parameters");
    const typeParameters = typeParamsNode ? this.extractTypeParameters(typeParamsNode) : [];

    // Check for reified type parameters
    const hasReified = typeParameters.some((tp) => tp.isReified);

    const entity: ParsedEntity = {
      id: functionId,
      name: isExtension ? `${receiverType}.${functionName}` : functionName,
      type: "method",
      filePath,
      location: this.getNodeLocation(node),
      modifiers,
      returnType,
      parameters,
      metadata: {
        isExtension,
        receiverType,
        isSuspend,
        isInline,
        isInfix,
        isOperator,
        isTailrec,
        isExternal,
        isOverride,
        isExpect,
        isActual,
        isTopLevel,
        isLocal,
        parentFunction: isLocal ? previousFunction : undefined,
        hasReified,
        typeParameters: typeParameters.length > 0 ? typeParameters : undefined,
        parent: this.currentClass,
        package: this.currentPackage,
      },
    };

    // Extract annotations
    const annotations = this.extractAnnotations(node);
    if (annotations.length > 0) {
      (entity.metadata as any).annotations = annotations;
    }

    entities.push(entity);

    // Create member_of relationship if inside a class
    if (this.currentClass && !isLocal) {
      relationships.push({
        from: functionId,
        to: `${filePath}:class:${this.currentClass}`,
        type: "contains",
        metadata: {
          memberType: "method",
        },
      });
    }

    // Create overrides relationship if applicable
    if (isOverride && this.currentClass) {
      relationships.push({
        from: functionId,
        to: functionName,
        type: "references",
        metadata: {
          methodName: functionName,
        },
      });
    }

    // Set current function context for local function detection
    this.currentFunction = fullFunctionName;

    // Extract method calls from function body
    const bodyNode = node.namedChildren.find((c) => c.type === "function_body" || c.type === "block");
    if (bodyNode) {
      this.extractMethodCalls(bodyNode, functionId, filePath, relationships);
      this.extractCallableReferences(bodyNode, functionId, filePath, relationships);

      // Process nested entities (local functions, lambdas, etc.)
      for (const child of bodyNode.namedChildren) {
        this.extractEntities(child, filePath, entities, relationships);
      }
    }

    // Restore function context
    this.currentFunction = previousFunction;
  }

  /**
   * Extract property declaration
   */
  private extractProperty(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    const nameNode = node.namedChildren.find((c) => c.type === "variable_declaration");

    let propertyName: string | undefined;
    if (nameNode) {
      const identNode = nameNode.namedChildren.find((c) => c.type === "simple_identifier");
      propertyName = identNode?.text;
    }

    if (!propertyName) {
      // Try alternative extraction
      const simpleIdent = node.namedChildren.find((c) => c.type === "simple_identifier");
      propertyName = simpleIdent?.text;
    }

    if (!propertyName) return;

    const modifiers = this.extractModifiers(node);
    const nodeText = node.text;

    // Determine val vs var
    const isVal = nodeText.trimStart().startsWith("val ");
    const isVar = nodeText.trimStart().startsWith("var ");

    // Check for extension property
    const receiverType = this.extractReceiverType(node);
    const isExtension = !!receiverType;

    // Check modifiers
    const isConst = modifiers.includes("const");
    const isLateinit = modifiers.includes("lateinit");
    const isOverride = modifiers.includes("override");
    const isExpect = modifiers.includes("expect");
    const isActual = modifiers.includes("actual");

    // Check for property delegation
    const delegateNode = node.namedChildren.find((c) => c.type === "property_delegate");
    const isDelegated = !!delegateNode;
    let delegateExpression: string | undefined;
    if (delegateNode) {
      delegateExpression = delegateNode.text.replace(/^by\s*/, "");
    }

    // Check for custom getter/setter
    const getterNode = node.namedChildren.find((c) => c.type === "getter");
    const setterNode = node.namedChildren.find((c) => c.type === "setter");
    const hasCustomGetter = !!getterNode;
    const hasCustomSetter = !!setterNode;

    // Determine if top-level
    const isTopLevel = !this.currentClass;

    // Extract type
    const typeNode = node.namedChildren.find((c) => c.type === "type");
    const propertyType = typeNode?.text;

    // Build entity ID
    let propertyId: string;

    if (this.currentClass) {
      propertyId = `${filePath}:class:${this.currentClass}:property:${propertyName}`;
    } else {
      propertyId = `${filePath}:property:${propertyName}`;
    }

    const entityType = isConst ? "constant" : "property";

    const entity: ParsedEntity = {
      id: propertyId,
      name: isExtension ? `${receiverType}.${propertyName}` : propertyName,
      type: entityType,
      filePath,
      location: this.getNodeLocation(node),
      modifiers,
      metadata: {
        propertyType,
        isVal,
        isVar,
        isExtension,
        receiverType,
        isConst,
        isLateinit,
        isOverride,
        isExpect,
        isActual,
        isDelegated,
        delegateExpression,
        hasCustomGetter,
        hasCustomSetter,
        isTopLevel,
        parent: this.currentClass,
        package: this.currentPackage,
      },
    };

    // Extract annotations
    const annotations = this.extractAnnotations(node);
    if (annotations.length > 0) {
      (entity.metadata as any).annotations = annotations;
    }

    entities.push(entity);

    // Create member_of relationship if inside a class
    if (this.currentClass) {
      relationships.push({
        from: propertyId,
        to: `${filePath}:class:${this.currentClass}`,
        type: "contains",
        metadata: {
          memberType: "property",
        },
      });
    }

    // Create delegates_to relationship if delegated
    if (isDelegated && delegateExpression) {
      relationships.push({
        from: propertyId,
        to: delegateExpression,
        type: "references",
        metadata: {
          referenceType: "delegates_to",
          delegateExpression,
        },
      });
    }
  }

  /**
   * Extract primary constructor
   */
  private extractPrimaryConstructor(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    parentClass: string,
  ): void {
    const modifiers = this.extractModifiers(node);
    const constructorId = `${filePath}:class:${parentClass}:constructor:primary`;

    // Extract parameters (which may also be properties with val/var)
    // Kotlin grammars may either wrap parameters in `class_parameters` or place
    // `class_parameter` nodes directly under `primary_constructor`.
    const paramsNode = node.namedChildren.find((c) => c.type === "class_parameters");
    const paramNodes = paramsNode
      ? paramsNode.namedChildren
      : node.namedChildren.filter((c) => c.type === "class_parameter");
    const parameters: Array<{
      name: string;
      type?: string;
      optional?: boolean;
      isProperty?: boolean;
      isVal?: boolean;
      isVar?: boolean;
    }> = [];

    for (const param of paramNodes) {
      if (param.type !== "class_parameter") continue;

      const paramNameNode = param.namedChildren.find((c) => c.type === "simple_identifier" || c.type === "identifier");
      const paramTypeNode = param.namedChildren.find(
        (c) => c.type === "type" || c.type === "user_type" || c.type.endsWith("_type"),
      );
      const paramText = param.text;

      const paramName = paramNameNode?.text;
      const paramType = paramTypeNode?.text;
      const isVal = paramText.includes("val ");
      const isVar = paramText.includes("var ");
      const isProperty = isVal || isVar;

      if (!paramName) continue;

      parameters.push({
        name: paramName,
        type: paramType,
        isProperty,
        isVal,
        isVar,
      });

      // If it's a property (val/var), create a property entity
      if (isProperty) {
        const propertyId = `${filePath}:class:${parentClass}:property:${paramName}`;

        entities.push({
          id: propertyId,
          name: paramName,
          type: "property",
          filePath,
          location: this.getNodeLocation(param),
          metadata: {
            propertyType: paramType,
            isVal,
            isVar,
            isConstructorProperty: true,
            parent: parentClass,
          },
        });

        relationships.push({
          from: propertyId,
          to: `${filePath}:class:${parentClass}`,
          type: "contains",
          metadata: {
            memberType: "property",
            fromConstructor: true,
          },
        });
      }
    }

    const entity: ParsedEntity = {
      id: constructorId,
      name: parentClass.split(".").pop() || parentClass,
      type: "method",
      filePath,
      location: this.getNodeLocation(node),
      modifiers,
      parameters,
      metadata: {
        isConstructor: true,
        isPrimary: true,
        parent: parentClass,
      },
    };

    entities.push(entity);

    relationships.push({
      from: constructorId,
      to: `${filePath}:class:${parentClass}`,
      type: "contains",
      metadata: {
        memberType: "constructor",
      },
    });
  }

  /**
   * Extract secondary constructor
   */
  private extractSecondaryConstructor(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    if (!this.currentClass) return;

    const modifiers = this.extractModifiers(node);
    const constructorName = this.currentClass.split(".").pop() || this.currentClass;

    // Generate unique ID based on parameter count
    const paramsNode = node.namedChildren.find((c) => c.type === "function_value_parameters");
    const parameters = paramsNode ? this.extractParameters(paramsNode) : [];
    const paramSignature = parameters.map((p) => p.type || "Any").join(",");

    const constructorId = `${filePath}:class:${this.currentClass}:constructor:secondary:${paramSignature}`;

    const entity: ParsedEntity = {
      id: constructorId,
      name: constructorName,
      type: "method",
      filePath,
      location: this.getNodeLocation(node),
      modifiers,
      parameters,
      metadata: {
        isConstructor: true,
        isSecondary: true,
        parent: this.currentClass,
      },
    };

    entities.push(entity);

    relationships.push({
      from: constructorId,
      to: `${filePath}:class:${this.currentClass}`,
      type: "contains",
      metadata: {
        memberType: "constructor",
      },
    });
  }

  /**
   * Extract init block
   */
  private extractInitBlock(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    if (!this.currentClass) return;

    // Generate unique ID based on location
    const initId = `${filePath}:class:${this.currentClass}:init:${node.startPosition.row}`;

    const entity: ParsedEntity = {
      id: initId,
      name: "init",
      type: "method",
      filePath,
      location: this.getNodeLocation(node),
      metadata: {
        isInitBlock: true,
        parent: this.currentClass,
      },
    };

    entities.push(entity);

    relationships.push({
      from: initId,
      to: `${filePath}:class:${this.currentClass}`,
      type: "contains",
      metadata: {
        memberType: "init",
      },
    });
  }

  /**
   * Extract type alias
   */
  private extractTypeAlias(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    const nameNode = node.namedChildren.find((c) => c.type === "type_identifier" || c.type === "simple_identifier");
    const aliasName = nameNode?.text;

    if (!aliasName) return;

    const modifiers = this.extractModifiers(node);

    // Extract the aliased type
    const typeNode = node.namedChildren.find((c) => c.type === "type");
    const aliasedType = typeNode?.text;

    const typeAliasId = `${filePath}:typealias:${aliasName}`;

    const entity: ParsedEntity = {
      id: typeAliasId,
      name: aliasName,
      type: "type",
      filePath,
      location: this.getNodeLocation(node),
      modifiers,
      metadata: {
        isTypeAlias: true,
        aliasedType,
        package: this.currentPackage,
      },
    };

    // Extract type parameters
    const typeParamsNode = node.namedChildren.find((c) => c.type === "type_parameters");
    if (typeParamsNode) {
      const typeParameters = this.extractTypeParameters(typeParamsNode);
      if (typeParameters.length > 0) {
        (entity.metadata as any).typeParameters = typeParameters;
      }
    }

    entities.push(entity);

    // Create type_alias relationship
    if (aliasedType) {
      relationships.push({
        from: typeAliasId,
        to: aliasedType,
        type: "references",
        metadata: {
          referenceType: "type_alias_of",
        },
      });
    }
  }

  /**
   * Extract enum entry
   */
  private extractEnumEntry(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    if (!this.currentClass) return;

    const nameNode = node.namedChildren.find((c) => c.type === "simple_identifier");
    const entryName = nameNode?.text;

    if (!entryName) return;

    const entryId = `${filePath}:class:${this.currentClass}:enum:${entryName}`;

    const entity: ParsedEntity = {
      id: entryId,
      name: entryName,
      type: "constant",
      filePath,
      location: this.getNodeLocation(node),
      metadata: {
        isEnumEntry: true,
        parent: this.currentClass,
      },
    };

    entities.push(entity);

    relationships.push({
      from: entryId,
      to: `${filePath}:class:${this.currentClass}`,
      type: "contains",
      metadata: {
        memberType: "enum_entry",
      },
    });

    // Process enum entry body if present (entries can have their own methods)
    const entryBody = node.namedChildren.find((c) => c.type === "class_body");
    if (entryBody) {
      const previousClass = this.currentClass;
      this.currentClass = `${this.currentClass}.${entryName}`;

      for (const child of entryBody.namedChildren) {
        this.extractEntities(child, filePath, entities, relationships);
      }

      this.currentClass = previousClass;
    }
  }

  /**
   * Extract lambda expression
   */
  private extractLambda(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    const lambdaId = `${filePath}:lambda:${node.startPosition.row}:${node.startPosition.column}`;

    // Extract lambda parameters
    const paramsNode = node.namedChildren.find((c) => c.type === "lambda_parameters");
    const parameters: Array<{ name: string; type?: string }> = [];

    if (paramsNode) {
      for (const param of paramsNode.namedChildren) {
        if (param.type === "variable_declaration" || param.type === "simple_identifier") {
          const paramName =
            param.type === "simple_identifier"
              ? param.text
              : param.namedChildren.find((c) => c.type === "simple_identifier")?.text;

          if (paramName) {
            parameters.push({ name: paramName });
          }
        }
      }
    }

    const entity: ParsedEntity = {
      id: lambdaId,
      name: "<lambda>",
      type: "lambda",
      filePath,
      location: this.getNodeLocation(node),
      parameters,
      metadata: {
        isLambda: true,
        parent: this.currentFunction || this.currentClass,
      },
    };

    entities.push(entity);

    // Extract calls within lambda
    this.extractMethodCalls(node, lambdaId, filePath, relationships);
  }

  /**
   * Extract anonymous function
   */
  private extractAnonymousFunction(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    const anonId = `${filePath}:anonfun:${node.startPosition.row}:${node.startPosition.column}`;

    const paramsNode = node.namedChildren.find((c) => c.type === "function_value_parameters");
    const parameters = paramsNode ? this.extractParameters(paramsNode) : [];

    const returnTypeNode = node.namedChildren.find((c) => c.type === "type");
    const returnType = returnTypeNode?.text;

    const entity: ParsedEntity = {
      id: anonId,
      name: "<anonymous>",
      type: "function",
      filePath,
      location: this.getNodeLocation(node),
      parameters,
      returnType,
      metadata: {
        isAnonymous: true,
        parent: this.currentFunction || this.currentClass,
      },
    };

    entities.push(entity);

    // Extract calls
    const bodyNode = node.namedChildren.find((c) => c.type === "function_body" || c.type === "block");
    if (bodyNode) {
      this.extractMethodCalls(bodyNode, anonId, filePath, relationships);
    }
  }

  /**
   * Extract object literal (anonymous class)
   */
  private extractObjectLiteral(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
  ): void {
    const objectId = `${filePath}:anonobj:${node.startPosition.row}:${node.startPosition.column}`;

    const entity: ParsedEntity = {
      id: objectId,
      name: "<anonymous>",
      type: "class",
      filePath,
      location: this.getNodeLocation(node),
      metadata: {
        isAnonymous: true,
        isObjectExpression: true,
        parent: this.currentFunction || this.currentClass,
      },
    };

    // Extract implemented interfaces/extended classes
    const delegationSpecifiers = node.namedChildren.filter((c) => c.type === "delegation_specifier");
    const implementedTypes: string[] = [];
    for (const spec of delegationSpecifiers) {
      const typeNode = spec.namedChildren.find((c) => c.type === "user_type" || c.type === "constructor_invocation");
      if (typeNode) {
        implementedTypes.push(typeNode.text);
      }
    }

    if (implementedTypes.length > 0) {
      (entity.metadata as any).implementedTypes = implementedTypes;
    }

    entities.push(entity);

    // Process object body
    const objectBody = node.namedChildren.find((c) => c.type === "class_body");
    if (objectBody) {
      const previousClass = this.currentClass;
      this.currentClass = `<anonymous:${node.startPosition.row}>`;

      for (const child of objectBody.namedChildren) {
        this.extractEntities(child, filePath, entities, relationships);
      }

      this.currentClass = previousClass;
    }
  }

  /**
   * Extract inheritance from delegation_specifier
   */
  private extractInheritance(
    node: TreeSitterNode,
    classId: string,
    filePath: string,
    relationships: EntityRelationship[],
    isInterface: boolean,
  ): void {
    // Look for constructor_invocation (extends class) or user_type (implements interface)
    const constructorInvocation = node.namedChildren.find((c) => c.type === "constructor_invocation");
    const userType = node.namedChildren.find((c) => c.type === "user_type");

    if (constructorInvocation) {
      // This is class inheritance
      const typeNode = constructorInvocation.namedChildren.find((c) => c.type === "user_type");
      const superclassName = typeNode?.text || constructorInvocation.text.split("(")[0];

      relationships.push({
        from: classId,
        to: `${filePath}:class:${superclassName}`,
        type: "extends",
        metadata: {
          inheritanceType: "extends",
        },
      });
    } else if (userType) {
      // This is interface implementation or interface extension
      const interfaceName = userType.text;
      const relationType = isInterface ? "inherits" : "implements";

      relationships.push({
        from: classId,
        to: `${filePath}:interface:${interfaceName}`,
        type: relationType,
        metadata: {
          inheritanceType: isInterface ? "extends" : "implements",
        },
      });
    }

    // Check for delegation (by keyword)
    const nodeText = node.text;
    if (nodeText.includes(" by ")) {
      const delegateMatch = nodeText.match(/by\s+(\w+)/);
      if (delegateMatch?.[1]) {
        relationships.push({
          from: classId,
          to: delegateMatch[1],
          type: "references",
          metadata: {
            referenceType: "delegates_to",
          },
        });
      }
    }
  }

  /**
   * Extract method calls to create relationships
   */
  private extractMethodCalls(
    node: TreeSitterNode,
    callerId: string,
    filePath: string,
    relationships: EntityRelationship[],
  ): void {
    this.recursionDepth++;

    // Only log at reasonable intervals to avoid log spam
    if (this.recursionDepth % 20 === 0) {
      log("TRACE", `extractMethodCalls: depth=${this.recursionDepth}, node.type=${node.type}`);
    }

    this.checkCircuitBreakers();

    try {
      if (node.type === "call_expression") {
        // Extract called function name
        const nameNode = node.namedChildren.find(
          (c) => c.type === "simple_identifier" || c.type === "navigation_expression",
        );
        if (nameNode) {
          const methodName = nameNode.text;
          relationships.push({
            from: callerId,
            to: methodName,
            type: "calls",
            metadata: {
              callType: "method",
            },
          });
        }
      }

      // Recursively search for calls in children
      for (const child of node.namedChildren) {
        this.extractMethodCalls(child, callerId, filePath, relationships);
      }
    } finally {
      this.recursionDepth--;
    }
  }

  /**
   * Extract callable references (::)
   */
  private extractCallableReferences(
    node: TreeSitterNode,
    callerId: string,
    filePath: string,
    relationships: EntityRelationship[],
  ): void {
    this.recursionDepth++;
    this.checkCircuitBreakers();

    try {
      if (node.type === "callable_reference") {
        const refText = node.text;
        relationships.push({
          from: callerId,
          to: refText,
          type: "references",
          metadata: {
            referenceType: "callable_reference",
          },
        });
      }

      for (const child of node.namedChildren) {
        this.extractCallableReferences(child, callerId, filePath, relationships);
      }
    } finally {
      this.recursionDepth--;
    }
  }

  /**
   * Extract modifiers from a node
   */
  private extractModifiers(node: TreeSitterNode): string[] {
    const modifiers: string[] = [];

    // Look for modifiers node
    const modifiersNode = node.namedChildren.find((c) => c.type === "modifiers");

    if (modifiersNode) {
      for (const child of modifiersNode.namedChildren) {
        // Skip annotations
        if (child.type === "annotation") continue;

        // Extract modifier text
        if (
          child.type.includes("modifier") ||
          child.type === "visibility_modifier" ||
          child.type === "inheritance_modifier" ||
          child.type === "member_modifier" ||
          child.type === "function_modifier" ||
          child.type === "property_modifier" ||
          child.type === "platform_modifier" ||
          child.type === "class_modifier"
        ) {
          // Get the actual modifier keyword
          const modifierText = child.text.trim();
          if (modifierText && !modifiers.includes(modifierText)) {
            modifiers.push(modifierText);
          }
        }
      }
    }

    // Also check the node text for common modifiers not captured
    const nodeText = node.text;
    const commonModifiers = [
      "public",
      "private",
      "protected",
      "internal",
      "abstract",
      "open",
      "final",
      "sealed",
      "override",
      "data",
      "enum",
      "annotation",
      "inner",
      "value",
      "inline",
      "infix",
      "operator",
      "tailrec",
      "suspend",
      "external",
      "const",
      "lateinit",
      "expect",
      "actual",
      "vararg",
      "noinline",
      "crossinline",
      "reified",
    ];

    for (const mod of commonModifiers) {
      const regex = new RegExp(`\\b${mod}\\b`);
      if (regex.test(nodeText) && !modifiers.includes(mod)) {
        // Only add if it appears before the main declaration keyword
        const mainKeywords = ["class", "interface", "object", "fun", "val", "var", "typealias"];
        for (const keyword of mainKeywords) {
          const keywordIndex = nodeText.indexOf(`${keyword} `);
          if (keywordIndex >= 0) {
            const beforeKeyword = nodeText.substring(0, keywordIndex);
            if (beforeKeyword.includes(mod)) {
              modifiers.push(mod);
            }
            break;
          }
        }
      }
    }

    return modifiers;
  }

  /**
   * Extract annotations from a node
   */
  private extractAnnotations(node: TreeSitterNode): Array<{ name: string; target?: string; arguments?: string[] }> {
    const annotations: Array<{ name: string; target?: string; arguments?: string[] }> = [];

    const modifiersNode = node.namedChildren.find((c) => c.type === "modifiers");
    if (!modifiersNode) return annotations;

    for (const child of modifiersNode.namedChildren) {
      if (child.type === "annotation") {
        const annotationText = child.text;

        // Parse use-site target if present (e.g., @field:Inject)
        const targetMatch = annotationText.match(/@(\w+):(\w+)/);
        const simpleMatch = annotationText.match(/@(\w+)/);

        if (targetMatch?.[1] && targetMatch[2]) {
          annotations.push({
            target: targetMatch[1],
            name: targetMatch[2],
          });
        } else if (simpleMatch?.[1]) {
          // Check for arguments
          const argsMatch = annotationText.match(/@\w+\(([^)]*)\)/);
          annotations.push({
            name: simpleMatch[1],
            arguments: argsMatch?.[1] ? argsMatch[1].split(",").map((a) => a.trim()) : undefined,
          });
        }
      }
    }

    return annotations;
  }

  /**
   * Extract function parameters
   */
  private extractParameters(
    paramsNode: TreeSitterNode,
  ): Array<{ name: string; type?: string; optional?: boolean; isVararg?: boolean }> {
    const params: Array<{ name: string; type?: string; optional?: boolean; isVararg?: boolean }> = [];

    for (const param of paramsNode.namedChildren) {
      if (param.type === "parameter" || param.type === "function_value_parameter") {
        const nameNode = param.namedChildren.find((c) => c.type === "simple_identifier");
        const typeNode = param.namedChildren.find((c) => c.type === "type");
        const defaultNode = param.namedChildren.find((c) => c.type === "default_value");

        const paramName = nameNode?.text;
        const paramType = typeNode?.text;
        const hasDefault = !!defaultNode;
        const isVararg = param.text.includes("vararg ");

        if (paramName) {
          params.push({
            name: paramName,
            type: paramType,
            optional: hasDefault,
            isVararg,
          });
        }
      }
    }

    return params;
  }

  /**
   * Extract type parameters
   */
  private extractTypeParameters(
    typeParamsNode: TreeSitterNode,
  ): Array<{ name: string; bounds?: string[]; variance?: string; isReified?: boolean }> {
    const typeParams: Array<{ name: string; bounds?: string[]; variance?: string; isReified?: boolean }> = [];

    for (const param of typeParamsNode.namedChildren) {
      if (param.type === "type_parameter") {
        const nameNode = param.namedChildren.find(
          (c) => c.type === "simple_identifier" || c.type === "type_identifier",
        );
        const boundsNode = param.namedChildren.find((c) => c.type === "type");

        const paramName = nameNode?.text;
        const paramText = param.text;

        // Check for variance
        let variance: string | undefined;
        if (paramText.includes("in ")) variance = "in";
        else if (paramText.includes("out ")) variance = "out";

        // Check for reified
        const isReified = paramText.includes("reified ");

        if (paramName) {
          typeParams.push({
            name: paramName,
            bounds: boundsNode ? [boundsNode.text] : undefined,
            variance,
            isReified,
          });
        }
      }
    }

    return typeParams;
  }

  /**
   * Extract type constraints (where clause)
   */
  private extractTypeConstraints(constraintsNode: TreeSitterNode): Array<{ typeParameter: string; bound: string }> {
    const constraints: Array<{ typeParameter: string; bound: string }> = [];

    for (const constraint of constraintsNode.namedChildren) {
      if (constraint.type === "type_constraint") {
        const typeParamNode = constraint.namedChildren.find((c) => c.type === "simple_identifier");
        const boundNode = constraint.namedChildren.find((c) => c.type === "type");

        if (typeParamNode && boundNode) {
          constraints.push({
            typeParameter: typeParamNode.text,
            bound: boundNode.text,
          });
        }
      }
    }

    return constraints;
  }

  /**
   * Extract receiver type for extension functions/properties
   */
  private extractReceiverType(node: TreeSitterNode): string | null {
    const receiverNode = node.namedChildren.find((c) => c.type === "receiver_type");
    if (receiverNode) {
      return receiverNode.text;
    }

    // Alternative: check node text for pattern "Type.name"
    const nodeText = node.text;
    const funMatch = nodeText.match(/fun\s+(?:<[^>]+>\s+)?(\w+(?:<[^>]+>)?)\./);
    const valVarMatch = nodeText.match(/(?:val|var)\s+(\w+(?:<[^>]+>)?)\./);

    if (funMatch?.[1]) return funMatch[1];
    if (valVarMatch?.[1]) return valVarMatch[1];

    return null;
  }
}
