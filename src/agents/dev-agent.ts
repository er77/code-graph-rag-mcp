/**
 * Development Agent - Handles implementation and indexing tasks
 * This agent is responsible for code development, indexing, and implementation tasks
 * that are delegated by the Conductor orchestrator
 */

import { lstatSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { ConfigLoader, getConfig } from "../config/yaml-config.js";
import { type KnowledgeEntry, knowledgeBus } from "../core/knowledge-bus.js";
import { getSQLiteManager } from "../storage/sqlite-manager.js";
import { type AgentMessage, type AgentTask, AgentType } from "../types/agent.js";
import type { ParserOptions } from "../types/parser.js";
import { BaseAgent } from "./base.js";
import { IndexerAgent } from "./indexer-agent.js";
// Temporarily disable ParserAgent due to web-tree-sitter ESM issues
import { ParserAgent } from "./parser-agent.js";

function getDevAgentConfig() {
  const config = getConfig();
  return {
    maxConcurrency: config.devAgent?.maxConcurrency ?? 3,
    memoryLimit: config.devAgent?.memoryLimit ?? 256,
    priority: config.devAgent?.priority ?? 7,
  };
}

export class DevAgent extends BaseAgent {
  private parserAgent: ParserAgent | null = null;
  private indexerAgent: IndexerAgent | null = null;
  private indexBatchSize: number;
  private defaultBatchSize: number;
  private readonly defaultMaxConcurrency: number;
  private readonly defaultMemoryLimit: number;

  constructor(_agentId?: string) {
    const agentConfig = getDevAgentConfig();
    super(AgentType.DEV, {
      maxConcurrency: agentConfig.maxConcurrency,
      memoryLimit: agentConfig.memoryLimit,
      cpuAffinity: undefined,
      priority: agentConfig.priority,
    });

    this.defaultMaxConcurrency = this.capabilities.maxConcurrency;
    this.defaultMemoryLimit = this.capabilities.memoryLimit;
    this.defaultBatchSize = 100;
    this.indexBatchSize = this.defaultBatchSize;
  }

  protected async onInitialize(): Promise<void> {
    try {
      const configLoader = ConfigLoader.getInstance();
      this.defaultBatchSize = configLoader.getDevIndexBatchSize();
      this.indexBatchSize = this.defaultBatchSize;
      const useParser = configLoader.shouldUseParser();
      if (useParser) {
        try {
          this.parserAgent = new ParserAgent();
          await this.parserAgent.initialize();
          console.log(`[DevAgent ${this.id}] ParserAgent initialized`);
        } catch (e) {
          console.warn(`[DevAgent ${this.id}] ParserAgent unavailable, fallback to heuristic indexing:`, e);
          this.parserAgent = null;
        }
      }

      const sqliteManager = getSQLiteManager();
      this.indexerAgent = new IndexerAgent(sqliteManager);
      await this.indexerAgent.initialize();
      console.log(`[DevAgent ${this.id}] IndexerAgent initialized`);
    } catch (error) {
      console.error(`[DevAgent ${this.id}] Failed to initialize sub-agents:`, error);
      throw error;
    }

    // Subscribe to relevant knowledge bus topics
    knowledgeBus.subscribe(this.id, "task:implementation", async (entry: KnowledgeEntry) => {
      const data = entry.data as { targetAgent: string; taskId: string; priority?: number; [k: string]: unknown };
      if (data.targetAgent === "dev-agent") {
        const task: AgentTask = {
          id: data.taskId,
          type: "implementation",
          priority: data.priority || 5,
          payload: data,
          createdAt: Date.now(),
        };
        await this.process(task);
      }
    });

    knowledgeBus.subscribe(this.id, "resources:adjusted", (entry) => this.handleResourceAdjustment(entry));

    console.log(`[DevAgent ${this.id}] Initialized and ready for implementation tasks`);
  }

  protected canProcessTask(task: AgentTask): boolean {
    // DevAgent can handle index, implementation, and refactor tasks
    return task.type === "index" || task.type === "implementation" || task.type === "refactor" || task.type === "dev";
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
    // Publish indexing started event (topic, data, source)
    knowledgeBus.publish("indexing:started", result, this.id);

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
    console.log(`[DevAgent ${this.id}] Implementing: ${payload.description || "task"}`);

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
    console.log(`[DevAgent ${this.id}] Refactoring: ${payload.target || "code"}`);

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

    const files = await this.collectFiles(directory, excludePatterns);
    console.log(`[DevAgent ${this.id}] Found ${files.length} files to process`);

    const configLoader = ConfigLoader.getInstance();
    const isDebugMode = process.env.MCP_DEBUG_MODE === "1";
    const configuredBatchSize = this.indexBatchSize ?? configLoader.getDevIndexBatchSize();
    const effectiveBatchSize = isDebugMode ? Math.min(configuredBatchSize, 5) : configuredBatchSize;
    const parseOptions: ParserOptions = isDebugMode
      ? {
          batchSize: Math.max(1, Math.min(3, effectiveBatchSize)),
          useCache: false,
        }
      : {};
    let totalEntities = 0;
    let totalRelationships = 0;
    let filesProcessed = 0;

    for (let i = 0; i < files.length; i += effectiveBatchSize) {
      const batch = files.slice(i, Math.min(i + effectiveBatchSize, files.length));

      try {
        if (this.parserAgent) {
          const parseTask: AgentTask = {
            id: `parse-${Date.now()}-${i}`,
            type: "parse:batch",
            priority: 8,
            payload: { files: batch, options: parseOptions },
            createdAt: Date.now(),
          };

          const results = (await this.parserAgent.process(parseTask)) as any[]; // ParseResult[]

          const byFile = new Map<string, { entities: any[]; relationships: any[] }>();

          for (const res of results || []) {
            const fp = res?.filePath;
            if (!fp) continue;
            const slot = byFile.get(fp) ?? { entities: [], relationships: [] };

            if (Array.isArray(res.entities)) {
              slot.entities.push(...res.entities);
            }

            if (Array.isArray(res.relationships)) {
              for (const r of res.relationships) {
                if (r?.from && r.to && r.type) {
                  slot.relationships.push({
                    from: r.from,
                    to: r.to,
                    type: r.type,
                    targetFile: fp,
                  });
                }
              }
            }

            byFile.set(fp, slot);
          }

          for (const [file, group] of byFile.entries()) {
            const indexTask: AgentTask = {
              id: `index-entities-${Date.now()}-${i}-${file}`,
              type: "index:entities",
              priority: 7,
              payload: {
                entities: group.entities,
                relationships: group.relationships,
                filePath: file,
              },
              createdAt: Date.now(),
            };

            try {
              const indexResult = await this.indexerAgent?.process(indexTask);
              const indexed = indexResult as any;
              if (indexed) {
                totalEntities += indexed.entitiesIndexed || 0;
                totalRelationships += indexed.relationshipsCreated || 0;
                filesProcessed += 1;
              }
            } catch (err) {
              console.error(`[DevAgent ${this.id}] Indexing failed for file ${file}:`, err);
            }
          }

          if (isDebugMode) {
            global.gc?.();
          }
        } else {
          const entities: any[] = [];
          const relationships: any[] = [];

          for (const file of batch) {
            const fileName = file.split("/").pop() || "unknown";
            const fileNameNoExt = fileName.replace(/\.[^/.]+$/, "");
            const ext = extname(file).substring(1);

            // file entity
            entities.push({
              name: fileName,
              type: "file",
              filePath: file,
              location: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
              metadata: { language: ext, path: file },
            });

            // module entity
            if (ext === "py" || ext === "js" || ext === "ts" || ext === "jsx" || ext === "tsx") {
              entities.push({
                name: fileNameNoExt,
                type: "module",
                filePath: file,
                location: { start: { line: 1, column: 0 }, end: { line: 100, column: 0 } },
                metadata: { language: ext, moduleType: "file" },
              });

              if (ext === "py" && /^[A-Z]/.test(fileNameNoExt)) {
                entities.push({
                  name: fileNameNoExt,
                  type: "class",
                  filePath: file,
                  location: { start: { line: 5, column: 0 }, end: { line: 50, column: 0 } },
                  metadata: { language: "python", visibility: "public" },
                });
              }

              if ((ext === "js" || ext === "ts") && !file.includes(".test.") && !file.includes(".spec.")) {
                entities.push({
                  name: `export_default`,
                  type: "function",
                  filePath: file,
                  location: { start: { line: 10, column: 0 }, end: { line: 30, column: 0 } },
                  metadata: { language: ext, exported: true },
                });
              }
            }
          }

          // file -> module
          for (const entity of entities) {
            if (entity.type === "file") {
              const moduleEntity = entities.find((e) => e.type === "module" && e.filePath === entity.filePath);
              if (moduleEntity) {
                relationships.push({
                  from: entity.name,
                  to: moduleEntity.name,
                  type: "contains",
                  filePath: entity.filePath,
                });
              }
            }
          }
          // module -> class/function
          for (const entity of entities) {
            if (entity.type === "module") {
              const related = entities.filter(
                (e) => (e.type === "class" || e.type === "function") && e.filePath === entity.filePath,
              );
              for (const rel of related) {
                relationships.push({
                  from: entity.name,
                  to: rel.name,
                  type: rel.type === "class" ? "defines_class" : "defines_function",
                  filePath: entity.filePath,
                });
              }
            }
          }
          // class -> methods
          for (const entity of entities) {
            if (entity.type === "class") {
              const funcs = entities.filter((e) => e.type === "function" && e.filePath === entity.filePath);
              for (const f of funcs) {
                relationships.push({ from: entity.name, to: f.name, type: "has_method", filePath: entity.filePath });
              }
            }
          }

          const byFile = new Map<string, { entities: any[]; relationships: any[] }>();
          for (const e of entities) {
            const slot = byFile.get(e.filePath) ?? { entities: [], relationships: [] };
            slot.entities.push(e);
            byFile.set(e.filePath, slot);
          }
          for (const r of relationships) {
            const fp = r.filePath || null;
            if (!fp) continue;
            const slot = byFile.get(fp) ?? { entities: [], relationships: [] };
            slot.relationships.push({ from: r.from, to: r.to, type: r.type, targetFile: r.filePath });
            byFile.set(fp, slot);
          }

          for (const [file, group] of byFile.entries()) {
            if (!group.entities.length) continue;
            const indexTask: AgentTask = {
              id: `index-entities-${Date.now()}-${i}-${file}`,
              type: "index:entities",
              priority: 7,
              payload: { entities: group.entities, relationships: group.relationships, filePath: file },
              createdAt: Date.now(),
            };
            try {
              const indexResult = await this.indexerAgent?.process(indexTask);
              const indexed = indexResult as any;
              if (indexed) {
                totalEntities += indexed.entitiesIndexed || 0;
                totalRelationships += indexed.relationshipsCreated || 0;
                filesProcessed += 1;
              }
            } catch (err) {
              console.error(`[DevAgent ${this.id}] Indexing failed for file ${file}:`, err);
            }
          }
        }
      } catch (error) {
        console.error(`[DevAgent ${this.id}] Error processing batch ${i}:`, error);
      }

      if ((i + effectiveBatchSize) % 500 === 0 || i + effectiveBatchSize >= files.length) {
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
    const defaultExcludedDirNames = new Set([
      "node_modules",
      "tmp",
      "temp",
      "cache",
      "__pycache__",
      ".pytest_cache",
      "venv",
      ".venv",
      "test",
      "tests",
      "__tests__",
      "build",
      "dist",
      "out",
      ".next",
      ".nuxt",
      "coverage",
      "archives",
      "archive",
      "backups",
      "backup",
    ]);
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

          const lstat = lstatSync(fullPath, { throwIfNoEntry: false });
          if (!lstat) {
            continue;
          }
          if (lstat.isSymbolicLink()) {
            continue;
          }

          if (lstat.isDirectory()) {
            const lowerItem = item.toLowerCase();
            if (defaultExcludedDirNames.has(lowerItem)) {
              continue;
            }
            if (!item.startsWith(".")) {
              walkDir(fullPath);
            }
          } else if (lstat.isFile()) {
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

  private handleResourceAdjustment(entry: KnowledgeEntry): void {
    const data = entry.data as {
      newMemoryLimit?: number;
      newAgentLimit?: number;
    };

    if (typeof data.newAgentLimit === "number" && Number.isFinite(data.newAgentLimit)) {
      const adjustedConcurrency = Math.max(1, Math.min(this.defaultMaxConcurrency * 2, Math.floor(data.newAgentLimit)));
      if (this.capabilities.maxConcurrency !== adjustedConcurrency) {
        console.log(
          `[DevAgent ${this.id}] Adjusting concurrency from ${this.capabilities.maxConcurrency} to ${adjustedConcurrency} (resources:adjusted)`,
        );
        this.capabilities.maxConcurrency = adjustedConcurrency;
      }
    }

    if (typeof data.newMemoryLimit === "number" && Number.isFinite(data.newMemoryLimit)) {
      const ratio = Math.max(0.5, Math.min(2, data.newMemoryLimit / this.defaultMemoryLimit));
      const newBatchSize = Math.max(10, Math.round(this.defaultBatchSize * ratio));
      if (this.indexBatchSize !== newBatchSize) {
        console.log(
          `[DevAgent ${this.id}] Adjusting batch size from ${this.indexBatchSize} to ${newBatchSize} (resources:adjusted)`,
        );
        this.indexBatchSize = newBatchSize;
      }
    }
  }

  protected async onShutdown(): Promise<void> {
    console.log(`[DevAgent ${this.id}] Shutting down...`);

    // Shutdown sub-agents
    if (this.parserAgent) {
      await this.parserAgent.shutdown();
    }
    if (this.indexerAgent) {
      await this.indexerAgent.shutdown();
    }
  }
}

// Export singleton instance
export const devAgent = new DevAgent();
