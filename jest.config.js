/** @type {import('jest').Config} */
const detectOpenHandles = process.env.JEST_DETECT_OPEN_HANDLES === "1";
const forceExit = process.env.JEST_FORCE_EXIT === "1";

export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  resetModules: true,
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(?:\\.{1,2}/)+semantic/(.*)\\.js$": "<rootDir>/src/semantic/$1.ts",
    "^(?:\\.{1,2}/)+semantic/(?!.*\\.js$)(.*)$": "<rootDir>/src/semantic/$1.ts",
    "^(?:\\.{1,2}/)+storage/(.*)\\.js$": "<rootDir>/src/storage/$1.ts",
    "^(?:\\.{1,2}/)+storage/(?!.*\\.js$)(.*)$": "<rootDir>/src/storage/$1.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^nanoid$": "<rootDir>/src/__mocks__/nanoid.cjs",
    "^p-limit$": "<rootDir>/src/__mocks__/p-limit.cjs",
    ".*/connection-pool\\.js$": "<rootDir>/src/__mocks__/connection-pool.cjs",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  testMatch: ["**/tests/**/*.test.ts", "**/tests/**/*.spec.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/**/__mocks__/**"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  verbose: true,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  maxWorkers: 1,
  detectOpenHandles,
  forceExit,
  silent: false,
};
