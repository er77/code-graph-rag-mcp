#!/usr/bin/env node

/**
 * Test script for MCP protocol methods
 * Tests all available tools through the MCP stdio interface
 */

import { spawn } from 'child_process';
import { resolve } from 'path';

// Test directory path
const TEST_DIR = '/home/er77/_work_fodler/baserow-develop';

class MCPTester {
  constructor() {
    this.messageId = 1;
    this.mcpProcess = null;
    this.responseBuffer = '';
  }

  /**
   * Start the MCP server process
   */
  async startServer() {
    console.log('🚀 Starting MCP server...');

    this.mcpProcess = spawn('node', [
      resolve('/home/er77/_work_fodler/code-graph-rag-mcp/dist/index.js'),
      TEST_DIR
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle server output
    this.mcpProcess.stdout.on('data', (data) => {
      this.responseBuffer += data.toString();
      this.processResponses();
    });

    this.mcpProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    this.mcpProcess.on('error', (error) => {
      console.error('Failed to start server:', error);
    });

    // Wait for server to initialize
    await this.waitForReady();
  }

  /**
   * Wait for server to be ready
   */
  async waitForReady() {
    return new Promise((resolve) => {
      const checkReady = setInterval(() => {
        if (this.responseBuffer.includes('MCP server running on stdio transport')) {
          clearInterval(checkReady);
          console.log('✅ Server ready!');
          this.responseBuffer = '';
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Send a JSON-RPC request to the server
   */
  sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method,
      params
    };

    const message = JSON.stringify(request) + '\n';
    console.log(`\n📤 Sending: ${method}`);
    console.log('   Params:', JSON.stringify(params, null, 2));

    this.mcpProcess.stdin.write(message);
  }

  /**
   * Process responses from the server
   */
  processResponses() {
    const lines = this.responseBuffer.split('\n');

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line && line.startsWith('{')) {
        try {
          const response = JSON.parse(line);
          if (response.result !== undefined) {
            console.log(`📥 Response received:`);
            console.log(JSON.stringify(response.result, null, 2));
          } else if (response.error) {
            console.error(`❌ Error:`, response.error);
          }
        } catch (e) {
          // Not JSON, skip
        }
      }
    }

    // Keep the last incomplete line in buffer
    this.responseBuffer = lines[lines.length - 1];
  }

  /**
   * Run all tests
   */
  async runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TESTING MCP PROTOCOL METHODS');
    console.log('='.repeat(60));

    // Wait a bit for server to fully initialize
    await this.sleep(2000);

    // 1. Test initialize
    console.log('\n--- Test 1: Initialize ---');
    this.sendRequest('initialize', {
      protocolVersion: '1.0.0',
      capabilities: {}
    });
    await this.sleep(1000);

    // 2. Test tools/list
    console.log('\n--- Test 2: List Tools ---');
    this.sendRequest('tools/list', {});
    await this.sleep(1000);

    // 3. Test graph:analyze
    console.log('\n--- Test 3: Analyze Graph ---');
    this.sendRequest('tools/call', {
      name: 'graph:analyze',
      arguments: {
        directory: TEST_DIR
      }
    });
    await this.sleep(2000);

    // 4. Test graph:index
    console.log('\n--- Test 4: Index Directory ---');
    this.sendRequest('tools/call', {
      name: 'graph:index',
      arguments: {
        directory: TEST_DIR,
        incremental: true,
        batchMode: true
      }
    });
    await this.sleep(3000);

    // 5. Test query:search
    console.log('\n--- Test 5: Search Query ---');
    this.sendRequest('tools/call', {
      name: 'query:search',
      arguments: {
        query: 'function',
        limit: 5
      }
    });
    await this.sleep(2000);

    // 6. Test query:findEntity
    console.log('\n--- Test 6: Find Entity ---');
    this.sendRequest('tools/call', {
      name: 'query:findEntity',
      arguments: {
        name: 'BaserowApplication',
        type: 'class'
      }
    });
    await this.sleep(2000);

    // 7. Test query:getRelationships
    console.log('\n--- Test 7: Get Relationships ---');
    this.sendRequest('tools/call', {
      name: 'query:getRelationships',
      arguments: {
        entityId: 'test-entity',
        relationshipType: 'imports'
      }
    });
    await this.sleep(2000);

    // 8. Test semantic:search
    console.log('\n--- Test 8: Semantic Search ---');
    this.sendRequest('tools/call', {
      name: 'semantic:search',
      arguments: {
        query: 'database connection',
        limit: 5
      }
    });
    await this.sleep(2000);

    // 9. Test semantic:findSimilar
    console.log('\n--- Test 9: Find Similar ---');
    this.sendRequest('tools/call', {
      name: 'semantic:findSimilar',
      arguments: {
        entityId: 'test-entity',
        limit: 3
      }
    });
    await this.sleep(2000);

    // 10. Test semantic:analyze
    console.log('\n--- Test 10: Semantic Analyze ---');
    this.sendRequest('tools/call', {
      name: 'semantic:analyze',
      arguments: {
        filePath: `${TEST_DIR}/backend/src/baserow/__init__.py`
      }
    });
    await this.sleep(2000);

    // 11. Test semantic:getContext
    console.log('\n--- Test 11: Get Context ---');
    this.sendRequest('tools/call', {
      name: 'semantic:getContext',
      arguments: {
        entityId: 'test-entity',
        depth: 2
      }
    });
    await this.sleep(2000);

    // 12. Test semantic:explain
    console.log('\n--- Test 12: Explain Code ---');
    this.sendRequest('tools/call', {
      name: 'semantic:explain',
      arguments: {
        code: 'def hello_world():\n    print("Hello, World!")',
        language: 'python'
      }
    });
    await this.sleep(2000);

    // 13. Test semantic:suggest
    console.log('\n--- Test 13: Suggest Improvements ---');
    this.sendRequest('tools/call', {
      name: 'semantic:suggest',
      arguments: {
        code: 'def add(a,b): return a+b',
        language: 'python'
      }
    });
    await this.sleep(2000);

    // 14. Test semantic:detectPatterns
    console.log('\n--- Test 14: Detect Patterns ---');
    this.sendRequest('tools/call', {
      name: 'semantic:detectPatterns',
      arguments: {
        directory: TEST_DIR,
        patternType: 'architectural'
      }
    });
    await this.sleep(2000);

    // 15. Test semantic:generateDocs
    console.log('\n--- Test 15: Generate Documentation ---');
    this.sendRequest('tools/call', {
      name: 'semantic:generateDocs',
      arguments: {
        entityId: 'test-entity',
        format: 'markdown'
      }
    });
    await this.sleep(2000);

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(60));
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop the server
   */
  async stopServer() {
    console.log('\n🛑 Stopping server...');
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      await this.sleep(1000);
    }
    console.log('✅ Server stopped');
  }
}

// Main execution
async function main() {
  const tester = new MCPTester();

  try {
    await tester.startServer();
    await tester.runTests();
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await tester.stopServer();
    process.exit(0);
  }
}

// Run tests
main().catch(console.error);