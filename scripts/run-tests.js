#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

function listTests(extraArgs) {
  const out = execFileSync(NPX, ["jest", "--listTests", ...extraArgs], { encoding: "utf8" });
  return out.trim().split(/\r?\n/).filter(Boolean);
}

function runTestFile(testPath, extraArgs) {
  return new Promise((resolve) => {
    const args = ["jest", "--runInBand", ...extraArgs, testPath];
    const child = spawn(NPX, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code, signal) => {
      resolve({ file: testPath, code: code ?? 0, signal: signal ?? null });
    });
  });
}

async function main() {
  const passthroughArgs = process.argv.slice(2);

  const isWatchMode = passthroughArgs.some((arg) => arg === "--watch" || arg === "--watchAll");
  if (isWatchMode) {
    const args = ["jest", "--runInBand", ...passthroughArgs];
    const child = spawn(NPX, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => {
      process.exitCode = code === 0 ? 0 : 1;
    });
    return;
  }

  const tests = listTests(passthroughArgs);
  if (!tests.length) return;

  const concurrency = Number(process.env.JEST_PER_FILE_CONCURRENCY || 1);
  console.log(`Running ${tests.length} test files in separate processes (concurrency=${concurrency})`);

  const queue = tests.slice();
  let passed = 0;
  let failed = 0;
  const failures = [];

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const file = queue.shift();
      if (!file) break;
      const result = await runTestFile(file, passthroughArgs);
      if (result.code === 0) {
        passed++;
      } else {
        failed++;
        const reason = result.signal ? `${file} (signal ${result.signal})` : file;
        failures.push(reason);
      }
    }
  });

  await Promise.all(workers);

  if (failures.length) {
    process.exitCode = 1;
  }

  console.log("\nJest per-file summary:");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${tests.length}`);
  if (failures.length) {
    console.log("  Failed files:");
    for (const f of failures) console.log(`    - ${f}`);
  }
}

main();
