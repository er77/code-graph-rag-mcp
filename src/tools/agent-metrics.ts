import type { ConductorOrchestrator } from "../agents/conductor-orchestrator.js";
import type { KnowledgeBus } from "../core/knowledge-bus.js";
import type { ResourceManager } from "../core/resource-manager.js";
import type { Agent, AgentMetrics, AgentStatus, AgentType, ResourceConstraints } from "../types/agent.js";

interface AgentSummary {
  id: string;
  type: AgentType;
  status: AgentStatus;
  queueLength: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  capabilities: {
    maxConcurrency: number;
    memoryLimitMB: number;
    priority: number;
  };
  metrics: AgentMetrics;
  currentTaskType?: string;
  lastActivity: number;
}

interface ResourceSummary {
  throttled: boolean;
  constraints: ResourceConstraints;
  currentUsage?: ReturnType<ResourceManager["getCurrentUsage"]>;
}

interface KnowledgeBusSummary {
  topicCount: number;
  entryCount: number;
  subscriptionCount: number;
  messageQueueSize: number;
}

export interface AgentMetricsSnapshot {
  timestamp: string;
  conductor: {
    registeredAgents: number;
    totalTasks: number;
    averageProcessingTime: number;
    overheadReduction: number;
    cacheHitRate: number;
    pendingTasks: number;
    approvalsPending: number;
    directImplementationAttempts: number;
  };
  agents: AgentSummary[];
  resources: ResourceSummary;
  knowledgeBus: KnowledgeBusSummary;
}

function normalizeAgent(agent: Agent): AgentSummary {
  const metrics = (agent as any).getMetrics
    ? (agent as any).getMetrics()
    : ({
        agentId: agent.id,
        tasksProcessed: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        averageProcessingTime: 0,
        currentMemoryMB: agent.getMemoryUsage(),
        currentCpuPercent: agent.getCpuUsage(),
        lastActivity: Date.now(),
      } as AgentMetrics);
  return {
    id: agent.id,
    type: agent.type,
    status: agent.status,
    queueLength: agent.getTaskQueue().length,
    memoryUsageMB: agent.getMemoryUsage(),
    cpuUsagePercent: agent.getCpuUsage(),
    capabilities: {
      maxConcurrency: agent.capabilities.maxConcurrency,
      memoryLimitMB: agent.capabilities.memoryLimit,
      priority: agent.capabilities.priority,
    },
    metrics,
    currentTaskType: (agent as any).currentTask?.type,
    lastActivity: metrics.lastActivity,
  };
}

export async function collectAgentMetrics(options: {
  conductor: ConductorOrchestrator;
  resourceManager: ResourceManager;
  knowledgeBus: KnowledgeBus;
}): Promise<AgentMetricsSnapshot> {
  const { conductor, resourceManager, knowledgeBus } = options;

  const agentCollection =
    (conductor as any).agents instanceof Map ? (conductor as any).agents.values() : ([] as Agent[]);
  const agentMap: Agent[] = Array.from(agentCollection);
  const conductorMetrics =
    typeof (conductor as any).getPerformanceMetrics === "function"
      ? (conductor as any).getPerformanceMetrics()
      : {
          totalTasks: 0,
          avgProcessingTime: 0,
          overheadReduction: 0,
          cacheHitRate: 0,
        };

  const resources: ResourceSummary = {
    throttled: resourceManager.isSystemThrottled(),
    constraints: resourceManager.getConstraints(),
  };

  const usage = resourceManager.getCurrentUsage();
  if (usage) {
    resources.currentUsage = usage;
  }

  const knowledgeStats = knowledgeBus.getStats();

  return {
    timestamp: new Date().toISOString(),
    conductor: {
      registeredAgents: agentMap.length,
      totalTasks: conductorMetrics.totalTasks ?? 0,
      averageProcessingTime: conductorMetrics.avgProcessingTime ?? 0,
      overheadReduction: conductorMetrics.overheadReduction ?? 0,
      cacheHitRate: conductorMetrics.cacheHitRate ?? 0,
      pendingTasks: (conductor as any).pendingTasks?.size ?? 0,
      approvalsPending: (conductor as any).approvalRequired?.size ?? 0,
      directImplementationAttempts: (conductor as any).directImplementationAttempts ?? 0,
    },
    agents: agentMap.map(normalizeAgent),
    resources,
    knowledgeBus: {
      topicCount: knowledgeStats.topicCount,
      entryCount: knowledgeStats.entryCount,
      subscriptionCount: knowledgeStats.subscriptionCount,
      messageQueueSize: knowledgeStats.messageQueueSize,
    },
  };
}
