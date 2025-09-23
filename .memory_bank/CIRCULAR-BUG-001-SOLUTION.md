# CIRCULAR BUG 001 - COMPREHENSIVE SOLUTION

## Executive Summary
After deploying Research Trinity and conducting thorough investigation, the root cause has been identified: **ConnectionPool creates a new SQLiteManager instance instead of using the singleton pattern**, causing IndexerAgent and QueryAgent to operate on different database connections.

## Root Cause Analysis

### Primary Issue: Multiple Database Instances
1. **IndexerAgent** (src/agents/indexer-agent.ts:96)
   ```typescript
   this.sqliteManager = getSQLiteManager(); // Uses singleton
   ```

2. **ConnectionPool** (src/query/connection-pool.ts:58)
   ```typescript
   this.sqliteManager = new SQLiteManager(); // Creates new instance
   ```

3. **Impact**: QueryAgent uses ConnectionPool, which means it reads from a different database instance than IndexerAgent writes to, even though both point to the same file path.

### Secondary Issue: SemanticAgent Entity Handling
- Error: "entities2.map is not a function" 
- Cause: undefined entities being passed via KnowledgeBus
- This may resolve automatically once primary issue is fixed

## Solution Implementation

### Phase 1: Fix Database Instance Issue (CRITICAL)

**File: src/query/connection-pool.ts**

Change line 58 from:
```typescript
this.sqliteManager = new SQLiteManager();
```

To:
```typescript
import { getSQLiteManager } from "../storage/sqlite-manager.js";
// ...
this.sqliteManager = getSQLiteManager();
```

### Phase 2: Verify Connection Consistency

**File: src/storage/sqlite-manager.ts**

Add logging to verify singleton usage:
```typescript
export function getSQLiteManager(config?: SQLiteConfig): SQLiteManager {
  if (!instance) {
    instance = new SQLiteManager(config);
    console.log(`[SQLiteManager] Created singleton instance with path: ${instance.config.path}`);
  } else {
    console.log(`[SQLiteManager] Returning existing singleton instance`);
  }
  return instance;
}
```

### Phase 3: Fix SemanticAgent Entity Handling (if needed after Phase 1)

**File: src/agents/semantic-agent.ts**

Add defensive checks:
```typescript
private handleNewEntities(entities: ParsedEntity[] | undefined) {
  if (!entities || !Array.isArray(entities)) {
    console.warn(`[${this.id}] Received invalid entities:`, entities);
    return;
  }
  // Existing processing...
}
```

### Phase 4: Add Integration Test

Create a test to prevent regression:
```typescript
// src/__tests__/database-consistency.test.ts
test('IndexerAgent and QueryAgent use same database instance', async () => {
  const indexer = new IndexerAgent();
  const queryAgent = new QueryAgent();
  
  // Index test data
  await indexer.indexEntities(testEntities, 'test.ts');
  
  // Query should find indexed data
  const results = await queryAgent.query({ type: 'entities' });
  expect(results.entities.length).toBeGreaterThan(0);
});
```

## Verification Steps

1. **Immediate Verification**:
   ```bash
   # After fix, test indexing and querying
   npm run build
   ./test-correct-tools.sh
   ```

2. **Database State Check**:
   ```bash
   # Check if data persists in database
   sqlite3 ~/.code-graph-rag/codegraph.db "SELECT COUNT(*) FROM entities;"
   ```

3. **Connection Logging**:
   - Monitor logs for "Created singleton instance" vs "Returning existing singleton"
   - Should see one creation, multiple returns

## Risk Assessment

- **Low Risk**: Simple fix changing instantiation to singleton usage
- **High Impact**: Resolves complete write-read disconnect
- **No Data Loss**: Existing indexed data remains intact
- **Backwards Compatible**: No API changes required

## Prevention Strategy

1. **Code Review Rule**: All database connections MUST use getSQLiteManager()
2. **Linting Rule**: Flag any `new SQLiteManager()` usage
3. **Architecture Decision Record**: Document singleton requirement for database connections
4. **Integration Tests**: Add tests verifying cross-agent data visibility

## Timeline

- **Phase 1**: 5 minutes (critical fix)
- **Phase 2**: 5 minutes (verification)
- **Phase 3**: 10 minutes (if needed)
- **Phase 4**: 15 minutes (testing)

Total: ~35 minutes to complete resolution

## Success Criteria

✅ Indexing reports X entities extracted
✅ Graph queries return same X entities
✅ No "entities2.map is not a function" errors
✅ Relationships properly created and queryable
✅ All tests pass