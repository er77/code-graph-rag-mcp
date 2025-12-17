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

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { LRUCache } from "lru-cache";
import Parser from "tree-sitter";
import { ConfigLoader } from "../config/yaml-config.js";
import type { ParsedEntity, ParseResult, SupportedLanguage } from "../types/parser.js";
import { CAnalyzer } from "./c-analyzer.js";
import { CppAnalyzer } from "./cpp-analyzer.js";
import { CSharpAnalyzer } from "./csharp-analyzer.js";
import { GoAnalyzer } from "./go-analyzer.js";
import { JavaAnalyzer } from "./java-analyzer.js";
import { KotlinAnalyzer } from "./kotlin-analyzer.js";
import { MarkdownAnalyzer } from "./markdown-analyzer.js";
import { createPythonAnalyzer } from "./python-analyzer.js";
import { RustAnalyzer } from "./rust-analyzer.js";
import { VbaAnalyzer } from "./vba-analyzer.js";

type TreeSitterNode = Parser.SyntaxNode;
type TreeSitterTree = Parser.Tree;
type TreeSitterEdit = Parser.Edit;

const CACHE_MAX_SIZE = 100 * 1024 * 1024; // 100MB
const CACHE_TTL = 1000 * 60 * 60; // 1h

const requireModule = createRequire(import.meta.url);

const LANGUAGE_LOADERS: Partial<Record<SupportedLanguage, () => Promise<any>>> = {
  javascript: async () => {
    const m: any = requireModule("tree-sitter-javascript");
    return m.default ?? m;
  },
  jsx: async () => {
    const m: any = requireModule("tree-sitter-javascript");
    return m.default ?? m;
  },
  typescript: async () => {
    const m: any = requireModule("tree-sitter-typescript");
    return m.typescript ?? m.default?.typescript;
  },
  tsx: async () => {
    const m: any = requireModule("tree-sitter-typescript");
    return m.tsx ?? m.default?.tsx;
  },
  python: async () => {
    const m: any = requireModule("tree-sitter-python");
    return m.default ?? m;
  },
  c: async () => {
    const m: any = requireModule("tree-sitter-c");
    return m.default ?? m;
  },
  cpp: async () => {
    const m: any = requireModule("tree-sitter-cpp");
    return m.default ?? m;
  },
  rust: async () => {
    const m: any = requireModule("tree-sitter-rust");
    return m.default ?? m;
  },
  csharp: async () => {
    const m: any = requireModule("tree-sitter-c-sharp");
    return m.default ?? m;
  },
  go: async () => {
    const m: any = requireModule("tree-sitter-go");
    return m.default ?? m;
  },
  java: async () => {
    const m: any = requireModule("tree-sitter-java");
    return m.default ?? m;
  },
  kotlin: async () => {
    const m: any = requireModule("tree-sitter-kotlin");
    return m.default ?? m;
  },
};

interface ParseCacheEntry {
  tree: TreeSitterTree | null;
  entities: ParsedEntity[];
  hash: string;
  timestamp: number;
  relationships?: any[];
}

function ds(node: TreeSitterNode, types: string | string[]): TreeSitterNode[] {
  const anyNode = node as unknown as { descendantsOfType?: (t: any) => any[] };
  if (typeof anyNode.descendantsOfType === "function") {
    return anyNode.descendantsOfType(types) as TreeSitterNode[];
  }
  const wanted = new Set(Array.isArray(types) ? types : [types]);
  const out: TreeSitterNode[] = [];
  const stack: TreeSitterNode[] = [...node.namedChildren];
  while (stack.length) {
    const n = stack.pop()!;
    if (wanted.has(n.type)) out.push(n);
    for (const c of n.namedChildren) stack.push(c);
  }
  return out;
}

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
    case "md":
    case "mdx":
      return "markdown";
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
    case "c#":
    case "cs":
      return "csharp";
    case "go":
      return "go";
    case "java":
      return "java";
    case "kt":
    case "kts":
      return "kotlin";
    case "h":
      return filePath.includes("++") || filePath.includes("cpp") || filePath.includes("cxx") ? "cpp" : "c";
    case "hpp":
    case "hxx":
    case "hh":
      return "cpp";
    case "rs":
      return "rust";

    case "vba":
    case "bas":
    case "cls":
    case "frm":
      return "vba";
    default:
      return "javascript";
  }
}

