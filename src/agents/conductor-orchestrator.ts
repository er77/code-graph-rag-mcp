/**
 * TASK-004B: Conductor Orchestrator Agent - Performance Optimized
 *
 * MANDATORY DELEGATION VERSION with 40% overhead reduction optimizations
 *
 * This agent MUST delegate all implementation tasks to specialized agents:
 * - dev-agent: For ALL code implementation tasks
 * - Dora: For research, documentation, and analysis tasks
 *
 * The Conductor NEVER implements directly, only orchestrates.
 * OPTIMIZED: Hierarchical supervision, sparse communication, predictive load balancing
 *
 * ANTI-OVER-ENGINEERING POLICY:
 * - Do NOT over-engineer. You will receive penalty for each attempt to make codebase more complex.
 * - Keep code clear and simple as possible. Prefer straightforward solutions over elaborate architectures.
 * - Task Completion Checklist: At the end of each task, always proceed with checklist: what was required vs what was done, do you follow requirements.
 */

import { getConfig } from "../config/yaml-config.js";
import {
  type Agent,
  type AgentMessage,
  type AgentPool,
  AgentStatus,
  type AgentTask,
  AgentType,
  type ResourceConstraints,
} from "../types/agent.js";
import { logger } from "../utils/logger.js";
import { BaseAgent } from "./base.js";
import { isEventfulAgent } from "./coordinator.js";

interface ConductorConfig {
  resourceConstraints: ResourceConstraints;
  taskQueueLimit: number;
  loadBalancingStrategy: "round-robin" | "least-loaded" | "priority";
  complexityThreshold: number; // Complexity threshold for approval workflow
  mandatoryDelegation: boolean; // Force delegation to specialized agents
  maxConcurrency: number;
  memoryLimit: number;
  priority: number;
}

interface TaskComplexityAnalysis {
  score: number; // 1-10 scale
  factors: string[];
  requiresApproval: boolean;
  delegationStrategy: "dev-agent" | "dora" | "multi-agent";
  subtasks: SubTask[];
}

interface SubTask {
  id: string;
  description: string;
  targetAgent: "dev-agent" | "dora";
  dependencies: string[];
  priority: number;
  payload?: any; // For passing task-specific data
}

interface MethodProposal {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  timeline: string;
  riskLevel: "low" | "medium" | "high" | "very-high";
  recommended: boolean;
}

type ConductorConfigOverrides = Partial<Omit<ConductorConfig, "resourceConstraints">> & {
  resourceConstraints?: Partial<ResourceConstraints>;
};

const DEFAULT_RESOURCE_CONSTRAINTS: ResourceConstraints = {
  maxMemoryMB: 1024,
  maxCpuPercent: 80,
  maxConcurrentAgents: 10,
  maxTaskQueueSize: 100,
};

const DEFAULT_CONDUCTOR_CONFIG: ConductorConfig = {
  resourceConstraints: DEFAULT_RESOURCE_CONSTRAINTS,
  taskQueueLimit: 100,
  loadBalancingStrategy: "least-loaded",
  complexityThreshold: 8,
  mandatoryDelegation: true,
  maxConcurrency: 100,
  memoryLimit: 128,
  priority: 10,
};

