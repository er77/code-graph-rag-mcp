# Performance Optimization for Commodity Hardware

## Architecture Placement

Performance optimization strategies are integrated throughout the MCP Server Codegraph architecture, focusing on efficient resource utilization for commodity hardware deployments. These optimizations span from low-level data structures to high-level coordination patterns.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Resource       │ -> │  Optimization   │ -> │  Performance    │
│  Monitoring     │    │  Strategies     │    │  Feedback Loop  │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                v
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Memory         │    │  CPU & I/O      │    │  Caching &      │
│  Management     │    │  Optimization   │    │  Persistence    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Usage Guidelines

### Performance Target Definition
Establish clear performance benchmarks for typical commodity hardware configurations:

```typescript
export interface PerformanceTargets {
  // Hardware assumptions
  hardware: {
    cpuCores: 4;
    memoryGB: 8;
    storageType: 'SSD' | 'HDD';
    networkMbps: 100;
  };
  
  // Performance targets
  targets: {
    coldIndexing: {
      filesPerSecond: 100;
      memoryUsageMB: 512;
      maxIndexingTimeMinutes: 10;
    };
    warmIndexing: {
      speedupMultiplier: 5;
      memoryUsageMB: 256;
      maxIndexingTimeMinutes: 2;
    };
    queryResponse: {
      simpleQueryMs: 100;
      complexQueryMs: 1000;
      concurrentQueries: 10;
    };
    resourceUsage: {
      maxCpuPercent: 80;
      maxMemoryPercent: 60;
      maxDiskIOPercent: 70;
    };
  };
}
```

### Optimization Strategy Hierarchy
```typescript
export enum OptimizationLevel {
  CRITICAL = 'critical',     // Essential for basic functionality
  HIGH = 'high',            // Significant performance impact
  MEDIUM = 'medium',        // Moderate improvement
  LOW = 'low'              // Nice-to-have optimizations
}

export interface OptimizationStrategy {
  level: OptimizationLevel;
  category: 'memory' | 'cpu' | 'io' | 'network' | 'algorithm';
  description: string;
  implementation: () => Promise<void>;
  measurementKey: string;
  expectedImprovementPercent: number;
}
```

## Coding Recommendations

### Memory Management Patterns
```typescript
export class MemoryOptimizer {
  private memoryPools: Map<string, ObjectPool> = new Map();
  private memoryMonitor: MemoryMonitor = new MemoryMonitor();
  private gcScheduler: GCScheduler = new GCScheduler();

  constructor(private config: MemoryConfig) {
    this.initializeObjectPools();
    this.startMemoryMonitoring();
  }

  // Object pooling for frequently created objects
  private initializeObjectPools(): void {
    // Pool for Entity objects
    this.memoryPools.set('Entity', new ObjectPool(
      () => new Entity(),
      entity => entity.reset(),
      this.config.entityPoolSize
    ));

    // Pool for AST Node wrappers
    this.memoryPools.set('ASTNode', new ObjectPool(
      () => new ASTNodeWrapper(),
      node => node.cleanup(),
      this.config.astNodePoolSize
    ));

    // Pool for query result objects
    this.memoryPools.set('QueryResult', new ObjectPool(
      () => new QueryResult(),
      result => result.clear(),
      this.config.queryResultPoolSize
    ));
  }

  async acquireObject<T>(type: string): Promise<T> {
    const pool = this.memoryPools.get(type);
    if (!pool) {
      throw new Error(`No pool found for type: ${type}`);
    }
    
    return pool.acquire() as T;
  }

  releaseObject(type: string, object: any): void {
    const pool = this.memoryPools.get(type);
    if (pool) {
      pool.release(object);
    }
  }

  // Streaming processing for large datasets
  async *streamProcessEntities(entities: AsyncIterable<Entity>): AsyncGenerator<ProcessedEntity> {
    const batchSize = this.calculateOptimalBatchSize();
    const batch: Entity[] = [];

    for await (const entity of entities) {
      batch.push(entity);

      if (batch.length >= batchSize) {
        // Process batch and yield results
        const processed = await this.processBatch(batch);
        for (const result of processed) {
          yield result;
        }

        // Clear batch and force cleanup
        batch.length = 0;
        await this.forceCleanupIfNeeded();
      }
    }

    // Process remaining entities
    if (batch.length > 0) {
      const processed = await this.processBatch(batch);
      for (const result of processed) {
        yield result;
      }
    }
  }

  private calculateOptimalBatchSize(): number {
    const availableMemory = this.memoryMonitor.getAvailableMemoryMB();
    const avgEntitySize = this.config.avgEntitySizeKB;
    
    // Use 10% of available memory for batch processing
    const batchMemoryBudget = availableMemory * 0.1 * 1024; // Convert to KB
    return Math.max(10, Math.floor(batchMemoryBudget / avgEntitySize));
  }

  private async forceCleanupIfNeeded(): Promise<void> {
    const memoryUsage = this.memoryMonitor.getCurrentUsage();
    
    if (memoryUsage.heapUsedPercent > 70) {
      // Clear caches
      await this.clearNonEssentialCaches();
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      // Schedule more aggressive cleanup
      this.gcScheduler.scheduleAggressive();
    }
  }
}
```

