import { describe, expect, it } from "@jest/globals";
import { DevAgent } from "../../src/agents/dev-agent.js";
import { QueryAgent } from "../../src/agents/query-agent.js";
import { SemanticAgent } from "../../src/agents/semantic-agent.js";
import type { KnowledgeEntry } from "../../src/core/knowledge-bus.js";

describe("Resource adjustment handlers", () => {
  it("scales DevAgent batch size and concurrency", () => {
    const agent = new DevAgent();
    const entry = {
      data: {
        newMemoryLimit: 512,
        newAgentLimit: 6,
      },
    } as KnowledgeEntry;

    (agent as any).handleResourceAdjustment(entry);

    expect(agent.capabilities.maxConcurrency).toBeGreaterThanOrEqual(1);
    expect((agent as any).indexBatchSize).toBeGreaterThanOrEqual(10);
  });

  it("updates QueryAgent concurrency limiter", () => {
    const agent = new QueryAgent();
    const entry = {
      data: {
        newAgentLimit: 4,
      },
    } as KnowledgeEntry;

    (agent as any).handleResourceAdjustment(entry);

    expect(agent.capabilities.maxConcurrency).toBeGreaterThanOrEqual(1);
  });

  it("adjusts SemanticAgent concurrency and batch size", () => {
    const agent = new SemanticAgent();
    const entry = {
      data: {
        newMemoryLimit: 480,
        newAgentLimit: 4,
      },
    } as KnowledgeEntry;

    (agent as any).handleResourceAdjustment(entry);

    expect(agent.capabilities.maxConcurrency).toBeGreaterThanOrEqual(1);
    expect((agent as any).embeddingBatchSize).toBeGreaterThanOrEqual(1);
  });
});
