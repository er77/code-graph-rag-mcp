import type { EmbedOptions, ProviderLogger } from "./base.js";
import type { HttpEngine, RequestConfig } from "./http-engine.js";

function chunkArray<T>(items: T[], size: number): T[][] {
  const safeSize = Math.max(1, size);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    out.push(items.slice(i, i + safeSize));
  }
  return out;
}

export async function embedSingleWithEngine(
  engine: HttpEngine,
  request: RequestConfig,
  text: string,
  parseSingle: (json: any) => Float32Array,
  opts?: EmbedOptions,
): Promise<Float32Array> {
  return engine.callSingle(request, text, parseSingle, { signal: opts?.signal });
}

export async function embedBatchWithEngine(
  engine: HttpEngine,
  request: RequestConfig,
  texts: string[],
  parseBatch: (json: any) => Float32Array[],
  parseSingle: (json: any) => Float32Array,
  maxBatchSize: number | undefined,
  opts?: EmbedOptions,
): Promise<Float32Array[]> {
  const size = Math.max(1, maxBatchSize ?? texts.length);

  if (size < texts.length) {
    const parts = await Promise.all(
      chunkArray(texts, size).map((c) => engine.callSingle(request, c, parseBatch, { signal: opts?.signal })),
    );
    return parts.flat();
  }

  try {
    return await engine.callSingle(request, texts, parseBatch, { signal: opts?.signal });
  } catch {
    return engine.callBatch(request, texts, parseSingle, { signal: opts?.signal });
  }
}

export function createHttpEmbeddingMethods(params: {
  engine: HttpEngine;
  request: RequestConfig;
  parseSingle: (json: any) => Float32Array;
  parseBatch: (json: any) => Float32Array[];
  maxBatchSize?: number;
  logger?: ProviderLogger;
}) {
  const { engine, request, parseSingle, parseBatch, maxBatchSize, logger } = params;

  return {
    embed(text: string, opts?: EmbedOptions): Promise<Float32Array> {
      logger?.debug("embed()", { len: text?.length }, opts?.requestId);
      return embedSingleWithEngine(engine, request, text, parseSingle, opts);
    },
    embedBatch(texts: string[], opts?: EmbedOptions): Promise<Float32Array[]> {
      logger?.debug("embedBatch()", { count: texts.length }, opts?.requestId);
      return embedBatchWithEngine(engine, request, texts, parseBatch, parseSingle, maxBatchSize, opts);
    },
  };
}