### CPU Optimization Strategies
```typescript
export class CPUOptimizer {
  private workerPool: WorkerPool;
  private taskScheduler: TaskScheduler;
  private cpuMonitor: CPUMonitor;

  constructor(private config: CPUConfig) {
    this.initializeWorkerPool();
    this.startCPUMonitoring();
  }

  private initializeWorkerPool(): void {
    const numWorkers = Math.min(
      os.cpus().length,
      this.config.maxWorkers || os.cpus().length
    );

    this.workerPool = new WorkerPool({
      workerScript: path.join(__dirname, 'cpu-intensive-worker.js'),
      numWorkers,
      taskTimeout: 30000
    });
  }

  // Parallel processing with load balancing
  async processInParallel<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: ParallelProcessingOptions = {}
  ): Promise<R[]> {
    const {
      concurrency = this.getOptimalConcurrency(),
      batchSize = this.calculateOptimalBatchSize(items.length),
      loadBalance = true
    } = options;

    if (items.length <= batchSize) {
      // Small dataset - process directly
      return await this.processSequentialBatch(items, processor);
    }

    // Large dataset - use worker pool with load balancing
    const batches = this.createBatches(items, batchSize);
    const results: R[] = [];

    if (loadBalance) {
      // Dynamic load balancing
      const workQueue = new PriorityQueue<ProcessingBatch<T>>();
      
      // Initialize queue with batches
      batches.forEach((batch, index) => {
        workQueue.enqueue({
          items: batch,
          priority: this.calculateBatchPriority(batch),
          batchId: index
        });
      });

      // Process with dynamic worker assignment
      const workers = this.createDynamicWorkers(concurrency);
      const batchResults = await this.processBatchesWithWorkers(workQueue, workers, processor);
      
      // Merge results maintaining order
      results.push(...this.mergeOrderedResults(batchResults));
    } else {
      // Simple parallel processing
      const batchPromises = batches.map((batch, index) =>
        this.processBatchWithWorker(batch, processor, index % concurrency)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
    }

    return results;
  }

  private getOptimalConcurrency(): number {
    const cpuCount = os.cpus().length;
    const currentLoad = this.cpuMonitor.getCurrentLoad();
    
    // Adjust concurrency based on current CPU load
    if (currentLoad > 0.8) {
      return Math.max(1, Math.floor(cpuCount * 0.5));
    } else if (currentLoad > 0.6) {
      return Math.max(1, Math.floor(cpuCount * 0.75));
    } else {
      return cpuCount;
    }
  }

  // CPU-intensive operations offloading
  async offloadCPUIntensiveTask<T>(
    taskType: string,
    data: any,
    options: OffloadOptions = {}
  ): Promise<T> {
    const {
      timeout = 30000,
      priority = 'normal',
      retries = 1
    } = options;

    // Monitor CPU usage and decide on execution strategy
    const currentLoad = this.cpuMonitor.getCurrentLoad();
    
    if (currentLoad < 0.5 && !this.config.alwaysOffload) {
      // Low CPU usage - execute in main thread
      return await this.executeInMainThread<T>(taskType, data);
    }

    // High CPU usage - offload to worker
    return await this.workerPool.execute<T>({
      taskType,
      data,
      timeout,
      priority,
      retries
    });
  }

  // Algorithm optimization for commodity hardware
  private optimizeAlgorithmForHardware<T>(
    algorithm: Algorithm<T>,
    dataSize: number
  ): OptimizedAlgorithm<T> {
    const memoryConstraint = this.getMemoryConstraint();
    const cpuConstraint = this.getCPUConstraint();

    // Choose algorithm variant based on constraints
    if (memoryConstraint === 'low') {
      // Use memory-efficient but potentially slower algorithms
      return algorithm.getMemoryOptimizedVariant();
    } else if (cpuConstraint === 'low') {
      // Use CPU-efficient algorithms even if they use more memory
      return algorithm.getCPUOptimizedVariant();
    } else {
      // Balanced approach
      return algorithm.getBalancedVariant();
    }
  }
}
```

