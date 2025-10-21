#!/usr/bin/env node
/**
 * Comprehensive MCP CodeGraph Method Testing Script
 * Tests all 22 MCP methods with the actual MCP server
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const TIMEOUT = 30000; // 30 seconds per test
const TEST_PROJECT_DIR = process.cwd();

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

class MCPTester {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: [],
    };
    this.serverProcess = null;
  }

  log(message, color = "reset") {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async startServer() {
    this.log("\n🚀 Starting MCP server...", "cyan");

    return new Promise((resolve, reject) => {
      this.serverProcess = spawn("node", ["dist/index.js", TEST_PROJECT_DIR], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let outputBuffer = "";
      const timeout = setTimeout(() => {
        reject(new Error("Server startup timeout"));
      }, 10000);

      this.serverProcess.stdout.on("data", (data) => {
        outputBuffer += data.toString();
        if (
          outputBuffer.includes("MCP server running on stdio") ||
          outputBuffer.includes("Server initialization complete")
        ) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.serverProcess.stderr.on("data", (_data) => {
        // Ignore stderr for now
      });

      this.serverProcess.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async sendRequest(method, args = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: method,
          arguments: args,
        },
      };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout: ${method} took longer than ${TIMEOUT}ms`));
      }, TIMEOUT);

      let responseBuffer = "";

      const dataHandler = (data) => {
        responseBuffer += data.toString();
        try {
          const response = JSON.parse(responseBuffer);
          clearTimeout(timeout);
          this.serverProcess.stdout.removeListener("data", dataHandler);
          resolve(response);
        } catch (_e) {
          // Not complete JSON yet, wait for more data
        }
      };

      this.serverProcess.stdout.on("data", dataHandler);
      this.serverProcess.stdin.write(`${JSON.stringify(request)}\n`);
    });
  }

  async runTest(testName, method, args, validator) {
    this.results.total++;
    const startTime = Date.now();

    try {
      this.log(`\n📝 Testing: ${testName}`, "blue");
      this.log(`   Method: ${method}`, "reset");

      const response = await this.sendRequest(method, args);
      const duration = Date.now() - startTime;

      // Validate response
      if (response.error) {
        throw new Error(`MCP Error: ${response.error.message || JSON.stringify(response.error)}`);
      }

      // Run custom validator if provided
      if (validator) {
        const validationResult = validator(response.result);
        if (!validationResult.valid) {
          throw new Error(`Validation failed: ${validationResult.error}`);
        }
      }

      this.results.passed++;
      this.results.tests.push({
        name: testName,
        method,
        status: "PASS",
        duration,
        response: response.result,
      });

      this.log(`   ✅ PASS (${duration}ms)`, "green");
      return response.result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.failed++;
      this.results.tests.push({
        name: testName,
        method,
        status: "FAIL",
        duration,
        error: error.message,
      });

      this.log(`   ❌ FAIL (${duration}ms)`, "red");
      this.log(`   Error: ${error.message}`, "red");
      return null;
    }
  }

  async runAllTests() {
    this.log(`\n${"=".repeat(80)}`, "cyan");
    this.log("MCP CODEGRAPH COMPREHENSIVE METHOD TESTING", "cyan");
    this.log(`${"=".repeat(80)}\n`, "cyan");

    try {
      await this.startServer();
      this.log("✅ Server started successfully\n", "green");

      // ========== CORE OPERATIONS ==========
      this.log(`\n${"─".repeat(80)}`, "yellow");
      this.log("CORE OPERATIONS", "yellow");
      this.log("─".repeat(80), "yellow");

      await this.runTest("get_version - Get server version info", "get_version", {}, (result) => ({
        valid: result && typeof result.version === "string",
        error: "Version info not found",
      }));

      await this.runTest("get_graph_health - Check database health", "get_graph_health", {}, (result) => ({
        valid: result && typeof result.totalEntities !== "undefined",
        error: "Health info not found",
      }));

      await this.runTest(
        "index - Index the current directory",
        "index",
        { directory: TEST_PROJECT_DIR, incremental: true },
        (result) => ({
          valid: result && (result.success || result.indexed !== undefined),
          error: "Indexing failed",
        }),
      );

      await this.runTest("get_graph_stats - Get graph statistics", "get_graph_stats", {}, (result) => ({
        valid: result && typeof result.totalEntities === "number",
        error: "Stats not found",
      }));

      // ========== QUERY OPERATIONS ==========
      this.log(`\n${"─".repeat(80)}`, "yellow");
      this.log("QUERY OPERATIONS", "yellow");
      this.log("─".repeat(80), "yellow");

      const graphResult = await this.runTest(
        "get_graph - Get all entities and relationships",
        "get_graph",
        { limit: 10 },
        (result) => ({
          valid: result && Array.isArray(result.entities),
          error: "Graph data not found",
        }),
      );

      let testEntityId = null;
      if (graphResult?.entities && graphResult.entities.length > 0) {
        testEntityId = graphResult.entities[0].id;
      }

      await this.runTest(
        "list_file_entities - List entities in a file",
        "list_file_entities",
        { filePath: "src/index.ts" },
        (result) => ({
          valid: result && Array.isArray(result.entities),
          error: "File entities not found",
        }),
      );

      if (testEntityId) {
        await this.runTest(
          "list_entity_relationships - List entity relationships",
          "list_entity_relationships",
          { entityName: testEntityId },
          (result) => ({
            valid: result !== null,
            error: "Relationships query failed",
          }),
        );
      }

      await this.runTest(
        "query - Execute graph query",
        "query",
        { query: "find all functions", limit: 5 },
        (result) => ({
          valid: result !== null,
          error: "Query execution failed",
        }),
      );

      // ========== SEMANTIC OPERATIONS ==========
      this.log(`\n${"─".repeat(80)}`, "yellow");
      this.log("SEMANTIC OPERATIONS", "yellow");
      this.log("─".repeat(80), "yellow");

      await this.runTest(
        "semantic_search - Search code semantically",
        "semantic_search",
        { query: "database connection", limit: 5 },
        (result) => ({
          valid: result && Array.isArray(result.results),
          error: "Semantic search failed",
        }),
      );

      await this.runTest(
        "find_similar_code - Find similar code patterns",
        "find_similar_code",
        { code: "function test() { return 42; }", threshold: 0.7, limit: 5 },
        (result) => ({
          valid: result !== null,
          error: "Similar code search failed",
        }),
      );

      await this.runTest(
        "detect_code_clones - Detect code clones",
        "detect_code_clones",
        { minSimilarity: 0.8 },
        (result) => ({
          valid: Array.isArray(result),
          error: "Clone detection failed",
        }),
      );

      await this.runTest(
        "cross_language_search - Search across languages",
        "cross_language_search",
        { query: "authentication", languages: ["typescript", "javascript"] },
        (result) => ({
          valid: Array.isArray(result),
          error: "Cross-language search failed",
        }),
      );

      await this.runTest(
        "find_related_concepts - Find related concepts",
        "find_related_concepts",
        { entityId: testEntityId || "test", limit: 5 },
        (result) => ({
          valid: result !== null,
          error: "Related concepts search failed",
        }),
      );

      // ========== ANALYSIS OPERATIONS ==========
      this.log(`\n${"─".repeat(80)}`, "yellow");
      this.log("ANALYSIS OPERATIONS", "yellow");
      this.log("─".repeat(80), "yellow");

      if (testEntityId) {
        await this.runTest(
          "analyze_code_impact - Analyze change impact",
          "analyze_code_impact",
          { entityId: testEntityId },
          (result) => ({
            valid: result && typeof result.impactScore !== "undefined",
            error: "Impact analysis failed",
          }),
        );
      }

      await this.runTest(
        "analyze_hotspots - Analyze code hotspots",
        "analyze_hotspots",
        { metric: "complexity", limit: 5 },
        (result) => ({
          valid: result?.items && Array.isArray(result.items),
          error: "Hotspot analysis failed",
        }),
      );

      await this.runTest(
        "suggest_refactoring - Get refactoring suggestions",
        "suggest_refactoring",
        { filePath: "src/index.ts" },
        (result) => ({
          valid: Array.isArray(result),
          error: "Refactoring suggestions failed",
        }),
      );

      // ========== MONITORING OPERATIONS ==========
      this.log(`\n${"─".repeat(80)}`, "yellow");
      this.log("MONITORING OPERATIONS", "yellow");
      this.log("─".repeat(80), "yellow");

      await this.runTest("get_metrics - Get performance metrics", "get_metrics", {}, (result) => ({
        valid: result && typeof result.memoryUsage !== "undefined",
        error: "Metrics not found",
      }));

      await this.runTest("get_agent_metrics - Get agent telemetry", "get_agent_metrics", {}, (result) => ({
        valid: result && typeof result.timestamp !== "undefined",
        error: "Agent metrics not found",
      }));

      await this.runTest("get_bus_stats - Get knowledge bus statistics", "get_bus_stats", {}, (result) => ({
        valid: result && typeof result.topicCount !== "undefined",
        error: "Bus stats not found",
      }));

      await this.runTest(
        "clear_bus_topic - Clear knowledge bus topic",
        "clear_bus_topic",
        { topic: "test:topic" },
        (result) => ({
          valid: result && result.success !== false,
          error: "Clear bus topic failed",
        }),
      );

      // ========== MAINTENANCE OPERATIONS ==========
      this.log(`\n${"─".repeat(80)}`, "yellow");
      this.log("MAINTENANCE OPERATIONS", "yellow");
      this.log("─".repeat(80), "yellow");

      await this.runTest(
        "clean_index - Clean and reindex",
        "clean_index",
        { directory: TEST_PROJECT_DIR },
        (result) => ({
          valid: result !== null,
          error: "Clean index failed",
        }),
      );

      // Note: reset_graph is destructive, so we'll skip it in automated tests
      this.results.total++;
      this.results.skipped++;
      this.results.tests.push({
        name: "reset_graph - Reset graph database",
        method: "reset_graph",
        status: "SKIP",
        reason: "Destructive operation - skipped in automated tests",
      });
      this.log("\n📝 Testing: reset_graph - Reset graph database", "blue");
      this.log("   ⏭️  SKIPPED (destructive operation)", "yellow");
    } catch (error) {
      this.log(`\n❌ Fatal error: ${error.message}`, "red");
    } finally {
      if (this.serverProcess) {
        this.serverProcess.kill();
      }
    }
  }

  generateReport() {
    this.log(`\n${"=".repeat(80)}`, "cyan");
    this.log("TEST SUMMARY", "cyan");
    this.log(`${"=".repeat(80)}\n`, "cyan");

    const passRate = ((this.results.passed / (this.results.total - this.results.skipped)) * 100).toFixed(1);

    this.log(`Total Tests:    ${this.results.total}`, "reset");
    this.log(`✅ Passed:      ${this.results.passed}`, "green");
    this.log(`❌ Failed:      ${this.results.failed}`, this.results.failed > 0 ? "red" : "reset");
    this.log(`⏭️  Skipped:     ${this.results.skipped}`, "yellow");
    this.log(`📊 Pass Rate:   ${passRate}%\n`, passRate >= 90 ? "green" : passRate >= 70 ? "yellow" : "red");

    // Detailed results
    if (this.results.failed > 0) {
      this.log("─".repeat(80), "red");
      this.log("FAILED TESTS:", "red");
      this.log("─".repeat(80), "red");

      this.results.tests
        .filter((t) => t.status === "FAIL")
        .forEach((test) => {
          this.log(`\n❌ ${test.name}`, "red");
          this.log(`   Method: ${test.method}`, "reset");
          this.log(`   Error: ${test.error}`, "red");
        });
    }

    // Save report to file
    const reportPath = ".memory_bank/testing/mcp_method_test_results.json";
    try {
      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(
        reportPath,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            summary: {
              total: this.results.total,
              passed: this.results.passed,
              failed: this.results.failed,
              skipped: this.results.skipped,
              passRate: parseFloat(passRate),
            },
            tests: this.results.tests,
          },
          null,
          2,
        ),
      );

      this.log(`\n📄 Detailed report saved to: ${reportPath}`, "cyan");
    } catch (error) {
      this.log(`\n⚠️  Could not save report: ${error.message}`, "yellow");
    }

    this.log(`\n${"=".repeat(80)}\n`, "cyan");
  }
}

// Run tests
const tester = new MCPTester();
tester
  .runAllTests()
  .then(() => {
    tester.generateReport();
    process.exit(tester.results.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
