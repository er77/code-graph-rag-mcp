/**
 * Resource Manager for commodity hardware optimization
 * Monitors and manages CPU, memory, and I/O resources
 */

import { EventEmitter } from "node:events";
import os from "node:os";
import type { ResourceConstraints } from "../types/agent.js";

export interface ResourceSnapshot {
  timestamp: number;
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  cpu: {
    cores: number;
    usage: number;
    loadAverage: number[];
  };
  io: {
    pendingReads: number;
    pendingWrites: number;
  };
}

export interface ResourceAllocation {
  agentId: string;
  memoryMB: number;
  cpuPercent: number;
  priority: number;
}

export class ResourceManager extends EventEmitter {
  private constraints: ResourceConstraints;
  private allocations: Map<string, ResourceAllocation> = new Map();
  private snapshots: ResourceSnapshot[] = [];
  private maxSnapshots = 60; // Keep 1 minute of history at 1 second intervals
  private monitoringInterval: NodeJS.Timeout | null = null;

  // Throttling state
  private isThrottled = false;
  private throttleThreshold = 0.8; // Throttle at 80% resource usage

  constructor(constraints?: ResourceConstraints) {
    super();

    // Default constraints for commodity hardware (4-core, 8GB RAM)
    this.constraints = constraints || {
      maxMemoryMB: 1024, // 1GB limit for our process
      maxCpuPercent: 80,
      maxConcurrentAgents: 10,
      maxTaskQueueSize: 100,
    };
  }

  /**
   * Start resource monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(() => {
      this.captureSnapshot();
      this.checkResourcePressure();
    }, 1000);

    console.log("Resource monitoring started");
    this.emit("monitoring:started");
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log("Resource monitoring stopped");
      this.emit("monitoring:stopped");
    }
  }

  /**
   * Request resource allocation for an agent
   */
  requestAllocation(agentId: string, memoryMB: number, cpuPercent: number, priority = 5): boolean {
    const currentTotal = this.getTotalAllocated();

    // Check if allocation would exceed constraints
    if (currentTotal.memory + memoryMB > this.constraints.maxMemoryMB) {
      this.emit("allocation:denied", {
        agentId,
        reason: "memory_exceeded",
        requested: memoryMB,
        available: this.constraints.maxMemoryMB - currentTotal.memory,
      });
      return false;
    }

    if (currentTotal.cpu + cpuPercent > this.constraints.maxCpuPercent) {
      this.emit("allocation:denied", {
        agentId,
        reason: "cpu_exceeded",
        requested: cpuPercent,
        available: this.constraints.maxCpuPercent - currentTotal.cpu,
      });
      return false;
    }

    // Grant allocation
    this.allocations.set(agentId, {
      agentId,
      memoryMB,
      cpuPercent,
      priority,
    });

    this.emit("allocation:granted", { agentId, memoryMB, cpuPercent });
    return true;
  }

  /**
   * Release resources allocated to an agent
   */
  releaseAllocation(agentId: string): void {
    if (this.allocations.has(agentId)) {
      const allocation = this.allocations.get(agentId)!;
      this.allocations.delete(agentId);
      this.emit("allocation:released", allocation);
    }
  }

  /**
   * Get current resource usage
   */
  getCurrentUsage(): ResourceSnapshot | null {
    return this.snapshots[this.snapshots.length - 1] || null;
  }

  /**
   * Get resource usage history
   */
  getHistory(seconds = 60): ResourceSnapshot[] {
    const cutoff = Date.now() - seconds * 1000;
    return this.snapshots.filter((s) => s.timestamp >= cutoff);
  }

  /**
   * Check if system should be throttled
   */
  isSystemThrottled(): boolean {
    return this.isThrottled;
  }

