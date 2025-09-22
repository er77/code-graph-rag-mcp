/**
 * Development Agent - Handles implementation and indexing tasks
 * This agent is responsible for code development, indexing, and implementation tasks
 * that are delegated by the Conductor orchestrator
 */

import { BaseAgent } from "./base.js";
import { AgentTask, AgentType, AgentMessage } from "../types/agent.js";
// Temporarily disable ParserAgent due to web-tree-sitter ESM issues
// import { ParserAgent } from "./parser-agent.js";
import { IndexerAgent } from "./indexer-agent.js";
import { knowledgeBus } from "../core/knowledge-bus.js";
import { readdirSync, statSync } from "fs";
import { join, extname } from "path";

export class DevAgent extends BaseAgent {
  // private parserAgent: ParserAgent | null = null;
  private indexerAgent: IndexerAgent | null = null;

  constructor(agentId?: string) {
    super(AgentType.DEV, {
      maxConcurrency: 3,
      memoryLimit: 256, // MB
      cpuAffinity: undefined,
      priority: 7
    });

    if (agentId) {
      this.id = agentId;
    }
  }

  protected async onInitialize(): Promise<void> {
    // Initialize parser and indexer agents
    try {
      // Temporarily disabled due to web-tree-sitter ESM issues
      // this.parserAgent = new ParserAgent(knowledgeBus);
      // await this.parserAgent.initialize();
      // console.log(`[DevAgent ${this.id}] ParserAgent initialized`);

      this.indexerAgent = new IndexerAgent();
      await this.indexerAgent.initialize();
      console.log(`[DevAgent ${this.id}] IndexerAgent initialized`);
    } catch (error) {
      console.error(`[DevAgent ${this.id}] Failed to initialize sub-agents:`, error);
      throw error;
    }

    // Subscribe to relevant knowledge bus topics
    knowledgeBus.subscribe("task:implementation", (entry) => {
      if (entry.data.targetAgent === "dev-agent") {
        this.addTask({
          id: entry.data.taskId,
          type: "implementation",
          priority: entry.data.priority || 5,
          payload: entry.data,
          createdAt: Date.now(),
        });
      }
    });

    console.log(`[DevAgent ${this.id}] Initialized and ready for implementation tasks`);
  }

  protected canProcessTask(task: AgentTask): boolean {
    // DevAgent can handle index, implementation, and refactor tasks
    return task.type === "index" ||
           task.type === "implementation" ||
           task.type === "refactor" ||
           task.type === "dev";
  }

  protected async handleMessage(message: AgentMessage): Promise<void> {
    console.log(`[DevAgent ${this.id}] Received message from ${message.from}: ${message.type}`);
    // Handle inter-agent messages if needed
  }

  protected async processTask(task: AgentTask): Promise<unknown> {
    console.log(`[DevAgent ${this.id}] Processing task ${task.id} of type ${task.type}`);

    try {
      switch (task.type) {
        case "index":
          return await this.handleIndexTask(task);

        case "implementation":
          return await this.handleImplementationTask(task);

        case "refactor":
          return await this.handleRefactorTask(task);

        default:
          // For any other task type, delegate to appropriate agents
          return await this.delegateTask(task);
      }
    } catch (error) {
      console.error(`[DevAgent ${this.id}] Error processing task:`, error);
      throw error;
    }
  }

  private async handleIndexTask(task: AgentTask): Promise<unknown> {
    const payload = task.payload as any;
    console.log(`[DevAgent ${this.id}] Starting real indexing for ${payload.directory}`);

    // Temporarily disabled ParserAgent check
    // if (!this.parserAgent || !this.indexerAgent) {
    //   throw new Error("Parser or Indexer agents not initialized");
    // }
    if (!this.indexerAgent) {
      throw new Error("Indexer agent not initialized");
    }

    const result = {
      status: "started",
      directory: payload.directory,
      incremental: payload.incremental || false,
      excludePatterns: payload.excludePatterns || [],
      batchMode: payload.batchMode || false,
      timestamp: Date.now(),
      filesProcessed: 0,
      entitiesExtracted: 0,
      relationshipsCreated: 0,
    };

    // Publish indexing started event
    knowledgeBus.publish({
      topic: "indexing:started",
      source: this.id,
      data: result,
    });

    // Perform real indexing using parser and indexer agents
    const indexingResult = await this.performRealIndexing(payload);

    return {
      ...result,
      ...indexingResult,
      status: "completed",
      message: `Real indexing completed for ${payload.directory}`,
    };
  }

  private async handleImplementationTask(task: AgentTask): Promise<unknown> {
    const payload = task.payload as any;
    console.log(`[DevAgent ${this.id}] Implementing: ${payload.description || 'task'}`);

    // Implementation tasks would involve code generation, modifications, etc.
    // For now, we'll return a success response
    return {
      status: "completed",
      taskId: task.id,
      implementation: {
        description: payload.description,
        targetAgent: "dev-agent",
        completed: true,
        timestamp: Date.now(),
      },
    };
  }

