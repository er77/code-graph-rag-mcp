/**
 * TASK-20250105-VBA-JAVA-GO-PHASE4: VBA Language Analyzer
 *
 * Regex-based analyzer for VBA language since no tree-sitter parser is available.
 * Supporting:
 * - Modules (Standard, Class, Form)
 * - Subroutines and Functions
 * - Properties (Get/Let/Set)
 * - Constants and Variables
 * - User-defined types
 * - Events and event handlers
 * - Class modules
 *
 * Relationships:
 * - Procedure calls
 * - Object references (COM objects)
 * - Event handler connections
 * - Module dependencies
 * - Library references
 *
 * Implementation uses regex patterns as fallback strategy with graceful degradation.
 */

import type {
  ParsedEntity,
  EntityRelationship,
} from "../types/parser.js";

// Circuit breaker constants
const MAX_FILE_SIZE = 1024 * 1024; // 1MB max file size for regex parsing
const PARSE_TIMEOUT_MS = 5000;

export class VbaAnalyzer {
  private parseStartTime = 0;
  private currentModule = "";
  private currentClass: string | null = null;

  /**
   * Helper: Get location info from line-based parsing
   */
  private getLineLocation(lineNumber: number, line: string) {
    return {
      start: {
        line: lineNumber,
        column: 0,
        index: 0 // Approximation
      },
      end: {
        line: lineNumber,
        column: line.length,
        index: 0 // Approximation
      }
    };
  }

  /**
   * Main entry point for analyzing VBA code
   * Uses regex-based parsing as fallback since no tree-sitter parser available
   */
  async analyze(
    content: string,
    filePath: string
  ): Promise<{ entities: ParsedEntity[]; relationships: EntityRelationship[] }> {
    this.resetState();

    const entities: ParsedEntity[] = [];
    const relationships: EntityRelationship[] = [];

    // Check file size limit for regex parsing
    if (content.length > MAX_FILE_SIZE) {
      console.warn(`[VbaAnalyzer] File too large for regex parsing: ${filePath}`);
      return { entities, relationships };
    }

    try {
      // Parse VBA code using regex patterns
      this.parseVbaCode(content, filePath, entities, relationships);
    } catch (error) {
      console.error(`[VbaAnalyzer] Error analyzing ${filePath}:`, error);
      // Return partial results on error
    }

    return { entities, relationships };
  }

  /**
   * Reset analyzer state for new file
   */
  private resetState(): void {
    this.parseStartTime = Date.now();
    this.currentModule = "";
    this.currentClass = null;
  }

  /**
   * Check timeout
   */
  private checkTimeout(): void {
    const elapsedTime = Date.now() - this.parseStartTime;
    if (elapsedTime > PARSE_TIMEOUT_MS) {
      throw new Error(`Parse timeout ${PARSE_TIMEOUT_MS}ms exceeded`);
    }
  }

  /**
   * Parse VBA code using regex patterns
   */
  private parseVbaCode(
    content: string,
    filePath: string,
    entities: ParsedEntity[],
    relationships: EntityRelationship[]
  ): void {
    const lines = content.split('\n');

    // Track current context
    let currentScope: string | null = null;
    let currentScopeType: string | null = null;
    let inType = false;
    let currentType: string | null = null;

    // Regex patterns for VBA constructs
    const patterns = {
      // Module declarations
      moduleAttribute: /^\s*Attribute\s+VB_Name\s*=\s*"([^"]+)"/i,
      classModule: /^\s*VERSION\s+1\.0\s+CLASS/i,

      // Option statements
      optionExplicit: /^\s*Option\s+Explicit/i,
      optionBase: /^\s*Option\s+Base\s+(\d+)/i,
      optionCompare: /^\s*Option\s+Compare\s+(Binary|Text|Database)/i,

