import { describe, expect, it } from "@jest/globals";
import { knowledgeBus } from "../../src/core/knowledge-bus.js";

describe("KnowledgeBus tooling", () => {
  it("returns stats with topic and entry counts", () => {
    knowledgeBus.publish("test:topic", { value: 1 }, "test");
    const stats = knowledgeBus.getStats();

    expect(stats.topicCount).toBeGreaterThanOrEqual(1);
    expect(stats.entryCount).toBeGreaterThanOrEqual(1);

    knowledgeBus.clearTopic("test:topic");
  });

  it("clears specific topics", () => {
    knowledgeBus.publish("test:clear", { value: 2 }, "test");
    knowledgeBus.clearTopic("test:clear");

    const entries = knowledgeBus.query("test:clear");
    expect(entries.length).toBe(0);
  });
});
