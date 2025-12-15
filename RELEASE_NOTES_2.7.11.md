# Release Notes — `@er77/code-graph-rag-mcp` v2.7.11 (2025-12-15)

## Summary

v2.7.11 makes database storage **per-repo by default** so multiple codebases don’t share or mix a single SQLite database.

## What’s Changed

- Database isolation: default `database.path` is now `./.code-graph-rag/vectors.db` (relative to the workspace root after `process.chdir()`).
- Index hygiene: `.code-graph-rag/**` is always excluded from indexing.

## Install / Upgrade

- npm: `npm install -g @er77/code-graph-rag-mcp@2.7.11`
- local artifact: `npm install -g ./er77-code-graph-rag-mcp-2.7.11.tgz`

Node.js: `>=24`

## Notes

- Add `/.code-graph-rag/` to your repo’s `.gitignore`.
- To override per-project DB location, set `DATABASE_PATH` or `database.path` in YAML.