### I/O Optimization Patterns
```typescript
export class IOOptimizer {
  private fileCache: LRUCache<string, Buffer>;
  private readAheadBuffer: ReadAheadBuffer;
  private writeBuffer: WriteBuffer;
  private ioScheduler: IOScheduler;

  constructor(private config: IOConfig) {
    this.initializeIOSystems();
  }

  private initializeIOSystems(): void {
    // File caching with LRU eviction
    this.fileCache = new LRUCache({
      max: this.config.fileCacheSize || 100,
      maxAge: this.config.fileCacheAge || 300000, // 5 minutes
      updateAgeOnGet: true
    });

    // Read-ahead buffering for sequential access
    this.readAheadBuffer = new ReadAheadBuffer({
      bufferSize: this.config.readAheadSize || 1024 * 1024, // 1MB
      prefetchThreshold: 0.7
    });

    // Write buffering for batch operations
    this.writeBuffer = new WriteBuffer({
      flushSize: this.config.writeBufferSize || 512 * 1024, // 512KB
      flushInterval: this.config.writeFlushInterval || 5000 // 5 seconds
    });

    // I/O operation scheduling
    this.ioScheduler = new IOScheduler({
      maxConcurrentReads: this.config.maxConcurrentReads || 4,
      maxConcurrentWrites: this.config.maxConcurrentWrites || 2,
      priorityLevels: 3
    });
  }

  // Optimized file reading with caching and read-ahead
  async readFileOptimized(filePath: string): Promise<Buffer> {
    // Check cache first
    const cached = this.fileCache.get(filePath);
    if (cached) {
      return cached;
    }

    // Schedule read operation
    const readOperation = async (): Promise<Buffer> => {
      const stats = await fs.stat(filePath);
      
      if (stats.size > this.config.largeFileThreshold) {
        // Large file - use streaming read
        return await this.readLargeFileStream(filePath);
      } else {
        // Small file - read directly
        const content = await fs.readFile(filePath);
        
        // Cache if within size limits
        if (content.length <= this.config.maxCacheFileSize) {
          this.fileCache.set(filePath, content);
        }
        
        return content;
      }
    };

    return await this.ioScheduler.scheduleRead(readOperation, 'normal');
  }

  // Batch file operations for efficiency
  async batchProcessFiles(
    filePaths: string[],
    processor: (content: Buffer, path: string) => Promise<void>
  ): Promise<void> {
    const batches = this.createIOBatches(filePaths);
    
    for (const batch of batches) {
      // Read batch files in parallel
      const readPromises = batch.map(async (filePath) => {
        const content = await this.readFileOptimized(filePath);
        return { filePath, content };
      });
      
      const fileContents = await Promise.all(readPromises);
      
      // Process files sequentially to control memory usage
      for (const { filePath, content } of fileContents) {
        await processor(content, filePath);
      }
      
      // Yield control between batches
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  // Optimized database operations
  async optimizeDatabaseIO(): Promise<void> {
    // Enable WAL mode for better concurrency
    await this.database.pragma('journal_mode = WAL');
    
    // Optimize SQLite settings for commodity hardware
    await this.database.pragma('synchronous = NORMAL');
    await this.database.pragma('cache_size = -65536'); // 64MB cache
    await this.database.pragma('temp_store = MEMORY');
    await this.database.pragma('mmap_size = 268435456'); // 256MB mmap
    
    // Enable auto-vacuum to prevent database bloat
    await this.database.pragma('auto_vacuum = INCREMENTAL');
  }

  // Write optimization with buffering
  async writeFileOptimized(filePath: string, content: Buffer): Promise<void> {
    const writeOperation = async (): Promise<void> => {
      // Use write buffer for small writes
      if (content.length <= this.config.writeBufferThreshold) {
        await this.writeBuffer.bufferWrite(filePath, content);
      } else {
        // Direct write for large files
        await fs.writeFile(filePath, content);
      }
    };

    await this.ioScheduler.scheduleWrite(writeOperation, 'normal');
  }
}
```

