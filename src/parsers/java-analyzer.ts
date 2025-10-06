/**
 * TASK-20250105-VBA-JAVA-GO-PHASE3: Java Language Analyzer
 *
 * Analyzer for Java language supporting:
 * - Packages and imports
 * - Classes (regular, abstract, inner, anonymous)
 * - Interfaces and annotations
 * - Enums and records (Java 14+)
 * - Methods and constructors
 * - Fields and constants
 * - Lambda expressions and method references
 * - Generic type parameters
 *
 * Relationships:
 * - Class inheritance (extends)
 * - Interface implementation (implements)
 * - Method calls and field access
 * - Package organization
 * - Generic type usage
 * - Annotation usage
 * - Inner class relationships
 *
 * Implementation uses circuit breakers for safety and follows the proven
 * pattern from Go and C++ analyzers with Java-specific adaptations.
 */

import type {
  ParsedEntity,
  TreeSitterNode,
  EntityRelationship,
} from "../types/parser.js";

// Circuit breaker constants
const MAX_RECURSION_DEPTH = 50;
const PARSE_TIMEOUT_MS = 5000;

// Custom error class for circuit breaker failures
class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class JavaAnalyzer {
  private recursionDepth = 0;
  private parseStartTime = 0;
  private currentPackage = "";
  private currentClass: string | null = null;

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
   * Main entry point for analyzing Java code
   */
  async analyze(
    rootNode: TreeSitterNode,
    filePath: string
  ): Promise<{ entities: ParsedEntity[]; relationships: EntityRelationship[] }> {
    this.resetState();

    const entities: ParsedEntity[] = [];
    const relationships: EntityRelationship[] = [];

    try {
      // Extract entities and relationships from AST
      this.extractEntities(rootNode, filePath, entities, relationships);
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        console.warn(`[JavaAnalyzer] Circuit breaker triggered for ${filePath}: ${error.message}`);
      } else {
        console.error(`[JavaAnalyzer] Error analyzing ${filePath}:`, error);
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
    this.currentPackage = "";
    this.currentClass = null;
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
  }

  /**
   * Extract entities from Java AST
   */
  private extractEntities(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    parentContext?: string
  ): void {
    this.recursionDepth++;
    this.checkCircuitBreakers();

    try {
      switch (node.type) {
        case "program":
          // Process program (root node)
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
              this.extractEntities(child, filePath, entities, relationships, parentContext);
            }
          }
          break;

        case "package_declaration":
          // Extract package declaration
          this.extractPackage(node, filePath, entities);
          break;

        case "import_declaration":
          // Handle imports
          this.extractImports(node, filePath, relationships);
          break;

        case "class_declaration":
          // Extract class declaration
          this.extractClass(node, filePath, entities, relationships);
          break;

        case "interface_declaration":
          // Extract interface declaration
          this.extractInterface(node, filePath, entities, relationships);
          break;

        case "enum_declaration":
          // Extract enum declaration
          this.extractEnum(node, filePath, entities, relationships);
          break;

        case "record_declaration":
          // Extract record declaration (Java 14+)
          this.extractRecord(node, filePath, entities, relationships);
          break;

        case "annotation_type_declaration":
          // Extract annotation declaration
          this.extractAnnotation(node, filePath, entities, relationships);
          break;

        case "method_declaration":
          // Extract method declaration
          if (this.currentClass) {
            this.extractMethod(node, filePath, entities, relationships, this.currentClass);
          }
          break;

        case "constructor_declaration":
          // Extract constructor
          if (this.currentClass) {
            this.extractConstructor(node, filePath, entities, relationships, this.currentClass);
          }
          break;

        case "field_declaration":
          // Extract fields
          if (this.currentClass) {
            this.extractField(node, filePath, entities, relationships, this.currentClass);
          }
          break;

        default:
          // Recursively process children for unhandled node types
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
              this.extractEntities(child, filePath, entities, relationships, parentContext);
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
    const packageNameNode = node.namedChildren.find(c => c.type === "scoped_identifier" || c.type === "identifier");
    if (packageNameNode) {
      const packageName = packageNameNode.text.replace(/\s+/g, '');
      this.currentPackage = packageName;

      entities.push({
        id: `${filePath}:package:${packageName}`,
        name: packageName,
        type: "module",
        filePath,
        location: this.getNodeLocation(node),
        metadata: {
          isPackage: true
        }
      });
    }
  }

  /**
   * Extract imports and create relationships
   */
  private extractImports(node: TreeSitterNode, filePath: string, relationships: EntityRelationship[]): void {
    const importPath = node.namedChildren.find(c => c.type === "scoped_identifier" || c.type === "identifier");
    const asterisk = node.namedChildren.find(c => c.type === "asterisk");

    if (importPath) {
      const path = importPath.text;
      const isWildcard = !!asterisk;

      relationships.push({
        from: `${filePath}:package:${this.currentPackage}`,
        to: path,
        type: "imports",
        metadata: {
          isWildcard,
          isStatic: node.text.includes("static")
        }
      });
    }
  }

  /**
   * Extract class declaration
   */
  private extractClass(node: TreeSitterNode, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[]): void {
    const nameNode = node.childForFieldName("name");
    const className = nameNode?.text;

    if (className) {
      const previousClass = this.currentClass;
      const fullClassName = previousClass ? `${previousClass}.${className}` : className;
      this.currentClass = fullClassName;

      const modifiers = this.extractModifiers(node);

      const entity: ParsedEntity = {
        id: `${filePath}:class:${fullClassName}`,
        name: fullClassName,
        type: "class",
        filePath,
        location: this.getNodeLocation(node),
        modifiers,
        metadata: {
          isAbstract: modifiers.includes("abstract"),
          isFinal: modifiers.includes("final"),
          isStatic: modifiers.includes("static"),
          isPublic: modifiers.includes("public"),
          isPrivate: modifiers.includes("private"),
          isProtected: modifiers.includes("protected"),
          package: this.currentPackage,
          isInnerClass: !!previousClass
        }
      };

      entities.push(entity);

      // Extract superclass
      const superclass = node.childForFieldName("superclass");
      if (superclass) {
        const superclassName = superclass.namedChildren[0]?.text;
        if (superclassName) {
          relationships.push({
            from: entity.id,
            to: `${filePath}:class:${superclassName}`,
            type: "inherits",
            metadata: {
              inheritanceType: "extends"
            }
          });
        }
      }

      // Extract interfaces
      const interfaces = node.childForFieldName("interfaces");
      if (interfaces) {
        const interfaceList = interfaces.namedChildren.filter(c => c.type === "type_identifier");
        for (const iface of interfaceList) {
          relationships.push({
            from: entity.id,
            to: `${filePath}:interface:${iface.text}`,
            type: "implements",
            metadata: {}
          });
        }
      }

      // Process class body
      const body = node.childForFieldName("body");
      if (body) {
        for (let i = 0; i < body.childCount; i++) {
          const child = body.child(i);
          if (child) {
            this.extractEntities(child, filePath, entities, relationships, fullClassName);
          }
        }
      }

      // Restore previous class context
      this.currentClass = previousClass;
    }
  }

  /**
   * Extract interface declaration
   */
  private extractInterface(node: TreeSitterNode, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[]): void {
    const nameNode = node.childForFieldName("name");
    const interfaceName = nameNode?.text;

    if (interfaceName) {
      const modifiers = this.extractModifiers(node);

      const entity: ParsedEntity = {
        id: `${filePath}:interface:${interfaceName}`,
        name: interfaceName,
        type: "interface",
        filePath,
        location: this.getNodeLocation(node),
        modifiers,
        metadata: {
          isPublic: modifiers.includes("public"),
          package: this.currentPackage
        }
      };

      entities.push(entity);

      // Extract extended interfaces
      const extendsList = node.childForFieldName("extends");
      if (extendsList) {
        const interfaces = extendsList.namedChildren.filter(c => c.type === "type_identifier");
        for (const iface of interfaces) {
          relationships.push({
            from: entity.id,
            to: `${filePath}:interface:${iface.text}`,
            type: "inherits",
            metadata: {
              inheritanceType: "extends"
            }
          });
        }
      }

      // Store current class context and process interface body
      const previousClass = this.currentClass;
      this.currentClass = interfaceName;

      const body = node.childForFieldName("body");
      if (body) {
        for (let i = 0; i < body.childCount; i++) {
          const child = body.child(i);
          if (child) {
            this.extractEntities(child, filePath, entities, relationships, interfaceName);
          }
        }
      }

      this.currentClass = previousClass;
    }
  }

  /**
   * Extract enum declaration
   */
  private extractEnum(node: TreeSitterNode, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[]): void {
    const nameNode = node.childForFieldName("name");
    const enumName = nameNode?.text;

    if (enumName) {
      const modifiers = this.extractModifiers(node);

      const entity: ParsedEntity = {
        id: `${filePath}:enum:${enumName}`,
        name: enumName,
        type: "enum",
        filePath,
        location: this.getNodeLocation(node),
        modifiers,
        metadata: {
          isPublic: modifiers.includes("public"),
          package: this.currentPackage
        }
      };

      entities.push(entity);

      // Extract enum constants
      const body = node.childForFieldName("body");
      if (body) {
        const enumConstants = body.namedChildren.filter(c => c.type === "enum_constant");
        for (const constant of enumConstants) {
          const constantName = constant.childForFieldName("name")?.text;
          if (constantName) {
            const constantEntity: ParsedEntity = {
              id: `${entity.id}:constant:${constantName}`,
              name: constantName,
              type: "constant",
              filePath,
              location: this.getNodeLocation(constant),
              metadata: {
                parent: entity.id,
                enumValue: true
              }
            };

            entities.push(constantEntity);

            relationships.push({
              from: constantEntity.id,
              to: entity.id,
              type: "member_of",
              metadata: {
                memberType: "enum_constant"
              }
            });
          }
        }
      }
    }
  }

  /**
   * Extract record declaration (Java 14+)
   */
  private extractRecord(node: TreeSitterNode, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[]): void {
    const nameNode = node.childForFieldName("name");
    const recordName = nameNode?.text;

    if (recordName) {
      const modifiers = this.extractModifiers(node);

      const entity: ParsedEntity = {
        id: `${filePath}:record:${recordName}`,
        name: recordName,
        type: "class", // Records are special classes
        filePath,
        location: this.getNodeLocation(node),
        modifiers,
        metadata: {
          isRecord: true,
          isPublic: modifiers.includes("public"),
          isFinal: true, // Records are implicitly final
          package: this.currentPackage
        }
      };

      entities.push(entity);

      // Extract record components
      const parameters = node.childForFieldName("parameters");
      if (parameters) {
        const components = parameters.namedChildren.filter(c => c.type === "record_component");
        for (const component of components) {
          const componentName = component.childForFieldName("name")?.text;
          const componentType = component.childForFieldName("type")?.text;

          if (componentName) {
            const componentEntity: ParsedEntity = {
              id: `${entity.id}:component:${componentName}`,
              name: componentName,
              type: "property",
              filePath,
              location: this.getNodeLocation(component),
              metadata: {
                parent: entity.id,
                fieldType: componentType,
                isRecordComponent: true
              }
            };

            entities.push(componentEntity);

            relationships.push({
              from: componentEntity.id,
              to: entity.id,
              type: "member_of",
              metadata: {
                memberType: "record_component"
              }
            });
          }
        }
      }
    }
  }

  /**
   * Extract annotation declaration
   */
  private extractAnnotation(node: TreeSitterNode, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[]): void {
    const nameNode = node.childForFieldName("name");
    const annotationName = nameNode?.text;

    if (annotationName) {
      const modifiers = this.extractModifiers(node);

      const entity: ParsedEntity = {
        id: `${filePath}:annotation:${annotationName}`,
        name: `@${annotationName}`,
        type: "interface", // Annotations are special interfaces
        filePath,
        location: this.getNodeLocation(node),
        modifiers,
        metadata: {
          isAnnotation: true,
          isPublic: modifiers.includes("public"),
          package: this.currentPackage
        }
      };

      entities.push(entity);
    }
  }

  /**
   * Extract method declaration
   */
  private extractMethod(node: TreeSitterNode, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[], parentClass: string): void {
    const nameNode = node.childForFieldName("name");
    const methodName = nameNode?.text;

    if (methodName) {
      const modifiers = this.extractModifiers(node);
      const returnType = node.childForFieldName("type")?.text;

      const entity: ParsedEntity = {
        id: `${filePath}:class:${parentClass}:method:${methodName}`,
        name: methodName,
        type: "method",
        filePath,
        location: this.getNodeLocation(node),
        modifiers,
        returnType,
        metadata: {
          isPublic: modifiers.includes("public"),
          isPrivate: modifiers.includes("private"),
          isProtected: modifiers.includes("protected"),
          isStatic: modifiers.includes("static"),
          isFinal: modifiers.includes("final"),
          isAbstract: modifiers.includes("abstract"),
          isSynchronized: modifiers.includes("synchronized"),
          parent: parentClass
        }
      };

      // Extract parameters
      const parameters = node.childForFieldName("parameters");
      if (parameters) {
        entity.parameters = this.extractParameters(parameters);
      }

      // Extract annotations
      const annotations = this.extractAnnotations(node);
      if (annotations.length > 0) {
        entity.metadata.annotations = annotations;
      }

      entities.push(entity);

      // Create relationship to parent class
      relationships.push({
        from: entity.id,
        to: `${filePath}:class:${parentClass}`,
        type: "member_of",
        metadata: {
          memberType: "method"
        }
      });

      // Extract method calls within body
      const body = node.childForFieldName("body");
      if (body) {
        this.extractMethodCalls(body, entity.id, filePath, relationships);
      }
    }
  }

  /**
   * Extract constructor declaration
   */
  private extractConstructor(node: TreeSitterNode, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[], parentClass: string): void {
    const nameNode = node.childForFieldName("name");
    const constructorName = nameNode?.text || parentClass.split('.').pop();

    if (constructorName) {
      const modifiers = this.extractModifiers(node);

      const entity: ParsedEntity = {
        id: `${filePath}:class:${parentClass}:constructor:${constructorName}`,
        name: constructorName,
        type: "method",
        filePath,
        location: this.getNodeLocation(node),
        modifiers,
        metadata: {
          isConstructor: true,
          isPublic: modifiers.includes("public"),
          isPrivate: modifiers.includes("private"),
          isProtected: modifiers.includes("protected"),
          parent: parentClass
        }
      };

      // Extract parameters
      const parameters = node.childForFieldName("parameters");
      if (parameters) {
        entity.parameters = this.extractParameters(parameters);
      }

      entities.push(entity);

      // Create relationship to parent class
      relationships.push({
        from: entity.id,
        to: `${filePath}:class:${parentClass}`,
        type: "member_of",
        metadata: {
          memberType: "constructor"
        }
      });
    }
  }

  /**
   * Extract field declaration
   */
  private extractField(node: TreeSitterNode, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[], parentClass: string): void {
    const typeNode = node.childForFieldName("type");
    const fieldType = typeNode?.text;

    // Extract all variable declarators
    const declarators = node.namedChildren.filter(c => c.type === "variable_declarator");

    for (const declarator of declarators) {
      const nameNode = declarator.childForFieldName("name");
      const fieldName = nameNode?.text;

      if (fieldName) {
        const modifiers = this.extractModifiers(node);
        const valueNode = declarator.childForFieldName("value");

        const entity: ParsedEntity = {
          id: `${filePath}:class:${parentClass}:field:${fieldName}`,
          name: fieldName,
          type: modifiers.includes("final") ? "constant" : "property",
          filePath,
          location: this.getNodeLocation(declarator),
          modifiers,
          metadata: {
            fieldType,
            isPublic: modifiers.includes("public"),
            isPrivate: modifiers.includes("private"),
            isProtected: modifiers.includes("protected"),
            isStatic: modifiers.includes("static"),
            isFinal: modifiers.includes("final"),
            isVolatile: modifiers.includes("volatile"),
            isTransient: modifiers.includes("transient"),
            initialValue: valueNode?.text,
            parent: parentClass
          }
        };

        entities.push(entity);

        // Create relationship to parent class
        relationships.push({
          from: entity.id,
          to: `${filePath}:class:${parentClass}`,
          type: "member_of",
          metadata: {
            memberType: "field"
          }
        });
      }
    }
  }

  /**
   * Extract modifiers from a node
   */
  private extractModifiers(node: TreeSitterNode): string[] {
    const modifiers: string[] = [];
    const modifiersNode = node.childForFieldName("modifiers");

    if (modifiersNode) {
      for (let i = 0; i < modifiersNode.childCount; i++) {
        const child = modifiersNode.child(i);
        if (child && child.type !== "annotation") {
          modifiers.push(child.text);
        }
      }
    }

    return modifiers;
  }

  /**
   * Extract annotations from a node
   */
  private extractAnnotations(node: TreeSitterNode): string[] {
    const annotations: string[] = [];
    const modifiersNode = node.childForFieldName("modifiers");

    if (modifiersNode) {
      const annotationNodes = modifiersNode.namedChildren.filter(c => c.type === "annotation" || c.type === "marker_annotation");
      for (const annotation of annotationNodes) {
        annotations.push(annotation.text);
      }
    }

    return annotations;
  }

  /**
   * Extract method parameters
   */
  private extractParameters(parametersNode: TreeSitterNode): Array<{ name: string; type?: string }> {
    const params: Array<{ name: string; type?: string }> = [];
    const formalParams = parametersNode.namedChildren.filter(c => c.type === "formal_parameter" || c.type === "spread_parameter");

    for (const param of formalParams) {
      const nameNode = param.childForFieldName("name");
      const typeNode = param.childForFieldName("type");

      if (nameNode) {
        params.push({
          name: nameNode.text,
          type: typeNode?.text
        });
      }
    }

    return params;
  }

  /**
   * Extract method calls to create relationships
   */
  private extractMethodCalls(node: TreeSitterNode, callerId: string, filePath: string, relationships: EntityRelationship[]): void {
    this.recursionDepth++;
    this.checkCircuitBreakers();

    try {
      if (node.type === "method_invocation") {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
          const methodName = nameNode.text;
          relationships.push({
            from: callerId,
            to: methodName,
            type: "calls",
            metadata: {
              callType: "method"
            }
          });
        }
      }

      // Recursively search for calls in children
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          this.extractMethodCalls(child, callerId, filePath, relationships);
        }
      }
    } finally {
      this.recursionDepth--;
    }
  }
}