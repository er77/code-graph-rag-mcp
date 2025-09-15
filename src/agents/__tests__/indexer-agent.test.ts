/**
 * TASK-001: Indexer Agent Test Suite
 * 
 * Comprehensive tests for the Indexer Agent including storage,
 * batch operations, caching, and knowledge bus integration.
 * 
 * Architecture References:
 * - Indexer Agent: src/agents/indexer-agent.ts
 * - Storage Types: src/types/storage.ts
 * - Parser Types: src/types/parser.ts
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { IndexerAgent } from '../indexer-agent.js';
import { AgentStatus } from '../../types/agent.js';
import type { ParsedEntity, ParseResult } from '../../types/parser.js';
import type { Entity, GraphQuery, EntityChange } from '../../types/storage.js';
import { EntityType, RelationType } from '../../types/storage.js';
import { knowledgeBus } from '../../core/knowledge-bus.js';
import { resetSQLiteManager } from '../../storage/sqlite-manager.js';
import { resetCacheManager } from '../../storage/cache-manager.js';
import { rmSync, existsSync } from 'node:fs';

// =============================================================================
// 2. TEST CONFIGURATION
// =============================================================================
const TEST_DB_PATH = './data/test-codegraph.db';
const CLEANUP_PATHS = [
  TEST_DB_PATH,
  `${TEST_DB_PATH}-shm`,
  `${TEST_DB_PATH}-wal`
];

// =============================================================================
// 3. TEST FIXTURES
// =============================================================================

const createMockParsedEntity = (
  name: string,
  type: ParsedEntity['type'] = 'function'
): ParsedEntity => ({
  name,
  type,
  location: {
    start: { line: 1, column: 0, index: 0 },
    end: { line: 10, column: 0, index: 100 }
  },
  modifiers: ['export'],
  returnType: 'void',
  parameters: []
});

const createMockParseResult = (filePath: string): ParseResult => ({
  filePath,
  language: 'typescript',
  entities: [
    createMockParsedEntity('testFunction', 'function'),
    createMockParsedEntity('TestClass', 'class'),
    createMockParsedEntity('testMethod', 'method')
  ],
  contentHash: 'test-hash-123',
  timestamp: Date.now(),
  parseTimeMs: 10,
  fromCache: false
});

// =============================================================================
// 4. TEST SUITE
// =============================================================================

describe('IndexerAgent', () => {
  let agent: IndexerAgent;
  
  beforeEach(async () => {
    // Clean up any existing test database
    CLEANUP_PATHS.forEach(path => {
      if (existsSync(path)) {
        rmSync(path);
      }
    });
    
    // Reset singletons
    resetSQLiteManager();
    resetCacheManager();
    
    // Create agent
    agent = new IndexerAgent();
  });
  
  afterEach(async () => {
    // Shutdown agent
    if (agent && agent.status !== AgentStatus.SHUTDOWN) {
      await agent.shutdown();
    }
    
    // Clean up test database
    CLEANUP_PATHS.forEach(path => {
      if (existsSync(path)) {
        rmSync(path);
      }
    });
    
    // Reset singletons
    resetSQLiteManager();
    resetCacheManager();
  });
  
  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await agent.initialize();
      
      expect(agent.status).toBe(AgentStatus.IDLE);
      expect(agent.type).toBe('indexer');
      expect(agent.capabilities.maxConcurrency).toBe(2);
      expect(agent.capabilities.memoryLimit).toBe(512);
    });
    
    test('should subscribe to parse events on initialization', async () => {
      const subscribeSpy = jest.spyOn(knowledgeBus, 'subscribe');
      
      await agent.initialize();
      
      expect(subscribeSpy).toHaveBeenCalledWith(
        expect.stringContaining('indexer'),
        'parse:complete',
        expect.any(Function)
      );
      
      expect(subscribeSpy).toHaveBeenCalledWith(
        expect.stringContaining('indexer'),
        'parse:batch:complete',
        expect.any(Function)
      );
      
      subscribeSpy.mockRestore();
    });
  });
  
  describe('Entity Indexing', () => {
    beforeEach(async () => {
      await agent.initialize();
    });
    
    test('should index entities from parsed results', async () => {
      const parseResult = createMockParseResult('/test/file.ts');
      const result = await agent.indexEntities(
        parseResult.entities,
        parseResult.filePath
      );
      
      expect(result.processed).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should handle batch entity insertion', async () => {
      const entities: ParsedEntity[] = [];
      for (let i = 0; i < 100; i++) {
        entities.push(createMockParsedEntity(`function${i}`, 'function'));
      }
      
      const result = await agent.indexEntities(entities, '/test/large-file.ts');
      
      expect(result.processed).toBe(100);
      expect(result.failed).toBe(0);
    });
    
    test('should build relationships between entities', async () => {
      const entities: ParsedEntity[] = [
        {
          ...createMockParsedEntity('ParentClass', 'class'),
          children: [
            createMockParsedEntity('childMethod', 'method')
          ]
        },
        {
          ...createMockParsedEntity('importFunc', 'import'),
          importData: {
            source: 'module',
            specifiers: [{ local: 'func', imported: 'func' }]
          }
        }
      ];
      
      await agent.indexEntities(entities, '/test/relationships.ts');
      
      // Query to verify relationships were created
      const query: GraphQuery = {
        type: 'relationship',
        filters: {
          relationshipType: [RelationType.CONTAINS, RelationType.IMPORTS]
        }
      };
      
      const result = await agent.queryGraph(query);
      expect(result.relationships.length).toBeGreaterThan(0);
    });
    
    test('should update file info after indexing', async () => {
      const filePath = '/test/tracked-file.ts';
      const entities = [createMockParsedEntity('trackedFunc', 'function')];
      
      await agent.indexEntities(entities, filePath);
      
      // Verify through storage metrics
      const metrics = await agent.getStorageMetrics();
      expect(metrics.totalFiles).toBeGreaterThan(0);
    });
    
    test('should publish index complete event', async () => {
      const publishSpy = jest.spyOn(knowledgeBus, 'publish');
      
      const entities = [createMockParsedEntity('eventFunc', 'function')];
      await agent.indexEntities(entities, '/test/event-file.ts');
      
      expect(publishSpy).toHaveBeenCalledWith(
        'index:complete',
        expect.objectContaining({
          filePath: '/test/event-file.ts',
          entities: 1
        }),
        expect.stringContaining('indexer')
      );
      
      publishSpy.mockRestore();
    });
  });
  
  describe('Incremental Updates', () => {
    beforeEach(async () => {
      await agent.initialize();
    });
    
    test('should handle entity additions', async () => {
      const changes: EntityChange[] = [
        {
          type: 'added',
          entity: {
            id: 'test-id-1',
            name: 'newFunction',
            type: EntityType.FUNCTION,
            filePath: '/test/new.ts',
            location: {
              start: { line: 1, column: 0, index: 0 },
              end: { line: 5, column: 0, index: 50 }
            },
            metadata: {},
            hash: 'new-hash',
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          filePath: '/test/new.ts',
          timestamp: Date.now()
        }
      ];
      
      const result = await agent.incrementalUpdate(changes);
      
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
    });
    
    test('should handle entity modifications', async () => {
      // First, add an entity
      const entity: Entity = {
        id: 'modify-test-id',
        name: 'originalName',
        type: EntityType.FUNCTION,
        filePath: '/test/modify.ts',
        location: {
          start: { line: 1, column: 0, index: 0 },
          end: { line: 5, column: 0, index: 50 }
        },
        metadata: {},
        hash: 'original-hash',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await agent.incrementalUpdate([{
        type: 'added',
        entity,
        filePath: '/test/modify.ts',
        timestamp: Date.now()
      }]);
      
      // Then modify it
      const changes: EntityChange[] = [
        {
          type: 'modified',
          entity: { ...entity, name: 'modifiedName' },
          entityId: 'modify-test-id',
          filePath: '/test/modify.ts',
          timestamp: Date.now()
        }
      ];
      
      const result = await agent.incrementalUpdate(changes);
      
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
    });
    
    test('should handle entity deletions', async () => {
      const changes: EntityChange[] = [
        {
          type: 'deleted',
          entityId: 'delete-test-id',
          filePath: '/test/delete.ts',
          timestamp: Date.now()
        }
      ];
      
      const result = await agent.incrementalUpdate(changes);
      
      // Deletion should succeed even if entity doesn't exist
      expect(result.failed).toBe(0);
    });
  });
  
  describe('Graph Queries', () => {
    beforeEach(async () => {
      await agent.initialize();
      
      // Index some test data
      const entities = [
        createMockParsedEntity('queryFunc1', 'function'),
        createMockParsedEntity('QueryClass', 'class'),
        createMockParsedEntity('queryMethod', 'method')
      ];
      
      await agent.indexEntities(entities, '/test/query-file.ts');
    });
    
    test('should execute entity queries', async () => {
      const query: GraphQuery = {
        type: 'entity',
        filters: {
          entityType: EntityType.FUNCTION
        },
        limit: 10
      };
      
      const result = await agent.queryGraph(query);
      
      expect(result.entities).toBeDefined();
      expect(result.stats.totalEntities).toBeGreaterThan(0);
      expect(result.stats.queryTimeMs).toBeGreaterThan(0);
    });
    
    test('should execute subgraph queries', async () => {
      // Note: Need a valid entity ID for this test
      // In practice, we'd first query for an entity, then use its ID
      const query: GraphQuery = {
        type: 'entity',
        limit: 1
      };
      
      const entities = await agent.queryGraph(query);
      
      if (entities.entities.length > 0) {
        const result = await agent.querySubgraph(entities.entities[0].id, 2);
        
        expect(result.entities).toBeDefined();
        expect(result.relationships).toBeDefined();
      }
    });
    
    test('should cache query results', async () => {
      const query: GraphQuery = {
        type: 'entity',
        filters: {
          entityType: EntityType.CLASS
        }
      };
      
      // First query - not cached
      const result1 = await agent.queryGraph(query);
      
      // Second query - should be cached
      const result2 = await agent.queryGraph(query);
      
      expect(result1).toEqual(result2);
    });
    
    test('should handle complex queries with multiple filters', async () => {
      const query: GraphQuery = {
        type: 'entity',
        filters: {
          entityType: [EntityType.FUNCTION, EntityType.METHOD],
          filePath: '/test/query-file.ts',
          name: /query.*/
        },
        limit: 5,
        offset: 0
      };
      
      const result = await agent.queryGraph(query);
      
      expect(result.entities).toBeDefined();
      expect(result.entities.length).toBeLessThanOrEqual(5);
    });
  });
  
  describe('Performance and Optimization', () => {
    beforeEach(async () => {
      await agent.initialize();
    });
    
    test('should handle large batch operations efficiently', async () => {
      const largeEntitySet: ParsedEntity[] = [];
      for (let i = 0; i < 1000; i++) {
        largeEntitySet.push(createMockParsedEntity(`perfFunc${i}`, 'function'));
      }
      
      const startTime = Date.now();
      const result = await agent.indexEntities(largeEntitySet, '/test/performance.ts');
      const duration = Date.now() - startTime;
      
      expect(result.processed).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Check that batch operations were used
      const stats = agent.getIndexingStats();
      expect(stats.entitiesIndexed).toBeGreaterThanOrEqual(1000);
    });
    
    test('should optimize batch size based on performance', async () => {
      // Perform maintenance which includes batch size optimization
      await agent.performMaintenance();
      
      // Verify maintenance operations completed
      const metrics = await agent.getStorageMetrics();
      expect(metrics).toBeDefined();
    });
    
    test('should efficiently query large result sets', async () => {
      // Index many entities
      const entities: ParsedEntity[] = [];
      for (let i = 0; i < 500; i++) {
        entities.push(createMockParsedEntity(`queryPerfFunc${i}`, 'function'));
      }
      await agent.indexEntities(entities, '/test/query-performance.ts');
      
      // Query with pagination
      const query: GraphQuery = {
        type: 'entity',
        filters: {
          entityType: EntityType.FUNCTION
        },
        limit: 100,
        offset: 0
      };
      
      const startTime = Date.now();
      const result = await agent.queryGraph(query);
      const duration = Date.now() - startTime;
      
      expect(result.entities.length).toBeLessThanOrEqual(100);
      expect(duration).toBeLessThan(1000); // Query should be fast
    });
  });
  
  describe('Knowledge Bus Integration', () => {
    beforeEach(async () => {
      await agent.initialize();
    });
    
    test('should handle parse complete events', async () => {
      const parseResult = createMockParseResult('/test/bus-file.ts');
      
      // Publish parse complete event
      knowledgeBus.publish('parse:complete', parseResult, 'test-parser');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify entities were indexed
      const query: GraphQuery = {
        type: 'entity',
        filters: {
          filePath: '/test/bus-file.ts'
        }
      };
      
      const result = await agent.queryGraph(query);
      expect(result.entities.length).toBeGreaterThan(0);
    });
    
    test('should handle batch parse complete events', async () => {
      const parseResults = [
        createMockParseResult('/test/batch1.ts'),
        createMockParseResult('/test/batch2.ts'),
        createMockParseResult('/test/batch3.ts')
      ];
      
      // Publish batch parse complete event
      knowledgeBus.publish('parse:batch:complete', parseResults, 'test-parser');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify all files were indexed
      const stats = agent.getIndexingStats();
      expect(stats.filesProcessed).toBeGreaterThanOrEqual(3);
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(async () => {
      await agent.initialize();
    });
    
    test('should handle invalid entities gracefully', async () => {
      const invalidEntities: any[] = [
        { name: 'invalid' }, // Missing required fields
        null,
        undefined
      ];
      
      const result = await agent.indexEntities(invalidEntities, '/test/invalid.ts');
      
      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    test('should handle database errors gracefully', async () => {
      // Close database to simulate error
      const manager = (agent as any).sqliteManager;
      manager.close();
      
      const entities = [createMockParsedEntity('errorFunc', 'function')];
      
      await expect(
        agent.indexEntities(entities, '/test/error.ts')
      ).rejects.toThrow();
    });
    
    test('should handle unknown task types', async () => {
      const unknownTask: any = {
        id: 'unknown-task',
        type: 'unknown:type',
        priority: 5,
        payload: {},
        createdAt: Date.now()
      };
      
      await expect(agent.process(unknownTask)).rejects.toThrow('Unknown task type');
    });
  });
  
  describe('Maintenance Operations', () => {
    beforeEach(async () => {
      await agent.initialize();
      
      // Add some data for maintenance
      const entities = [
        createMockParsedEntity('maintFunc1', 'function'),
        createMockParsedEntity('maintFunc2', 'function')
      ];
      await agent.indexEntities(entities, '/test/maintenance.ts');
    });
    
    test('should perform vacuum operation', async () => {
      await agent.performMaintenance();
      
      // Verify database is still accessible after vacuum
      const query: GraphQuery = {
        type: 'entity',
        limit: 1
      };
      
      const result = await agent.queryGraph(query);
      expect(result).toBeDefined();
    });
    
    test('should prune cache during maintenance', async () => {
      // Fill cache with queries
      for (let i = 0; i < 10; i++) {
        const query: GraphQuery = {
          type: 'entity',
          filters: { name: `test${i}` }
        };
        await agent.queryGraph(query);
      }
      
      await agent.performMaintenance();
      
      // Cache should still be functional
      const query: GraphQuery = {
        type: 'entity',
        limit: 1
      };
      
      const result = await agent.queryGraph(query);
      expect(result).toBeDefined();
    });
  });
  
  describe('Shutdown', () => {
    test('should shutdown gracefully', async () => {
      await agent.initialize();
      
      const unsubscribeSpy = jest.spyOn(knowledgeBus, 'unsubscribe');
      
      await agent.shutdown();
      
      expect(agent.status).toBe(AgentStatus.SHUTDOWN);
      expect(unsubscribeSpy).toHaveBeenCalled();
      
      unsubscribeSpy.mockRestore();
    });
    
    test('should log final statistics on shutdown', async () => {
      await agent.initialize();
      
      // Index some data
      const entities = [createMockParsedEntity('shutdownFunc', 'function')];
      await agent.indexEntities(entities, '/test/shutdown.ts');
      
      const consoleSpy = jest.spyOn(console, 'log');
      
      await agent.shutdown();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Final stats:'),
        expect.objectContaining({
          entitiesIndexed: expect.any(Number),
          filesProcessed: expect.any(Number)
        })
      );
      
      consoleSpy.mockRestore();
    });
  });
});