/**
 * TASK-003B: Enhanced Language Configuration Module
 *
 * Provides language-specific configurations for the parser.
 * Defines patterns, keywords, and extraction rules for each supported language.
 * Enhanced for TASK-003B with advanced Python language support across 4 layers.
 *
 * Architecture References:
 * - Enhanced Parser Types: src/types/parser.ts
 * - Tree-sitter Parser: src/parsers/tree-sitter-parser.ts
 * - Python Analyzer: src/parsers/python-analyzer.ts
 * - ADR-005: Enhanced Python Type System and Magic Methods
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import type { SupportedLanguage } from "../types/parser.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================

/**
 * File extensions mapped to languages
 */
export const FILE_EXTENSIONS: Record<string, SupportedLanguage> = {
  // JavaScript
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",

  // TypeScript
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",

  // JSX/TSX
  jsx: "jsx",
  tsx: "tsx",

  // Python
  py: "python",
  pyi: "python",
  pyw: "python",

  // C
  c: "c",
  h: "c",

  // C++
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  C: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  hh: "cpp",

  // C#
  cs: "csharp",

  // Rust
  rs: "rust",

  // Go
  go: "go",
  mod: "go",

  // Java
  java: "java",

  // Kotlin
  kt: "kotlin",
  kts: "kotlin",

  // VBA
  vba: "vba",
  bas: "vba",
  cls: "vba",
  frm: "vba",
};

/**
 * Language-specific keywords for entity detection
 */
export const LANGUAGE_KEYWORDS: Record<
  SupportedLanguage,
  {
    functions: string[];
    classes: string[];
    imports: string[];
    exports: string[];
    types: string[];
  }
> = {
  javascript: {
    functions: ["function", "async", "generator", "=>"],
    classes: ["class", "constructor", "extends"],
    imports: ["import", "require"],
    exports: ["export", "module.exports"],
    types: [],
  },

  typescript: {
    functions: ["function", "async", "generator", "=>"],
    classes: ["class", "constructor", "extends", "implements"],
    imports: ["import", "require"],
    exports: ["export", "module.exports"],
    types: ["interface", "type", "enum", "namespace"],
  },

  jsx: {
    functions: ["function", "async", "generator", "=>"],
    classes: ["class", "constructor", "extends", "Component"],
    imports: ["import", "require"],
    exports: ["export", "module.exports"],
    types: [],
  },

  tsx: {
    functions: ["function", "async", "generator", "=>"],
    classes: ["class", "constructor", "extends", "implements", "Component"],
    imports: ["import", "require"],
    exports: ["export", "module.exports"],
    types: ["interface", "type", "enum", "namespace"],
  },

  python: {
    functions: ["def", "async", "lambda", "yield", "yield_from", "await"],
    classes: ["class", "dataclass", "NamedTuple", "Enum", "Protocol", "ABC"],
    imports: ["import", "from", "as", "__import__"],
    exports: ["__all__", "__version__", "__author__"],
    types: [
      "typing",
      "Union",
      "Optional",
      "List",
      "Dict",
      "Tuple",
      "Generic",
      "TypeVar",
      "Callable",
      "Any",
      "ClassVar",
      "Final",
    ],
  },

  c: {
    functions: ["function", "static", "inline", "extern"],
    classes: ["struct", "union", "enum"],
    imports: ["include", "import"],
    exports: ["extern", "static"],
    types: ["typedef", "const", "volatile", "register", "auto"],
  },

  cpp: {
    functions: ["function", "static", "inline", "extern", "virtual", "override", "final", "constexpr", "consteval"],
    classes: ["class", "struct", "union", "enum", "namespace", "template"],
    imports: ["include", "import", "using"],
    exports: ["extern", "static", "export"],
    types: ["typedef", "using", "const", "volatile", "mutable", "constexpr", "consteval", "auto", "decltype"],
  },

  rust: {
    functions: ["fn", "async", "const"],
    classes: ["struct", "enum", "trait", "impl", "mod"],
    imports: ["use", "extern", "crate"],
    exports: ["pub"],
    types: ["type"],
  },

  csharp: {
    functions: [
      "void",
      "public",
      "private",
      "protected",
      "internal",
      "static",
      "virtual",
      "override",
      "abstract",
      "async",
    ],
    classes: ["class", "struct", "interface", "enum", "record"],
    imports: ["using"],
    exports: ["public", "internal", "protected"],
    types: ["int", "long", "double", "float", "bool", "string", "object", "var", "dynamic"],
  },

  go: {
    functions: ["func"],
    classes: ["type", "struct", "interface"],
    imports: ["import"],
    exports: [], // Go uses capitalization for exports
    types: ["type", "interface", "struct"],
  },

  java: {
    functions: ["void", "public", "private", "protected", "static", "final"],
    classes: ["class", "interface", "enum", "record", "@interface"],
    imports: ["import"],
    exports: ["public", "protected"],
    types: ["int", "long", "double", "float", "char", "boolean", "String", "void"],
  },

  kotlin: {
    functions: [
      "fun",
      "suspend",
      "inline",
      "infix",
      "operator",
      "tailrec",
      "external",
      "crossinline",
      "noinline",
      "reified",
    ],
    classes: [
      "class",
      "interface",
      "object",
      "companion",
      "data",
      "sealed",
      "enum",
      "annotation",
      "inner",
      "value",
      "open",
      "abstract",
      "final",
    ],
    imports: ["import", "as"],
    exports: ["public", "internal", "protected", "private"],
    types: [
      "typealias",
      "Int",
      "Long",
      "Double",
      "Float",
      "Char",
      "Boolean",
      "String",
      "Unit",
      "Any",
      "Nothing",
      "Array",
      "List",
      "Map",
      "Set",
    ],
  },

  vba: {
    functions: ["Sub", "Function", "Property"],
    classes: ["Class", "Type", "Enum"],
    imports: [],
    exports: ["Public", "Global"],
    types: ["Integer", "Long", "Double", "Single", "String", "Boolean", "Variant", "Object", "Date"],
  },
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
  keywords: (typeof LANGUAGE_KEYWORDS)[SupportedLanguage];
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
  const ext = filePath.split(".").pop()?.toLowerCase();

  // Handle special cases for C vs C++
  if (ext === "h") {
    // Check if it's a C++ header by looking for C++ indicators in the path
    if (filePath.includes("++") || filePath.includes("cpp") || filePath.includes("cxx")) {
      return "cpp";
    }
    return "c";
  }

  if (ext === "C") {
    return "cpp"; // Capital C is typically C++
  }

  return FILE_EXTENSIONS[ext || ""] || "javascript";
}

