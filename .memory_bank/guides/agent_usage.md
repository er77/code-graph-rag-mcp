# Agent Usage Guide

## Overview

This guide provides practical instructions for using the multi-agent system in the Code Graph RAG MCP project, including when to use which agent, how to structure requests, and best practices for effective collaboration.

## 🚀 Quick Start

### For Complex Development Tasks
```bash
# ALWAYS start with Conductor for any complex work
use agent conductor
  implement new vector search optimization for large codebases
```

### For Research Tasks  
```bash
# Use Dora for comprehensive research
use agent dora
  research best practices for semantic search in code analysis
```

### For Simple Questions
```bash
# Direct questions can be asked without agents
# But complex analysis should use agents
```

## 🎯 When to Use Each Agent

### 🟡 Conductor Agent
**Use For**: All complex tasks requiring coordination

#### ✅ **ALWAYS Use Conductor For:**
- Multi-step development tasks (>2 steps)
- Architecture changes or refactoring
- Performance optimization projects
- Bug fixes affecting multiple files
- Feature implementation with dependencies
- Integration of new technologies
- Database schema changes
- API modifications affecting multiple endpoints

#### 📝 **Request Structure:**
```bash
use agent conductor
  [clear task description with context]
  
# Examples:
use agent conductor
  optimize the vector search performance for large codebases
  
use agent conductor
  implement comprehensive error handling across the MCP tools
  
use agent conductor
  refactor the multi-agent coordination system for better reliability
```

#### 🔄 **What Conductor Does:**
1. **Analyze** task complexity (1-10 scale)
2. **Generate** 5 distinct method proposals
3. **Require approval** if complexity >5
4. **Delegate** to appropriate specialized agents
5. **Track** progress with TASK-XXX identifiers
6. **Validate** completion and quality

### 🔵 Dev Agent  
**Use For**: NO DIRECT USE - Conductor manages this agent

#### ❌ **Cannot Use Directly:**
- dev-agent only accepts tasks from Conductor
- Direct requests will be rejected
- All implementation work must go through Conductor

#### ✅ **What dev-agent Does (via Conductor):**
- Code implementation and file modifications
- Testing and validation
- Documentation generation
- GRACE-compliant development with semantic scaffolding
- Observable Belief State logging

### 🟢 Dora Agent
**Use For**: Research, analysis, and documentation

#### ✅ **Perfect For:**
- Market research and competitive analysis
- Technology evaluation and comparison
- Best practices investigation
- Documentation creation and updates
- Pattern analysis and recommendations
- Regulatory compliance research
- User feedback synthesis

#### 📝 **Request Structure:**
```bash
use agent dora
  [specific research question or analysis request]
  
# Examples:
use agent dora
  research current trends in vector database optimization
  
use agent dora
  analyze competitor approaches to code graph analysis
  
use agent dora
  investigate best practices for MCP server performance
```

#### 🔄 **What Dora Does:**
1. **Comprehensive research** across multiple sources
2. **Data triangulation** and validation
3. **Strategic analysis** with actionable insights
4. **Documentation creation** in Memory Bank
5. **Knowledge synthesis** and pattern identification

### 🟠 MCP Agent Gemini
**Use For**: NO DIRECT USE - Conductor coordinates this agent

#### ❌ **Cannot Use Directly:**
- mcp-agent-gemini only accepts tasks from Conductor
- Specialized for Gemini MCP service coordination
- Not for independent use

#### ✅ **What mcp-agent-gemini Does (via Conductor):**
- Delivers development tasks to Gemini MCP services
- Provides parallel research perspectives
- Supports Research Trinity for complex issues
- Coordinates with external AI services

## 📋 Task Complexity Guidelines

### Complexity Assessment (1-10 Scale)

#### **Level 1-3: Simple Tasks**
- Single file modifications
- Configuration updates
- Simple documentation updates
- Bug fixes with obvious solutions

**Recommendation**: May not require agents for very simple tasks

#### **Level 4-6: Moderate Tasks**  
- Multi-file modifications
- Feature enhancements
- Testing implementation
- Performance improvements

**Recommendation**: Use Conductor for coordination

#### **Level 7-8: Complex Tasks**
- Architecture changes
- System refactoring  
- Integration projects
- Performance optimization

**Recommendation**: MANDATORY Conductor usage with approval workflow

#### **Level 9-10: Critical Tasks**
- Major system redesigns
- Breaking changes
- Security implementations
- Production deployments

**Recommendation**: MANDATORY Conductor with Research Trinity support

## 🔄 Standard Workflows

### Development Workflow
```bash
# Step 1: Start with Conductor
use agent conductor
  implement caching layer for vector search operations

# Step 2: Review 5 method proposals
# Conductor will present 5 different approaches

# Step 3: Approve preferred method
# "Approved, proceed with Solution #3"

# Step 4: Monitor progress
# Check .memory_bank/current_tasks.md for status

# Step 5: Validate completion
# Conductor ensures quality and completeness
```

### Research Workflow
```bash
# Step 1: Define research scope
use agent dora
  analyze vector database performance optimization techniques

# Step 2: Review findings
# Dora provides comprehensive analysis with sources

# Step 3: Apply insights
# Use research findings for informed decision-making

# Step 4: Update knowledge
# Dora integrates findings into Memory Bank
```

