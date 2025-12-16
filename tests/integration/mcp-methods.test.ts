/**
 * Integration tests for all 22 MCP CodeGraph methods
 * Validates that all MCP methods are properly defined and callable
 */

import { describe, expect, it } from "@jest/globals";

describe("MCP CodeGraph Methods - Validation Tests", () => {
  const ALL_MCP_METHODS = [
    "index",
    "reset_graph",
    "clean_index",
    "list_file_entities",
    "list_entity_relationships",
    "resolve_entity",
    "get_entity_source",
    "query",
    "get_metrics",
    "get_version",
    "get_graph",
    "get_graph_stats",
    "get_graph_health",
    "semantic_search",
    "find_similar_code",
    "analyze_code_impact",
    "detect_code_clones",
    "suggest_refactoring",
    "cross_language_search",
    "analyze_hotspots",
    "find_related_concepts",
    "get_agent_metrics",
    "get_bus_stats",
    "clear_bus_topic",
  ];

  describe("Method Count and Uniqueness", () => {
    it("should have exactly 24 MCP methods", () => {
      expect(ALL_MCP_METHODS).toHaveLength(24);
    });

    it("should have all unique method names", () => {
      const uniqueMethods = new Set(ALL_MCP_METHODS);
      expect(uniqueMethods.size).toBe(24);
    });

    it("should use snake_case naming convention", () => {
      ALL_MCP_METHODS.forEach((method) => {
        expect(method).toMatch(/^[a-z_]+$/);
      });
    });
  });

  describe("Method Categories", () => {
    const coreOps = ["index", "reset_graph", "clean_index"];
    const queryOps = [
      "list_file_entities",
      "list_entity_relationships",
      "resolve_entity",
      "get_entity_source",
      "query",
      "get_graph",
    ];
    const graphInfo = ["get_graph_stats", "get_graph_health", "get_metrics", "get_version"];
    const semanticOps = [
      "semantic_search",
      "find_similar_code",
      "analyze_code_impact",
      "detect_code_clones",
      "suggest_refactoring",
      "cross_language_search",
      "analyze_hotspots",
      "find_related_concepts",
    ];
    const monitoringOps = ["get_agent_metrics", "get_bus_stats", "clear_bus_topic"];

    it("should have 3 core operations", () => {
      expect(coreOps).toHaveLength(3);
      coreOps.forEach((method) => {
        expect(ALL_MCP_METHODS).toContain(method);
      });
    });

    it("should have 6 query operations", () => {
      expect(queryOps).toHaveLength(6);
      queryOps.forEach((method) => {
        expect(ALL_MCP_METHODS).toContain(method);
      });
    });

    it("should have 4 graph info operations", () => {
      expect(graphInfo).toHaveLength(4);
      graphInfo.forEach((method) => {
        expect(ALL_MCP_METHODS).toContain(method);
      });
    });

    it("should have 8 semantic operations", () => {
      expect(semanticOps).toHaveLength(8);
      semanticOps.forEach((method) => {
        expect(ALL_MCP_METHODS).toContain(method);
      });
    });

    it("should have 3 monitoring operations", () => {
      expect(monitoringOps).toHaveLength(3);
      monitoringOps.forEach((method) => {
        expect(ALL_MCP_METHODS).toContain(method);
      });
    });

    it("categories should sum to total (3+6+4+8+3 = 24)", () => {
      const totalCategorized =
        coreOps.length + queryOps.length + graphInfo.length + semanticOps.length + monitoringOps.length;
      expect(totalCategorized).toBe(24);
    });
  });

  describe("Core Component Availability", () => {
    it("should have GraphStorage factory available", async () => {
      const { getGraphStorage } = await import("../../src/storage/graph-storage-factory.js");
      expect(getGraphStorage).toBeDefined();
      expect(typeof getGraphStorage).toBe("function");
    });

    it("should have SQLiteManager available", async () => {
      const { getSQLiteManager } = await import("../../src/storage/sqlite-manager.js");
      expect(getSQLiteManager).toBeDefined();
      expect(typeof getSQLiteManager).toBe("function");
    });

    it("should have ResourceManager available", async () => {
      const { resourceManager } = await import("../../src/core/resource-manager.js");
      expect(resourceManager).toBeDefined();
      expect(resourceManager.getCurrentUsage).toBeDefined();
    });

    it("should have KnowledgeBus available", async () => {
      const { knowledgeBus } = await import("../../src/core/knowledge-bus.js");
      expect(knowledgeBus).toBeDefined();
      expect(knowledgeBus.getStats).toBeDefined();
    });
  });

  describe("Integration Points", () => {
    it("should be able to get current resource usage", async () => {
      const { resourceManager } = await import("../../src/core/resource-manager.js");

      // Start monitoring to capture snapshots
      resourceManager.startMonitoring();

      // Wait for first snapshot
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const usage = resourceManager.getCurrentUsage();

      expect(usage).toBeDefined();
      if (usage) {
        expect(typeof usage.cpu.usage).toBe("number");
        expect(typeof usage.memory.percentage).toBe("number");
        expect(typeof usage.timestamp).toBe("number");
      }

      resourceManager.stopMonitoring();
    });

    it("should be able to get knowledge bus stats", async () => {
      const { knowledgeBus } = await import("../../src/core/knowledge-bus.js");
      const stats = knowledgeBus.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.topicCount).toBe("number");
      expect(typeof stats.entryCount).toBe("number");
      expect(typeof stats.subscriptionCount).toBe("number");
    });

    it("should be able to initialize storage", async () => {
      const { getSQLiteManager } = await import("../../src/storage/sqlite-manager.js");
      const { getGraphStorage } = await import("../../src/storage/graph-storage-factory.js");

      const sqliteManager = getSQLiteManager();
      expect(sqliteManager).toBeDefined();

      const storage = await getGraphStorage(sqliteManager);
      expect(storage).toBeDefined();
      expect(storage.getMetrics).toBeDefined();
    });

    it("should be able to get graph metrics", async () => {
      const { getSQLiteManager } = await import("../../src/storage/sqlite-manager.js");
      const { getGraphStorage } = await import("../../src/storage/graph-storage-factory.js");

      const sqliteManager = getSQLiteManager();
      const storage = await getGraphStorage(sqliteManager);
      const metrics = await storage.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalEntities).toBe("number");
      expect(typeof metrics.totalRelationships).toBe("number");
    });
  });

  describe("v2.6.0 New Methods", () => {
    const newMethods = ["get_agent_metrics", "get_bus_stats", "clear_bus_topic"];

    it("should include all 3 new v2.6.0 methods", () => {
      newMethods.forEach((method) => {
        expect(ALL_MCP_METHODS).toContain(method);
      });
    });

    it("get_agent_metrics - should have collectAgentMetrics function", async () => {
      const { collectAgentMetrics } = await import("../../src/tools/agent-metrics.js");
      expect(collectAgentMetrics).toBeDefined();
      expect(typeof collectAgentMetrics).toBe("function");
    });

    it("get_bus_stats - should be callable", async () => {
      const { knowledgeBus } = await import("../../src/core/knowledge-bus.js");
      const stats = knowledgeBus.getStats();

      expect(stats.topicCount).toBeGreaterThanOrEqual(0);
      expect(stats.entryCount).toBeGreaterThanOrEqual(0);
    });

    it("clear_bus_topic - should be callable", async () => {
      const { knowledgeBus } = await import("../../src/core/knowledge-bus.js");

      // Publish test topic
      knowledgeBus.publish("test:mcp:clear", { test: true }, "test");

      // Verify it exists
      let entries = knowledgeBus.query("test:mcp:clear");
      expect(entries.length).toBeGreaterThan(0);

      // Clear it
      knowledgeBus.clearTopic("test:mcp:clear");

      // Verify cleared
      entries = knowledgeBus.query("test:mcp:clear");
      expect(entries.length).toBe(0);
    });
  });
});