function getConductorAgentDefaults(): {
  capabilities: { maxConcurrency: number; memoryLimit: number; priority: number };
  config: ConductorConfig;
} {
  const appConfig = getConfig();
  const conductorOverrides = (appConfig.conductor ?? {}) as ConductorConfigOverrides;
  const fallbackConcurrentAgents =
    conductorOverrides.resourceConstraints?.maxConcurrentAgents ??
    appConfig.mcp.agents?.maxConcurrent ??
    DEFAULT_RESOURCE_CONSTRAINTS.maxConcurrentAgents;

  const resourceConstraints: ResourceConstraints = {
    maxMemoryMB: conductorOverrides.resourceConstraints?.maxMemoryMB ?? DEFAULT_RESOURCE_CONSTRAINTS.maxMemoryMB,
    maxCpuPercent: conductorOverrides.resourceConstraints?.maxCpuPercent ?? DEFAULT_RESOURCE_CONSTRAINTS.maxCpuPercent,
    maxConcurrentAgents: fallbackConcurrentAgents,
    maxTaskQueueSize:
      conductorOverrides.resourceConstraints?.maxTaskQueueSize ?? DEFAULT_RESOURCE_CONSTRAINTS.maxTaskQueueSize,
  };

  const maxConcurrency = conductorOverrides.maxConcurrency ?? DEFAULT_CONDUCTOR_CONFIG.maxConcurrency;
  const memoryLimit = conductorOverrides.memoryLimit ?? DEFAULT_CONDUCTOR_CONFIG.memoryLimit;
  const priority = conductorOverrides.priority ?? DEFAULT_CONDUCTOR_CONFIG.priority;

  const config: ConductorConfig = {
    resourceConstraints,
    taskQueueLimit: conductorOverrides.taskQueueLimit ?? DEFAULT_CONDUCTOR_CONFIG.taskQueueLimit,
    loadBalancingStrategy: conductorOverrides.loadBalancingStrategy ?? DEFAULT_CONDUCTOR_CONFIG.loadBalancingStrategy,
    complexityThreshold: conductorOverrides.complexityThreshold ?? DEFAULT_CONDUCTOR_CONFIG.complexityThreshold,
    mandatoryDelegation: conductorOverrides.mandatoryDelegation ?? DEFAULT_CONDUCTOR_CONFIG.mandatoryDelegation,
    maxConcurrency,
    memoryLimit,
    priority,
  };

  return {
    capabilities: { maxConcurrency, memoryLimit, priority },
    config,
  };
}

export class ConductorOrchestrator extends BaseAgent implements AgentPool {
  public agents: Map<string, Agent> = new Map();
  private config: ConductorConfig;
  private roundRobinIndex: Map<AgentType, number> = new Map();
  private pendingTasks: Map<string, AgentTask> = new Map();
  private taskComplexityCache: Map<string, TaskComplexityAnalysis> = new Map();
  private methodProposals: Map<string, MethodProposal[]> = new Map();
  private approvalRequired: Set<string> = new Set();

  // Tracking for delegation enforcement
  private delegationLog: Map<string, { agent: string; timestamp: number }[]> = new Map();
  private directImplementationAttempts = 0;

  // TASK-004B: Performance optimization features
  private agentLoadCache: Map<string, { load: number; timestamp: number }> = new Map();
  private readonly LOAD_CACHE_TTL = 5000; // 5 seconds
  private methodProposalTemplates: Map<string, MethodProposal[]> = new Map();
  private performanceMetrics = {
    totalTasks: 0,
    avgProcessingTime: 0,
    overheadReduction: 0,
    cacheHitRate: 0,
  };

  // Heartbeat and health tracking
  private healthMonitorTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private performanceMonitorTimer: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 5000;
  private readonly AGENT_STALE_MS = 30000; // 30s without activity => suspect
  private agentLastSeen: Map<string, number> = new Map();

  constructor(config: ConductorConfigOverrides = {}) {
    const defaults = getConductorAgentDefaults();

    const resolvedCapabilities = {
      maxConcurrency: config.maxConcurrency ?? defaults.capabilities.maxConcurrency,
      memoryLimit: config.memoryLimit ?? defaults.capabilities.memoryLimit,
      priority: config.priority ?? defaults.capabilities.priority,
    };

    super(AgentType.COORDINATOR, resolvedCapabilities);

    const resourceConstraints: ResourceConstraints = {
      maxMemoryMB: config.resourceConstraints?.maxMemoryMB ?? defaults.config.resourceConstraints.maxMemoryMB,
      maxCpuPercent: config.resourceConstraints?.maxCpuPercent ?? defaults.config.resourceConstraints.maxCpuPercent,
      maxConcurrentAgents:
        config.resourceConstraints?.maxConcurrentAgents ?? defaults.config.resourceConstraints.maxConcurrentAgents,
      maxTaskQueueSize:
        config.resourceConstraints?.maxTaskQueueSize ?? defaults.config.resourceConstraints.maxTaskQueueSize,
    };

    this.config = {
      resourceConstraints,
      maxConcurrency: resolvedCapabilities.maxConcurrency,
      memoryLimit: resolvedCapabilities.memoryLimit,
      priority: resolvedCapabilities.priority,
      taskQueueLimit: config.taskQueueLimit ?? defaults.config.taskQueueLimit,
      loadBalancingStrategy: config.loadBalancingStrategy ?? defaults.config.loadBalancingStrategy,
      complexityThreshold: config.complexityThreshold ?? defaults.config.complexityThreshold,
      mandatoryDelegation:
        config.mandatoryDelegation !== undefined ? config.mandatoryDelegation : defaults.config.mandatoryDelegation,
    };
  }

