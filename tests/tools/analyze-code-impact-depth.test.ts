import { existsSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { IndexerAgent } from "../../src/agents/indexer-agent.js";
import { getGraphStorage, resetGraphStorage } from "../../src/storage/graph-storage-factory.js";
import { getSQLiteManager, resetSQLiteManager } from "../../src/storage/sqlite-manager.js";
import { analyzeCodeImpactTraversal } from "../../src/tools/analyze-code-impact.js";
import { AgentStatus } from "../../src/types/agent.js";
import type { ParsedEntity } from "../../src/types/parser.js";

const TEST_DB_PATH = "./data/test-tool-impact.db";
const CLEANUP_PATHS = [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`];

function e(name: string, line: number): ParsedEntity {
  return {
    name,
    type: "function",
    location: {
      start: { line, column: 0, index: line * 10 },
      end: { line: line + 1, column: 0, index: line * 10 + 5 },
    },
  } as any;
}

describe("analyzeCodeImpactTraversal depth", () => {
  let agent: IndexerAgent;

  beforeEach(async () => {
    for (const p of CLEANUP_PATHS) {
      if (existsSync(p)) rmSync(p);
    }
    resetGraphStorage();
    resetSQLiteManager();
    const sqlite = getSQLiteManager({ path: TEST_DB_PATH });
    agent = new IndexerAgent(sqlite);
    await agent.initialize();
  });

  afterEach(async () => {
    if (agent && agent.status !== AgentStatus.SHUTDOWN) await agent.shutdown();
    for (const p of CLEANUP_PATHS) {
      if (existsSync(p)) rmSync(p);
    }
    resetGraphStorage();
    resetSQLiteManager();
  });

  it("honors depth for transitive dependents", async () => {
    const filePath = "/tmp/impact.ts";
    await agent.indexEntities([e("A", 1), e("B", 10), e("C", 20)], filePath, [
      { from: "B", to: "A", type: "calls", metadata: { line: 10 } },
      { from: "C", to: "B", type: "calls", metadata: { line: 20 } },
    ] as any);

    const storage = await getGraphStorage(getSQLiteManager({ path: TEST_DB_PATH }));
    const root = (await storage.executeQuery({ type: "entity", filters: { name: /^A$/i }, limit: 1 })).entities[0]!;

    const d1 = await analyzeCodeImpactTraversal(storage, root.id, 1);
    const d2 = await analyzeCodeImpactTraversal(storage, root.id, 2);

    expect(d1.directDependents.size).toBe(1);
    expect(d1.transitiveDependents.size).toBe(0);
    expect(d2.directDependents.size).toBe(1);
    expect(d2.transitiveDependents.size).toBe(1);
  });
});
