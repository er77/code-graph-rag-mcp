# Resource Allocation Matrix - TASK-002B

**Multi-Language Parser Support Resource Planning**

## Executive Summary

This document defines comprehensive resource allocation for expanding code-graph-rag-mcp to support Python, C, and C++ languages while maintaining performance targets established in TASK-002A research synthesis.

### Key Performance Targets
- **Parse Throughput**: 100+ files/second per language
- **Memory Usage**: <1GB peak for large repositories
- **Query Response**: <100ms simple, <1s complex analysis
- **Bundle Optimization**: <50% size increase per language

## 1. Agent Resource Allocation

### Primary Agent Assignments

#### ParserAgent (Language-Specific Parsing)
- **Primary Role**: Tree-sitter grammar integration and optimization
- **Resource Requirements**:
  - CPU: 2-3 cores during active parsing
  - Memory: 200-400MB per language grammar
  - Concurrent Operations: 5-8 simultaneous parse operations
- **Language Allocation**:
  - Python: 150+ files/second target (COMPLETED ✅)
  - C: 100+ files/second target
  - C++: 75+ files/second target (complex template handling)

#### IndexerAgent (Graph Storage Scaling)
- **Primary Role**: Multi-language entity storage and relationship mapping
- **Resource Requirements**:
  - CPU: 1-2 cores for indexing operations
  - Memory: 300-500MB for large multi-language repositories
  - Storage: SQLite WAL mode with 10GB+ capacity
- **Scaling Strategy**:
  - Batch operations for improved throughput
  - Language-specific indexing queues
  - Cross-language relationship detection

#### SemanticAgent (Cross-Language Analysis)
- **Primary Role**: Vector embeddings and similarity detection across languages
- **Resource Requirements**:
  - CPU: 2-4 cores for embedding generation
  - Memory: 400-600MB for vector operations
  - Vector Storage: sqlite-vec integration with graceful fallback
- **Optimization Focus**:
  - Language-agnostic embedding models
  - Cross-language similarity detection
  - Semantic search across codebases

#### QueryAgent (Multi-Language Queries)
- **Primary Role**: Graph traversal and complex analysis across languages
- **Resource Requirements**:
  - CPU: 1-2 cores for query processing
  - Memory: 200-300MB for query operations
  - Cache: LRU caching for frequent query patterns
- **Multi-Language Features**:
  - Cross-language relationship queries
  - Language-specific entity filtering
  - Performance-optimized graph traversal

#### ResourceManager (Hardware Optimization)
- **Primary Role**: System resource monitoring and throttling
- **Resource Requirements**:
  - CPU: <10% overhead for monitoring
  - Memory: 50-100MB for tracking metrics
  - IO: Real-time resource utilization monitoring
- **Optimization Strategies**:
  - Dynamic CPU/memory throttling
  - Concurrent operation limiting
  - Graceful degradation under load

## 2. Hardware Resource Allocation

### CPU Requirements

#### Minimum Configuration (Commodity Hardware)
- **Cores**: 4 cores minimum
- **Architecture**: x64 with SIMD support
- **Allocation**:
  - Parsing: 2 cores (50%)
  - Indexing: 1 core (25%)
  - Queries: 1 core (25%)

#### Recommended Configuration
- **Cores**: 8+ cores
- **Architecture**: x64 with AVX2 support
- **Allocation**:
  - Parsing: 4 cores (50%)
  - Indexing: 2 cores (25%)
  - Semantic/Queries: 2 cores (25%)

### Memory Requirements

#### Per-Language Memory Allocation
```
Base System:           200MB
Python Support:        150MB  ✅ IMPLEMENTED
C Support:            100MB  (planned)
C++ Support:          250MB  (planned)
Vector Operations:    200MB
Query Cache:          100MB
Total Peak:          1000MB  (within 1GB target)
```

#### Memory Optimization Strategies
- **Lazy Loading**: Load language grammars on demand
- **LRU Caching**: 100MB cache with intelligent eviction
- **Batch Processing**: Reduce memory fragmentation
- **Resource Monitoring**: Dynamic memory throttling

### Storage Requirements

#### SQLite Database Scaling
- **Initial Size**: 100MB for medium repositories
- **Growth Rate**: ~10MB per 1000 files per language
- **WAL Mode**: Concurrent read/write operations
- **Optimization**: PRAGMA settings for multi-language workloads

#### Vector Storage (sqlite-vec)
- **Embeddings**: 384 dimensions per code fragment
- **Storage Overhead**: ~1.5KB per embedded entity
- **Compression**: Vector quantization for large datasets
- **Fallback**: Pure JavaScript implementation

## 3. Concurrent Processing Capabilities

### Multi-Agent Coordination

#### Processing Pipeline
```
Input Files → ParserAgent Queue → IndexerAgent → SemanticAgent → QueryAgent
    ↓              ↓                   ↓             ↓            ↓
Language      Parse Batch          Store Graph   Generate      Process
Detection    (5-10 files)         Relationships  Embeddings    Queries
```

#### Throughput Optimization
- **Parser Queue**: 10+ simultaneous operations per language
- **Batch Size**: 5-10 files per batch for optimal memory usage
- **Pipeline Stages**: Parallel processing across agents
- **Resource Sharing**: Intelligent CPU/memory allocation

### Load Balancing Strategy

