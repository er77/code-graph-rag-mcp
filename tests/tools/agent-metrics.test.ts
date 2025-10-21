import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { BaseAgent } from "../../src/agents/base.js";
import { ConductorOrchestrator } from "../../src/agents/conductor-orchestrator.js";
import { knowledgeBus } from "../../src/core/knowledge-bus.js";
import { ResourceManager } from "../../src/core/resource-manager.js";
import { collectAgentMetrics } from "../../src/tools/agent-metrics.js";
import type { AgentMessage, AgentTask } from "../../src/types/agent.js";
import { AgentType } from "../../src/types/agent.js";

class DummyAgent extends BaseAgent {
  constructor() {
    super(AgentType.DEV, {
      maxConcurrency: 1,
      memoryLimit: 128,
      priority: 5,
    });
  }

  protected async onInitialize(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}

  protected canProcessTask(task: AgentTask): boolean {
    return task.type === "noop";
  }

  protected async processTask(_task: AgentTask): Promise<unknown> {
    return { ok: true };
  }

  protected async handleMessage(_message: AgentMessage): Promise<void> {}
}

describe("collectAgentMetrics", () => {
  let conductor: ConductorOrchestrator;
  let agent: DummyAgent;
  let resourceManager: ResourceManager;

  beforeEach(async () => {
    (knowledgeBus as any).knowledge?.clear?.();
    (knowledgeBus as any).subscriptions?.clear?.();

    conductor = new ConductorOrchestrator();
    await conductor.initialize();

    agent = new DummyAgent();
    await agent.initialize();
    conductor.register(agent);

    resourceManager = new ResourceManager({
      maxMemoryMB: 256,
      maxCpuPercent: 80,
      maxConcurrentAgents: 2,
      maxTaskQueueSize: 10,
    });
  });

  afterEach(async () => {
    await agent.shutdown();
    await conductor.shutdown();
  });

  it("captures conductor, agent, resource, and bus metrics", async () => {
    const snapshot = await collectAgentMetrics({
      conductor,
      resourceManager,
      knowledgeBus,
    });

    expect(snapshot.timestamp).toBeTruthy();
    expect(snapshot.conductor.registeredAgents).toBeGreaterThanOrEqual(1);
    expect(snapshot.agents).toHaveLength(1);
    expect(snapshot.agents[0]?.id).toBe(agent.id);
    expect(snapshot.resources.constraints.maxConcurrentAgents).toBe(2);
    expect(snapshot.knowledgeBus.topicCount).toBe(0);
  });
});
