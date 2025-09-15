/**
 * TASK-001: Parser Agent Type Definitions
 * 
 * Type definitions for the tree-sitter based parser agent.
 * Provides interfaces for parsing, entity extraction, and incremental processing.
 * 
 * Architecture References:
 * - Agent Types: src/types/agent.ts
 * - Base Agent: src/agents/base.ts
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type { AgentTask } from './agent.js';

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
export const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'tsx', 'jsx'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS  
// =============================================================================

/**
 * Represents a parsed entity from the source code
 */
export interface ParsedEntity {
  /** Entity name (function name, class name, etc.) */
  name: string;
  
  /** Type of the entity */
  type: 'function' | 'class' | 'method' | 'interface' | 'type' | 'import' | 'export' | 'variable' | 'constant';
  
  /** Source location */
  location: {
    start: { line: number; column: number; index: number };
    end: { line: number; column: number; index: number };
  };
  
  /** Child entities (e.g., methods in a class) */
  children?: ParsedEntity[];
  
  /** References to other entities */
  references?: string[];
  
  /** Modifiers (e.g., async, static, private) */
  modifiers?: string[];
  
  /** Return type for functions/methods */
  returnType?: string;
  
  /** Parameters for functions/methods */
  parameters?: Array<{
    name: string;
    type?: string;
    optional?: boolean;
    defaultValue?: string;
  }>;
  
  /** Import/export specific data */
  importData?: {
    source: string;
    specifiers: Array<{ local: string; imported?: string }>;
    isDefault?: boolean;
    isNamespace?: boolean;
  };
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
  changeType: 'created' | 'modified' | 'deleted';
  
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
  type: 'parse:file' | 'parse:batch' | 'parse:incremental';
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