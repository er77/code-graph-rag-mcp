#!/usr/bin/env node

/**
 * test-mcp-tool.mjs
 * MCP Server Tool Testing (pure Node, ESM)
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// -------- Config --------
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectDir =
  process.env.PROJECT_DIR || (path.basename(scriptDir) === "scripts" ? path.resolve(scriptDir, "..") : process.cwd());
const PROJECT_DIR = defaultProjectDir;
const DIST_JS = process.env.DIST_JS || path.join(PROJECT_DIR, "dist", "index.js");
const TARGET_DIR = process.env.TARGET_DIR || PROJECT_DIR;
const LOG_DIR = process.env.LOG_DIR || path.join(PROJECT_DIR, "logs_llm");
const TOTAL_TIMEOUT_SEC = parseInt(process.env.TOTAL_TIMEOUT || "300", 10);
const DRAIN_AFTER_ALL_MS = parseInt(process.env.DRAIN_AFTER_ALL_MS || "800", 10);
const SEND_AFTER_INDEX_MS = parseInt(process.env.SEND_AFTER_INDEX_MS || "600", 10);

const dateStr = new Date().toISOString().slice(0, 10);
fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, `mcp-server-${dateStr}.log`);

fs.writeFileSync(LOG_FILE, "", { encoding: "utf8" });

// -------- Helpers --------
const codeExts = new Set([".ts", ".js", ".py", ".java", ".cpp", ".c", ".go", ".rs"]);
const excludedDirs = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  ".nyc_output",
  "__pycache__",
  "venv",
  "env",
  ".venv",
  "vendor",
  "target",
  ".gradle",
  ".idea",
  ".vscode",
  "docs",
  "doc",
  "documentation",
  "examples",
  "example",
  "demo",
  "demos",
  "migrations",
  "scripts",
  "tools",
  "test",
  "tests",
  "__tests__",
]);

function isCodeFile(p) {
  return codeExts.has(path.extname(p).toLowerCase());
}

async function pathExists(p) {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function dfsFind(dir, depth, maxDepth) {
  if (depth > maxDepth) return null;
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const ent of entries) {
    const name = ent.name;
    const full = path.join(dir, name);
    if (ent.isDirectory()) {
      if (excludedDirs.has(name)) continue;
      const sub = await dfsFind(full, depth + 1, maxDepth);
      if (sub) return sub;
    } else if (ent.isFile()) {
      if (isCodeFile(full)) return full;
    }
  }
  return null;
}

async function findFirstCodeFile(root, preferWithin = null, maxDepth = 8) {
  if (preferWithin) {
    const preferRoot = path.join(root, preferWithin);
    if (await pathExists(preferRoot)) {
      const found = await dfsFind(preferRoot, 0, maxDepth);
      if (found) return found;
    }
  }
  const jestCfg = path.join(root, "jest.config.js");
  if (await pathExists(jestCfg)) return jestCfg;
  return await dfsFind(root, 0, maxDepth);
}

function readSnippetOneLine(file, maxLines = 80) {
  try {
    const data = fs.readFileSync(file, "utf8");
    const lines = data.split(/\r?\n/).slice(0, maxLines).join(" ");
    return lines;
  } catch {
    return "";
  }
}

function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const validators = {
  index: (payload) => {
    const body = tryParseJSON(payload);
    if (!body || body.success !== true) return { ok: false, reason: "no success:true" };
    const r0 = body.result?.results?.[0];
    if (!r0) return { ok: false, reason: "no result.results[0]" };
    if ((r0.filesProcessed ?? 0) <= 0) return { ok: false, reason: "filesProcessed<=0" };
    return { ok: true };
  },
  list_file_entities: (payload) => {
    const body = tryParseJSON(payload);
    if (!body || typeof body.total !== "number") return { ok: false, reason: "no total" };
    if (body.total < 1) return { ok: false, reason: "no entities" };
    return { ok: true };
  },
  list_entity_relationships: (payload) => {
    const body = tryParseJSON(payload);
    if (!body || !Array.isArray(body.relationships)) return { ok: false, reason: "no relationships" };
    return { ok: true };
  },
  analyze_hotspots: (payload) => {
    const body = tryParseJSON(payload);
    if (!body || !Array.isArray(body.hotspots)) return { ok: false, reason: "no hotspots" };
    return { ok: true };
  },
  semantic_search: (payload) => {
    const body = tryParseJSON(payload);
    if (!body || !Array.isArray(body.results)) return { ok: false, reason: "no results" };
    return { ok: true, warn: body.results.length === 0 ? "empty semantic results" : undefined };
  },
  find_similar_code: (payload) => ({ ok: true }),
  detect_code_clones: (payload) => ({ ok: true }),
  cross_language_search: (payload) => ({ ok: true }),
  find_related_concepts: (payload) => ({ ok: true }),
  analyze_code_impact: (payload) => {
    const body = tryParseJSON(payload);
    if (!body || !body.source) return { ok: false, reason: "no source" };
    return { ok: true };
  },
  suggest_refactoring: (payload) => ({ ok: true }),
  get_metrics: (payload) => {
    const body = tryParseJSON(payload);
    if (!body || !body.conductor) return { ok: false, reason: "no conductor" };
    return { ok: true };
  },
};

function formatResultPayload(r) {
  if (r == null) return "null";
  if (typeof r === "object") {
    if (Array.isArray(r.content)) {
      const texts = [];
      for (const c of r.content) {
        if (c && c.type === "text" && typeof c.text === "string") texts.push(c.text);
      }
      if (texts.length) return texts.join("\n");
    }
    try {
      return JSON.stringify(r, null, 2);
    } catch {
      return String(r);
    }
  }
  return String(r);
}

function logAppend(text) {
  fs.appendFileSync(LOG_FILE, text);
}

// -------- Main --------
(async () => {
  console.log("=================================");
  console.log("MCP SERVER TOOL TESTING (Node, ESM)");
  console.log("=================================");

  const sampleFile = (await findFirstCodeFile(TARGET_DIR, "src")) || (await findFirstCodeFile(TARGET_DIR, null));
  if (!sampleFile) {
    console.error(`ERROR: Could not find any sample file under ${TARGET_DIR}`);
    process.exit(1);
  }

  const sampleEntity = path.basename(sampleFile, path.extname(sampleFile));
  const sampleSnippet = readSnippetOneLine(sampleFile, 80);

  const indexReq = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "index", arguments: { directory: TARGET_DIR, incremental: true, fullScan: true } },
  };
  const afterIndex = [];

  let seqId = 1;
  const queue = (toolName, args, label) => {
    seqId += 1;
    afterIndex.push({
      id: String(seqId),
      req: { jsonrpc: "2.0", id: seqId, method: "tools/call", params: { name: toolName, arguments: args } },
      label,
    });
  };

  // Structural
  queue("list_file_entities", { filePath: sampleFile }, "List File Entities");
  queue(
    "list_entity_relationships",
    { entityName: sampleEntity, filePath: sampleFile, depth: 1 },
    "List Entity Relationships",
  );
  queue("analyze_hotspots", { metric: "complexity", limit: 5 }, "Analyze Hotspots");

  // Semantic
  const QUERY_SEMANTIC = "jest configuration transform babel ts-jest";
  const QUERY_XLANG = "tree-sitter parser for TypeScript and JavaScript";
  queue("semantic_search", { query: QUERY_SEMANTIC, limit: 5 }, "Semantic Search (jest)");
  queue("find_similar_code", { code: sampleSnippet, threshold: 0.5, limit: 5 }, "Find Similar Code (0.5)");
  queue("detect_code_clones", { minSimilarity: 0.65, scope: "all" }, "Detect Code Clones (0.65)");
  queue(
    "cross_language_search",
    { query: QUERY_XLANG, languages: ["javascript", "typescript"] },
    "Cross Language Search (TS/JS)",
  );
  queue("find_related_concepts", { entityId: sampleEntity, limit: 5 }, "Find Related Concepts");

  // Impact + Refactoring + Metrics
  queue("analyze_code_impact", { entityId: sampleEntity, filePath: sampleFile, depth: 2 }, "Analyze Code Impact");
  queue("suggest_refactoring", { filePath: sampleFile }, "Suggest Refactoring");
  queue("get_metrics", {}, "Get System Metrics");

  const nodeArgs = [DIST_JS, TARGET_DIR];
  const child = spawn(process.execPath, nodeArgs, { cwd: PROJECT_DIR, stdio: ["pipe", "pipe", "pipe"] });

  let stdoutBuf = "";
  const pending = new Map(); // id(string) -> { label, name }
  pending.set("1", { label: "Index Codebase (full)", name: "index" });
  let failed = false;
  let indexDone = false;
  let restSending = false;
  let restSent = false;
  let exitScheduled = false;
  let drainTimer = null;

  function scheduleEarlyExit(reason = "all-responses") {
    if (exitScheduled) return;
    exitScheduled = true;
    drainTimer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {}
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, 3000);
    }, DRAIN_AFTER_ALL_MS);
  }

  function handleJsonMessage(obj) {
    if (!(obj && obj.id !== undefined && (obj.result !== undefined || obj.error !== undefined))) return;

    const idKey = String(obj.id);
    const payload = formatResultPayload(obj.result ?? obj.error);
    const meta = pending.get(idKey);
    if (!meta) return;

    const validate = validators[meta.name] || (() => ({ ok: true }));
    const verdict = validate(payload);
    const status = verdict.ok ? (verdict.warn ? `WARN(${verdict.warn})` : "PASS") : `FAIL(${verdict.reason})`;
    process.stdout.write(`query: ${meta.label}\nstatus: ${status}\nresult: ${payload}\n-------------\n`);
    if (!verdict.ok) failed = true;
    pending.delete(idKey);

    if (idKey === "1" && !indexDone) {
      indexDone = true;

      if (afterIndex.length > 0) {
        restSending = true;

        const sendRest = () => {
          for (const { id, req, label } of afterIndex) {
            pending.set(id, { label, name: req.params.name });
            child.stdin.write(JSON.stringify(req) + "\n");
          }
          restSent = true;
          restSending = false;

          if (pending.size === 0) scheduleEarlyExit("no-more-after-sending");
        };

        if (SEND_AFTER_INDEX_MS > 0) setTimeout(sendRest, SEND_AFTER_INDEX_MS);
        else setImmediate(sendRest);
      } else {
        restSent = true;
      }

      return;
    }

    if (!restSending && (restSent || afterIndex.length === 0) && pending.size === 0) {
      scheduleEarlyExit("all-responses");
    }
  }

  let multilineAssembly = "";
  function processLine(line) {
    logAppend(line + os.EOL);

    let parsed = null;
    try {
      parsed = JSON.parse(line);
    } catch {}

    if (!parsed) {
      multilineAssembly = multilineAssembly ? multilineAssembly + "\n" + line : line;
      try {
        parsed = JSON.parse(multilineAssembly);
      } catch {}
    }

    if (parsed) {
      handleJsonMessage(parsed);
      multilineAssembly = "";
    }
  }

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    stdoutBuf += text;
    let idx;
    while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
      const line = stdoutBuf.slice(0, idx).trimEnd();
      stdoutBuf = stdoutBuf.slice(idx + 1);
      if (line) processLine(line);
      else logAppend("\n");
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    logAppend(text);
  });

  child.on("error", (err) => {
    logAppend(`child error: ${String(err)}${os.EOL}`);
  });

  child.stdin.write(JSON.stringify(indexReq) + "\n");

  let hardTimedOut = false;
  const killTimer = setTimeout(() => {
    hardTimedOut = true;
    try {
      child.kill("SIGKILL");
    } catch {}
  }, TOTAL_TIMEOUT_SEC * 1000);

  child.on("close", (code, signal) => {
    clearTimeout(killTimer);
    if (drainTimer) clearTimeout(drainTimer);

    if (stdoutBuf.length) {
      const lines = stdoutBuf.split(/\r?\n/).filter(Boolean);
      for (const line of lines) processLine(line);
      stdoutBuf = "";
    }

    logAppend(`node exit code: ${code ?? "null"} signal: ${signal ?? "null"}${os.EOL}`);

    if (hardTimedOut) {
      console.error(`Process timed out after ${TOTAL_TIMEOUT_SEC}s`);
      process.exitCode = 124;
    } else if (failed) {
      process.exitCode = 1;
    }
  });
})().catch((err) => {
  console.error("Script failed:", (err && err.stack) || err);
  process.exit(1);
});
