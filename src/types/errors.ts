import type { AgentStatus } from "./agent.js";

export interface AgentBusyDetails {
  agentId: string;
  status: AgentStatus;
  reason: "not_idle" | "queue_full" | "memory_limit" | "unsupported_task" | "unknown";
  queueLength?: number;
  maxQueue?: number;
  retryAfterMs?: number;
  taskId?: string;
  memoryUsageMB?: number;
  memoryLimitMB?: number;
}

export class AgentBusyError extends Error {
  public readonly details: AgentBusyDetails;

  constructor(details: AgentBusyDetails) {
    super(`Agent ${details.agentId} is busy (${details.reason})`);
    this.name = "AgentBusyError";
    this.details = details;
  }
}
