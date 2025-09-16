#!/usr/bin/env node
/**
 * Test Logging Functionality
 *
 * Demonstrates comprehensive MCP server logging with all categories
 */

import { spawn } from 'child_process';
import { resolve } from 'path';

// Test MCP requests to generate comprehensive logs
const testRequests = [
  // List tools
  { jsonrpc: "2.0", method: "tools/list", id: "test-list" },

  // Get metrics
  { jsonrpc: "2.0", method: "tools/call", params: { name: "get_metrics", arguments: {} }, id: "test-metrics" },

  // Test semantic search (will generate agent activity logs)
  { jsonrpc: "2.0", method: "tools/call", params: { name: "semantic_search", arguments: { query: "function definition", limit: 5 } }, id: "test-semantic" },

  // Test indexing (will generate comprehensive logs)
  { jsonrpc: "2.0", method: "tools/call", params: { name: "index", arguments: { directory: "./examples/python-test-files", incremental: false } }, id: "test-index" }
];

async function testLogging() {
  console.log('🚀 Starting MCP Server Logging Test...\n');

  const serverPath = resolve('./dist/index.js');
  const testDir = resolve('./examples/python-test-files');

  // Start MCP server
  const server = spawn('node', [serverPath, testDir], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responseCount = 0;
  let responses = [];

  // Handle server output
  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        responseCount++;
        console.log(`✅ Response ${responseCount}: ${response.id || 'no-id'}`);

        // If we've received all responses, finish test
        if (responseCount >= testRequests.length) {
          setTimeout(() => {
            server.kill();
            console.log('\n🏁 Test completed! Check logs_llm/mcp-server-*.log for detailed activity logs.');
            process.exit(0);
          }, 1000);
        }
      } catch (e) {
        // Non-JSON output (startup messages)
        console.log(`📝 Server: ${line}`);
      }
    }
  });

  // Handle server errors
  server.stderr.on('data', (data) => {
    console.error(`❌ Server Error: ${data}`);
  });

  // Wait for server to start
  setTimeout(async () => {
    console.log('\n🔄 Sending test requests...\n');

    // Send test requests with delays
    for (let i = 0; i < testRequests.length; i++) {
      const request = testRequests[i];
      console.log(`📤 Sending: ${request.method} (${request.id})`);

      server.stdin.write(JSON.stringify(request) + '\n');

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }, 2000);

  // Cleanup after timeout
  setTimeout(() => {
    console.log('\n⏰ Test timeout, cleaning up...');
    server.kill();
    process.exit(1);
  }, 30000);
}

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  process.exit(0);
});

testLogging().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});