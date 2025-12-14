/**
 * TASK-003B: Advanced Python Analyzer Module
 *
 * Comprehensive Python code analysis implementing 4-layer enhancement architecture:
 * Layer 1: Enhanced Basic Parsing - Method classification, complex type hints, decorator chaining
 * Layer 2: Advanced Feature Analysis - Magic methods, properties, async patterns, generators, dataclasses
 * Layer 3: Relationship Mapping - Inheritance hierarchies, MRO, import dependencies, method overrides
 * Layer 4: Pattern Recognition - Context managers, exception handling, design patterns, Python idioms
 *
 * Architecture References:
 * - Project Overview: doc/PROJECT_OVERVIEW.md
 * - Coding Standards: doc/CODING_STANDARD.md
 * - Architectural Decisions: doc/ARCHITECTURAL_DECISIONS.md
 * - Enhanced Parser Types: src/types/parser.ts
 * - ADR-005: Enhanced Python Type System and Magic Methods
 *
 * External Dependencies:
 * - Tree-sitter: https://tree-sitter.github.io/tree-sitter/ - AST parsing and traversal
 * - web-tree-sitter: https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web - Web bindings
 *
 * @task_id TASK-003B
 * @adr_ref ADR-005
 * @coding_standard Adheres to: doc/CODING_STANDARD.md
 * @history
 * - 2024-01-15: Created by Dev-Agent - TASK-003B: Advanced Python analyzer with 4-layer architecture
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type {
  EntityRelationship,
  ImportDependency,
  MagicType,
  ParsedEntity,
  PatternAnalysis,
  PythonAnalysisConfig,
  PythonClassInfo,
  PythonMethodInfo,
  PythonParserMetrics,
  TreeSitterNode,
} from "../types/parser.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================

// Magic method mappings for Layer 2 - derived from MagicType type
const MAGIC_METHOD_TYPES: Record<string, MagicType> = {
  __init__: "init",
  __new__: "new",
  __del__: "del",
  __str__: "str",
  __repr__: "repr",
  __format__: "format",
  __bytes__: "bytes",
  __hash__: "hash",
  __bool__: "bool",
  __call__: "call",
  __len__: "len",
  __getitem__: "getitem",
  __setitem__: "setitem",
  __delitem__: "delitem",
  __contains__: "contains",
  __iter__: "iter",
  __next__: "next",
  __reversed__: "reversed",
  __enter__: "enter",
  __exit__: "exit",
  __aenter__: "aenter",
  __aexit__: "aexit",
  __eq__: "eq",
  __ne__: "ne",
  __lt__: "lt",
  __le__: "le",
  __gt__: "gt",
  __ge__: "ge",
  __add__: "add",
  __sub__: "sub",
  __mul__: "mul",
  __truediv__: "truediv",
  __floordiv__: "floordiv",
  __mod__: "mod",
  __pow__: "pow",
  __and__: "and",
  __or__: "or",
  __xor__: "xor",
  __lshift__: "lshift",
  __rshift__: "rshift",
  __invert__: "invert",
};

// Built-in decorators for Layer 1
const BUILTIN_DECORATORS = [
  "property",
  "staticmethod",
  "classmethod",
  "abstractmethod",
  "dataclass",
  "lru_cache",
  "singledispatch",
  "contextmanager",
  "asynccontextmanager",
  "wraps",
];

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================

interface AnalysisContext {
  filePath: string;
  source: string;
  entities: ParsedEntity[];
  relationships: EntityRelationship[];
  imports: ImportDependency[];
  classes: Map<string, PythonClassInfo>;
  methods: Map<string, PythonMethodInfo>;
  metrics: PythonParserMetrics;
}

// =============================================================================
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================

/**
 * Convert tree-sitter position to our format
 */