### Caching Strategies
```typescript
export class OptimizedCacheManager {
  private l1Cache: Map<string, CacheEntry>; // In-memory, fastest
  private l2Cache: LRUCache<string, any>;   // LRU with size limits
  private l3Cache: PersistentCache;         // Disk-based, largest

  constructor(private config: CacheConfig) {
    this.initializeCacheLayers();
  }

  private initializeCacheLayers(): void {
    // L1 Cache - Hot data, very fast access
    this.l1Cache = new Map();
    
    // L2 Cache - Warm data, size-limited LRU
    this.l2Cache = new LRUCache({
      max: this.config.l2MaxItems || 1000,
      maxAge: this.config.l2MaxAge || 600000, // 10 minutes
      updateAgeOnGet: true,
      dispose: (key, value) => {
        // Move to L3 cache when evicted from L2
        this.l3Cache.set(key, value);
      }
    });

    // L3 Cache - Cold data, persistent storage
    this.l3Cache = new PersistentCache({
      directory: this.config.l3CacheDir || './cache',
      maxSizeMB: this.config.l3MaxSizeMB || 100,
      compression: true
    });
  }

  // Multi-level cache access
  async get<T>(key: string): Promise<T | null> {
    // Try L1 first (fastest)
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && !this.isExpired(l1Entry)) {
      l1Entry.hits++;
      l1Entry.lastAccess = Date.now();
      return l1Entry.value as T;
    }

    // Try L2 cache
    const l2Value = this.l2Cache.get(key);
    if (l2Value !== undefined) {
      // Promote to L1 if frequently accessed
      this.promoteToL1IfNeeded(key, l2Value);
      return l2Value as T;
    }

    // Try L3 cache (slowest)
    const l3Value = await this.l3Cache.get<T>(key);
    if (l3Value !== null) {
      // Promote to L2
      this.l2Cache.set(key, l3Value);
      return l3Value;
    }

    return null;
  }

  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    const entry: CacheEntry = {
      value,
      createdAt: Date.now(),
      lastAccess: Date.now(),
      hits: 0,
      ttl: options.ttl,
      size: this.estimateSize(value)
    };

    // Determine appropriate cache level
    const cacheLevel = this.determineCacheLevel(entry, options);

    switch (cacheLevel) {
      case 1:
        this.setL1(key, entry);
        break;
      case 2:
        this.l2Cache.set(key, value);
        break;
      case 3:
        await this.l3Cache.set(key, value);
        break;
    }
  }

  // Intelligent cache warming
  async warmCache(keys: string[], priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    const batchSize = this.getBatchSizeForPriority(priority);
    
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      
      // Parallel cache warming
      const warmPromises = batch.map(async (key) => {
        try {
          const value = await this.generateCacheValue(key);
          if (value !== null) {
            await this.set(key, value, { priority });
          }
        } catch (error) {
          console.warn(`Failed to warm cache for key ${key}:`, error);
        }
      });

      await Promise.allSettled(warmPromises);
      
      // Yield control between batches
      if (priority !== 'high') {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }

  // Cache analytics and optimization
  async analyzeCachePerformance(): Promise<CacheAnalysis> {
    const l1Stats = this.getL1Stats();
    const l2Stats = this.l2Cache.dump();
    const l3Stats = await this.l3Cache.getStats();

    return {
      l1: {
        size: this.l1Cache.size,
        hitRate: l1Stats.hitRate,
        avgAccessTime: l1Stats.avgAccessTime,
        memoryUsageMB: l1Stats.memoryUsage / 1024 / 1024
      },
      l2: {
        size: l2Stats.length,
        hitRate: this.l2Cache.getHitRate(),
        memoryUsageMB: this.estimateL2MemoryUsage() / 1024 / 1024
      },
      l3: {
        size: l3Stats.entryCount,
        hitRate: l3Stats.hitRate,
        diskUsageMB: l3Stats.diskUsage / 1024 / 1024,
        avgAccessTime: l3Stats.avgAccessTime
      },
      recommendations: this.generateCacheOptimizationRecommendations()
    };
  }

  // Auto-optimization based on usage patterns
  async autoOptimize(): Promise<void> {
    const analysis = await this.analyzeCachePerformance();
    
    // Adjust L1 cache size based on hit rate
    if (analysis.l1.hitRate > 0.9 && analysis.l1.memoryUsageMB < 50) {
      await this.expandL1Cache();
    } else if (analysis.l1.hitRate < 0.5) {
      await this.shrinkL1Cache();
    }

    // Optimize L2 cache based on access patterns
    if (analysis.l2.hitRate < 0.3) {
      await this.tuneL2CacheParameters();
    }

    // Clean up L3 cache if disk usage is high
    if (analysis.l3.diskUsageMB > this.config.l3MaxSizeMB * 0.9) {
      await this.l3Cache.cleanup();
    }
  }
}
```

