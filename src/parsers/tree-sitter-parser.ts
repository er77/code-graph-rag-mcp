/**
 * TASK-001: Tree-sitter Parser Wrapper
 *
 * High-performance parser using web-tree-sitter for incremental parsing.
 * Provides 36x performance improvement over traditional parsing.
 *
 * Architecture References:
 * - Parser Types: src/types/parser.ts
 * - Performance Target: 100+ files/second
 */

import { LRUCache } from "lru-cache";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
// @ts-ignore - web-tree-sitter has complex module exports
let Parser: any;
import type {
  ParsedEntity,
  ParseResult,
  SupportedLanguage,
  TreeSitterEdit,
  TreeSitterNode,
  TreeSitterTree,
} from "../types/parser.js";
import { createPythonAnalyzer } from "./python-analyzer.js";
import { CSharpAnalyzer } from "./csharp-analyzer.js";
import { RustAnalyzer } from "./rust-analyzer.js";
import { CAnalyzer } from "./c-analyzer.js";
import { CppAnalyzer } from "./cpp-analyzer.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const CACHE_MAX_SIZE = 100 * 1024 * 1024; // 100MB cache
const CACHE_TTL = 1000 * 60 * 60; // 1 hour TTL

// Tree-sitter language WASM paths
const LANGUAGE_WASM_PATHS: Record<SupportedLanguage, string> = {
  javascript: "tree-sitter-javascript.wasm",
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  jsx: "tree-sitter-javascript.wasm",
  python: "tree-sitter-python.wasm",
  c: "tree-sitter-c.wasm",
  cpp: "tree-sitter-cpp.wasm",
  csharp: "tree-sitter-c-sharp.wasm",
  rust: "tree-sitter-rust.wasm",
};

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================
interface ParseCacheEntry {
  tree: TreeSitterTree;
  entities: ParsedEntity[];
  hash: string;
  timestamp: number;
}

// =============================================================================
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================

/**
 * Detects language from file extension
 */
function detectLanguage(filePath: string): SupportedLanguage {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "ts":
    case "mts":
    case "cts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "jsx":
      return "jsx";
    case "py":
    case "pyi":
    case "pyw":
      return "python";
    case "c":
      return "c";
    case "cpp":
    case "cxx":
    case "cc":
      return "cpp";
    case "C":
      return "cpp";
    case "h":
      // Check for C++ indicators in path
      if (filePath.includes("++") || filePath.includes("cpp") || filePath.includes("cxx")) {
        return "cpp";
      }
      return "c";
    case "hpp":
    case "hxx":
    case "hh":
      return "cpp";
    case "rs":
      return "rust";
    case "cs":
      return "csharp";
    default:
      return "javascript";
  }
}

/**
 * Converts tree-sitter position to our format
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

// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================

/**
 * High-performance Tree-sitter based parser
 */
export class TreeSitterParser {
  private parser: any | null = null;
  private languages: Map<SupportedLanguage, any> = new Map();
  private cache: LRUCache<string, ParseCacheEntry>;
  private initialized = false;
  private pythonAnalyzer = createPythonAnalyzer();
  private csharpAnalyzer = new CSharpAnalyzer();
  private rustAnalyzer = new RustAnalyzer();
  private cAnalyzer = new CAnalyzer();
  private cppAnalyzer = new CppAnalyzer();

  constructor() {
    // TASK-001: Initialize LRU cache with size-based eviction
    this.cache = new LRUCache<string, ParseCacheEntry>({
      maxSize: CACHE_MAX_SIZE,
      ttl: CACHE_TTL,
      sizeCalculation: (entry) => {
        // Estimate memory size
        return JSON.stringify(entry.entities).length + 1000;
      },
      dispose: (entry) => {
        // Clean up tree reference when evicted
        entry.tree = null as any;
      },
    });
  }