/**
 * Check if file is supported
 */
export function isFileSupported(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase();
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
  language: "javascript",
  extensions: ["js", "mjs", "cjs"],
  keywords: LANGUAGE_KEYWORDS.javascript,
  nodeTypes: {
    functions: [
      "function_declaration",
      "function_expression",
      "arrow_function",
      "generator_function",
      "generator_function_declaration",
    ],
    classes: ["class_declaration", "class_expression"],
    methods: ["method_definition", "public_field_definition"],
    imports: [
      "import_statement",
      "import_declaration",
      "call_expression", // for require()
    ],
    exports: ["export_statement", "export_declaration", "export_default_declaration", "export_specifier"],
    variables: ["variable_declaration", "lexical_declaration", "variable_declarator"],
    types: [],
    interfaces: [],
  },
  extractors: {
    extractName: (nodeType: string) => {
      // Define which child node types contain the name
      switch (nodeType) {
        case "function_declaration":
        case "class_declaration":
          return ["identifier"];
        case "method_definition":
          return ["property_identifier", "identifier"];
        case "variable_declarator":
          return ["identifier", "object_pattern", "array_pattern"];
        default:
          return ["identifier"];
      }
    },
    extractModifiers: (_nodeType: string) => {
      // Define which modifiers to look for
      return ["async", "static", "get", "set", "private", "protected", "public"];
    },
    extractParameters: true,
    extractReturnType: false,
    extractReferences: true,
  },
};

/**
 * TypeScript/TSX configuration
 */
const TYPESCRIPT_CONFIG: LanguageConfig = {
  language: "typescript",
  extensions: ["ts", "mts", "cts"],
  keywords: LANGUAGE_KEYWORDS.typescript,
  nodeTypes: {
    functions: [
      "function_declaration",
      "function_expression",
      "arrow_function",
      "generator_function",
      "generator_function_declaration",
      "function_signature",
    ],
    classes: ["class_declaration", "class_expression", "abstract_class_declaration"],
    methods: ["method_definition", "method_signature", "public_field_definition", "abstract_method_signature"],
    imports: [
      "import_statement",
      "import_declaration",
      "import_alias",
      "call_expression", // for require()
    ],
    exports: [
      "export_statement",
      "export_declaration",
      "export_default_declaration",
      "export_specifier",
      "export_assignment",
    ],
    variables: ["variable_declaration", "lexical_declaration", "variable_declarator", "const_declaration"],
    types: ["type_alias_declaration", "enum_declaration", "namespace_declaration"],
    interfaces: ["interface_declaration", "interface_body"],
  },
  extractors: {
    extractName: (nodeType: string) => {
      switch (nodeType) {
        case "function_declaration":
        case "class_declaration":
        case "interface_declaration":
        case "type_alias_declaration":
        case "enum_declaration":
          return ["identifier", "type_identifier"];
        case "method_definition":
        case "method_signature":
          return ["property_identifier", "identifier"];
        case "variable_declarator":
          return ["identifier", "object_pattern", "array_pattern"];
        default:
          return ["identifier", "type_identifier"];
      }
    },
    extractModifiers: (_nodeType: string) => {
      return ["async", "static", "get", "set", "private", "protected", "public", "readonly", "abstract", "override"];
    },
    extractParameters: true,
    extractReturnType: true,
    extractReferences: true,
  },
};

