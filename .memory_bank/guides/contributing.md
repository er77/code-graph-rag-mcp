# Contributing Guide

## 🎯 Overview

Thank you for contributing to the Code Graph RAG MCP project! This project follows an AI Software Engineering (AI SWE) workflow with strict agent governance and systematic development practices.

## 🏗️ Agent Governance Requirements

### MANDATORY: Conductor-First Workflow
**CRITICAL**: All complex development tasks MUST go through the Conductor agent
- **Multi-step tasks** (>2 steps) require Conductor orchestration
- **Multi-file changes** require Conductor coordination  
- **Architectural decisions** require Conductor evaluation and ADR creation
- **Complexity >5** requires 5-method proposals and explicit approval

### Agent Responsibilities
- **Conductor**: Task orchestration, method proposals, delegation
- **DevAgent**: All code implementation (EXCLUSIVE worker)
- **DoraAgent**: Research, documentation, best practices analysis
- **Specialized Agents**: Parser, Indexer, Query, Semantic agents for specific tasks

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** (20+ recommended for optimal performance)
- **TypeScript 5.x** knowledge
- **Git** for version control
- **Understanding of MCP protocol** basics

### Development Environment Setup
```bash
# Clone repository
git clone https://github.com/er77/code-graph-rag-mcp.git
cd code-graph-rag-mcp

# Install dependencies
npm install

# Build project
npm run build

# Run tests
npm test

# Lint and format
npm run lint
npx biome check --apply .
```

### Optional Performance Enhancement
```bash
# Install sqlite-vec for 10-100x performance improvement
./scripts/install-sqlite-vec.sh

# Verify installation
npm test -- --grep "sqlite-vec"
```

## 🔄 Development Workflow (AI SWE)

### 1. Task Planning Phase
```bash
# For ANY complex task, use Conductor agent
use agent conductor
  [describe your development task clearly]

# Conductor will:
# - Assess complexity (1-10 scale)
# - Generate 5 method proposals if complex
# - Require approval if complexity >5
# - Delegate implementation to DevAgent
# - Track with TASK-XXX identifier
```

### 2. Implementation Phase
- **DevAgent handles ALL code implementation**
- **Conductor coordinates multi-step workflows**
- **DoraAgent researches best practices and patterns**
- **Quality gates at each step**

### 3. Validation Phase
- **Syntax validation**: `node --check` for TypeScript
- **Test coverage**: Maintain >80% coverage
- **Performance validation**: Ensure no regressions
- **Documentation updates**: Keep guides current

## 📋 Change Categories

### Small Changes (No ADR Required)
- **Single file edits** with minimal impact
- **Bug fixes** that don't change architecture
- **Documentation updates** without structural changes
- **Test additions** for existing functionality

**Process**:
1. Create feature branch: `git checkout -b fix/issue-description`
2. Make changes following coding standards
3. Add/update tests as needed
4. Submit PR with TASK-XXX reference if applicable

### Architectural Changes (ADR Required)
- **New dependencies** or framework adoption
- **Cross-cutting refactors** affecting multiple modules
- **MCP tool schema changes** or new tools
- **Database schema modifications**
- **Performance optimization strategies**

**Process**:
1. **MUST use Conductor agent** for planning
2. Create ADR following template in `docs/ADR/README.md`
3. Get approval for complexity >5 changes
4. Implement through DevAgent delegation
5. Update related documentation

### Breaking Changes (ADR + Migration Required)
- **MCP tool name/schema changes**
- **Database migrations** affecting data
- **API breaking changes**
- **Configuration format changes**

**Process**:
1. **Mandatory Conductor orchestration**
2. Create comprehensive ADR with migration strategy
3. Implement backward compatibility where possible
4. Provide migration tools and documentation
5. Get explicit approval before merging

## 🏷️ Commit Message Standards

