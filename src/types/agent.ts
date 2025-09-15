/**
 * Core agent type definitions for the LiteRAG multi-agent architecture
 * Optimized for commodity hardware (4-core CPU, 8GB RAM)
 */

export enum AgentType {
  COORDINATOR = 'coordinator',
  DEV = 'dev',
  DORA = 'dora',
  INDEXER = 'indexer',
  PARSER = 'parser',
  QUERY = 'query',
  SEMANTIC = 'semantic'
}

export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  SHUTDOWN = 'shutdown'
}

export interface AgentCapabilities {
  maxConcurrency: number;
  memoryLimit: number; // in MB
  cpuAffinity?: number[]; // CPU cores to bind to
  priority: number; // 0-10, higher is more important
}

export interface AgentMessage<T = unknown> {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: T;
  timestamp: number;
  correlationId?: string;
}

export interface AgentTask {
  id: string;
  type: string;
  priority: number;
  payload: unknown;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: Error;
  result?: unknown;
}

export interface Agent {
  id: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: AgentCapabilities;
  
  // Lifecycle methods
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  // Task processing
  canHandle(task: AgentTask): boolean;
  process(task: AgentTask): Promise<unknown>;
  
  // Communication
  send(message: AgentMessage): Promise<void>;
  receive(message: AgentMessage): Promise<void>;
  
  // Resource management
  getMemoryUsage(): number;
  getCpuUsage(): number;
  getTaskQueue(): AgentTask[];
}

export interface AgentPool {
  agents: Map<string, Agent>;
  
  register(agent: Agent): void;
  unregister(agentId: string): void;
  
  getAgent(id: string): Agent | undefined;
  getAgentsByType(type: AgentType): Agent[];
  getAvailableAgent(type: AgentType): Agent | undefined;
  
  broadcast(message: AgentMessage): Promise<void>;
  route(task: AgentTask): Promise<Agent | undefined>;
}

export interface ResourceConstraints {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxConcurrentAgents: number;
  maxTaskQueueSize: number;
}

export interface AgentMetrics {
  agentId: string;
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  averageProcessingTime: number;
  currentMemoryMB: number;
  currentCpuPercent: number;
  lastActivity: number;
}