      // Subroutines and Functions
      subStart: /^\s*(Public|Private|Friend)?\s*(Static)?\s*Sub\s+(\w+)\s*\(([^)]*)\)/i,
      functionStart: /^\s*(Public|Private|Friend)?\s*(Static)?\s*Function\s+(\w+)\s*\(([^)]*)\)\s*(As\s+(\w+))?/i,
      subEnd: /^\s*End\s+Sub/i,
      functionEnd: /^\s*End\s+Function/i,

      // Properties
      propertyGet: /^\s*(Public|Private|Friend)?\s*Property\s+Get\s+(\w+)\s*\(([^)]*)\)\s*(As\s+(\w+))?/i,
      propertyLet: /^\s*(Public|Private|Friend)?\s*Property\s+Let\s+(\w+)\s*\(([^)]*)\)/i,
      propertySet: /^\s*(Public|Private|Friend)?\s*Property\s+Set\s+(\w+)\s*\(([^)]*)\)/i,
      propertyEnd: /^\s*End\s+Property/i,

      // Variables and Constants
      dimStatement: /^\s*(Public|Private|Dim|Global)?\s*(Dim|Const)\s+(\w+)(?:\s*\(([^)]*)\))?\s*(As\s+(\w+))?/i,
      constStatement: /^\s*(Public|Private)?\s*Const\s+(\w+)\s*(As\s+(\w+))?\s*=\s*(.+)/i,

      // User-defined types
      typeStart: /^\s*(Public|Private)?\s*Type\s+(\w+)/i,
      typeEnd: /^\s*End\s+Type/i,
      typeField: /^\s*(\w+)\s+(As\s+(\w+))/i,

      // Enums
      enumStart: /^\s*(Public|Private)?\s*Enum\s+(\w+)/i,
      enumEnd: /^\s*End\s+Enum/i,
      enumMember: /^\s*(\w+)\s*(=\s*(.+))?/i,

      // Classes
      classStart: /^\s*Class\s+(\w+)/i,
      implementsStatement: /^\s*Implements\s+(\w+)/i,

      // Events
      eventHandler: /^\s*(Public|Private)?\s*Sub\s+(\w+)_(\w+)\s*\(([^)]*)\)/i,
      withEvents: /^\s*(Public|Private|Dim)?\s*WithEvents\s+(\w+)\s+As\s+(\w+)/i,

      // Procedure calls (simple detection)
      callStatement: /^\s*(?:Call\s+)?(\w+)(?:\s+|\s*\()/i,

      // Comments
      comment: /^\s*(?:'|Rem\s)/i,
    };

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      this.checkTimeout();

      const line = lines[i];
      const lineNumber = i + 1;

      // Skip comments
      if (patterns.comment.test(line)) {
        continue;
      }

      // Module attributes
      const moduleMatch = line.match(patterns.moduleAttribute);
      if (moduleMatch) {
        this.currentModule = moduleMatch[1];
        entities.push({
          id: `${filePath}:module:${this.currentModule}`,
          name: this.currentModule,
          type: "module",
          filePath,
          location: this.getLineLocation(lineNumber, line),
          metadata: {
            isVbaModule: true
          }
        });
        continue;
      }

      // Subroutines
      const subMatch = line.match(patterns.subStart);
      if (subMatch) {
        const visibility = subMatch[1] || "Public";
        const isStatic = !!subMatch[2];
        const subName = subMatch[3];
        const params = subMatch[4];

        // Check if it's an event handler
        const eventMatch = subName.match(/^(\w+)_(\w+)$/);
        const isEventHandler = !!eventMatch;

        currentScope = subName;
        currentScopeType = "Sub";

        const entity: ParsedEntity = {
          id: `${filePath}:sub:${subName}`,
          name: subName,
          type: "function",
          filePath,
          location: this.getLineLocation(lineNumber, line),
          modifiers: [visibility.toLowerCase()],
          metadata: {
            isPublic: visibility === "Public",
            isStatic,
            isEventHandler,
            parameters: this.parseParameters(params),
            module: this.currentModule
          }
        };

        if (isEventHandler && eventMatch) {
          entity.metadata.objectName = eventMatch[1];
          entity.metadata.eventName = eventMatch[2];
        }

        entities.push(entity);
        continue;
      }

      // Functions
      const functionMatch = line.match(patterns.functionStart);
      if (functionMatch) {
        const visibility = functionMatch[1] || "Public";
        const isStatic = !!functionMatch[2];
        const funcName = functionMatch[3];
        const params = functionMatch[4];
        const returnType = functionMatch[6];

        currentScope = funcName;
        currentScopeType = "Function";

        entities.push({
          id: `${filePath}:function:${funcName}`,
          name: funcName,
          type: "function",
          filePath,
          location: this.getLineLocation(lineNumber, line),
          modifiers: [visibility.toLowerCase()],
          returnType,
          metadata: {
            isPublic: visibility === "Public",
            isStatic,
            parameters: this.parseParameters(params),
            module: this.currentModule
          }
        });
        continue;
      }

      // Properties
      const propertyGetMatch = line.match(patterns.propertyGet);
      if (propertyGetMatch) {
        const visibility = propertyGetMatch[1] || "Public";
        const propName = propertyGetMatch[2];
        const params = propertyGetMatch[3];
        const returnType = propertyGetMatch[5];

        currentScope = propName;
        currentScopeType = "PropertyGet";

        entities.push({
          id: `${filePath}:property:${propName}:get`,
          name: `${propName} (Get)`,
          type: "property",
          filePath,
          location: this.getLineLocation(lineNumber, line),
          modifiers: [visibility.toLowerCase()],
          returnType,
          metadata: {
            isPublic: visibility === "Public",
            propertyType: "Get",
            parameters: this.parseParameters(params),
            module: this.currentModule
          }
        });
        continue;
      }

      const propertyLetMatch = line.match(patterns.propertyLet);
      if (propertyLetMatch) {
        const visibility = propertyLetMatch[1] || "Public";
        const propName = propertyLetMatch[2];
        const params = propertyLetMatch[3];

        currentScope = propName;
        currentScopeType = "PropertyLet";

        entities.push({
          id: `${filePath}:property:${propName}:let`,
          name: `${propName} (Let)`,
          type: "property",
          filePath,
          location: this.getLineLocation(lineNumber, line),
          modifiers: [visibility.toLowerCase()],
          metadata: {
            isPublic: visibility === "Public",
            propertyType: "Let",
            parameters: this.parseParameters(params),
            module: this.currentModule
          }
        });
        continue;
      }

      const propertySetMatch = line.match(patterns.propertySet);
      if (propertySetMatch) {
        const visibility = propertySetMatch[1] || "Public";
        const propName = propertySetMatch[2];
        const params = propertySetMatch[3];

        currentScope = propName;
        currentScopeType = "PropertySet";

        entities.push({
          id: `${filePath}:property:${propName}:set`,
          name: `${propName} (Set)`,
          type: "property",
          filePath,
          location: this.getLineLocation(lineNumber, line),
          modifiers: [visibility.toLowerCase()],
          metadata: {
            isPublic: visibility === "Public",
            propertyType: "Set",
            parameters: this.parseParameters(params),
            module: this.currentModule
          }
        });
        continue;
      }

      // End of procedures
      if (patterns.subEnd.test(line) || patterns.functionEnd.test(line) || patterns.propertyEnd.test(line)) {
        currentScope = null;
        currentScopeType = null;
        continue;
      }

      // User-defined types
      const typeStartMatch = line.match(patterns.typeStart);
      if (typeStartMatch) {
        const visibility = typeStartMatch[1] || "Public";
        const typeName = typeStartMatch[2];

        inType = true;
        currentType = typeName;

        entities.push({
          id: `${filePath}:type:${typeName}`,
          name: typeName,
          type: "typedef",
          filePath,
          location: this.getLineLocation(lineNumber, line),
          modifiers: [visibility.toLowerCase()],
          metadata: {
            isPublic: visibility === "Public",
            isUserDefinedType: true,
            module: this.currentModule
          }
        });
        continue;
      }

      if (patterns.typeEnd.test(line)) {
        inType = false;
        currentType = null;
        continue;
      }

      // Type fields
      if (inType && currentType) {
        const fieldMatch = line.match(patterns.typeField);
        if (fieldMatch) {
          const fieldName = fieldMatch[1];
          const fieldType = fieldMatch[3];

          entities.push({
            id: `${filePath}:type:${currentType}:field:${fieldName}`,
            name: fieldName,
            type: "property",
            filePath,
            location: this.getLineLocation(lineNumber, line),
            metadata: {
              fieldType,
              parent: `${filePath}:type:${currentType}`,
              module: this.currentModule
            }
          });

          relationships.push({
            from: `${filePath}:type:${currentType}:field:${fieldName}`,
            to: `${filePath}:type:${currentType}`,
            type: "member_of",
            metadata: {
              memberType: "field"
            }
          });
        }
        continue;
      }

      // Enums
      const enumStartMatch = line.match(patterns.enumStart);
      if (enumStartMatch) {
        const visibility = enumStartMatch[1] || "Public";
        const enumName = enumStartMatch[2];

        inType = true;
        currentType = enumName;

        entities.push({
          id: `${filePath}:enum:${enumName}`,
          name: enumName,
          type: "enum",
          filePath,
          location: this.getLineLocation(lineNumber, line),
          modifiers: [visibility.toLowerCase()],
          metadata: {
            isPublic: visibility === "Public",
            module: this.currentModule
          }
        });
        continue;
      }

      if (patterns.enumEnd.test(line)) {
        inType = false;
        currentType = null;
        continue;
      }

      // Constants
      const constMatch = line.match(patterns.constStatement);
      if (constMatch) {
        const visibility = constMatch[1] || "Private";
        const constName = constMatch[2];
        const constType = constMatch[4];
        const constValue = constMatch[5];

        entities.push({
          id: `${filePath}:const:${constName}`,
          name: constName,
          type: "constant",
          filePath,
          location: this.getLineLocation(lineNumber, line),
          modifiers: [visibility.toLowerCase()],
          metadata: {
            isPublic: visibility === "Public",
            constantType: constType,
            value: constValue,
            module: this.currentModule,
            scope: currentScope
          }
        });
        continue;
      }

      // Variables
      const dimMatch = line.match(patterns.dimStatement);
      if (dimMatch && !dimMatch[0].includes("Const")) {
        const visibility = dimMatch[1] || "Private";
        const varName = dimMatch[3];
        const arrayDims = dimMatch[4];
        const varType = dimMatch[6];

        entities.push({
          id: `${filePath}:var:${varName}`,
          name: varName,
          type: "variable",
          filePath,
          location: this.getLineLocation(lineNumber, line),
          modifiers: [visibility.toLowerCase()],
          metadata: {
            isPublic: visibility === "Public" || visibility === "Global",
            variableType: varType,
            isArray: !!arrayDims,
            arrayDimensions: arrayDims,
            module: this.currentModule,
            scope: currentScope
          }
        });
        continue;
      }

      // WithEvents variables (for event handling)
      const withEventsMatch = line.match(patterns.withEvents);
      if (withEventsMatch) {
        const visibility = withEventsMatch[1] || "Private";
        const varName = withEventsMatch[2];
        const varType = withEventsMatch[3];

        entities.push({
          id: `${filePath}:var:${varName}`,
          name: varName,
          type: "variable",
          filePath,
          location: this.getLineLocation(lineNumber, line),
          modifiers: [visibility.toLowerCase()],
          metadata: {
            isPublic: visibility === "Public",
            variableType: varType,
            withEvents: true,
            module: this.currentModule
          }
        });
        continue;
      }

      // Implements statement
      const implementsMatch = line.match(patterns.implementsStatement);
      if (implementsMatch) {
        const interfaceName = implementsMatch[1];

        relationships.push({
          from: `${filePath}:module:${this.currentModule}`,
          to: interfaceName,
          type: "implements",
          metadata: {
            implementationType: "interface"
          }
        });
        continue;
      }

      // Simple procedure call detection (within procedures)
      if (currentScope && !inType) {
        const callMatch = line.match(patterns.callStatement);
        if (callMatch) {
          const calledProc = callMatch[1];

          // Skip VBA keywords
          const vbaKeywords = ['If', 'Then', 'Else', 'ElseIf', 'End', 'For', 'Next', 'Do', 'Loop', 'While', 'Until', 'Select', 'Case', 'With', 'Exit', 'Return', 'GoTo', 'On', 'Error', 'Resume', 'Dim', 'Set', 'Let', 'ReDim'];

          if (!vbaKeywords.includes(calledProc)) {
            relationships.push({
              from: `${filePath}:${currentScopeType?.toLowerCase()}:${currentScope}`,
              to: calledProc,
              type: "calls",
              metadata: {
                callType: "procedure"
              }
            });
          }
        }
      }
    }
  }

  /**
   * Parse parameters from parameter string
   */
  private parseParameters(paramString: string): Array<{ name: string; type?: string }> {
    if (!paramString || paramString.trim() === "") {
      return [];
    }

    const params: Array<{ name: string; type?: string }> = [];
    const paramParts = paramString.split(',');

    for (const part of paramParts) {
      const trimmed = part.trim();

      // Match patterns like "ByVal name As Type" or "ByRef name As Type" or just "name As Type" or "name"
      const match = trimmed.match(/(?:(?:ByVal|ByRef)\s+)?(\w+)(?:\s+As\s+(\w+))?/i);

      if (match) {
        params.push({
          name: match[1],
          type: match[2]
        });
      }
    }

    return params;
  }
}