### Troubleshooting Workflow
```bash
# Step 1: Use Conductor for systematic approach
use agent conductor
  debug and fix the vector embedding generation failures

# Step 2: Let Conductor coordinate diagnosis
# May deploy Research Trinity for complex issues

# Step 3: Follow systematic resolution
# Conductor ensures proper root cause analysis

# Step 4: Validate fix and prevent recurrence
# Comprehensive testing and documentation
```

## 🛠️ Best Practices

### For Effective Agent Usage

#### 1. **Be Specific and Clear**
```bash
# ❌ Vague request
use agent conductor
  make the system faster

# ✅ Specific request  
use agent conductor
  optimize vector search query response time from 150ms to <50ms for codebases with 10k+ files
```

#### 2. **Provide Context**
```bash
# ✅ Good context
use agent conductor
  implement error retry logic for the MCP tools because users report 
  timeout failures when analyzing large codebases like chromium
```

#### 3. **Follow Task Progression**
- Check `.memory_bank/current_tasks.md` for active work
- Monitor TASK-XXX identifiers for tracking
- Review ADR documents for architectural decisions

#### 4. **Trust the Process**
- Let Conductor generate 5 method proposals
- Review all options before choosing
- Follow approval workflows for complex tasks

### Memory Bank Integration

#### Check Before Requesting
1. **Current Work**: `.memory_bank/current_tasks.md`
2. **Patterns**: `.memory_bank/patterns/` for established approaches
3. **Guides**: `.memory_bank/guides/` for implementation guidance
4. **Architecture**: `.memory_bank/architecture/` for system understanding

#### After Completion
1. **Review Updates**: Check what was added to Memory Bank
2. **Pattern Learning**: Understand new patterns created
3. **Documentation**: Review generated documentation
4. **Knowledge Integration**: See how insights were incorporated

## 🚨 Common Mistakes to Avoid

### ❌ **Don't Do This:**

#### 1. **Skip Conductor for Complex Tasks**
```bash
# ❌ Wrong - trying to use dev-agent directly
use agent dev-agent
  implement new caching system

# ✅ Correct - use Conductor
use agent conductor
  implement new caching system
```

#### 2. **Vague Task Descriptions**
```bash
# ❌ Too vague
use agent conductor
  fix the bugs

# ✅ Specific and actionable
use agent conductor
  fix the memory leak in vector embedding generation causing 
  OOM errors after processing 1000+ files
```

#### 3. **Ignore Complexity Assessment**
```bash
# ❌ Dismissing approval workflow
# When Conductor says "complexity 8/10, approval required"
# Don't skip the review process
```

#### 4. **Mix Concerns in Single Request**
```bash
# ❌ Multiple unrelated tasks
use agent conductor
  implement caching AND fix the UI bugs AND update documentation

# ✅ Separate requests for different concerns
use agent conductor
  implement caching layer for vector operations
```

## 📊 Monitoring and Progress Tracking

### Real-Time Status
```bash
# Check current active tasks
cat .memory_bank/current_tasks.md

# Review specific task log
cat .memory_bank/logs_llm/TASK-XXX.log

# Check recent changes
git log --oneline -n 10
```

### Progress Indicators
- **TODO**: Task identified but not started
- **IN_PROGRESS**: Agent actively working
- **VALIDATION**: Under review and testing  
- **DONE**: Completed and validated
- **ARCHIVED**: Moved to historical records

### Quality Metrics
- **Task Completion Rate**: Successful vs. total tasks
- **Review Cycle Time**: Time from completion to validation
- **Rework Frequency**: How often tasks need revision
- **User Satisfaction**: Quality of delivered solutions

## 🔧 Troubleshooting Agent Issues

### Agent Not Responding
1. **Check Agent Status**: Verify agent is available
2. **Review Request Format**: Ensure proper syntax
3. **Validate Permissions**: Confirm access rights
4. **Check System Load**: Monitor resource usage

### Task Rejection
1. **Review Error Message**: Agent explains rejection reason
2. **Check Prerequisites**: Ensure all requirements met
3. **Simplify Request**: Break complex tasks into smaller parts
4. **Use Proper Agent**: Verify correct agent selection

### Quality Issues
1. **Request Revision**: Ask agent to improve solution
2. **Provide Feedback**: Specific guidance for improvement
3. **Escalate to Conductor**: For coordination issues
4. **Check Documentation**: Verify against standards

## 📚 Additional Resources

### Documentation
- **AGENTS.md**: Complete agent definitions and capabilities
- **CLAUDE.md**: Development standards and requirements
- **.memory_bank/README.md**: Memory Bank navigation guide

### Patterns and Workflows
- **.memory_bank/patterns/**: Established development patterns
- **.memory_bank/workflows/**: Standard operating procedures
- **.memory_bank/guides/**: Implementation guidelines

### Support and Help
- **GitHub Issues**: Report bugs and request features
- **Memory Bank Troubleshooting**: `.memory_bank/troubleshooting/`
- **Community Documentation**: Shared knowledge and tips

---

*Remember: The agent system is designed to enhance your productivity through systematic coordination and specialized expertise. Trust the process, provide clear requirements, and leverage the collective intelligence of the multi-agent system.*