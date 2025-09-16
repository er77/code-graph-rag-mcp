# Testing Strategy - TASK-002C

**Multi-Language Parser Support Comprehensive Testing Framework**

## Executive Summary

This document establishes a comprehensive, multi-layered testing strategy for implementing and maintaining multi-language parser support (Python ✅, C, C++) within the code-graph-rag-mcp system. The strategy ensures quality, performance, and reliability across all supported languages and their interactions.

### Testing Framework Overview
- **4 Testing Levels**: Unit, Integration, Performance, End-to-End
- **Language-Specific Testing**: Dedicated test suites for each language
- **Cross-Language Testing**: Validation of multi-language interactions
- **Automated Testing Pipeline**: CI/CD integration with quality gates

## 1. Testing Architecture

### Testing Pyramid Structure

```
                     End-to-End Tests
                    ┌─────────────────┐
                   │ Full Workflows   │
                  │ Real Repositories │
                 │ User Scenarios     │
                └─────────────────────┘
               Performance & Load Tests
              ┌─────────────────────────┐
             │ Throughput Validation    │
            │ Memory/CPU Monitoring     │
           │ Concurrent Operations      │
          └─────────────────────────────┘
         Integration Tests
        ┌─────────────────────────────────┐
       │ Multi-Agent Communication       │
      │ Cross-Language Relationships     │
     │ Database & Storage Integration   │
    └─────────────────────────────────────┘
   Unit Tests (Base of Pyramid)
  ┌─────────────────────────────────────────┐
 │ Language-Specific Parser Components     │
│ Entity Extraction Logic                  │
│ Individual Function Validation           │
└─────────────────────────────────────────────┘
```

### Testing Technology Stack

```typescript
interface TestingStack {
  unitTesting: {
    framework: "Jest";
    coverage: "90%+ per language";
    mocking: "Sinon.js";
    assertions: "Jest + Custom Matchers";
  };
  integrationTesting: {
    framework: "Jest + Custom Harness";
    database: "SQLite in-memory";
    agents: "Mock Agent Framework";
    communication: "Message Bus Testing";
  };
  performanceTesting: {
    framework: "Jest + Benchmark.js";
    profiling: "Node.js Profiler";
    monitoring: "Performance Observers";
    reporting: "Custom Performance Dashboard";
  };
  e2eTesting: {
    framework: "Playwright + Custom MCP Client";
    repositories: "Real-world Test Repositories";
    scenarios: "User Workflow Automation";
    validation: "Result Verification";
  };
}
```

## 2. Level 1: Unit Testing

### Language-Specific Parser Testing

#### Python Parser Testing ✅ IMPLEMENTED
```typescript
describe('Python Parser', () => {
  let parser: TreeSitterParser;

  beforeEach(async () => {
    parser = new TreeSitterParser();
    await parser.initialize();
  });

  describe('Entity Extraction', () => {
    test('should extract function definitions', async () => {
      const code = `
def complex_function(param1: Union[str, int], *args, **kwargs) -> Optional[Dict]:
    """Complex function with type hints."""
    pass
      `;

      const result = await parser.parse(code, 'python');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]).toMatchObject({
        type: 'function',
        name: 'complex_function',
        language: 'python',
        parameters: expect.arrayContaining([
          expect.objectContaining({ name: 'param1', type: 'Union[str, int]' }),
          expect.objectContaining({ name: 'args', type: '*args' }),
          expect.objectContaining({ name: 'kwargs', type: '**kwargs' })
        ]),
        returnType: 'Optional[Dict]'
      });
    });

    test('should extract class definitions with inheritance', async () => {
      const code = `
@dataclass
class AdvancedClass(BaseClass, Protocol):
    """Advanced class with decorators and inheritance."""

    def __init__(self, value: int) -> None:
        super().__init__(value)

    @property
    def computed_value(self) -> int:
        return self.value * 2
      `;

      const result = await parser.parse(code, 'python');

      const classEntity = result.entities.find(e => e.type === 'class');
      expect(classEntity).toMatchObject({
        name: 'AdvancedClass',
        decorators: ['dataclass'],
        inheritance: ['BaseClass', 'Protocol']
      });
    });

    test('should handle async/await patterns', async () => {
      const code = `
