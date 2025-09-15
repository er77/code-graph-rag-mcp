/**
 * TASK-001: Language Configuration Module
 * 
 * Provides language-specific configurations for the parser.
 * Defines patterns, keywords, and extraction rules for each supported language.
 * 
 * Architecture References:
 * - Parser Types: src/types/parser.ts
 * - Tree-sitter Parser: src/parsers/tree-sitter-parser.ts
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type { SupportedLanguage } from '../types/parser.js';

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================

/**
 * File extensions mapped to languages
 */
export const FILE_EXTENSIONS: Record<string, SupportedLanguage> = {
  // JavaScript
  'js': 'javascript',
  'mjs': 'javascript',
  'cjs': 'javascript',
  
  // TypeScript
  'ts': 'typescript',
  'mts': 'typescript',
  'cts': 'typescript',
  
  // JSX/TSX
  'jsx': 'jsx',
  'tsx': 'tsx'
};

/**
 * Language-specific keywords for entity detection
 */
export const LANGUAGE_KEYWORDS: Record<SupportedLanguage, {
  functions: string[];
  classes: string[];
  imports: string[];
  exports: string[];
  types: string[];
}> = {
  javascript: {
    functions: ['function', 'async', 'generator', '=>'],
    classes: ['class', 'constructor', 'extends'],
    imports: ['import', 'require'],
    exports: ['export', 'module.exports'],
    types: []
  },
  
  typescript: {
    functions: ['function', 'async', 'generator', '=>'],
    classes: ['class', 'constructor', 'extends', 'implements'],
    imports: ['import', 'require'],
    exports: ['export', 'module.exports'],
    types: ['interface', 'type', 'enum', 'namespace']
  },
  
  jsx: {
    functions: ['function', 'async', 'generator', '=>'],
    classes: ['class', 'constructor', 'extends', 'Component'],
    imports: ['import', 'require'],
    exports: ['export', 'module.exports'],
    types: []
  },
  
  tsx: {
    functions: ['function', 'async', 'generator', '=>'],
    classes: ['class', 'constructor', 'extends', 'implements', 'Component'],
    imports: ['import', 'require'],
    exports: ['export', 'module.exports'],
    types: ['interface', 'type', 'enum', 'namespace']
  }
};

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================

/**
 * Language configuration for parsing
 */
export interface LanguageConfig {
  language: SupportedLanguage;
  extensions: string[];
  keywords: typeof LANGUAGE_KEYWORDS[SupportedLanguage];
  nodeTypes: NodeTypeConfig;
  extractors: ExtractorConfig;
}

/**
 * Tree-sitter node types for each language construct
 */
export interface NodeTypeConfig {
  functions: string[];
  classes: string[];
  methods: string[];
  imports: string[];
  exports: string[];
  variables: string[];
  types: string[];
  interfaces: string[];
}

/**
 * Extraction patterns and rules
 */
export interface ExtractorConfig {
  extractName: (nodeType: string) => string[];
  extractModifiers: (nodeType: string) => string[];
  extractParameters: boolean;
  extractReturnType: boolean;
  extractReferences: boolean;
}

// =============================================================================
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================

/**
 * Detect language from file path
 */
export function detectLanguageFromPath(filePath: string): SupportedLanguage {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return FILE_EXTENSIONS[ext || ''] || 'javascript';
}

/**
 * Check if file is supported
 */
export function isFileSupported(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext ? ext in FILE_EXTENSIONS : false;
}

/**
 * Get all supported extensions
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(FILE_EXTENSIONS);
}

// =============================================================================
// 5. CORE BUSINESS LOGIC
// =============================================================================

/**
 * JavaScript/JSX configuration
 */
const JAVASCRIPT_CONFIG: LanguageConfig = {
  language: 'javascript',
  extensions: ['js', 'mjs', 'cjs'],
  keywords: LANGUAGE_KEYWORDS.javascript,
  nodeTypes: {
    functions: [
      'function_declaration',
      'function_expression',
      'arrow_function',
      'generator_function',
      'generator_function_declaration'
    ],
    classes: [
      'class_declaration',
      'class_expression'
    ],
    methods: [
      'method_definition',
      'public_field_definition'
    ],
    imports: [
      'import_statement',
      'import_declaration',
      'call_expression' // for require()
    ],
    exports: [
      'export_statement',
      'export_declaration',
      'export_default_declaration',
      'export_specifier'
    ],
    variables: [
      'variable_declaration',
      'lexical_declaration',
      'variable_declarator'
    ],
    types: [],
    interfaces: []
  },
  extractors: {
    extractName: (nodeType: string) => {
      // Define which child node types contain the name
      switch (nodeType) {
        case 'function_declaration':
        case 'class_declaration':
          return ['identifier'];
        case 'method_definition':
          return ['property_identifier', 'identifier'];
        case 'variable_declarator':
          return ['identifier', 'object_pattern', 'array_pattern'];
        default:
          return ['identifier'];
      }
    },
    extractModifiers: (_nodeType: string) => {
      // Define which modifiers to look for
      return ['async', 'static', 'get', 'set', 'private', 'protected', 'public'];
    },
    extractParameters: true,
    extractReturnType: false,
    extractReferences: true
  }
};

/**
 * TypeScript/TSX configuration
 */
