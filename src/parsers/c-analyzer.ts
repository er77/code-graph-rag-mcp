/**
 * TASK-20251005191500: C Language Analyzer
 *
 * Analyzer for C language supporting:
 *  - Functions (static, extern, inline)
 *  - Structs, unions, enums, typedefs
 *  - Global variables and constants
 *  - Macros and preprocessor directives
 *  - Include relationships
 *
 * Implementation follows patterns from CSharpAnalyzer and RustAnalyzer
 * with circuit breakers for safety.
 */

import type { EntityRelationship, ParsedEntity, TreeSitterNode } from "../types/parser.js";

// Circuit breaker constants
const MAX_RECURSION_DEPTH = 50;
const PARSE_TIMEOUT_MS = 5000;

export class CAnalyzer {
  private parseStartTime = 0;

  /**
   * Main entry point for analyzing C code
   */
  async analyze(
    rootNode: TreeSitterNode,
    filePath: string,
  ): Promise<{ entities: ParsedEntity[]; relationships: EntityRelationship[] }> {
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
    depth = 0,
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
        this.extractFunction(node, entities);
        break;

      case "declaration":
        this.extractDeclaration(node, entities);
        break;

      case "struct_specifier":
        this.extractStruct(node, entities);
        break;

      case "union_specifier":
        this.extractUnion(node, entities);
        break;

      case "enum_specifier":
        this.extractEnum(node, entities);
        break;

      case "type_definition":
        this.extractTypedef(node, entities);
        break;

      case "preproc_def":
        this.extractMacro(node, entities);
        break;

      case "preproc_include":
        this.extractInclude(node, filePath, relationships);
        break;

      case "preproc_function_def":
        this.extractFunctionMacro(node, entities);
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
   * Extract function definitions (with body)
   */
  private extractFunction(node: TreeSitterNode, entities: ParsedEntity[]): void {
    const declaratorNode = node.childForFieldName("declarator");
    if (!declaratorNode) return;

    const nameNode = this.getFunctionName(declaratorNode);
    if (!nameNode) return;

    const name = this.getNodeText(nameNode);
    const modifiers = this.collectModifiers(node);

    entities.push({
      name,
      type: "function",
      location: this.getNodeLocation(node),
      modifiers: modifiers.length ? modifiers : undefined,
    });
  }

  /**
   * Extract declarations: functions without body (e.g. extern), variables/constants
   */
  private extractDeclaration(node: TreeSitterNode, entities: ParsedEntity[]): void {
    const text = this.getNodeText(node);
    const mods = this.collectModifiers(node);
    const isConst = /\bconst\b/.test(text);

    const initDecls = this.descendantsOfType(node, "init_declarator");
    if (initDecls.length > 0) {
      for (const id of initDecls) {
        const dec = id.childForFieldName("declarator") || id;
        if (!dec) continue;

        if (this.isFunctionDeclarator(dec)) {
          const fnameNode = this.getFunctionName(dec);
          if (!fnameNode) continue;
          const name = this.getNodeText(fnameNode);
          entities.push({
            name,
            type: "function",
            location: this.getNodeLocation(node),
            modifiers: mods.length ? mods : undefined,
          });
        } else {
          const vnameNode = this.getDeclaratorName(dec);
          if (!vnameNode) continue;
          const name = this.getNodeText(vnameNode);
          entities.push({
            name,
            type: isConst ? "constant" : "variable",
            location: this.getNodeLocation(node),
            modifiers: mods.length ? mods : undefined,
          });
        }
      }
      return;
    }

    const declaratorNode = node.childForFieldName("declarator");
    if (declaratorNode) {
      if (this.isFunctionDeclarator(declaratorNode)) {
        const fname = this.getFunctionName(declaratorNode);
        if (fname) {
          entities.push({
            name: this.getNodeText(fname),
            type: "function",
            location: this.getNodeLocation(node),
            modifiers: mods.length ? mods : undefined,
          });
        }
        return;
      }
      const nameNode = this.getDeclaratorName(declaratorNode);
      if (nameNode) {
        entities.push({
          name: this.getNodeText(nameNode),
          type: isConst ? "constant" : "variable",
          location: this.getNodeLocation(node),
          modifiers: mods.length ? mods : undefined,
        });
      }
    }
  }
  /**
   * Extract struct definitions
   */
  private extractStruct(node: TreeSitterNode, entities: ParsedEntity[]): void {
    const nameNode =
      node.childForFieldName("name") || this.findFirstNamedChildByTypes(node, ["type_identifier", "identifier"]);
    if (!nameNode) {
      return;
    }
    const name = `struct ${this.getNodeText(nameNode)}`;
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
      name,
      type: "class", // Using 'class' for consistency with other analyzers
      location: this.getNodeLocation(node),
      children: children.length > 0 ? children : undefined,
    });
  }

  /**
   * Extract union definitions
   */
  private extractUnion(node: TreeSitterNode, entities: ParsedEntity[]): void {
    const nameNode =
      node.childForFieldName("name") || this.findFirstNamedChildByTypes(node, ["type_identifier", "identifier"]);
    if (!nameNode) return;
    const name = `union ${this.getNodeText(nameNode)}`;
    entities.push({
      name,
      type: "class",
      location: this.getNodeLocation(node),
    });
  }

  /**
   * Extract enum definitions
   */
  private extractEnum(node: TreeSitterNode, entities: ParsedEntity[]): void {
    const nameNode =
      node.childForFieldName("name") || this.findFirstNamedChildByTypes(node, ["type_identifier", "identifier"]);
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
  private extractTypedef(node: TreeSitterNode, entities: ParsedEntity[]): void {
    const typeDeclarators = this.descendantsOfType(node, "type_declarator");
    if (typeDeclarators.length > 0) {
      for (const td of typeDeclarators) {
        const nameNode =
          this.findLastDescendantByTypes(td, ["type_identifier", "identifier"]) || td.childForFieldName("declarator");
        if (!nameNode) continue;
        const name = this.getNodeText(nameNode);
        if (!name) continue;
        entities.push({
          name,
          type: "type",
          location: this.getNodeLocation(node),
        });
      }
      return;
    }

    const ids = this.descendantsOfType(node, "type_identifier");
    if (ids.length > 0) {
      const lastId = ids[ids.length - 1];
      if (lastId) {
        const name = this.getNodeText(lastId);
        if (name) {
          entities.push({
            name,
            type: "type",
            location: this.getNodeLocation(node),
          });
        }
      }
    }
  }

  /**
   * Extract macro definitions
   */
  private extractMacro(node: TreeSitterNode, entities: ParsedEntity[]): void {
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
  private extractFunctionMacro(node: TreeSitterNode, entities: ParsedEntity[]): void {
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
  private extractInclude(node: TreeSitterNode, filePath: string, relationships: EntityRelationship[]): void {
    const pathNode =
      node.childForFieldName("path") || this.findFirstNamedChildByTypes(node, ["system_lib_string", "string_literal"]);
    if (!pathNode) return;

    const raw = this.getNodeText(pathNode);
    const includePath = raw.replace(/[<">]/g, "");
    relationships.push({
      from: filePath,
      to: includePath,
      type: "imports",
      sourceFile: filePath,
      metadata: { line: node.startPosition.row + 1 },
    });
  }

  /**
   * Helper: Get function name from declarator
   */
  private getFunctionName(declarator: TreeSitterNode): TreeSitterNode | null {
    if (!declarator) return null;

    // Сам идентификатор
    if (declarator.type === "identifier") {
      return declarator;
    }

    // function_declarator: имя может быть глубоко внутри
    if (declarator.type === "function_declarator") {
      const inner = declarator.childForFieldName("declarator") || declarator.child(0);
      if (inner) {
        const r = this.getFunctionName(inner);
        if (r) return r;
      }
      // fallback: найти первый identifier среди потомков
      const id = this.findFirstDescendantByTypes(declarator, ["identifier"]);
      if (id) return id;
    }

    // Всякие обёртки
    if (
      declarator.type === "pointer_declarator" ||
      declarator.type === "parenthesized_declarator" ||
      declarator.type === "abstract_pointer_declarator"
    ) {
      const inner = declarator.childForFieldName("declarator") || declarator.child(0);
      if (inner) return this.getFunctionName(inner);
    }

    // fallback
    return this.findFirstDescendantByTypes(declarator, ["identifier"]);
  }
  /**
   * Helper: Get declarator name
   */
  private getDeclaratorName(declarator: TreeSitterNode): TreeSitterNode | null {
    if (!declarator) return null;
    if (declarator.type === "identifier" || declarator.type === "field_identifier") return declarator;

    if (
      declarator.type === "pointer_declarator" ||
      declarator.type === "array_declarator" ||
      declarator.type === "parenthesized_declarator"
    ) {
      const child = declarator.childForFieldName("declarator") || declarator.child(0);
      return child ? this.getDeclaratorName(child) : null;
    }

    return this.findFirstDescendantByTypes(declarator, ["identifier", "field_identifier"]);
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

  // Helpers
  private descendantsOfType(node: TreeSitterNode, type: string): TreeSitterNode[] {
    const anyNode = node as unknown as { descendantsOfType?: (t: string) => TreeSitterNode[] };
    if (typeof anyNode.descendantsOfType === "function") {
      return anyNode.descendantsOfType(type) || [];
    }
    const out: TreeSitterNode[] = [];
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (!c) continue;
      if (c.type === type) out.push(c);
      out.push(...this.descendantsOfType(c, type));
    }
    return out;
  }

  private findFirstDescendantByTypes(node: TreeSitterNode, types: string[]): TreeSitterNode | null {
    for (const t of types) {
      const list = this.descendantsOfType(node, t);
      if (list.length > 0) return list[0] || null;
    }
    return null;
  }

  private findLastDescendantByTypes(node: TreeSitterNode, types: string[]): TreeSitterNode | null {
    for (const t of types) {
      const list = this.descendantsOfType(node, t);
      if (list.length > 0) return list[list.length - 1] || null;
    }
    return null;
  }

  private findFirstNamedChildByTypes(node: TreeSitterNode, types: string[]): TreeSitterNode | null {
    for (let i = 0; i < node.namedChildCount; i++) {
      const c = node.namedChild(i);
      if (c && types.includes(c.type)) return c;
    }
    return null;
  }

  private isFunctionDeclarator(node: TreeSitterNode): boolean {
    if (node.type === "function_declarator") return true;
    const inner = node.childForFieldName("declarator");
    if (inner) return this.isFunctionDeclarator(inner);
    return false;
  }

  private collectModifiers(node: TreeSitterNode): string[] {
    const text = this.getNodeText(node);
    const mods: string[] = [];
    if (/\bstatic\b/.test(text)) mods.push("static");
    if (/\binline\b/.test(text)) mods.push("inline");
    if (/\bextern\b/.test(text)) mods.push("extern");
    return mods;
  }
}
