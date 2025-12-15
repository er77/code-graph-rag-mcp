const { jest } = await import("@jest/globals");
const path = await import("node:path");
const fs = await import("node:fs");

if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID) {
  // Ensure tests don't write DB artifacts outside the repo (e.g. ~/.code-graph-rag).
  if (!process.env.DATABASE_PATH) {
    const workerId = process.env.JEST_WORKER_ID || "0";
    const tmpDir = path.join(process.cwd(), "tmp");
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
    } catch {
      // best-effort; tests may still override DATABASE_PATH explicitly
    }
    process.env.DATABASE_PATH = path.join(tmpDir, `test-vectors-${workerId}.db`);
  }

  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: console.error,
  };
}
