# Testing Strategy

## Overview

Comprehensive testing strategy for the Code Graph RAG MCP project, covering unit tests, integration tests, performance tests, and end-to-end validation of the multi-agent system.

## 🎯 Testing Objectives

### Primary Goals
- **Reliability**: Ensure all MCP tools function correctly
- **Performance**: Validate speed and memory targets
- **Scalability**: Test with large codebases
- **Robustness**: Handle edge cases and errors gracefully

### Quality Targets
- **Code Coverage**: >85% for core components
- **Performance**: Meet commodity hardware targets
- **Reliability**: <1% failure rate for common operations
- **User Experience**: Intuitive and helpful responses

## 🏗️ Testing Architecture

### Test Categories

```
┌─────────────────┐
│   Unit Tests    │  ← Individual components
└─────────────────┘
         │
┌─────────────────┐
│Integration Tests│  ← Component interaction
└─────────────────┘
         │
┌─────────────────┐
│Performance Tests│  ← Speed and memory
└─────────────────┘
         │
┌─────────────────┐
│  E2E Tests      │  ← Complete workflows
└─────────────────┘
```

### Test Environment Setup

```typescript
// Test configuration
interface TestConfig {
  database: {
    inMemory: boolean;
    testDataPath: string;
  };
  agents: {
    mockMode: boolean;
    timeoutMs: number;
  };
  performance: {
    benchmarkMode: boolean;
    memoryLimit: number;
  };
}

const testConfig: TestConfig = {
  database: {
    inMemory: true,
    testDataPath: './test-data'
  },
  agents: {
    mockMode: process.env.TEST_MOCK_AGENTS === 'true',
    timeoutMs: 5000
  },
  performance: {
    benchmarkMode: process.env.TEST_BENCHMARK === 'true',
    memoryLimit: 256 * 1024 * 1024 // 256MB
  }
};
```

## 🧪 Unit Testing

### Core Component Tests

#### Graph Storage Tests

```typescript
describe('GraphStorage', () => {
  let storage: GraphStorageImpl;
  let db: SQLiteManager;

  beforeEach(async () => {
    db = new SQLiteManager({ path: ':memory:' });
    db.initialize();
    runMigrations(db);
    storage = new GraphStorageImpl(db);
  });

  describe('entity operations', () => {
    it('should store and retrieve entities', async () => {
      const entity: Entity = {
        id: 'test-1',
        name: 'testFunction',
        type: 'function',
        file: 'test.ts',
        startLine: 1,
        endLine: 5,
        signature: 'function testFunction(): void'
      };

      await storage.storeEntity(entity);
      const retrieved = await storage.getEntity('test-1');

      expect(retrieved).toEqual(entity);
    });

    it('should handle entity updates', async () => {
      const entity: Entity = {
        id: 'test-1',
        name: 'testFunction',
        type: 'function',
        file: 'test.ts',
        startLine: 1,
        endLine: 5
      };

      await storage.storeEntity(entity);
      
      const updated = { ...entity, endLine: 10 };
      await storage.storeEntity(updated);
      
      const retrieved = await storage.getEntity('test-1');
      expect(retrieved?.endLine).toBe(10);
    });
  });

  describe('relationship operations', () => {
    it('should store and query relationships', async () => {
      const relationship: Relationship = {
        fromId: 'entity-1',
        toId: 'entity-2',
        type: 'calls',
        metadata: { lineNumber: 10 }
      };

      await storage.storeRelationship(relationship);
      const relationships = await storage.getRelationships('entity-1');

      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toEqual(relationship);
    });
  });
});
```

#### Parser Agent Tests