/**
 * JSX configuration (extends JavaScript)
 */
const JSX_CONFIG: LanguageConfig = {
  ...JAVASCRIPT_CONFIG,
  language: "jsx",
  extensions: ["jsx"],
  keywords: LANGUAGE_KEYWORDS.jsx,
  nodeTypes: {
    ...JAVASCRIPT_CONFIG.nodeTypes,
    functions: [...JAVASCRIPT_CONFIG.nodeTypes.functions, "jsx_element", "jsx_self_closing_element"],
  },
};

/**
 * TSX configuration (extends TypeScript)
 */
const TSX_CONFIG: LanguageConfig = {
  ...TYPESCRIPT_CONFIG,
  language: "tsx",
  extensions: ["tsx"],
  keywords: LANGUAGE_KEYWORDS.tsx,
  nodeTypes: {
    ...TYPESCRIPT_CONFIG.nodeTypes,
    functions: [...TYPESCRIPT_CONFIG.nodeTypes.functions, "jsx_element", "jsx_self_closing_element"],
  },
};

/**
 * Enhanced Python configuration - TASK-003B 4-Layer Architecture Support
 */
const PYTHON_CONFIG: LanguageConfig = {
  language: "python",
  extensions: ["py", "pyi", "pyw"],
  keywords: LANGUAGE_KEYWORDS.python,
  nodeTypes: {
    // Layer 1: Enhanced Basic Parsing - Comprehensive function types
    functions: [
      "function_definition",
      "async_function_definition",
      "lambda",
      "generator_expression",
      "list_comprehension",
      "set_comprehension",
      "dictionary_comprehension",
    ],
    // Layer 1: Enhanced class types including special classes
    classes: [
      "class_definition",
      "decorated_definition", // for @dataclass and other decorated classes
    ],
    // Layer 1: Comprehensive method types with decorators
    methods: [
      "function_definition", // methods are function_definition inside class_definition
      "decorated_definition", // decorated methods (@property, @staticmethod, etc.)
      "property_definition", // property definitions
    ],
    // Layer 1: Enhanced import patterns
    imports: [
      "import_statement",
      "import_from_statement",
      "aliased_import",
      "dotted_name",
      "relative_import",
      "import_list",
      "wildcard_import",
    ],
    // Layer 1: Export patterns
    exports: [
      "expression_statement", // for __all__ assignments
      "assignment", // module-level assignments that act as exports
      "augmented_assignment",
    ],
    // Layer 1: Variable and assignment patterns
    variables: [
      "assignment",
      "augmented_assignment",
      "annotated_assignment",
      "named_expression", // walrus operator :=
      "pattern_list",
      "tuple_pattern",
      "list_pattern",
    ],
    // Layer 1: Type definitions and annotations
    types: [
      "type_alias_statement",
      "generic_type",
      "union_type",
      "subscript", // for List[int], Dict[str, Any], etc.
      "attribute", // for module.TypeName
      "type_parameter",
    ],
    // Layer 2: Protocol support for structural subtyping
    interfaces: [
      "class_definition", // protocols are classes with typing.Protocol base
    ],
  },
  extractors: {
    extractName: (nodeType: string) => {
      switch (nodeType) {
        // Layer 1: Enhanced function name extraction
        case "function_definition":
        case "async_function_definition":
          return ["identifier"];
        case "lambda":
          return ["lambda"]; // special case - lambdas don't have names

        // Layer 1: Enhanced class name extraction
        case "class_definition":
          return ["identifier"];
        case "decorated_definition":
          return ["identifier"]; // extract from the underlying definition

        // Layer 1: Enhanced import name extraction
        case "import_statement":
          return ["dotted_name", "identifier"];
        case "import_from_statement":
          return ["import_list", "identifier", "aliased_import"];
        case "aliased_import":
          return ["identifier"]; // both original and alias
        case "wildcard_import":
          return ["*"];

        // Layer 1: Enhanced variable/assignment name extraction
        case "assignment":
        case "augmented_assignment":
        case "annotated_assignment":
          return ["identifier", "pattern_list", "tuple_pattern", "subscript", "attribute"];
        case "named_expression": // walrus operator
          return ["identifier"];

        // Layer 1: Type hint name extraction
        case "type_alias_statement":
          return ["identifier"];
        case "generic_type":
        case "subscript":
          return ["identifier", "attribute"];
        case "union_type":
          return ["identifier"]; // extract all union members

        // Layer 2: Comprehension name extraction
        case "list_comprehension":
        case "set_comprehension":
        case "dictionary_comprehension":
        case "generator_expression":
          return ["identifier"]; // iterator variables

        default:
          return ["identifier"];
      }
    },
    extractModifiers: (nodeType: string) => {
      // Layer 1 & 2: Enhanced modifier extraction for Python
      const baseModifiers = ["async", "staticmethod", "classmethod", "property"];

      switch (nodeType) {
        case "function_definition":
        case "async_function_definition":
          return [
            ...baseModifiers,
            "abstractmethod",
            "cached_property",
            "lru_cache",
            "singledispatch",
            "contextmanager",
            "asynccontextmanager",
            "wraps",
            "dataclass",
            "final",
            "overload",
          ];

        case "class_definition":
          return ["dataclass", "final", "runtime_checkable", "total", "frozen", "eq", "order", "unsafe_hash", "init"];

        case "decorated_definition":
          // Extract from actual decorators
          return [...baseModifiers, "dataclass", "final", "overload", "abstractmethod", "cached_property"];

        default:
          return baseModifiers;
      }
    },
    extractParameters: true,
    extractReturnType: true, // Python has comprehensive type hints
    extractReferences: true,
  },
};