async def async_generator() -> AsyncGenerator[int, None]:
    for i in range(10):
        yield i
        await asyncio.sleep(0.1)
      `;

      const result = await parser.parse(code, 'python');

      expect(result.entities[0]).toMatchObject({
        type: 'async_function',
        name: 'async_generator',
        patterns: expect.arrayContaining(['async', 'generator', 'yield'])
      });
    });
  });

  describe('Performance', () => {
    test('should parse large Python files within performance targets', async () => {
      const largeCode = generateLargePythonFile(1000); // 1000 functions

      const startTime = performance.now();
      const result = await parser.parse(largeCode, 'python');
      const endTime = performance.now();

      const parseTime = endTime - startTime;
      const filesPerSecond = 1000 / (parseTime / 1000);

      expect(filesPerSecond).toBeGreaterThan(150); // Target: 150+ files/second
      expect(result.entities).toHaveLength(1000);
    });
  });
});
```

#### C Parser Testing (Phase 2)
```typescript
describe('C Parser', () => {
  test('should extract function declarations and definitions', async () => {
    const code = `
#include <stdio.h>

// Function declaration
int calculate(int a, int b);

// Function definition
int calculate(int a, int b) {
    return a + b;
}

// Function pointer
typedef int (*operation_func)(int, int);
    `;

    const result = await parser.parse(code, 'c');

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'function',
          name: 'calculate',
          declarationType: 'declaration'
        }),
        expect.objectContaining({
          type: 'function',
          name: 'calculate',
          declarationType: 'definition'
        }),
        expect.objectContaining({
          type: 'typedef',
          name: 'operation_func',
          targetType: 'function_pointer'
        })
      ])
    );
  });

  test('should handle preprocessor directives', async () => {
    const code = `
#define MAX_SIZE 1024
#ifdef DEBUG
    #define LOG(msg) printf("DEBUG: %s\\n", msg)
#else
    #define LOG(msg)
#endif

#include "header.h"
    `;

    const result = await parser.parse(code, 'c');

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'macro',
          name: 'MAX_SIZE',
          value: '1024'
        }),
        expect.objectContaining({
          type: 'include',
          path: '"header.h"',
          type: 'local'
        })
      ])
    );
  });

  test('should extract struct and union definitions', async () => {
    const code = `
struct Point {
    int x;
    int y;
};

union Data {
    int i;
    float f;
    char str[20];
};

typedef struct {
    char name[50];
    int age;
} Person;
    `;

    const result = await parser.parse(code, 'c');

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'struct',
          name: 'Point',
          fields: [
            { name: 'x', type: 'int' },
            { name: 'y', type: 'int' }
          ]
        }),
        expect.objectContaining({
          type: 'union',
          name: 'Data',
          fields: expect.any(Array)
        }),
        expect.objectContaining({
          type: 'typedef',
          name: 'Person',
          targetType: 'struct'
        })
      ])
    );
  });
});
```

#### C++ Parser Testing (Phase 3)
```typescript
describe('C++ Parser', () => {
  test('should extract class definitions with access modifiers', async () => {
    const code = `
class Base {
public:
    virtual ~Base() = default;
    virtual void process() = 0;

protected:
    int value_;

private:
    static int instance_count_;
};

class Derived : public Base, private Utility {
public:
    explicit Derived(int value) : Base(), value_(value) {}

    void process() override {
        // Implementation
    }

private:
    int value_;
};
    `;

    const result = await parser.parse(code, 'cpp');

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'class',
          name: 'Base',
          accessModifiers: ['public', 'protected', 'private'],
          virtualMethods: ['~Base', 'process'],
          inheritance: []
        }),
        expect.objectContaining({
          type: 'class',
          name: 'Derived',
          inheritance: [
            { name: 'Base', access: 'public' },
            { name: 'Utility', access: 'private' }
          ]
        })
      ])
    );
  });

  test('should handle template definitions', async () => {
    const code = `
template<typename T, size_t N = 10>
class Container {
public:
    template<typename U>
    void add(U&& item) {
        // Implementation
    }

private:
    std::array<T, N> data_;
};

template<>
class Container<int, 5> {
    // Specialization
};

template<typename T>
using SmallContainer = Container<T, 5>;
    `;

    const result = await parser.parse(code, 'cpp');

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'template_class',
          name: 'Container',
          templateParameters: [
            { name: 'T', type: 'typename' },
            { name: 'N', type: 'size_t', defaultValue: '10' }
          ]
        }),
        expect.objectContaining({
          type: 'template_specialization',
          name: 'Container',
          specialization: ['int', '5']
        }),
        expect.objectContaining({
          type: 'using_alias',
          name: 'SmallContainer',
          aliasFor: 'Container<T, 5>'
        })
      ])
    );
  });

  test('should handle modern C++ features', async () => {
    const code = `
