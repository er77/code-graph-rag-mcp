// Mock ConnectionPool for testing (CommonJS)

class ConnectionPool {
  constructor(config) {
    this.config = config;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    return Promise.resolve();
  }

  async acquire() {
    // Return mock connection immediately
    return {
      id: 'mock-conn',
      db: global.testDb || null,
      inUse: true,
      lastUsed: Date.now(),
    };
  }

  release(connection) {
    if (connection) connection.inUse = false;
  }

  async shutdown() {
    this.initialized = false;
    return Promise.resolve();
  }
}

module.exports = { ConnectionPool };