### Format
```bash
<type>(<scope>): <description> (TASK-XXX, ADR-YYY)

# Examples:
feat(semantic): improve vector search performance (TASK-025, ADR-002)
fix(parser): handle malformed TypeScript interfaces (TASK-026)
docs(adr): add decision record for database v2 (ADR-003)
refactor(storage): optimize batch operations per ADR-002 (TASK-025)
```

### Types
- **feat**: New features or capabilities
- **fix**: Bug fixes and error corrections
- **docs**: Documentation changes
- **refactor**: Code refactoring without behavior change
- **perf**: Performance improvements
- **test**: Test additions or modifications
- **chore**: Maintenance tasks and dependencies

### Scope
- **core**: Core MCP server functionality
- **semantic**: Semantic analysis and vector search
- **parser**: Code parsing and entity extraction
- **storage**: Database and storage operations
- **agents**: Multi-agent system components
- **docs**: Documentation and guides

## ✅ Pull Request Checklist

### Before Submitting
- [ ] **ADR created/updated** for architectural changes
- [ ] **Tests added/updated** for changed behavior
- [ ] **Lint/format passed**: `npm run lint` and `npx biome check --apply .`
- [ ] **Build successful**: `npm run build`
- [ ] **Syntax validation**: `node --check dist/index.js`
- [ ] **Performance tested**: No regression in key metrics
- [ ] **Documentation updated**: README, guides, or ADRs as needed
- [ ] **Agent governance followed**: Conductor used for complex changes

### PR Description Template
```markdown
## TASK-XXX: [Brief description]

**Change Type**: [feat/fix/docs/refactor/perf/test/chore]
**Complexity**: [1-10 scale]
**ADR Reference**: [ADR-XXX if applicable]

### Summary
Brief description of what this PR accomplishes.

### Changes Made
- [ ] Specific change 1
- [ ] Specific change 2
- [ ] Documentation updates

### Testing
- [ ] New tests added for [functionality]
- [ ] Existing tests updated for [changes]
- [ ] Performance validated (no regression)

### Breaking Changes
[List any breaking changes and migration notes]

### Related Issues
Closes #XXX, Related to #YYY
```

## 🎨 Code Style Standards

### TypeScript Configuration
- **Strict mode enabled**: All type checking rules enforced
- **ES Modules**: Use `import/export`, not `require/module.exports`
- **Path mapping**: Use relative imports for internal modules
- **Type definitions**: Comprehensive interfaces in `src/types/`

### Code Organization
```typescript
/**
 * TASK-XXX: [Purpose description]
 * ADR-XXX: [Architecture decision reference]
 *
 * [Module description and functionality]
 *
 * External Dependencies:
 * - [library]: [url] - [usage description]
 *
 * Architecture References:
 * - [Related file/doc]
 */

// =============================================================================
// 1. IMPORTS AND DEPENDENCIES
// =============================================================================
import { ... } from '...';

// =============================================================================
// 2. CONSTANTS AND CONFIGURATION  
// =============================================================================
const CONFIG = { ... };

// =============================================================================
// 3. TYPE DEFINITIONS AND INTERFACES
// =============================================================================
interface ExampleInterface { ... }

// =============================================================================
// 4. CORE IMPLEMENTATION
// =============================================================================
export class ExampleClass { ... }
```

### Formatting Rules
- **Biome formatter**: Use `npx biome format --write .`
- **Line length**: 120 characters maximum
- **Indentation**: 2 spaces, no tabs
- **Semicolons**: Always required
- **Quotes**: Double quotes for strings
- **Trailing commas**: Required in multiline structures

## 🧪 Testing Standards

### Test Organization
```bash
src/
├── __tests__/           # Unit tests
├── integration/         # Integration tests
└── performance/         # Performance benchmarks
```

### Test Requirements
- **Unit tests**: >80% code coverage
- **Integration tests**: MCP protocol compliance
- **Performance tests**: No regression in key metrics
- **Agent tests**: Multi-agent coordination validation

