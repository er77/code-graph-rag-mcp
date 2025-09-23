# Failure Patterns and Protocol Violations

## Purpose
Track known failure patterns and protocol violations to prevent future occurrences.

## Known Failure Patterns

### Pattern 1: User Frustration Override
- **Trigger**: User says "failed X times", "not working", "just do it"
- **INCORRECT Response**: Direct implementation bypassing Conductor
- **CORRECT Response**: Invoke Conductor with Research Trinity for failure analysis
- **Example**: TASK-020 to TASK-032 violation (direct SQL engine implementation)
- **Prevention**: IMMUTABLE RULES in CLAUDE.md

### Pattern 2: Manual Task Splitting
- **Trigger**: User says "split task on smaller parts"
- **INCORRECT Response**: Manually splitting and implementing directly
- **CORRECT Response**: Conductor splits tasks with separate TASK-XXX tracking
- **Example**: RabbitMQ split into 3 parts without Conductor
- **Prevention**: FAILURE RECOVERY PROTOCOL in CLAUDE.md

### Pattern 3: sqlengines/ Direct Access
- **Trigger**: Any SQL engine implementation request
- **INCORRECT Response**: Writing files directly in sqlengines/
- **CORRECT Response**: Conductor delegates to dev-sqlengines
- **Example**: Direct creation of tarantool.py, ydb.py, etc.
- **Prevention**: PRE-IMPLEMENTATION CHECKPOINT

### Pattern 4: Missing TASK-XXX Tracking
- **Trigger**: Implementation without task identifier
- **INCORRECT Response**: Proceeding without TASK-XXX
- **CORRECT Response**: Stop and invoke Conductor for proper tracking
- **Example**: Later SQL engines implemented without task logs
- **Prevention**: TASK VERIFICATION ENFORCEMENT

## Violation Log

### 2024-09-22: Direct SQL Engine Implementation
- **Tasks**: TASK-020 through TASK-032
- **Violation**: Direct file creation in sqlengines/ without Conductor
- **Root Cause**: Misinterpreted user frustration as bypass permission
- **Impact**:
  - No TASK-XXX logs in .memory_bank/logs_llm/
  - No GRACE framework compliance
  - No architectural review
  - No verification of requirements
- **Corrective Action**: CLAUDE.md updated with CRITICAL PROTOCOL ENFORCEMENT

## Learning Points

1. **User frustration is a trigger for BETTER orchestration, not abandonment**
2. **"Split task" means Conductor splits, not manual splitting**
3. **sqlengines/ folder is ALWAYS dev-sqlengines territory**
4. **TASK-XXX tracking is MANDATORY for all implementations**
5. **Research Trinity deployment for circular bugs is non-negotiable**

## Compliance Checklist

Before ANY implementation:
- [ ] Conductor invoked?
- [ ] TASK-XXX assigned?
- [ ] Log file created in .memory_bank/logs_llm/?
- [ ] Task in current_tasks.md?
- [ ] Proper agent delegation (dev-sqlengines for SQL)?
- [ ] GRACE framework compliance?
- [ ] Verification protocol planned?

## Escalation Protocol

If tempted to bypass:
1. STOP
2. Re-read this file
3. Re-read CLAUDE.md CRITICAL PROTOCOL ENFORCEMENT
4. Invoke Conductor
5. Document why bypass was considered