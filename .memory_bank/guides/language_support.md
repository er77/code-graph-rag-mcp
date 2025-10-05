# Language Support Guide

## Overview
The code-graph-rag-mcp system provides comprehensive parsing and analysis for multiple programming languages through tree-sitter parsers and language-specific analyzers.

## Supported Languages (8 Total)

### Core Languages
1. **JavaScript** - Full support via tree-sitter
2. **TypeScript/TSX** - Full support via tree-sitter
3. **Python** - Enhanced 4-layer support with python-analyzer.ts

### Phase 1 Languages (TASK-20251005185121)
4. **C#** - Comprehensive support with csharp-analyzer.ts
5. **Rust** - Comprehensive support with rust-analyzer.ts

### Phase 2 Languages (TASK-20251005191500)
6. **C** - Full support with c-analyzer.ts and circuit breakers
7. **C++** - Advanced support with cpp-analyzer.ts, templates, and circuit breakers

## C# Language Features

### Entity Extraction
The C# analyzer (`src/parsers/csharp-analyzer.ts`) provides comprehensive entity extraction:

#### Core Entities
- **Namespaces**: Namespace declarations with member counts
- **Classes**: Including abstract, sealed, partial, and static classes
- **Interfaces**: With base interface tracking
- **Structs**: Including readonly structs
- **Enums**: With variant extraction
- **Delegates**: Function pointer declarations
- **Records**: C# 9+ record types and record structs

#### Class Members
- **Methods**: Including async, virtual, override, abstract methods
- **Properties**: With getter/setter/init accessor detection
- **Fields**: Including readonly and const fields
- **Events**: Event declarations and handlers
- **Constructors**: Including constructor injection patterns