## Performance Considerations

### Resource Monitoring and Alerting
```typescript
export class PerformanceMonitor {
  private metrics: PerformanceMetrics = new PerformanceMetrics();
  private alerts: AlertManager = new AlertManager();
  private profiler: Profiler = new Profiler();

  constructor(private config: MonitoringConfig) {
    this.startPerformanceMonitoring();
  }

  private startPerformanceMonitoring(): void {
    // System resource monitoring
    setInterval(async () => {
      const systemStats = await this.collectSystemStats();
      this.metrics.recordSystemStats(systemStats);
      
      // Check for performance issues
      await this.checkPerformanceThresholds(systemStats);
    }, this.config.monitoringInterval || 5000);

    // Application-specific monitoring
    setInterval(async () => {
      const appStats = await this.collectApplicationStats();
      this.metrics.recordApplicationStats(appStats);
    }, this.config.appMonitoringInterval || 10000);
  }

  private async collectSystemStats(): Promise<SystemStats> {
    const [cpuUsage, memoryUsage, diskUsage, networkUsage] = await Promise.all([
      this.getCPUUsage(),
      this.getMemoryUsage(),
      this.getDiskUsage(),
      this.getNetworkUsage()
    ]);

    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      network: networkUsage,
      timestamp: Date.now()
    };
  }

  private async checkPerformanceThresholds(stats: SystemStats): Promise<void> {
    const thresholds = this.config.performanceThresholds;

    // CPU usage alerts
    if (stats.cpu.usagePercent > thresholds.cpu.critical) {
      await this.alerts.trigger({
        type: 'cpu_critical',
        message: `CPU usage is ${stats.cpu.usagePercent}% (critical threshold: ${thresholds.cpu.critical}%)`,
        severity: 'critical',
        recommendations: [
          'Consider reducing concurrent operations',
          'Optimize CPU-intensive algorithms',
          'Scale to additional CPU cores if available'
        ]
      });
    } else if (stats.cpu.usagePercent > thresholds.cpu.warning) {
      await this.alerts.trigger({
        type: 'cpu_warning',
        message: `CPU usage is ${stats.cpu.usagePercent}% (warning threshold: ${thresholds.cpu.warning}%)`,
        severity: 'warning'
      });
    }

    // Memory usage alerts
    if (stats.memory.usagePercent > thresholds.memory.critical) {
      await this.alerts.trigger({
        type: 'memory_critical',
        message: `Memory usage is ${stats.memory.usagePercent}% (critical threshold: ${thresholds.memory.critical}%)`,
        severity: 'critical',
        recommendations: [
          'Trigger aggressive garbage collection',
          'Clear non-essential caches',
          'Reduce batch sizes for processing'
        ]
      });

      // Take immediate action
      await this.performEmergencyMemoryCleanup();
    }
  }

  // Performance profiling for optimization
  async profilePerformance(
    operationName: string,
    operation: () => Promise<any>
  ): Promise<ProfileResult> {
    const profile = this.profiler.startProfiling(operationName);
    
    try {
      const result = await operation();
      
      const profileResult = profile.stop();
      this.metrics.recordOperationProfile(operationName, profileResult);
      
      return profileResult;
    } catch (error) {
      profile.markError(error);
      throw error;
    }
  }

  // Generate performance optimization recommendations
  async generateOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    const recentMetrics = this.metrics.getRecentMetrics(300000); // Last 5 minutes
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze CPU patterns
    const avgCpuUsage = this.calculateAverageCPUUsage(recentMetrics);
    if (avgCpuUsage > 70) {
      recommendations.push({
        category: 'cpu',
        priority: 'high',
        title: 'High CPU Usage Detected',
        description: `Average CPU usage is ${avgCpuUsage}%`,
        actions: [
          'Profile CPU-intensive operations',
          'Consider algorithm optimizations',
          'Implement more aggressive caching',
          'Distribute workload across more cores'
        ]
      });
    }

    // Analyze memory patterns
    const memoryTrend = this.analyzeMemoryTrend(recentMetrics);
    if (memoryTrend.slope > 0.1) { // Memory increasing over time
      recommendations.push({
        category: 'memory',
        priority: 'medium',
        title: 'Memory Leak Suspected',
        description: `Memory usage increasing at ${memoryTrend.slope}MB/minute`,
        actions: [
          'Check for object pool leaks',
          'Verify cache eviction policies',
          'Profile memory allocation patterns',
          'Review event listener cleanup'
        ]
      });
    }

    return recommendations;
  }
}
```

