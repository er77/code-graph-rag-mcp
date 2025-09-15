/**
 * Coordinator agent for managing multi-agent workflows
 * Implements task distribution, load balancing, and resource management
 */

import { BaseAgent } from './base.js';
import { 
  AgentType, 
  AgentTask, 
  AgentMessage, 
  Agent,
  AgentPool,
  ResourceConstraints,
  AgentStatus
} from '../types/agent.js';

interface CoordinatorConfig {
  resourceConstraints: ResourceConstraints;
  taskQueueLimit: number;
  loadBalancingStrategy: 'round-robin' | 'least-loaded' | 'priority';
}

export class CoordinatorAgent extends BaseAgent implements AgentPool {
  public agents: Map<string, Agent> = new Map();
  private config: CoordinatorConfig;
  private roundRobinIndex: Map<AgentType, number> = new Map();
  private pendingTasks: Map<string, AgentTask> = new Map();
  
  constructor(config: CoordinatorConfig) {
    super(AgentType.COORDINATOR, {
      maxConcurrency: 100, // Can coordinate many tasks
      memoryLimit: 128, // MB - lightweight coordinator
      priority: 10 // Highest priority
    });
    
    this.config = config;
  }
  
  protected async onInitialize(): Promise<void> {
    console.log(`[Coordinator] Initializing with constraints:`, this.config.resourceConstraints);
    this.startHealthMonitoring();
  }
  
  protected async onShutdown(): Promise<void> {
    console.log(`[Coordinator] Shutting down all agents...`);
    const shutdownPromises = Array.from(this.agents.values()).map(agent => 
      agent.shutdown().catch(err => 
        console.error(`Failed to shutdown agent ${agent.id}:`, err)
      )
    );
    await Promise.all(shutdownPromises);
    this.agents.clear();
  }
  
  protected canProcessTask(task: AgentTask): boolean {
    // Coordinator can always accept tasks for routing
    return this.pendingTasks.size < this.config.taskQueueLimit;
  }
  
  protected async processTask(task: AgentTask): Promise<unknown> {
    // Route task to appropriate agent
    const agent = await this.route(task);
    
    if (!agent) {
      throw new Error(`No available agent for task ${task.id} of type ${task.type}`);
    }
    
    this.pendingTasks.set(task.id, task);
    
    try {
      const result = await agent.process(task);
      this.pendingTasks.delete(task.id);
      return result;
    } catch (error) {
      this.pendingTasks.delete(task.id);
      
      // Try to route to another agent if available
      const alternativeAgent = await this.route(task);
      if (alternativeAgent && alternativeAgent.id !== agent.id) {
        console.log(`[Coordinator] Retrying task ${task.id} with agent ${alternativeAgent.id}`);
        return alternativeAgent.process(task);
      }
      
      throw error;
    }
  }
  
  protected async handleMessage(message: AgentMessage): Promise<void> {
    switch (message.type) {
      case 'register':
        this.handleAgentRegistration(message);
        break;
      case 'health':
        this.handleHealthUpdate(message);
        break;
      case 'broadcast':
        await this.broadcast(message);
        break;
      default:
        // Route to specific agent
        const targetAgent = this.agents.get(message.to);
        if (targetAgent) {
          await targetAgent.receive(message);
        }
    }
  }
  
  // AgentPool implementation
  register(agent: Agent): void {
    if (this.agents.size >= this.config.resourceConstraints.maxConcurrentAgents) {
      throw new Error(`Maximum number of agents (${this.config.resourceConstraints.maxConcurrentAgents}) reached`);
    }
    
    this.agents.set(agent.id, agent);
    console.log(`[Coordinator] Registered agent ${agent.id} of type ${agent.type}`);
    
    // Set up event listeners
    agent.on('task:completed', this.handleTaskCompleted.bind(this));
    agent.on('task:failed', this.handleTaskFailed.bind(this));
    
    this.emit('agent:registered', agent.id);
  }
  
