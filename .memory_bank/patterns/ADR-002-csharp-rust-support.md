# ADR-002: C# and Rust Language Support Implementation

**Date**: 2025-10-05
**Status**: Approved
**TASK**: TASK-20251005185121

## Context

The code-graph-rag-mcp system currently supports TypeScript, JavaScript, Python, Java, and Go. There is a need to extend support to C# and Rust to cover more modern development ecosystems.

## Decision

Implement Method 2: Language-Specific Analyzer Pattern

### Selected Approach

Create dedicated analyzer modules (csharp-analyzer.ts and rust-analyzer.ts) following the established python-analyzer.ts pattern. This approach provides:

1. **Pattern Consistency**: Follows existing successful implementation patterns
2. **Language-Specific Features**: Handles unique language constructs properly
3. **Maintainability**: Separate modules for each language
4. **Extensibility**: Easy to add more languages following the same pattern

### Implementation Architecture

```
src/parsers/
├── csharp-analyzer.ts    # C# entity extraction
├── rust-analyzer.ts       # Rust entity extraction
└── parser-factory.ts      # Updated to support new languages

config/
└── development.yaml       # Language configurations

tests/
├── csharp-analyzer.test.ts
└── rust-analyzer.test.ts
```

## Implementation Details

### C# Analyzer Features
- Classes, interfaces, structs, records
- Methods, properties, fields, events
- Namespaces and using statements
- LINQ query expressions
- Async/await patterns
- Attributes and generics
- Extension methods
- Partial classes

### Rust Analyzer Features
- Structs, enums, traits
- Functions, methods, associated functions
- Modules and use statements
- Ownership annotations (mut, ref, move)
- Lifetime parameters
- Macro definitions and usage
- Generic types and trait bounds
- Async functions

### Project File Support
- C#: .csproj, .sln files
- Rust: Cargo.toml, Cargo.lock files

## Dependencies

```json
{
  "tree-sitter-c-sharp": "^0.20.0",
  "tree-sitter-rust": "^0.20.3"
}
```

## Success Metrics

- Entity extraction accuracy >90% for both languages
- Parse time <100ms for average-sized files
- Memory usage comparable to existing analyzers
- Full test coverage for language features
- No performance regression in existing languages

## Risks and Mitigations

**Risk**: Complex language features might be hard to extract
**Mitigation**: Incremental implementation, starting with core features

**Risk**: Tree-sitter grammars might have limitations
**Mitigation**: Document known limitations, contribute fixes upstream

**Risk**: Performance impact with additional languages
**Mitigation**: Lazy loading of language analyzers

## Alternatives Considered

1. **Unified Parser Pattern**: Single parser handling all languages
   - Rejected: Too complex, poor maintainability

2. **External Tool Integration**: Use language-specific tools
   - Rejected: Additional dependencies, slower performance

3. **Basic Regex Pattern**: Simple pattern matching
   - Rejected: Insufficient for complex language constructs

## References

- Tree-sitter C# Grammar: https://github.com/tree-sitter/tree-sitter-c-sharp
- Tree-sitter Rust Grammar: https://github.com/tree-sitter/tree-sitter-rust
- Existing python-analyzer.ts implementation
- GRACE Framework principles for deterministic code generation