const TYPESCRIPT_CONFIG: LanguageConfig = {
  language: 'typescript',
  extensions: ['ts', 'mts', 'cts'],
  keywords: LANGUAGE_KEYWORDS.typescript,
  nodeTypes: {
    functions: [
      'function_declaration',
      'function_expression',
      'arrow_function',
      'generator_function',
      'generator_function_declaration',
      'function_signature'
    ],
    classes: [
      'class_declaration',
      'class_expression',
      'abstract_class_declaration'
    ],
    methods: [
      'method_definition',
      'method_signature',
      'public_field_definition',
      'abstract_method_signature'
    ],
    imports: [
      'import_statement',
      'import_declaration',
      'import_alias',
      'call_expression' // for require()
    ],
    exports: [
      'export_statement',
      'export_declaration',
      'export_default_declaration',
      'export_specifier',
      'export_assignment'
    ],
    variables: [
      'variable_declaration',
      'lexical_declaration',
      'variable_declarator',
      'const_declaration'
    ],
    types: [
      'type_alias_declaration',
      'enum_declaration',
      'namespace_declaration'
    ],
    interfaces: [
      'interface_declaration',
      'interface_body'
    ]
  },
  extractors: {
    extractName: (nodeType: string) => {
      switch (nodeType) {
        case 'function_declaration':
        case 'class_declaration':
        case 'interface_declaration':
        case 'type_alias_declaration':
        case 'enum_declaration':
          return ['identifier', 'type_identifier'];
        case 'method_definition':
        case 'method_signature':
          return ['property_identifier', 'identifier'];
        case 'variable_declarator':
          return ['identifier', 'object_pattern', 'array_pattern'];
        default:
          return ['identifier', 'type_identifier'];
      }
    },
    extractModifiers: (_nodeType: string) => {
      return [
        'async', 'static', 'get', 'set',
        'private', 'protected', 'public',
        'readonly', 'abstract', 'override'
      ];
    },
    extractParameters: true,
    extractReturnType: true,
    extractReferences: true
  }
};

/**
 * JSX configuration (extends JavaScript)
 */
const JSX_CONFIG: LanguageConfig = {
  ...JAVASCRIPT_CONFIG,
  language: 'jsx',
  extensions: ['jsx'],
  keywords: LANGUAGE_KEYWORDS.jsx,
  nodeTypes: {
    ...JAVASCRIPT_CONFIG.nodeTypes,
    functions: [
      ...JAVASCRIPT_CONFIG.nodeTypes.functions,
      'jsx_element',
      'jsx_self_closing_element'
    ]
  }
};

/**
 * TSX configuration (extends TypeScript)
 */
const TSX_CONFIG: LanguageConfig = {
  ...TYPESCRIPT_CONFIG,
  language: 'tsx',
  extensions: ['tsx'],
  keywords: LANGUAGE_KEYWORDS.tsx,
  nodeTypes: {
    ...TYPESCRIPT_CONFIG.nodeTypes,
    functions: [
      ...TYPESCRIPT_CONFIG.nodeTypes.functions,
      'jsx_element',
      'jsx_self_closing_element'
    ]
  }
};

// =============================================================================
// 6. API ENDPOINTS AND ROUTES
// =============================================================================

/**
 * Language configuration registry
 */
export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  javascript: JAVASCRIPT_CONFIG,
  typescript: TYPESCRIPT_CONFIG,
  jsx: JSX_CONFIG,
  tsx: TSX_CONFIG
};

/**
 * Get configuration for a language
 */
export function getLanguageConfig(language: SupportedLanguage): LanguageConfig {
  return LANGUAGE_CONFIGS[language];
}

/**
 * Get configuration for a file
 */
export function getFileConfig(filePath: string): LanguageConfig {
  const language = detectLanguageFromPath(filePath);
  return getLanguageConfig(language);
}

/**
 * Check if a node type represents a function
 */
export function isFunctionNode(nodeType: string, language: SupportedLanguage): boolean {
  const config = getLanguageConfig(language);
  return config.nodeTypes.functions.includes(nodeType);
}

/**
 * Check if a node type represents a class
 */
export function isClassNode(nodeType: string, language: SupportedLanguage): boolean {
  const config = getLanguageConfig(language);
  return config.nodeTypes.classes.includes(nodeType);
}

/**
 * Check if a node type represents an import
 */
export function isImportNode(nodeType: string, language: SupportedLanguage): boolean {
  const config = getLanguageConfig(language);
  return config.nodeTypes.imports.includes(nodeType);
}

/**
 * Check if a node type represents an export
 */
export function isExportNode(nodeType: string, language: SupportedLanguage): boolean {
  const config = getLanguageConfig(language);
  return config.nodeTypes.exports.includes(nodeType);
}

/**
 * Check if a node type represents a type definition
 */
export function isTypeNode(nodeType: string, language: SupportedLanguage): boolean {
  const config = getLanguageConfig(language);
  return config.nodeTypes.types.includes(nodeType) || 
         config.nodeTypes.interfaces.includes(nodeType);
}

// =============================================================================
// 7. INITIALIZATION AND STARTUP
// =============================================================================

/**
 * Validate language configurations on startup
 */
export function validateConfigurations(): boolean {
  console.log('[LanguageConfig] Validating configurations...');
  
  for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
    if (!config.language || !config.extensions.length) {
      console.error(`[LanguageConfig] Invalid configuration for ${lang}`);
      return false;
    }
  }
  
  console.log('[LanguageConfig] All configurations valid');
  return true;
}