auto lambda = [capture = std::move(value)](auto&& param) -> decltype(auto) {
    return std::forward<decltype(param)>(param) + capture;
};

constexpr auto factorial(int n) -> int {
    return n <= 1 ? 1 : n * factorial(n - 1);
}

class ModernClass {
public:
    ModernClass() = default;
    ModernClass(const ModernClass&) = delete;
    ModernClass(ModernClass&&) = default;

    auto getValue() const noexcept -> const int& {
        return value_;
    }

private:
    int value_{42};
};
    `;

    const result = await parser.parse(code, 'cpp');

    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'lambda',
          captureMode: ['capture = std::move(value)'],
          parameters: ['auto&& param'],
          returnType: 'decltype(auto)'
        }),
        expect.objectContaining({
          type: 'constexpr_function',
          name: 'factorial',
          returnType: 'int'
        }),
        expect.objectContaining({
          type: 'class',
          name: 'ModernClass',
          specialMethods: ['default_constructor', 'deleted_copy', 'default_move']
        })
      ])
    );
  });
});
```

### Entity Extraction Validation

#### Custom Jest Matchers
```typescript
expect.extend({
  toHaveValidEntityStructure(received: ParsedEntity) {
    const requiredFields = ['id', 'name', 'type', 'language', 'filePath'];
    const missingFields = requiredFields.filter(field => !(field in received));

    if (missingFields.length > 0) {
      return {
        message: () => `Entity missing required fields: ${missingFields.join(', ')}`,
        pass: false
      };
    }

    return {
      message: () => `Entity has valid structure`,
      pass: true
    };
  },

  toMatchLanguagePatterns(received: ParsedEntity, language: SupportedLanguage) {
    const patterns = getLanguagePatterns(language);
    const entityPattern = patterns[received.type];

    if (!entityPattern) {
      return {
        message: () => `No pattern defined for ${received.type} in ${language}`,
        pass: false
      };
    }

    const matches = entityPattern.test(received);
    return {
      message: () => `Entity ${matches ? 'matches' : 'does not match'} ${language} patterns`,
      pass: matches
    };
  }
});
```

### Performance Testing Framework

#### Parser Performance Benchmarks
```typescript
describe('Parser Performance Benchmarks', () => {
  const performanceTargets = {
    python: { filesPerSecond: 150, memoryMB: 200 },
    c: { filesPerSecond: 100, memoryMB: 100 },
    cpp: { filesPerSecond: 75, memoryMB: 250 }
  };

  Object.entries(performanceTargets).forEach(([language, targets]) => {
    test(`${language} parser meets performance targets`, async () => {
      const testFiles = generateTestFiles(language, 100); // 100 test files
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      const results = await Promise.all(
        testFiles.map(file => parser.parse(file.content, language as SupportedLanguage))
      );

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      const duration = (endTime - startTime) / 1000; // seconds
      const filesPerSecond = testFiles.length / duration;
      const memoryUsedMB = (endMemory - startMemory) / 1024 / 1024;

      expect(filesPerSecond).toBeGreaterThanOrEqual(targets.filesPerSecond);
      expect(memoryUsedMB).toBeLessThanOrEqual(targets.memoryMB);
      expect(results).toHaveLength(testFiles.length);

      results.forEach(result => {
        expect(result.entities.length).toBeGreaterThan(0);
      });
    });
  });
});
```

## 3. Level 2: Integration Testing

### Multi-Agent Communication Testing

#### Agent Integration Test Framework
```typescript
describe('Multi-Agent Integration', () => {
  let testHarness: AgentTestHarness;

  beforeEach(async () => {
    testHarness = new AgentTestHarness();
    await testHarness.initialize();
  });

  afterEach(async () => {
    await testHarness.cleanup();
  });

  test('ParserAgent → IndexerAgent integration', async () => {
    const testFile = createTestFile('python', pythonTestCode);

    // Parse file with ParserAgent
    const parseMessage = testHarness.createMessage('parse_file', {
      filePath: testFile.path,
      language: 'python'
    });

    const parseResult = await testHarness.sendToAgent('parser', parseMessage);
    expect(parseResult.success).toBe(true);
    expect(parseResult.entities).toHaveLength(5);

    // Index entities with IndexerAgent
    const indexMessage = testHarness.createMessage('index_entities', {
      entities: parseResult.entities,
      filePath: testFile.path
    });

    const indexResult = await testHarness.sendToAgent('indexer', indexMessage);
    expect(indexResult.success).toBe(true);
    expect(indexResult.indexedCount).toBe(5);

    // Verify entities are stored correctly
    const queryMessage = testHarness.createMessage('query_entities', {
      filePath: testFile.path
    });

    const queryResult = await testHarness.sendToAgent('query', queryMessage);
    expect(queryResult.entities).toHaveLength(5);
    expect(queryResult.entities).toEqual(
      expect.arrayContaining(parseResult.entities)
    );
  });

  test('Cross-language relationship detection', async () => {
    const pythonFile = createTestFile('python', `
