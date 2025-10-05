/**
 * TASK-20251005191500: C Language Analyzer
 *
 * Analyzer for C language supporting:
 * - Functions (static, extern, inline)
 * - Structs, unions, enums, typedefs
 * - Global variables and constants
 * - Macros and preprocessor directives
 * - Include relationships
 *
 * Implementation follows patterns from CSharpAnalyzer and RustAnalyzer
 * with circuit breakers for safety.
 */

import type {
  ParsedEntity,
  TreeSitterNode,
  EntityRelationship,
} from "../types/parser.js";

// Circuit breaker constants
const MAX_RECURSION_DEPTH = 50;
const PARSE_TIMEOUT_MS = 5000;

export class CAnalyzer {
  private recursionDepth = 0;
  private parseStartTime = 0;

  /**
   * Main entry point for analyzing C code
   */
  async analyze(
    rootNode: TreeSitterNode,
    filePath: string
  ): Promise<{ entities: ParsedEntity[]; relationships: EntityRelationship[] }> {
    this.recursionDepth = 0;
    this.parseStartTime = Date.now();

    const entities: ParsedEntity[] = [];
    const relationships: EntityRelationship[] = [];

    try {
      // Extract all top-level entities
      this.extractEntities(rootNode, filePath, entities, relationships);
    } catch (error) {
      console.error(`[CAnalyzer] Error analyzing ${filePath}:`, error);
      // Return partial results on error
    }

    return { entities, relationships };
  }