```typescript
describe('ParserAgent', () => {
  let agent: ParserAgent;
  let mockExtractor: jest.Mocked<EntityExtractor>;

  beforeEach(() => {
    mockExtractor = createMockExtractor();
    agent = new ParserAgent(mockExtractor);
  });

  describe('file parsing', () => {
    it('should parse TypeScript files correctly', async () => {
      const sourceCode = `
        function hello(name: string): string {
          return \`Hello, \${name}!\`;
        }
      `;

      const result = await agent.parseFile('test.ts', sourceCode);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('hello');
      expect(result.entities[0].type).toBe('function');
    });

    it('should handle parse errors gracefully', async () => {
      const invalidCode = 'function incomplete(';
      
      const result = await agent.parseFile('invalid.ts', invalidCode);
      
      expect(result.hasErrors).toBe(true);
      expect(result.entities).toEqual([]);
    });

    it('should extract function calls', async () => {
      const sourceCode = `
        function caller() {
          callee();
        }
        function callee() {}
      `;

      const result = await agent.parseFile('test.ts', sourceCode);

      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0].type).toBe('calls');
    });
  });

  describe('batch processing', () => {
    it('should process multiple files efficiently', async () => {
      const files = [
        { path: 'file1.ts', content: 'function f1() {}' },
        { path: 'file2.ts', content: 'function f2() {}' },
        { path: 'file3.ts', content: 'function f3() {}' }
      ];

      const startTime = Date.now();
      const results = await agent.parseFiles(files);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(duration).toBeLessThan(1000); // Should complete in <1s
    });
  });
});
```

#### Vector Store Tests

```typescript
describe('VectorStore', () => {
  let vectorStore: FAISSVectorStore;
  let embeddingModel: MockEmbeddingModel;

  beforeEach(() => {
    embeddingModel = new MockEmbeddingModel();
    vectorStore = new FAISSVectorStore(384);
  });

  describe('embedding operations', () => {
    it('should add and search embeddings', async () => {
      const embeddings = [
        { id: 'entity-1', vector: generateMockEmbedding(), metadata: { type: 'function' } },
        { id: 'entity-2', vector: generateMockEmbedding(), metadata: { type: 'class' } }
      ];

      await vectorStore.addEmbeddings(embeddings);
      
      const query = generateMockEmbedding();
      const results = await vectorStore.search(query, 5);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBeTruthy();
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should handle similarity search correctly', async () => {
      const embedding1 = [1, 0, 0, ...Array(381).fill(0)];
      const embedding2 = [0, 1, 0, ...Array(381).fill(0)];
      const similarToFirst = [0.9, 0.1, 0, ...Array(381).fill(0)];

      await vectorStore.addEmbeddings([
        { id: 'similar', vector: embedding1, metadata: {} },
        { id: 'different', vector: embedding2, metadata: {} }
      ]);

      const results = await vectorStore.search(similarToFirst, 2);
      
      expect(results[0].id).toBe('similar');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });
});
```

### Agent Tests

#### Conductor Agent Tests

```typescript
describe('ConductorOrchestrator', () => {
  let conductor: ConductorOrchestrator;
  let mockAgents: MockAgentPool;

  beforeEach(() => {
    mockAgents = createMockAgentPool();
    conductor = new ConductorOrchestrator(mockAgents);
  });

  describe('task orchestration', () => {
    it('should generate method proposals', async () => {
      const task = 'analyze codebase and identify performance bottlenecks';
      
      const proposals = await conductor.generateMethodProposals(task);
      
      expect(proposals).toHaveLength(5);
      proposals.forEach(proposal => {
        expect(proposal).toHaveProperty('title');
        expect(proposal).toHaveProperty('complexity');
        expect(proposal).toHaveProperty('effort');
        expect(proposal.complexity).toBeGreaterThan(0);
        expect(proposal.complexity).toBeLessThanOrEqual(10);
      });
    });

    it('should delegate tasks to appropriate agents', async () => {
      const task: AnalysisTask = {
        type: 'parse-files',
        files: ['test.ts'],
        priority: 'normal'
      };

      const result = await conductor.delegateTask(task);
      
      expect(result.success).toBe(true);
      expect(result.agentName).toBe('parser-agent');
      expect(mockAgents.getParserAgent().process).toHaveBeenCalledWith(task);
    });

    it('should handle complex multi-step tasks', async () => {
      const complexTask = 'implement new semantic search feature';
      
      const execution = await conductor.executeComplexTask(complexTask);
      
      expect(execution.tasks).toHaveLength(5);
      expect(execution.adrs).toHaveLength(1);
      expect(execution.taskIds).toContain('TASK-');
    });
  });

  describe('approval workflow', () => {
    it('should require approval for high complexity tasks', async () => {
      const highComplexityTask = 'completely redesign the architecture';
      
      const proposals = await conductor.generateMethodProposals(highComplexityTask);
      const selectedProposal = proposals.find(p => p.complexity > 5);
      
      expect(selectedProposal).toBeTruthy();
      
      const requiresApproval = conductor.requiresApproval(selectedProposal!);
      expect(requiresApproval).toBe(true);
    });
  });
});
```

## 🔗 Integration Testing

### MCP Tool Integration

```typescript
describe('MCP Tool Integration', () => {
  let server: MCPServer;
  let client: MCPTestClient;

  beforeEach(async () => {
    server = await createTestMCPServer();
    client = new MCPTestClient(server);
    await client.connect();
  });

  afterEach(async () => {
    await client.disconnect();
    await server.shutdown();
  });

  describe('index tool', () => {
    it('should index a test codebase', async () => {
      const testRepo = await createTestRepository();
      
      const result = await client.callTool('index', {
        path: testRepo.path,
        recursive: true
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('indexed successfully');
      
      // Verify database state
      const stats = await client.callTool('get_metrics', {});
      expect(stats.content[0].text).toContain('entities');
    });
  });

  describe('query tool', () => {
    it('should query indexed entities', async () => {
      // Index test data first
      await indexTestData(client);
      
      const result = await client.callTool('query', {
        query: 'functions that call setTimeout',
        entity_types: ['function']
      });

      expect(result.isError).toBe(false);
      const response = JSON.parse(result.content[0].text);
      expect(response.entities).toBeInstanceOf(Array);
    });
  });

  describe('semantic_search tool', () => {
    it('should perform semantic search', async () => {
      await indexTestData(client);
      await generateTestEmbeddings(client);
      
      const result = await client.callTool('semantic_search', {
        query: 'database connection functions',
        limit: 10
      });

      expect(result.isError).toBe(false);
      const response = JSON.parse(result.content[0].text);
      expect(response.results).toBeInstanceOf(Array);
    });
  });

  describe('agent coordination', () => {
    it('should coordinate multiple agents for complex queries', async () => {
      const result = await client.callTool('analyze_code_impact', {
        changed_files: ['src/database.ts'],
        analysis_depth: 'deep'
      });

      expect(result.isError).toBe(false);
      
      // Should involve multiple agents
      const metrics = await client.callTool('get_metrics', {});
      const metricsData = JSON.parse(metrics.content[0].text);
      expect(metricsData.agents_active).toBeGreaterThan(1);
    });
  });
});
```

### Database Integration

```typescript
describe('Database Integration', () => {
  let db: SQLiteManager;
  let storage: GraphStorageImpl;

  beforeEach(async () => {
    db = new SQLiteManager({ path: ':memory:' });
    db.initialize();
    runMigrations(db);
    storage = new GraphStorageImpl(db);
  });

  describe('concurrent operations', () => {
    it('should handle concurrent reads and writes', async () => {
      const entities = generateTestEntities(100);
      
      // Concurrent writes
      const writePromises = entities.map(entity => 
        storage.storeEntity(entity)
      );
      
      // Concurrent reads
      const readPromises = Array(50).fill(0).map(() =>
        storage.getAllEntities()
      );

      await Promise.all([...writePromises, ...readPromises]);
      
      const finalCount = await storage.getEntityCount();
      expect(finalCount).toBe(100);
    });
  });

  describe('transaction handling', () => {
    it('should rollback failed transactions', async () => {
      const entities = generateTestEntities(10);
      
      try {
        await db.transaction(async (tx) => {
          for (const entity of entities.slice(0, 5)) {
            await storage.storeEntity(entity);
          }
          
          // Simulate error
          throw new Error('Simulated failure');
        });
      } catch (error) {
        // Expected
      }
      
      const count = await storage.getEntityCount();
      expect(count).toBe(0); // All rolled back
    });
  });
});
```

## ⚡ Performance Testing

### Benchmarking Framework

```typescript
describe('Performance Benchmarks', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  describe('parsing performance', () => {
    it('should parse files within target time', async () => {
      const files = await generateTestFiles(100); // 100 test files
      
      const benchmark = await performanceMonitor.benchmark(
        'file-parsing',
        async () => {
          const parser = new ParserAgent();
          return await parser.parseFiles(files);
        }
      );

      expect(benchmark.duration).toBeLessThan(1000); // <1s for 100 files
      expect(benchmark.memoryUsed).toBeLessThan(512 * 1024 * 1024); // <512MB
      expect(benchmark.throughput).toBeGreaterThan(100); // >100 files/second
    });
  });

  describe('query performance', () => {
    it('should execute queries within target time', async () => {
      await indexLargeCodebase();
      
      const benchmark = await performanceMonitor.benchmark(
        'entity-query',
        async () => {
          return await storage.findEntities({
            type: 'function',
            namePattern: 'test*'
          });
        }
      );

      expect(benchmark.duration).toBeLessThan(100); // <100ms
    });
  });

  describe('vector search performance', () => {
    it('should perform semantic search within target time', async () => {
      const vectorStore = await setupVectorStoreWithData(10000); // 10k entities
      
      const benchmark = await performanceMonitor.benchmark(
        'vector-search',
        async () => {
          const query = generateRandomEmbedding();
          return await vectorStore.search(query, 20);
        }
      );

      expect(benchmark.duration).toBeLessThan(100); // <100ms
      expect(benchmark.results.length).toBe(20);
    });
  });

  describe('memory usage', () => {
    it('should stay within memory limits during large operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process large dataset
      await processLargeCodebase();
      
      const peakMemory = performanceMonitor.getPeakMemoryUsage();
      const memoryIncrease = peakMemory - initialMemory;
      
      expect(memoryIncrease).toBeLessThan(1024 * 1024 * 1024); // <1GB increase
    });
  });
});
```

### Load Testing

```typescript
describe('Load Testing', () => {
  let server: MCPServer;

  beforeEach(async () => {
    server = await createTestMCPServer();
  });

  describe('concurrent client handling', () => {
    it('should handle multiple concurrent clients', async () => {
      const clientCount = 10;
      const clients = await Promise.all(
        Array(clientCount).fill(0).map(() => createTestClient(server))
      );

      // Concurrent operations
      const operations = clients.map(async (client, index) => {
        return await client.callTool('query', {
          query: `test query ${index}`,
          limit: 10
        });
      });

      const results = await Promise.all(operations);
      
      // All should succeed
      results.forEach(result => {
        expect(result.isError).toBe(false);
      });

      // Cleanup
      await Promise.all(clients.map(client => client.disconnect()));
    });
  });

  describe('sustained load', () => {
    it('should maintain performance under sustained load', async () => {
      const client = await createTestClient(server);
      const operationCount = 1000;
      const startTime = Date.now();

      for (let i = 0; i < operationCount; i++) {
        const result = await client.callTool('get_metrics', {});
        expect(result.isError).toBe(false);
      }

      const duration = Date.now() - startTime;
      const opsPerSecond = (operationCount / duration) * 1000;
      
      expect(opsPerSecond).toBeGreaterThan(10); // >10 ops/second
    });
  });
});
```

## 🔄 End-to-End Testing

### Complete Workflow Tests

```typescript
describe('End-to-End Workflows', () => {
  let testEnvironment: TestEnvironment;

  beforeEach(async () => {
    testEnvironment = await setupCompleteTestEnvironment();
  });

  afterEach(async () => {
    await testEnvironment.cleanup();
  });

  describe('new project analysis', () => {
    it('should analyze a new project from scratch', async () => {
      const projectPath = await createTestProject();
      
      // Step 1: Index the project
      const indexResult = await testEnvironment.client.callTool('index', {
        path: projectPath,
        recursive: true
      });
      expect(indexResult.isError).toBe(false);

      // Step 2: Query entities
      const queryResult = await testEnvironment.client.callTool('query', {
        query: 'all functions',
        entity_types: ['function']
      });
      expect(queryResult.isError).toBe(false);

      // Step 3: Semantic search
      const semanticResult = await testEnvironment.client.callTool('semantic_search', {
        query: 'authentication functions',
        limit: 5
      });
      expect(semanticResult.isError).toBe(false);

      // Step 4: Impact analysis
      const impactResult = await testEnvironment.client.callTool('analyze_code_impact', {
        changed_files: ['src/auth.ts']
      });
      expect(impactResult.isError).toBe(false);
    });
  });

  describe('incremental updates', () => {
    it('should handle file changes correctly', async () => {
      // Initial index
      await testEnvironment.indexTestProject();
      
      // Modify a file
      const newContent = `
        function newFunction() {
          return "updated";
        }
      `;
      await testEnvironment.writeFile('src/new.ts', newContent);
      
      // Re-index
      const reindexResult = await testEnvironment.client.callTool('index', {
        path: testEnvironment.projectPath,
        incremental: true
      });
      expect(reindexResult.isError).toBe(false);

      // Query for new function
      const queryResult = await testEnvironment.client.callTool('query', {
        query: 'newFunction',
        entity_types: ['function']
      });
      
      const entities = JSON.parse(queryResult.content[0].text);
      expect(entities.entities).toHaveLength(1);
      expect(entities.entities[0].name).toBe('newFunction');
    });
  });

  describe('error recovery', () => {
    it('should recover from temporary failures', async () => {
      // Simulate database corruption
      await testEnvironment.corruptDatabase();
      
      // Try to query (should fail)
      const failedQuery = await testEnvironment.client.callTool('query', {
        query: 'test'
      });
      expect(failedQuery.isError).toBe(true);

      // Repair and re-index
      await testEnvironment.repairDatabase();
      const reindexResult = await testEnvironment.client.callTool('index', {
        path: testEnvironment.projectPath,
        force_rebuild: true
      });
      expect(reindexResult.isError).toBe(false);

      // Query should work again
      const recoveredQuery = await testEnvironment.client.callTool('query', {
        query: 'test'
      });
      expect(recoveredQuery.isError).toBe(false);
    });
  });
});
```

## 🔧 Test Configuration

### Jest Configuration

```javascript
// jest.config.js
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/__tests__/**/*.spec.ts"
  ],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  testTimeout: 30000,
  verbose: true
};
```

### Test Environment Variables

```bash
# Test configuration
NODE_ENV=test
LOG_LEVEL=error