### Test Patterns
```typescript
describe('ComponentName', () => {
  beforeEach(async () => {
    // Setup test environment
  });

  afterEach(async () => {
    // Cleanup test environment
  });

  it('should handle [specific scenario]', async () => {
    // Test implementation with clear assertions
    expect(result).toEqual(expected);
  });
});
```

## 📚 Documentation Requirements

### ADR Creation
**Required for**:
- New technology adoption
- Architectural pattern changes
- Performance optimization strategies
- Security implementation decisions
- Cross-cutting system changes

**ADR Template Location**: `.memory_bank/patterns/architectural_decisions.md`

### Code Documentation
- **File headers**: Include TASK-XXX and ADR-XXX references
- **Function docs**: JSDoc comments for public APIs
- **Type definitions**: Comprehensive interface documentation
- **Examples**: Include usage examples for complex functions

### Guide Updates
- **Feature additions**: Update relevant guides in `.memory_bank/guides/`
- **Configuration changes**: Update setup and integration guides
- **Performance improvements**: Update performance optimization guide
- **Troubleshooting**: Add common issues and solutions

## 🚀 Release Process

### Versioning Strategy
- **Semantic Versioning**: `MAJOR.MINOR.PATCH`
- **Major**: Breaking changes, new MCP tool APIs
- **Minor**: New features, performance improvements
- **Patch**: Bug fixes, documentation updates

### Release Checklist
- [ ] **All tests passing**: Unit, integration, performance
- [ ] **Documentation updated**: Guides, ADRs, README
- [ ] **CHANGELOG updated**: Document all changes
- [ ] **Performance validated**: No regressions
- [ ] **NPM package tested**: Install and basic functionality
- [ ] **Claude Desktop tested**: Integration validation

### Publishing
```bash
# Build and test
npm run build
npm test

# Update version
npm version [major|minor|patch]

# Publish to NPM
npm publish

# Create GitHub release
git push --tags
```

## 🐛 Issue Reporting

### Before Reporting
1. **Search existing issues** for duplicates
2. **Test with latest version**: `npm update -g @er77/code-graph-rag-mcp`
3. **Verify environment**: Node.js 18+, sufficient memory
4. **Collect debug information**: Logs, error messages, steps to reproduce

### Issue Template
```markdown
**Environment:**
- OS: [macOS/Windows/Linux version]
- Node.js: [output of `node --version`]
- Package: [output of `npm list -g @er77/code-graph-rag-mcp`]
- Claude Desktop: [version if applicable]

**Expected Behavior:**
[Clear description of expected outcome]

**Actual Behavior:**
[Clear description of what actually happened]

**Steps to Reproduce:**
1. [First step]
2. [Second step]
3. [Third step]

**Error Messages:**
```
[Paste complete error messages and relevant log excerpts]
```

**Additional Context:**
[Any other relevant information]
```

## 🤝 Community Guidelines

### Code of Conduct
- **Respectful communication** in all interactions
- **Constructive feedback** focused on technical merits
- **Collaborative problem-solving** approach
- **Knowledge sharing** to help others learn

### Best Practices
- **Follow agent governance**: Use Conductor for complex tasks
- **Maintain quality**: High standards for code and documentation
- **Performance awareness**: Consider impact on end users
- **Security mindedness**: Follow security best practices

## 📞 Getting Help

### Documentation Resources
- **Agent Governance**: `.memory_bank/patterns/agent_delegation.md`
- **Architecture Decisions**: `.memory_bank/patterns/architectural_decisions.md`
- **MCP Tools**: `.memory_bank/guides/mcp_tools.md`
- **Performance**: `.memory_bank/guides/performance_optimization.md`

### Support Channels
- **GitHub Discussions**: General questions and community help
- **GitHub Issues**: Bug reports and feature requests
- **Documentation**: Comprehensive guides in `.memory_bank/`

---

*Thank you for contributing to the Code Graph RAG MCP project! Your contributions help make advanced code analysis accessible to AI assistants and developers worldwide.*

**Document Version**: 1.0 | **Last Updated**: 2025-01-22 | **Next Review**: 2025-02-15