  /**
   * Extract entities from the AST with recursion protection
   */
  private extractEntities(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    depth = 0
  ): void {
    // Circuit breaker: check recursion depth
    if (depth > MAX_RECURSION_DEPTH) {
      throw new Error(`Maximum recursion depth exceeded at depth ${depth}`);
    }

    // Circuit breaker: check timeout
    if (Date.now() - this.parseStartTime > PARSE_TIMEOUT_MS) {
      throw new Error(`Parse timeout exceeded after ${PARSE_TIMEOUT_MS}ms`);
    }

    // Process node based on type
    switch (node.type) {
      case "function_definition":
        this.extractFunction(node, filePath, entities);
        break;

      case "declaration":
        this.extractDeclaration(node, filePath, entities);
        break;

      case "struct_specifier":
        this.extractStruct(node, filePath, entities);
        break;

      case "union_specifier":
        this.extractUnion(node, filePath, entities);
        break;

      case "enum_specifier":
        this.extractEnum(node, filePath, entities);
        break;

      case "type_definition":
        this.extractTypedef(node, filePath, entities);
        break;

      case "preproc_def":
        this.extractMacro(node, filePath, entities);
        break;

      case "preproc_include":
        this.extractInclude(node, filePath, relationships);
        break;

      case "preproc_function_def":
        this.extractFunctionMacro(node, filePath, entities);
        break;
    }

    // Recurse through children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.extractEntities(child, filePath, entities, relationships, depth + 1);
      }
    }
  }

  /**
   * Extract function definitions
   */
  private extractFunction(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[]
  ): void {
    const declaratorNode = node.childForFieldName("declarator");
    if (!declaratorNode) return;

    const nameNode = this.getFunctionName(declaratorNode);
    if (!nameNode) return;

    const name = this.getNodeText(nameNode);
    const modifiers: string[] = [];

    // Check for storage class specifiers (static, extern, inline)
    const storageNode = node.childForFieldName("storage_class_specifier");
    if (storageNode) {
      modifiers.push(this.getNodeText(storageNode));
    }

    // Check for inline keyword
    const specifierNode = node.childForFieldName("type");
    if (specifierNode && this.getNodeText(specifierNode).includes("inline")) {
      modifiers.push("inline");
    }

    entities.push({
      name,
      type: "function",
      location: this.getNodeLocation(node),
      modifiers: modifiers.length > 0 ? modifiers : undefined,
    });
  }

  /**
   * Extract global variable and constant declarations
   */
  private extractDeclaration(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[]
  ): void {
    const declaratorNode = node.childForFieldName("declarator");
    if (!declaratorNode) return;

    const nameNode = this.getDeclaratorName(declaratorNode);
    if (!nameNode) return;

    const name = this.getNodeText(nameNode);
    const isConst = this.getNodeText(node).includes("const");

    entities.push({
      name,
      type: isConst ? "constant" : "variable",
      location: this.getNodeLocation(node),
    });
  }

  /**
   * Extract struct definitions
   */
  private extractStruct(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[]
  ): void {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;

    const name = this.getNodeText(nameNode);
    const children: ParsedEntity[] = [];

    // Extract struct fields
    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      for (let i = 0; i < bodyNode.childCount; i++) {
        const child = bodyNode.child(i);
        if (child && child.type === "field_declaration") {
          const fieldName = this.extractFieldName(child);
          if (fieldName) {
            children.push({
              name: fieldName,
              type: "property",
              location: this.getNodeLocation(child),
            });
          }
        }
      }
    }

    entities.push({
      name: `struct ${name}`,
      type: "class", // Using 'class' for consistency with other analyzers
      location: this.getNodeLocation(node),
      children: children.length > 0 ? children : undefined,
    });
  }

  /**
   * Extract union definitions
   */
  private extractUnion(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[]
  ): void {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;

    const name = this.getNodeText(nameNode);
    entities.push({
      name: `union ${name}`,
      type: "class",
      location: this.getNodeLocation(node),
    });
  }

  /**
   * Extract enum definitions
   */
  private extractEnum(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[]
  ): void {
    const nameNode = node.childForFieldName("name");
    const name = nameNode ? this.getNodeText(nameNode) : "anonymous";

    const children: ParsedEntity[] = [];

    // Extract enum values
    const bodyNode = node.childForFieldName("body");
    if (bodyNode) {
      for (let i = 0; i < bodyNode.childCount; i++) {
        const child = bodyNode.child(i);
        if (child && child.type === "enumerator") {
          const enumName = this.getNodeText(child.childForFieldName("name") || child);
          if (enumName) {
            children.push({
              name: enumName,
              type: "constant",
              location: this.getNodeLocation(child),
            });
          }
        }
      }
    }

    entities.push({
      name: `enum ${name}`,
      type: "enum",
      location: this.getNodeLocation(node),
      children: children.length > 0 ? children : undefined,
    });
  }

  /**
   * Extract typedef definitions
   */
  private extractTypedef(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[]
  ): void {
    const declaratorNode = node.childForFieldName("declarator");
    if (!declaratorNode) return;

    const name = this.getDeclaratorName(declaratorNode);
    if (!name) return;

    entities.push({
      name: this.getNodeText(name),
      type: "type",
      location: this.getNodeLocation(node),
    });
  }

  /**
   * Extract macro definitions
   */
  private extractMacro(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[]
  ): void {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;

    const name = this.getNodeText(nameNode);
    entities.push({
      name: `#define ${name}`,
      type: "constant",
      location: this.getNodeLocation(node),
    });
  }

  /**
   * Extract function-like macros
   */
  private extractFunctionMacro(
    node: TreeSitterNode,
    filePath: string,
    entities: ParsedEntity[]
  ): void {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;

    const name = this.getNodeText(nameNode);
    entities.push({
      name: `#define ${name}()`,
      type: "function",
      location: this.getNodeLocation(node),
      modifiers: ["macro"],
    });
  }

  /**
   * Extract include directives as relationships
   */
  private extractInclude(
    node: TreeSitterNode,
    filePath: string,
    relationships: EntityRelationship[]
  ): void {
    const pathNode = node.childForFieldName("path");
    if (!pathNode) return;

    const includePath = this.getNodeText(pathNode).replace(/[<">]/g, "");

    relationships.push({
      from: filePath,
      to: includePath,
      type: "imports",
      sourceFile: filePath,
      metadata: {
        line: node.startPosition.row + 1,
      },
    });
  }

  /**
   * Helper: Get function name from declarator
   */
  private getFunctionName(declarator: TreeSitterNode): TreeSitterNode | null {
    if (declarator.type === "function_declarator") {
      const child = declarator.child(0);
      if (child?.type === "identifier") {
        return child;
      }
    }
    if (declarator.type === "pointer_declarator") {
      return this.getFunctionName(declarator.childForFieldName("declarator") || declarator);
    }
    return null;
  }

  /**
   * Helper: Get declarator name
   */
  private getDeclaratorName(declarator: TreeSitterNode): TreeSitterNode | null {
    if (declarator.type === "identifier") {
      return declarator;
    }
    if (declarator.type === "pointer_declarator" || declarator.type === "array_declarator") {
      const child = declarator.childForFieldName("declarator");
      return child ? this.getDeclaratorName(child) : null;
    }
    return null;
  }

  /**
   * Helper: Extract field name from field declaration
   */
  private extractFieldName(fieldNode: TreeSitterNode): string | null {
    const declaratorNode = fieldNode.childForFieldName("declarator");
    if (!declaratorNode) return null;

    const nameNode = this.getDeclaratorName(declaratorNode);
    return nameNode ? this.getNodeText(nameNode) : null;
  }

  /**
   * Helper: Get node text
   */
  private getNodeText(node: TreeSitterNode): string {
    return node.text || "";
  }

  /**
   * Helper: Get node location
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
}