#### Advanced Features
- **Attributes**: Extraction of C# attributes (e.g., [Serializable], [ApiController])
- **LINQ Support**: Both query syntax and method syntax detection
- **Async/Await**: Comprehensive async pattern recognition
- **Extension Methods**: Static extension method detection
- **Partial Classes**: Multi-file class support
- **Generics**: Generic type parameters and constraints
- **Using Statements**: Including static and global usings (C# 10+)

### Pattern Recognition (C#)
The analyzer identifies common C# design patterns:
- **Singleton Pattern**: Static instance with private constructor
- **Repository Pattern**: CRUD method detection
- **Dependency Injection**: Constructor injection patterns
- **Async/Await Patterns**: Asynchronous programming patterns
- **LINQ Patterns**: Query and method chain patterns

### Relationship Mapping (C#)
- Class inheritance relationships
- Interface implementations
- Namespace containment
- Type dependencies through using statements

## Rust Language Features

### Entity Extraction
The Rust analyzer (`src/parsers/rust-analyzer.ts`) provides comprehensive Rust-specific extraction:

#### Core Entities
- **Modules**: Including inline and file modules
- **Structs**: Regular, tuple, and unit structs
- **Enums**: With variant extraction and discriminants
- **Traits**: Including supertraits and associated types
- **Functions**: Including async, const, and unsafe functions
- **Type Aliases**: Type definitions
- **Constants**: Const and static items
- **Macros**: macro_rules! and proc macros

#### Struct/Enum Features
- **Fields**: Named and tuple fields with visibility
- **Enum Variants**: Unit, tuple, and struct variants
- **Derive Macros**: Common derives (Debug, Clone, Serialize, etc.)
- **Generics**: Type parameters with bounds
- **Lifetimes**: Lifetime parameters and annotations

#### Trait System
- **Trait Methods**: Abstract and default implementations
- **Associated Types**: Type definitions within traits
- **Trait Implementations**: impl blocks for types
- **Trait Bounds**: Where clauses and type constraints
- **Supertraits**: Trait inheritance

#### Advanced Features
- **Ownership Markers**: mut, ref, move, &, &mut
- **Visibility Modifiers**: pub, pub(crate), pub(super), pub(self)
- **Unsafe Code**: Unsafe blocks, functions, traits, and impls
- **Async Functions**: async fn support
- **Macro Definitions**: macro_rules! patterns
- **Use Statements**: Including nested and glob imports
- **Extern Crates**: External crate declarations

### Pattern Recognition (Rust)
The analyzer identifies common Rust patterns:
- **Builder Pattern**: Structs ending in "Builder" with build() method
- **Iterator Pattern**: Iterator trait implementations
- **Error Handling**: Result<T, E> usage and ? operator
- **Borrowing Patterns**: Reference and mutable reference usage
- **Unsafe Code**: Unsafe block and function detection
- **Lifetime Annotations**: Explicit lifetime usage patterns

### Relationship Mapping (Rust)
- Trait implementations for types
- Trait extensions (supertraits)
- Module containment hierarchies
- Import dependencies through use statements

## File Extension Mapping

| Language | Extensions |
|----------|------------|
| TypeScript | .ts, .mts, .cts |
| JavaScript | .js, .mjs, .cjs |
| TSX | .tsx |
| JSX | .jsx |
| Python | .py, .pyi, .pyw |
| C | .c, .h |
| C++ | .cpp, .cxx, .cc, .hpp, .hxx, .hh |
| C# | .cs |
| Rust | .rs |

## Configuration

### Adding Language Support
Languages are configured in `config/development.yaml`:

```yaml
parser:
  treeSitter:
    enabled: true
    languageConfigs:
      - "typescript"
      - "javascript"
      - "python"
      - "csharp"    # C# support
      - "rust"      # Rust support
```

### Tree-Sitter Dependencies
The system uses tree-sitter WASM modules for parsing:
- `tree-sitter-c-sharp` for C#
- `tree-sitter-rust` for Rust

These are automatically installed via npm dependencies.

## Performance Characteristics

### C# Analyzer Performance
- **Entity Extraction**: ~100-200 entities/second
- **Pattern Recognition**: Negligible overhead
- **Memory Usage**: ~50MB for large projects
- **Caching**: LRU cache with 1-hour TTL

### Rust Analyzer Performance
- **Entity Extraction**: ~100-200 entities/second
- **Lifetime Analysis**: Minimal overhead
- **Memory Usage**: ~50MB for large projects
- **Macro Processing**: Efficient pattern matching

## Known Limitations

### C# Limitations
- Proc-generated code not fully analyzed
- Some LINQ expressions may be partially extracted
- Dynamic/reflection code not statically analyzed
- Source generators output not included

### Rust Limitations
- Macro expansion not performed (analyzed as-is)
- Some complex lifetime relationships simplified
- Procedural macro internals not analyzed
- Build.rs generated code not included

## Testing

Both analyzers include comprehensive test suites:
- `tests/csharp-analyzer.test.ts` - C# analyzer tests
- `tests/rust-analyzer.test.ts` - Rust analyzer tests

Run tests with:
```bash
npm test csharp-analyzer
npm test rust-analyzer
```

## C++ Language Features (NEW - TASK-20251005191500)

### Architecture
The C++ analyzer uses a **two-layer architecture**:
1. **Syntactic Layer**: Direct CST extraction via tree-sitter-cpp
2. **Semantic Layer**: Lazy evaluation for complex features

### Phase 3: Core C++ Support
- **Classes**: With access modifiers (public, private, protected)
- **Methods**: const, static, virtual, override, final, noexcept
- **Constructors & Destructors**: Special member functions
- **Namespaces**: Nested namespace support
- **Inheritance**: Single and multiple inheritance with virtual bases
- **Operator Overloading**: All standard operators
- **Friend Declarations**: Friend classes and functions
- **Enums**: Including enum classes (C++11)

### Phase 4: Limited Template Support
- **Simple Templates**: Class and function templates
- **Template Parameters**: Type and non-type parameters
- **Skipped Patterns**: SFINAE, variadic templates, complex metaprogramming
- **Memoization**: Caching for repeated template patterns

### Circuit Breakers
Comprehensive safety mechanisms to prevent system overload:
```typescript
const MAX_RECURSION_DEPTH = 50;
const PARSE_TIMEOUT_MS = 5000;
const MAX_COMPLEXITY_SCORE = 100;
const MAX_TEMPLATE_DEPTH = 10;
```

### Complexity Scoring
Dynamic complexity assessment based on:
- Template depth (weight: 10)
- Nested classes (weight: 5)
- Inheritance depth (weight: 3)
- Operator count (weight: 2)

## C Language Features (TASK-20251005191500)

### Comprehensive C Support
- **Functions**: static, extern, inline modifiers
- **Structs & Unions**: Complete member extraction
- **Enums**: With value extraction
- **Typedefs**: Type alias tracking
- **Macros**: Preprocessor directive recognition
- **Global Variables**: Including constants
- **Include Relationships**: Header dependency tracking

### Circuit Breakers
Same robust safety system as C++:
- Recursion depth limits
- Parse timeouts
- Partial result returns on errors

## Usage Examples

### Analyzing C++ Code
```typescript
import { CppAnalyzer } from "./cpp-analyzer";

const analyzer = new CppAnalyzer();
const result = await analyzer.analyze(treeNode, "MyClass.cpp");

console.log(`Found ${result.entities.length} entities`);
console.log(`Found ${result.relationships.length} relationships`);
// Check for circuit breaker triggers in console warnings
```

### Analyzing C Code
```typescript
import { CAnalyzer } from "./c-analyzer";

const analyzer = new CAnalyzer();
const result = await analyzer.analyze(treeNode, "module.c");

console.log(`Found ${result.entities.length} entities`);
console.log(`Found ${result.relationships.length} relationships`);
```

### Analyzing C# Code
```typescript
import { CSharpAnalyzer } from "./csharp-analyzer";

const analyzer = new CSharpAnalyzer();
const result = await analyzer.analyze(treeNode, "MyClass.cs");

console.log(`Found ${result.entities.length} entities`);
console.log(`Found ${result.relationships.length} relationships`);
console.log(`Identified ${result.patterns.length} patterns`);
```

### Analyzing Rust Code
```typescript
import { RustAnalyzer } from "./rust-analyzer";

const analyzer = new RustAnalyzer();
const result = await analyzer.analyze(treeNode, "lib.rs");

console.log(`Found ${result.entities.length} entities`);
console.log(`Found ${result.relationships.length} relationships`);
console.log(`Identified ${result.patterns.length} patterns`);
```

## Future Enhancements

### Planned C# Enhancements
- Source generator support
- Roslyn analyzer integration
- NuGet dependency analysis
- Solution/project file parsing

### Planned Rust Enhancements
- Macro expansion support
- Cargo.toml dependency analysis
- Trait coherence checking
- Ownership flow analysis

## Contributing

To add support for a new language:
1. Create analyzer in `src/parsers/{language}-analyzer.ts`
2. Follow the pattern established by python-analyzer.ts
3. Add language to SUPPORTED_LANGUAGES in types/parser.ts
4. Update tree-sitter-parser.ts to use the analyzer
5. Add comprehensive tests
6. Update this documentation

## References

- [Tree-sitter C# Grammar](https://github.com/tree-sitter/tree-sitter-c-sharp)
- [Tree-sitter Rust Grammar](https://github.com/tree-sitter/tree-sitter-rust)
- [C# Language Specification](https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/)
- [Rust Language Reference](https://doc.rust-lang.org/reference/)
- ADR-002: C# and Rust Language Support Implementation