// =============================================================================
// 6. API ENDPOINTS AND ROUTES
// =============================================================================

/**
 * C language configuration
 */
const C_CONFIG: LanguageConfig = {
  language: "c",
  extensions: ["c", "h"],
  keywords: LANGUAGE_KEYWORDS.c,
  nodeTypes: {
    functions: ["function_definition", "function_declarator", "pointer_declarator"],
    classes: ["struct_specifier", "union_specifier", "enum_specifier"],
    methods: [],
    imports: ["preproc_include", "preproc_def", "preproc_call"],
    exports: ["function_definition", "declaration"],
    variables: ["declaration", "parameter_declaration", "init_declarator"],
    types: [
      "type_definition",
      "primitive_type",
      "sized_type_specifier",
      "struct_specifier",
      "union_specifier",
      "enum_specifier",
    ],
    interfaces: [],
  },
  extractors: {
    extractName: (nodeType: string) => {
      switch (nodeType) {
        case "function_definition":
        case "function_declarator":
          return ["identifier"];
        case "struct_specifier":
        case "union_specifier":
        case "enum_specifier":
          return ["type_identifier", "identifier"];
        case "declaration":
        case "parameter_declaration":
          return ["identifier"];
        case "preproc_include":
          return ["string_literal", "system_lib_string"];
        case "preproc_def":
          return ["identifier"];
        default:
          return ["identifier"];
      }
    },
    extractModifiers: (nodeType: string) => {
      switch (nodeType) {
        case "function_definition":
          return ["static", "inline", "extern"];
        case "declaration":
          return ["static", "extern", "const", "volatile", "register"];
        case "struct_specifier":
        case "union_specifier":
          return ["static", "extern"];
        default:
          return ["static", "extern", "const", "volatile"];
      }
    },
    extractParameters: true,
    extractReturnType: true,
    extractReferences: true,
  },
};

/**
 * C++ language configuration
 */
const CPP_CONFIG: LanguageConfig = {
  language: "cpp",
  extensions: ["cpp", "cxx", "cc", "C", "hpp", "hxx", "hh"],
  keywords: LANGUAGE_KEYWORDS.cpp,
  nodeTypes: {
    functions: ["function_definition", "function_declarator", "template_function", "template_declaration"],
    classes: ["class_specifier", "struct_specifier", "union_specifier", "enum_specifier", "template_declaration"],
    methods: [
      "function_definition", // methods inside classes
      "field_declaration",
    ],
    imports: ["preproc_include", "using_declaration", "namespace_alias_definition"],
    exports: ["function_definition", "declaration", "template_declaration"],
    variables: ["declaration", "parameter_declaration", "init_declarator", "field_declaration"],
    types: [
      "type_definition",
      "primitive_type",
      "sized_type_specifier",
      "class_specifier",
      "struct_specifier",
      "union_specifier",
      "enum_specifier",
      "template_declaration",
      "auto",
    ],
    interfaces: [
      "class_specifier", // C++ classes can act as interfaces
    ],
  },
  extractors: {
    extractName: (nodeType: string) => {
      switch (nodeType) {
        case "function_definition":
        case "function_declarator":
        case "template_function":
          return ["identifier", "qualified_identifier"];
        case "class_specifier":
        case "struct_specifier":
        case "union_specifier":
        case "enum_specifier":
          return ["type_identifier", "identifier"];
        case "template_declaration":
          return ["type_identifier", "identifier", "template_type"];
        case "namespace_definition":
          return ["identifier"];
        case "using_declaration":
          return ["qualified_identifier", "identifier"];
        case "declaration":
        case "parameter_declaration":
        case "field_declaration":
          return ["identifier", "field_identifier"];
        default:
          return ["identifier", "type_identifier"];
      }
    },
    extractModifiers: (nodeType: string) => {
      switch (nodeType) {
        case "function_definition":
          return ["static", "inline", "extern", "virtual", "override", "final", "constexpr", "consteval"];
        case "class_specifier":
        case "struct_specifier":
          return ["final", "abstract"];
        case "field_declaration":
          return ["static", "const", "mutable", "constexpr"];
        case "declaration":
          return ["static", "extern", "const", "volatile", "mutable", "constexpr", "consteval"];
        default:
          return ["static", "extern", "const", "volatile", "virtual", "override", "final"];
      }
    },
    extractParameters: true,
    extractReturnType: true,
    extractReferences: true,
  },
};

