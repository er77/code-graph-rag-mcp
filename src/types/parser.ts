/**
 * TASK-003B: Enhanced Parser Agent Type Definitions
 *
 * Type definitions for the tree-sitter based parser agent.
 * Provides interfaces for parsing, entity extraction, and incremental processing.
 * Enhanced for TASK-003B with advanced Python language support across 4 layers.
 *
 * Architecture References:
 * - Agent Types: src/types/agent.ts
 * - Base Agent: src/agents/base.ts
 * - Python Analyzer: src/parsers/python-analyzer.ts
 * - ADR-005: Enhanced Python Type System and Magic Methods
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type { AgentTask } from "./agent.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
export const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "tsx",
  "jsx",
  "python",
  "c",
  "cpp",
  "csharp",
  "rust",
  "go",
  "java",
  "kotlin",
  "vba",
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================

/**
 * Magic method types for Python special methods
 */
export type MagicType =
  | "init"
  | "new"
  | "del"
  | "str"
  | "repr"
  | "format"
  | "bytes"
  | "hash"
  | "bool"
  | "call"
  | "len"
  | "getitem"
  | "setitem"
  | "delitem"
  | "contains"
  | "iter"
  | "next"
  | "reversed"
  | "enter"
  | "exit"
  | "aenter"
  | "aexit"
  | "eq"
  | "ne"
  | "lt"
  | "le"
  | "gt"
  | "ge"
  | "add"
  | "sub"
  | "mul"
  | "truediv"
  | "floordiv"
  | "mod"
  | "pow"
  | "and"
  | "or"
  | "xor"
  | "lshift"
  | "rshift"
  | "invert";

/**
 * Represents a parsed entity from the source code
 */
export interface ParsedEntity {
  /** Unique identifier for the entity */
  id?: string; // Optional for backward compatibility

  /** Optional alias (some parsers might use path) */
  path?: string;
  /** Optional signature for functions/methods */
  signature?: string;
  /** Entity name (function name, class name, etc.) */
  name: string;

  type:
    | "event"
    | "function"
    | "class"
    | "method"
    | "interface"
    | "type"
    | "import"
    | "export"
    | "variable"
    | "constant"
    | "property"
    | "magic_method"
    | "async_function"
    | "generator"
    | "lambda"
    | "decorator"
    | "context_manager"
    | "dataclass"
    | "namedtuple"
    | "enum"
    | "protocol"
    | "abstract_method"
    | "class_method"
    | "static_method"
    | "module"
    | "typedef"
    | "struct"
    | "trait"
    | "macro"
    | "enum_variant"
    | "field"
    | "impl_block"
    | "union"
    | "crate";

  /** File path containing this entity */
  filePath?: string; // Optional for backward compatibility

  /** Source location */
  location: {
    start: { line: number; column: number; index: number };
    end: { line: number; column: number; index: number };
  };

  /** Detected language (optional) */
  language?: string;

  /** Child entities (e.g., methods in a class) */
  children?: ParsedEntity[];

  /** References to other entities */
  references?: string[];

  /** Modifiers (e.g., async, static, private) - enhanced for Python */
  modifiers?: string[];

  /** Python-specific method classification */
  methodType?: "instance" | "class" | "static" | "property" | "abstract" | "magic";

  /** Decorator information for Python entities */
  decorators?: Array<{
    name: string;
    arguments?: string[];
    isBuiltin?: boolean;
  }>;

  /** Inheritance information for classes */
  inheritance?: {
    baseClasses: string[];
    mro?: string[]; // Method Resolution Order
    isAbstract?: boolean;
    interfaces?: string[];
  };

  /** Async/generator patterns */
  asyncInfo?: {
    isAsync?: boolean;
    isGenerator?: boolean;
    isAsyncGenerator?: boolean;
    yieldsFrom?: string[];

    awaitCount?: number;
    yieldCount?: number;
    generatorType?: "delegating" | "simple";
    asyncPatterns?: string[];
  };

  pythonInfo?: {
    magicMethodType?: MagicType | "other";
    decorators?: Array<{
      name: string;
      module?: string;
      arguments?: string[];
      line?: number;
    }>;
    isProperty?: boolean;
    hasGetter?: boolean;
    hasSetter?: boolean;
    isDataclass?: boolean;
    specialClassType?: "dataclass" | "enum" | "namedtuple" | "protocol" | "abstract";
  };

  /** Return type for functions/methods */
  returnType?: string;

  /** Parameters for functions/methods */
  parameters?: Array<{
    name: string;
    type?: string;
    optional?: boolean;
    defaultValue?: string;
  }>;

