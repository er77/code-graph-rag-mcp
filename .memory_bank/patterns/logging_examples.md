# Agent Logging Examples and Templates

This file provides copy-paste ready templates for agent logging requirements. All agents must create logs in `.memory_bank/logs_llm/` using these exact patterns.

## Basic Log Creation Template

For ALL agents, use this as your FIRST ACTION:

```
Write tool:
file_path: /home/er77/_work_fodler/xldb_back/.memory_bank/logs_llm/TASK-XXX.log
content: "TASK-XXX started at [current timestamp] by [agent-name]
Status: IN_PROGRESS
Delegated by: Conductor

## Task Description:
[describe the task you received]

## Actions Log:
- Started logging at [timestamp]
"
```

## Agent-Specific Templates

### Dev-Agent Logging Template
```
Write tool:
file_path: /home/er77/_work_fodler/xldb_back/.memory_bank/logs_llm/TASK-XXX.log
content: "TASK-XXX started at [current timestamp] by dev-agent
Status: IN_PROGRESS
Delegated by: Conductor

## Task Description:
[describe the development task you received]

## Actions Log:
- Started logging at [timestamp]
"
```

### Dev-SQLEngines Logging Template
```
Write tool:
file_path: /home/er77/_work_fodler/xldb_back/.memory_bank/logs_llm/TASK-XXX.log
content: "TASK-XXX started at [current timestamp] by dev-sqlengines
Status: IN_PROGRESS
Delegated by: Conductor
Focus: SQL Engine Development

## Task Description:
[describe the SQL engine task you received]

## SQL Engines Actions Log:
- Started logging at [timestamp]
"
```

### MCP-Agent-Gemini Logging Template
```
Write tool:
file_path: /home/er77/_work_fodler/xldb_back/.memory_bank/logs_llm/TASK-XXX.log
content: "TASK-XXX started at [current timestamp] by mcp-agent-gemini
Status: IN_PROGRESS
Delegated by: Conductor
Focus: MCP Gemini Service Delivery

## Task Description:
[describe the MCP Gemini task you received]

## MCP Gemini Actions Log:
- Started logging at [timestamp]
"
```

### MCP-Agent-Codex Logging Template
```
Write tool:
file_path: /home/er77/_work_fodler/xldb_back/.memory_bank/logs_llm/TASK-XXX.log
content: "TASK-XXX started at [current timestamp] by mcp-agent-codex
Status: IN_PROGRESS
Delegated by: Conductor
Focus: MCP Codex Service Delivery

## Task Description:
[describe the MCP Codex task you received]

## MCP Codex Actions Log:
- Started logging at [timestamp]
"
```

### Dora (Research) Logging Template
```
Write tool:
file_path: /home/er77/_work_fodler/xldb_back/.memory_bank/logs_llm/TASK-XXX.log
content: "TASK-XXX started at [current timestamp] by dora
Status: IN_PROGRESS
Delegated by: Conductor
Focus: Product Research & Market Intelligence

## Research Task Description:
[describe the research task you received]

## Research Actions Log:
- Started logging at [timestamp]
"
```

## Log Update Templates

### Adding Actions to Log
```
Edit tool:
old_string: "## Actions Log:\n- Started logging at [timestamp]"
new_string: "## Actions Log:\n- Started logging at [timestamp]\n- [describe what you just did]"
```

### Adding Multiple Actions
```
Edit tool:
old_string: "## Actions Log:\n- Started logging at [timestamp]\n- [previous action]"
new_string: "## Actions Log:\n- Started logging at [timestamp]\n- [previous action]\n- [new action you just took]"
```

### Marking Task Complete
```
Edit tool:
old_string: "Status: IN_PROGRESS"
new_string: "Status: COMPLETED"
```

### Marking Task Failed
```
Edit tool:
old_string: "Status: IN_PROGRESS"
new_string: "Status: FAILED"
```

## Specific Action Examples

### File Modification Actions
```
- Modified file: [filename] - [description of changes]
- Created new file: [filename] - [purpose]
- Deleted file: [filename] - [reason]
```

### Research Actions
```
- Conducted web search: [search terms] - found [number] relevant results
- Analyzed competitor: [company name] - [key findings]
- Reviewed documentation: [source] - [insights gained]
```

### MCP Command Actions
```
- Executed MCP command: [command name] - [purpose and result]
- Sent request to Gemini: [request type] - [response summary]
- Used Codex session: [session purpose] - [outcome]
```

### Development Actions
```
- Analyzed codebase: [area analyzed] - [findings]
- Implemented feature: [feature name] - [approach used]
- Fixed bug: [bug description] - [solution applied]
- Added tests: [test type] - [coverage details]
```

## Error Logging Examples

### Task Failure
```
Edit tool:
old_string: "## Actions Log:\n- Started logging at [timestamp]"
new_string: "## Actions Log:\n- Started logging at [timestamp]\n- ERROR: [describe error that occurred]\n- FAILED ACTION: [what was being attempted]\n- RESOLUTION ATTEMPTED: [what you tried to fix it]"
```

### Warning Situations
```
Edit tool:
old_string: "## Actions Log:\n- Started logging at [timestamp]"
new_string: "## Actions Log:\n- Started logging at [timestamp]\n- WARNING: [describe potential issue]\n- MITIGATION: [what you did to address it]"
```

## File-Specific Logging (Optional)

For files that are modified, agents MAY also create file-specific logs:

```
Write tool:
file_path: /home/er77/_work_fodler/xldb_back/.memory_bank/logs_llm/[filename]_llm.log
content: "File: [filename]
Task: TASK-XXX
Agent: [agent-name]
Modified: [timestamp]

## Changes Made:
- [specific change 1]
- [specific change 2]

## Reason:
[why these changes were made]

## Impact:
[what effect these changes have]
"
```

## Conductor Verification Template

For Conductor to check if logs exist:

```
Read tool:
file_path: /home/er77/_work_fodler/xldb_back/.memory_bank/logs_llm/TASK-XXX.log
```

If log doesn't exist, Conductor should re-delegate with emphasis on logging.

## Best Practices

1. **Always log first** - Create log file before any other action
2. **Update frequently** - Add to log after each major action
3. **Be specific** - Describe exactly what you did, not just "worked on task"
4. **Include context** - Why you took specific actions
5. **Mark completion** - Always update status when done
6. **Handle errors** - Log failures and attempted solutions

## Common Mistakes to Avoid

❌ Don't create logs at the end - create them FIRST
❌ Don't use vague descriptions like "made progress"
❌ Don't forget to update status to COMPLETED
❌ Don't skip logging if task fails
❌ Don't use relative file paths - always use full paths

✅ Do create logs immediately as first action
✅ Do describe specific actions taken
✅ Do update status appropriately
✅ Do log errors and failures
✅ Do use exact file paths provided in templates