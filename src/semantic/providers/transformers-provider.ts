import type { EmbeddingProvider, EmbedOptions, ProviderInfo, ProviderLogger } from "./base.js";

export interface TransformersOptions {
  model: string; //'Xenova/all-MiniLM-L6-v2'
  quantized?: boolean;
  localPath?: string;
  logger?: ProviderLogger;
}

export class TransformersProvider implements EmbeddingProvider {
  public info: ProviderInfo;
  private pipeline: any | null = null;
  private log?: ProviderLogger;

  constructor(private opts: TransformersOptions) {
    this.log = opts.logger;
    this.info = {
      name: "transformers",
      model: opts.model,
      supportsBatch: true,
    };
  }

  async initialize(): Promise<void> {
    this.log?.info("initialize", {
      model: this.opts.model,
      quantized: this.opts.quantized,
      localPath: this.opts.localPath,
    });

    const mod: any = await import("@xenova/transformers");
    const pipeFactory = mod.pipeline as (task: string, model: string, options?: any) => Promise<any>;

    this.pipeline = await pipeFactory("feature-extraction", this.opts.model, {
      quantized: this.opts.quantized !== false,
      progress_callback: undefined,
      local_files_only: !!this.opts.localPath,
    });

    const out = await this.pipeline("warm up", { pooling: "mean", normalize: true });
    this.info.dimension = out?.data?.length ?? this.info.dimension;

    this.log?.info("initialized", { dimension: this.info.dimension });
  }

  getDimension(): number | undefined {
    return this.info.dimension;
  }

  async embed(text: string, opts?: EmbedOptions): Promise<Float32Array> {
    this.log?.debug("embed()", { len: text?.length }, opts?.requestId);

    if (!this.pipeline) await this.initialize();
    const out = await this.pipeline?.(text, { pooling: "mean", normalize: true });
    const arr = new Float32Array(out.data);
    this.info.dimension = this.info.dimension ?? arr.length;
    return arr;
  }

  async embedBatch(texts: string[], opts?: EmbedOptions): Promise<Float32Array[]> {
    this.log?.debug("embedBatch()", { count: texts.length }, opts?.requestId);

    if (!this.pipeline) await this.initialize();
    const outs = await Promise.all(texts.map((t) => this.pipeline?.(t, { pooling: "mean", normalize: true })));
    return outs.map((o) => new Float32Array(o.data));
  }

  async close(): Promise<void> {
    try {
      (this.pipeline as any)?.dispose?.();
    } catch {}
    this.pipeline = null;
  }
}