  /** Import/export specific data - enhanced for Python */
  importData?: {
    source: string;
    specifiers: Array<{ local: string; imported?: string; alias?: string }>;
    isDefault?: boolean;
    isNamespace?: boolean;
    isRelative?: boolean;
    fromModule?: string;
  };

  /** Pattern recognition data for Layer 4 */
  patterns?: {
    isContextManager?: boolean;
    exceptionHandling?: {
      hasTryExcept?: boolean;
      exceptTypes?: string[];
      hasFinally?: boolean;
    };
    designPatterns?: string[]; // e.g., ['singleton', 'observer', 'factory']
    pythonIdioms?: string[]; // e.g., ['comprehension', 'with_statement', 'duck_typing']
  };

  /** Relationship data for Layer 3 */
  relationships?: Array<{
    type: "inherits" | "implements" | "overrides" | "calls" | "imports" | "decorates" | "contains";
    target: string;
    targetFile?: string;
    metadata?: Record<string, any>;
  }>;

  /** Generic metadata for language-specific properties */
  metadata?: Record<string, any>;
}

/**
 * Result of parsing a file
 */
export interface ParseResult {
  /** File path */
  filePath: string;

  /** Language detected */
  language: SupportedLanguage;

  /** Extracted entities */
  entities: ParsedEntity[];

  /** Relationship graph for Layer 3 analysis */
  relationships?: EntityRelationship[];

  /** Pattern analysis results for Layer 4 */
  patterns?: PatternAnalysis;

  /** File content hash for caching */
  contentHash: string;

  /** Parsing timestamp */
  timestamp: number;

  /** Parse time in milliseconds */
  parseTimeMs: number;

  /** Whether this was from cache */
  fromCache?: boolean;

  /** Any parsing errors */
  errors?: Array<{
    message: string;
    location?: { line: number; column: number };
  }>;
}

/**
 * Represents a file change for incremental parsing
 */
export interface FileChange {
  /** File path */
  filePath: string;

  /** Type of change */
  changeType: "created" | "modified" | "deleted";

  /** New content (for created/modified) */
  content?: string;

  /** Previous content hash (for modified) */
  previousHash?: string;

  /** Edit information for incremental parsing */
  edits?: Array<{
    startIndex: number;
    oldEndIndex: number;
    newEndIndex: number;
    startPosition: { row: number; column: number };
    oldEndPosition: { row: number; column: number };
    newEndPosition: { row: number; column: number };
  }>;
}

/**
 * Parser task specific to the Parser Agent
 */
export interface ParserTask extends AgentTask {
  type: "parse:file" | "parse:batch" | "parse:incremental";
  payload: {
    files?: string[];
    changes?: FileChange[];
    options?: ParserOptions;
  };
}

/**
 * Options for parsing operations
 */
export interface ParserOptions {
  /** Use cache for unchanged files */
  useCache?: boolean;

  /** Extract references between entities */
  extractReferences?: boolean;

  /** Extract inheritance hierarchies (Layer 3) */
  extractInheritance?: boolean;

  /** Extract method overrides (Layer 3) */
  extractOverrides?: boolean;

  /** Detect design patterns (Layer 4) */
  detectPatterns?: boolean;

  /** Analyze async/await patterns (Layer 2) */
  analyzeAsync?: boolean;

  /** Extract magic methods (Layer 2) */
  extractMagicMethods?: boolean;

  /** Include source code snippets */
  includeSourceSnippets?: boolean;

  /** Maximum depth for nested entities */
  maxDepth?: number;

  /** Batch size for parallel processing */
  batchSize?: number;

  /** Timeout per file in milliseconds */
  timeoutMs?: number;
}

/**
 * Cache entry for parsed results
 */
export interface CacheEntry {
  /** File content hash */
  hash: string;

  /** Parsed result */
  result: ParseResult;

  /** Cache timestamp */
  cachedAt: number;

  /** Size in bytes */
  size: number;
}

/**
 * Statistics for parser performance
 */
export interface ParserStats {
  /** Total files parsed */
  filesParsed: number;

  /** Cache hits */
  cacheHits: number;

  /** Cache misses */
  cacheMisses: number;

  /** Average parse time */
  avgParseTimeMs: number;

  /** Total parse time */
  totalParseTimeMs: number;

  /** Files per second throughput */
  throughput: number;

  /** Memory used by cache */
  cacheMemoryMB: number;

  /** Errors encountered */
  errorCount: number;
}

/**
 * Tree-sitter specific types
 */