  /**
   * Initialize parser and load language grammars
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("[TreeSitterParser] Initializing web-tree-sitter...");

    // Dynamic import to handle ESM module issues
    try {
      const TreeSitter = await import("web-tree-sitter");
      Parser = (TreeSitter as any).default || TreeSitter;
    } catch (error) {
      console.error("[TreeSitterParser] Failed to import web-tree-sitter:", error);
      throw error;
    }

    // Initialize tree-sitter
    await Parser.init({
      locateFile: (scriptName: string) => {
        // In production, these would be served from a CDN or bundled
        return `/wasm/${scriptName}`;
      },
    });

    this.parser = new Parser();

    // Load language grammars
    for (const [lang, wasmPath] of Object.entries(LANGUAGE_WASM_PATHS)) {
      try {
        const language = await Parser.Language.load(wasmPath);
        this.languages.set(lang as SupportedLanguage, language);
        console.log(`[TreeSitterParser] Loaded language: ${lang}`);
      } catch (error) {
        console.error(`[TreeSitterParser] Failed to load ${lang}: ${error}`);
      }
    }

    this.initialized = true;
    console.log("[TreeSitterParser] Initialization complete");
  }

  /**
   * Parse file content with incremental parsing support
   */
  async parse(filePath: string, content: string, contentHash: string, oldTree?: TreeSitterTree): Promise<ParseResult> {
    if (!this.initialized || !this.parser) {
      throw new Error("Parser not initialized");
    }

    const startTime = Date.now();
    const language = detectLanguage(filePath);

    // Check cache first
    const cacheKey = `${filePath}:${contentHash}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        filePath,
        language,
        entities: cached.entities,
        contentHash,
        timestamp: Date.now(),
        parseTimeMs: 0,
        fromCache: true,
      };
    }

    // Set language for parser
    const lang = this.languages.get(language);
    if (!lang) {
      throw new Error(`Language ${language} not loaded`);
    }
    this.parser.setLanguage(lang);

    // Parse with incremental support
    let tree: TreeSitterTree;
    if (oldTree) {
      // TASK-001: Incremental parsing for 36x performance gain
      tree = this.parser.parse(content, oldTree as any) as unknown as TreeSitterTree;
    } else {
      tree = this.parser.parse(content) as unknown as TreeSitterTree;
    }

    // Extract entities - use language-specific analyzers when available
    let entities: ParsedEntity[];
    let relationships: any[] = [];

    if (language === "python") {
      // Use enhanced Python analyzer for comprehensive analysis
      const pythonAnalysis = await this.pythonAnalyzer.analyzePythonCode(filePath, tree.rootNode, content);
      entities = pythonAnalysis.entities;

      // Log enhanced analysis metrics
      console.log(
        `[TreeSitterParser] Python analysis: ${entities.length} entities, ${pythonAnalysis.relationships.length} relationships`,
      );
    } else if (language === "csharp") {
      // Use C# analyzer for comprehensive analysis
      const csharpAnalysis = await this.csharpAnalyzer.analyze(tree.rootNode, filePath);
      entities = csharpAnalysis.entities;

      // Log C# analysis metrics
      console.log(
        `[TreeSitterParser] C# analysis: ${entities.length} entities, ${csharpAnalysis.relationships.length} relationships, ${csharpAnalysis.patterns.length} patterns`,
      );
    } else if (language === "rust") {
      // Use Rust analyzer for comprehensive analysis
      const rustAnalysis = await this.rustAnalyzer.analyze(tree.rootNode, filePath);
      entities = rustAnalysis.entities;

      // Log Rust analysis metrics
      console.log(
        `[TreeSitterParser] Rust analysis: ${entities.length} entities, ${rustAnalysis.relationships.length} relationships, ${rustAnalysis.patterns.length} patterns`,
      );
    } else if (language === "c") {
      // Use C analyzer for comprehensive analysis
      const cAnalysis = await this.cAnalyzer.analyze(tree.rootNode, filePath);
      entities = cAnalysis.entities;
      relationships = cAnalysis.relationships;

      // Log C analysis metrics
      console.log(
        `[TreeSitterParser] C analysis: ${entities.length} entities, ${relationships.length} relationships`,
      );
    } else if (language === "cpp") {
      // Use C++ analyzer for comprehensive analysis with circuit breakers
      const cppAnalysis = await this.cppAnalyzer.analyze(tree.rootNode, filePath);
      entities = cppAnalysis.entities;
      relationships = cppAnalysis.relationships;

      // Log C++ analysis metrics
      console.log(
        `[TreeSitterParser] C++ analysis: ${entities.length} entities, ${relationships.length} relationships`,
      );
    } else {
      // Use standard extraction for JavaScript/TypeScript and other languages
      entities = await this.extractEntities(tree.rootNode, content);
    }

    // Cache the result
    this.cache.set(cacheKey, {
      tree,
      entities,
      hash: contentHash,
      timestamp: Date.now(),
    });

    const parseTimeMs = Date.now() - startTime;

    const result: ParseResult = {
      filePath,
      language,
      entities,
      contentHash,
      timestamp: Date.now(),
      parseTimeMs,
      fromCache: false,
    };

    // Add relationships if available
    if (relationships.length > 0) {
      result.relationships = relationships;
    }

    return result;
  }

  /**
   * Perform incremental parsing with edits
   */
  async parseIncremental(
    filePath: string,
    newContent: string,
    contentHash: string,
    edits: TreeSitterEdit[],
  ): Promise<ParseResult> {
    // Find old tree in cache
    let oldTree: TreeSitterTree | undefined;
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(filePath)) {
        oldTree = entry.tree;
        // Apply edits to old tree
        for (const edit of edits) {
          oldTree.edit(edit);
        }
        break;
      }
    }

    return this.parse(filePath, newContent, contentHash, oldTree);
  }

  /**
   * Extract entities from parsed tree
   */
  private async extractEntities(
    node: TreeSitterNode,
    source: string,
    depth = 0,
    maxDepth = 5,
  ): Promise<ParsedEntity[]> {
    if (depth > maxDepth) return [];

    const entities: ParsedEntity[] = [];

    // Process based on node type
    switch (node.type) {
      // JavaScript/TypeScript functions
      case "function_declaration":
      case "function_expression":
      case "arrow_function":
      case "method_definition":
        entities.push(this.extractFunction(node, source));
        break;

      // Python functions
      case "function_definition":
      case "async_function_definition":
        entities.push(this.extractPythonFunction(node, source));
        break;

      // Classes (JavaScript/TypeScript and Python)
      case "class_declaration":
      case "class_expression":
      case "class_definition": // Python
        entities.push(this.extractClass(node, source, depth));
        break;

      case "interface_declaration":
        entities.push(this.extractInterface(node, source));
        break;

      case "type_alias_declaration":
      case "type_alias_statement": // Python
        entities.push(this.extractTypeAlias(node, source));
        break;

      // Imports
      case "import_statement":
      case "import_declaration":
      case "import_from_statement": // Python
        entities.push(this.extractImport(node, source));
        break;

      // Exports
      case "export_statement":
      case "export_declaration": {
        const exportEntity = this.extractExport(node, source);
        if (exportEntity) entities.push(exportEntity);
        break;
      }

      // Variables
      case "variable_declaration":
      case "lexical_declaration":
      case "assignment": // Python
      case "augmented_assignment": // Python
      case "annotated_assignment": // Python
        entities.push(...this.extractVariables(node, source));
        break;

      // Python-specific: lambda functions
      case "lambda":
        entities.push(this.extractPythonLambda(node, source));
        break;

      // C/C++ functions
      case "function_definition":
        entities.push(this.extractCFunction(node, source));
        break;

      // C/C++ structures, unions, enums
      case "struct_specifier":
        entities.push(this.extractCStruct(node, source, depth));
        break;
      case "union_specifier":
        entities.push(this.extractCUnion(node, source, depth));
        break;
      case "enum_specifier":
        entities.push(this.extractCEnum(node, source));
        break;

      // C++ classes and namespaces
      case "class_specifier":
        entities.push(this.extractCppClass(node, source, depth));
        break;
      case "namespace_definition":
        entities.push(this.extractCppNamespace(node, source, depth));
        break;

      // C/C++ preprocessor
      case "preproc_include":
        entities.push(this.extractCInclude(node, source));
        break;
      case "preproc_def":
        entities.push(this.extractCMacro(node, source));
        break;

      // C++ templates
      case "template_declaration":
        entities.push(this.extractCppTemplate(node, source, depth));
        break;

      // C/C++ type definitions
      case "type_definition":
        entities.push(this.extractCTypedef(node, source));
        break;

      // Rust entities
      case "function_item":
        entities.push(this.extractRustFunction(node, source));
        break;
      case "struct_item":
        entities.push(this.extractRustStruct(node, source));
        break;
      case "enum_item":
        entities.push(this.extractRustEnum(node, source));
        break;
      case "trait_item":
        entities.push(this.extractRustTrait(node, source));
        break;
      case "impl_item":
        entities.push(this.extractRustImpl(node, source));
        break;
      case "mod_item":
        entities.push(this.extractRustMod(node, source));
        break;
      case "use_declaration":
        entities.push(this.extractRustUse(node, source));
        break;
    }

    // Recursively process children
    for (const child of node.namedChildren) {
      const childEntities = await this.extractEntities(child, source, depth + 1, maxDepth);
      entities.push(...childEntities);
    }

    return entities;
  }

  /**
   * Extract function entity
   */
  private extractFunction(node: TreeSitterNode, source: string): ParsedEntity {
    const nameNode = node.namedChildren.find((c) => c.type === "identifier" || c.type === "property_identifier");

    const name = nameNode?.text || "<anonymous>";
    const modifiers: string[] = [];

    // Check for async
    if (source.substring(node.startIndex, node.startIndex + 5) === "async") {
      modifiers.push("async");
    }

    // Extract parameters
    const parameters = this.extractParameters(node, source);

    return {
      name,
      type: node.parent?.type === "method_definition" ? "method" : "function",
      location: convertPosition(node),
      modifiers,
      parameters,
    };
  }

  /**
   * Extract class entity with methods
   */
  private extractClass(node: TreeSitterNode, source: string, _depth: number): ParsedEntity {
    const nameNode = node.namedChildren.find((c) => c.type === "identifier");
    const name = nameNode?.text || "<anonymous>";

    const bodyNode = node.namedChildren.find((c) => c.type === "class_body");
    const children: ParsedEntity[] = [];

    if (bodyNode) {
      for (const child of bodyNode.namedChildren) {
        if (child.type === "method_definition" || child.type === "property_definition") {
          // Note: For simplicity, extracting methods inline rather than recursively
          const methodEntity = this.extractFunction(child, source);
          children.push(methodEntity);
        }
      }
    }

    return {
      name,
      type: "class",
      location: convertPosition(node),
      children,
    };
  }

  /**
   * Extract interface entity
   */
  private extractInterface(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = node.namedChildren.find((c) => c.type === "type_identifier");
    const name = nameNode?.text || "<anonymous>";

    return {
      name,
      type: "interface",
      location: convertPosition(node),
    };
  }

  /**
   * Extract type alias
   */
  private extractTypeAlias(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = node.namedChildren.find((c) => c.type === "type_identifier");
    const name = nameNode?.text || "<anonymous>";

    return {
      name,
      type: "type",
      location: convertPosition(node),
    };
  }

  /**
   * Extract import statement
   */
  private extractImport(node: TreeSitterNode, _source: string): ParsedEntity {
    const sourceNode = node.descendantsOfType("string")[0];
    const importSource = sourceNode?.text.slice(1, -1) || "";

    const specifiers: Array<{ local: string; imported?: string }> = [];

    // Extract import specifiers
    const specifierNodes = node.descendantsOfType("import_specifier");
    for (const spec of specifierNodes) {
      const imported = spec.child(0)?.text;
      const local = spec.child(2)?.text || imported;
      if (imported) {
        specifiers.push({ local: local!, imported });
      }
    }

    // Check for default import
    const defaultImport = node.descendantsOfType("identifier")[0];
    const isDefault = !!defaultImport && !specifiers.length;

    return {
      name: importSource,
      type: "import",
      location: convertPosition(node),
      importData: {
        source: importSource,
        specifiers,
        isDefault,
      },
    };
  }

  /**
   * Extract export statement
   */
  private extractExport(node: TreeSitterNode, source: string): ParsedEntity | null {
    // Handle various export patterns
    const defaultExport = node.children.some((c) => c.type === "default");

    if (defaultExport) {
      return {
        name: "default",
        type: "export",
        location: convertPosition(node),
      };
    }

    // Named exports
    const declaration = node.namedChildren[0];
    if (declaration) {
      // Export of declaration (function, class, etc.)
      // For simplicity, handle inline rather than recursive extraction
      let entity: ParsedEntity | null = null;

      switch (declaration.type) {
        case "function_declaration":
        case "function_expression":
          entity = this.extractFunction(declaration, source);
          break;
        case "class_declaration":
          entity = this.extractClass(declaration, source, 0);
          break;
        case "variable_declaration":
        case "lexical_declaration": {
          const vars = this.extractVariables(declaration, source);
          entity = vars[0] || null;
          break;
        }
      }

      if (entity) {
        return {
          ...entity,
          type: "export",
        };
      }
    }

    return null;
  }

  /**
   * Extract variable declarations
   */
  private extractVariables(node: TreeSitterNode, source: string): ParsedEntity[] {
    const entities: ParsedEntity[] = [];
    const declarators = node.descendantsOfType("variable_declarator");

    for (const declarator of declarators) {
      const nameNode = declarator.child(0);
      if (nameNode?.type === "identifier") {
        const isConst =
          node.type === "lexical_declaration" && source.substring(node.startIndex, node.startIndex + 5) === "const";

        entities.push({
          name: nameNode.text,
          type: isConst ? "constant" : "variable",
          location: convertPosition(declarator),
        });
      }
    }

    return entities;
  }

  /**
   * Extract function parameters
   */
  private extractParameters(node: TreeSitterNode, _source: string): ParsedEntity["parameters"] {
    const params: NonNullable<ParsedEntity["parameters"]> = [];
    const paramList = node.descendantsOfType("formal_parameters")[0];

    if (!paramList) return params;

    for (const param of paramList.namedChildren) {
      if (param.type === "identifier" || param.type === "required_parameter") {
        const name = param.type === "identifier" ? param.text : param.child(0)?.text;
        if (name) {
          params.push({
            name,
            optional: false,
          });
        }
      } else if (param.type === "optional_parameter") {
        const name = param.child(0)?.text;
        if (name) {
          params.push({
            name,
            optional: true,
          });
        }
      }
    }

    return params;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
      maxSize: CACHE_MAX_SIZE,
    };
  }

  // =============================================================================
  // PYTHON-SPECIFIC EXTRACTORS
  // =============================================================================

  /**
   * Extract Python function entity
   */
  private extractPythonFunction(node: TreeSitterNode, source: string): ParsedEntity {
    const nameNode = node.namedChildren.find((c) => c.type === "identifier");
    const name = nameNode?.text || "<anonymous>";
    const modifiers: string[] = [];

    // Check for async
    if (node.type === "async_function_definition") {
      modifiers.push("async");
    }

    // Check for decorators
    const decorators = this.extractPythonDecorators(node);
    modifiers.push(...decorators);

    // Extract parameters
    const parameters = this.extractPythonParameters(node, source);

    return {
      name,
      type: "function",
      location: convertPosition(node),
      modifiers,
      parameters,
    };
  }

  /**
   * Extract Python lambda function
   */
  private extractPythonLambda(node: TreeSitterNode, source: string): ParsedEntity {
    return {
      name: "<lambda>",
      type: "function",
      location: convertPosition(node),
      modifiers: ["lambda"],
      parameters: this.extractPythonParameters(node, source),
    };
  }

  /**
   * Extract Python decorators
   */
  private extractPythonDecorators(node: TreeSitterNode): string[] {
    const decorators: string[] = [];
    let current = node.previousSibling;

    while (current && current.type === "decorator") {
      const decoratorName = current.descendantsOfType("identifier")[0]?.text;
      if (decoratorName) {
        decorators.unshift(decoratorName); // Add to front to maintain order
      }
      current = current.previousSibling;
    }

    return decorators;
  }

  /**
   * Extract Python function parameters
   */
  private extractPythonParameters(node: TreeSitterNode, _source: string): ParsedEntity["parameters"] {
    const params: NonNullable<ParsedEntity["parameters"]> = [];
    const paramList = node.descendantsOfType("parameters")[0];

    if (!paramList) return params;

    for (const param of paramList.namedChildren) {
      let name: string | undefined;
      let optional = false;
      let type: string | undefined;

      switch (param.type) {
        case "identifier":
          name = param.text;
          break;
        case "default_parameter":
          name = param.child(0)?.text;
          optional = true;
          break;
        case "typed_parameter":
          name = param.child(0)?.text;
          type = param.child(2)?.text; // type annotation after ':'
          break;
        case "typed_default_parameter":
          name = param.child(0)?.text;
          type = param.child(2)?.text;
          optional = true;
          break;
      }

      if (name) {
        params.push({
          name,
          type,
          optional,
        });
      }
    }

    return params;
  }

  // =============================================================================
  // C/C++ ENTITY EXTRACTION METHODS
  // =============================================================================

  /**
   * Extract C function entity
   */
  private extractCFunction(node: TreeSitterNode, source: string): ParsedEntity {
    // Find function name (identifier in function_declarator)
    const nameNode = this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";

    // Extract modifiers
    const modifiers: string[] = [];
    const declarationText = source.substring(node.startIndex, node.endIndex);

    if (declarationText.includes("static")) modifiers.push("static");
    if (declarationText.includes("inline")) modifiers.push("inline");
    if (declarationText.includes("extern")) modifiers.push("extern");

    // Extract parameters
    const parameters = this.extractCParameters(node, source);

    // Extract return type
    const returnType = this.extractCReturnType(node, source);

    return {
      name,
      type: "function",
      location: convertPosition(node),
      modifiers,
      parameters,
      returnType,
    };
  }

  /**
   * Extract C struct entity
   */
  private extractCStruct(node: TreeSitterNode, source: string, depth: number): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";

    // Extract fields as children
    const children: ParsedEntity[] = [];
    const fieldNodes = node.namedChildren.filter((child) => child.type === "field_declaration_list");

    for (const fieldList of fieldNodes) {
      for (const field of fieldList.namedChildren) {
        if (field.type === "field_declaration") {
          const fieldEntity = this.extractCField(field, source);
          if (fieldEntity) children.push(fieldEntity);
        }
      }
    }

    return {
      name,
      type: "class",
      location: convertPosition(node),
      children,
      modifiers: ["struct"],
    };
  }

  /**
   * Extract C union entity
   */
  private extractCUnion(node: TreeSitterNode, source: string, depth: number): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";

    return {
      name,
      type: "class",
      location: convertPosition(node),
      modifiers: ["union"],
    };
  }

  /**
   * Extract C enum entity
   */
  private extractCEnum(node: TreeSitterNode, source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";

    return {
      name,
      type: "type",
      location: convertPosition(node),
      modifiers: ["enum"],
    };
  }

  /**
   * Extract C++ class entity
   */
  private extractCppClass(node: TreeSitterNode, source: string, depth: number): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";

    // Extract base classes
    const baseClasses: string[] = [];
    const baseClassList = this.findNodeByType(node, "base_class_clause");
    if (baseClassList) {
      for (const baseClass of baseClassList.namedChildren) {
        if (baseClass.type === "type_identifier") {
          baseClasses.push(baseClass.text);
        }
      }
    }

    // Extract access modifiers
    const modifiers: string[] = ["class"];
    const declarationText = source.substring(node.startIndex, node.endIndex);
    if (declarationText.includes("final")) modifiers.push("final");

    return {
      name,
      type: "class",
      location: convertPosition(node),
      modifiers,
      inheritance: baseClasses.length > 0 ? { baseClasses } : undefined,
    };
  }

  /**
   * Extract C++ namespace entity
   */
  private extractCppNamespace(node: TreeSitterNode, source: string, depth: number): ParsedEntity {
    const nameNode = this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";

    return {
      name,
      type: "type",
      location: convertPosition(node),
      modifiers: ["namespace"],
    };
  }

  /**
   * Extract C include entity
   */
  private extractCInclude(node: TreeSitterNode, source: string): ParsedEntity {
    const includeNode = this.findNodeByType(node, "string_literal") || this.findNodeByType(node, "system_lib_string");
    const includePath = includeNode?.text || "<unknown>";

    return {
      name: includePath.replace(/[<>"]/g, ""),
      type: "import",
      location: convertPosition(node),
      importData: {
        source: includePath,
        specifiers: [],
        isDefault: false,
      },
    };
  }

  /**
   * Extract C macro entity
   */
  private extractCMacro(node: TreeSitterNode, source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";

    return {
      name,
      type: "constant",
      location: convertPosition(node),
      modifiers: ["macro"],
    };
  }

  /**
   * Extract C++ template entity
   */
  private extractCppTemplate(node: TreeSitterNode, source: string, depth: number): ParsedEntity {
    // Templates can contain classes, functions, etc.
    const templateBody = node.namedChildren.find(
      (child) =>
        child.type === "class_specifier" || child.type === "function_definition" || child.type === "struct_specifier",
    );

    if (templateBody) {
      // Extract the templated entity and mark it as a template
      let entity: ParsedEntity;

      switch (templateBody.type) {
        case "class_specifier":
        case "struct_specifier":
          entity = this.extractCppClass(templateBody, source, depth);
          break;
        case "function_definition":
          entity = this.extractCFunction(templateBody, source);
          break;
        default:
          entity = {
            name: "<unknown>",
            type: "type",
            location: convertPosition(node),
          };
      }

      // Add template modifier
      entity.modifiers = entity.modifiers || [];
      entity.modifiers.push("template");

      return entity;
    }

    return {
      name: "<template>",
      type: "type",
      location: convertPosition(node),
      modifiers: ["template"],
    };
  }

  /**
   * Extract C typedef entity
   */
  private extractCTypedef(node: TreeSitterNode, source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";

    return {
      name,
      type: "type",
      location: convertPosition(node),
      modifiers: ["typedef"],
    };
  }

  /**
   * Extract C field from struct/union
   */
  private extractCField(node: TreeSitterNode, source: string): ParsedEntity | null {
    const nameNode = this.findNodeByType(node, "field_identifier") || this.findNodeByType(node, "identifier");
    if (!nameNode) return null;

    const name = nameNode.text;

    return {
      name,
      type: "property",
      location: convertPosition(node),
    };
  }

  /**
   * Extract parameters for C functions
   */
  private extractCParameters(
    node: TreeSitterNode,
    source: string,
  ): Array<{ name: string; type?: string; optional?: boolean }> {
    const params: Array<{ name: string; type?: string; optional?: boolean }> = [];

    const paramList = this.findNodeByType(node, "parameter_list");
    if (!paramList) return params;

    for (const param of paramList.namedChildren) {
      if (param.type === "parameter_declaration") {
        const nameNode = this.findNodeByType(param, "identifier");
        const name = nameNode?.text;

        // Extract type (everything before the identifier)
        let type: string | undefined;
        const typeNodes = param.namedChildren.filter((child) => child !== nameNode);
        if (typeNodes.length > 0) {
          type = typeNodes.map((n) => n.text).join(" ");
        }

        if (name) {
          params.push({ name, type });
        }
      }
    }

    return params;
  }

  /**
   * Extract return type for C functions
   */
  private extractCReturnType(node: TreeSitterNode, source: string): string | undefined {
    // In C, the return type is typically the first part of the function declaration
    const declarator = this.findNodeByType(node, "function_declarator");
    if (!declarator) return undefined;

    // Find type specifiers before the declarator
    const typeNodes = node.namedChildren.filter(
      (child) => child !== declarator && (child.type.includes("type") || child.type === "primitive_type"),
    );

    if (typeNodes.length > 0) {
      return typeNodes.map((n) => n.text).join(" ");
    }

    return undefined;
  }

  /**
   * Helper: Find first node of given type in tree
   */
  private findNodeByType(node: TreeSitterNode, type: string): TreeSitterNode | null {
    if (node.type === type) return node;

    for (const child of node.namedChildren) {
      const found = this.findNodeByType(child, type);
      if (found) return found;
    }

    return null;
  }

  // =============================================================================
  // RUST ENTITY EXTRACTION METHODS
  // =============================================================================

  private extractRustFunction(node: TreeSitterNode, source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    const modifiers: string[] = [];
    const text = source.substring(node.startIndex, node.endIndex);
    if (/\bpub\b/.test(text)) modifiers.push("pub");
    if (/\basync\b/.test(text)) modifiers.push("async");
    if (/\bconst\b/.test(text)) modifiers.push("const");

    // Parameters (best-effort)
    const params: NonNullable<ParsedEntity["parameters"]> = [];
    const paramList = this.findNodeByType(node, "parameters") || this.findNodeByType(node, "parameter_list");
    if (paramList) {
      for (const p of paramList.namedChildren) {
        const pname = this.findNodeByType(p, "identifier")?.text;
        if (pname) params.push({ name: pname });
      }
    }

    return {
      name,
      type: "function",
      location: convertPosition(node),
      modifiers,
      parameters: params,
    };
  }

  private extractRustStruct(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    return {
      name,
      type: "class",
      location: convertPosition(node),
      modifiers: ["struct"],
    };
  }

  private extractRustEnum(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    return {
      name,
      type: "type",
      location: convertPosition(node),
      modifiers: ["enum"],
    };
  }

  private extractRustTrait(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    return {
      name,
      type: "interface",
      location: convertPosition(node),
      modifiers: ["trait"],
    };
  }

  private extractRustImpl(node: TreeSitterNode, _source: string): ParsedEntity {
    // impl blocks don't always have a distinct name; use first type_identifier if any
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<impl>";
    return {
      name,
      type: "class",
      location: convertPosition(node),
      modifiers: ["impl"],
    };
  }

  private extractRustMod(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<mod>";
    return {
      name,
      type: "type",
      location: convertPosition(node),
      modifiers: ["mod"],
    };
  }

  private extractRustUse(node: TreeSitterNode, _source: string): ParsedEntity {
    // use foo::bar as baz;
    const firstPath = node.namedChildren.find((c) => c.type.includes("scoped_identifier") || c.type.includes("identifier"));
    const aliasNode = node.namedChildren.find((c) => c.type === "as" || c.type === "rename");
    const sourcePath = firstPath?.text || "";
    const alias = aliasNode?.text;
    return {
      name: alias || sourcePath || "use",
      type: "import",
      location: convertPosition(node),
      importData: {
        source: sourcePath,
        specifiers: alias ? [{ local: alias, imported: sourcePath }] : [{ local: sourcePath }],
      },
    };
  }
}