# Database configuration
TEST_DB_PATH=:memory:
TEST_DATA_PATH=./test-data

# Agent configuration
TEST_MOCK_AGENTS=false
TEST_AGENT_TIMEOUT=5000

# Performance configuration
TEST_BENCHMARK=true
TEST_MEMORY_LIMIT=512

# Vector store configuration
TEST_VECTOR_BACKEND=mock
TEST_EMBEDDING_MODEL=mock
```

## 📊 Test Reporting

### Coverage Reports

```bash
# Generate coverage reports
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

### Performance Reports

```typescript
export class TestReporter {
  generatePerformanceReport(benchmarks: Benchmark[]): PerformanceReport {
    return {
      summary: {
        totalTests: benchmarks.length,
        averageDuration: this.calculateAverage(benchmarks.map(b => b.duration)),
        peakMemoryUsage: Math.max(...benchmarks.map(b => b.memoryUsed)),
        throughput: this.calculateThroughput(benchmarks)
      },
      details: benchmarks.map(benchmark => ({
        name: benchmark.name,
        duration: benchmark.duration,
        memoryUsed: benchmark.memoryUsed,
        throughput: benchmark.throughput,
        status: benchmark.duration < benchmark.target ? 'PASS' : 'FAIL'
      })),
      recommendations: this.generateRecommendations(benchmarks)
    };
  }
}
```

## 🚀 Continuous Integration

### GitHub Actions Workflow

```yaml
name: Test Suite

on:
  push:
    branches: [ master, develop ]
  pull_request:
    branches: [ master ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Run unit tests
      run: npm run test:unit
      
    - name: Run integration tests
      run: npm run test:integration
      
    - name: Run performance tests
      run: npm run test:performance
      
    - name: Generate coverage
      run: npm run test:coverage
      
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

---

## Related Documentation
- [Development Workflow](./development_workflow.md)
- [Contributing Guide](../guides/contributing.md)
- [Performance Optimization](../guides/performance_optimization.md)
- [Troubleshooting Guide](../troubleshooting/common_issues.md)