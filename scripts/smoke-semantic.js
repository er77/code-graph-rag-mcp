#!/usr/bin/env node

// Quick semantic smoke: start MCP server, then call semantic_search and find_similar_code

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const argv = process.argv.slice(2);
const TARGET_DIR = argv[0];
if (!TARGET_DIR) {
  console.error("Usage: node scripts/smoke-semantic.js <codebase-dir>");
  process.exit(2);
}

const CODEGRAPH_BIN = new URL('../dist/index.js', import.meta.url).pathname;

async function waitTools(client, waitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < waitMs) {
    try {
      const list = await client.request({ method: "tools/list" }, { meta: { timeout: 3000 } });
      if (list?.tools?.length) return list.tools;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("tools/list did not succeed within wait window");
}

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: [CODEGRAPH_BIN, TARGET_DIR],
  });

  const client = new Client({ name: "semantic-smoke", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  await waitTools(client);

  // 1) semantic_search
  const q = "database connection";
  const sem = await client.request(
    { method: "tools/call", params: { name: "semantic_search", arguments: { query: q, limit: 3 } } },
    { meta: { timeout: 120000 } }
  );
  console.log("semantic_search result:\n", sem.content?.[0]?.text?.slice(0, 300) || JSON.stringify(sem, null, 2));

  // 2) find_similar_code
  const code = "def add(a,b):\n    return a+b";
  const sim = await client.request(
    { method: "tools/call", params: { name: "find_similar_code", arguments: { code, threshold: 0.6, limit: 3 } } },
    { meta: { timeout: 120000 } }
  );
  console.log("find_similar_code result:\n", sim.content?.[0]?.text?.slice(0, 300) || JSON.stringify(sim, null, 2));

  await client.close();
}

main().catch((e) => {
  console.error("Semantic smoke failed:", e);
  process.exit(1);
});

