#!/usr/bin/env node

/**
 * Direct test of MCP server tools
 * Uses the MCP SDK to communicate with the server
 */

import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const TEST_DIR =
  process.env.TEST_DIR ||
  process.env.TARGET_DIR ||
  (process.env.PROJECT_DIR ? `${process.env.PROJECT_DIR}/../target-repo` : "/tmp/target-repo");

async function testMCPServer() {
  console.log("🧪 Starting MCP Protocol Tests\n");

  // Start the MCP server as a subprocess
  const DIST_JS = process.env.DIST_JS || `${process.cwd()}/dist/index.js`;
  const serverProcess = spawn("node", [DIST_JS, TEST_DIR]);

  // Create MCP client transport
  const transport = new StdioClientTransport({
    command: "node",
    args: [DIST_JS, TEST_DIR],
  });

  // Create MCP client
  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  try {
    // Connect to server
    console.log("📡 Connecting to MCP server...");
    await client.connect(transport);
    console.log("✅ Connected!\n");

    // List available tools
    console.log("📋 Listing available tools...");
    const tools = await client.request({ method: "tools/list" }, { meta: {} });
    console.log(`Found ${tools.tools.length} tools:\n`);

    for (const tool of tools.tools) {
      console.log(`  • ${tool.name}: ${tool.description}`);
    }
    console.log();

    // Test each tool category
    const tests = [
      {
        name: "graph:analyze",
        args: { directory: TEST_DIR },
      },
      {
        name: "graph:index",
        args: {
          directory: TEST_DIR,
          incremental: true,
          batchMode: true,
          excludePatterns: ["node_modules/**", "*.test.js"],
        },
      },
      {
        name: "query:search",
        args: { query: "class", limit: 3 },
      },
      {
        name: "query:findEntity",
        args: { name: "BaserowApplication", type: "class" },
      },
      {
        name: "query:getRelationships",
        args: { entityId: "test-id", relationshipType: "imports" },
      },
      {
        name: "semantic:search",
        args: { query: "database models", limit: 3 },
      },
      {
        name: "semantic:explain",
        args: {
          code: "def calculate_total(items):\\n    return sum(item.price for item in items)",
          language: "python",
        },
      },
      {
        name: "semantic:suggest",
        args: {
          code: "def add(a,b):\\n    return a+b",
          language: "python",
        },
      },
    ];

    // Run tests
    for (const test of tests) {
      console.log(`\n🔧 Testing: ${test.name}`);
      console.log(`   Args: ${JSON.stringify(test.args, null, 2)}`);

      try {
        const result = await client.request(
          {
            method: "tools/call",
            params: {
              name: test.name,
              arguments: test.args,
            },
          },
          { meta: {} },
        );

        console.log("   ✅ Success!");
        if (result.content && result.content.length > 0) {
          const content = result.content[0];
          if (typeof content === "string") {
            console.log(`   Result: ${content.substring(0, 200)}...`);
          } else if (content.text) {
            console.log(`   Result: ${content.text.substring(0, 200)}...`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    console.log("\n✅ All tests completed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    // Cleanup
    await client.close();
    serverProcess.kill();
  }
}

// Run tests
testMCPServer().catch(console.error);
