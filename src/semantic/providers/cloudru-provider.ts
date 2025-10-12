import type { EmbeddingProvider, EmbedOptions, ProviderInfo, ProviderLogger } from "./base.js";
import { HttpEngine } from "./http-engine.js";

export interface CloudRUOptions {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  concurrency?: number;
  maxBatchSize?: number;
  logger?: ProviderLogger;
}

export class CloudRUProvider implements EmbeddingProvider {
  public info: ProviderInfo;
  private engine: HttpEngine;
  private opts: CloudRUOptions;
  private log?: ProviderLogger;

  constructor(opts: CloudRUOptions) {
    this.opts = { baseUrl: "https://foundation-models.api.cloud.ru", ...opts };
    this.log = opts.logger;

    this.info = {
      name: "cloudru",
      model: opts.model,
      supportsBatch: true,
      maxBatchSize: opts.maxBatchSize,
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.opts.apiKey) headers["Authorization"] = `Bearer ${this.opts.apiKey}`;

    this.engine = new HttpEngine({
      baseUrl: this.opts.baseUrl ?? "https://foundation-models.api.cloud.ru",
      timeoutMs: this.opts.timeoutMs ?? 10000,
      concurrency: this.opts.concurrency ?? 4,
      defaultHeaders: headers,
    });
  }

  async initialize(): Promise<void> {
    this.log?.info("initialize", {
      model: this.info.model,
      baseUrl: this.opts.baseUrl,
      apiKey: !!this.opts.apiKey,
    });
  }

  getDimension(): number | undefined {
    return this.info.dimension;
  }

  private buildBody = (input: string | string[]) => ({ model: this.info.model, input });

  private parseSingle(json: any): Float32Array {
    if (Array.isArray(json?.data) && Array.isArray(json.data[0]?.embedding)) {
      const arr = new Float32Array(json.data[0].embedding);
      this.info.dimension = this.info.dimension ?? arr.length;
      return arr;
    }
    if (Array.isArray(json?.embedding)) {
      const arr = new Float32Array(json.embedding);
      this.info.dimension = this.info.dimension ?? arr.length;
      return arr;
    }
    if (json?.error) throw new Error(`CloudRU error: ${JSON.stringify(json.error)}`);
    throw new Error(`CloudRU invalid embedding response`);
  }

  private parseBatch(json: any): Float32Array[] {
    if (Array.isArray(json?.data)) {
      const out = json.data.map((d: any) => new Float32Array(d.embedding));
      if (!this.info.dimension && out[0]) this.info.dimension = out[0].length;
      return out;
    }
    if (Array.isArray(json?.embedding) && Array.isArray(json.embedding[0])) {
      const out = json.embedding.map((e: any) => new Float32Array(e));
      if (!this.info.dimension && out[0]) this.info.dimension = out[0].length;
      return out;
    }
    throw new Error("CloudRU invalid batch embedding response");
  }

  async embed(text: string, opts?: EmbedOptions): Promise<Float32Array> {
    this.log?.debug("embed()", { len: text?.length }, opts?.requestId);
    return this.engine.callSingle(
      { path: "/v1/embeddings", buildBody: this.buildBody },
      text,
      (j) => this.parseSingle(j),
      { signal: opts?.signal },
    );
  }

  async embedBatch(texts: string[], opts?: EmbedOptions): Promise<Float32Array[]> {
    this.log?.debug("embedBatch()", { count: texts.length }, opts?.requestId);

    const size = this.info.maxBatchSize ?? texts.length;
    if (size < texts.length) {
      const chunks: string[][] = [];
      for (let i = 0; i < texts.length; i += size) {
        chunks.push(texts.slice(i, i + size));
      }
      const parts = await Promise.all(
        chunks.map((c) =>
          this.engine.callSingle({ path: "/v1/embeddings", buildBody: this.buildBody }, c, (j) => this.parseBatch(j), {
            signal: opts?.signal,
          }),
        ),
      );
      return parts.flat();
    }

    try {
      return await this.engine.callSingle(
        { path: "/v1/embeddings", buildBody: this.buildBody },
        texts,
        (j) => this.parseBatch(j),
        { signal: opts?.signal },
      );
    } catch {
      return this.engine.callBatch(
        { path: "/v1/embeddings", buildBody: this.buildBody },
        texts,
        (j) => this.parseSingle(j),
        { signal: opts?.signal },
      );
    }
  }

  async close(): Promise<void> {}
}