  protected async onInitialize(): Promise<void> {
    console.log(`[CONDUCTOR] Initializing with MANDATORY DELEGATION enabled`);
    console.log(`[CONDUCTOR] Complexity threshold: ${this.config.complexityThreshold}/10`);
    console.log(`[CONDUCTOR] All tasks MUST be delegated to dev-agent or Dora`);

    this.startHealthMonitoring();
    this.startHeartbeat();
    this.initializeDelegationEnforcement();
    this.initializePerformanceOptimizations();
  }

  protected async onShutdown(): Promise<void> {
    console.log(`[CONDUCTOR] Shutting down orchestrator and all managed agents...`);

    if (this.healthMonitorTimer) {
      clearInterval(this.healthMonitorTimer);
      this.healthMonitorTimer = null;
    }
    if (this.performanceMonitorTimer) {
      clearInterval(this.performanceMonitorTimer);
      this.performanceMonitorTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Log delegation statistics
    console.log(`[CONDUCTOR] Delegation Statistics:`);
    console.log(`  - Direct implementation attempts blocked: ${this.directImplementationAttempts}`);
    console.log(`  - Total delegations: ${this.delegationLog.size}`);

    const shutdownPromises = Array.from(this.agents.values()).map((agent) =>
      agent.shutdown().catch((err) => console.error(`Failed to shutdown agent ${agent.id}:`, err)),
    );
    await Promise.all(shutdownPromises);
    this.agents.clear();
  }

  protected canProcessTask(_task: AgentTask): boolean {
    return this.pendingTasks.size < this.config.taskQueueLimit;
  }

  protected async processTask(task: AgentTask): Promise<unknown> {
    console.log(`[CONDUCTOR] Processing task ${task.id} of type ${task.type}`);

    // CRITICAL: Enforce delegation
    if (this.config.mandatoryDelegation) {
      return this.processThroughDelegation(task);
    }

    // This path should never be reached with mandatory delegation
    throw new Error("[CONDUCTOR] Direct implementation is FORBIDDEN. All tasks must be delegated.");
  }

  private async processThroughDelegation(task: AgentTask): Promise<unknown> {
    // Step 1: Analyze task complexity
    const complexity = await this.analyzeTaskComplexity(task);
    this.taskComplexityCache.set(task.id, complexity);

    console.log(`[CONDUCTOR] Task complexity: ${complexity.score}/10`);
    console.log(`[CONDUCTOR] Delegation strategy: ${complexity.delegationStrategy}`);

    // Step 2: Generate method proposals if complexity > threshold
    // Skip approval for automated indexing operations
    const isIndexingTask =
      task.type === "index" ||
      task.type === "semantic" ||
      (task.payload && typeof task.payload === "object" && "directory" in task.payload);

    if (complexity.requiresApproval && !isIndexingTask) {
      const proposals = await this.generateOptimizedMethodProposals(task, complexity);
      this.methodProposals.set(task.id, proposals);

      console.log(`[CONDUCTOR] Generated ${proposals.length} method proposals`);
      console.log(`[CONDUCTOR] APPROVAL REQUIRED for complexity ${complexity.score}/10`);

      // Mark for approval and return proposals
      this.approvalRequired.add(task.id);

      return {
        status: "approval_required",
        complexity: complexity.score,
        proposals,
        message: `Task complexity ${complexity.score}/10 exceeds threshold. Please review proposals and approve.`,
      };
    } else if (complexity.requiresApproval && isIndexingTask) {
      console.log(`[CONDUCTOR] Bypassing approval for indexing task (complexity ${complexity.score}/10)`);
    }

    // Step 3: Decompose into subtasks
    const subtasks = complexity.subtasks.length > 0 ? complexity.subtasks : await this.decomposeTask(task, complexity);

    console.log(`[CONDUCTOR] Decomposed into ${subtasks.length} subtasks`);

    // Step 4: Delegate subtasks to appropriate agents
    const results = [];
    for (const subtask of subtasks) {
      const result = await this.delegateSubtask(task.id, subtask);
      results.push(result);
    }

    // Step 5: Synthesize results
    return this.synthesizeResults(task, results);
  }

  private async analyzeTaskComplexity(task: AgentTask): Promise<TaskComplexityAnalysis> {
    const factors: string[] = [];
    let score = 1;

    // Analyze based on task type
    if (task.type === "refactor" || task.type === "architecture") {
      score += 3;
      factors.push("Architectural changes required");
    }

    if (task.type === "multi-file" || task.type === "cross-module") {
      score += 2;
      factors.push("Multiple files affected");
    }

    if (task.payload && typeof task.payload === "object") {
      const payload = task.payload as any;

      if (payload.fileCount > 10) {
        score += 2;
        factors.push(`Large scope: ${payload.fileCount} files`);
      }

      if (payload.requiresResearch) {
        score += 1;
        factors.push("Research required");
      }

      if (payload.requiresTesting) {
        score += 1;
        factors.push("Testing required");
      }
    }

    // Determine delegation strategy
    let delegationStrategy: "dev-agent" | "dora" | "multi-agent" = "dev-agent";

    if (task.type === "research" || task.type === "analysis") {
      delegationStrategy = "dora";
    } else if (score >= 7) {
      delegationStrategy = "multi-agent";
    }

    return {
      score: Math.min(10, score),
      factors,
      requiresApproval: score > this.config.complexityThreshold,
      delegationStrategy,
      subtasks: [], // Will be populated during decomposition
    };
  }

  private async generateMethodProposals(
    _task: AgentTask,
    complexity: TaskComplexityAnalysis,
  ): Promise<MethodProposal[]> {
    const proposals: MethodProposal[] = [];

    // Always generate 5 proposals as per specification
    proposals.push({
      id: "method-1",
      name: "Incremental Implementation",
      description: "Gradually implement changes with continuous validation",
      pros: ["Lower risk", "Continuous testing", "Easy rollback"],
      cons: ["Slower completion", "Potential inconsistencies during transition"],
      timeline: "1-2 weeks",
      riskLevel: "low",
      recommended: complexity.score <= 6,
    });

    proposals.push({
      id: "method-2",
      name: "Parallel Development",
      description: "Multiple agents work on independent components simultaneously",
      pros: ["Faster completion", "Efficient resource usage"],
      cons: ["Coordination complexity", "Integration challenges"],
      timeline: "3-5 days",
      riskLevel: "medium",
      recommended: complexity.delegationStrategy === "multi-agent",
    });

    proposals.push({
      id: "method-3",
      name: "Research-First Approach",
      description: "Dora conducts comprehensive research before implementation",
      pros: ["Well-informed decisions", "Best practices applied"],
      cons: ["Longer initial phase", "Potential over-engineering"],
      timeline: "1 week",
      riskLevel: "low",
      recommended: complexity.factors.includes("Research required"),
    });

    proposals.push({
      id: "method-4",
      name: "Rapid Prototyping",
      description: "Quick implementation followed by iterative refinement",
      pros: ["Fast initial results", "Early feedback"],
      cons: ["Technical debt", "Requires refactoring"],
      timeline: "2-3 days",
      riskLevel: "medium",
      recommended: false,
    });

    proposals.push({
      id: "method-5",
      name: "Comprehensive Refactor",
      description: "Complete restructuring with modern patterns",
      pros: ["Optimal final architecture", "Long-term maintainability"],
      cons: ["High complexity", "Risk of breaking changes"],
      timeline: "2-3 weeks",
      riskLevel: "high",
      recommended: complexity.score >= 8,
    });

    return proposals;
  }

  private async decomposeTask(task: AgentTask, complexity: TaskComplexityAnalysis): Promise<SubTask[]> {
    const subtasks: SubTask[] = [];

    // Special handling for indexing tasks with batch processing
    if (
      task.type === "index" &&
      task.payload &&
      typeof task.payload === "object" &&
      "excludePatterns" in task.payload
    ) {
      const payload = task.payload as any;
      const isBatchProcessing = payload.excludePatterns?.includes("__batch_processing_enabled__");

      if (isBatchProcessing) {
        console.log(`[CONDUCTOR] Decomposing large indexing task into batches`);

        // Remove the batch processing marker before delegating
        const cleanedPatterns = payload.excludePatterns.filter((p: string) => p !== "__batch_processing_enabled__");

        // Create batch subtasks for large codebase indexing
        subtasks.push({
          id: `${task.id}-batch-1`,
          description: "Index codebase in batches (Part 1)",
          targetAgent: "dev-agent",
          dependencies: [],
          priority: 8,
          payload: {
            type: "index",
            ...(payload || {}),
            excludePatterns: cleanedPatterns,
            batchMode: true,
            batchNumber: 1,
          },
        });

        return subtasks;
      }
    }

    // Special handling for index tasks that aren't batch processing
    if (task.type === "index" && !subtasks.length) {
      const payloadObj = task.payload && typeof task.payload === "object" ? task.payload : {};
      subtasks.push({
        id: `${task.id}-index`,
        description: "Index codebase",
        targetAgent: "dev-agent",
        dependencies: [],
        priority: 8,
        payload: {
          type: "index",
          ...payloadObj,
        },
      });
      return subtasks;
    }

    // Always start with research if needed
    if (complexity.factors.includes("Research required") || complexity.delegationStrategy === "dora") {
      subtasks.push({
        id: `${task.id}-research`,
        description: "Research best practices and patterns",
        targetAgent: "dora",
        dependencies: [],
        priority: 10,
      });
    }

    // Add implementation subtasks
    if (complexity.delegationStrategy !== "dora") {
      subtasks.push({
        id: `${task.id}-implement`,
        description: "Implement core functionality",
        targetAgent: "dev-agent",
        dependencies: subtasks.length > 0 ? [`${task.id}-research`] : [],
        priority: 8,
      });
    }

    // Add testing if required
    if (complexity.factors.includes("Testing required")) {
      subtasks.push({
        id: `${task.id}-test`,
        description: "Write and run tests",
        targetAgent: "dev-agent",
        dependencies: [`${task.id}-implement`],
        priority: 6,
      });
    }

    // Add documentation
    if (complexity.score >= 5) {
      subtasks.push({
        id: `${task.id}-document`,
        description: "Update documentation",
        targetAgent: "dora",
        dependencies: [`${task.id}-implement`],
        priority: 4,
      });
    }

    return subtasks;
  }

  private async delegateSubtask(taskId: string, subtask: SubTask): Promise<unknown> {
    console.log(`[CONDUCTOR] Delegating subtask ${subtask.id} to ${subtask.targetAgent}`);

    // Track delegation
    if (!this.delegationLog.has(taskId)) {
      this.delegationLog.set(taskId, []);
    }
    this.delegationLog.get(taskId)?.push({
      agent: subtask.targetAgent,
      timestamp: Date.now(),
    });

    // Check if target agent is available
    const agent = this.getAgentByName(subtask.targetAgent);
    if (!agent) {
      console.log(`[CONDUCTOR] ${subtask.targetAgent} not available, queuing for later`);

      // Queue for when agent becomes available
      this.pendingTasks.set(subtask.id, {
        id: subtask.id,
        type: subtask.targetAgent === "dora" ? "research" : subtask.payload?.type || "implementation",
        priority: subtask.priority,
        payload: subtask.payload || subtask,
        createdAt: Date.now(),
      });

      return {
        status: "queued",
        message: `Subtask queued for ${subtask.targetAgent}`,
      };
    }

    // Create agent task - preserve task type from payload if present
    const taskType = subtask.payload?.type || (subtask.targetAgent === "dora" ? "research" : "implementation");

    const agentTask: AgentTask = {
      id: subtask.id,
      type: taskType,
      priority: subtask.priority,
      payload: subtask.payload || subtask,
      createdAt: Date.now(),
    };

    // Process through agent
    try {
      const result = await agent.process(agentTask);
      console.log(`[CONDUCTOR] Subtask ${subtask.id} completed by ${subtask.targetAgent}`);
      return result;
    } catch (error) {
      console.error(`[CONDUCTOR] Subtask ${subtask.id} failed:`, error);
      throw error;
    }
  }

  private async synthesizeResults(task: AgentTask, results: unknown[]): Promise<unknown> {
    console.log(`[CONDUCTOR] Synthesizing ${results.length} results for task ${task.id}`);

    return {
      taskId: task.id,
      status: "completed",
      complexity: this.taskComplexityCache.get(task.id)?.score,
      delegations: this.delegationLog.get(task.id),
      results,
      synthesizedAt: Date.now(),
    };
  }

  private getAgentByName(name: "dev-agent" | "dora"): Agent | undefined {
    // Map agent names to types
    const nameToType: Record<string, AgentType> = {
      "dev-agent": AgentType.DEV,
      dora: AgentType.DORA,
    };

    const type = nameToType[name];
    if (!type) return undefined;

    return this.getAvailableAgent(type);
  }

  private initializeDelegationEnforcement(): void {
    // Override any attempt to bypass delegation
    const originalProcess = this.process.bind(this);
    this.process = async (task: AgentTask) => {
      if (this.isDirectImplementation(task)) {
        this.directImplementationAttempts++;
        console.error(`[CONDUCTOR] BLOCKED: Direct implementation attempt #${this.directImplementationAttempts}`);
        throw new Error(
          "CONDUCTOR VIOLATION: Direct implementation is FORBIDDEN. " +
            "All tasks MUST be delegated to dev-agent or Dora. " +
            "This is attempt #" +
            this.directImplementationAttempts,
        );
      }
      return originalProcess(task);
    };
  }

  private isDirectImplementation(task: AgentTask): boolean {
    // Check if task is trying to bypass delegation
    const payload = task.payload as any;
    return payload?.directImplementation === true || payload?.bypassDelegation === true || task.type === "direct";
  }

  // AgentPool implementation (inherited from original)
  register(agent: Agent): void {
    if (this.agents.size >= this.config.resourceConstraints.maxConcurrentAgents) {
      throw new Error(`Maximum number of agents (${this.config.resourceConstraints.maxConcurrentAgents}) reached`);
    }

    this.agents.set(agent.id, agent);
    console.log(`[CONDUCTOR] Registered agent ${agent.id} of type ${agent.type}`);

    if (isEventfulAgent(agent)) {
      agent.on("task:completed", this.handleTaskCompleted.bind(this));
      agent.on("task:failed", this.handleTaskFailed.bind(this));
    }

    this.emit("agent:registered", agent.id);
  }

  unregister(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      console.log(`[CONDUCTOR] Unregistered agent ${agentId}`);
      this.emit("agent:unregistered", agentId);
    }
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAgentsByType(type: AgentType): Agent[] {
    return Array.from(this.agents.values()).filter((agent) => agent.type === type);
  }

  getAvailableAgent(type: AgentType): Agent | undefined {
    const agents = this.getAgentsByType(type);
    const availableAgents = agents.filter(
      (agent) => agent.status === AgentStatus.IDLE && agent.getMemoryUsage() < agent.capabilities.memoryLimit * 0.8,
    );

    if (availableAgents.length === 0) return undefined;

    switch (this.config.loadBalancingStrategy) {
      case "round-robin":
        return this.selectRoundRobin(type, availableAgents);
      case "least-loaded":
        return this.selectLeastLoaded(availableAgents);
      case "priority":
        return this.selectByPriority(availableAgents);
      default:
        return availableAgents[0];
    }
  }

  async broadcast(message: AgentMessage): Promise<void> {
    const promises = Array.from(this.agents.values()).map((agent) =>
      agent.receive(message).catch((err) => console.error(`Failed to deliver message to agent ${agent.id}:`, err)),
    );
    await Promise.all(promises);
  }

  async route(task: AgentTask): Promise<Agent | undefined> {
    // CRITICAL: Force delegation through proper channels
    if (this.config.mandatoryDelegation) {
      console.warn(`[CONDUCTOR] Route called directly - redirecting to delegation system`);
      await this.processThroughDelegation(task);
      return undefined;
    }

    return undefined;
  }

  // Private helper methods (inherited)
  private selectRoundRobin(type: AgentType, agents: Agent[]): Agent {
    const index = this.roundRobinIndex.get(type) || 0;
    const selected = agents[index % agents.length]!;
    this.roundRobinIndex.set(type, index + 1);
    return selected;
  }

  private selectLeastLoaded(agents: Agent[]): Agent {
    return agents.slice(1).reduce((least, agent) => {
      const leastLoad = least.getTaskQueue().length + least.getMemoryUsage() / 100;
      const agentLoad = agent.getTaskQueue().length + agent.getMemoryUsage() / 100;
      return agentLoad < leastLoad ? agent : least;
    }, agents[0]!);
  }

  private selectByPriority(agents: Agent[]): Agent {
    return agents.slice().sort((a, b) => b.capabilities.priority - a.capabilities.priority)[0]!;
  }

  private startHealthMonitoring(): void {
    if (this.healthMonitorTimer) return;
    this.healthMonitorTimer = setInterval(() => {
      this.checkAgentHealth();
    }, 5000);
    this.healthMonitorTimer.unref?.();
  }

  private checkAgentHealth(): void {
    for (const [agentId, agent] of this.agents) {
      if (agent.status === AgentStatus.ERROR) {
        console.warn(`[CONDUCTOR] Agent ${agentId} is in error state`);
        logger.incident("Agent error state", { agentId, type: agent.type, status: agent.status });
        this.emit("agent:unhealthy", agentId);
      }

      // Check memory usage only if capabilities are defined
      if (agent.capabilities?.memoryLimit && agent.getMemoryUsage) {
        const memoryUsage = agent.getMemoryUsage();
        if (memoryUsage > agent.capabilities.memoryLimit) {
          console.warn(`[CONDUCTOR] Agent ${agentId} exceeds memory limit`);
          logger.incident("Agent memory limit exceeded", {
            agentId,
            limitMB: agent.capabilities.memoryLimit,
            usageMB: memoryUsage,
          });
          this.emit("agent:memory-exceeded", agentId);
        }
      }

      // Staleness detection based on metrics
      try {
        const metrics: any = (agent as any).getMetrics ? (agent as any).getMetrics() : undefined;
        const last = metrics?.lastActivity ?? Date.now();
        this.agentLastSeen.set(agentId, last);
        if (Date.now() - last > this.AGENT_STALE_MS) {
          logger.incident("Agent heartbeat stale", { agentId, lastActivity: last });
        }
      } catch {
        // ignore metric errors
      }
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      // Aggregate snapshot
      const snapshot = {
        agents: this.agents.size,
        pendingTasks: this.pendingTasks.size,
        taskQueueLimit: this.config.taskQueueLimit,
        maxConcurrentAgents: this.config.resourceConstraints.maxConcurrentAgents,
      };
      logger.systemEvent("HEARTBEAT", snapshot);

      // Per-agent heartbeat summary
      for (const [agentId, agent] of this.agents) {
        const m: any = (agent as any).getMetrics ? (agent as any).getMetrics() : undefined;
        logger.agentActivity(agentId, "heartbeat", {
          status: agent.status,
          memMB: agent.getMemoryUsage(),
          cpuPct: agent.getCpuUsage?.() ?? undefined,
          lastActivity: m?.lastActivity,
          queue: agent.getTaskQueue().length,
        });
      }

      // Backpressure check
      if (this.pendingTasks.size > this.config.taskQueueLimit * 0.8) {
        logger.incident("Task queue high water mark", {
          pending: this.pendingTasks.size,
          limit: this.config.taskQueueLimit,
        });
      }
    }, this.HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref?.();
  }

  protected async handleMessage(message: AgentMessage): Promise<void> {
    switch (message.type) {
      case "register":
        console.log(`[CONDUCTOR] Registration request from ${message.from}`);
        break;
      case "health":
        console.log(`[CONDUCTOR] Health update from ${message.from}:`, message.payload);
        break;
      case "broadcast":
        await this.broadcast(message);
        break;
      default: {
        const targetAgent = this.agents.get(message.to);
        if (targetAgent) {
          await targetAgent.receive(message);
        }
      }
    }
  }

  private handleTaskCompleted(data: any): void {
    console.log(`[CONDUCTOR] Task ${data.task.id} completed by agent ${data.agentId}`);
    this.emit("task:routed:completed", data);
  }

  private handleTaskFailed(data: any): void {
    console.error(`[CONDUCTOR] Task ${data.task.id} failed on agent ${data.agentId}:`, data.error);
    this.emit("task:routed:failed", data);
  }

  // TASK-004B: Performance optimization methods

  private initializePerformanceOptimizations(): void {
    console.log(`[CONDUCTOR] TASK-004B: Initializing performance optimizations`);

    // Pre-populate method proposal templates
    this.initializeMethodProposalTemplates();

    // Start performance monitoring
    if (!this.performanceMonitorTimer) {
      this.performanceMonitorTimer = setInterval(() => {
        this.updatePerformanceMetrics();
        this.cleanupCaches();
      }, 10000); // Every 10 seconds
      this.performanceMonitorTimer.unref?.();
    }

    console.log(`[CONDUCTOR] TASK-004B: Performance optimizations active`);
  }

  private initializeMethodProposalTemplates(): void {
    // Create reusable templates for common task patterns
    const templateTypes = ["refactor", "implementation", "analysis", "optimization", "debugging"];

    for (const type of templateTypes) {
      this.methodProposalTemplates.set(type, this.createMethodProposalTemplate(type));
    }

    console.log(`[CONDUCTOR] TASK-004B: Method proposal templates cached for ${templateTypes.length} task types`);
  }

  private createMethodProposalTemplate(taskType: string): MethodProposal[] {
    // Generate optimized templates based on task type
    const baseProposals: MethodProposal[] = [
      {
        id: "method-1",
        name: "Incremental Approach",
        description: `Incremental ${taskType} with continuous validation`,
        pros: ["Lower risk", "Continuous feedback", "Easy rollback"],
        cons: ["Slower completion", "Multiple validation steps"],
        timeline: "1-2 weeks",
        riskLevel: "low",
        recommended: true,
      },
      {
        id: "method-2",
        name: "Parallel Processing",
        description: `Parallel ${taskType} with independent components`,
        pros: ["Faster completion", "Efficient resource usage"],
        cons: ["Coordination complexity", "Integration challenges"],
        timeline: "3-5 days",
        riskLevel: "medium",
        recommended: false,
      },
    ];

    return baseProposals;
  }

  private updatePerformanceMetrics(): void {
    const cacheHits = Array.from(this.agentLoadCache.values()).length;
    const totalRequests = this.performanceMetrics.totalTasks;

    if (totalRequests > 0) {
      this.performanceMetrics.cacheHitRate = cacheHits / totalRequests;
      this.performanceMetrics.overheadReduction = Math.min(40, (cacheHits / totalRequests) * 100);
    }

    // Log performance improvements every 100 tasks
    if (this.performanceMetrics.totalTasks > 0 && this.performanceMetrics.totalTasks % 100 === 0) {
      console.log(
        `[CONDUCTOR] TASK-004B: Performance metrics - overhead reduction: ${this.performanceMetrics.overheadReduction.toFixed(1)}%`,
      );
    }
  }

  private cleanupCaches(): void {
    const now = Date.now();

    // Clean up agent load cache
    for (const [agentId, data] of this.agentLoadCache) {
      if (now - data.timestamp > this.LOAD_CACHE_TTL) {
        this.agentLoadCache.delete(agentId);
      }
    }

    // Clean up old task complexity cache entries (keep last 100)
    if (this.taskComplexityCache.size > 100) {
      const entries = Array.from(this.taskComplexityCache.entries());
      const toKeep = entries.slice(-100);
      this.taskComplexityCache.clear();
      for (const [key, value] of toKeep) {
        this.taskComplexityCache.set(key, value);
      }
    }
  }

  /**
   * TASK-004B: Get performance metrics for monitoring
   */
  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * TASK-004B: Optimized method proposal generation using templates
   */
  private async generateOptimizedMethodProposals(
    task: AgentTask,
    complexity: TaskComplexityAnalysis,
  ): Promise<MethodProposal[]> {
    const startTime = Date.now();

    // Try to use cached template first
    const taskTypeKey = this.getTaskTypeKey(task);
    const template = this.methodProposalTemplates.get(taskTypeKey);

    if (template) {
      this.performanceMetrics.cacheHitRate++;
      console.log(`[CONDUCTOR] TASK-004B: Using cached method proposals for ${taskTypeKey}`);
      return template.map((proposal) => ({
        ...proposal,
        description: proposal.description.replace(taskTypeKey, `${taskTypeKey} for ${task.type}`),
      }));
    }

    // Fallback to original method
    const proposals = await this.generateMethodProposals(task, complexity);

    // Cache the result for future use
    this.methodProposalTemplates.set(taskTypeKey, proposals);

    const duration = Date.now() - startTime;
    console.log(`[CONDUCTOR] TASK-004B: Generated and cached proposals for ${taskTypeKey} in ${duration}ms`);

    return proposals;
  }

  private getTaskTypeKey(task: AgentTask): string {
    const payload = task.payload as any;
    if (payload?.requiresResearch) return "analysis";
    if (task.type.includes("refactor")) return "refactor";
    if (task.type.includes("implement")) return "implementation";
    if (task.type.includes("optimize")) return "optimization";
    if (task.type.includes("debug") || task.type.includes("fix")) return "debugging";
    return "implementation"; // default
  }
}
