import { existsSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { IndexerAgent } from "../../src/agents/indexer-agent.js";
import { getGraphStorage, resetGraphStorage } from "../../src/storage/graph-storage-factory.js";
import { getSQLiteManager, resetSQLiteManager } from "../../src/storage/sqlite-manager.js";
import { resolveEntityCandidates } from "../../src/tools/resolve-entity.js";
import { AgentStatus } from "../../src/types/agent.js";
import type { ParsedEntity } from "../../src/types/parser.js";

const TEST_DB_PATH = "./data/test-tool-resolve.db";
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

describe("resolveEntityCandidates", () => {
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

  it("boosts candidates by filePathHint", async () => {
    await agent.indexEntities([e("Foo", 1)], "/tmp/a.ts");
    await agent.indexEntities([e("Foo", 1)], "/tmp/b.ts");

    const storage = await getGraphStorage(getSQLiteManager({ path: TEST_DB_PATH }));
    const candidates = await resolveEntityCandidates({
      storage,
      name: "Foo",
      filePathHint: "/tmp/b.ts",
      limit: 10,
    });

    expect(candidates[0]!.entity.filePath).toBe("/tmp/b.ts");
  });
});
