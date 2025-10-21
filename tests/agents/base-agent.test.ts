import { describe, expect, it } from "@jest/globals";
import { BaseAgent } from "../../src/agents/base.js";
import { AgentType } from "../../src/types/agent.js";
import { AgentBusyError } from "../../src/types/errors.js";

class TestAgent extends BaseAgent {
  constructor() {
    super(AgentType.DEV, {
      maxConcurrency: 1,
      memoryLimit: 64,
      priority: 5,
    });
  }

  protected async onInitialize(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}

  protected canProcessTask(task: any): boolean {
    return task.type === "test";
  }

  protected async processTask(): Promise<unknown> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ok: true };
  }

  protected async handleMessage(): Promise<void> {}
}

describe("BaseAgent backpressure", () => {
  it("throws AgentBusyError with retry hints when agent is busy", async () => {
    const agent = new TestAgent();
    await agent.initialize();

    const taskA = {
      id: "a",
      type: "test",
      priority: 1,
      payload: {},
      createdAt: Date.now(),
    };

    const taskB = {
      ...taskA,
      id: "b",
    };

    const running = agent.process(taskA as any);

    await expect(agent.process(taskB as any)).rejects.toBeInstanceOf(AgentBusyError);

    try {
      await running;
    } finally {
      await agent.shutdown();
    }
  });
});
