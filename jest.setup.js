import {jest} from '@jest/globals'
if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: console.error,
  };
}