/**
 * Rust language configuration
 */
const RUST_CONFIG: LanguageConfig = {
  language: "rust",
  extensions: ["rs"],
  keywords: LANGUAGE_KEYWORDS.rust,
  nodeTypes: {
    functions: [
      "function_item",
      "function_signature_item",
      "async_function_item",
      "const_function_item",
      "closure_expression",
    ],
    classes: ["struct_item", "enum_item", "trait_item", "impl_item", "mod_item", "union_item"],
    methods: [
      "function_item", // methods inside impl blocks
      "associated_type",
      "method_signature_item",
    ],
    imports: ["use_declaration", "extern_crate_declaration", "use_list", "use_as_clause", "use_wildcard"],
    exports: [
      "visibility_modifier", // pub keyword
      "pub_visibility_modifier",
      "crate_visibility_modifier",
    ],
    variables: ["let_declaration", "const_item", "static_item", "let_expression", "ref_pattern", "mut_pattern"],
    types: [
      "type_alias",
      "generic_type",
      "reference_type",
      "pointer_type",
      "array_type",
      "tuple_type",
      "function_type",
      "type_parameters",
      "where_clause",
      "trait_bounds",
    ],
    interfaces: [
      "trait_item", // Rust traits are similar to interfaces
    ],
  },
  extractors: {
    extractName: (nodeType: string) => {
      switch (nodeType) {
        case "function_item":
        case "async_function_item":
        case "const_function_item":
          return ["identifier"];
        case "struct_item":
        case "enum_item":
        case "trait_item":
        case "mod_item":
        case "union_item":
          return ["type_identifier", "identifier"];
        case "impl_item":
          return ["type_identifier"];
        case "use_declaration":
          return ["identifier", "scoped_identifier"];
        case "use_as_clause":
          return ["identifier", "alias"];
        case "let_declaration":
        case "const_item":
        case "static_item":
          return ["identifier", "pattern"];
        case "type_alias":
          return ["type_identifier"];
        case "closure_expression":
          return []; // Closures are anonymous
        default:
          return ["identifier", "type_identifier"];
      }
    },
    extractModifiers: (nodeType: string) => {
      switch (nodeType) {
        case "function_item":
        case "async_function_item":
        case "const_function_item":
          return ["pub", "async", "const", "unsafe", "extern"];
        case "struct_item":
        case "enum_item":
        case "trait_item":
          return ["pub", "pub(crate)", "pub(super)", "pub(self)"];
        case "impl_item":
          return ["unsafe"];
        case "let_declaration":
          return ["mut", "ref"];
        case "const_item":
        case "static_item":
          return ["pub", "mut", "unsafe"];
        default:
          return ["pub", "mut", "const", "unsafe"];
      }
    },
    extractParameters: true,
    extractReturnType: true,
    extractReferences: true,
  },
};

/**
 * C# language configuration
 */
const CSHARP_CONFIG: LanguageConfig = {
  language: "csharp",
  extensions: ["cs"],
  keywords: LANGUAGE_KEYWORDS.csharp,
  nodeTypes: {
    functions: ["method_declaration", "constructor_declaration", "destructor_declaration", "local_function_statement"],
    classes: [
      "class_declaration",
      "struct_declaration",
      "interface_declaration",
      "enum_declaration",
      "record_declaration",
    ],
    methods: ["method_declaration", "property_declaration", "indexer_declaration", "event_declaration"],
    imports: ["using_directive", "namespace_declaration"],
    exports: ["public", "internal", "protected"],
    variables: ["field_declaration", "local_declaration_statement", "variable_declarator"],
    types: ["type_declaration", "generic_name", "nullable_type", "array_type"],
    interfaces: ["interface_declaration"],
  },
  extractors: {
    extractName: (nodeType: string) => {
      switch (nodeType) {
        case "method_declaration":
        case "constructor_declaration":
        case "destructor_declaration":
        case "local_function_statement":
          return ["identifier"];
        case "class_declaration":
        case "struct_declaration":
        case "interface_declaration":
        case "enum_declaration":
        case "record_declaration":
          return ["identifier"];
        case "property_declaration":
        case "field_declaration":
          return ["identifier"];
        case "using_directive":
          return ["identifier", "qualified_name"];
        default:
          return ["identifier"];
      }
    },
    extractModifiers: (nodeType: string) => {
      switch (nodeType) {
        case "method_declaration":
        case "constructor_declaration":
          return [
            "public",
            "private",
            "protected",
            "internal",
            "static",
            "virtual",
            "override",
            "abstract",
            "sealed",
            "async",
          ];
        case "class_declaration":
        case "struct_declaration":
          return ["public", "private", "protected", "internal", "static", "abstract", "sealed", "partial"];
        case "field_declaration":
          return ["public", "private", "protected", "internal", "static", "readonly", "const", "volatile"];
        default:
          return ["public", "private", "protected", "internal", "static"];
      }
    },
    extractParameters: true,
    extractReturnType: true,
    extractReferences: true,
  },
};

