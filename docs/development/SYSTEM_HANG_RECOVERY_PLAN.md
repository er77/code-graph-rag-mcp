# System Hang Recovery Plan

## Executive Summary

**Issue**: System hang detected in MCP code-graph-rag server due to recursive error loop in embedding model initialization.

**Impact**: Complete system unresponsiveness, excessive CPU usage (64.6%), zombie processes.

**Recovery Time**: Estimated 15-30 minutes following this plan.

## Root Cause Analysis

### Primary Issue
- **Component**: `EmbeddingGenerator.initializeInternal()` method
- **Problem**: Infinite recursion loop when initialization fails
- **Trigger**: Model initialization failure causing recursive retry attempts
- **Duration**: Running for 100+ minutes consuming excessive resources

### System Impact
- **CPU Usage**: 64.6% sustained load on Claude process (PID 5629)
- **Zombie Processes**: 5 defunct npm/node processes
- **Database**: Potential lock contention in vector database
- **Memory**: Progressive memory leak due to recursive calls

### Error Pattern
```
Failed to initialize embedding model → retry → fail → retry → infinite loop
```

## Immediate Recovery Actions

### Phase 1: Process Cleanup (5 minutes)
1. **Identify hanging processes**:
   ```bash
   ps aux | grep -E "(claude|node|npm)" | grep -v grep
   ```

2. **Terminate zombie processes**:
   ```bash
   # Kill zombie npm/node processes
   pkill -f "npm"
   pkill -f "node.*embedding"
   ```

3. **Graceful shutdown of main process**:
   ```bash
   # First try SIGTERM
   kill -TERM 5629
   # Wait 10 seconds, then SIGKILL if needed
   sleep 10 && kill -KILL 5629 2>/dev/null || true
   ```

### Phase 2: Database Recovery (5 minutes)
1. **Check database integrity**:
   ```bash
   sqlite3 vectors.db "PRAGMA integrity_check;"
   sqlite3 vectors.db "PRAGMA wal_checkpoint;"
   ```

2. **Clear any locks**:
   ```bash
   # Remove WAL files if corrupted
   rm -f vectors.db-wal vectors.db-shm
   ```

3. **Backup current state**:
   ```bash
   cp vectors.db "vectors.db.backup-$(date -Iseconds)"
   ```

### Phase 3: Code Fix Implementation (10 minutes)
1. **Add recursion protection to EmbeddingGenerator**:

```typescript
// In src/semantic/embedding-generator.ts
private initializationAttempts = 0;
private readonly MAX_INIT_ATTEMPTS = 3;
private initializationTimeout: NodeJS.Timeout | null = null;

private async initializeInternal(): Promise<void> {
  // Prevent infinite recursion
  if (this.initializationAttempts >= this.MAX_INIT_ATTEMPTS) {
    throw new Error(`Failed to initialize after ${this.MAX_INIT_ATTEMPTS} attempts`);
  }

  this.initializationAttempts++;

  // Set timeout for initialization
  const timeoutPromise = new Promise((_, reject) => {
    this.initializationTimeout = setTimeout(() => {
      reject(new Error('Initialization timeout after 30 seconds'));
    }, 30000);
  });

  try {
    await Promise.race([
      this.performInitialization(),
      timeoutPromise
    ]);

    // Reset on success
    this.initializationAttempts = 0;
  } catch (error) {
    if (this.initializationTimeout) {
      clearTimeout(this.initializationTimeout);
    }

    // Exponential backoff before retry
    const backoffMs = Math.min(1000 * Math.pow(2, this.initializationAttempts - 1), 10000);
    await new Promise(resolve => setTimeout(resolve, backoffMs));

    throw error;
  }
}
```

2. **Add circuit breaker pattern**:
```typescript
private circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
private lastFailureTime = 0;
private readonly CIRCUIT_BREAK_THRESHOLD = 60000; // 1 minute

private shouldAttemptInitialization(): boolean {
  if (this.circuitBreakerState === 'OPEN') {
    if (Date.now() - this.lastFailureTime > this.CIRCUIT_BREAK_THRESHOLD) {
      this.circuitBreakerState = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  return true;
}
```

### Phase 4: Clean Restart (5 minutes)
1. **Clear temporary files**:
   ```bash
   rm -f *.log
   rm -f src/**/*.log
   ```

2. **Restart with monitoring**:
   ```bash
   # Start with debug logging
   DEBUG=* npm start 2>&1 | tee startup.log &

   # Monitor for first 60 seconds
   sleep 60 && ps aux | grep node
   ```

## Prevention Strategy

### Code Quality Improvements
1. **Add timeout protection** to all async operations
2. **Implement circuit breakers** for external dependencies
3. **Add retry limits** with exponential backoff
4. **Improve error handling** with specific error types

### Monitoring Enhancements
1. **Process health checks** every 30 seconds
2. **CPU/Memory alerts** at 80% usage
3. **Hanging operation detection** after 5 minutes
4. **Log rotation** to prevent disk issues

### Testing Protocol
1. **Failure simulation tests** for embedding initialization
2. **Resource exhaustion tests** under load
3. **Recovery time validation** tests
4. **Integration tests** for error scenarios

## Recovery Validation Checklist

### System Health (Pass/Fail)
- [ ] All zombie processes eliminated
- [ ] CPU usage below 20%
- [ ] Memory usage stable
- [ ] Database integrity confirmed
- [ ] MCP server responds to ping
- [ ] Vector search functional
- [ ] No error loops in logs

### Performance Metrics
- [ ] Query response time < 100ms
- [ ] Initialization time < 10 seconds
- [ ] Memory usage < 500MB
- [ ] No resource leaks detected

## Emergency Rollback Plan

If recovery fails:

1. **Restore from backup**:
   ```bash
   cp vectors.db.backup-* vectors.db
   ```

2. **Use fallback mode**:
   - Disable vector search temporarily
   - Use basic text search only
   - Reduce agent concurrency to 1

3. **Contact support** with:
   - Complete log files
   - System resource usage
   - Database state information

## Post-Recovery Actions

1. **Root cause documentation** in ADR format
2. **Code review** of all initialization paths
3. **Monitoring dashboard** implementation
4. **Incident response procedures** update
5. **Team training** on recovery procedures

## Configuration Recommendations

```typescript
// Recommended settings to prevent future hangs
export const SAFE_DEFAULTS = {
  maxInitializationAttempts: 3,
  initializationTimeout: 30000,
  circuitBreakerThreshold: 60000,
  maxConcurrentOperations: 5,
  healthCheckInterval: 30000,
  maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
  maxCpuUsage: 80 // percent
};
```

---

**Recovery Plan Version**: 1.0
**Created**: 2025-09-17
**Next Review**: After successful recovery
**Owner**: Development Team