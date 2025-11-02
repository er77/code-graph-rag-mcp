/**
 * Lightweight adapter for invoking `lerna ls --graph` from within the MCP server.
 * The goal is to reuse Lerna's project graph generation when a workspace is configured,
 * while degrading gracefully when the repository is a single package.
 */

import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { join, resolve as resolvePath } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type LernaGraphJSON = Record<string, string[]>;

export type LernaGraphResult =
  | {
      ok: true;
      graph: LernaGraphJSON;
      rawOutput: string;
      lernaVersion?: string;
      cwd: string;
      cached?: boolean;
    }
  | {
      ok: false;
      reason: "missing-config" | "command-error" | "parse-error";
      message: string;
      stdout?: string;
      stderr?: string;
      cwd: string;
      cached?: boolean;
    };

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

interface WorkspaceConfigInfo {
  hasConfig: boolean;
  signature: string | null;
}

async function getWorkspaceConfigInfo(baseDir: string): Promise<WorkspaceConfigInfo> {
  const lernaJson = join(baseDir, "lerna.json");
  if (await fileExists(lernaJson)) {
    try {
      const stats = await stat(lernaJson);
      return { hasConfig: true, signature: `${lernaJson}:${stats.mtimeMs}` };
    } catch {
      return { hasConfig: true, signature: null };
    }
  }

  const pkgJsonPath = join(baseDir, "package.json");
  if (!(await fileExists(pkgJsonPath))) {
    return { hasConfig: false, signature: null };
  }

  try {
    const pkgRaw = await readFile(pkgJsonPath, "utf8");
    const pkg = JSON.parse(pkgRaw);
    if (!pkg.workspaces) {
      return { hasConfig: false, signature: null };
    }
    const stats = await stat(pkgJsonPath);
    const workspaceKey = typeof pkg.workspaces === "string" ? pkg.workspaces : JSON.stringify(pkg.workspaces);
    return { hasConfig: true, signature: `${pkgJsonPath}:${stats.mtimeMs}:${workspaceKey}` };
  } catch {
    return { hasConfig: true, signature: null };
  }
}

function extractJsonGraph(output: string): LernaGraphJSON {
  const trimmed = output.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object detected in lerna output");
  }

  const jsonSlice = trimmed.slice(start, end + 1);
  return JSON.parse(jsonSlice) as LernaGraphJSON;
}

/**
 * Invoke `npx lerna ls --graph` and return the parsed dependency graph.
 * If the workspace is not configured for Lerna, returns a `missing-config` result.
 */
const CACHE_TTL_MS = 30_000;

export interface LernaGraphOptions {
  force?: boolean;
}

type CacheEntry = {
  result: LernaGraphResult;
  signature: string | null;
  timestamp: number;
};

const graphCache = new Map<string, CacheEntry>();

function getCachedResult(cwd: string, signature: string | null): LernaGraphResult | null {
  const entry = graphCache.get(cwd);
  if (!entry) return null;

  const withinTtl = Date.now() - entry.timestamp <= CACHE_TTL_MS;
  const signatureMatches = entry.signature === signature;

  if (withinTtl && signatureMatches) {
    const cachedResult = entry.result.ok ? { ...entry.result, cached: true } : { ...entry.result, cached: true };
    return cachedResult;
  }

  if (!withinTtl) {
    graphCache.delete(cwd);
  }

  return null;
}

function storeCache(cwd: string, signature: string | null, result: LernaGraphResult): void {
  graphCache.set(cwd, {
    result,
    signature,
    timestamp: Date.now(),
  });
}

export async function getLernaProjectGraph(
  baseDir: string,
  options: LernaGraphOptions = {},
): Promise<LernaGraphResult> {
  const cwd = resolvePath(baseDir);
  const { hasConfig, signature } = await getWorkspaceConfigInfo(cwd);

  if (options.force) {
    graphCache.delete(cwd);
  }

  if (!hasConfig) {
    const cachedMissing = getCachedResult(cwd, signature);
    if (cachedMissing) {
      return cachedMissing;
    }
    const result: LernaGraphResult = {
      ok: false,
      reason: "missing-config",
      message: "No lerna.json or workspace configuration found",
      cwd,
    };
    storeCache(cwd, signature, result);
    return result;
  }

  const cached = getCachedResult(cwd, signature);
  if (cached) {
    return cached;
  }

  try {
    const { stdout, stderr } = await execFileAsync("npx", ["--yes", "lerna", "ls", "--graph", "--loglevel", "silent"], {
      cwd,
      maxBuffer: 5 * 1024 * 1024,
      env: {
        ...process.env,
        // Ensure NPX installs without prompts; allow importing CLI packages.
        NPX_ISOLATE_HOME: "false",
        NPX_IMPORT_RESTRICTIONS: "0",
        npm_config_yes: "true",
      },
    });

    const graph = extractJsonGraph(stdout);
    const result: LernaGraphResult = {
      ok: true,
      graph,
      rawOutput: stdout,
      lernaVersion: parseLernaVersion(stderr),
      cwd,
    };
    storeCache(cwd, signature, result);
    return result;
  } catch (error) {
    if (typeof error === "object" && error && "stdout" in error && "stderr" in error) {
      const stdout = String((error as any).stdout ?? "");
      const stderr = String((error as any).stderr ?? "");
      try {
        const graph = extractJsonGraph(stdout);
        const result: LernaGraphResult = {
          ok: true,
          graph,
          rawOutput: stdout,
          lernaVersion: parseLernaVersion(stderr),
          cwd,
        };
        storeCache(cwd, signature, result);
        return result;
      } catch (parseError) {
        const result: LernaGraphResult = {
          ok: false,
          reason: "parse-error",
          message: parseError instanceof Error ? parseError.message : "Failed to parse Lerna graph output",
          stdout,
          stderr,
          cwd,
        };
        storeCache(cwd, signature, result);
        return result;
      }
    }

    const result: LernaGraphResult = {
      ok: false,
      reason: "command-error",
      message: error instanceof Error ? error.message : "Unknown error running lerna graph command",
      cwd,
    };
    storeCache(cwd, signature, result);
    return result;
  }
}

function parseLernaVersion(stderrOutput: string | undefined): string | undefined {
  if (!stderrOutput) {
    return undefined;
  }

  const match = /lerna(?: notice)? cli v(\d+\.\d+\.\d+)/i.exec(stderrOutput);
  return match?.[1];
}