function convertPosition(node: TreeSitterNode) {
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
 * Extract text content from a node
 */
function getNodeText(node: TreeSitterNode, source: string): string {
  return source.substring(node.startIndex, node.endIndex);
}

/**
 * Check if a string is a magic method name
 */
function isMagicMethod(name: string): boolean {
  return name.startsWith("__") && name.endsWith("__") && name in MAGIC_METHOD_TYPES;
}

/**
 * Check if a decorator is built-in
 */
function isBuiltinDecorator(name: string): boolean {
  return BUILTIN_DECORATORS.includes(name);
}

/**
 * Performance monitoring wrapper
 */
function withPerformanceMonitoring<T>(operation: string, fn: () => T, metrics: PythonParserMetrics): T {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

  try {
    const result = fn();
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    // Update metrics based on operation
    const executionTime = endTime - startTime;
    const memoryDelta = endMemory - startMemory;

    metrics.overall.totalTimeMs += executionTime;
    if (memoryDelta > 0) {
      metrics.overall.memoryUsedMB = Math.max(metrics.overall.memoryUsedMB, endMemory);
    }

    return result;
  } catch (error) {
    console.error(`Performance monitoring error in ${operation}:`, error);
    throw error;
  }
}

// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================

/**
 * Advanced Python Code Analyzer implementing 4-layer architecture
 */
export class PythonAnalyzer {
  private config: PythonAnalysisConfig;
  private static dependencyCache: Map<string, Set<string>> = new Map();

  constructor(config: Partial<PythonAnalysisConfig> = {}) {
    this.config = {
      enhancedBasicParsing: true,
      advancedFeatureAnalysis: true,
      relationshipMapping: true,
      patternRecognition: true,
      extractAllMagicMethods: true,
      analyzePropertyDecorators: true,
      buildInheritanceHierarchies: true,
      detectCircularDependencies: true,
      patternConfidenceThreshold: 0.7,
      ...config,
    };
  }

  /**
   * Main analysis entry point - analyzes Python AST with all 4 layers
   */
  async analyzePythonCode(
    filePath: string,
    rootNode: TreeSitterNode,
    source: string,
  ): Promise<{
    entities: ParsedEntity[];
    relationships: EntityRelationship[];
    patterns: PatternAnalysis;
    metrics: PythonParserMetrics;
  }> {
    console.log(`[PythonAnalyzer] Starting analysis of ${filePath}`);
    const analysisStartTime = Date.now();

    // Initialize analysis context
    const context: AnalysisContext = {
      filePath,
      source,
      entities: [],
      relationships: [],
      imports: [],
      classes: new Map(),
      methods: new Map(),
      metrics: this.initializeMetrics(),
    };

    try {
      // Layer 1: Enhanced Basic Parsing
      if (this.config.enhancedBasicParsing) {
        await this.executeLayer1Analysis(rootNode, context);
      }

      // Layer 2: Advanced Feature Analysis
      if (this.config.advancedFeatureAnalysis) {
        await this.executeLayer2Analysis(rootNode, context);
      }

      // Layer 3: Relationship Mapping
      if (this.config.relationshipMapping) {
        await this.executeLayer3Analysis(rootNode, context);
      }

      // Layer 4: Pattern Recognition
      let patterns: PatternAnalysis = {
        contextManagers: [],
        exceptionHandling: [],
        designPatterns: [],
        pythonIdioms: [],
        circularDependencies: [],
      };

      if (this.config.patternRecognition) {
        patterns = await this.executeLayer4Analysis(rootNode, context);
      }

      // Update overall metrics
      const totalTime = Date.now() - analysisStartTime;
      context.metrics.overall.totalTimeMs = totalTime;
      context.metrics.overall.totalEntities = context.entities.length;
      context.metrics.overall.totalRelationships = context.relationships.length;
      context.metrics.overall.totalPatterns =
        patterns.contextManagers.length +
        patterns.exceptionHandling.length +
        patterns.designPatterns.length +
        patterns.pythonIdioms.length;

      console.log(`[PythonAnalyzer] Analysis complete in ${totalTime}ms - ${context.entities.length} entities`);

      return {
        entities: context.entities,
        relationships: context.relationships,
        patterns,
        metrics: context.metrics,
      };
    } catch (error) {
      console.error(`[PythonAnalyzer] Analysis failed for ${filePath}:`, error);
      throw error;
    }
  }

  // =============================================================================
  // LAYER 1: ENHANCED BASIC PARSING
  // =============================================================================

  /**
   * Layer 1: Enhanced basic parsing with improved method classification,
   * complex type hints, and advanced decorator chaining
   */
  private async executeLayer1Analysis(rootNode: TreeSitterNode, context: AnalysisContext): Promise<void> {
    console.log("[PythonAnalyzer] Executing Layer 1: Enhanced Basic Parsing");
    const layer1StartTime = Date.now();

    await withPerformanceMonitoring(
      "Layer1Analysis",
      () => {
        this.traverseNodeForLayer1(rootNode, context);
      },
      context.metrics,
    );

    context.metrics.basicParsing.parseTimeMs = Date.now() - layer1StartTime;
    console.log(
      `[PythonAnalyzer] Layer 1 complete: ${context.metrics.basicParsing.methodsClassified} methods classified`,
    );
  }

  /**
   * Traverse nodes for Layer 1 analysis
   */
  private traverseNodeForLayer1(node: TreeSitterNode, context: AnalysisContext): void {
    switch (node.type) {
      case "function_definition":
      case "async_function_definition":
        this.analyzeEnhancedFunction(node, context);
        break;

      case "class_definition":
        this.analyzeEnhancedClass(node, context);
        break;

      case "import_statement":
      case "import_from_statement":
        this.analyzeEnhancedImport(node, context);
        break;

      case "lambda":
        this.analyzeEnhancedLambda(node, context);
        break;

      case "decorated_definition":
        this.analyzeDecoratedDefinition(node, context);
        break;
    }

    // Recursively process children
    for (const child of node.namedChildren) {
      this.traverseNodeForLayer1(child, context);
    }
  }

  /**
   * Analyze enhanced function with improved method classification
   */
  private analyzeEnhancedFunction(node: TreeSitterNode, context: AnalysisContext): void {
    const nameNode = node.namedChildren.find((child) => child.type === "identifier");
    if (!nameNode) return;

    const name = nameNode.text;
    const isAsync = node.type === "async_function_definition";

    // Extract decorators with chaining analysis
    const decorators = this.extractDecoratorsWithChaining(node, context);

    // Classify method type
    const methodType = this.classifyMethodType(node, decorators, context);

    // Extract complex type hints
    const parameters = this.extractComplexParameters(node, context);
    const returnType = this.extractComplexReturnType(node, context);

    // Determine entity type based on classification
    let entityType: ParsedEntity["type"] = "function";
    if (isAsync) entityType = "async_function";
    if (isMagicMethod(name)) entityType = "magic_method";
    if (methodType === "static") entityType = "static_method";
    if (methodType === "class") entityType = "class_method";
    if (methodType === "property") entityType = "property";

    const entity: ParsedEntity = {
      name,
      type: entityType,
      location: convertPosition(node),
      methodType,
      decorators: decorators.map((d) => ({
        name: d.name,
        arguments: d.arguments,
        isBuiltin: isBuiltinDecorator(d.name),
      })),
      asyncInfo: {
        isAsync,
        isGenerator: this.hasYieldExpression(node),
        isAsyncGenerator: isAsync && this.hasYieldExpression(node),
      },
      parameters,
      returnType,
      modifiers: this.extractEnhancedModifiers(node, decorators),
    };

    context.entities.push(entity);
    context.metrics.basicParsing.methodsClassified++;

    // Store method info for cross-layer analysis
    const methodInfo: PythonMethodInfo = {
      classification: methodType,
      isAsync,
      isGenerator: entity.asyncInfo?.isGenerator || false,
      decorators: decorators.map((d) => ({ ...d, line: node.startPosition.row + 1 })),
      magicType: isMagicMethod(name) ? MAGIC_METHOD_TYPES[name as keyof typeof MAGIC_METHOD_TYPES] : undefined,
      location: convertPosition(node),
    };
    context.methods.set(name, methodInfo);
  }

  /**
   * Analyze enhanced class with comprehensive information
   */
  private analyzeEnhancedClass(node: TreeSitterNode, context: AnalysisContext): void {
    const nameNode = node.namedChildren.find((child) => child.type === "identifier");
    if (!nameNode) return;

    const name = nameNode.text;

    // Extract base classes
    const baseClasses = this.extractBaseClasses(node);

    // Extract class decorators
    const decorators = this.extractDecoratorsWithChaining(node, context);

    // Determine class type
    const classType = this.determineClassType(decorators, node, context);

    const entity: ParsedEntity = {
      name,
      type: classType === "dataclass" ? "dataclass" : "class",
      location: convertPosition(node),
      decorators: decorators.map((d) => ({
        name: d.name,
        arguments: d.arguments,
        isBuiltin: isBuiltinDecorator(d.name),
      })),
      inheritance: {
        baseClasses,
        isAbstract: this.isAbstractClass(node),
      },
      children: [],
    };

    const classInfo: PythonClassInfo = {
      classType,
      baseClasses,
      mro: [name, ...baseClasses],
      abstractMethods: [],
      magicMethods: [],
      properties: [],
      classDecorators: decorators.map((d) => ({ name: d.name, arguments: d.arguments })),
      decorators: decorators.map((d) => d.name),
      methods: [],
      location: convertPosition(node),
    };

    // Analyze class members
    const bodyNode = node.namedChildren.find((child) => child.type === "block");
    if (bodyNode) {
      for (const child of bodyNode.namedChildren) {
        let fnNode: TreeSitterNode | null = null;

        if (child.type === "function_definition" || child.type === "async_function_definition") {
          fnNode = child;
        } else if (child.type === "decorated_definition") {
          const def = child.namedChildren[child.namedChildren.length - 1];
          if (def && (def.type === "function_definition" || def.type === "async_function_definition")) {
            fnNode = def;
          }
        }

        if (fnNode) {
          const id = fnNode.namedChildren.find((c) => c.type === "identifier");
          if (id) {
            classInfo.methods.push(id.text);
            if (isMagicMethod(id.text)) {
              classInfo.magicMethods.push(id.text);
            }
          }
        }
      }
    }

    context.classes.set(name, classInfo);
    context.entities.push(entity);
  }

  /**
   * Extract decorators with chaining analysis
   */
  private extractDecoratorsWithChaining(
    node: TreeSitterNode,
    context: AnalysisContext,
  ): Array<{ name: string; arguments?: string[] }> {
    const decorators: Array<{ name: string; arguments?: string[] }> = [];

    // Look for decorated_definition parent
    let current = node.parent;
    while (current && current.type === "decorated_definition") {
      const decoratorNodes = current.children.filter((child) => child.type === "decorator");

      for (const decoratorNode of decoratorNodes) {
        const nameNode = decoratorNode.namedChildren.find(
          (child) => child.type === "identifier" || child.type === "attribute",
        );

        if (nameNode) {
          const decorator = {
            name: nameNode.text,
            arguments: this.extractDecoratorArguments(decoratorNode, context),
          };
          decorators.unshift(decorator); // Add to front to maintain order
          context.metrics.basicParsing.decoratorsExtracted++;
        }
      }
      current = current.parent;
    }

    return decorators;
  }

  /**
   * Extract complex function parameters with type hints
   */
  private extractComplexParameters(node: TreeSitterNode, context: AnalysisContext): ParsedEntity["parameters"] {
    const params: NonNullable<ParsedEntity["parameters"]> = [];
    const parametersNode = node.namedChildren.find((child) => child.type === "parameters");

    if (!parametersNode) return params;

    for (const param of parametersNode.namedChildren) {
      let name: string | undefined;
      let type: string | undefined;
      let optional = false;
      let defaultValue: string | undefined;

      switch (param.type) {
        case "identifier":
          name = param.text;
          break;

        case "default_parameter": {
          const nameChild = param.namedChildren[0];
          const valueChild = param.namedChildren[1];
          if (nameChild) name = nameChild.text;
          if (valueChild) defaultValue = getNodeText(valueChild, context.source);
          optional = true;
          break;
        }

        case "typed_parameter": {
          const typedName = param.namedChildren[0];
          const typeAnnotation = param.namedChildren[1];
          if (typedName) name = typedName.text;
          if (typeAnnotation) type = this.extractComplexTypeHint(typeAnnotation, context);
          break;
        }

        case "typed_default_parameter": {
          const tdName = param.namedChildren[0];
          const tdType = param.namedChildren[1];
          const tdValue = param.namedChildren[2];
          if (tdName) name = tdName.text;
          if (tdType) type = this.extractComplexTypeHint(tdType, context);
          if (tdValue) defaultValue = getNodeText(tdValue, context.source);
          optional = true;
          break;
        }
      }

      if (name) {
        params.push({ name, type, optional, defaultValue });
        context.metrics.basicParsing.typeHintsProcessed++;
      }
    }

    return params;
  }

  /**
   * Extract complex type hints including Union, Optional, Generic, etc.
   */
  private extractComplexTypeHint(node: TreeSitterNode, context: AnalysisContext): string {
    // Handle various type hint patterns
    switch (node.type) {
      case "identifier":
        return node.text;

      case "generic_type":
      case "subscript":
        // Handle List[int], Dict[str, Any], Union[str, int], etc.
        return getNodeText(node, context.source);

      case "union_type":
        // Handle X | Y union syntax (Python 3.10+)
        return getNodeText(node, context.source);

      case "attribute":
        // Handle module.Type patterns
        return node.text;

      default:
        return getNodeText(node, context.source);
    }
  }

  /**
   * Classify method type (instance, class, static, property, abstract, magic)
   */
  private classifyMethodType(
    node: TreeSitterNode,
    decorators: Array<{ name: string; arguments?: string[] }>,
    _context: AnalysisContext,
  ): PythonMethodInfo["classification"] {
    const functionName = node.namedChildren.find((child) => child.type === "identifier")?.text || "";

    // Check decorators first
    for (const decorator of decorators) {
      if (decorator.name === "staticmethod") return "static";
      if (decorator.name === "classmethod") return "class";
      if (decorator.name === "property") return "property";
      if (decorator.name === "abstractmethod") return "abstract";
    }

    // Check if magic method
    if (isMagicMethod(functionName)) return "magic";

    // Default to instance method
    return "instance";
  }

  // ... Additional Layer 1 helper methods would continue here

  // =============================================================================
  // LAYER 2: ADVANCED FEATURE ANALYSIS
  // =============================================================================

  /**
   * Layer 2: Advanced feature analysis including magic methods, properties,
   * async patterns, generators, and dataclasses
   */
  private async executeLayer2Analysis(rootNode: TreeSitterNode, context: AnalysisContext): Promise<void> {
    console.log("[PythonAnalyzer] Executing Layer 2: Advanced Feature Analysis");
    const layer2StartTime = Date.now();

    await withPerformanceMonitoring(
      "Layer2Analysis",
      () => {
        // Analyze magic methods
        this.analyzeMagicMethods(context);

        // Analyze property decorators
        this.analyzePropertyDecorators(context);

        // Analyze async patterns
        this.analyzeAsyncPatterns(rootNode, context);

        // Analyze generator patterns
        this.analyzeGeneratorPatterns(rootNode, context);

        // Analyze dataclasses and special classes
        this.analyzeDataclassesAndSpecialClasses(context);
      },
      context.metrics,
    );

    context.metrics.advancedFeatures.analysisTimeMs = Date.now() - layer2StartTime;
    console.log(
      `[PythonAnalyzer] Layer 2 complete: ${context.metrics.advancedFeatures.magicMethodsFound} magic methods found`,
    );
  }

  // ... Layer 2 implementation methods would continue here

  // =============================================================================
  // LAYER 3: RELATIONSHIP MAPPING
  // =============================================================================

  /**
   * Layer 3: Relationship mapping including inheritance hierarchies,
   * method overrides, import dependencies, and cross-file references
   */
  private async executeLayer3Analysis(rootNode: TreeSitterNode, context: AnalysisContext): Promise<void> {
    console.log("[PythonAnalyzer] Executing Layer 3: Relationship Mapping");
    const layer3StartTime = Date.now();

    await withPerformanceMonitoring(
      "Layer3Analysis",
      () => {
        this.analyzeInheritanceHierarchy(context);
        this.analyzeMethodOverrides(context);
        this.analyzeImportDependencies(rootNode, context);
        this.createCrossReferences(context);
        this.analyzeMethodResolutionOrder(context);
      },
      context.metrics,
    );
    context.metrics.relationshipMapping.timeMs = Date.now() - layer3StartTime;
    console.log(`[PythonAnalyzer] Layer 3 completed in ${context.metrics.relationshipMapping.timeMs}ms`);
  }

  // =============================================================================
  // LAYER 4: PATTERN RECOGNITION
  // =============================================================================

  /**
   * Layer 4: Pattern recognition including context managers,
   * exception handling, design patterns, and Python idioms
   */
  private async executeLayer4Analysis(rootNode: TreeSitterNode, context: AnalysisContext): Promise<PatternAnalysis> {
    console.log("[PythonAnalyzer] Executing Layer 4: Pattern Recognition");
    const layer4StartTime = Date.now();

    const patterns: PatternAnalysis = {
      contextManagers: [],
      exceptionHandling: [],
      designPatterns: [],
      pythonIdioms: [],
      circularDependencies: [],
    };

    await withPerformanceMonitoring(
      "Layer4Analysis",
      () => {
        patterns.contextManagers = this.analyzeContextManagers(rootNode);
        patterns.exceptionHandling = this.analyzeExceptionHandling(rootNode);
        patterns.designPatterns = this.detectDesignPatterns(context);
        patterns.pythonIdioms = this.identifyPythonIdioms(rootNode);
        patterns.circularDependencies = this.detectCircularDependencies(context);
      },
      context.metrics,
    );
    context.metrics.patternRecognition.timeMs = Date.now() - layer4StartTime;
    context.metrics.patternRecognition.totalPatternsFound =
      patterns.contextManagers.length +
      patterns.exceptionHandling.length +
      patterns.designPatterns.length +
      patterns.pythonIdioms.length +
      patterns.circularDependencies.length;

    console.log(`[PythonAnalyzer] Layer 4 completed in ${context.metrics.patternRecognition.timeMs}ms`);
    return patterns;
  }

  // =============================================================================
  // HELPER METHODS AND UTILITIES
  // =============================================================================

  private initializeMetrics(): PythonParserMetrics {
    return {
      basicParsing: {
        methodsClassified: 0,
        typeHintsProcessed: 0,
        decoratorsExtracted: 0,
        parseTimeMs: 0,
      },
      advancedFeatures: {
        magicMethodsFound: 0,
        propertiesAnalyzed: 0,
        asyncPatternsDetected: 0,
        generatorsFound: 0,
        dataclassesProcessed: 0,
        analysisTimeMs: 0,
      },
      relationshipMapping: {
        inheritanceHierarchiesBuilt: 0,
        methodOverridesDetected: 0,
        crossFileReferencesResolved: 0,
        circularDependenciesFound: 0,
        mappingTimeMs: 0,
      },
      patternRecognition: {
        contextManagersDetected: 0,
        exceptionPatternsFound: 0,
        designPatternsIdentified: 0,
        pythonIdiomsDetected: 0,
        recognitionTimeMs: 0,
      },
      overall: {
        totalEntities: 0,
        totalRelationships: 0,
        totalPatterns: 0,
        totalTimeMs: 0,
        memoryUsedMB: 0,
      },
    };
  }

  // ... Additional helper methods would be implemented here

  /**
   * Extract decorator arguments from decorator node
   */
  private extractDecoratorArguments(node: TreeSitterNode, context: AnalysisContext): string[] {
    const args: string[] = [];

    // Look for argument_list child
    const argumentList = node.namedChildren.find((child) => child.type === "argument_list");
    if (!argumentList) return args;

    for (const arg of argumentList.namedChildren) {
      if (arg.type !== ",") {
        args.push(getNodeText(arg, context.source).trim());
      }
    }

    return args;
  }

  /**
   * Extract complex return type annotation
   */
  private extractComplexReturnType(node: TreeSitterNode, context: AnalysisContext): string | undefined {
    // Look for type annotation after the colon
    const typeNode = node.namedChildren.find((child) => child.type === "type");
    if (!typeNode) return undefined;

    return this.extractComplexTypeHint(typeNode, context);
  }

  /**
   * Check if function contains yield expressions (generator)
   */
  private hasYieldExpression(node: TreeSitterNode): boolean {
    // Recursively check for yield or yield_from expressions
    if (node.type === "yield" || node.type === "yield_from") {
      return true;
    }

    for (const child of node.namedChildren) {
      if (this.hasYieldExpression(child)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract enhanced modifiers from function/class
   */
  private extractEnhancedModifiers(
    node: TreeSitterNode,
    decorators: Array<{ name: string; arguments?: string[] }>,
  ): string[] {
    const modifiers: string[] = [];

    // Add async modifier
    if (node.type === "async_function_definition") {
      modifiers.push("async");
    }

    // Add modifiers based on decorators
    for (const decorator of decorators) {
      switch (decorator.name) {
        case "staticmethod":
          modifiers.push("static");
          break;
        case "classmethod":
          modifiers.push("class");
          break;
        case "abstractmethod":
          modifiers.push("abstract");
          break;
        case "property":
          modifiers.push("property");
          break;
      }
    }

    // Check for private/protected naming conventions
    const nameNode = node.namedChildren.find((child) => child.type === "identifier");
    if (nameNode) {
      const name = nameNode.text;
      if (name.startsWith("__") && !name.endsWith("__")) {
        modifiers.push("private");
      } else if (name.startsWith("_")) {
        modifiers.push("protected");
      }
    }

    return modifiers;
  }

  /**
   * Extract base classes from class definition
   */
  private extractBaseClasses(node: TreeSitterNode): string[] {
    const baseClasses: string[] = [];

    // Look for argument_list containing base classes
    const argumentList = node.namedChildren.find((child) => child.type === "argument_list");
    if (!argumentList) return baseClasses;

    for (const arg of argumentList.namedChildren) {
      if (arg.type === "identifier" || arg.type === "attribute") {
        baseClasses.push(arg.text);
      }
    }

    return baseClasses;
  }

  /**
   * Determine class type based on decorators and analysis
   */
  private determineClassType(
    decorators: Array<{ name: string; arguments?: string[] }>,
    node: TreeSitterNode,
    _context: AnalysisContext,
  ): PythonClassInfo["classType"] {
    // Check decorators
    for (const decorator of decorators) {
      if (decorator.name === "dataclass" || decorator.name === "dataclasses.dataclass") {
        return "dataclass";
      }
    }

    // Check for ABC inheritance
    const baseClasses = this.extractBaseClasses(node);
    if (baseClasses.some((base) => base === "ABC" || base.includes("ABC"))) {
      return "abstract";
    }

    // Check for Protocol
    if (baseClasses.some((base) => base === "Protocol" || base.includes("Protocol"))) {
      return "protocol";
    }

    // Check for Enum
    if (baseClasses.some((base) => base === "Enum" || base.includes("Enum"))) {
      return "enum";
    }

    // Check for NamedTuple
    if (baseClasses.some((base) => base === "NamedTuple" || base.includes("NamedTuple"))) {
      return "namedtuple";
    }

    return "regular";
  }

  /**
   * Check if class is abstract (has abstract methods)
   */
  private isAbstractClass(node: TreeSitterNode): boolean {
    // Look for methods with @abstractmethod decorator
    const bodyNode = node.namedChildren.find((child) => child.type === "block");
    if (!bodyNode) return false;

    for (const child of bodyNode.namedChildren) {
      if (child.type === "decorated_definition") {
        const decoratorNodes = child.children.filter((c) => c.type === "decorator");
        for (const decorator of decoratorNodes) {
          if (decorator.text.includes("abstractmethod")) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Analyze enhanced import statements
   */
  private analyzeEnhancedImport(node: TreeSitterNode, context: AnalysisContext): void {
    let importSource = "";
    let isRelative = false;
    const specifiers: Array<{ local: string; imported?: string; alias?: string }> = [];

    if (node.type === "import_statement") {
      // Handle: import module, import module as alias
      const dottedNameNodes = node.descendantsOfType("dotted_name");
      const identifierNodes = node.descendantsOfType("identifier");

      for (const nameNode of [...dottedNameNodes, ...identifierNodes]) {
        if (nameNode.parent?.type === "aliased_import") {
          // Handle aliased imports
          const alias = nameNode.parent.namedChildren[1]?.text;
          specifiers.push({ local: alias || nameNode.text, imported: nameNode.text });
        } else if (nameNode.parent?.type === "import_statement") {
          specifiers.push({ local: nameNode.text });
          if (!importSource) importSource = nameNode.text;
        }
      }
    } else if (node.type === "import_from_statement") {
      // Handle: from module import name, from .module import name
      const moduleNode = node.namedChildren.find(
        (child) => child.type === "dotted_name" || child.type === "relative_import",
      );

      if (moduleNode) {
        importSource = moduleNode.text;
        isRelative = moduleNode.text.startsWith(".");
      }

      // Extract imported names
      const importList = node.descendantsOfType("import_list")[0];
      if (importList) {
        for (const item of importList.namedChildren) {
          if (item.type === "identifier") {
            specifiers.push({ local: item.text, imported: item.text });
          } else if (item.type === "aliased_import") {
            const imported = item.namedChildren[0]?.text;
            const local = item.namedChildren[1]?.text;
            if (imported && local) {
              specifiers.push({ local, imported, alias: local });
            }
          }
        }
      }
    }

    const entity: ParsedEntity = {
      name: importSource || "unknown",
      type: "import",
      location: convertPosition(node),
      importData: {
        source: importSource,
        specifiers,
        isRelative,
        fromModule: node.type === "import_from_statement" ? importSource : undefined,
      },
    };

    context.entities.push(entity);
  }

  /**
   * Analyze enhanced lambda functions
   */
  private analyzeEnhancedLambda(node: TreeSitterNode, context: AnalysisContext): void {
    // Extract lambda parameters
    const parameters = this.extractLambdaParameters(node, context);

    const entity: ParsedEntity = {
      name: "<lambda>",
      type: "lambda",
      location: convertPosition(node),
      parameters,
      modifiers: ["lambda"],
      asyncInfo: {
        isAsync: false,
        isGenerator: false,
        isAsyncGenerator: false,
      },
    };

    context.entities.push(entity);
  }

  /**
   * Extract lambda parameters
   */
  private extractLambdaParameters(node: TreeSitterNode, _context: AnalysisContext): ParsedEntity["parameters"] {
    const params: NonNullable<ParsedEntity["parameters"]> = [];

    // Lambda parameters are the first children before ':'
    for (const child of node.namedChildren) {
      if (child.type === "identifier") {
        params.push({ name: child.text, optional: false });
      } else if (child.type === ":") {
        // Stop at the colon - everything after is the expression
        break;
      }
    }

    return params;
  }

  /**
   * Analyze decorated definitions
   */
  private analyzeDecoratedDefinition(node: TreeSitterNode, context: AnalysisContext): void {
    // The actual function/class is the last child
    const definition = node.namedChildren[node.namedChildren.length - 1];

    if (definition) {
      // Process the underlying definition
      this.traverseNodeForLayer1(definition, context);
    }
  }

  // =============================================================================
  // LAYER 2: ADVANCED FEATURE ANALYSIS - COMPLETE IMPLEMENTATION
  // =============================================================================

  private analyzeMagicMethods(context: AnalysisContext): void {
    for (const [name, _methodInfo] of context.methods.entries()) {
      if (isMagicMethod(name)) {
        context.metrics.advancedFeatures.magicMethodsFound++;

        // Find the corresponding entity and enhance it
        const entity = context.entities.find((e) => e.name === name);
        if (entity) {
          entity.type = "magic_method";
          entity.pythonInfo = {
            ...entity.pythonInfo,
            magicMethodType: MAGIC_METHOD_TYPES[name as keyof typeof MAGIC_METHOD_TYPES] || "other",
          };
        }
      }
    }
  }

  private analyzePropertyDecorators(context: AnalysisContext): void {
    for (const [name, methodInfo] of context.methods.entries()) {
      if (methodInfo.classification === "property") {
        context.metrics.advancedFeatures.propertiesAnalyzed++;

        const baseEntity = context.entities.find((e) => e.name === name);
        const loc = methodInfo.location || baseEntity?.location;
        if (!loc) continue;

        const setterName = `${name}_setter`;
        const getterName = `${name}_getter`;

        const propertyEntity: ParsedEntity = {
          name,
          type: "property",
          location: loc,
          pythonInfo: {
            decorators: methodInfo.decorators,
            isProperty: true,
            hasGetter: context.methods.has(getterName),
            hasSetter: context.methods.has(setterName),
          },
        };
        context.entities.push(propertyEntity);
      }
    }
  }

  private analyzeAsyncPatterns(node: TreeSitterNode, context: AnalysisContext): void {
    // Traverse all async function definitions
    const asyncNodes = this.findNodesByType(node, ["async_function_definition"]);

    for (const asyncNode of asyncNodes) {
      context.metrics.advancedFeatures.asyncPatternsDetected++;

      // Analyze await patterns within async functions
      const awaitNodes = this.findNodesByType(asyncNode, ["await"]);

      // Find corresponding entity and enhance
      const nameNode = asyncNode.namedChildren.find((c) => c.type === "identifier");
      if (nameNode) {
        const entity = context.entities.find((e) => e.name === nameNode.text);
        if (entity) {
          entity.asyncInfo = {
            isAsync: true,
            isGenerator: false,
            awaitCount: awaitNodes.length,
            asyncPatterns: this.detectAsyncPatterns(asyncNode),
          };
        }
      }
    }
  }

  private analyzeGeneratorPatterns(node: TreeSitterNode, context: AnalysisContext): void {
    // Find yield expressions to identify generators
    const yieldNodes = this.findNodesByType(node, ["yield", "yield_from_expression"]);

    for (const yieldNode of yieldNodes) {
      // Find the containing function
      let currentNode = yieldNode.parent;
      while (currentNode && !["function_definition", "async_function_definition"].includes(currentNode.type)) {
        currentNode = currentNode.parent;
      }

      if (currentNode) {
        const nameNode = currentNode.namedChildren.find((c) => c.type === "identifier");
        if (nameNode) {
          const entity = context.entities.find((e) => e.name === nameNode.text);
          if (entity) {
            entity.asyncInfo = {
              ...entity.asyncInfo,
              isGenerator: true,
              yieldCount: (entity.asyncInfo?.yieldCount || 0) + 1,
              generatorType: yieldNode.type === "yield_from_expression" ? "delegating" : "simple",
            };
            context.metrics.advancedFeatures.generatorsFound++;
          }
        }
      }
    }
  }

  private analyzeDataclassesAndSpecialClasses(context: AnalysisContext): void {
    for (const [name, classInfo] of context.classes.entries()) {
      // Check for dataclass decorator
      if (classInfo.decorators?.includes("dataclass")) {
        classInfo.classType = "dataclass";
        context.metrics.advancedFeatures.dataclassesProcessed++;

        // Update corresponding entity
        const entity = context.entities.find((e) => e.name === name && e.type === "class");
        if (entity) {
          entity.pythonInfo = {
            ...entity.pythonInfo,
            isDataclass: true,
            specialClassType: "dataclass",
          };
        }
      }

      // Check for other special class types
      if (classInfo.decorators?.includes("enum.Enum") || classInfo.baseClasses?.includes("Enum")) {
        classInfo.classType = "enum";
        const entity = context.entities.find((e) => e.name === name && e.type === "class");
        if (entity) {
          entity.pythonInfo = {
            ...entity.pythonInfo,
            specialClassType: "enum",
          };
        }
      }
    }
  }

  // =============================================================================
  // LAYER 3: RELATIONSHIP MAPPING HELPER METHODS
  // =============================================================================

  private analyzeInheritanceHierarchy(context: AnalysisContext): void {
    for (const [className, classInfo] of context.classes.entries()) {
      if (classInfo.baseClasses && classInfo.baseClasses.length > 0) {
        for (const baseClass of classInfo.baseClasses) {
          const relationship: EntityRelationship = {
            from: className,
            to: baseClass,
            type: "inherits",
            sourceFile: context.filePath,
            metadata: {
              isDirectRelation: true,
              line: classInfo.location?.start.line,
            },
          };
          context.relationships.push(relationship);
          context.metrics.relationshipMapping.inheritanceHierarchiesBuilt++;
        }
      }
    }
  }

  private analyzeMethodOverrides(context: AnalysisContext): void {
    for (const [className, classInfo] of context.classes.entries()) {
      const methods = classInfo.methods || [];
      if (!methods.length) continue;
      const bases = classInfo.baseClasses || [];

      for (const base of bases) {
        const baseInfo = context.classes.get(base);
        if (!baseInfo) continue;
        const baseMethods = baseInfo.methods || [];
        if (!baseMethods.length) continue;

        for (const m of methods) {
          if (baseMethods.includes(m)) {
            const relationship: EntityRelationship = {
              from: `${className}.${m}`,
              to: `${base}.${m}`,
              type: "overrides",
              sourceFile: context.filePath,
              metadata: { isDirectRelation: true },
            };
            context.relationships.push(relationship);
            context.metrics.relationshipMapping.methodOverridesDetected++;
            context.metrics.relationshipMapping.methodOverrides =
              (context.metrics.relationshipMapping.methodOverrides || 0) + 1;
          }
        }
      }
    }
  }

  private analyzeImportDependencies(rootNode: TreeSitterNode, context: AnalysisContext): void {
    const importNodes = this.findNodesByType(rootNode, ["import_statement", "import_from_statement"]);

    for (const importNode of importNodes) {
      if (importNode.type === "import_statement") {
        const nameNode = importNode.namedChildren.find((c) => c.type === "dotted_name");
        if (nameNode) {
          const dependency: ImportDependency = {
            sourceFile: context.filePath,
            targetModule: nameNode.text,
            importType: "absolute",
            symbols: [{ name: nameNode.text }],
            line: importNode.startPosition.row + 1,
            isUsed: false,
            usageLocations: [],
          };
          context.imports.push(dependency);

          if (!context.metrics.relationshipMapping.importDependencies) {
            context.metrics.relationshipMapping.importDependencies = 0;
          }
          context.metrics.relationshipMapping.importDependencies++;
        }
      } else if (importNode.type === "import_from_statement") {
        const moduleNode = importNode.namedChildren.find((c) => c.type === "dotted_name");
        const importList = importNode.namedChildren.find((c) => c.type === "import_list");

        if (moduleNode && importList) {
          for (const importItem of importList.namedChildren) {
            if (importItem.type === "," || !importItem.text) continue;

            const dependency: ImportDependency = {
              sourceFile: context.filePath,
              targetModule: moduleNode.text,
              importType: moduleNode.text.startsWith(".") ? "relative" : "absolute",
              symbols: [{ name: importItem.text }],
              line: importNode.startPosition.row + 1,
              isUsed: false,
              usageLocations: [],
            };
            context.imports.push(dependency);

            if (!context.metrics.relationshipMapping.importDependencies) {
              context.metrics.relationshipMapping.importDependencies = 0;
            }
            context.metrics.relationshipMapping.importDependencies++;
          }
        }
      }
    }
  }

  private createCrossReferences(context: AnalysisContext): void {
    // Create cross-references between entities
    for (const entity of context.entities) {
      if (entity.references) {
        for (const ref of entity.references) {
          const relationship: EntityRelationship = {
            from: entity.name,
            to: ref,
            type: "references",
            sourceFile: context.filePath,
            metadata: {
              line: entity.location?.start?.line,
              isDirectRelation: true,
            },
          };
          context.relationships.push(relationship);

          if (!context.metrics.relationshipMapping.crossReferences) {
            context.metrics.relationshipMapping.crossReferences = 0;
          }
          context.metrics.relationshipMapping.crossReferences++;
        }
      }
    }
  }

  private analyzeMethodResolutionOrder(context: AnalysisContext): void {
    for (const [className, classInfo] of context.classes.entries()) {
      if (classInfo.baseClasses && classInfo.baseClasses.length > 0) {
        const mro = this.calculateMRO(className, context.classes);
        classInfo.mro = mro;
        classInfo.methodResolutionOrder = mro;
        context.metrics.relationshipMapping.mroCalculations =
          (context.metrics.relationshipMapping.mroCalculations || 0) + 1;
      }
    }
  }

  private calculateMRO(className: string, classes: Map<string, PythonClassInfo>): string[] {
    // Simplified MRO calculation - in production, would implement full C3 linearization
    const mro = [className];
    const classInfo = classes.get(className);

    if (classInfo?.baseClasses) {
      for (const baseClass of classInfo.baseClasses) {
        if (!mro.includes(baseClass)) {
          mro.push(baseClass);
        }
      }
    }
    return mro;
  }

  // =============================================================================
  // LAYER 4: PATTERN RECOGNITION HELPER METHODS
  // =============================================================================

  private analyzeContextManagers(rootNode: TreeSitterNode): any[] {
    const withNodes = this.findNodesByType(rootNode, ["with_statement"]);
    const contextManagers = [];

    for (const withNode of withNodes) {
      const contextManager = {
        type: "context_manager",
        location: this.convertNodeToLocation(withNode),
        expression: withNode.text.substring(0, 100), // First 100 chars
        isAsync: withNode.text.includes("async with"),
      };
      contextManagers.push(contextManager);
    }

    return contextManagers;
  }

  private analyzeExceptionHandling(rootNode: TreeSitterNode): any[] {
    const tryNodes = this.findNodesByType(rootNode, ["try_statement"]);
    const exceptionHandling = [];

    for (const tryNode of tryNodes) {
      const exceptNodes = this.findNodesByType(tryNode, ["except_clause"]);
      const finallyNodes = this.findNodesByType(tryNode, ["finally_clause"]);
      const elseNodes = this.findNodesByType(tryNode, ["else_clause"]);

      const pattern = {
        type: "exception_handling",
        location: this.convertNodeToLocation(tryNode),
        hasExcept: exceptNodes.length > 0,
        hasFinally: finallyNodes.length > 0,
        hasElse: elseNodes.length > 0,
        exceptCount: exceptNodes.length,
      };
      exceptionHandling.push(pattern);
    }

    return exceptionHandling;
  }

  private detectDesignPatterns(context: AnalysisContext): any[] {
    const patterns = [];

    // Detect Singleton pattern
    for (const [className, classInfo] of context.classes.entries()) {
      if (this.isSingletonPattern(classInfo)) {
        patterns.push({
          type: "singleton",
          className,
          confidence: 0.8,
        });
      }

      // Detect Factory pattern
      if (this.isFactoryPattern(classInfo)) {
        patterns.push({
          type: "factory",
          className,
          confidence: 0.7,
        });
      }
    }

    return patterns;
  }

  private identifyPythonIdioms(rootNode: TreeSitterNode): any[] {
    const idioms = [];

    // Check for list comprehensions
    const listCompNodes = this.findNodesByType(rootNode, ["list_comprehension"]);
    for (const node of listCompNodes) {
      idioms.push({
        type: "list_comprehension",
        location: this.convertNodeToLocation(node),
      });
    }

    // Check for dict comprehensions
    const dictCompNodes = this.findNodesByType(rootNode, ["dictionary_comprehension"]);
    for (const node of dictCompNodes) {
      idioms.push({
        type: "dict_comprehension",
        location: this.convertNodeToLocation(node),
      });
    }

    return idioms;
  }

  private detectCircularDependencies(context: AnalysisContext): any[] {
    const dependencyGraph = this.buildDependencyGraph(context);
    const cycles = this.findAllCycles(dependencyGraph);

    return cycles.map((cycle) => ({
      cycle: cycle.path,
      type: this.determineCycleType(cycle, context),
      severity: this.calculateCycleSeverity(cycle),
      description: this.generateCycleDescription(cycle),
      suggestedFix: this.suggestCycleFix(cycle),
    }));
  }

  private buildDependencyGraph(context: AnalysisContext): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    const currentFile = this.normalizeFilePath(context.filePath);
    if (!graph.has(currentFile)) {
      graph.set(currentFile, new Set());
    }

    for (const imp of context.imports) {
      const from = currentFile;
      const to = this.resolveImportPath(imp.targetModule, context.filePath);

      if (!to) continue;

      if (!graph.has(from)) {
        graph.set(from, new Set());
      }
      graph.get(from)?.add(to);

      if (!graph.has(to)) {
        graph.set(to, new Set());
      }
    }

    this.addCachedDependencies(graph, currentFile);

    return graph;
  }

  private findAllCycles(graph: Map<string, Set<string>>): Array<{
    path: string[];
    edges: Array<{ from: string; to: string }>;
  }> {
    const cycles: Array<{ path: string[]; edges: Array<{ from: string; to: string }> }> = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        this.dfsDetectCycles(node, graph, visited, recursionStack, currentPath, cycles);
      }
    }

    return this.deduplicateCycles(cycles);
  }

  private dfsDetectCycles(
    node: string,
    graph: Map<string, Set<string>>,
    visited: Set<string>,
    recursionStack: Set<string>,
    currentPath: string[],
    cycles: Array<{ path: string[]; edges: Array<{ from: string; to: string }> }>,
  ): void {
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);

    const neighbors = graph.get(node) || new Set();

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this.dfsDetectCycles(neighbor, graph, visited, recursionStack, currentPath, cycles);
      } else if (recursionStack.has(neighbor)) {
        const cycleStartIndex = currentPath.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          const cyclePath = currentPath.slice(cycleStartIndex);
          cyclePath.push(neighbor);

          const edges: Array<{ from: string; to: string }> = [];
          for (let i = 0; i < cyclePath.length - 1; i++) {
            const from = cyclePath[i];
            const to = cyclePath[i + 1];
            if (from && to) {
              edges.push({ from, to });
            }
          }

          cycles.push({ path: cyclePath, edges });
        }
      }
    }

    // Backtrack
    currentPath.pop();
    recursionStack.delete(node);
  }

  private determineCycleType(
    cycle: { path: string[]; edges: Array<{ from: string; to: string }> },
    context: AnalysisContext,
  ): "import" | "inheritance" | "reference" {
    let hasImport = false;
    let hasInheritance = false;

    for (const edge of cycle.edges) {
      if (context.imports.some((imp) => this.resolveImportPath(imp.targetModule, context.filePath) === edge.to)) {
        hasImport = true;
      }

      for (const [_className, classInfo] of context.classes.entries()) {
        if (classInfo.baseClasses?.some((base) => this.resolveClassPath(base, edge.from) === edge.to)) {
          hasInheritance = true;
        }
      }

      // Check for reference relationships matching this edge
      if (
        context.relationships.some(
          (rel) => rel.type === "references" && rel.sourceFile === edge.from && rel.targetFile === edge.to,
        )
      ) {
        // we treat references as a fallback; no variable needed here
        hasImport = hasImport || false; // no-op to keep logic explicit
      }
    }

    if (hasInheritance) return "inheritance";
    if (hasImport) return "import";
    return "reference";
  }

  private calculateCycleSeverity(cycle: {
    path: string[];
    edges: Array<{ from: string; to: string }>;
  }): "warning" | "error" {
    // Severity criteria:
    // 1. Cycle length (short cycles are worse)
    // 2. File type (cycles in core modules are worse)
    // 3. Number of affected modules

    const cycleLength = cycle.path.length - 1;
    if (cycleLength <= 3) {
      return "error";
    }

    const hasCoreModule = cycle.path.some(
      (path) => path.includes("/core/") || path.includes("/base/") || path.includes("__init__"),
    );

    if (hasCoreModule) {
      return "error";
    }
    return "warning";
  }

  private generateCycleDescription(cycle: { path: string[]; edges: Array<{ from: string; to: string }> }): string {
    const cycleLength = cycle.path.length - 1;
    const fileNames = cycle.path.slice(0, -1).map((p) => this.getFileName(p));

    if (cycleLength === 2) {
      return `Mutual dependency between ${fileNames[0]} and ${fileNames[1]}`;
    } else if (cycleLength === 3) {
      return `Triangular dependency: ${fileNames.join(" → ")} → ${fileNames[0]}`;
    } else {
      return `Circular dependency chain of ${cycleLength} files: ${fileNames.slice(0, 3).join(" → ")}...`;
    }
  }

  private suggestCycleFix(cycle: { path: string[]; edges: Array<{ from: string; to: string }> }): string {
    const suggestions: string[] = [];

    const cycleLength = cycle.path.length - 1;

    if (cycleLength === 2) {
      suggestions.push("Consider extracting shared code to a separate module");
      suggestions.push("Use dependency injection or interfaces to break the direct dependency");
    } else {
      const weakLink = this.findWeakLink(cycle);
      if (weakLink) {
        suggestions.push(`Consider refactoring ${this.getFileName(weakLink)} to remove its dependencies`);
      }

      suggestions.push("Apply the Dependency Inversion Principle");
      suggestions.push("Consider using event-driven architecture or mediator pattern");
    }

    return suggestions.join("; ");
  }

  private normalizeFilePath(path: string): string {
    return path.replace(/\.py$/, "").replace(/\\/g, "/");
  }

  private resolveImportPath(importModule: string, fromFile: string): string | undefined {
    if (!importModule) return undefined;

    const toPosix = (p: string) => p.replace(/\\/g, "/");
    const norm = (p: string) =>
      toPosix(p)
        .replace(/\/+/g, "/")
        .replace(/^\/+|\/+$/g, "");

    const fromModuleId = this.normalizeFilePath(fromFile);
    const fromDir = fromModuleId.includes("/") ? fromModuleId.slice(0, fromModuleId.lastIndexOf("/")) : "";

    const rel = /^\.+/.exec(importModule);
    if (rel) {
      const dots = rel[0].length;

      let base = fromDir;
      for (let i = 1; i < dots; i++) {
        base = base.includes("/") ? base.slice(0, base.lastIndexOf("/")) : "";
      }

      const remainder = importModule.slice(dots).replace(/\./g, "/");
      let combined = remainder ? [base, remainder].filter(Boolean).join("/") : base;

      if (!combined) {
        combined = fromModuleId.split("/")[0] || "";
      }

      return norm(combined);
    }

    return norm(importModule.replace(/\./g, "/"));
  }

  private resolveClassPath(className: string, fromFile: string): string {
    const name = (className || "").trim();
    if (name.includes(".")) {
      const parts = name.split(".");
      parts.pop();
      const modulePart = parts.join(".");
      if (modulePart) {
        return modulePart.replace(/\./g, "/");
      }
    }
    return this.normalizeFilePath(fromFile);
  }

  private getFileName(path: string): string {
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
  }

  private deduplicateCycles(
    cycles: Array<{ path: string[]; edges: Array<{ from: string; to: string }> }>,
  ): Array<{ path: string[]; edges: Array<{ from: string; to: string }> }> {
    const uniqueCycles = new Map<string, { path: string[]; edges: Array<{ from: string; to: string }> }>();

    for (const cycle of cycles) {
      const nodes = cycle.path.slice(0, -1).sort();
      const key = nodes.join("|");

      if (!uniqueCycles.has(key)) {
        uniqueCycles.set(key, cycle);
      }
    }

    return Array.from(uniqueCycles.values());
  }

  private findWeakLink(cycle: { path: string[]; edges: Array<{ from: string; to: string }> }): string | undefined {
    const edgeCount = new Map<string, number>();

    for (const edge of cycle.edges) {
      edgeCount.set(edge.from, (edgeCount.get(edge.from) || 0) + 1);
    }

    let minEdges = Infinity;
    let weakLink: string | undefined;

    for (const [node, count] of edgeCount.entries()) {
      if (count < minEdges) {
        minEdges = count;
        weakLink = node;
      }
    }

    return weakLink;
  }

  private addCachedDependencies(graph: Map<string, Set<string>>, currentFile: string): void {
    for (const [node, targets] of PythonAnalyzer.dependencyCache.entries()) {
      if (!graph.has(node)) {
        graph.set(node, new Set());
      }
      const bucket = graph.get(node)!;
      for (const t of targets) bucket.add(t);
    }

    const currentEdges = graph.get(currentFile) || new Set<string>();
    PythonAnalyzer.dependencyCache.set(currentFile, new Set(currentEdges));
  }

  // =============================================================================
  // UTILITY HELPER METHODS
  // =============================================================================

  private findNodesByType(node: TreeSitterNode, types: string[]): TreeSitterNode[] {
    const results: TreeSitterNode[] = [];

    if (types.includes(node.type)) {
      results.push(node);
    }

    for (const child of node.namedChildren) {
      results.push(...this.findNodesByType(child, types));
    }

    return results;
  }

  private convertNodeToLocation(node: TreeSitterNode) {
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

  private detectAsyncPatterns(node: TreeSitterNode): string[] {
    const patterns = [];
    const awaitNodes = this.findNodesByType(node, ["await"]);

    if (awaitNodes.length > 0) {
      patterns.push("uses_await");
    }

    // Check for async context managers
    if (node.text.includes("async with")) {
      patterns.push("async_context_manager");
    }

    return patterns;
  }

  private isSingletonPattern(classInfo: PythonClassInfo): boolean {
    // Simple heuristic: check for private constructor and getInstance method
    return classInfo.methods.includes("__new__") && classInfo.methods.some((m) => m.includes("instance"));
  }

  private isFactoryPattern(classInfo: PythonClassInfo): boolean {
    // Simple heuristic: check for factory method patterns
    return classInfo.methods.some((m) => m.includes("create") || m.includes("make") || m.includes("build"));
  }
}

// =============================================================================
// 6. API ENDPOINTS AND ROUTES
// =============================================================================

/**
 * Factory function to create Python analyzer with configuration
 */
export function createPythonAnalyzer(config?: Partial<PythonAnalysisConfig>): PythonAnalyzer {
  return new PythonAnalyzer(config);
}

/**
 * Quick analysis function for single Python files
 */
export async function analyzePythonFile(
  filePath: string,
  rootNode: TreeSitterNode,
  source: string,
  config?: Partial<PythonAnalysisConfig>,
) {
  const analyzer = createPythonAnalyzer(config);
  return analyzer.analyzePythonCode(filePath, rootNode, source);
}

// =============================================================================
// 7. INITIALIZATION AND STARTUP
// =============================================================================

console.log("[PythonAnalyzer] Advanced Python Analyzer module loaded - TASK-003B Layer 1-4 Architecture");