  /**
   * Get available resources
   */
  getAvailableResources(): {
    memoryMB: number;
    cpuPercent: number;
  } {
    const allocated = this.getTotalAllocated();
    return {
      memoryMB: Math.max(0, this.constraints.maxMemoryMB - allocated.memory),
      cpuPercent: Math.max(0, this.constraints.maxCpuPercent - allocated.cpu),
    };
  }

  /**
   * Suggest optimal allocation for a new agent
   */
  suggestAllocation(priority: number): {
    memoryMB: number;
    cpuPercent: number;
  } | null {
    const available = this.getAvailableResources();

    if (available.memoryMB < 50 || available.cpuPercent < 5) {
      return null; // Not enough resources
    }

    // Allocate based on priority (0-10 scale)
    const memoryFactor = priority / 10;
    const cpuFactor = priority / 10;

    return {
      memoryMB: Math.min(
        Math.floor(available.memoryMB * memoryFactor * 0.5), // Use up to 50% of available
        256, // Cap at 256MB per agent
      ),
      cpuPercent: Math.min(
        Math.floor(available.cpuPercent * cpuFactor * 0.5), // Use up to 50% of available
        25, // Cap at 25% per agent
      ),
    };
  }

  /**
   * Force garbage collection if available
   */
  requestGarbageCollection(): void {
    if (global.gc) {
      console.log("Forcing garbage collection...");
      global.gc();
      this.emit("gc:completed");
    } else {
      console.warn("Garbage collection not exposed. Run with --expose-gc flag.");
    }
  }

  // Private methods

  private captureSnapshot(): void {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const snapshot: ResourceSnapshot = {
      timestamp: Date.now(),
      memory: {
        total: Math.round(totalMem / 1024 / 1024),
        used: Math.round(usedMem / 1024 / 1024),
        free: Math.round(freeMem / 1024 / 1024),
        percentage: (usedMem / totalMem) * 100,
      },
      cpu: {
        cores: os.cpus().length,
        usage: this.calculateCpuUsage(),
        loadAverage: os.loadavg(),
      },
      io: {
        pendingReads: 0, // Would need actual I/O monitoring
        pendingWrites: 0,
      },
    };

    this.snapshots.push(snapshot);

    // Maintain snapshot limit
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    this.emit("snapshot:captured", snapshot);
  }

  private calculateCpuUsage(): number {
    // Simplified CPU usage calculation
    // In production, would track actual CPU time
    const loadAvg = os.loadavg()[0]; // 1 minute load average
    const cores = os.cpus().length;
    return Math.min(100, (loadAvg / cores) * 100);
  }

  private checkResourcePressure(): void {
    const current = this.getCurrentUsage();
    if (!current) return;

    const memoryPressure = current.memory.percentage > this.throttleThreshold * 100;
    const cpuPressure = current.cpu.usage > this.throttleThreshold * 100;

    const wasThrottled = this.isThrottled;
    this.isThrottled = memoryPressure || cpuPressure;

    if (this.isThrottled && !wasThrottled) {
      console.warn("System under resource pressure, enabling throttling");
      this.emit("throttle:enabled", { memory: memoryPressure, cpu: cpuPressure });

      // Try to free up memory
      if (memoryPressure) {
        this.requestGarbageCollection();
      }
    } else if (!this.isThrottled && wasThrottled) {
      console.log("Resource pressure relieved, disabling throttling");
      this.emit("throttle:disabled");
    }

    // Emit warnings for critical levels
    if (current.memory.percentage > 90) {
      this.emit("memory:critical", current.memory);
    }

    if (current.cpu.usage > 90) {
      this.emit("cpu:critical", current.cpu);
    }
  }

  private getTotalAllocated(): { memory: number; cpu: number } {
    let totalMemory = 0;
    let totalCpu = 0;

    for (const allocation of this.allocations.values()) {
      totalMemory += allocation.memoryMB;
      totalCpu += allocation.cpuPercent;
    }

    return { memory: totalMemory, cpu: totalCpu };
  }
}

// Singleton instance
export const resourceManager = new ResourceManager();
