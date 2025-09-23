# Release Process

## Overview

Comprehensive release process for the Code Graph RAG MCP project, ensuring quality, stability, and proper versioning for all releases.

## 🎯 Release Strategy

### Release Types

1. **Patch Releases (x.x.X)**: Bug fixes, minor improvements
2. **Minor Releases (x.X.x)**: New features, backwards compatible
3. **Major Releases (X.x.x)**: Breaking changes, major features

### Release Schedule

- **Patch Releases**: As needed (hotfixes, critical bugs)
- **Minor Releases**: Monthly (feature releases)
- **Major Releases**: Quarterly (major milestones)

## 📋 Pre-Release Checklist

### Code Quality Requirements

- [ ] All tests passing (unit, integration, e2e)
- [ ] Code coverage >85%
- [ ] No critical security vulnerabilities
- [ ] Performance benchmarks met
- [ ] Linting and formatting clean
- [ ] TypeScript compilation without errors

### Documentation Requirements

- [ ] CHANGELOG.md updated
- [ ] README.md reflects current features
- [ ] API documentation current
- [ ] .memory_bank documentation updated
- [ ] Architecture Decision Records (ADRs) current

### Functional Requirements

- [ ] All MCP tools working correctly
- [ ] Agent coordination functioning
- [ ] Database migrations tested
- [ ] Vector search operational
- [ ] Performance targets met

## 🔄 Release Workflow

### 1. Pre-Release Preparation

#### Version Planning
```bash
# Determine version bump
npm version --dry-run [patch|minor|major]

# Review changes since last release
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

#### Quality Assurance
```bash
# Run full test suite
npm test

# Run performance benchmarks
npm run test:performance

# Check code coverage
npm run test:coverage

# Lint and format
npx biome check --apply .

# Type check
npx tsc --noEmit
```

#### Documentation Update
```bash
# Update CHANGELOG.md
# Update version in package.json
# Update README.md if needed
# Update .memory_bank/current_tasks.md
```

### 2. Release Creation

#### Version Bump
```bash
# Bump version (updates package.json and creates git tag)
npm version [patch|minor|major]

# Example: npm version minor
# Creates: v2.3.0
```

#### Build and Package
```bash
# Clean previous builds
npm run clean

# Build the project
bun run tsup

# Run package command
make package

# Verify build artifacts
ls -la dist/
```

#### Testing Final Build
```bash
# Test the built package
npm run test:build

# Integration test with build
npm run test:integration:build
```

### 3. Release Validation

#### Pre-Release Testing
```bash
# Create pre-release tag
git tag v2.3.0-rc.1

# Deploy to staging environment
npm run deploy:staging

# Run smoke tests
npm run test:smoke
```

#### Performance Validation
```bash
# Benchmark against previous version
npm run benchmark:compare

# Memory usage validation
npm run test:memory

# Load testing
npm run test:load
```

### 4. Release Deployment

#### Git Operations
```bash
# Push changes and tags
git push origin master
git push --tags

# Create GitHub release
gh release create v2.3.0 \
  --title "Release v2.3.0" \
  --notes-file RELEASE_NOTES.md \
  --target master
```

#### Package Publication
```bash
# Publish to npm (if applicable)
npm publish

# Update Docker images (if applicable)
docker build -t codegraph-mcp:v2.3.0 .
docker push codegraph-mcp:v2.3.0
```

## 📝 Release Notes Template

### CHANGELOG.md Format

```markdown
# Changelog

## [2.3.0] - 2024-01-15

### Added
- New semantic search MCP tool with vector embeddings
- Enhanced multi-agent coordination patterns
- SQLite-vec integration for improved performance

### Changed
- Improved parser performance for large codebases
- Updated agent delegation strategies
- Enhanced error handling across all components

### Fixed
- Database migration issues in concurrent environments
- Memory leaks in vector embedding generation
- Parser crashes on malformed TypeScript files

### Security
- Updated dependencies to address security vulnerabilities
- Enhanced input validation for MCP tools

### Performance
- 40% improvement in parsing throughput
- 60% reduction in memory usage for vector operations
- Sub-100ms query response times for most operations

### Breaking Changes
- None (backwards compatible)

### Migration Guide
- No migration required for this release
```

### GitHub Release Notes Template

```markdown
# Release v2.3.0 🚀

## Overview
This release introduces enhanced semantic search capabilities and significant performance improvements for the Code Graph RAG MCP server.

## 🎉 Highlights

### New Features
- **Semantic Search Tool**: Advanced vector-based code search with natural language queries
- **Multi-Agent Coordination**: Improved task delegation and orchestration
- **SQLite-vec Integration**: Hardware-accelerated vector operations

### Performance Improvements
- **40% faster parsing** for TypeScript/JavaScript files
- **60% memory reduction** in vector operations
- **Sub-100ms queries** for most common operations

### Quality Enhancements
- **Enhanced error handling** across all MCP tools
- **Improved stability** for large codebase analysis
- **Better resource management** for commodity hardware

## 📊 Metrics

| Metric | Previous | Current | Improvement |
|--------|----------|---------|-------------|
| Parse Speed | 70 files/sec | 100+ files/sec | +43% |
| Memory Usage | 1.2GB peak | 750MB peak | -38% |
| Query Time | 150ms avg | 85ms avg | -43% |

## 🔧 Installation

```bash
# Update to latest version
npm install @your-org/code-graph-rag-mcp@latest

# Or clone and build
git clone https://github.com/your-org/code-graph-rag-mcp
cd code-graph-rag-mcp
npm install
npm run build
```