import ctypes
lib = ctypes.CDLL('./math_lib.so')
result = lib.calculate(10, 20)
    `);

    const cFile = createTestFile('c', `
int calculate(int a, int b) {
    return a + b;
}
    `);

    // Parse both files
    const pythonResult = await testHarness.parseFile(pythonFile);
    const cResult = await testHarness.parseFile(cFile);

    // Index both files
    await testHarness.indexEntities(pythonResult.entities);
    await testHarness.indexEntities(cResult.entities);

    // Query for cross-language relationships
    const relationshipQuery = testHarness.createMessage('find_relationships', {
      fromLanguage: 'python',
      toLanguage: 'c',
      relationshipType: 'function_call'
    });

    const relationships = await testHarness.sendToAgent('query', relationshipQuery);

    expect(relationships.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromEntity: expect.objectContaining({ name: 'lib.calculate' }),
          toEntity: expect.objectContaining({ name: 'calculate' }),
          type: 'cross_language_call'
        })
      ])
    );
  });
});
```

### Database Integration Testing

#### SQLite Integration Tests
```typescript
describe('SQLite Database Integration', () => {
  let database: SQLiteManager;

  beforeEach(async () => {
    database = new SQLiteManager(':memory:');
    await database.initialize();
  });

  test('multi-language entity storage and retrieval', async () => {
    const entities = [
      createPythonEntity('function', 'python_func'),
      createCEntity('function', 'c_func'),
      createCppEntity('class', 'CppClass')
    ];

    // Store entities
    await database.storeEntities(entities);

    // Retrieve by language
    const pythonEntities = await database.getEntitiesByLanguage('python');
    const cEntities = await database.getEntitiesByLanguage('c');
    const cppEntities = await database.getEntitiesByLanguage('cpp');

    expect(pythonEntities).toHaveLength(1);
    expect(cEntities).toHaveLength(1);
    expect(cppEntities).toHaveLength(1);

    // Cross-language queries
    const allFunctions = await database.getEntitiesByType('function');
    expect(allFunctions).toHaveLength(2); // Python and C functions

    const allEntities = await database.getAllEntities();
    expect(allEntities).toHaveLength(3);
  });

  test('relationship storage across languages', async () => {
    const pythonEntity = createPythonEntity('function', 'wrapper_func');
    const cEntity = createCEntity('function', 'native_func');

    await database.storeEntities([pythonEntity, cEntity]);

    const relationship = {
      fromEntityId: pythonEntity.id,
      toEntityId: cEntity.id,
      type: 'calls',
      metadata: { bindingType: 'ctypes' }
    };

    await database.storeRelationship(relationship);

    const relationships = await database.getRelationshipsForEntity(pythonEntity.id);
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject(relationship);
  });
});
```

### Vector Search Integration Testing

#### Semantic Search Tests
```typescript
describe('Semantic Search Integration', () => {
  let semanticAgent: SemanticAgent;
  let vectorStore: VectorStore;

  beforeEach(async () => {
    vectorStore = new VectorStore(':memory:');
    await vectorStore.initialize();

    semanticAgent = new SemanticAgent(vectorStore);
    await semanticAgent.initialize();
  });

  test('cross-language semantic similarity', async () => {
    const pythonFunction = `
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    `;

    const cFunction = `
