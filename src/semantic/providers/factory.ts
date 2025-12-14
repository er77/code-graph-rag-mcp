import type {
  CloudRUProviderConfig,
  MemoryProviderConfig,
  OllamaProviderConfig,
  OpenAIProviderConfig,
} from "../../types/semantic.js";
import { logger as appLogger } from "../../utils/logger.js";
import { makeProviderLogger } from "../../utils/provider-logger.js";
import type { EmbeddingProvider, ProviderKind } from "./base.js";
import { CloudRUProvider } from "./cloudru-provider.js";
import { MemoryProvider } from "./memory-provider.js";
import { OllamaProvider } from "./ollama-provider.js";
import { OpenAIProvider } from "./openai-provider.js";
import { TransformersProvider } from "./transformers-provider.js";

export interface ProviderFactoryOptions {
  provider: ProviderKind;
  modelName: string;
  transformers?: { quantized?: boolean; localPath?: string };
  ollama?: OllamaProviderConfig;
  memory?: MemoryProviderConfig;
  openai?: OpenAIProviderConfig;
  cloudru?: CloudRUProviderConfig;
}

export function createProvider(opts: ProviderFactoryOptions): EmbeddingProvider {
  switch (opts.provider) {
    case "transformers":
      return new TransformersProvider({
        model: opts.modelName,
        quantized: opts.transformers?.quantized,
        localPath: opts.transformers?.localPath,
        logger: makeProviderLogger(appLogger, "PROVIDER_TRANSFORMERS"),
      });

    case "ollama":
      return new OllamaProvider({
        model: opts.modelName,
        baseUrl: opts.ollama?.baseUrl,
        timeoutMs: opts.ollama?.timeoutMs,
        concurrency: opts.ollama?.concurrency,
        headers: opts.ollama?.headers,
        autoPull: opts.ollama?.autoPull,
        warmupText: opts.ollama?.warmupText,
        checkServer: opts.ollama?.checkServer,
        pullTimeoutMs: opts.ollama?.pullTimeoutMs,
        logger: makeProviderLogger(appLogger, "PROVIDER_OLLAMA"),
      });

    case "openai":
      if (!opts.openai?.apiKey) throw new Error("OpenAI apiKey is required");
      return new OpenAIProvider({
        model: opts.modelName,
        apiKey: opts.openai.apiKey,
        baseUrl: opts.openai.baseUrl,
        timeoutMs: opts.openai.timeoutMs,
        concurrency: opts.openai.concurrency,
        dimensions: opts.openai.dimensions,
        maxBatchSize: opts.openai.maxBatchSize,
        logger: makeProviderLogger(appLogger, "PROVIDER_OPENAI"),
      });

    case "cloudru":
      return new CloudRUProvider({
        model: opts.modelName,
        apiKey: opts.cloudru?.apiKey,
        baseUrl: opts.cloudru?.baseUrl,
        timeoutMs: opts.cloudru?.timeoutMs,
        concurrency: opts.cloudru?.concurrency,
        maxBatchSize: opts.cloudru?.maxBatchSize,
        logger: makeProviderLogger(appLogger, "PROVIDER_CLOUDRU"),
      });
    default:
      return new MemoryProvider({ dimension: opts.memory?.dimension });
  }
}
