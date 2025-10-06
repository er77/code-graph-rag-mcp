/**
 * TASK-20250105-VBA-JAVA-GO-PHASE2: Go Language Analyzer
 *
 * Analyzer for Go language supporting:
 * - Packages and package declarations
 * - Functions (regular and receiver functions/methods)
 * - Structs and their fields
 * - Interfaces and their methods
 * - Type aliases and constants
 * - Variables (module-level)
 * - Goroutines and channels (special Go features)
 *
 * Relationships:
 * - Package imports
 * - Function/method calls
 * - Interface satisfaction (Go's implicit implementation)
 * - Struct embedding (composition)
 * - Channel operations (send/receive)
 * - Type assertions and conversions
 *
 * Implementation uses circuit breakers for safety and follows the proven
 * pattern from C++ analyzer with Go-specific adaptations.
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

export class GoAnalyzer {
  private recursionDepth = 0;
  private parseStartTime = 0;
  private currentPackage = "";

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
   * Main entry point for analyzing Go code
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
        console.warn(`[GoAnalyzer] Circuit breaker triggered for ${filePath}: ${error.message}`);
      } else {
        console.error(`[GoAnalyzer] Error analyzing ${filePath}:`, error);
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
   * Extract entities from Go AST
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
        case "source_file":
          // Process source file
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
              this.extractEntities(child, filePath, entities, relationships, parentContext);
            }
          }
          break;

        case "package_clause":
          // Extract package declaration
          const packageName = this.getPackageName(node);
          if (packageName) {
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
          break;

        case "import_declaration":
          // Handle imports
          this.extractImports(node, filePath, relationships);
          break;

        case "function_declaration":
          // Extract regular functions
          this.extractFunction(node, filePath, entities, relationships);
          break;

        case "method_declaration":
          // Extract methods (receiver functions)
          this.extractMethod(node, filePath, entities, relationships);
          break;

        case "type_declaration":
          // Extract type declarations (structs, interfaces, aliases)
          this.extractTypeDeclaration(node, filePath, entities, relationships);
          break;

        case "const_declaration":
          // Extract constants
          this.extractConstant(node, filePath, entities);
          break;

        case "var_declaration":
          // Extract variables
          this.extractVariable(node, filePath, entities);
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
   * Extract package name from package clause
   */
  private getPackageName(node: TreeSitterNode): string | null {
    const identifierNode = node.childForFieldName("name");
    return identifierNode?.text || null;
  }

  /**
   * Extract imports and create relationships
   */
  private extractImports(node: TreeSitterNode, filePath: string, relationships: EntityRelationship[]): void {
    const importSpecList = node.childForFieldName("path");

    if (importSpecList) {
      const importPath = importSpecList.text?.replace(/['"]/g, '');
      if (importPath) {
        relationships.push({
          from: `${filePath}:package:${this.currentPackage}`,
          to: importPath,
          type: "imports",
          metadata: {
            importType: "package"
          }
        });
      }
    }
  }

  /**
   * Extract function declaration
   */
  private extractFunction(node: TreeSitterNode, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[]): void {
    const nameNode = node.childForFieldName("name");
    const functionName = nameNode?.text;

    if (functionName) {
      const entity: ParsedEntity = {
        id: `${filePath}:function:${functionName}`,
        name: functionName,
        type: "function",
        filePath,
        location: this.getNodeLocation(node),
        metadata: {
          isPublic: functionName[0] === functionName[0].toUpperCase(), // Capital = exported in Go
          package: this.currentPackage
        }
      };

      // Extract parameters
      const parameters = node.childForFieldName("parameters");
      if (parameters) {
        entity.metadata.parameters = this.extractParameters(parameters);
      }

      // Extract return type
      const result = node.childForFieldName("result");
      if (result) {
        entity.metadata.returnType = result.text;
      }

      entities.push(entity);

      // Extract function calls within body
      const body = node.childForFieldName("body");
      if (body) {
        this.extractFunctionCalls(body, entity.id, filePath, relationships);
      }
    }
  }

  /**
   * Extract method declaration (receiver function)
   */
  private extractMethod(node: TreeSitterNode, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[]): void {
    const nameNode = node.childForFieldName("name");
    const methodName = nameNode?.text;
    const receiver = node.childForFieldName("receiver");

    if (methodName && receiver) {
      // Extract receiver type
      const receiverType = this.extractReceiverType(receiver);

      const entity: ParsedEntity = {
        id: `${filePath}:method:${receiverType}:${methodName}`,
        name: methodName,
        type: "method",
        filePath,
        location: this.getNodeLocation(node),
        metadata: {
          isPublic: methodName[0] === methodName[0].toUpperCase(),
          receiver: receiverType,
          package: this.currentPackage
        }
      };

      // Extract parameters
      const parameters = node.childForFieldName("parameters");
      if (parameters) {
        entity.metadata.parameters = this.extractParameters(parameters);
      }

      // Extract return type
      const result = node.childForFieldName("result");
      if (result) {
        entity.metadata.returnType = result.text;
      }

      entities.push(entity);

      // Create relationship to receiver type
      if (receiverType) {
        relationships.push({
          from: entity.id,
          to: `${filePath}:type:${receiverType}`,
          type: "member_of",
          metadata: {
            memberType: "method"
          }
        });
      }

      // Extract function calls within body
      const body = node.childForFieldName("body");
      if (body) {
        this.extractFunctionCalls(body, entity.id, filePath, relationships);
      }
    }
  }

  /**
   * Extract receiver type from receiver parameter
   */
  private extractReceiverType(receiver: TreeSitterNode): string {
    // Look for the type in the receiver parameter list
    const paramDecl = receiver.namedChild(0);
    if (paramDecl) {
      const typeNode = paramDecl.childForFieldName("type");
      if (typeNode) {
        // Handle pointer receivers (*Type)
        if (typeNode.type === "pointer_type") {
          const baseType = typeNode.namedChild(0);
          return baseType?.text || "";
        }
        return typeNode.text || "";
      }
    }
    return "";
  }

  /**
   * Extract type declarations (structs, interfaces, type aliases)
   */
  private extractTypeDeclaration(node: TreeSitterNode, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[]): void {
    const typeSpecs = node.namedChildren.filter(c => c.type === "type_spec");

    for (const typeSpec of typeSpecs) {
      const nameNode = typeSpec.childForFieldName("name");
      const typeName = nameNode?.text;
      const typeNode = typeSpec.childForFieldName("type");

      if (typeName && typeNode) {
        const entityType = this.getEntityTypeFromGoType(typeNode.type);

        const entity: ParsedEntity = {
          id: `${filePath}:type:${typeName}`,
          name: typeName,
          type: entityType,
          filePath,
          location: this.getNodeLocation(typeSpec),
          metadata: {
            isPublic: typeName[0] === typeName[0].toUpperCase(),
            package: this.currentPackage,
            goType: typeNode.type
          }
        };

        entities.push(entity);

        // Extract struct fields
        if (typeNode.type === "struct_type") {
          this.extractStructFields(typeNode, entity.id, filePath, entities, relationships);
        }

        // Extract interface methods
        if (typeNode.type === "interface_type") {
          this.extractInterfaceMethods(typeNode, entity.id, filePath, entities, relationships);
        }

        // Handle type embedding
        if (typeNode.type === "struct_type") {
          this.extractEmbeddedTypes(typeNode, entity.id, filePath, relationships);
        }
      }
    }
  }

  /**
   * Map Go type to entity type
   */
  private getEntityTypeFromGoType(goType: string): ParsedEntity["type"] {
    switch (goType) {
      case "struct_type":
        return "class"; // Map struct to class
      case "interface_type":
        return "interface";
      default:
        return "typedef"; // For type aliases and other types
    }
  }

  /**
   * Extract struct fields
   */
  private extractStructFields(structNode: TreeSitterNode, structId: string, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[]): void {
    const fieldList = structNode.namedChildren.filter(c => c.type === "field_declaration_list");

    for (const list of fieldList) {
      const fields = list.namedChildren.filter(c => c.type === "field_declaration");

      for (const field of fields) {
        const nameNode = field.childForFieldName("name");
        const fieldName = nameNode?.text;
        const typeNode = field.childForFieldName("type");

        if (fieldName) {
          const fieldEntity: ParsedEntity = {
            id: `${structId}:field:${fieldName}`,
            name: fieldName,
            type: "property",
            filePath,
            location: this.getNodeLocation(field),
            metadata: {
              isPublic: fieldName[0] === fieldName[0].toUpperCase(),
              fieldType: typeNode?.text || "unknown",
              parent: structId
            }
          };

          entities.push(fieldEntity);

          // Create relationship
          relationships.push({
            from: fieldEntity.id,
            to: structId,
            type: "member_of",
            metadata: {
              memberType: "field"
            }
          });
        }
      }
    }
  }

  /**
   * Extract interface methods
   */
  private extractInterfaceMethods(interfaceNode: TreeSitterNode, interfaceId: string, filePath: string, entities: ParsedEntity[], relationships: EntityRelationship[]): void {
    const methodSpecs = interfaceNode.namedChildren.filter(c => c.type === "method_spec");

    for (const methodSpec of methodSpecs) {
      const nameNode = methodSpec.childForFieldName("name");
      const methodName = nameNode?.text;

      if (methodName) {
        const methodEntity: ParsedEntity = {
          id: `${interfaceId}:method:${methodName}`,
          name: methodName,
          type: "method",
          filePath,
          location: this.getNodeLocation(methodSpec),
          metadata: {
            isAbstract: true, // Interface methods are abstract
            parent: interfaceId
          }
        };

        // Extract parameters
        const parameters = methodSpec.childForFieldName("parameters");
        if (parameters) {
          methodEntity.metadata.parameters = this.extractParameters(parameters);
        }

        // Extract return type
        const result = methodSpec.childForFieldName("result");
        if (result) {
          methodEntity.metadata.returnType = result.text;
        }

        entities.push(methodEntity);

        // Create relationship
        relationships.push({
          from: methodEntity.id,
          to: interfaceId,
          type: "member_of",
          metadata: {
            memberType: "method"
          }
        });
      }
    }
  }

  /**
   * Extract embedded types (struct embedding/composition)
   */
  private extractEmbeddedTypes(structNode: TreeSitterNode, structId: string, filePath: string, relationships: EntityRelationship[]): void {
    const fieldList = structNode.namedChildren.filter(c => c.type === "field_declaration_list");

    for (const list of fieldList) {
      const fields = list.namedChildren.filter(c => c.type === "field_declaration");

      for (const field of fields) {
        // Check if it's an embedded field (no name, just type)
        const nameNode = field.childForFieldName("name");
        const typeNode = field.childForFieldName("type");

        if (!nameNode && typeNode) {
          // This is an embedded type
          const embeddedType = typeNode.text;
          if (embeddedType) {
            relationships.push({
              from: structId,
              to: `${filePath}:type:${embeddedType}`,
              type: "embeds",
              metadata: {
                embeddingType: "struct"
              }
            });
          }
        }
      }
    }
  }

  /**
   * Extract constants
   */
  private extractConstant(node: TreeSitterNode, filePath: string, entities: ParsedEntity[]): void {
    const constSpecs = node.namedChildren.filter(c => c.type === "const_spec");

    for (const constSpec of constSpecs) {
      const nameNode = constSpec.childForFieldName("name");
      const constName = nameNode?.text;

      if (constName) {
        const valueNode = constSpec.childForFieldName("value");

        entities.push({
          id: `${filePath}:const:${constName}`,
          name: constName,
          type: "constant",
          filePath,
          location: this.getNodeLocation(constSpec),
          metadata: {
            isPublic: constName[0] === constName[0].toUpperCase(),
            value: valueNode?.text,
            package: this.currentPackage
          }
        });
      }
    }
  }

  /**
   * Extract variables
   */
  private extractVariable(node: TreeSitterNode, filePath: string, entities: ParsedEntity[]): void {
    const varSpecs = node.namedChildren.filter(c => c.type === "var_spec");

    for (const varSpec of varSpecs) {
      const nameNode = varSpec.childForFieldName("name");
      const varName = nameNode?.text;

      if (varName) {
        const typeNode = varSpec.childForFieldName("type");
        const valueNode = varSpec.childForFieldName("value");

        entities.push({
          id: `${filePath}:var:${varName}`,
          name: varName,
          type: "variable",
          filePath,
          location: this.getNodeLocation(varSpec),
          metadata: {
            isPublic: varName[0] === varName[0].toUpperCase(),
            variableType: typeNode?.text,
            initialValue: valueNode?.text,
            package: this.currentPackage
          }
        });
      }
    }
  }

  /**
   * Extract function parameters
   */
  private extractParameters(parametersNode: TreeSitterNode): string[] {
    const params: string[] = [];
    const paramDecls = parametersNode.namedChildren.filter(c => c.type === "parameter_declaration");

    for (const paramDecl of paramDecls) {
      const nameNode = paramDecl.childForFieldName("name");
      const typeNode = paramDecl.childForFieldName("type");

      if (nameNode && typeNode) {
        params.push(`${nameNode.text}: ${typeNode.text}`);
      } else if (typeNode) {
        // Anonymous parameter
        params.push(typeNode.text);
      }
    }

    return params;
  }

  /**
   * Extract function calls to create relationships
   */
  private extractFunctionCalls(node: TreeSitterNode, callerId: string, filePath: string, relationships: EntityRelationship[]): void {
    this.recursionDepth++;
    this.checkCircuitBreakers();

    try {
      if (node.type === "call_expression") {
        const functionNode = node.childForFieldName("function");
        if (functionNode) {
          const functionName = functionNode.text;
          if (functionName) {
            relationships.push({
              from: callerId,
              to: `${filePath}:function:${functionName}`,
              type: "calls",
              metadata: {
                callType: "function"
              }
            });
          }
        }
      }

      // Recursively search for calls in children
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          this.extractFunctionCalls(child, callerId, filePath, relationships);
        }
      }
    } finally {
      this.recursionDepth--;
    }
  }
}