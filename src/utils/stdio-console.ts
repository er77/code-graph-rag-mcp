/**
 * MCP stdio servers must not write non-JSON data to stdout.
 *
 * The MCP SDK transport writes JSON-RPC messages to `process.stdout`. Any logs on stdout
 * can corrupt the stream and cause strict clients (e.g., Codex in VSCode) to fail.
 *
 * This module routes console's stdout-backed methods (log/info/debug/dir/table) to stderr
 * when stdout is not a TTY (typical for stdio transports).
 */

export function redirectConsoleStdoutToStderr(): void {
  if (process.env.MCP_STDIO_ALLOW_STDOUT_LOGS === "1") return;

  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h") || argv.includes("--version") || argv.includes("-v")) return;

  if (process.stdout.isTTY) return;

  const c = console as any;

  // Ensure any console method that writes to stdout uses stderr instead.
  if (c?._stdout && c._stdout !== process.stderr) c._stdout = process.stderr;
  if (c?._stderr && c._stderr !== process.stderr) c._stderr = process.stderr;
}

redirectConsoleStdoutToStderr();