void bubble_sort(int arr[], int n) {
    for (int i = 0; i < n-1; i++) {
        for (int j = 0; j < n-i-1; j++) {
            if (arr[j] > arr[j+1]) {
                int temp = arr[j];
                arr[j] = arr[j+1];
                arr[j+1] = temp;
            }
        }
    }
    `;

    const cppFunction = `
template<typename T>
void bubble_sort(std::vector<T>& arr) {
    size_t n = arr.size();
    for (size_t i = 0; i < n-1; i++) {
        for (size_t j = 0; j < n-i-1; j++) {
            if (arr[j] > arr[j+1]) {
                std::swap(arr[j], arr[j+1]);
            }
        }
    }
    `;

    // Generate embeddings
    const pythonEmbedding = await semanticAgent.generateEmbedding(pythonFunction, 'python');
    const cEmbedding = await semanticAgent.generateEmbedding(cFunction, 'c');
    const cppEmbedding = await semanticAgent.generateEmbedding(cppFunction, 'cpp');

    // Store embeddings
    await vectorStore.storeEmbedding('python_bubble_sort', pythonEmbedding);
    await vectorStore.storeEmbedding('c_bubble_sort', cEmbedding);
    await vectorStore.storeEmbedding('cpp_bubble_sort', cppEmbedding);

    // Search for similar functions
    const similarFunctions = await vectorStore.findSimilar(pythonEmbedding, 0.7);

    expect(similarFunctions).toHaveLength(3);
    expect(similarFunctions.map(f => f.id)).toEqual(
      expect.arrayContaining(['python_bubble_sort', 'c_bubble_sort', 'cpp_bubble_sort'])
    );

    // Verify similarity scores
    const similarities = similarFunctions.map(f => f.similarity);
    expect(Math.min(...similarities)).toBeGreaterThan(0.7);
  });
});
```

## 4. Level 3: Performance Testing

### Load Testing Framework

#### Concurrent Operation Testing
```typescript
describe('Performance and Load Testing', () => {
  test('concurrent parsing across multiple languages', async () => {
    const concurrentOperations = 20;
    const filesPerLanguage = 50;

    const testData = {
      python: generateTestFiles('python', filesPerLanguage),
      c: generateTestFiles('c', filesPerLanguage),
      cpp: generateTestFiles('cpp', filesPerLanguage)
    };

    const operations = [];

    // Create concurrent parsing operations
    for (let i = 0; i < concurrentOperations; i++) {
      const language = ['python', 'c', 'cpp'][i % 3] as SupportedLanguage;
      const fileIndex = i % filesPerLanguage;
      const file = testData[language][fileIndex];

      operations.push(
        parser.parse(file.content, language)
      );
    }

    const startTime = performance.now();
    const results = await Promise.all(operations);
    const endTime = performance.now();

    const totalDuration = (endTime - startTime) / 1000;
    const operationsPerSecond = concurrentOperations / totalDuration;

    expect(operationsPerSecond).toBeGreaterThan(100); // Target: 100+ ops/second
    expect(results).toHaveLength(concurrentOperations);

    results.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.entities.length).toBeGreaterThan(0);
    });
  });

  test('memory usage under sustained load', async () => {
    const baselineMemory = process.memoryUsage().heapUsed;
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const language = ['python', 'c', 'cpp'][i % 3] as SupportedLanguage;
      const testFile = generateTestFile(language);

      await parser.parse(testFile.content, language);

      // Check memory usage every 100 iterations
      if (i % 100 === 0) {
        const currentMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = (currentMemory - baselineMemory) / 1024 / 1024;

        expect(memoryIncrease).toBeLessThan(1024); // <1GB total
      }
    }

    // Force garbage collection and verify memory cleanup
    if (global.gc) {
      global.gc();
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - baselineMemory) / 1024 / 1024;

    expect(memoryIncrease).toBeLessThan(100); // <100MB increase after GC
  });
});
```

### Performance Regression Testing

#### Baseline Performance Tracking
```typescript
class PerformanceBaseline {
  private static baselines: Map<string, PerformanceMetric> = new Map();

  static async recordBaseline(testName: string, operation: () => Promise<any>): Promise<PerformanceMetric> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    const result = await operation();

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const metric = {
      duration: endTime - startTime,
      memoryUsed: endMemory - startMemory,
      timestamp: Date.now(),
      result
    };

    this.baselines.set(testName, metric);
    return metric;
  }

  static async compareToBaseline(testName: string, operation: () => Promise<any>): Promise<PerformanceComparison> {
    const baseline = this.baselines.get(testName);
    if (!baseline) {
      throw new Error(`No baseline found for test: ${testName}`);
    }

    const current = await this.recordBaseline(`${testName}_current`, operation);

    return {
      baseline,
      current,
      durationChange: (current.duration - baseline.duration) / baseline.duration,
      memoryChange: (current.memoryUsed - baseline.memoryUsed) / baseline.memoryUsed,
      withinThreshold: {
        duration: Math.abs((current.duration - baseline.duration) / baseline.duration) < 0.1, // 10% threshold
        memory: Math.abs((current.memoryUsed - baseline.memoryUsed) / baseline.memoryUsed) < 0.2  // 20% threshold
      }
    };
  }
}

describe('Performance Regression Testing', () => {
  beforeAll(async () => {
    // Record baselines for Python (already implemented)
    await PerformanceBaseline.recordBaseline('python_parsing', async () => {
      const testFiles = generateTestFiles('python', 100);
      return Promise.all(testFiles.map(f => parser.parse(f.content, 'python')));
    });
  });

  test('C parsing performance does not regress Python performance', async () => {
    // Implement C parsing
    await implementCParsing();

    // Test Python performance after C implementation
    const comparison = await PerformanceBaseline.compareToBaseline('python_parsing', async () => {
      const testFiles = generateTestFiles('python', 100);
      return Promise.all(testFiles.map(f => parser.parse(f.content, 'python')));
    });

    expect(comparison.withinThreshold.duration).toBe(true);
    expect(comparison.withinThreshold.memory).toBe(true);
    expect(comparison.durationChange).toBeLessThan(0.1); // <10% slower
  });
});
```

## 5. Level 4: End-to-End Testing

### Real-World Repository Testing

#### Repository Test Suite
```typescript
describe('Real-World Repository Testing', () => {
  const testRepositories = [
    {
      name: 'python-large',
      url: 'https://github.com/django/django.git',
      expectedFiles: 1000,
      expectedEntities: 10000,
      languages: ['python']
    },
    {
      name: 'c-kernel',
      url: 'https://github.com/torvalds/linux.git',
      path: 'kernel/',
      expectedFiles: 500,
      expectedEntities: 5000,
      languages: ['c']
    },
    {
      name: 'cpp-large',
      url: 'https://github.com/llvm/llvm-project.git',
      path: 'llvm/lib/',
      expectedFiles: 800,
      expectedEntities: 8000,
      languages: ['cpp']
    },
    {
      name: 'multi-language',
      url: 'https://github.com/numpy/numpy.git',
      expectedFiles: 1200,
      expectedEntities: 12000,
      languages: ['python', 'c', 'cpp']
    }
  ];

  testRepositories.forEach(repo => {
    test(`${repo.name} repository analysis`, async () => {
      const startTime = performance.now();

      // Clone or use cached repository
      const repoPath = await prepareRepository(repo);

      // Index repository
      const indexResult = await indexRepository(repoPath);

      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000;

      // Validate results
      expect(indexResult.filesProcessed).toBeGreaterThan(repo.expectedFiles * 0.8);
      expect(indexResult.entitiesExtracted).toBeGreaterThan(repo.expectedEntities * 0.8);
      expect(indexResult.errors).toHaveLength(0);

      // Validate performance
      const filesPerSecond = indexResult.filesProcessed / duration;
      expect(filesPerSecond).toBeGreaterThan(50); // Minimum throughput

      // Validate language distribution
      repo.languages.forEach(language => {
        const langStats = indexResult.languageStats[language];
        expect(langStats.files).toBeGreaterThan(0);
        expect(langStats.entities).toBeGreaterThan(0);
      });
    });
  });
});
```

### User Workflow Testing

#### MCP Client Workflow Tests
```typescript
describe('MCP Client Workflow Testing', () => {
  let mcpClient: MCPClient;

  beforeEach(async () => {
    mcpClient = new MCPClient();
    await mcpClient.connect();
  });

  afterEach(async () => {
    await mcpClient.disconnect();
  });

  test('complete multi-language analysis workflow', async () => {
    // Step 1: Index a multi-language repository
    const indexRequest = {
      tool: 'mcp__codegraph__index',
      arguments: {
        directory: '/test/multi-language-repo',
        incremental: false
      }
    };

    const indexResult = await mcpClient.callTool(indexRequest);
    expect(indexResult.success).toBe(true);

    // Step 2: Query for entities across languages
    const queryRequest = {
      tool: 'mcp__codegraph__query',
      arguments: {
        query: 'find all functions that contain sorting algorithms',
        limit: 10
      }
    };

    const queryResult = await mcpClient.callTool(queryRequest);
    expect(queryResult.entities).toBeDefined();
    expect(queryResult.entities.length).toBeGreaterThan(0);

    // Step 3: Semantic search across languages
    const semanticRequest = {
      tool: 'mcp__codegraph__semantic_search',
      arguments: {
        query: 'bubble sort implementation',
        limit: 5
      }
    };

    const semanticResult = await mcpClient.callTool(semanticRequest);
    expect(semanticResult.results).toBeDefined();

    // Step 4: Analyze relationships
    const relationshipRequest = {
      tool: 'mcp__codegraph__list_entity_relationships',
      arguments: {
        entityName: queryResult.entities[0].name,
        depth: 2
      }
    };

    const relationshipResult = await mcpClient.callTool(relationshipRequest);
    expect(relationshipResult.relationships).toBeDefined();

    // Step 5: Performance metrics
    const metricsRequest = {
      tool: 'mcp__codegraph__get_metrics',
      arguments: {}
    };

    const metricsResult = await mcpClient.callTool(metricsRequest);
    expect(metricsResult.resources).toBeDefined();
    expect(metricsResult.resources.memory.percentage).toBeLessThan(80);
  });

  test('error handling and recovery workflow', async () => {
    // Test with invalid directory
    const invalidRequest = {
      tool: 'mcp__codegraph__index',
      arguments: {
        directory: '/nonexistent/directory'
      }
    };

    const result = await mcpClient.callTool(invalidRequest);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    // Verify system remains stable
    const healthRequest = {
      tool: 'mcp__codegraph__get_metrics',
      arguments: {}
    };

    const healthResult = await mcpClient.callTool(healthRequest);
    expect(healthResult.resources).toBeDefined();
  });
});
```

## 6. Testing Infrastructure and Automation

### CI/CD Integration

#### GitHub Actions Workflow
```yaml
name: Multi-Language Parser Testing

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run unit tests
      run: npm run test:unit

    - name: Check test coverage
      run: npm run test:coverage
      env:
        COVERAGE_THRESHOLD: 90

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests

    steps:
    - uses: actions/checkout@v3

    - name: Setup test environment
      run: |
        npm ci
        npm run build
        npm run test:setup

    - name: Run integration tests
      run: npm run test:integration

    - name: Validate performance
      run: npm run test:performance

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]

    steps:
    - uses: actions/checkout@v3

    - name: Setup E2E environment
      run: |
        npm ci
        npm run build
        docker-compose up -d

    - name: Run E2E tests
      run: npm run test:e2e

    - name: Collect test artifacts
      if: failure()
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: test-results/
```

### Test Data Management

#### Test File Generators
```typescript
class TestFileGenerator {
  static generatePythonFile(complexity: 'simple' | 'medium' | 'complex'): TestFile {
    const templates = {
      simple: `
def simple_function(x: int) -> int:
    return x * 2

class SimpleClass:
    def __init__(self, value: int):
        self.value = value
      `,
      medium: `
import asyncio
from typing import Optional, List, Dict

@dataclass
class MediumClass(BaseClass):
    value: int = 0

    async def async_method(self) -> Optional[Dict[str, List[int]]]:
        return await self.complex_operation()
      `,
      complex: `
from typing import TypeVar, Generic, Protocol, overload
import asyncio
from contextlib import asynccontextmanager

T = TypeVar('T')
U = TypeVar('U', bound=str)

class ComplexProtocol(Protocol[T]):
    async def process(self, item: T) -> U: ...

@asynccontextmanager
async def complex_context_manager():
    # Complex implementation with async generators
    async for item in async_generator():
        yield await process_item(item)
      `
    };

    return {
      content: templates[complexity],
      language: 'python',
      expectedEntities: complexity === 'simple' ? 3 : complexity === 'medium' ? 5 : 10
    };
  }

  static generateCFile(complexity: 'simple' | 'medium' | 'complex'): TestFile {
    const templates = {
      simple: `
#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

struct Point {
    int x, y;
};
      `,
      medium: `
#include <stdio.h>
#include <stdlib.h>

#define MAX_SIZE 1024
#define MIN(a, b) ((a) < (b) ? (a) : (b))

typedef struct {
    int* data;
    size_t size;
    size_t capacity;
} vector_t;

static vector_t* vector_create(size_t initial_capacity);
static void vector_destroy(vector_t* vec);
static int vector_push(vector_t* vec, int value);
      `,
      complex: `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef int (*comparator_func)(const void*, const void*);
typedef void (*destructor_func)(void*);

typedef struct node {
    void* data;
    struct node* next;
    struct node* prev;
} node_t;

typedef struct {
    node_t* head;
    node_t* tail;
    size_t size;
    comparator_func compare;
    destructor_func destroy;
} list_t;

#ifdef __cplusplus
}
#endif
      `
    };

    return {
      content: templates[complexity],
      language: 'c',
      expectedEntities: complexity === 'simple' ? 3 : complexity === 'medium' ? 8 : 15
    };
  }
}
```

### Quality Gates and Metrics

#### Test Quality Validation
```typescript
class TestQualityValidator {
  private static readonly QUALITY_THRESHOLDS = {
    unitTestCoverage: 90,
    integrationTestCoverage: 85,
    performanceRegressionThreshold: 0.1, // 10%
    memoryLeakThreshold: 50 * 1024 * 1024, // 50MB
    errorRate: 0.01 // 1%
  };

  static async validateTestSuite(): Promise<QualityReport> {
    const coverage = await this.getCoverageMetrics();
    const performance = await this.getPerformanceMetrics();
    const reliability = await this.getReliabilityMetrics();

    return {
      coverage: {
        unit: coverage.unit,
        integration: coverage.integration,
        passing: coverage.unit >= this.QUALITY_THRESHOLDS.unitTestCoverage &&
                coverage.integration >= this.QUALITY_THRESHOLDS.integrationTestCoverage
      },
      performance: {
        regression: performance.regression,
        memoryLeak: performance.memoryLeak,
        passing: performance.regression <= this.QUALITY_THRESHOLDS.performanceRegressionThreshold &&
                performance.memoryLeak <= this.QUALITY_THRESHOLDS.memoryLeakThreshold
      },
      reliability: {
        errorRate: reliability.errorRate,
        passing: reliability.errorRate <= this.QUALITY_THRESHOLDS.errorRate
      }
    };
  }
}
```

## 7. Testing Schedule and Implementation

### Phase-Based Testing Implementation

#### Phase 2 (C Language) - Testing Implementation
- **Week 4**: Unit tests for C parser, basic integration tests
- **Week 5**: Performance tests, cross-language integration tests
- **Quality Gate**: 90% unit test coverage, performance targets met

#### Phase 3 (C++ Language) - Testing Implementation
- **Weeks 6-7**: Unit tests for C++ parser, template testing
- **Weeks 8-9**: Complex integration tests, full performance validation
- **Quality Gate**: All testing levels complete, production readiness

#### Phase 4 (Integration) - Testing Validation
- **Week 10**: E2E testing, real-world repository validation
- **Quality Gate**: Full test suite passing, performance validated

### Continuous Testing Strategy

#### Daily Testing
- **Unit Tests**: Run on every commit
- **Integration Tests**: Run on every PR
- **Performance Tests**: Run nightly
- **Regression Tests**: Run on release branches

#### Weekly Testing
- **E2E Tests**: Full workflow validation
- **Load Tests**: Sustained performance validation
- **Security Tests**: Vulnerability scanning
- **Compatibility Tests**: Cross-platform validation

## Success Metrics and Validation

### Testing Success Criteria

#### Coverage Targets
- **Unit Test Coverage**: >90% per language parser
- **Integration Test Coverage**: >85% for cross-language features
- **E2E Test Coverage**: 100% critical user workflows
- **Performance Test Coverage**: 100% performance-critical paths

#### Quality Targets
- **Test Reliability**: <1% flaky test rate
- **Test Performance**: <5 minutes for full test suite
- **Bug Detection**: >95% bug detection before production
- **Regression Prevention**: 100% regression detection

#### Performance Targets
- **Test Execution Time**: <30 seconds for unit tests
- **CI/CD Pipeline**: <10 minutes total
- **Feedback Loop**: <2 minutes for basic validation
- **Full Validation**: <1 hour for complete test suite

## Next Steps

### Immediate Actions (Post-TASK-002C)
1. **TASK-002D**: Implementation roadmap and success criteria
2. **TASK-002E**: Architecture decision record (ADR-001)
3. **Test Infrastructure Setup**: Implement testing framework
4. **CI/CD Configuration**: Set up automated testing pipeline

### Implementation Integration
1. **Test-Driven Development**: Implement tests before features
2. **Continuous Integration**: Automate all testing levels
3. **Quality Monitoring**: Track testing metrics continuously
4. **Regular Reviews**: Weekly test quality assessments

---

**Document Status**: ✅ COMPLETED - TASK-002C Testing Strategy
**Dependencies**: Risk Mitigation Plan ✅, TASK-002B Resource Allocation ✅
**Next Phase**: Quality Assurance Protocols and Validation Matrix
**Coverage**: Comprehensive 4-level testing framework for multi-language support