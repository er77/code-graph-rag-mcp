import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { IndexerAgent } from "../../src/agents/indexer-agent.js";
import { getGraphStorage, resetGraphStorage } from "../../src/storage/graph-storage-factory.js";
import { getSQLiteManager, resetSQLiteManager } from "../../src/storage/sqlite-manager.js";
import { getEntitySource } from "../../src/tools/get-entity-source.js";
import { AgentStatus } from "../../src/types/agent.js";
import type { ParsedEntity } from "../../src/types/parser.js";

const TEST_DB_PATH = "./data/test-tool-source.db";
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

describe("getEntitySource", () => {
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

  it("returns a snippet with context lines", async () => {
    const filePath = join(process.cwd(), "tests", "fixtures", "entity-source.ts");
    await agent.indexEntities([e("add", 1)], filePath);

    const storage = await getGraphStorage(getSQLiteManager({ path: TEST_DB_PATH }));
    const entity = (await storage.executeQuery({ type: "entity", filters: { name: /^add$/i }, limit: 1 })).entities[0]!;

    const result = await getEntitySource({ storage, entity, filePath, contextLines: 1, maxBytes: 10000 });
    expect(result.snippet).toContain("export function add");
    expect(result.snippetRange.startLine).toBeLessThanOrEqual(result.entityRange.startLine);
  });
});