export interface TreeSitterNode {
  type: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  startIndex: number;
  endIndex: number;
  text: string;
  children: TreeSitterNode[];
  namedChildren: TreeSitterNode[];
  childCount: number;
  namedChildCount: number;
  parent: TreeSitterNode | null;
  nextSibling: TreeSitterNode | null;
  previousSibling: TreeSitterNode | null;

  child(index: number): TreeSitterNode | null;
  namedChild(index: number): TreeSitterNode | null;
  childForFieldName(fieldName: string): TreeSitterNode | null;
  firstChild: TreeSitterNode | null;
  lastChild: TreeSitterNode | null;
  firstNamedChild: TreeSitterNode | null;
  lastNamedChild: TreeSitterNode | null;
  descendantForPosition(position: { row: number; column: number }): TreeSitterNode;
  descendantsOfType(type: string): TreeSitterNode[];
}

export interface TreeSitterTree {
  rootNode: TreeSitterNode;
  edit(edit: TreeSitterEdit): void;
  walk(): TreeSitterCursor;
}

export interface TreeSitterEdit {
  startIndex: number;
  oldEndIndex: number;
  newEndIndex: number;
  startPosition: { row: number; column: number };
  oldEndPosition: { row: number; column: number };
  newEndPosition: { row: number; column: number };
}

export interface TreeSitterCursor {
  nodeType: string;
  nodeText: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  startIndex: number;
  endIndex: number;
  currentNode(): TreeSitterNode;
  gotoFirstChild(): boolean;
  gotoNextSibling(): boolean;
  gotoParent(): boolean;
}

// =============================================================================
// TASK-003B: ENHANCED PYTHON TYPE DEFINITIONS
// =============================================================================

/**
 * Entity relationship for Layer 3 relationship mapping
 */
export interface EntityRelationship {
  /** Source entity name */
  from: string;

  /** Target entity name */
  to: string;

  /** Relationship type */
  type:
    | "inherits"
    | "implements"
    | "overrides"
    | "calls"
    | "imports"
    | "decorates"
    | "contains"
    | "references"
    | "embeds"
    | "member_of";

  /** Source file path */
  sourceFile?: string;

  /** Target file path (for cross-file relationships) */
  targetFile?: string;

  /** Additional metadata */
  metadata?: {
    line?: number;
    confidence?: number;
    isDirectRelation?: boolean;
    mroPosition?: number; // For inheritance MRO
    [key: string]: any;
  };
}

/**
 * Pattern analysis results for Layer 4
 */
export interface PatternAnalysis {
  /** Context manager patterns detected */
  contextManagers: Array<{
    entity: string;
    type: "class_based" | "function_based" | "async";
    methods: string[]; // __enter__, __exit__, __aenter__, __aexit__
  }>;

  /** Exception handling patterns */
  exceptionHandling: Array<{
    location: { line: number; column: number };
    type: "try_except" | "try_finally" | "try_except_finally";
    exceptTypes: string[];
    hasElse?: boolean;
    hasFinally?: boolean;
  }>;

  /** Design patterns detected */
  designPatterns: Array<{
    pattern: "singleton" | "observer" | "factory" | "builder" | "strategy" | "decorator" | "iterator";
    entities: string[];
    confidence: number;
    description: string;
  }>;

  /** Python idioms detected */
  pythonIdioms: Array<{
    idiom: "list_comprehension" | "dict_comprehension" | "generator_expression" | "context_manager" | "duck_typing";
    locations: Array<{ line: number; column: number }>;
    usage: string;
  }>;

  /** Circular dependencies detected */
  circularDependencies: Array<{
    cycle: string[]; // List of files/modules in the cycle
    type: "import" | "inheritance" | "reference";
    severity: "warning" | "error";
  }>;

  otherPatterns?: Array<{
    kind: string;
    entities?: string[];
    confidence?: number;
    description?: string;
    locations?: Array<{ line: number; column: number }>;
    metadata?: Record<string, any>;
  }>;
}

/**
 * Python-specific analysis configuration
 */
export interface PythonAnalysisConfig {
  /** Enable Layer 1: Enhanced basic parsing */
  enhancedBasicParsing: boolean;

  /** Enable Layer 2: Advanced feature analysis */
  advancedFeatureAnalysis: boolean;

  /** Enable Layer 3: Relationship mapping */
  relationshipMapping: boolean;

  /** Enable Layer 4: Pattern recognition */
  patternRecognition: boolean;

  /** Extract all magic methods */
  extractAllMagicMethods: boolean;

  /** Analyze property decorators */
  analyzePropertyDecorators: boolean;

