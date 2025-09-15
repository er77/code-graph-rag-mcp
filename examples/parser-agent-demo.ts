/**
 * TASK-001: Parser Agent Demo
 * 
 * Demonstrates the high-performance parser agent with tree-sitter.
 * Shows incremental parsing, caching, and batch processing capabilities.
 */

import { EventEmitter } from 'node:events';
import { ParserAgent } from '../src/agents/parser-agent.js';
import type { ParserTask } from '../src/types/parser.js';

async function main() {
  console.log('='.repeat(60));
  console.log('Parser Agent Demo - TASK-001');
  console.log('='.repeat(60));

  // Create knowledge bus for agent communication
  const knowledgeBus = new EventEmitter();

  // Subscribe to parser events
  knowledgeBus.on('parse:complete', (event) => {
    console.log('\n📊 Parse Complete Event:');
    console.log(`  Agent ID: ${event.agentId}`);
    console.log(`  Files parsed: ${event.results.length}`);
    console.log(`  Throughput: ${event.stats.throughput.toFixed(1)} files/sec`);
    console.log(`  Cache hits: ${event.stats.cacheHits}`);
    console.log(`  Cache memory: ${event.stats.cacheMemoryMB.toFixed(2)} MB`);
  });

  knowledgeBus.on('parse:failed', (event) => {
    console.error('\n❌ Parse Failed Event:', event.error);
  });

  // Create and initialize parser agent
  const parser = new ParserAgent(knowledgeBus);
  console.log('\n🚀 Initializing Parser Agent...');
  await parser.initialize();
  console.log(`✅ Agent initialized: ${parser.id}`);

  // Demo 1: Parse a single file
  console.log('\n📄 Demo 1: Single File Parsing');
  console.log('-'.repeat(40));
  
  const singleFileTask: ParserTask = {
    id: 'demo-task-1',
    type: 'parse:file',
    priority: 5,
    payload: {
      files: ['./src/agents/parser-agent.ts']
    },
    createdAt: Date.now()
  };

  const singleResult = await parser.process(singleFileTask);
  if (Array.isArray(singleResult) && singleResult[0]) {
    const result = singleResult[0];
    console.log(`  File: ${result.filePath}`);
    console.log(`  Language: ${result.language}`);
    console.log(`  Entities found: ${result.entities.length}`);
    console.log(`  Parse time: ${result.parseTimeMs}ms`);
    console.log(`  From cache: ${result.fromCache ? 'Yes' : 'No'}`);
    
    // Show some entities
    console.log('\n  Sample entities:');
    result.entities.slice(0, 5).forEach(entity => {
      console.log(`    - ${entity.type}: ${entity.name}`);
    });
  }

  // Demo 2: Batch processing
  console.log('\n📚 Demo 2: Batch Processing');
  console.log('-'.repeat(40));
  
  const batchTask: ParserTask = {
    id: 'demo-task-2',
    type: 'parse:batch',
    priority: 5,
    payload: {
      files: [
        './src/agents/base.ts',
        './src/agents/coordinator.ts',
        './src/types/agent.ts',
        './src/types/parser.ts',
        './src/parsers/tree-sitter-parser.ts',
        './src/parsers/incremental-parser.ts'
      ],
      options: {
        useCache: true,
        batchSize: 3
      }
    },
    createdAt: Date.now()
  };

  const startTime = Date.now();
  const batchResults = await parser.process(batchTask);
  const elapsed = Date.now() - startTime;

  if (Array.isArray(batchResults)) {
    console.log(`  Files processed: ${batchResults.length}`);
    console.log(`  Total time: ${elapsed}ms`);
    console.log(`  Throughput: ${((batchResults.length / elapsed) * 1000).toFixed(1)} files/sec`);
    
    // Show statistics per file
    console.log('\n  Per-file statistics:');
    batchResults.forEach(result => {
      const fileName = result.filePath.split('/').pop();
      console.log(`    ${fileName}: ${result.entities.length} entities, ${result.parseTimeMs}ms`);
    });
  }

  // Demo 3: Cache effectiveness
  console.log('\n💾 Demo 3: Cache Effectiveness');
  console.log('-'.repeat(40));
  
  // Parse same files again to test cache
  const cacheTestTask: ParserTask = {
    id: 'demo-task-3',
    type: 'parse:batch',
    priority: 5,
    payload: {
      files: [
        './src/agents/base.ts',
        './src/types/agent.ts'
      ]
    },
    createdAt: Date.now()
  };

  const cacheStartTime = Date.now();
  const cacheResults = await parser.process(cacheTestTask);
  const cacheElapsed = Date.now() - cacheStartTime;

  if (Array.isArray(cacheResults)) {
    const fromCache = cacheResults.filter(r => r.fromCache).length;
    console.log(`  Files re-parsed: ${cacheResults.length}`);
    console.log(`  From cache: ${fromCache}/${cacheResults.length}`);
    console.log(`  Cache hit rate: ${((fromCache / cacheResults.length) * 100).toFixed(1)}%`);
    console.log(`  Time with cache: ${cacheElapsed}ms`);
    console.log(`  Speed improvement: ${elapsed > 0 ? ((elapsed / cacheElapsed).toFixed(1) + 'x faster') : 'N/A'}`);
  }

  // Demo 4: Performance statistics
  console.log('\n📈 Demo 4: Performance Statistics');
  console.log('-'.repeat(40));
  
  const stats = parser.getParserStats();
  console.log(`  Total files parsed: ${stats.filesParsed}`);
  console.log(`  Cache hits: ${stats.cacheHits}`);
  console.log(`  Cache misses: ${stats.cacheMisses}`);
  console.log(`  Average parse time: ${stats.avgParseTimeMs.toFixed(2)}ms`);
  console.log(`  Total parse time: ${stats.totalParseTimeMs}ms`);
  console.log(`  Current throughput: ${stats.throughput.toFixed(1)} files/sec`);
  console.log(`  Cache memory usage: ${stats.cacheMemoryMB.toFixed(2)} MB`);
  console.log(`  Errors encountered: ${stats.errorCount}`);

  // Export cache for persistence
  console.log('\n💾 Exporting cache for persistence...');
  const cacheData = parser.exportCache();
  console.log(`  Exported ${cacheData.length} cache entries`);

  // Cleanup
  console.log('\n🧹 Shutting down...');
  await parser.shutdown();
  console.log('✅ Parser Agent demo completed');
  
  console.log('\n' + '='.repeat(60));
  console.log('Performance Summary:');
  console.log(`✅ Achieved ${stats.throughput.toFixed(1)} files/sec throughput`);
  console.log(`✅ Cache hit rate: ${stats.cacheHits > 0 ? ((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100).toFixed(1) : 0}%`);
  console.log(`✅ Memory usage: ${stats.cacheMemoryMB.toFixed(2)} MB / 256 MB limit`);
  console.log('='.repeat(60));
}

// Run the demo
main().catch(console.error);