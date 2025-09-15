/**
 * Base agent implementation with resource management
 * Provides common functionality for all specialized agents
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { 
  type Agent, 
  AgentType, 
  AgentStatus, 
  type AgentCapabilities, 
  type AgentTask, 
  type AgentMessage,
  type AgentMetrics 
} from '../types/agent.js';

export abstract class BaseAgent extends EventEmitter implements Agent {
  public readonly id: string;
  public readonly type: AgentType;
  public status: AgentStatus;
  public readonly capabilities: AgentCapabilities;
  
  protected taskQueue: AgentTask[] = [];
  protected currentTask: AgentTask | null = null;
  protected metrics: AgentMetrics;
  protected memoryUsage = 0;
  protected cpuUsage = 0;
  
  constructor(type: AgentType, capabilities: AgentCapabilities) {
    super();
    this.id = `${type}-${randomUUID().slice(0, 8)}`;
    this.type = type;
    this.status = AgentStatus.IDLE;
    this.capabilities = capabilities;
    
    this.metrics = {
      agentId: this.id,
      tasksProcessed: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      averageProcessingTime: 0,
      currentMemoryMB: 0,
      currentCpuPercent: 0,
      lastActivity: Date.now()
    };
    
    this.startResourceMonitoring();
  }
  
  async initialize(): Promise<void> {
    console.log(`[${this.id}] Initializing agent...`);
    this.status = AgentStatus.IDLE;
    await this.onInitialize();
    this.emit('initialized', this.id);
  }
  
  async shutdown(): Promise<void> {
    console.log(`[${this.id}] Shutting down agent...`);
    this.status = AgentStatus.SHUTDOWN;
    await this.onShutdown();
    this.emit('shutdown', this.id);
  }
  
  canHandle(task: AgentTask): boolean {
    if (this.status !== AgentStatus.IDLE) return false;
    if (this.taskQueue.length >= this.capabilities.maxConcurrency) return false;
    if (this.memoryUsage > this.capabilities.memoryLimit * 0.9) return false;
    return this.canProcessTask(task);
  }
  
  async process(task: AgentTask): Promise<unknown> {
    if (!this.canHandle(task)) {
      throw new Error(`Agent ${this.id} cannot handle task ${task.id}`);
    }
    
    this.taskQueue.push(task);
    this.status = AgentStatus.BUSY;
    this.currentTask = task;
    task.startedAt = Date.now();
    
    try {
      const result = await this.processTask(task);
      task.completedAt = Date.now();
      task.result = result;
      
      this.metrics.tasksProcessed++;
      this.metrics.tasksSucceeded++;
      this.updateAverageProcessingTime(task.completedAt - task.startedAt);
      
      this.emit('task:completed', { agentId: this.id, task });
      return result;
    } catch (error) {
      task.error = error as Error;
      task.completedAt = Date.now();
      
      this.metrics.tasksProcessed++;
      this.metrics.tasksFailed++;
      
      this.emit('task:failed', { agentId: this.id, task, error });
      throw error;
    } finally {
      this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
      this.currentTask = null;
      
      if (this.taskQueue.length === 0) {
        this.status = AgentStatus.IDLE;
      }
      
      this.metrics.lastActivity = Date.now();
    }
  }
  
  async send(message: AgentMessage): Promise<void> {
    this.emit('message:send', message);
  }
  
  async receive(message: AgentMessage): Promise<void> {
    this.emit('message:received', message);
    await this.handleMessage(message);
  }
  
  getMemoryUsage(): number {
    return this.memoryUsage;
  }
  
  getCpuUsage(): number {
    return this.cpuUsage;
  }
  
  getTaskQueue(): AgentTask[] {
    return [...this.taskQueue];
  }
  
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }
  
  // Abstract methods for subclasses to implement
  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
  protected abstract canProcessTask(task: AgentTask): boolean;
  protected abstract processTask(task: AgentTask): Promise<unknown>;
  protected abstract handleMessage(message: AgentMessage): Promise<void>;
  
  // Resource monitoring
  private startResourceMonitoring(): void {
    setInterval(() => {
      this.updateResourceUsage();
    }, 1000); // Update every second
  }
  
  private updateResourceUsage(): void {
    // Simplified resource tracking - in production would use actual process metrics
    const memUsed = process.memoryUsage();
    this.memoryUsage = Math.round(memUsed.heapUsed / 1024 / 1024);
    this.metrics.currentMemoryMB = this.memoryUsage;
    
    // CPU usage would require more sophisticated tracking
    // For now, estimate based on task processing
    this.cpuUsage = this.status === AgentStatus.BUSY ? 50 : 5;
    this.metrics.currentCpuPercent = this.cpuUsage;
  }
  
  private updateAverageProcessingTime(duration: number): void {
    const prev = this.metrics.averageProcessingTime;
    const count = this.metrics.tasksSucceeded;
    this.metrics.averageProcessingTime = (prev * (count - 1) + duration) / count;
  }
}