### Performance Testing Framework
```typescript
export class PerformanceTestSuite {
  private testResults: Map<string, TestResult[]> = new Map();
  private benchmarkBaseline: BenchmarkBaseline;

  constructor(private config: PerformanceTestConfig) {
    this.loadBenchmarkBaseline();
  }

  // Automated performance regression testing
  async runPerformanceTests(): Promise<TestSuiteResult> {
    const tests = [
      this.testColdIndexingPerformance,
      this.testWarmIndexingPerformance,
      this.testQueryPerformance,
      this.testMemoryUsagePatterns,
      this.testConcurrentOperations,
      this.testLargeDatasetHandling
    ];

    const results: TestResult[] = [];
    
    for (const test of tests) {
      try {
        const result = await test.call(this);
        results.push(result);
        
        // Check for regressions
        await this.checkForRegressions(result);
      } catch (error) {
        results.push({
          testName: test.name,
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }

    return {
      results,
      overallSuccess: results.every(r => r.success),
      regressions: results.filter(r => r.regression),
      summary: this.generateTestSummary(results)
    };
  }

  private async testColdIndexingPerformance(): Promise<TestResult> {
    const testData = await this.generateTestDataset(1000); // 1000 files
    const startTime = Date.now();
    const initialMemory = process.memoryUsage().heapUsed;

    try {
      const indexer = new CodeGraphIndexer();
      await indexer.indexFiles(testData.files);
      
      const endTime = Date.now();
      const finalMemory = process.memoryUsage().heapUsed;
      
      const metrics = {
        duration: endTime - startTime,
        filesPerSecond: testData.files.length / ((endTime - startTime) / 1000),
        memoryUsed: (finalMemory - initialMemory) / 1024 / 1024, // MB
        entitiesIndexed: await indexer.getEntityCount()
      };

      // Compare against baseline
      const baseline = this.benchmarkBaseline.coldIndexing;
      const regression = this.detectRegression(metrics, baseline);

      return {
        testName: 'cold-indexing-performance',
        success: metrics.filesPerSecond >= baseline.minFilesPerSecond,
        metrics,
        regression,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Cold indexing test failed: ${error.message}`);
    }
  }

  private async testQueryPerformance(): Promise<TestResult> {
    const queries = [
      { type: 'simple', query: { entityName: 'testFunction' } },
      { type: 'complex', query: { traverseDepth: 3, includeCallers: true } },
      { type: 'bulk', query: { entityType: 'Function', limit: 100 } }
    ];

    const queryResults: QueryTestResult[] = [];
    
    for (const queryTest of queries) {
      const startTime = Date.now();
      
      try {
        const results = await this.executeQuery(queryTest.query);
        const endTime = Date.now();
        
        queryResults.push({
          queryType: queryTest.type,
          duration: endTime - startTime,
          resultCount: results.length,
          success: true
        });
      } catch (error) {
        queryResults.push({
          queryType: queryTest.type,
          duration: -1,
          resultCount: 0,
          success: false,
          error: error.message
        });
      }
    }

    const avgDuration = queryResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.duration, 0) / queryResults.length;

    return {
      testName: 'query-performance',
      success: queryResults.every(r => r.success) && avgDuration < 1000,
      metrics: {
        avgQueryDuration: avgDuration,
        queryResults
      },
      timestamp: Date.now()
    };
  }

  // Load testing for concurrent operations
  private async testConcurrentOperations(): Promise<TestResult> {
    const concurrentUsers = [1, 5, 10, 20];
    const operationsPerUser = 10;
    const concurrencyResults: ConcurrencyTestResult[] = [];

    for (const userCount of concurrentUsers) {
      const startTime = Date.now();
      
      // Create concurrent operations
      const operations = Array.from({ length: userCount }, (_, userIndex) =>
        this.simulateUserOperations(userIndex, operationsPerUser)
      );

      try {
        const results = await Promise.all(operations);
        const endTime = Date.now();
        
        const totalOperations = results.reduce((sum, r) => sum + r.completedOperations, 0);
        const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
        
        concurrencyResults.push({
          concurrentUsers: userCount,
          totalOperations,
          totalErrors,
          duration: endTime - startTime,
          operationsPerSecond: totalOperations / ((endTime - startTime) / 1000),
          errorRate: totalErrors / totalOperations
        });
      } catch (error) {
        concurrencyResults.push({
          concurrentUsers: userCount,
          totalOperations: 0,
          totalErrors: userCount * operationsPerUser,
          duration: -1,
          operationsPerSecond: 0,
          errorRate: 1.0
        });
      }
    }

    // Analyze scalability
    const scalabilityScore = this.calculateScalabilityScore(concurrencyResults);

    return {
      testName: 'concurrent-operations',
      success: scalabilityScore > 0.7, // 70% scalability threshold
      metrics: {
        concurrencyResults,
        scalabilityScore
      },
      timestamp: Date.now()
    };
  }
}
```

## Configuration Options

### Performance Configuration
```typescript
interface PerformanceConfig {
  // Hardware profile
  hardware: {
    cpuCores: number;
    memoryGB: number;
    storageType: 'SSD' | 'HDD';
    networkMbps: number;
  };
  
