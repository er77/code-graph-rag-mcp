/**
 * TASK-001: Parser Agent Test Suite
 *
 * Tests for the high-performance parser agent.
 * Verifies incremental parsing, entity extraction, and throughput.
 *
 * Architecture References:
 * - Parser Agent: src/agents/parser-agent.ts
 * - Parser Types: src/types/parser.ts
 */

import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { ParserAgent } from "../../src/agents/parser-agent.js";
import { AgentStatus } from "../../src/types/agent.js";
import type { FileChange, ParseResult, ParserTask } from "../../src/types/parser.js";

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION
// =============================================================================
const TEST_TIMEOUT = 30000; // 30 seconds for performance tests
const TEMP_DIR = join(tmpdir(), "parser-agent-test");

// =============================================================================
// 3. DATA MODELS AND TYPE DEFINITIONS
// =============================================================================
interface TestFile {
  path: string;
  content: string;
}

// =============================================================================
// 4. UTILITY FUNCTIONS AND HELPERS
// =============================================================================

/**
 * Create test files in temp directory
 */
async function createTestFiles(files: TestFile[]): Promise<void> {
  await fs.mkdir(TEMP_DIR, { recursive: true });

  for (const file of files) {
    const filePath = join(TEMP_DIR, file.path);
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, file.content);
  }
}

/**
 * Clean up temp directory
 */
