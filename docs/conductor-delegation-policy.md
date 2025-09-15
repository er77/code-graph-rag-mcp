# Conductor Agent - Mandatory Delegation Policy

## Overview
The Conductor Orchestrator Agent has been updated to **ENFORCE MANDATORY DELEGATION** to specialized agents. This prevents any direct implementation by the Conductor itself.

## Core Principle
**The Conductor NEVER implements. It ONLY orchestrates.**

## Delegation Rules

### 1. Mandatory Agent Delegation
All tasks MUST be delegated to one of the following specialized agents:

#### **dev-agent** (Development Agent)
- **Purpose**: ALL code implementation tasks
- **Responsibilities**:
  - Writing new code
  - Modifying existing code  
  - Refactoring
  - Bug fixes
  - Test implementation
  - Build configuration changes
- **Restrictions**: Cannot perform research or documentation tasks

#### **Dora** (Research & Documentation Agent)
- **Purpose**: Research, analysis, and documentation
- **Responsibilities**:
  - Market research and competitive analysis
  - Technology research and best practices
  - Documentation creation and updates
  - Code analysis and understanding
  - Architecture documentation
  - Pattern research
- **Restrictions**: Cannot modify code directly

### 2. Task Complexity Analysis
The Conductor analyzes every task and assigns a complexity score (1-10):

| Score | Complexity Level | Action Required |
|-------|-----------------|-----------------|
| 1-5   | Low to Medium   | Direct delegation to appropriate agent |
| 6-10  | High to Critical | Generate 5 method proposals + require approval |

### 3. Method Proposal Generation
For complex tasks (score > 5), the Conductor MUST:
1. Generate exactly 5 method proposals
2. Include pros, cons, timeline, and risk level for each
3. Mark one proposal as recommended
4. Wait for user approval before proceeding

### 4. Task Decomposition
After approval or for simple tasks, the Conductor:
1. Decomposes the task into subtasks
2. Assigns each subtask to the appropriate agent
3. Manages dependencies between subtasks
4. Tracks progress and synthesizes results

## Enforcement Mechanisms

### Direct Implementation Prevention
```typescript
// The Conductor includes these safeguards:
1. mandatoryDelegation flag (default: true)
2. Direct implementation attempt counter
3. Exception throwing on bypass attempts
4. Delegation logging for audit trail
```

### Blocked Behaviors
The following will trigger an error:
- Any attempt to implement code directly
- Tasks marked with `directImplementation: true`
- Tasks marked with `bypassDelegation: true`
- Tasks of type `direct`

### Error Message
```
CONDUCTOR VIOLATION: Direct implementation is FORBIDDEN.
All tasks MUST be delegated to dev-agent or Dora.
This is attempt #[N]
```

## Workflow Example

### Complex Task Flow
```
1. User Request → Conductor
2. Conductor analyzes complexity (score: 8/10)
3. Conductor generates 5 method proposals
4. Conductor returns proposals for approval
5. User approves method #2
6. Conductor decomposes into subtasks:
   - Research task → Dora
   - Implementation task → dev-agent
   - Testing task → dev-agent
   - Documentation task → Dora
7. Conductor manages execution and dependencies
8. Conductor synthesizes and returns results
```

### Simple Task Flow
```
1. User Request → Conductor
2. Conductor analyzes complexity (score: 3/10)
3. Conductor decomposes into subtasks
4. Conductor delegates to dev-agent
5. Conductor returns results
```

## Delegation Strategies

### Single Agent Delegation
- **When**: Simple, focused tasks
- **Example**: "Fix typo in README"
- **Delegation**: dev-agent only

### Multi-Agent Delegation
- **When**: Complex tasks requiring multiple skills
- **Example**: "Implement new feature with research"
- **Delegation**: Dora (research) → dev-agent (implementation) → Dora (documentation)

### Sequential Delegation
- **When**: Tasks with dependencies
- **Example**: "Research best practices then refactor"
- **Delegation**: Dora completes before dev-agent starts

### Parallel Delegation
- **When**: Independent subtasks
- **Example**: "Update docs while fixing bugs"
- **Delegation**: Dora and dev-agent work simultaneously

## Monitoring and Metrics

The Conductor tracks:
- Total delegations per agent
- Direct implementation attempts (should be 0)
- Task complexity distribution
- Approval requirement frequency
- Agent utilization rates
- Task success/failure rates

## Configuration

```typescript
const conductor = new ConductorOrchestrator({
  complexityThreshold: 5,        // Approval required above this
  mandatoryDelegation: true,     // Cannot be disabled
  loadBalancingStrategy: 'least-loaded',
  resourceConstraints: {
    maxMemoryMB: 1024,
    maxCpuPercent: 80,
    maxConcurrentAgents: 10,
    maxTaskQueueSize: 100
  }
});
```

## Benefits

1. **Clear Separation of Concerns**: Each agent has a specific role
2. **Audit Trail**: All delegations are logged
3. **Quality Control**: Complex tasks require approval
4. **Scalability**: Easy to add new specialized agents
5. **Consistency**: All implementation goes through dev-agent
6. **Research-Driven**: Dora ensures best practices

## Migration from Old Behavior

### Old Behavior (coordinator.ts)
- Could potentially implement directly
- No mandatory delegation
- No approval workflow
- No method proposals

### New Behavior (conductor-orchestrator.ts)
- MUST delegate all tasks
- Enforces approval for complexity > 5
- Generates 5 method proposals
- Tracks all delegations
- Prevents direct implementation

## Testing the Delegation

To verify the delegation is working:

```typescript
// This will succeed (proper delegation)
const task = {
  id: 'test-1',
  type: 'implementation',
  priority: 5,
  payload: { /* task details */ }
};
await conductor.process(task); // ✓ Delegates to dev-agent

// This will fail (attempted bypass)
const bypassTask = {
  id: 'test-2',
  type: 'direct',
  priority: 5,
  payload: { directImplementation: true }
};
await conductor.process(bypassTask); // ✗ Throws error
```

## Summary

The Conductor Orchestrator is now a pure orchestration agent that:
- **NEVER** implements anything directly
- **ALWAYS** delegates to specialized agents
- **ENFORCES** the delegation policy through code
- **TRACKS** all delegations for accountability
- **REQUIRES** approval for complex tasks

This ensures consistent, high-quality task execution through the appropriate specialized agents.