#!/usr/bin/env node
/**
 * Test script to verify WASM path resolution
 *
 * This script tests that the TreeSitterParser can find WASM files
 * in various installation scenarios (local, global, npx).
 */

import { TreeSitterParser } from "../src/parsers/tree-sitter-parser.js";

console.log("🧪 Testing WASM Path Resolution\n");
console.log("Process info:");
console.log(`  CWD: ${process.cwd()}`);
console.log(`  Node version: ${process.version}`);
console.log(`  Platform: ${process.platform}`);
console.log(`  HOME: ${process.env.HOME || process.env.USERPROFILE}`);
console.log("");

async function testWasmResolution() {
  try {
    console.log("Initializing TreeSitterParser...");
    const parser = new TreeSitterParser();

    await parser.initialize();

    console.log("\n✅ SUCCESS: TreeSitterParser initialized successfully!");
    console.log("   All WASM files were resolved correctly.");

    // Test parsing a simple TypeScript file
    const testCode = `
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}

class Greeter {
  constructor(private name: string) {}

  greet(): void {
    console.log(hello(this.name));
  }
}
`;

    console.log("\n🔍 Testing parse functionality...");
    const result = await parser.parse("test.ts", testCode, "test-hash-123");

    console.log(`\n✅ Parse successful!`);
    console.log(`   Entities found: ${result.entities.length}`);
    console.log(`   Parse time: ${result.parseTimeMs}ms`);

    if (result.entities.length > 0) {
      console.log("\n   Sample entities:");
      result.entities.slice(0, 3).forEach((entity) => {
        console.log(`   - ${entity.type}: ${entity.name}`);
      });
    }

    console.log("\n🎉 All tests passed! WASM resolution is working correctly.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ FAILED: Could not initialize parser");
    console.error("   Error:", error.message);

    if (error.message.includes("Cannot find WASM file")) {
      console.error("\n💡 This error indicates WASM files could not be found.");
      console.error("   The error message above shows all paths that were checked.");
    }

    process.exit(1);
  }
}

testWasmResolution();