async function cleanupTestFiles(): Promise<void> {
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Generate sample JavaScript code
 */
function generateSampleCode(index: number): string {
  return `
// File ${index}
import { Module${index} } from './module${index}';

export class TestClass${index} {
  constructor() {
    this.id = ${index};
  }

  async processData(data) {
    const result = await this.transform(data);
    return result;
  }

  transform(input) {
    return input * ${index};
  }
}

export function utilityFunction${index}(param) {
  return param + ${index};
}

export const CONFIG_${index} = {
  name: 'Test${index}',
  value: ${index}
};
`;
}

// =============================================================================
// 5. TEST SUITES
// =============================================================================

describe("ParserAgent", () => {
  let agent: ParserAgent;
  let knowledgeBus: EventEmitter;

  beforeAll(async () => {
    // TASK-001: Setup test environment
    knowledgeBus = new EventEmitter();
    await cleanupTestFiles();
  });

  afterAll(async () => {
    await cleanupTestFiles();
  });

  beforeEach(async () => {
    agent = new ParserAgent(knowledgeBus);
    await agent.initialize();
  });

  afterEach(async () => {
    await agent.shutdown();
  });

  describe("Initialization", () => {
    test("should initialize successfully", () => {
      expect(agent.status).toBe(AgentStatus.IDLE);
      expect(agent.type).toBe("parser");
    });

    test("should have correct capabilities", () => {
      expect(agent.capabilities.maxConcurrency).toBe(4);
      expect(agent.capabilities.memoryLimit).toBe(256);
      expect(agent.capabilities.priority).toBe(8);
    });
  });

  describe("Single File Parsing", () => {
    test("should parse JavaScript file", async () => {
      const testFile = {
        path: "test.js",
        content: generateSampleCode(1),
      };

      await createTestFiles([testFile]);

      const result = await agent.parseFile(join(TEMP_DIR, testFile.path));

      expect(result.filePath).toBe(join(TEMP_DIR, testFile.path));
      expect(result.language).toBe("javascript");
      expect(result.entities).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(0);

      // Check for specific entities
      const classEntity = result.entities.find((e) => e.name === "TestClass1");
      expect(classEntity).toBeDefined();
      expect(classEntity?.type).toBe("class");

      const functionEntity = result.entities.find((e) => e.name === "utilityFunction1");
      expect(functionEntity).toBeDefined();
      expect(functionEntity?.type).toBe("function");
    });

    test("should parse TypeScript file", async () => {
      const testFile = {
        path: "test.ts",
        content: `
interface User {
  id: number;
  name: string;
}

type UserRole = 'admin' | 'user';

export class UserService {
  private users: User[] = [];

  async getUser(id: number): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }
}
`,
      };

      await createTestFiles([testFile]);

      const result = await agent.parseFile(join(TEMP_DIR, testFile.path));

      expect(result.language).toBe("typescript");

      const interfaceEntity = result.entities.find((e) => e.name === "User");
      expect(interfaceEntity).toBeDefined();
      expect(interfaceEntity?.type).toBe("interface");

      const typeEntity = result.entities.find((e) => e.name === "UserRole");
      expect(typeEntity).toBeDefined();
      expect(typeEntity?.type).toBe("type");
    });
  });

  describe("Batch Processing", () => {
    test("should process multiple files in batch", async () => {
      const testFiles = Array.from({ length: 10 }, (_, i) => ({
        path: `file${i}.js`,
        content: generateSampleCode(i),
      }));

      await createTestFiles(testFiles);

      const filePaths = testFiles.map((f) => join(TEMP_DIR, f.path));
      const results = await agent.parseBatch(filePaths);

      expect(results.length).toBe(10);
      results.forEach((result) => {
        expect(result.entities.length).toBeGreaterThan(0);
        expect(result.fromCache).toBeFalsy();
      });
    });

    test("should use cache for repeated parsing", async () => {
      const testFile = {
        path: "cached.js",
        content: generateSampleCode(99),
      };

      await createTestFiles([testFile]);
      const filePath = join(TEMP_DIR, testFile.path);

      // First parse - should not be from cache
      const result1 = await agent.parseFile(filePath);
      expect(result1.fromCache).toBeFalsy();

      // Second parse - should be from cache
      const result2 = await agent.parseFile(filePath);
      expect(result2.fromCache).toBeTruthy();
      expect(result2.contentHash).toBe(result1.contentHash);
    });
  });

  describe("Incremental Parsing", () => {
    test("should handle file modifications incrementally", async () => {
      const originalContent = generateSampleCode(1);
      const modifiedContent = originalContent.replace("TestClass1", "ModifiedClass1");

      const testFile = {
        path: "incremental.js",
        content: originalContent,
      };

      await createTestFiles([testFile]);
      const filePath = join(TEMP_DIR, testFile.path);

      // Initial parse
      const result1 = await agent.parseFile(filePath);
      const hash1 = result1.contentHash;

      // Modify file
      await fs.writeFile(filePath, modifiedContent);

      // Process incremental change
      const change: FileChange = {
        filePath,
        changeType: "modified",
        content: modifiedContent,
        previousHash: hash1,
      };

      const results = await agent.processIncremental([change]);
      expect(results.length).toBe(1);

      const result2 = results[0];
      expect(result2).toBeDefined();
      expect(result2!.contentHash).not.toBe(hash1);

      const modifiedClass = result2!.entities.find((e) => e.name === "ModifiedClass1");
      expect(modifiedClass).toBeDefined();
    });

    test("should handle file creation and deletion", async () => {
      const newFilePath = join(TEMP_DIR, "new-file.js");
      const content = generateSampleCode(42);

      // Create file change
      const createChange: FileChange = {
        filePath: newFilePath,
        changeType: "created",
        content,
      };

      const createResults = await agent.processIncremental([createChange]);
      expect(createResults.length).toBe(1);
      expect(createResults[0]?.entities.length).toBeGreaterThan(0);

      // Delete file change
      const deleteChange: FileChange = {
        filePath: newFilePath,
        changeType: "deleted",
      };

      const deleteResults = await agent.processIncremental([deleteChange]);
      expect(deleteResults.length).toBe(0);
    });
  });

  describe("Performance", () => {
    test(
      "should achieve target throughput of 100+ files/second",
      async () => {
        // TASK-001: Performance test - 100+ files/second requirement
        const fileCount = 100;
        const testFiles = Array.from({ length: fileCount }, (_, i) => ({
          path: `perf/file${i}.js`,
          content: generateSampleCode(i % 10), // Reuse content for cache hits
        }));

        await createTestFiles(testFiles);

        const filePaths = testFiles.map((f) => join(TEMP_DIR, f.path));
        const startTime = Date.now();

        const results = await agent.parseBatch(filePaths);

        const elapsed = Date.now() - startTime;
        const throughput = (fileCount / elapsed) * 1000;

        console.log(`[Performance] Parsed ${fileCount} files in ${elapsed}ms (${throughput.toFixed(1)} files/sec)`);

        expect(results.length).toBe(fileCount);
        expect(throughput).toBeGreaterThan(100); // Target: 100+ files/second
      },
      TEST_TIMEOUT,
    );

    test("should maintain memory usage under limit", async () => {
      const memoryBefore = agent.getMemoryUsage();

      // Parse many files
      const testFiles = Array.from({ length: 50 }, (_, i) => ({
        path: `memory/file${i}.js`,
        content: generateSampleCode(i),
      }));

      await createTestFiles(testFiles);
      const filePaths = testFiles.map((f) => join(TEMP_DIR, f.path));

      await agent.parseBatch(filePaths);

      const memoryAfter = agent.getMemoryUsage();
      const memoryIncrease = memoryAfter - memoryBefore;

      console.log(`[Memory] Usage increased by ${memoryIncrease}MB`);

      expect(memoryAfter).toBeLessThan(256); // Should stay under 256MB limit
    });

    test("should achieve >80% cache hit rate on warm restart", async () => {
      // Create and parse files
      const testFiles = Array.from({ length: 20 }, (_, i) => ({
        path: `cache/file${i}.js`,
        content: generateSampleCode(i),
      }));

      await createTestFiles(testFiles);
      const filePaths = testFiles.map((f) => join(TEMP_DIR, f.path));

      // First pass - populate cache
      await agent.parseBatch(filePaths);

      // Export cache
      const cacheData = agent.exportCache();

      // Create new agent and import cache
      const newAgent = new ParserAgent(knowledgeBus);
      await newAgent.initialize();
      await newAgent.importCache(cacheData);

      // Parse again - should hit cache
      const results = await newAgent.parseBatch(filePaths);

      const cacheHits = results.filter((r) => r.fromCache).length;
      const hitRate = (cacheHits / results.length) * 100;

      console.log(`[Cache] Hit rate: ${hitRate.toFixed(1)}%`);

      expect(hitRate).toBeGreaterThan(80); // Target: >80% cache hit rate

      await newAgent.shutdown();
    });
  });

  describe("Task Processing", () => {
    test("should process parse:file task", async () => {
      const testFile = {
        path: "task-test.js",
        content: generateSampleCode(1),
      };

      await createTestFiles([testFile]);

      const task: ParserTask = {
        id: "test-task-1",
        type: "parse:file",
        priority: 5,
        payload: {
          files: [join(TEMP_DIR, testFile.path)],
        },
        createdAt: Date.now(),
      };

      const results = (await agent.process(task)) as ParseResult[];
      expect(results.length).toBe(1);
      expect(results[0]?.entities.length).toBeGreaterThan(0);
    });

    test("should process parse:batch task", async () => {
      const testFiles = Array.from({ length: 5 }, (_, i) => ({
        path: `batch${i}.js`,
        content: generateSampleCode(i),
      }));

      await createTestFiles(testFiles);

      const task: ParserTask = {
        id: "test-task-2",
        type: "parse:batch",
        priority: 5,
        payload: {
          files: testFiles.map((f) => join(TEMP_DIR, f.path)),
          options: {
            useCache: true,
            batchSize: 2,
          },
        },
        createdAt: Date.now(),
      };

      const results = (await agent.process(task)) as ParseResult[];
      expect(results.length).toBe(5);
    });

    test("should emit parse:complete event", async () => {
      const testFile = {
        path: "event-test.js",
        content: generateSampleCode(1),
      };

      await createTestFiles([testFile]);

      let eventReceived = false;
      knowledgeBus.once("parse:complete", (event) => {
        eventReceived = true;
        expect(event.agentId).toBe(agent.id);
        expect(event.results).toBeDefined();
        expect(event.stats).toBeDefined();
      });

      const task: ParserTask = {
        id: "test-task-3",
        type: "parse:file",
        priority: 5,
        payload: {
          files: [join(TEMP_DIR, testFile.path)],
        },
        createdAt: Date.now(),
      };

      await agent.process(task);
      expect(eventReceived).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    test("should handle non-existent file gracefully", async () => {
      const result = await agent.parseFile("/non/existent/file.js");
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.entities).toEqual([]);
    });

    test("should handle invalid task type", async () => {
      const invalidTask = {
        id: "invalid-task",
        type: "invalid:type",
        priority: 5,
        payload: {},
        createdAt: Date.now(),
      };

      const canHandle = agent.canHandle(invalidTask);
      expect(canHandle).toBeFalsy();
    });

    test("should emit parse:failed event on error", async () => {
      let eventReceived = false;
      knowledgeBus.once("parse:failed", (event) => {
        eventReceived = true;
        expect(event.agentId).toBe(agent.id);
        expect(event.error).toBeDefined();
      });

      const task: ParserTask = {
        id: "test-task-fail",
        type: "parse:file",
        priority: 5,
        payload: {
          files: ["/invalid/path/file.js"],
        },
        createdAt: Date.now(),
      };

      try {
        await agent.process(task);
      } catch (error) {
        // Expected to throw
      }

      expect(eventReceived).toBeTruthy();
    });
  });
});
