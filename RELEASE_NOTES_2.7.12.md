# Release Notes — `@er77/code-graph-rag-mcp` v2.7.12 (2025-12-15)

## Summary

v2.7.12 removes a noisy npm deprecation warning (`boolean@3.2.0`) during install by no longer auto-installing `onnxruntime-node` by default.

## What’s Changed

- Dependencies: `onnxruntime-node` is now an **optional peer dependency** (not auto-installed), so installs no longer pull in the deprecated `boolean` package.

## Install / Upgrade

- npm: `npm install -g @er77/code-graph-rag-mcp@2.7.12`
- local artifact: `npm install -g ./er77-code-graph-rag-mcp-2.7.12.tgz`

Node.js: `>=24`

## Notes

- If you want the optional ONNX acceleration path, install it explicitly in the global install directory:
  - `npm install -g onnxruntime-node`