function convertPosition(node: TreeSitterNode) {
  return {
    start: { line: node.startPosition.row + 1, column: node.startPosition.column, index: node.startIndex },
    end: { line: node.endPosition.row + 1, column: node.endPosition.column, index: node.endIndex },
  };
}

export class TreeSitterParser {
  private parser: Parser | null = null;
  private languages: Map<SupportedLanguage, any> = new Map();
  private cache: LRUCache<string, ParseCacheEntry>;
  private initialized = false;
  private disableCache: boolean;

  private pythonAnalyzer = createPythonAnalyzer();
  private csharpAnalyzer = new CSharpAnalyzer();
  private rustAnalyzer = new RustAnalyzer();
  private cAnalyzer = new CAnalyzer();
  private cppAnalyzer = new CppAnalyzer();
  private goAnalyzer = new GoAnalyzer();
  private javaAnalyzer = new JavaAnalyzer();
  private kotlinAnalyzer = new KotlinAnalyzer();
  private vbaAnalyzer = new VbaAnalyzer();
  private markdownAnalyzer = new MarkdownAnalyzer();

  private cacheHits = 0;
  private cacheMisses = 0;
  private bufferSize: number;

  constructor() {
    const config = ConfigLoader.getInstance();
    this.bufferSize = config.getParserConfig().treeSitter?.bufferSize || 1024 * 1024;
    this.disableCache = process.env.PARSER_DISABLE_CACHE === "1" || process.env.NODE_ENV === "test";

    this.cache = new LRUCache<string, ParseCacheEntry>({
      maxSize: CACHE_MAX_SIZE,
      ttl: CACHE_TTL,
      sizeCalculation: (entry) => JSON.stringify(entry.entities).length + 1000,
      dispose: (entry) => {
        entry.tree = null;
      },
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.parser = new Parser();
    this.initialized = true;
    console.error("[TreeSitterParser] Initialization complete");
  }

  private getFromCache(key: string): ParseCacheEntry | undefined {
    if (this.disableCache) return undefined;
    return this.cache.get(key);
  }

  private setCache(key: string, entry: ParseCacheEntry): void {
    if (this.disableCache) return;
    this.cache.set(key, entry);
  }

  private async ensureLanguage(language: SupportedLanguage): Promise<any> {
    const cached = this.languages.get(language);
    if (cached) return cached;

    const loader = LANGUAGE_LOADERS[language];
    if (!loader) {
      throw new Error(`Unsupported language: ${language}`);
    }

    try {
      const lang = await loader();
      if (!lang) throw new Error(`Language loader returned empty result for ${language}`);
      this.languages.set(language, lang);
      console.error(`[TreeSitterParser] Loaded language: ${language}`);
      return lang;
    } catch (e: any) {
      throw new Error(`[TreeSitterParser] Language '${language}' is not available: ${e?.message || e}`);
    }
  }

  async parse(filePath: string, content: string, contentHash: string, oldTree?: TreeSitterTree): Promise<ParseResult> {
    if (!this.initialized || !this.parser) throw new Error("Parser not initialized");

    const startTime = Date.now();
    const language = detectLanguage(filePath);

    const internalHash = createHash("sha1").update(content).digest("hex");
    const cacheKey = `${filePath}:${internalHash}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.cacheHits++;
      const result: ParseResult = {
        filePath,
        language,
        entities: cached.entities,
        contentHash,
        timestamp: Date.now(),
        parseTimeMs: 0,
        fromCache: true,
      };
      if (cached.relationships?.length) {
        (result as any).relationships = cached.relationships;
      }
      return result;
    }

    if (language === "vba") {
      const vbaAnalysis = await this.vbaAnalyzer.analyze(content, filePath);
      let entities = vbaAnalysis.entities || [];
      const relationships = vbaAnalysis.relationships || [];

      entities = entities.map((e) => ({ ...e, language }));

      this.cacheMisses++;
      this.setCache(cacheKey, { tree: null, entities, hash: internalHash, timestamp: Date.now(), relationships });

      const parseTimeMs = Date.now() - startTime;
      console.error(
        `[TreeSitterParser] VBA analysis: ${entities.length} entities, ${relationships.length} relationships`,
      );

      const result: ParseResult = {
        filePath,
        language,
        entities,
        contentHash,
        timestamp: Date.now(),
        parseTimeMs,
        fromCache: false,
      };
      if (relationships.length) {
        (result as any).relationships = relationships;
      }
      return result;
    }

    if (language === "markdown") {
      const md = this.markdownAnalyzer.analyze(content, filePath);
      const entities = (md.entities || []).map((e) => ({ ...e, language }));
      const relationships = md.relationships || [];

      this.cacheMisses++;
      this.setCache(cacheKey, { tree: null, entities, hash: internalHash, timestamp: Date.now(), relationships });

      const result: ParseResult = {
        filePath,
        language,
        entities,
        contentHash,
        timestamp: Date.now(),
        parseTimeMs: Date.now() - startTime,
        fromCache: false,
      };
      if (relationships.length) {
        (result as any).relationships = relationships;
      }
      return result;
    }

    const lang = await this.ensureLanguage(language);
    this.parser.setLanguage(lang);

    const options = { bufferSize: this.bufferSize };
    const tree: TreeSitterTree = oldTree
      ? (this.parser.parse(content, oldTree, options) as TreeSitterTree)
      : (this.parser.parse(content, undefined, options) as TreeSitterTree);

    let entities: ParsedEntity[] = [];
    let relationships: any[] = [];

    if (language === "python") {
      const py = await this.pythonAnalyzer.analyzePythonCode(filePath, tree.rootNode as any, content);
      entities = py.entities;
      relationships = py.relationships || [];
      console.error(
        `[TreeSitterParser] Python analysis: ${entities.length} entities, ${relationships.length} relationships`,
      );
    } else if (language === "csharp") {
      const cs = await this.csharpAnalyzer.analyze(tree.rootNode as any, filePath);
      entities = cs.entities || [];
      relationships = cs.relationships || [];
      console.error(
        `[TreeSitterParser] C# analysis: ${entities.length} entities, ${relationships.length} relationships, ${(cs as any).patterns?.length || 0} patterns`,
      );
    } else if (language === "rust") {
      const ru = await this.rustAnalyzer.analyze(tree.rootNode as any, filePath);
      entities = ru.entities || [];
      relationships = ru.relationships || [];
      console.error(
        `[TreeSitterParser] Rust analysis: ${entities.length} entities, ${relationships.length} relationships, ${(ru as any).patterns?.length || 0} patterns`,
      );
    } else if (language === "c") {
      const ca = await this.cAnalyzer.analyze(tree.rootNode as any, filePath);
      entities = ca.entities || [];
      relationships = ca.relationships || [];
      console.error(
        `[TreeSitterParser] C analysis: ${entities.length} entities, ${relationships.length} relationships`,
      );
    } else if (language === "cpp") {
      const cp = await this.cppAnalyzer.analyze(tree.rootNode as any, filePath);
      entities = cp.entities || [];
      relationships = cp.relationships || [];
      console.error(
        `[TreeSitterParser] C++ analysis: ${entities.length} entities, ${relationships.length} relationships`,
      );
    } else if (language === "go") {
      const ga = await this.goAnalyzer.analyze(tree.rootNode as any, filePath);
      entities = ga.entities || [];
      relationships = ga.relationships || [];
      console.error(
        `[TreeSitterParser] Go analysis: ${entities.length} entities, ${relationships.length} relationships`,
      );
    } else if (language === "java") {
      const ja = await this.javaAnalyzer.analyze(tree.rootNode as any, filePath);
      entities = ja.entities || [];
      relationships = ja.relationships || [];
      console.error(
        `[TreeSitterParser] Java analysis: ${entities.length} entities, ${relationships.length} relationships`,
      );
    } else if (language === "kotlin") {
      const ko = await this.kotlinAnalyzer.analyze(tree.rootNode as any, filePath);
      entities = ko.entities || [];
      relationships = ko.relationships || [];
      console.error(
        `[TreeSitterParser] Kotlin analysis: ${entities.length} entities, ${relationships.length} relationships`,
      );
    } else {
      // Default parser for JS/TS/etc
      entities = await this.extractEntities(tree.rootNode as any, content);
    }

    entities = entities.map((entity) => ({
      ...entity,
      language,
    }));

    this.cacheMisses++;
    this.setCache(cacheKey, { tree, entities, hash: internalHash, timestamp: Date.now(), relationships });

    const result: ParseResult = {
      filePath,
      language,
      entities,
      contentHash,
      timestamp: Date.now(),
      parseTimeMs: Date.now() - startTime,
      fromCache: false,
    };
    if (relationships.length) {
      (result as any).relationships = relationships;
    }
    return result;
  }

