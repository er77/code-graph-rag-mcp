/**
 * TASK-20251005185121: C# Analyzer Module
 *
 * Comprehensive C# code analysis following the python-analyzer.ts pattern.
 * Implements multi-layer analysis architecture:
 * Layer 1: Basic entity extraction (classes, methods, properties)
 * Layer 2: Advanced C# features (LINQ, async/await, attributes)
 * Layer 3: Relationship mapping (inheritance, interfaces, dependencies)
 * Layer 4: Pattern recognition (design patterns, C# idioms)
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

// C# access modifiers
const ACCESS_MODIFIERS = ["public", "private", "protected", "internal", "protected internal", "private protected"];

// C# method modifiers
const METHOD_MODIFIERS = ["static", "virtual", "override", "abstract", "sealed", "async", "extern", "partial"];

// Common C# attributes
const COMMON_ATTRIBUTES = [
  "Serializable",
  "Obsolete",
  "DataContract",
  "DataMember",
  "ApiController",
  "Route",
  "HttpGet",
  "HttpPost",
  "HttpPut",
  "HttpDelete",
  "Authorize",
  "AllowAnonymous",
];

// LINQ query keywords
const LINQ_KEYWORDS = ["from", "where", "select", "group", "into", "orderby", "join", "let"];

// =============================================================================
// 3. C# ENTITY EXTRACTION (Layer 1)
// =============================================================================

export class CSharpAnalyzer {
  private metrics = {
    entitiesExtracted: 0,
    relationshipsFound: 0,
    patternsIdentified: 0,
    parseTime: 0,
  };

  /**
   * Main entry point for C# analysis
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
    this.extractNamespaces(node, entities, filePath);
    this.extractClasses(node, entities, relationships, filePath);
    this.extractInterfaces(node, entities, relationships, filePath);
    this.extractStructs(node, entities, filePath);
    this.extractEnums(node, entities, filePath);
    this.extractDelegates(node, entities, filePath);
    this.extractRecords(node, entities, filePath);

    // Extract imports/using statements
    this.extractUsings(node, imports, filePath);

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
   * Extract namespace declarations
   */
  private extractNamespaces(node: TreeSitterNode, entities: ParsedEntity[], filePath: string): void {
    const namespaceNodes = this.findNodes(node, "namespace_declaration");

    for (const nsNode of namespaceNodes) {
      const nameNode = nsNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(nsNode);

      entities.push({
        id: `${filePath}:namespace:${name}`,
        name,
        type: "namespace",
        filePath,
        location,
        metadata: {
          memberCount: this.countMembers(nsNode),
        },
      });
    }
  }

  /**
   * Extract class declarations with inheritance and implementation
   */
  private extractClasses(
    node: TreeSitterNode,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    filePath: string
  ): void {
    const classNodes = this.findNodes(node, "class_declaration");

    for (const classNode of classNodes) {
      const nameNode = classNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(classNode);
      const modifiers = this.extractModifiers(classNode);
      const isAbstract = modifiers.includes("abstract");
      const isSealed = modifiers.includes("sealed");
      const isPartial = modifiers.includes("partial");
      const isStatic = modifiers.includes("static");

      // Extract base types (inheritance and interfaces)
      const baseList = classNode.childForFieldName("bases");
      const baseTypes: string[] = [];
      if (baseList) {
        const baseNodes = this.findNodes(baseList, "base_type");
        for (const baseNode of baseNodes) {
          const baseType = this.getNodeText(baseNode);
          baseTypes.push(baseType);

          // Create inheritance relationship
          relationships.push({
            source: `${filePath}:class:${name}`,
            target: `${filePath}:type:${baseType}`,
            type: "inherits",
            metadata: { filePath },
          });
        }
      }

      // Extract attributes
      const attributes = this.extractAttributes(classNode);

      // Extract members
      const methods = this.extractMethods(classNode, name, entities, filePath);
      const properties = this.extractProperties(classNode, name, entities, filePath);
      const fields = this.extractFields(classNode, name, entities, filePath);
      const events = this.extractEvents(classNode, name, entities, filePath);

      entities.push({
        id: `${filePath}:class:${name}`,
        name,
        type: "class",
        filePath,
        location,
        metadata: {
          isAbstract,
          isSealed,
          isPartial,
          isStatic,
          modifiers,
          baseTypes,
          attributes,
          methodCount: methods.length,
          propertyCount: properties.length,
          fieldCount: fields.length,
          eventCount: events.length,
        },
      });
    }
  }

  /**
   * Extract interface declarations
   */
  private extractInterfaces(
    node: TreeSitterNode,
    entities: ParsedEntity[],
    relationships: EntityRelationship[],
    filePath: string
  ): void {
    const interfaceNodes = this.findNodes(node, "interface_declaration");

    for (const intNode of interfaceNodes) {
      const nameNode = intNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(intNode);
      const modifiers = this.extractModifiers(intNode);

      // Extract base interfaces
      const baseList = intNode.childForFieldName("bases");
      const baseInterfaces: string[] = [];
      if (baseList) {
        const baseNodes = this.findNodes(baseList, "base_type");
        for (const baseNode of baseNodes) {
          const baseInterface = this.getNodeText(baseNode);
          baseInterfaces.push(baseInterface);

          relationships.push({
            source: `${filePath}:interface:${name}`,
            target: `${filePath}:interface:${baseInterface}`,
            type: "extends",
            metadata: { filePath },
          });
        }
      }

      // Extract interface members
      const methods = this.extractInterfaceMethods(intNode, name, entities, filePath);
      const properties = this.extractInterfaceProperties(intNode, name, entities, filePath);

      entities.push({
        id: `${filePath}:interface:${name}`,
        name,
        type: "interface",
        filePath,
        location,
        metadata: {
          modifiers,
          baseInterfaces,
          methodCount: methods.length,
          propertyCount: properties.length,
        },
      });
    }
  }

  /**
   * Extract struct declarations
   */
  private extractStructs(node: TreeSitterNode, entities: ParsedEntity[], filePath: string): void {
    const structNodes = this.findNodes(node, "struct_declaration");

    for (const structNode of structNodes) {
      const nameNode = structNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(structNode);
      const modifiers = this.extractModifiers(structNode);
      const isReadonly = modifiers.includes("readonly");

      entities.push({
        id: `${filePath}:struct:${name}`,
        name,
        type: "struct",
        filePath,
        location,
        metadata: {
          isReadonly,
          modifiers,
        },
      });
    }
  }

  /**
   * Extract enum declarations
   */
  private extractEnums(node: TreeSitterNode, entities: ParsedEntity[], filePath: string): void {
    const enumNodes = this.findNodes(node, "enum_declaration");

    for (const enumNode of enumNodes) {
      const nameNode = enumNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(enumNode);
      const members = this.extractEnumMembers(enumNode);

      entities.push({
        id: `${filePath}:enum:${name}`,
        name,
        type: "enum",
        filePath,
        location,
        metadata: {
          members,
          memberCount: members.length,
        },
      });
    }
  }

  /**
   * Extract delegate declarations
   */
  private extractDelegates(node: TreeSitterNode, entities: ParsedEntity[], filePath: string): void {
    const delegateNodes = this.findNodes(node, "delegate_declaration");

    for (const delegateNode of delegateNodes) {
      const nameNode = delegateNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(delegateNode);
      const returnType = this.extractReturnType(delegateNode);
      const parameters = this.extractParameters(delegateNode);

      entities.push({
        id: `${filePath}:delegate:${name}`,
        name,
        type: "delegate",
        filePath,
        location,
        metadata: {
          returnType,
          parameters,
        },
      });
    }
  }

  /**
   * Extract record declarations (C# 9+)
   */
  private extractRecords(node: TreeSitterNode, entities: ParsedEntity[], filePath: string): void {
    const recordNodes = this.findNodes(node, "record_declaration");

    for (const recordNode of recordNodes) {
      const nameNode = recordNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(recordNode);
      const modifiers = this.extractModifiers(recordNode);
      const isRecordStruct = recordNode.type === "record_struct_declaration";

      entities.push({
        id: `${filePath}:record:${name}`,
        name,
        type: "record",
        filePath,
        location,
        metadata: {
          isRecordStruct,
          modifiers,
        },
      });
    }
  }

  /**
   * Extract method declarations
   */
  private extractMethods(
    classNode: TreeSitterNode,
    className: string,
    entities: ParsedEntity[],
    filePath: string
  ): ParsedEntity[] {
    const methods: ParsedEntity[] = [];
    const methodNodes = this.findNodes(classNode, "method_declaration");

    for (const methodNode of methodNodes) {
      const nameNode = methodNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(methodNode);
      const modifiers = this.extractModifiers(methodNode);
      const returnType = this.extractReturnType(methodNode);
      const parameters = this.extractParameters(methodNode);
      const attributes = this.extractAttributes(methodNode);

      const isAsync = modifiers.includes("async");
      const isStatic = modifiers.includes("static");
      const isVirtual = modifiers.includes("virtual");
      const isOverride = modifiers.includes("override");
      const isAbstract = modifiers.includes("abstract");

      const method: ParsedEntity = {
        id: `${filePath}:class:${className}:method:${name}`,
        name,
        type: "method",
        filePath,
        location,
        metadata: {
          className,
          modifiers,
          returnType,
          parameters,
          attributes,
          isAsync,
          isStatic,
          isVirtual,
          isOverride,
          isAbstract,
        },
      };

      methods.push(method);
      entities.push(method);
    }

    return methods;
  }

  /**
   * Extract property declarations
   */
  private extractProperties(
    classNode: TreeSitterNode,
    className: string,
    entities: ParsedEntity[],
    filePath: string
  ): ParsedEntity[] {
    const properties: ParsedEntity[] = [];
    const propertyNodes = this.findNodes(classNode, "property_declaration");

    for (const propNode of propertyNodes) {
      const nameNode = propNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(propNode);
      const modifiers = this.extractModifiers(propNode);
      const type = this.extractPropertyType(propNode);
      const hasGetter = this.hasAccessor(propNode, "get");
      const hasSetter = this.hasAccessor(propNode, "set");
      const hasInit = this.hasAccessor(propNode, "init");

      const property: ParsedEntity = {
        id: `${filePath}:class:${className}:property:${name}`,
        name,
        type: "property",
        filePath,
        location,
        metadata: {
          className,
          modifiers,
          propertyType: type,
          hasGetter,
          hasSetter,
          hasInit,
        },
      };

      properties.push(property);
      entities.push(property);
    }

    return properties;
  }

  /**
   * Extract field declarations
   */
  private extractFields(
    classNode: TreeSitterNode,
    className: string,
    entities: ParsedEntity[],
    filePath: string
  ): ParsedEntity[] {
    const fields: ParsedEntity[] = [];
    const fieldNodes = this.findNodes(classNode, "field_declaration");

    for (const fieldNode of fieldNodes) {
      const declarators = this.findNodes(fieldNode, "variable_declarator");
      const type = this.extractFieldType(fieldNode);
      const modifiers = this.extractModifiers(fieldNode);

      for (const declarator of declarators) {
        const nameNode = declarator.childForFieldName("name");
        if (!nameNode) continue;

        const name = this.getNodeText(nameNode);
        const location = this.getNodeLocation(declarator);
        const isReadonly = modifiers.includes("readonly");
        const isConst = modifiers.includes("const");
        const isStatic = modifiers.includes("static");

        const field: ParsedEntity = {
          id: `${filePath}:class:${className}:field:${name}`,
          name,
          type: "field",
          filePath,
          location,
          metadata: {
            className,
            fieldType: type,
            modifiers,
            isReadonly,
            isConst,
            isStatic,
          },
        };

        fields.push(field);
        entities.push(field);
      }
    }

    return fields;
  }

  /**
   * Extract event declarations
   */
  private extractEvents(
    classNode: TreeSitterNode,
    className: string,
    entities: ParsedEntity[],
    filePath: string
  ): ParsedEntity[] {
    const events: ParsedEntity[] = [];
    const eventNodes = this.findNodes(classNode, "event_declaration");

    for (const eventNode of eventNodes) {
      const nameNode = eventNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(eventNode);
      const modifiers = this.extractModifiers(eventNode);
      const eventType = this.extractEventType(eventNode);

      const event: ParsedEntity = {
        id: `${filePath}:class:${className}:event:${name}`,
        name,
        type: "event",
        filePath,
        location,
        metadata: {
          className,
          eventType,
          modifiers,
        },
      };

      events.push(event);
      entities.push(event);
    }

    return events;
  }

  /**
   * Extract interface methods
   */
  private extractInterfaceMethods(
    interfaceNode: TreeSitterNode,
    interfaceName: string,
    entities: ParsedEntity[],
    filePath: string
  ): ParsedEntity[] {
    const methods: ParsedEntity[] = [];
    const methodNodes = this.findNodes(interfaceNode, "method_declaration");

    for (const methodNode of methodNodes) {
      const nameNode = methodNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(methodNode);
      const returnType = this.extractReturnType(methodNode);
      const parameters = this.extractParameters(methodNode);

      const method: ParsedEntity = {
        id: `${filePath}:interface:${interfaceName}:method:${name}`,
        name,
        type: "method",
        filePath,
        location,
        metadata: {
          interfaceName,
          returnType,
          parameters,
          isInterfaceMethod: true,
        },
      };

      methods.push(method);
      entities.push(method);
    }

    return methods;
  }

  /**
   * Extract interface properties
   */
  private extractInterfaceProperties(
    interfaceNode: TreeSitterNode,
    interfaceName: string,
    entities: ParsedEntity[],
    filePath: string
  ): ParsedEntity[] {
    const properties: ParsedEntity[] = [];
    const propertyNodes = this.findNodes(interfaceNode, "property_declaration");

    for (const propNode of propertyNodes) {
      const nameNode = propNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const location = this.getNodeLocation(propNode);
      const type = this.extractPropertyType(propNode);
      const hasGetter = this.hasAccessor(propNode, "get");
      const hasSetter = this.hasAccessor(propNode, "set");

      const property: ParsedEntity = {
        id: `${filePath}:interface:${interfaceName}:property:${name}`,
        name,
        type: "property",
        filePath,
        location,
        metadata: {
          interfaceName,
          propertyType: type,
          hasGetter,
          hasSetter,
          isInterfaceProperty: true,
        },
      };

      properties.push(property);
      entities.push(property);
    }

    return properties;
  }

  /**
   * Extract using statements (imports)
   */
  private extractUsings(node: TreeSitterNode, imports: ImportDependency[], filePath: string): void {
    const usingNodes = this.findNodes(node, "using_directive");

    for (const usingNode of usingNodes) {
      const nameNode = usingNode.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      const isStatic = this.hasChild(usingNode, "static");
      const alias = this.extractAlias(usingNode);

      imports.push({
        source: filePath,
        target: name,
        type: isStatic ? "static_using" : "using",
        metadata: {
          alias,
          isStatic,
        },
      });
    }

    // Also extract global using statements (C# 10+)
    const globalUsingNodes = this.findNodes(node, "global_using_directive");
    for (const globalUsing of globalUsingNodes) {
      const nameNode = globalUsing.childForFieldName("name");
      if (!nameNode) continue;

      const name = this.getNodeText(nameNode);
      imports.push({
        source: filePath,
        target: name,
        type: "global_using",
        metadata: {
          isGlobal: true,
        },
      });
    }
  }

  /**
   * Identify C# patterns (Layer 4)
   */
  private identifyPatterns(node: TreeSitterNode, entities: ParsedEntity[]): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];

    // Identify Singleton pattern
    const singletonPattern = this.identifySingletonPattern(entities);
    if (singletonPattern) patterns.push(singletonPattern);

    // Identify Repository pattern
    const repositoryPattern = this.identifyRepositoryPattern(entities);
    if (repositoryPattern) patterns.push(repositoryPattern);

    // Identify Async/Await patterns
    const asyncPatterns = this.identifyAsyncPatterns(node);
    patterns.push(...asyncPatterns);

    // Identify LINQ usage
    const linqPatterns = this.identifyLINQPatterns(node);
    patterns.push(...linqPatterns);

    // Identify Dependency Injection patterns
    const diPatterns = this.identifyDependencyInjectionPatterns(entities);
    patterns.push(...diPatterns);

    return patterns;
  }

  /**
   * Identify Singleton pattern
   */
  private identifySingletonPattern(entities: ParsedEntity[]): PatternAnalysis | null {
    for (const entity of entities) {
      if (entity.type !== "class") continue;

      const metadata = entity.metadata as any;
      const hasStaticInstance = entities.some(
        e =>
          e.type === "property" &&
          e.metadata?.className === entity.name &&
          e.metadata?.modifiers?.includes("static") &&
          e.name.toLowerCase() === "instance"
      );

      const hasPrivateConstructor = entities.some(
        e =>
          e.type === "method" &&
          e.name === entity.name && // Constructor has same name as class
          e.metadata?.className === entity.name &&
          e.metadata?.modifiers?.includes("private")
      );

      if (hasStaticInstance && hasPrivateConstructor) {
        return {
          type: "singleton",
          confidence: 0.95,
          entities: [entity.id],
          description: `Singleton pattern detected in class ${entity.name}`,
        };
      }
    }

    return null;
  }

  /**
   * Identify Repository pattern
   */
  private identifyRepositoryPattern(entities: ParsedEntity[]): PatternAnalysis | null {
    for (const entity of entities) {
      if (entity.type !== "class" && entity.type !== "interface") continue;

      if (entity.name.endsWith("Repository") || entity.name.endsWith("Repo")) {
        const crudMethods = ["Create", "Read", "Update", "Delete", "Get", "Add", "Remove", "Find"];
        const classMethods = entities.filter(
          e => e.type === "method" && (e.metadata?.className === entity.name || e.metadata?.interfaceName === entity.name)
        );

        const hasCrudMethods = classMethods.some(m =>
          crudMethods.some(crud => m.name.includes(crud))
        );

        if (hasCrudMethods) {
          return {
            type: "repository",
            confidence: 0.85,
            entities: [entity.id],
            description: `Repository pattern detected in ${entity.type} ${entity.name}`,
          };
        }
      }
    }

    return null;
  }

  /**
   * Identify async/await patterns
   */
  private identifyAsyncPatterns(node: TreeSitterNode): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];
    const asyncMethods = this.findNodes(node, "method_declaration").filter(m => {
      const modifiers = this.extractModifiers(m);
      return modifiers.includes("async");
    });

    if (asyncMethods.length > 0) {
      patterns.push({
        type: "async_await",
        confidence: 1.0,
        entities: [],
        description: `Found ${asyncMethods.length} async methods using async/await pattern`,
        metadata: {
          count: asyncMethods.length,
        },
      });
    }

    return patterns;
  }

  /**
   * Identify LINQ patterns
   */
  private identifyLINQPatterns(node: TreeSitterNode): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];

    // Check for LINQ query syntax
    const queryExpressions = this.findNodes(node, "query_expression");
    if (queryExpressions.length > 0) {
      patterns.push({
        type: "linq_query",
        confidence: 1.0,
        entities: [],
        description: `Found ${queryExpressions.length} LINQ query expressions`,
        metadata: {
          count: queryExpressions.length,
        },
      });
    }

    // Check for LINQ method syntax (common methods)
    const linqMethods = ["Where", "Select", "OrderBy", "GroupBy", "Join", "FirstOrDefault", "Any", "All"];
    const invocations = this.findNodes(node, "invocation_expression");
    const linqMethodCalls = invocations.filter(inv => {
      const memberAccess = inv.childForFieldName("function");
      if (memberAccess && memberAccess.type === "member_access_expression") {
        const name = this.getNodeText(memberAccess.childForFieldName("name") || memberAccess);
        return linqMethods.includes(name);
      }
      return false;
    });

    if (linqMethodCalls.length > 0) {
      patterns.push({
        type: "linq_method",
        confidence: 0.9,
        entities: [],
        description: `Found ${linqMethodCalls.length} LINQ method calls`,
        metadata: {
          count: linqMethodCalls.length,
        },
      });
    }

    return patterns;
  }

  /**
   * Identify Dependency Injection patterns
   */
  private identifyDependencyInjectionPatterns(entities: ParsedEntity[]): PatternAnalysis[] {
    const patterns: PatternAnalysis[] = [];

    // Check for constructor injection
    for (const entity of entities) {
      if (entity.type !== "class") continue;

      const constructors = entities.filter(
        e => e.type === "method" && e.name === entity.name && e.metadata?.className === entity.name
      );

      for (const ctor of constructors) {
        const params = (ctor.metadata?.parameters || []) as any[];
        if (params.length > 0 && params.some(p => p.type?.includes("I"))) {
          patterns.push({
            type: "constructor_injection",
            confidence: 0.8,
            entities: [entity.id, ctor.id],
            description: `Constructor injection pattern in ${entity.name}`,
          });
        }
      }
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
   * Extract modifiers from a declaration
   */
  private extractModifiers(node: TreeSitterNode): string[] {
    const modifiers: string[] = [];
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === "modifier") {
        modifiers.push(this.getNodeText(child));
      }
    }
    return modifiers;
  }

  /**
   * Extract attributes from a declaration
   */
  private extractAttributes(node: TreeSitterNode): string[] {
    const attributes: string[] = [];
    const attrLists = this.findNodes(node, "attribute_list");
    for (const list of attrLists) {
      const attrs = this.findNodes(list, "attribute");
      for (const attr of attrs) {
        const nameNode = attr.childForFieldName("name");
        if (nameNode) {
          attributes.push(this.getNodeText(nameNode));
        }
      }
    }
    return attributes;
  }

  /**
   * Extract return type from a method
   */
  private extractReturnType(node: TreeSitterNode): string {
    const returnTypeNode = node.childForFieldName("type");
    return returnTypeNode ? this.getNodeText(returnTypeNode) : "void";
  }

  /**
   * Extract parameters from a method
   */
  private extractParameters(node: TreeSitterNode): Array<{ name: string; type: string }> {
    const parameters: Array<{ name: string; type: string }> = [];
    const paramList = node.childForFieldName("parameters");

    if (paramList) {
      const params = this.findNodes(paramList, "parameter");
      for (const param of params) {
        const nameNode = param.childForFieldName("name");
        const typeNode = param.childForFieldName("type");
        if (nameNode && typeNode) {
          parameters.push({
            name: this.getNodeText(nameNode),
            type: this.getNodeText(typeNode),
          });
        }
      }
    }

    return parameters;
  }

  /**
   * Extract property type
   */
  private extractPropertyType(node: TreeSitterNode): string {
    const typeNode = node.childForFieldName("type");
    return typeNode ? this.getNodeText(typeNode) : "unknown";
  }

  /**
   * Extract field type
   */
  private extractFieldType(node: TreeSitterNode): string {
    const typeNode = node.childForFieldName("type");
    return typeNode ? this.getNodeText(typeNode) : "unknown";
  }

  /**
   * Extract event type
   */
  private extractEventType(node: TreeSitterNode): string {
    const typeNode = node.childForFieldName("type");
    return typeNode ? this.getNodeText(typeNode) : "EventHandler";
  }

  /**
   * Check if property has specific accessor
   */
  private hasAccessor(node: TreeSitterNode, accessor: string): boolean {
    const accessorList = node.childForFieldName("accessors");
    if (!accessorList) return false;

    for (let i = 0; i < accessorList.childCount; i++) {
      const child = accessorList.child(i);
      if (child && child.type === `${accessor}_accessor`) {
        return true;
      }
    }
    return false;
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
   * Extract alias from using statement
   */
  private extractAlias(node: TreeSitterNode): string | undefined {
    const aliasNode = node.childForFieldName("alias");
    return aliasNode ? this.getNodeText(aliasNode) : undefined;
  }

  /**
   * Extract enum members
   */
  private extractEnumMembers(node: TreeSitterNode): string[] {
    const members: string[] = [];
    const memberNodes = this.findNodes(node, "enum_member_declaration");

    for (const member of memberNodes) {
      const nameNode = member.childForFieldName("name");
      if (nameNode) {
        members.push(this.getNodeText(nameNode));
      }
    }

    return members;
  }

  /**
   * Count members in a namespace or class
   */
  private countMembers(node: TreeSitterNode): number {
    let count = 0;
    const memberTypes = [
      "class_declaration",
      "interface_declaration",
      "struct_declaration",
      "enum_declaration",
      "delegate_declaration",
      "record_declaration",
    ];

    for (const type of memberTypes) {
      count += this.findNodes(node, type).length;
    }

    return count;
  }
}

// Export default instance
export default new CSharpAnalyzer();