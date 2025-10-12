import type { EmbeddingProvider, EmbedOptions, ProviderInfo } from "./base.js";

export interface MemoryOptions {
  dimension?: number;
}

const DEFAULT_DIM = 384;

function hash32(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

export class MemoryProvider implements EmbeddingProvider {
  public info: ProviderInfo;

  constructor(opts: MemoryOptions = {}) {
    const dimension = opts?.dimension ?? DEFAULT_DIM;
    this.info = {
      name: "memory",
      model: "deterministic-hash",
      dimension,
      supportsBatch: true,
    };
  }

  async initialize(): Promise<void> {}

  getDimension(): number | undefined {
    return this.info.dimension;
  }

  private generate(text: string): Float32Array {
    const dim = this.info.dimension ?? DEFAULT_DIM;
    const embedding = new Float32Array(dim);
    let state = hash32(text) || 1;
    for (let i = 0; i < dim; i++) {
      state = (state * 1664525 + 1013904223) >>> 0;
      embedding[i] = state / 0xffffffff - 0.5;
    }
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      const v = embedding[i] ?? 0;
      norm += v * v;
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) {
      const v = embedding[i] ?? 0;
      embedding[i] = v / norm;
    }
    return embedding;
  }

  async embed(text: string, _opts?: EmbedOptions): Promise<Float32Array> {
    return this.generate(text);
  }

  async embedBatch(texts: string[], _opts?: EmbedOptions): Promise<Float32Array[]> {
    return texts.map((t) => this.generate(t));
  }

  async close(): Promise<void> {}
}