  /** Build inheritance hierarchies */
  buildInheritanceHierarchies: boolean;

  /** Detect circular dependencies */
  detectCircularDependencies: boolean;

  /** Pattern detection thresholds */
  patternConfidenceThreshold: number;
}

/**
 * Enhanced Python method information
 */
export interface PythonMethodInfo {
  /** Method classification */
  classification: "instance" | "class" | "static" | "property" | "abstract" | "magic";

  /** Is this method async */
  isAsync: boolean;

  /** Is this a generator method */
  isGenerator: boolean;

  /** Decorator stack */
  decorators: Array<{
    name: string;
    module?: string;
    arguments?: string[];
    line: number;
  }>;

  /** Magic method type (if applicable) */
  magicType?: MagicType;

  /** Property information (if property) */
  propertyInfo?: {
    hasGetter: boolean;
    hasSetter: boolean;
    hasDeleter: boolean;
    getterName?: string;
    setterName?: string;
    deleterName?: string;
  };

  /** Override information */
  overrideInfo?: {
    overrides: string; // Parent method being overridden
    parentClass: string;
    callsSuper: boolean;
    changeSignature: boolean;
  };

  location?: {
    start: { line: number; column: number; index: number };
    end: { line: number; column: number; index: number };
  };
}

/**
 * Enhanced Python class information
 */
export interface PythonClassInfo {
  /** Class type */
  classType: "regular" | "abstract" | "dataclass" | "namedtuple" | "enum" | "protocol";

  /** Base classes */
  baseClasses: string[];

  /** Method Resolution Order */
  mro: string[];

  /** Abstract methods that need implementation */
  abstractMethods: string[];

  /** Magic methods implemented */
  magicMethods: string[];

  /** Properties defined */
  properties: Array<{
    name: string;
    hasGetter: boolean;
    hasSetter: boolean;
    hasDeleter: boolean;
  }>;

  /** Metaclass information */
  metaclass?: string;

  /** Decorator information */
  classDecorators: Array<{
    name: string;
    arguments?: string[];
  }>;

  methods: string[];

  decorators?: string[];

  location?: {
    start: { line: number; column: number; index: number };
    end: { line: number; column: number; index: number };
  };

  methodResolutionOrder?: string[];
}

/**
 * Import dependency information for Layer 3
 */
export interface ImportDependency {
  /** Source file */
  sourceFile: string;

  /** Target module/file */
  targetModule: string;

  /** Import type */
  importType: "absolute" | "relative" | "conditional" | "dynamic";

  /** Imported symbols */
  symbols: Array<{
    name: string;
    alias?: string;
    isDefault?: boolean;
  }>;

  /** Line number of import */
  line: number;

  /** Is this import used */
  isUsed: boolean;

  /** Usage locations */
  usageLocations: Array<{ line: number; column: number; context: string }>;

  module?: string;

  imported?: string;

  alias?: string;

  isLocal?: boolean;

  metadata?: Record<string, any>;

  type?: "import" | "from_import" | "use" | "extern_crate";
}

/**
 * Performance metrics for enhanced Python parsing
 */
export interface PythonParserMetrics {
  /** Layer 1 metrics */
  basicParsing: {
    methodsClassified: number;
    typeHintsProcessed: number;
    decoratorsExtracted: number;
    parseTimeMs: number;
  };

  /** Layer 2 metrics */
  advancedFeatures: {
    magicMethodsFound: number;
    propertiesAnalyzed: number;
    asyncPatternsDetected: number;
    generatorsFound: number;
    dataclassesProcessed: number;
    analysisTimeMs: number;
  };

  /** Layer 3 metrics */
  relationshipMapping: {
    inheritanceHierarchiesBuilt: number;
    methodOverridesDetected: number;
    crossFileReferencesResolved: number;
    circularDependenciesFound: number;
    mappingTimeMs: number;

    timeMs?: number;
    inheritanceRelationships?: number;
    methodOverrides?: number;
    importDependencies?: number;
    crossReferences?: number;
    mroCalculations?: number;
  };

  /** Layer 4 metrics */
  patternRecognition: {
    contextManagersDetected: number;
    exceptionPatternsFound: number;
    designPatternsIdentified: number;
    pythonIdiomsDetected: number;
    recognitionTimeMs: number;

    timeMs?: number;
    totalPatternsFound?: number;
  };

  /** Overall metrics */
  overall: {
    totalEntities: number;
    totalRelationships: number;
    totalPatterns: number;
    totalTimeMs: number;
    memoryUsedMB: number;
  };
}