  // Resource limits
  limits: {
    maxMemoryUsagePercent: number;
    maxCpuUsagePercent: number;
    maxConcurrentOperations: number;
    maxCacheSize: number;
  };
  
  // Optimization settings
  optimization: {
    enableObjectPooling: boolean;
    enableL1Cache: boolean;
    enableReadAheadBuffering: boolean;
    enableWriteBuffering: boolean;
    enableCPUAffinity: boolean;
    enableNUMAAwareness: boolean;
  };
  
  // Monitoring settings
  monitoring: {
    enabled: boolean;
    interval: number;
    alertThresholds: {
      cpu: { warning: number; critical: number };
      memory: { warning: number; critical: number };
      disk: { warning: number; critical: number };
    };
  };
  
  // Testing settings
  testing: {
    enablePerformanceTests: boolean;
    regressionThreshold: number;
    testDataSize: number;
  };
}

// Environment-based configuration
const performanceConfig: PerformanceConfig = {
  hardware: {
    cpuCores: parseInt(process.env.CODEGRAPH_CPU_CORES || os.cpus().length.toString()),
    memoryGB: parseInt(process.env.CODEGRAPH_MEMORY_GB || '8'),
    storageType: (process.env.CODEGRAPH_STORAGE_TYPE as any) || 'SSD',
    networkMbps: parseInt(process.env.CODEGRAPH_NETWORK_MBPS || '100')
  },
  limits: {
    maxMemoryUsagePercent: parseInt(process.env.CODEGRAPH_MAX_MEMORY_PERCENT || '60'),
    maxCpuUsagePercent: parseInt(process.env.CODEGRAPH_MAX_CPU_PERCENT || '80'),
    maxConcurrentOperations: parseInt(process.env.CODEGRAPH_MAX_CONCURRENT_OPS || '10'),
    maxCacheSize: parseInt(process.env.CODEGRAPH_MAX_CACHE_SIZE || '100')
  },
  optimization: {
    enableObjectPooling: process.env.CODEGRAPH_OBJECT_POOLING !== 'false',
    enableL1Cache: process.env.CODEGRAPH_L1_CACHE !== 'false',
    enableReadAheadBuffering: process.env.CODEGRAPH_READ_AHEAD !== 'false',
    enableWriteBuffering: process.env.CODEGRAPH_WRITE_BUFFER !== 'false',
    enableCPUAffinity: process.env.CODEGRAPH_CPU_AFFINITY === 'true',
    enableNUMAAwareness: process.env.CODEGRAPH_NUMA_AWARE === 'true'
  },
  monitoring: {
    enabled: process.env.CODEGRAPH_MONITORING !== 'false',
    interval: parseInt(process.env.CODEGRAPH_MONITORING_INTERVAL || '5000'),
    alertThresholds: {
      cpu: {
        warning: parseInt(process.env.CODEGRAPH_CPU_WARNING_THRESHOLD || '70'),
        critical: parseInt(process.env.CODEGRAPH_CPU_CRITICAL_THRESHOLD || '90')
      },
      memory: {
        warning: parseInt(process.env.CODEGRAPH_MEMORY_WARNING_THRESHOLD || '70'),
        critical: parseInt(process.env.CODEGRAPH_MEMORY_CRITICAL_THRESHOLD || '85')
      },
      disk: {
        warning: parseInt(process.env.CODEGRAPH_DISK_WARNING_THRESHOLD || '80'),
        critical: parseInt(process.env.CODEGRAPH_DISK_CRITICAL_THRESHOLD || '95')
      }
    }
  },
  testing: {
    enablePerformanceTests: process.env.CODEGRAPH_PERF_TESTS === 'true',
    regressionThreshold: parseFloat(process.env.CODEGRAPH_REGRESSION_THRESHOLD || '0.1'),
    testDataSize: parseInt(process.env.CODEGRAPH_TEST_DATA_SIZE || '1000')
  }
};
```

## Monitoring and Diagnostics

### Performance Dashboard
```typescript
export class PerformanceDashboard {
  async generatePerformanceReport(): Promise<PerformanceReport> {
    const [
      systemMetrics,
      applicationMetrics,
      cacheAnalysis,
      optimizationRecommendations
    ] = await Promise.all([
      this.collectSystemMetrics(),
      this.collectApplicationMetrics(),
      this.analyzeCachePerformance(),
      this.generateOptimizationRecommendations()
    ]);

    return {
      timestamp: new Date(),
      system: systemMetrics,
      application: applicationMetrics,
      cache: cacheAnalysis,
      recommendations: optimizationRecommendations,
      healthScore: this.calculateHealthScore(systemMetrics, applicationMetrics)
    };
  }

  private calculateHealthScore(
    system: SystemMetrics,
    application: ApplicationMetrics
  ): HealthScore {
    const scores = {
      cpu: Math.max(0, 100 - system.cpu.usagePercent),
      memory: Math.max(0, 100 - system.memory.usagePercent),
      performance: this.calculatePerformanceScore(application),
      stability: this.calculateStabilityScore(application)
    };

    const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / 4;

    return {
      overall: Math.round(overallScore),
      breakdown: scores,
      status: this.getHealthStatus(overallScore)
    };
  }
}
```

## Future Enhancements

### Advanced Optimization Techniques
- **Machine Learning-based optimization**: Use ML to predict optimal configurations
- **Dynamic resource allocation**: Automatically adjust resources based on workload
- **Predictive caching**: Pre-load data based on usage patterns
- **Adaptive algorithms**: Switch algorithms based on runtime conditions

### Hardware-Specific Optimizations
- **GPU acceleration**: Use GPU for parallel processing where applicable
- **SIMD optimizations**: Leverage SIMD instructions for data processing
- **Memory hierarchy optimization**: Optimize for specific CPU cache architectures
- **NUMA-aware scheduling**: Optimize for multi-socket systems