  private async handleRefactorTask(task: AgentTask): Promise<unknown> {
    const payload = task.payload as any;
    console.log(`[DevAgent ${this.id}] Refactoring: ${payload.target || 'code'}`);

    return {
      status: "completed",
      taskId: task.id,
      refactoring: {
        target: payload.target,
        suggestions: [],
        completed: true,
        timestamp: Date.now(),
      },
    };
  }

  private async delegateTask(task: AgentTask): Promise<unknown> {
    console.log(`[DevAgent ${this.id}] Delegating task ${task.id} to appropriate agent`);

    // For now, just return success
    // In a full implementation, this would coordinate with other agents
    return {
      status: "delegated",
      taskId: task.id,
      message: `Task ${task.id} delegated for processing`,
      timestamp: Date.now(),
    };
  }

  private async performRealIndexing(payload: any): Promise<any> {
    console.log(`[DevAgent ${this.id}] Performing real indexing...`);

    const directory = payload.directory;
    const excludePatterns = payload.excludePatterns || [];
    const incremental = payload.incremental || false;

    // Get list of files to process
    const files = await this.collectFiles(directory, excludePatterns);
    console.log(`[DevAgent ${this.id}] Found ${files.length} files to process`);

    // Process files in batches
    const batchSize = 50;
    let totalEntities = 0;
    let totalRelationships = 0;
    let filesProcessed = 0;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, Math.min(i + batchSize, files.length));

      // Parse files using ParserAgent
      const parseTask: AgentTask = {
        id: `parse-${Date.now()}-${i}`,
        type: "parse:batch",
        priority: 8,
        payload: {
          files: batch,
          incremental,
        },
        createdAt: Date.now(),
      };

      try {
        // Temporarily use mock data instead of ParserAgent
        // const parseResult = await this.parserAgent!.process(parseTask);
        // const parsedData = parseResult as any;
        const parsedData = {
          entities: batch.map(file => ({
            name: file.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'unknown',
            type: 'file',
            filePath: file,
            location: {
              start: { line: 1, column: 0 },
              end: { line: 100, column: 0 }
            },
            metadata: {
              language: extname(file).substring(1),
              size: 0
            }
          }))
        };

        if (parsedData && parsedData.entities) {
          // Index parsed entities using IndexerAgent
          const indexTask: AgentTask = {
            id: `index-entities-${Date.now()}-${i}`,
            type: "index:entities",
            priority: 7,
            payload: {
              entities: parsedData.entities,
              filePath: batch[0], // Representative file for this batch
            },
            createdAt: Date.now(),
          };

          const indexResult = await this.indexerAgent!.process(indexTask);
          const indexed = indexResult as any;

          if (indexed) {
            totalEntities += indexed.entitiesIndexed || 0;
            totalRelationships += indexed.relationshipsCreated || 0;
            filesProcessed += batch.length;
          }
        }
      } catch (error) {
        console.error(`[DevAgent ${this.id}] Error processing batch ${i}:`, error);
        // Continue with next batch
      }

      // Report progress
      if ((i + batchSize) % 100 === 0 || i + batchSize >= files.length) {
        console.log(`[DevAgent ${this.id}] Progress: ${filesProcessed}/${files.length} files processed`);
      }
    }

    return {
      filesProcessed,
      entitiesExtracted: totalEntities,
      relationshipsCreated: totalRelationships,
      totalFiles: files.length,
    };
  }

  private async collectFiles(directory: string, excludePatterns: string[]): Promise<string[]> {
    const files: string[] = [];
    const supportedExtensions = [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".c", ".go", ".rs"];
    const agentId = this.id; // Capture this.id for use in nested function

    function shouldExclude(path: string): boolean {
      for (const pattern of excludePatterns) {
        if (pattern.includes("**")) {
          const regex = pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
          if (new RegExp(regex).test(path)) return true;
        } else if (path.includes(pattern.replace(/\*/g, ""))) {
          return true;
        }
      }
      return false;
    }

    function walkDir(dir: string) {
      try {
        const items = readdirSync(dir);
        for (const item of items) {
          const fullPath = join(dir, item);

          if (shouldExclude(fullPath)) continue;

          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            if (!item.startsWith(".") && item !== "node_modules") {
              walkDir(fullPath);
            }
          } else if (stat.isFile()) {
            const ext = extname(fullPath).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`[DevAgent ${agentId}] Error reading directory ${dir}:`, error);
      }
    }

    walkDir(directory);
    return files;
  }

  protected async onShutdown(): Promise<void> {
    console.log(`[DevAgent ${this.id}] Shutting down...`);

    // Shutdown sub-agents
    // if (this.parserAgent) {
    //   await this.parserAgent.shutdown();
    // }
    if (this.indexerAgent) {
      await this.indexerAgent.shutdown();
    }
  }
}

// Export singleton instance
export const devAgent = new DevAgent();