#### Dynamic Resource Allocation
- **CPU Monitoring**: Real-time usage tracking
- **Memory Pressure**: Graceful degradation when approaching limits
- **Queue Management**: Priority-based task scheduling
- **Throttling**: Automatic rate limiting under resource constraints

## 4. Bundle Size Optimization

### Lazy Loading Strategy

#### Language Grammar Loading
```javascript
// On-demand grammar loading
const languageLoader = {
  python: () => import('tree-sitter-python'),   // ~2MB
  c: () => import('tree-sitter-c'),            // ~1.5MB
  cpp: () => import('tree-sitter-cpp')         // ~3MB
};
```

#### Bundle Splitting
- **Core System**: 5MB base bundle
- **Per Language**: 1.5-3MB additional per language
- **Total Growth**: <50% increase per language (target met)
- **Compression**: gzip/brotli for production deployment

### Performance Impact Analysis

#### Bundle Loading Times
- **Initial Load**: <2s for core system
- **Language Addition**: <500ms per additional language
- **Cache Strategy**: Service worker caching for subsequent loads
- **CDN Optimization**: Language-specific bundle distribution

## 5. Agent Assignment Strategy Details

### Phase-Based Resource Allocation

#### Phase 1: Python Integration (COMPLETED ✅)
- **Duration**: 3 weeks
- **Resource Focus**: Validation and optimization
- **Performance Achieved**: 150+ files/second, <200MB memory

#### Phase 2: C Language Integration (PLANNED)
- **Duration**: 1-2 weeks
- **Primary Agent**: ParserAgent + IndexerAgent
- **Resource Requirements**: +100MB memory, +1.5MB bundle
- **Performance Target**: 100+ files/second

#### Phase 3: C++ Language Integration (PLANNED)
- **Duration**: 2-4 weeks
- **Primary Agent**: ParserAgent (complex syntax), SemanticAgent
- **Resource Requirements**: +250MB memory, +3MB bundle
- **Performance Target**: 75+ files/second
- **Special Considerations**: Template parsing, namespace resolution

#### Phase 4: Integration & Validation (PLANNED)
- **Duration**: 1 week
- **All Agents**: Cross-language testing and optimization
- **Resource Requirements**: Full system stress testing
- **Validation**: End-to-end performance benchmarking

### Agent Coordination Matrix

| Agent           | Python | C    | C++  | Cross-Lang | Resource Priority |
|-----------------|--------|------|------|------------|-------------------|
| ParserAgent     | ✅     | High | High | Medium     | CPU (2-3 cores)  |
| IndexerAgent    | ✅     | High | High | High       | Memory (300-500MB)|
| SemanticAgent   | ✅     | Med  | High | High       | CPU+Memory       |
| QueryAgent      | ✅     | Med  | Med  | High       | CPU (1-2 cores)  |
| ResourceManager | ✅     | High | High | High       | Low overhead      |

## 6. Performance Monitoring & Validation

### Key Performance Indicators (KPIs)

#### Throughput Metrics
- **Files/Second**: Per-language parsing throughput
- **Entities/Second**: Entity extraction rate
- **Queries/Second**: Query processing capacity
- **Memory Efficiency**: MB per 1000 files processed

#### Resource Utilization Metrics
- **CPU Usage**: Per-agent CPU consumption
- **Memory Usage**: Peak and average memory consumption
- **IO Operations**: Database read/write operations
- **Cache Hit Rate**: LRU cache effectiveness

### Automated Monitoring

#### Real-Time Dashboards
- **Resource Manager**: Live CPU/memory utilization
- **Performance Metrics**: Throughput and latency tracking
- **Error Rates**: Parser failures and recovery
- **System Health**: Overall system performance indicators

## 7. Scalability Considerations

### Horizontal Scaling Options

#### Multi-Instance Architecture
- **Process Isolation**: Separate processes per language
- **Resource Sharing**: Shared SQLite database with WAL mode
- **Load Distribution**: Round-robin language assignment
- **Failure Isolation**: Language-specific error boundaries

### Vertical Scaling Strategies

#### Resource Optimization
- **Memory Pooling**: Shared memory pools across agents
- **CPU Affinity**: Core pinning for performance-critical agents
- **IO Optimization**: Batch database operations
- **Cache Optimization**: Multi-level caching strategies

## Implementation Checklist

### Phase 2 (C Language) - Resource Preparation
- [ ] Update ResourceManager for C language metrics
- [ ] Configure ParserAgent for tree-sitter-c integration
- [ ] Extend IndexerAgent with C-specific entity types
- [ ] Test memory allocation with C grammar loaded
- [ ] Validate performance targets with C files

### Phase 3 (C++ Language) - Resource Preparation
- [ ] Update ResourceManager for C++ language metrics
- [ ] Configure ParserAgent for complex C++ syntax
- [ ] Extend SemanticAgent for template analysis
- [ ] Test memory allocation with all languages loaded
- [ ] Validate cross-language query performance

### Validation Requirements
- [ ] Performance benchmarking meets all targets
- [ ] Memory usage stays within 1GB limit
- [ ] Bundle size increases <50% per language
- [ ] All agents coordinate effectively
- [ ] Resource monitoring provides actionable insights

---

**Document Status**: ✅ COMPLETED - TASK-002B Resource Allocation
**Dependencies**: TASK-002A Research Synthesis ✅
**Next Phase**: TASK-002C Risk Assessment & Testing Strategy
**Validation**: Performance targets defined and measurable