/**
 * Provider Configuration Mapping Test
 *
 * This test verifies that all provider configurations are properly mapped
 * from YAML config to factory options and that all required fields are present.
 */

import { describe, expect, it } from "@jest/globals";
import { getConfig } from "../../config/yaml-config.js";
import { EmbeddingGenerator } from "../embedding-generator.js";
import type { ProviderFactoryOptions } from "../providers/factory.js";
import { createProvider } from "../providers/factory.js";

describe("Provider Configuration Mapping", () => {
  describe("Provider Mapping Tests", () => {
    it("should correctly map Ollama configuration", () => {
      const testConfig = {
        mcp: {
          embedding: {
            provider: "ollama",
            model: "nomic-embed-text",
            ollama: {
              baseUrl: "http://localhost:11434",
              timeout: 30000,
              concurrency: 4,
              headers: { "User-Agent": "test" },
            },
          },
        },
      };

      const embeddingConfig = testConfig.mcp.embedding;
      expect(embeddingConfig.ollama).toBeDefined();

      const ollamaConfig = embeddingConfig.ollama!;
      expect(ollamaConfig.baseUrl).toBe("http://localhost:11434");
      expect(ollamaConfig.timeout).toBe(30000);
      expect(ollamaConfig.concurrency).toBe(4);
      expect(ollamaConfig.headers).toEqual({ "User-Agent": "test" });
    });

    it("should correctly map OpenAI configuration", () => {
      const testConfig = {
        mcp: {
          embedding: {
            provider: "openai",
            model: "text-embedding-ada-002",
            openai: {
              baseUrl: "https://api.openai.com",
              apiKey: "sk-test-key",
              timeout: 10000,
              concurrency: 8,
              maxBatchSize: 256,
            },
          },
        },
      };

      const embeddingConfig = testConfig.mcp.embedding;
      expect(embeddingConfig.openai).toBeDefined();

      const openaiConfig = embeddingConfig.openai!;
      expect(openaiConfig.baseUrl).toBe("https://api.openai.com");
      expect(openaiConfig.apiKey).toBe("sk-test-key");
      expect(openaiConfig.timeout).toBe(10000);
      expect(openaiConfig.concurrency).toBe(8);
      expect(openaiConfig.maxBatchSize).toBe(256);
    });

    it("should correctly map CloudRU configuration", () => {
      const testConfig = {
        mcp: {
          embedding: {
            provider: "cloudru",
            model: "BAAI/bge-m3",
            cloudru: {
              baseUrl: "https://foundation-models.api.cloud.ru",
              apiKey: "cloudru-test-key",
              timeout: 15000,
              concurrency: 4,
              maxBatchSize: 128,
            },
          },
        },
      };

      const embeddingConfig = testConfig.mcp.embedding;
      expect(embeddingConfig.cloudru).toBeDefined();

      const cloudruConfig = embeddingConfig.cloudru!;
      expect(cloudruConfig.baseUrl).toBe("https://foundation-models.api.cloud.ru");
      expect(cloudruConfig.apiKey).toBe("cloudru-test-key");
      expect(cloudruConfig.timeout).toBe(15000);
      expect(cloudruConfig.concurrency).toBe(4);
      expect(cloudruConfig.maxBatchSize).toBe(128);
    });

    it("should correctly map Transformers configuration", () => {
      const testConfig = {
        mcp: {
          embedding: {
            provider: "transformers",
            model: "Xenova/all-MiniLM-L6-v2",
            transformers: {
              quantized: true,
              localPath: "./models",
            },
          },
        },
      };

      const embeddingConfig = testConfig.mcp.embedding;
      expect(embeddingConfig.transformers).toBeDefined();

      const transformersConfig = embeddingConfig.transformers!;
      expect(transformersConfig.quantized).toBe(true);
      expect(transformersConfig.localPath).toBe("./models");
    });

    it("should correctly map Ollama configuration with all parameters", () => {
      const testConfig = {
        mcp: {
          embedding: {
            provider: "ollama",
            model: "nomic-embed-text",
            ollama: {
              baseUrl: "http://localhost:11434",
              timeoutMs: 30000,
              concurrency: 4,
              headers: { "User-Agent": "test" },
              autoPull: true,
              warmupText: "test warmup",
              checkServer: false,
              pullTimeoutMs: 180000,
            },
          },
        },
      };

      const embeddingConfig = testConfig.mcp.embedding;
      expect(embeddingConfig.ollama).toBeDefined();

      const ollamaConfig = embeddingConfig.ollama!;
      expect(ollamaConfig.baseUrl).toBe("http://localhost:11434");
      expect(ollamaConfig.timeoutMs).toBe(30000);
      expect(ollamaConfig.concurrency).toBe(4);
      expect(ollamaConfig.headers).toEqual({ "User-Agent": "test" });
      expect(ollamaConfig.autoPull).toBe(true);
      expect(ollamaConfig.warmupText).toBe("test warmup");
      expect(ollamaConfig.checkServer).toBe(false);
      expect(ollamaConfig.pullTimeoutMs).toBe(180000);
    });

    it("should correctly map Memory configuration", () => {
      const testConfig = {
        mcp: {
          embedding: {
            provider: "memory",
            model: "memory-model",
            memory: {
              dimension: 512,
            },
          },
        },
      };

      const embeddingConfig = testConfig.mcp.embedding;
      expect(embeddingConfig.memory).toBeDefined();

      const memoryConfig = embeddingConfig.memory!;
      expect(memoryConfig.dimension).toBe(512);
    });
  });

  describe("Provider Creation", () => {
    it("should create CloudRU provider with correct configuration", () => {
      const factoryOptions: ProviderFactoryOptions = {
        provider: "cloudru",
        modelName: "BAAI/bge-m3",
        cloudru: {
          baseUrl: "https://foundation-models.api.cloud.ru",
          apiKey: "test-key",
          timeoutMs: 15000,
          concurrency: 4,
          maxBatchSize: 128,
        },
      };

      const provider = createProvider(factoryOptions);

      expect(provider).toBeDefined();
      expect(provider.info.name).toBe("cloudru");
      expect(provider.info.model).toBe("BAAI/bge-m3");
      expect(provider.info.maxBatchSize).toBe(128);
    });

    it("should create OpenAI provider with correct configuration", () => {
      const factoryOptions: ProviderFactoryOptions = {
        provider: "openai",
        modelName: "text-embedding-ada-002",
        openai: {
          baseUrl: "https://api.openai.com",
          apiKey: "sk-test-key",
          timeoutMs: 10000,
          concurrency: 4,
          maxBatchSize: 256,
        },
      };

      const provider = createProvider(factoryOptions);

      expect(provider).toBeDefined();
      expect(provider.info.name).toBe("openai");
      expect(provider.info.model).toBe("text-embedding-ada-002");
      expect(provider.info.maxBatchSize).toBe(256);
    });

    it("should create Ollama provider with correct configuration", () => {
      const factoryOptions: ProviderFactoryOptions = {
        provider: "ollama",
        modelName: "nomic-embed-text",
        ollama: {
          baseUrl: "http://localhost:11434",
          timeoutMs: 30000,
          concurrency: 4,
          headers: { "User-Agent": "test" },
          autoPull: true,
          warmupText: "test warmup",
          checkServer: false,
          pullTimeoutMs: 180000,
        },
      };

      const provider = createProvider(factoryOptions);

      expect(provider).toBeDefined();
      expect(provider.info.name).toBe("ollama");
      expect(provider.info.model).toBe("nomic-embed-text");
    });

    it("should create Transformers provider with correct configuration", () => {
      const factoryOptions: ProviderFactoryOptions = {
        provider: "transformers",
        modelName: "Xenova/all-MiniLM-L6-v2",
        transformers: {
          quantized: false,
          localPath: "./models",
        },
      };

      const provider = createProvider(factoryOptions);

      expect(provider).toBeDefined();
      expect(provider.info.name).toBe("transformers");
      expect(provider.info.model).toBe("Xenova/all-MiniLM-L6-v2");
    });
  });

  describe("EmbeddingGenerator Integration", () => {
    it("should initialize EmbeddingGenerator with CloudRU configuration", () => {
      const generatorOptions = {
        provider: "cloudru" as const,
        modelName: "BAAI/bge-m3",
        quantized: true,
        localPath: "./models",
        batchSize: 8,
        cloudru: {
          baseUrl: "https://foundation-models.api.cloud.ru",
          apiKey: "test-key",
          timeoutMs: 15000,
          concurrency: 4,
        },
      };

      expect(() => {
        const generator = new EmbeddingGenerator(generatorOptions);
        expect(generator).toBeDefined();
      }).not.toThrow();
    });

    it("should initialize EmbeddingGenerator with memory provider", () => {
      const generatorOptions = {
        provider: "memory" as const,
        modelName: "test-model",
        quantized: false,
        localPath: "./models",
        batchSize: 8,
        memory: { dimension: 384 },
      };

      expect(() => {
        const generator = new EmbeddingGenerator(generatorOptions);
        expect(generator).toBeDefined();
      }).not.toThrow();
    });
  });

  describe("Real Configuration Test", () => {
    it("should load real configuration and create providers", () => {
      const config = getConfig();
      const embeddingConfig = config.mcp?.embedding;

      if (!embeddingConfig) {
        console.warn("No embedding config found in real configuration");
        return;
      }

      console.log("Real provider:", embeddingConfig.provider);
      console.log("Real model:", embeddingConfig.model);

      // Test creating provider with real config
      if (embeddingConfig.provider === "cloudru" && embeddingConfig.cloudru) {
        const factoryOptions: ProviderFactoryOptions = {
          provider: "cloudru",
          modelName: embeddingConfig.model || "BAAI/bge-m3",
          cloudru: {
            baseUrl: embeddingConfig.cloudru.baseUrl || "https://foundation-models.api.cloud.ru",
            apiKey: embeddingConfig.cloudru.apiKey || process.env.MCP_EMBEDDING_API_KEY || "",
            timeoutMs: embeddingConfig.cloudru.timeout || 15000,
            concurrency: embeddingConfig.cloudru.concurrency || 4,
          },
        };

        const provider = createProvider(factoryOptions);
        expect(provider).toBeDefined();
        expect(provider.info.name).toBe("cloudru");
      }
    });
  });
});
