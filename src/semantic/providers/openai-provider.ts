import type { EmbeddingProvider, EmbedOptions, ProviderInfo, ProviderLogger } from "./base.js";
import { createHttpEmbeddingMethods } from "./http-embedding-helpers.js";
import { HttpEngine } from "./http-engine.js";

export interface OpenAIOptions {
  baseUrl?: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  concurrency?: number;
  dimensions?: number;
  maxBatchSize?: number;
  logger?: ProviderLogger;
}

export class OpenAIProvider implements EmbeddingProvider {
  public info: ProviderInfo;
  private engine: HttpEngine;
  private opts: OpenAIOptions;
  private log?: ProviderLogger;
  private embedMethods: ReturnType<typeof createHttpEmbeddingMethods>;

  constructor(opts: OpenAIOptions) {
    this.opts = { baseUrl: "https://api.openai.com", ...opts };
    this.log = opts.logger;

    this.info = {
      name: "openai",
      model: opts.model,
      supportsBatch: true,
      maxBatchSize: opts.maxBatchSize,
    };

    this.engine = new HttpEngine({
      baseUrl: this.opts.baseUrl!,
      timeoutMs: this.opts.timeoutMs ?? 10000,
      concurrency: this.opts.concurrency ?? 4,
      defaultHeaders: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
    });

    this.embedMethods = createHttpEmbeddingMethods({
      engine: this.engine,
      request: { path: "/v1/embeddings", buildBody: this.buildBody },
      parseSingle: this.parseSingle,
      parseBatch: this.parseBatch,
      maxBatchSize: this.info.maxBatchSize,
      logger: this.log,
    });
  }

  async initialize(): Promise<void> {}

  getDimension(): number | undefined {
    return this.info.dimension;
  }

  private buildBody = (input: string | string[]) => {
    const body: any = { model: this.info.model, input };
    if (this.opts.dimensions) body.dimensions = this.opts.dimensions;
    return body;
  };

  private parseSingle = (json: any): Float32Array => {
    if (!json || !Array.isArray(json.data) || !Array.isArray(json.data[0]?.embedding)) {
      throw new Error("OpenAI invalid embedding response");
    }
    const arr = new Float32Array(json.data[0].embedding);
    this.info.dimension = this.info.dimension ?? arr.length;
    return arr;
  };

  private parseBatch = (json: any): Float32Array[] => {
    if (!json || !Array.isArray(json.data)) throw new Error("OpenAI invalid batch response");
    const out = json.data.map((d: any) => new Float32Array(d.embedding));
    if (!this.info.dimension && out[0]) this.info.dimension = out[0].length;
    return out;
  };

  async embed(text: string, opts?: EmbedOptions): Promise<Float32Array> {
    return this.embedMethods.embed(text, opts);
  }

  async embedBatch(texts: string[], opts?: EmbedOptions): Promise<Float32Array[]> {
    return this.embedMethods.embedBatch(texts, opts);
  }

  async close(): Promise<void> {}
}