## 📚 Documentation

- [Updated README](README.md)
- [Memory Bank Documentation](.memory_bank/README.md)
- [Performance Guide](.memory_bank/guides/performance_optimization.md)

## 🙏 Acknowledgments

Thanks to all contributors who made this release possible!

## 🐛 Known Issues

- Vector search may have slower initialization on some systems
- Large codebases (>50k files) may require additional memory

## 💬 Feedback

Please report issues on [GitHub Issues](https://github.com/your-org/code-graph-rag-mcp/issues)
```

## 🔧 Automation Scripts

### Release Script

```bash
#!/bin/bash
# scripts/release.sh

set -e

VERSION_TYPE=${1:-patch}
echo "🚀 Starting release process for ${VERSION_TYPE} version..."

# Pre-release checks
echo "📋 Running pre-release checks..."
npm test
npm run test:coverage
npx biome check .
npx tsc --noEmit

# Build and package
echo "🔨 Building project..."
npm run clean
bun run tsup
make package

# Version bump
echo "📦 Bumping version..."
NEW_VERSION=$(npm version ${VERSION_TYPE})
echo "New version: ${NEW_VERSION}"

# Update documentation
echo "📚 Updating documentation..."
npm run docs:update

# Git operations
echo "🔄 Pushing to git..."
git push origin master
git push --tags

# Create GitHub release
echo "🎉 Creating GitHub release..."
gh release create ${NEW_VERSION} \
  --title "Release ${NEW_VERSION}" \
  --generate-notes \
  --target master

echo "✅ Release ${NEW_VERSION} completed successfully!"
```

### Post-Release Script

```bash
#!/bin/bash
# scripts/post-release.sh

VERSION=$1
echo "🎯 Running post-release tasks for ${VERSION}..."

# Update development branch
git checkout develop
git merge master
git push origin develop

# Create next development milestone
gh milestone create "v$(npm run version:next)" \
  --title "Next Release" \
  --description "Issues for next release"

# Update project boards
npm run boards:update

# Send notifications
npm run notify:release ${VERSION}

echo "✅ Post-release tasks completed!"
```

## 📊 Release Metrics

### Quality Metrics

```typescript
interface ReleaseMetrics {
  codeQuality: {
    testCoverage: number;
    lintingIssues: number;
    typeErrors: number;
    securityVulnerabilities: number;
  };
  performance: {
    parseSpeed: number; // files per second
    queryResponseTime: number; // milliseconds
    memoryUsage: number; // MB peak
    buildTime: number; // seconds
  };
  stability: {
    crashRate: number; // percentage
    errorRate: number; // percentage
    uptime: number; // percentage
  };
}

// Example metrics collection
const releaseMetrics: ReleaseMetrics = {
  codeQuality: {
    testCoverage: 87.5,
    lintingIssues: 0,
    typeErrors: 0,
    securityVulnerabilities: 0
  },
  performance: {
    parseSpeed: 105,
    queryResponseTime: 85,
    memoryUsage: 750,
    buildTime: 45
  },
  stability: {
    crashRate: 0.1,
    errorRate: 0.5,
    uptime: 99.9
  }
};
```

### Performance Benchmarks

```bash
# scripts/benchmark.sh
#!/bin/bash

echo "🏃 Running performance benchmarks..."

# Parsing benchmark
npm run benchmark:parsing

# Query benchmark
npm run benchmark:queries

# Memory benchmark
npm run benchmark:memory

# Vector search benchmark
npm run benchmark:vector

# Generate report
npm run benchmark:report

echo "📊 Benchmark results saved to benchmarks/latest.json"
```

## 🔄 Hotfix Process

### Emergency Hotfix Workflow

```bash
# 1. Create hotfix branch from master
git checkout master
git pull origin master
git checkout -b hotfix/critical-fix

# 2. Make minimal fix
# ... implement fix ...

# 3. Test thoroughly
npm test
npm run test:integration

# 4. Version bump (patch)
npm version patch

# 5. Merge and deploy
git checkout master
git merge hotfix/critical-fix
git push origin master
git push --tags

# 6. Deploy immediately
npm run deploy:production

# 7. Backport to develop
git checkout develop
git merge master
git push origin develop
```

## 📈 Release Analytics

### Release Success Criteria

- [ ] Zero critical bugs in first 24 hours
- [ ] Performance metrics within 5% of targets
- [ ] No security vulnerabilities introduced
- [ ] User adoption rate >80% within 1 week
- [ ] Documentation completeness >95%

### Post-Release Monitoring

```bash
# Monitor key metrics for 48 hours
npm run monitor:release

# Check error rates
npm run monitor:errors

# Performance monitoring
npm run monitor:performance

# User feedback collection
npm run feedback:collect
```

## 🔮 Future Improvements

### Automation Enhancements
- Automated release notes generation
- Integrated security scanning
- Performance regression detection
- Automated rollback capabilities

### Quality Improvements
- Enhanced integration testing
- Chaos engineering tests
- Performance profiling automation
- User experience testing

### Process Improvements
- Feature flags for gradual rollouts
- A/B testing infrastructure
- Canary deployment support
- Blue-green deployment strategy

---

## Related Documentation
- [Development Workflow](./development_workflow.md)
- [Testing Strategy](./testing_strategy.md)
- [Contributing Guide](../guides/contributing.md)
- [Performance Optimization](../guides/performance_optimization.md)