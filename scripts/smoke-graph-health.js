#!/usr/bin/env node

// Minimal smoke test: start MCP server, call get_graph_stats and get_graph_health, assert non-zero entities

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const CODEGRAPH_BIN = new URL('../dist/index.js', import.meta.url).pathname;
const argv = process.argv.slice(2);
const TARGET_DIR = argv[0];
const DO_CLEAN = argv.includes('--clean');

if (!TARGET_DIR) {
  console.error("Usage: node scripts/smoke-graph-health.js <codebase-dir>");
  process.exit(2);
}

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: [CODEGRAPH_BIN, TARGET_DIR],
  });

  const client = new Client({ name: "smoke-test", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  // Wait until tools are listable (server ready)
  const start = Date.now();
  let toolsOk = false;
  for (let attempt = 0; attempt < 15; attempt++) { // up to ~15s
    try {
      await client.request({ method: "tools/list" }, { meta: { timeout: 5000 } });
      toolsOk = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!toolsOk) {
    console.error("Smoke FAIL: tools/list did not succeed within 15s");
    process.exit(1);
  }

  // Optionally run clean_index first
  if (DO_CLEAN) {
    console.log('Running clean_index...');
    await client.request(
      { method: "tools/call", params: { name: "clean_index", arguments: { directory: TARGET_DIR } } },
      { meta: { timeout: 600000 } }
    );
  }

  // Stats (longer timeout)
  const stats = await client.request(
    { method: "tools/call", params: { name: "get_graph_stats", arguments: {} } },
    { meta: { timeout: 120000 } }
  );
  const parsedStats = JSON.parse(stats.content?.[0]?.text ?? "{}");
  const entitiesTotal = parsedStats.entities?.total ?? 0;
  if (entitiesTotal <= 0) {
    console.error("Smoke FAIL: get_graph_stats reported zero entities", parsedStats);
    process.exit(1);
  }

  // Health
  const health = await client.request(
    { method: "tools/call", params: { name: "get_graph_health", arguments: { minEntities: 1, sample: 1 } } },
    { meta: { timeout: 120000 } }
  );
  const parsedHealth = JSON.parse(health.content?.[0]?.text ?? "{}");
  if (!parsedHealth.healthy) {
    console.error("Smoke FAIL: get_graph_health unhealthy", parsedHealth);
    process.exit(1);
  }

  console.log("Smoke PASS:", { entitiesTotal, sampleCount: parsedHealth.sampleCount });
  await client.close();
}

main().catch((e) => {
  console.error("Smoke exception:", e);
  process.exit(1);
});
