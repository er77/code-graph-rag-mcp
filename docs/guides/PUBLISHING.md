# Publishing Guide for @er77/code-graph-rag-mcp

This guide explains how to publish the Code Graph RAG MCP project to npm.

## 📋 Prerequisites

### 1. NPM Account Setup
```bash
# If you don't have an npm account, create one
npm adduser

# Or login to existing account
npm login
```

### 2. Verify Account
```bash
# Check if logged in
npm whoami

# Should output: er77
```

### 3. Organization Setup (Optional)
If using the `@er77` scope for the first time:
```bash
# Create organization on npmjs.com
# Go to: https://www.npmjs.com/org/create
# Or publish first package to auto-create scope
```

## 🚀 Publishing Process

### 1. Pre-publish Checklist

```bash
# 1. Ensure all changes are committed
git status

# 2. Update version if needed
npm version patch  # for bug fixes
npm version minor  # for new features
npm version major  # for breaking changes

# 3. Clean and build
npm run clean
npm run build

# 4. Run tests
npm test

# 5. Lint code
npm run lint
```

### 2. Test Package Before Publishing

```bash
# Create a tarball to inspect what will be published
npm pack

# This creates: er77-code-graph-rag-mcp-2.0.0.tgz
# Extract and inspect contents:
tar -tf er77-code-graph-rag-mcp-2.0.0.tgz

# Clean up test tarball
rm er77-code-graph-rag-mcp-2.0.0.tgz
```

### 3. Dry Run Publishing

```bash
# Test publish without actually publishing
npm publish --dry-run

# This shows exactly what files will be published
```

### 4. Actual Publishing

```bash
# For first-time scoped package publishing
npm publish --access public

# For subsequent updates
npm publish
```

## 📦 Published Package Information

After publishing, your package will be available at:

- **NPM Page**: https://www.npmjs.com/package/@er77/code-graph-rag-mcp
- **Installation**: `npm install -g @er77/code-graph-rag-mcp`
- **Usage**: `npx @er77/code-graph-rag-mcp /path/to/codebase`

## 🔄 Version Management

### Semantic Versioning
- **PATCH** (2.0.1): Bug fixes, no breaking changes
- **MINOR** (2.1.0): New features, backward compatible
- **MAJOR** (3.0.0): Breaking changes

### Version Update Commands
```bash
# Automatically update package.json and create git tag
npm version patch   # 2.0.0 → 2.0.1
npm version minor   # 2.0.0 → 2.1.0
npm version major   # 2.0.0 → 3.0.0

# Custom version
npm version 2.1.0-beta.1
```

## 🛠️ Automated Publishing with GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run tests
        run: npm test

      - name: Publish to NPM
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Setup NPM Token for GitHub Actions
1. Go to https://www.npmjs.com/settings/tokens
2. Create "Automation" token
3. Add to GitHub repository secrets as `NPM_TOKEN`

## 📊 Package Statistics

After publishing, monitor your package:

- **Download stats**: https://npm-stat.com/charts.html?package=@er77/code-graph-rag-mcp
- **Bundle size**: https://bundlephobia.com/package/@er77/code-graph-rag-mcp
- **Package quality**: https://snyk.io/advisor/npm-package/@er77/code-graph-rag-mcp

## 🔧 Troubleshooting

### Common Issues

1. **Scope not found**:
   ```bash
   # Ensure you have access to @er77 scope
   npm owner ls @er77/code-graph-rag-mcp
   ```

2. **Version already exists**:
   ```bash
   # Update version first
   npm version patch
   ```

3. **Build files missing**:
   ```bash
   # Ensure prepublishOnly script runs
   npm run build
   ```

4. **Large package size**:
   ```bash
   # Check what's included
   npm pack --dry-run

   # Update .npmignore if needed
   echo "tmp/" >> .npmignore
   echo "logs_llm/" >> .npmignore
   ```

## 🎯 Best Practices

1. **Always test locally first**:
   ```bash
   npm link
   code-graph-rag-mcp /tmp/test-project
   npm unlink
   ```

2. **Use conventional commits** for better changelogs
3. **Tag releases** on GitHub after publishing
4. **Update documentation** with each release
5. **Monitor for security vulnerabilities**:
   ```bash
   npm audit
   npm audit fix
   ```

## 📝 Post-Publishing Checklist

- [ ] Verify package appears on npmjs.com
- [ ] Test installation: `npm install -g @er77/code-graph-rag-mcp`
- [ ] Test CLI: `code-graph-rag-mcp --help`
- [ ] Update GitHub release notes
- [ ] Update documentation if needed
- [ ] Share announcement (optional)

## 🚨 Emergency Unpublishing

If you need to unpublish (use sparingly):

```bash
# Unpublish specific version (within 72 hours)
npm unpublish @er77/code-graph-rag-mcp@2.0.0

# Deprecate instead of unpublishing (preferred)
npm deprecate @er77/code-graph-rag-mcp@2.0.0 "Use version 2.0.1 instead"
```

---

**Note**: Once published to npm, packages are public forever (even if unpublished). Always double-check before publishing!