/**
 * Go language configuration
 */
const GO_CONFIG: LanguageConfig = {
  language: "go",
  extensions: ["go", "mod"],
  keywords: LANGUAGE_KEYWORDS.go,
  nodeTypes: {
    functions: ["function_declaration", "method_declaration", "func_literal"],
    classes: ["type_declaration", "type_spec", "struct_type", "interface_type"],
    methods: ["method_declaration"],
    imports: ["import_spec", "import_declaration"],
    exports: [], // Go uses capitalization for exports
    variables: ["short_var_declaration", "var_spec", "assignment_statement", "expression_statement"],
    types: ["type_declaration", "type_spec", "array_type", "slice_type", "map_type", "channel_type"],
    interfaces: ["interface_type"],
  },
  extractors: {
    extractName: (nodeType: string) => {
      switch (nodeType) {
        case "function_declaration":
        case "method_declaration":
          return ["identifier"];
        case "type_declaration":
        case "type_spec":
          return ["identifier"];
        case "struct_type":
          return ["type_identifier", "identifier"];
        case "interface_type":
          return ["type_identifier", "identifier"];
        case "import_spec":
          return ["import_path", "identifier"];
        case "short_var_declaration":
        case "var_spec":
          return ["identifier", "expression_list"];
        default:
          return ["identifier"];
      }
    },
    extractModifiers: (nodeType: string) => {
      switch (nodeType) {
        case "function_declaration":
        case "method_declaration":
          return ["func"];
        case "type_declaration":
        case "type_spec":
          return ["type"];
        default:
          return [];
      }
    },
    extractParameters: true,
    extractReturnType: true,
    extractReferences: true,
  },
};

/**
 * Java language configuration
 */
const JAVA_CONFIG: LanguageConfig = {
  language: "java",
  extensions: ["java"],
  keywords: LANGUAGE_KEYWORDS.java,
  nodeTypes: {
    functions: ["method_declaration", "constructor_declaration"],
    classes: [
      "class_declaration",
      "interface_declaration",
      "enum_declaration",
      "record_declaration",
      "annotation_type_declaration",
    ],
    methods: ["method_declaration", "constructor_declaration"],
    imports: ["import_declaration"],
    exports: ["public", "protected"],
    variables: ["field_declaration", "local_variable_declaration", "variable_declarator"],
    types: ["type_identifier", "generic_type", "array_type"],
    interfaces: ["interface_declaration"],
  },
  extractors: {
    extractName: (nodeType: string) => {
      switch (nodeType) {
        case "method_declaration":
        case "constructor_declaration":
          return ["identifier"];
        case "class_declaration":
        case "interface_declaration":
        case "enum_declaration":
        case "record_declaration":
        case "annotation_type_declaration":
          return ["identifier"];
        case "field_declaration":
        case "local_variable_declaration":
          return ["identifier", "variable_declarator"];
        case "import_declaration":
          return ["scoped_identifier", "identifier"];
        default:
          return ["identifier"];
      }
    },
    extractModifiers: (nodeType: string) => {
      switch (nodeType) {
        case "method_declaration":
        case "constructor_declaration":
          return [
            "public",
            "private",
            "protected",
            "static",
            "final",
            "abstract",
            "synchronized",
            "native",
            "strictfp",
          ];
        case "class_declaration":
        case "interface_declaration":
        case "enum_declaration":
        case "record_declaration":
          return ["public", "private", "protected", "static", "final", "abstract", "strictfp"];
        case "field_declaration":
          return ["public", "private", "protected", "static", "final", "transient", "volatile"];
        default:
          return ["public", "private", "protected", "static", "final"];
      }
    },
    extractParameters: true,
    extractReturnType: true,
    extractReferences: true,
  },
};

/**
 * Kotlin language configuration - Comprehensive support for Kotlin features
 */
