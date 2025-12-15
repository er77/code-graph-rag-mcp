import { appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}

export function getGlobalTmpLogDir(): string {
  return join(tmpdir(), "code-graph-rag-mcp");
}

export function getGlobalTmpLogFile(): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return join(getGlobalTmpLogDir(), `mcp-server-${dateStr}.log`);
}

export function appendGlobalTmpLog(message: string, data?: Record<string, unknown>): void {
  try {
    const dir = getGlobalTmpLogDir();
    mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString();
    const pid = process.pid;
    const payload = data ? ` DATA: ${safeJsonStringify(data)}` : "";
    appendFileSync(getGlobalTmpLogFile(), `[${ts}] [PID ${pid}] ${message}${payload}\n`, { encoding: "utf8" });
  } catch {
    // best-effort only; never crash MCP startup due to logging
  }
}