  async parseIncremental(
    filePath: string,
    newContent: string,
    contentHash: string,
    edits: TreeSitterEdit[],
  ): Promise<ParseResult> {
    if (this.disableCache) {
      return this.parse(filePath, newContent, contentHash, undefined);
    }

    let oldTree: TreeSitterTree | undefined;
    let newestTs = -1;
    const prefix = `${filePath}:`;

    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(prefix) && entry.tree && entry.timestamp > newestTs) {
        newestTs = entry.timestamp;
        oldTree = entry.tree;
      }
    }

    if (oldTree && edits?.length) {
      for (const edit of edits) oldTree.edit(edit);
    }

    return this.parse(filePath, newContent, contentHash, oldTree);
  }

  private async extractEntities(
    node: TreeSitterNode,
    source: string,
    depth = 0,
    maxDepth = 5,
  ): Promise<ParsedEntity[]> {
    if (depth > maxDepth) return [];
    const entities: ParsedEntity[] = [];

    switch (node.type) {
      // JS/TS
      case "function_declaration":
      case "function_expression":
      case "arrow_function":
      case "method_definition":
        entities.push(this.extractFunction(node, source));
        break;
      case "class_declaration":
      case "class_expression":
      case "interface_declaration":
      case "type_alias_declaration":
        if (node.type === "class_declaration" || node.type === "class_expression") {
          entities.push(this.extractClass(node, source, depth));
        } else if (node.type === "interface_declaration") {
          entities.push(this.extractInterface(node, source));
        } else {
          entities.push(this.extractTypeAlias(node, source));
        }
        break;
      case "import_declaration":
        entities.push(this.extractImport(node, source));
        break;
      case "export_statement":
      case "export_declaration": {
        const e = this.extractExport(node, source);
        if (e) entities.push(e);
        break;
      }
      case "variable_declaration":
      case "lexical_declaration":
        entities.push(...this.extractVariables(node, source));
        break;

      // Python
      case "async_function_definition":
        entities.push(this.extractPythonFunction(node, source));
        break;
      case "lambda":
        entities.push(this.extractPythonLambda(node, source));
        break;
      case "type_alias_statement":
        entities.push(this.extractTypeAlias(node, source));
        break;
      case "import_statement":
      case "import_from_statement":
        entities.push(this.extractImport(node, source));
        break;
      case "assignment":
      case "augmented_assignment":
      case "annotated_assignment":
        entities.push(...this.extractVariables(node, source));
        break;

      // C/Python function heuristic
      case "function_definition": {
        const looksLikePython =
          !!this.findNodeByType(node, "parameters") && !this.findNodeByType(node, "function_declarator");
        if (looksLikePython) entities.push(this.extractPythonFunction(node, source));
        else entities.push(this.extractCFunction(node, source));
        break;
      }

      //C/C++
      case "struct_specifier":
        entities.push(this.extractCStruct(node, source, depth));
        break;
      case "union_specifier":
        entities.push(this.extractCUnion(node, source, depth));
        break;
      case "enum_specifier":
        entities.push(this.extractCEnum(node, source));
        break;
      case "class_specifier":
        entities.push(this.extractCppClass(node, source, depth));
        break;
      case "namespace_definition":
        entities.push(this.extractCppNamespace(node, source, depth));
        break;
      case "preproc_include":
        entities.push(this.extractCInclude(node, source));
        break;
      case "preproc_def":
        entities.push(this.extractCMacro(node, source));
        break;
      case "template_declaration":
        entities.push(this.extractCppTemplate(node, source, depth));
        break;
      case "type_definition":
        entities.push(this.extractCTypedef(node, source));
        break;

      // Rust
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

    for (const child of node.namedChildren) {
      entities.push(...(await this.extractEntities(child, source, depth + 1, maxDepth)));
    }
    return entities;
  }

  private extractFunction(node: TreeSitterNode, source: string): ParsedEntity {
    const nameNode = node.namedChildren.find((c) => c.type === "identifier" || c.type === "property_identifier");
    const name = nameNode?.text || "<anonymous>";
    const modifiers: string[] = [];
    if (source.substring(node.startIndex, node.startIndex + 5) === "async") modifiers.push("async");
    const parameters = this.extractParameters(node, source);
    const position = convertPosition(node);
    const signature = source.substring(position.start.index, Math.min(position.end.index, position.start.index + 200));

    const body = node.namedChildren.find((c) => c.type === "statement_block" || c.type === "class_body");
    const references = new Set<string>();
    if (body) {
      const queue: TreeSitterNode[] = [...body.namedChildren];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.type === "identifier" || current.type === "property_identifier") {
          const text = current.text;
          if (text && text !== name) {
            references.add(text);
          }
        }
        for (const child of current.namedChildren) {
          queue.push(child);
        }
      }
    }

    return {
      name,
      type: node.parent?.type === "method_definition" ? "method" : "function",
      location: position,
      modifiers,
      parameters,
      signature: signature.trim(),
      references: references.size ? Array.from(references) : undefined,
    };
  }

  private extractClass(node: TreeSitterNode, source: string, _depth: number): ParsedEntity {
    const nameNode = node.namedChildren.find((c) => c.type === "identifier");
    const name = nameNode?.text || "<anonymous>";
    const bodyNode = node.namedChildren.find((c) => c.type === "class_body");
    const children: ParsedEntity[] = [];
    if (bodyNode) {
      for (const child of bodyNode.namedChildren) {
        if (child.type === "method_definition" || child.type === "property_definition") {
          children.push(this.extractFunction(child, source));
        }
      }
    }
    return { name, type: "class", location: convertPosition(node), children };
  }

  private extractInterface(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = node.namedChildren.find((c) => c.type === "type_identifier");
    const name = nameNode?.text || "<anonymous>";
    return { name, type: "interface", location: convertPosition(node) };
  }

  private extractTypeAlias(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = node.namedChildren.find((c) => c.type === "type_identifier");
    const name = nameNode?.text || "<anonymous>";
    return { name, type: "type", location: convertPosition(node) };
  }

  private extractImport(node: TreeSitterNode, _source: string): ParsedEntity {
    const sourceNode = ds(node, "string")[0];
    const importSource = sourceNode?.text?.slice(1, -1) || "";
    const specifiers: Array<{ local: string; imported?: string }> = [];
    const specifierNodes = ds(node, "import_specifier");
    for (const spec of specifierNodes) {
      const imported = spec.child(0)?.text;
      const local = spec.child(2)?.text || imported;
      if (imported) specifiers.push({ local: local!, imported });
    }
    const defaultImport = ds(node, "identifier")[0];
    const isDefault = !!defaultImport && specifiers.length === 0;
    return {
      name: importSource,
      type: "import",
      location: convertPosition(node),
      importData: { source: importSource, specifiers, isDefault },
    };
  }

  private extractExport(node: TreeSitterNode, source: string): ParsedEntity | null {
    const isDefault = node.children.some((c) => c.type === "default");
    if (isDefault) {
      const position = convertPosition(node);
      const signature = source.substring(
        position.start.index,
        Math.min(position.end.index, position.start.index + 200),
      );
      return {
        name: "default",
        type: "export",
        location: position,
        signature: signature.trim(),
      };
    }
    const declaration = node.namedChildren[0];
    if (declaration) {
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
        case "lexical_declaration":
          entity = this.extractVariables(declaration, source)[0] || null;
          break;
      }
      if (entity) {
        return {
          ...entity,
          modifiers: [...(entity.modifiers || []), "export"],
        };
      }
    }
    return null;
  }

  private extractVariables(node: TreeSitterNode, source: string): ParsedEntity[] {
    const entities: ParsedEntity[] = [];
    const declarators = ds(node, "variable_declarator");
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

  private extractParameters(node: TreeSitterNode, _source: string): ParsedEntity["parameters"] {
    const params: NonNullable<ParsedEntity["parameters"]> = [];
    const paramList = ds(node, "formal_parameters")[0];
    if (!paramList) return params;
    for (const param of paramList.namedChildren) {
      if (param.type === "identifier" || param.type === "required_parameter") {
        const name = param.type === "identifier" ? param.text : param.child(0)?.text;
        if (name) params.push({ name, optional: false });
      } else if (param.type === "optional_parameter") {
        const name = param.child(0)?.text;
        if (name) params.push({ name, optional: true });
      }
    }
    return params;
  }

  // Python

  private extractPythonFunction(node: TreeSitterNode, source: string): ParsedEntity {
    const nameNode = node.namedChildren.find((c) => c.type === "identifier");
    const name = nameNode?.text || "<anonymous>";
    const modifiers: string[] = [];
    if (node.type === "async_function_definition") modifiers.push("async");
    const decorators = this.extractPythonDecorators(node);
    modifiers.push(...decorators);
    const parameters = this.extractPythonParameters(node, source);
    return { name, type: "function", location: convertPosition(node), modifiers, parameters };
  }

  private extractPythonLambda(node: TreeSitterNode, source: string): ParsedEntity {
    return {
      name: "<lambda>",
      type: "function",
      location: convertPosition(node),
      modifiers: ["lambda"],
      parameters: this.extractPythonParameters(node, source),
    };
  }

  private extractPythonDecorators(node: TreeSitterNode): string[] {
    const decorators: string[] = [];
    let current = node.previousSibling as TreeSitterNode | null | undefined;
    while (current && current.type === "decorator") {
      const ident = ds(current, "identifier")[0];
      const decoratorName = ident?.text;
      if (decoratorName) decorators.unshift(decoratorName);
      current = current.previousSibling as any;
    }
    return decorators;
  }

  private extractPythonParameters(node: TreeSitterNode, _source: string): ParsedEntity["parameters"] {
    const params: NonNullable<ParsedEntity["parameters"]> = [];
    const paramList = ds(node, "parameters")[0];
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
          type = param.child(2)?.text;
          break;
        case "typed_default_parameter":
          name = param.child(0)?.text;
          type = param.child(2)?.text;
          optional = true;
          break;
      }
      if (name) params.push({ name, type, optional });
    }
    return params;
  }

  // C/C++

  private extractCFunction(node: TreeSitterNode, source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    const mods: string[] = [];
    const decl = source.substring(node.startIndex, node.endIndex);
    if (decl.includes("static")) mods.push("static");
    if (decl.includes("inline")) mods.push("inline");
    if (decl.includes("extern")) mods.push("extern");
    const parameters = this.extractCParameters(node, source);
    const returnType = this.extractCReturnType(node, source);
    return { name, type: "function", location: convertPosition(node), modifiers: mods, parameters, returnType };
  }

  private extractCStruct(node: TreeSitterNode, source: string, _depth: number): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    const children: ParsedEntity[] = [];
    const fieldLists = node.namedChildren.filter((c) => c.type === "field_declaration_list");
    for (const fl of fieldLists) {
      for (const f of fl.namedChildren) {
        if (f.type === "field_declaration") {
          const fieldEntity = this.extractCField(f, source);
          if (fieldEntity) children.push(fieldEntity);
        }
      }
    }
    return { name, type: "class", location: convertPosition(node), children, modifiers: ["struct"] };
  }

  private extractCUnion(node: TreeSitterNode, _source: string, _depth: number): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    return { name, type: "class", location: convertPosition(node), modifiers: ["union"] };
  }

  private extractCEnum(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    return { name, type: "type", location: convertPosition(node), modifiers: ["enum"] };
  }

  private extractCppClass(node: TreeSitterNode, source: string, _depth: number): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    const baseClasses: string[] = [];
    const baseList = this.findNodeByType(node, "base_class_clause");
    if (baseList) {
      for (const base of baseList.namedChildren) if (base.type === "type_identifier") baseClasses.push(base.text);
    }
    const mods: string[] = ["class"];
    const decl = source.substring(node.startIndex, node.endIndex);
    if (decl.includes("final")) mods.push("final");
    return {
      name,
      type: "class",
      location: convertPosition(node),
      modifiers: mods,
      inheritance: baseClasses.length ? { baseClasses } : undefined,
    };
  }

  private extractCppNamespace(node: TreeSitterNode, _source: string, _depth: number): ParsedEntity {
    const nameNode = this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    return { name, type: "type", location: convertPosition(node), modifiers: ["namespace"] };
  }

  private extractCInclude(node: TreeSitterNode, _source: string): ParsedEntity {
    const incNode = this.findNodeByType(node, "string_literal") || this.findNodeByType(node, "system_lib_string");
    const inc = incNode?.text || "<unknown>";
    return {
      name: inc.replace(/[<>"]/g, ""),
      type: "import",
      location: convertPosition(node),
      importData: { source: inc, specifiers: [], isDefault: false },
    };
  }

  private extractCMacro(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    return { name, type: "constant", location: convertPosition(node), modifiers: ["macro"] };
  }

  private extractCppTemplate(node: TreeSitterNode, source: string, depth: number): ParsedEntity {
    const body = node.namedChildren.find(
      (c) => c.type === "class_specifier" || c.type === "function_definition" || c.type === "struct_specifier",
    );
    if (body) {
      let e: ParsedEntity;
      if (body.type === "function_definition") e = this.extractCFunction(body, source);
      else e = this.extractCppClass(body, source, depth);
      e.modifiers = e.modifiers || [];
      e.modifiers.push("template");
      return e;
    }
    return { name: "<template>", type: "type", location: convertPosition(node), modifiers: ["template"] };
  }

  private extractCTypedef(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    return { name, type: "type", location: convertPosition(node), modifiers: ["typedef"] };
  }

  private extractCField(node: TreeSitterNode, _source: string): ParsedEntity | null {
    const nameNode = this.findNodeByType(node, "field_identifier") || this.findNodeByType(node, "identifier");
    if (!nameNode) return null;
    return { name: nameNode.text, type: "property", location: convertPosition(node) };
  }

  private extractCParameters(
    node: TreeSitterNode,
    _source: string,
  ): Array<{ name: string; type?: string; optional?: boolean }> {
    const params: Array<{ name: string; type?: string; optional?: boolean }> = [];
    const list = this.findNodeByType(node, "parameter_list");
    if (!list) return params;
    for (const p of list.namedChildren) {
      if (p.type === "parameter_declaration") {
        const nameNode = this.findNodeByType(p, "identifier");
        const name = nameNode?.text;
        let type: string | undefined;
        const typeNodes = p.namedChildren.filter((c) => c !== nameNode);
        if (typeNodes.length) type = typeNodes.map((n) => n.text).join(" ");
        if (name) params.push({ name, type });
      }
    }
    return params;
  }

  private extractCReturnType(node: TreeSitterNode, _source: string): string | undefined {
    const decl = this.findNodeByType(node, "function_declarator");
    if (!decl) return undefined;
    const typeNodes = node.namedChildren.filter(
      (c) => c !== decl && (c.type.includes("type") || c.type === "primitive_type"),
    );
    return typeNodes.length ? typeNodes.map((n) => n.text).join(" ") : undefined;
  }

  private findNodeByType(node: TreeSitterNode, type: string): TreeSitterNode | null {
    if (node.type === type) return node;
    for (const c of node.namedChildren) {
      const f = this.findNodeByType(c, type);
      if (f) return f;
    }
    return null;
  }

  // Rust

  private extractRustFunction(node: TreeSitterNode, source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    const modifiers: string[] = [];
    const text = source.substring(node.startIndex, node.endIndex);
    if (/\bpub\b/.test(text)) modifiers.push("pub");
    if (/\basync\b/.test(text)) modifiers.push("async");
    if (/\bconst\b/.test(text)) modifiers.push("const");
    const params: NonNullable<ParsedEntity["parameters"]> = [];
    const paramList = this.findNodeByType(node, "parameters") || this.findNodeByType(node, "parameter_list");
    if (paramList) {
      for (const p of paramList.namedChildren) {
        const pname = this.findNodeByType(p, "identifier")?.text;
        if (pname) params.push({ name: pname });
      }
    }
    return { name, type: "function", location: convertPosition(node), modifiers, parameters: params };
  }

  private extractRustStruct(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    return { name, type: "class", location: convertPosition(node), modifiers: ["struct"] };
  }

  private extractRustEnum(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    return { name, type: "type", location: convertPosition(node), modifiers: ["enum"] };
  }

  private extractRustTrait(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<anonymous>";
    return { name, type: "interface", location: convertPosition(node), modifiers: ["trait"] };
  }

  private extractRustImpl(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "type_identifier") || this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<impl>";
    return { name, type: "class", location: convertPosition(node), modifiers: ["impl"] };
  }

  private extractRustMod(node: TreeSitterNode, _source: string): ParsedEntity {
    const nameNode = this.findNodeByType(node, "identifier");
    const name = nameNode?.text || "<mod>";
    return { name, type: "type", location: convertPosition(node), modifiers: ["mod"] };
  }

  private extractRustUse(node: TreeSitterNode, _source: string): ParsedEntity {
    const firstPath =
      node.namedChildren.find((c) => c.type.includes("scoped_identifier") || c.type.includes("identifier")) || null;
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
        isDefault: false,
      },
    };
  }

  public clearCache(): void {
    for (const [, entry] of this.cache.entries()) {
      entry.tree = null;
    }
    this.cache.clear();
    this.parser?.reset?.();
  }

  public getStats() {
    const bytes = this.cache.calculatedSize || 0;
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheMemoryMB: Math.round(bytes / (1024 * 1024)),
    };
  }
}