const KOTLIN_CONFIG: LanguageConfig = {
  language: "kotlin",
  extensions: ["kt", "kts"],
  keywords: LANGUAGE_KEYWORDS.kotlin,
  nodeTypes: {
    functions: ["function_declaration", "anonymous_function", "lambda_literal", "getter", "setter"],
    classes: ["class_declaration", "object_declaration", "companion_object", "enum_entry"],
    methods: ["function_declaration", "anonymous_function", "getter", "setter", "secondary_constructor"],
    imports: ["import_header", "import_list"],
    exports: [], // Kotlin uses visibility modifiers, not exports
    variables: ["property_declaration", "variable_declaration", "multi_variable_declaration", "class_parameter"],
    types: ["type_alias", "user_type", "function_type", "nullable_type", "type_parameters", "type_constraints"],
    interfaces: ["class_declaration"], // Interfaces use class_declaration with interface keyword
  },
  extractors: {
    extractName: (nodeType: string) => {
      switch (nodeType) {
        case "function_declaration":
        case "anonymous_function":
          return ["simple_identifier"];
        case "class_declaration":
        case "object_declaration":
        case "companion_object":
          return ["simple_identifier", "type_identifier"];
        case "property_declaration":
        case "variable_declaration":
        case "class_parameter":
          return ["simple_identifier"];
        case "type_alias":
          return ["type_identifier", "simple_identifier"];
        case "import_header":
          return ["identifier", "import_alias"];
        case "enum_entry":
          return ["simple_identifier"];
        case "secondary_constructor":
          return ["constructor"];
        case "lambda_literal":
          return []; // Lambdas are anonymous
        default:
          return ["simple_identifier", "identifier"];
      }
    },
    extractModifiers: (nodeType: string) => {
      switch (nodeType) {
        case "function_declaration":
          return [
            "public",
            "private",
            "protected",
            "internal",
            "suspend",
            "inline",
            "infix",
            "operator",
            "tailrec",
            "external",
            "open",
            "final",
            "override",
            "abstract",
            "expect",
            "actual",
          ];
        case "class_declaration":
          return [
            "public",
            "private",
            "protected",
            "internal",
            "data",
            "sealed",
            "inner",
            "value",
            "annotation",
            "enum",
            "open",
            "final",
            "abstract",
            "expect",
            "actual",
          ];
        case "object_declaration":
        case "companion_object":
          return ["public", "private", "protected", "internal", "data"];
        case "property_declaration":
          return [
            "public",
            "private",
            "protected",
            "internal",
            "const",
            "lateinit",
            "open",
            "final",
            "override",
            "abstract",
            "expect",
            "actual",
          ];
        case "class_parameter":
          return ["val", "var", "vararg", "crossinline", "noinline"];
        default:
          return ["public", "private", "protected", "internal", "open", "final", "override", "abstract"];
      }
    },
    extractParameters: true,
    extractReturnType: true,
    extractReferences: true,
  },
};

/**
 * VBA language configuration
 */
const VBA_CONFIG: LanguageConfig = {
  language: "vba",
  extensions: ["vba", "bas", "cls", "frm"],
  keywords: LANGUAGE_KEYWORDS.vba,
  nodeTypes: {
    functions: [
      "sub_statement",
      "function_statement",
      "property_get_statement",
      "property_let_statement",
      "property_set_statement",
    ],
    classes: ["class_module", "type_statement", "enum_statement"],
    methods: [
      "sub_statement",
      "function_statement",
      "property_get_statement",
      "property_let_statement",
      "property_set_statement",
    ],
    imports: [], // VBA doesn't have traditional imports
    exports: ["public", "global"],
    variables: ["dim_statement", "const_statement", "static_statement", "variable_declaration"],
    types: ["type_statement", "enum_statement"],
    interfaces: [], // VBA has limited interface support
  },
  extractors: {
    extractName: (nodeType: string) => {
      switch (nodeType) {
        case "sub_statement":
        case "function_statement":
        case "property_get_statement":
        case "property_let_statement":
        case "property_set_statement":
          return ["identifier"];
        case "class_module":
        case "type_statement":
        case "enum_statement":
          return ["identifier"];
        case "dim_statement":
        case "const_statement":
        case "static_statement":
          return ["identifier", "variable_declaration"];
        default:
          return ["identifier"];
      }
    },
    extractModifiers: (nodeType: string) => {
      switch (nodeType) {
        case "sub_statement":
        case "function_statement":
        case "property_get_statement":
        case "property_let_statement":
        case "property_set_statement":
          return ["public", "private", "friend", "static"];
        case "dim_statement":
        case "const_statement":
        case "static_statement":
          return ["public", "private", "friend", "static", "const"];
        default:
          return ["public", "private", "friend", "static"];
      }
    },
    extractParameters: true,
    extractReturnType: true,
    extractReferences: true,
  },
};

/**
 * Language configuration registry
 */
export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  javascript: JAVASCRIPT_CONFIG,
  typescript: TYPESCRIPT_CONFIG,
  jsx: JSX_CONFIG,
  tsx: TSX_CONFIG,
  python: PYTHON_CONFIG,
  c: C_CONFIG,
  cpp: CPP_CONFIG,
  rust: RUST_CONFIG,
  csharp: CSHARP_CONFIG,
  go: GO_CONFIG,
  java: JAVA_CONFIG,
  kotlin: KOTLIN_CONFIG,
  vba: VBA_CONFIG,
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
  return config.nodeTypes.types.includes(nodeType) || config.nodeTypes.interfaces.includes(nodeType);
}

// =============================================================================
// TASK-003B: ENHANCED PYTHON NODE TYPE DETECTION
// =============================================================================

/**
 * Check if a node type represents a magic/dunder method (Layer 2)
 */