  unregister(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      console.log(`[Coordinator] Unregistered agent ${agentId}`);
      this.emit('agent:unregistered', agentId);
    }
  }
  
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }
  
  getAgentsByType(type: AgentType): Agent[] {
    return Array.from(this.agents.values()).filter(agent => agent.type === type);
  }
  
  getAvailableAgent(type: AgentType): Agent | undefined {
    const agents = this.getAgentsByType(type);
    const availableAgents = agents.filter(agent => 
      agent.status === AgentStatus.IDLE &&
      agent.getMemoryUsage() < agent.capabilities.memoryLimit * 0.8
    );
    
    if (availableAgents.length === 0) return undefined;
    
    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        return this.selectRoundRobin(type, availableAgents);
      case 'least-loaded':
        return this.selectLeastLoaded(availableAgents);
      case 'priority':
        return this.selectByPriority(availableAgents);
      default:
        return availableAgents[0];
    }
  }
  
  async broadcast(message: AgentMessage): Promise<void> {
    const promises = Array.from(this.agents.values()).map(agent =>
      agent.receive(message).catch(err => 
        console.error(`Failed to deliver message to agent ${agent.id}:`, err)
      )
    );
    await Promise.all(promises);
  }
  
  async route(task: AgentTask): Promise<Agent | undefined> {
    // Determine agent type from task type
    const agentType = this.getAgentTypeForTask(task);
    if (!agentType) return undefined;
    
    // Check resource constraints
    if (!this.checkResourceAvailability()) {
      console.warn(`[Coordinator] Resource constraints exceeded, queuing task ${task.id}`);
      return undefined;
    }
    
    return this.getAvailableAgent(agentType);
  }
  
  // Private methods
  private getAgentTypeForTask(task: AgentTask): AgentType | undefined {
    // Map task types to agent types
    const taskTypeMap: Record<string, AgentType> = {
      'parse': AgentType.PARSER,
      'index': AgentType.INDEXER,
      'query': AgentType.QUERY,
      'semantic': AgentType.SEMANTIC
    };
    
    return taskTypeMap[task.type];
  }
  
  private checkResourceAvailability(): boolean {
    const totalMemory = Array.from(this.agents.values())
      .reduce((sum, agent) => sum + agent.getMemoryUsage(), 0);
    
    const totalCpu = Array.from(this.agents.values())
      .reduce((sum, agent) => sum + agent.getCpuUsage(), 0);
    
    return (
      totalMemory < this.config.resourceConstraints.maxMemoryMB &&
      totalCpu < this.config.resourceConstraints.maxCpuPercent
    );
  }
  
  private selectRoundRobin(type: AgentType, agents: Agent[]): Agent {
    const index = this.roundRobinIndex.get(type) || 0;
    const selected = agents[index % agents.length];
    this.roundRobinIndex.set(type, index + 1);
    return selected;
  }
  
  private selectLeastLoaded(agents: Agent[]): Agent {
    return agents.reduce((least, agent) => {
      const leastLoad = least.getTaskQueue().length + least.getMemoryUsage() / 100;
      const agentLoad = agent.getTaskQueue().length + agent.getMemoryUsage() / 100;
      return agentLoad < leastLoad ? agent : least;
    });
  }
  
  private selectByPriority(agents: Agent[]): Agent {
    return agents.sort((a, b) => b.capabilities.priority - a.capabilities.priority)[0];
  }
  
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.checkAgentHealth();
    }, 5000); // Check every 5 seconds
  }
  
  private checkAgentHealth(): void {
    for (const [agentId, agent] of this.agents) {
      if (agent.status === AgentStatus.ERROR) {
        console.warn(`[Coordinator] Agent ${agentId} is in error state`);
        this.emit('agent:unhealthy', agentId);
      }
      
      if (agent.getMemoryUsage() > agent.capabilities.memoryLimit) {
        console.warn(`[Coordinator] Agent ${agentId} exceeds memory limit`);
        this.emit('agent:memory-exceeded', agentId);
      }
    }
  }
  
  private handleAgentRegistration(message: AgentMessage): void {
    // Handle dynamic agent registration via messages
    console.log(`[Coordinator] Received registration request from ${message.from}`);
  }
  
  private handleHealthUpdate(message: AgentMessage): void {
    // Handle health updates from agents
    console.log(`[Coordinator] Health update from ${message.from}:`, message.payload);
  }
  
  private handleTaskCompleted(data: any): void {
    console.log(`[Coordinator] Task ${data.task.id} completed by agent ${data.agentId}`);
    this.emit('task:routed:completed', data);
  }
  
  private handleTaskFailed(data: any): void {
    console.error(`[Coordinator] Task ${data.task.id} failed on agent ${data.agentId}:`, data.error);
    this.emit('task:routed:failed', data);
  }
}