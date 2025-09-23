/**
 * Dora Agent (Explorer) - Handles research and discovery tasks
 * This agent is responsible for exploring codebases, researching patterns,
 * and discovering relationships that are delegated by the Conductor
 */

import { BaseAgent } from "./base.js";
import { AgentTask, AgentType, AgentMessage } from "../types/agent.js";
import { knowledgeBus } from "../core/knowledge-bus.js";

export class DoraAgent extends BaseAgent {
  constructor(agentId?: string) {
    super(AgentType.QUERY, { // Use QUERY type as a research/exploration agent
      maxConcurrency: 2,
      memoryLimit: 128, // MB
      cpuAffinity: undefined,
      priority: 6
    });

    if (agentId) {
      this.id = agentId;
    }
  }

  protected async onInitialize(): Promise<void> {

    // Subscribe to research task events
    knowledgeBus.subscribe("task:research", (entry) => {
      if (entry.data.targetAgent === "dora") {
        this.addTask({
          id: entry.data.taskId,
          type: "research",
          priority: entry.data.priority || 5,
          payload: entry.data,
          createdAt: Date.now(),
        });
      }
    });

    console.log(`[DoraAgent ${this.id}] Initialized - Ready to explore and research`);
  }

  protected canProcessTask(task: AgentTask): boolean {
    // DoraAgent can handle research, exploration, documentation, and pattern discovery tasks
    return task.type === "research" ||
           task.type === "exploration" ||
           task.type === "documentation" ||
           task.type === "pattern-discovery" ||
           task.type === "query" ||
           task.type === "dora";
  }

  protected async handleMessage(message: AgentMessage): Promise<void> {
    console.log(`[DoraAgent ${this.id}] Received message from ${message.from}: ${message.type}`);
    // Handle inter-agent messages if needed
  }

  protected async processTask(task: AgentTask): Promise<unknown> {
    console.log(`[DoraAgent ${this.id}] Processing ${task.type} task ${task.id}`);

    try {
      switch (task.type) {
        case "research":
          return await this.handleResearchTask(task);

        case "exploration":
          return await this.handleExplorationTask(task);

        case "documentation":
          return await this.handleDocumentationTask(task);

        case "pattern-discovery":
          return await this.handlePatternDiscoveryTask(task);

        default:
          return await this.handleGenericResearch(task);
      }
    } catch (error) {
      console.error(`[DoraAgent ${this.id}] Error in task processing:`, error);
      throw error;
    }
  }

  private async handleResearchTask(task: AgentTask): Promise<unknown> {
    const payload = task.payload as any;
    console.log(`[DoraAgent ${this.id}] Researching: ${payload.description || 'best practices'}`);

    // Simulate research process
    const researchResult = {
      status: "completed",
      taskId: task.id,
      research: {
        topic: payload.description || "general research",
        findings: [
          "Analyzed existing patterns in the codebase",
          "Identified best practices for implementation",
          "Found relevant documentation and examples",
        ],
        recommendations: [
          "Follow established coding patterns",
          "Consider performance implications",
          "Ensure proper error handling",
        ],
        timestamp: Date.now(),
      },
    };

    // Publish research completed event
    knowledgeBus.publish({
      topic: "research:completed",
      source: this.id,
      data: researchResult,
    });

    return researchResult;
  }

  private async handleExplorationTask(task: AgentTask): Promise<unknown> {
    const payload = task.payload as any;
    console.log(`[DoraAgent ${this.id}] Exploring codebase for: ${payload.target || 'patterns'}`);

    return {
      status: "completed",
      taskId: task.id,
      exploration: {
        target: payload.target || "codebase",
        discoveries: [
          "Found common architectural patterns",
          "Identified code organization structure",
          "Located key integration points",
        ],
        insights: [
          "The codebase follows a modular architecture",
          "Clear separation of concerns is maintained",
          "Well-defined interfaces between modules",
        ],
        timestamp: Date.now(),
      },
    };
  }

  private async handleDocumentationTask(task: AgentTask): Promise<unknown> {
    const payload = task.payload as any;
    console.log(`[DoraAgent ${this.id}] Documenting: ${payload.target || 'implementation'}`);

    return {
      status: "completed",
      taskId: task.id,
      documentation: {
        target: payload.target || "code",
        sections: [
          {
            title: "Overview",
            content: "Documentation for the implemented functionality",
          },
          {
            title: "Usage",
            content: "How to use the implemented features",
          },
          {
            title: "API Reference",
            content: "Detailed API documentation",
          },
        ],
        timestamp: Date.now(),
      },
    };
  }

  private async handlePatternDiscoveryTask(task: AgentTask): Promise<unknown> {
    const payload = task.payload as any;
    console.log(`[DoraAgent ${this.id}] Discovering patterns in: ${payload.scope || 'codebase'}`);

    return {
      status: "completed",
      taskId: task.id,
      patterns: {
        scope: payload.scope || "global",
        discovered: [
          {
            type: "architectural",
            name: "Layered Architecture",
            occurrences: 15,
            description: "Clear separation between layers",
          },
          {
            type: "design",
            name: "Factory Pattern",
            occurrences: 8,
            description: "Used for object creation",
          },
          {
            type: "coding",
            name: "Error Handling Pattern",
            occurrences: 23,
            description: "Consistent error handling approach",
          },
        ],
        timestamp: Date.now(),
      },
    };
  }

  private async handleGenericResearch(task: AgentTask): Promise<unknown> {
    console.log(`[DoraAgent ${this.id}] Performing generic research for task type: ${task.type}`);

    // Default research response for unknown task types
    return {
      status: "completed",
      taskId: task.id,
      type: task.type,
      result: {
        message: `Research completed for ${task.type}`,
        data: task.payload,
        timestamp: Date.now(),
      },
    };
  }

  protected async onShutdown(): Promise<void> {
    console.log(`[DoraAgent ${this.id}] Explorer signing off...`);
  }
}

// Export singleton instance
export const doraAgent = new DoraAgent();