export function isMagicMethodNode(nodeType: string, nodeName: string, language: SupportedLanguage): boolean {
  if (language !== "python") return false;
  if (nodeType !== "function_definition" && nodeType !== "async_function_definition") return false;

  return nodeName.startsWith("__") && nodeName.endsWith("__") && nodeName.length > 4;
}

/**
 * Check if a node type represents an async pattern (Layer 2)
 */
export function isAsyncNode(nodeType: string, language: SupportedLanguage): boolean {
  if (language !== "python") return false;
  return nodeType === "async_function_definition" || nodeType === "async_with_statement" || nodeType === "await";
}

/**
 * Check if a node type represents a generator pattern (Layer 2)
 */
export function isGeneratorNode(nodeType: string, language: SupportedLanguage): boolean {
  if (language !== "python") return false;
  return nodeType === "yield" || nodeType === "yield_from" || nodeType === "generator_expression";
}

/**
 * Check if a node type represents a comprehension (Layer 2)
 */
export function isComprehensionNode(nodeType: string, language: SupportedLanguage): boolean {
  if (language !== "python") return false;
  return (
    nodeType === "list_comprehension" ||
    nodeType === "set_comprehension" ||
    nodeType === "dictionary_comprehension" ||
    nodeType === "generator_expression"
  );
}

/**
 * Check if a node type represents a context manager pattern (Layer 4)
 */
export function isContextManagerNode(nodeType: string, language: SupportedLanguage): boolean {
  if (language !== "python") return false;
  return nodeType === "with_statement" || nodeType === "async_with_statement";
}

/**
 * Check if a node type represents exception handling (Layer 4)
 */
export function isExceptionHandlingNode(nodeType: string, language: SupportedLanguage): boolean {
  if (language !== "python") return false;
  return (
    nodeType === "try_statement" ||
    nodeType === "except_clause" ||
    nodeType === "finally_clause" ||
    nodeType === "else_clause" ||
    nodeType === "raise_statement"
  );
}

/**
 * Check if a node type represents a decorator (Layer 1)
 */
export function isDecoratorNode(nodeType: string, language: SupportedLanguage): boolean {
  if (language !== "python") return false;
  return nodeType === "decorator" || nodeType === "decorated_definition";
}

/**
 * Check if a node type represents a dataclass or special class (Layer 2)
 */
export function isSpecialClassNode(
  nodeType: string,
  className: string,
  decorators: string[],
  language: SupportedLanguage,
): boolean {
  if (language !== "python") return false;
  if (nodeType !== "class_definition" && nodeType !== "decorated_definition") return false;

  // Check for dataclass decorator
  if (decorators.some((d) => d === "dataclass" || d.includes("dataclass"))) return true;

  // Check for special base classes
  const specialBaseClasses = ["NamedTuple", "Enum", "IntEnum", "Flag", "IntFlag", "Protocol", "Generic", "ABC"];
  return specialBaseClasses.some((base) => className.includes(base));
}

/**
 * Get enhanced node type category for Python (Layer 1-4)
 */
export function getPythonNodeCategory(
  nodeType: string,
  nodeName: string = "",
  language: SupportedLanguage = "python",
): string {
  if (language !== "python") return "unknown";

  // Layer 1: Enhanced basic parsing categories
  if (isFunctionNode(nodeType, language)) {
    if (nodeType === "async_function_definition") return "async_function";
    if (nodeType === "lambda") return "lambda";
    if (isMagicMethodNode(nodeType, nodeName, language)) return "magic_method";
    return "function";
  }

  if (isClassNode(nodeType, language)) {
    if (nodeType === "decorated_definition") return "decorated_class";
    return "class";
  }

  if (isImportNode(nodeType, language)) return "import";
  if (isExportNode(nodeType, language)) return "export";
  if (isTypeNode(nodeType, language)) return "type";

  // Layer 2: Advanced feature categories
  if (isAsyncNode(nodeType, language)) return "async_pattern";
  if (isGeneratorNode(nodeType, language)) return "generator_pattern";
  if (isComprehensionNode(nodeType, language)) return "comprehension";
  if (isDecoratorNode(nodeType, language)) return "decorator";

  // Layer 4: Pattern recognition categories
  if (isContextManagerNode(nodeType, language)) return "context_manager";
  if (isExceptionHandlingNode(nodeType, language)) return "exception_handling";

  // Layer 1: Variable assignments
  if (["assignment", "augmented_assignment", "annotated_assignment", "named_expression"].includes(nodeType)) {
    return "variable";
  }

  return "unknown";
}

// =============================================================================
// 7. INITIALIZATION AND STARTUP
// =============================================================================

/**
 * Validate language configurations on startup
 */
export function validateConfigurations(): boolean {
  console.error("[LanguageConfig] Validating configurations...");

  for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
    if (!config.language || !config.extensions.length) {
      console.error(`[LanguageConfig] Invalid configuration for ${lang}`);
      return false;
    }
  }

  console.error("[LanguageConfig] All configurations valid");
  return true;
}
