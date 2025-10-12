import type { EmbeddingProvider, EmbedOptions, ProviderInfo, ProviderLogger } from "./base.js";

export interface OllamaOptions {
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  concurrency?: number;
  headers?: Record<string, string>;
  autoPull?: boolean;
  warmupText?: string;
  checkServer?: boolean;
  pullTimeoutMs?: number;
  logger?: ProviderLogger;
}

export class OllamaProvider implements EmbeddingProvider {
  public info: ProviderInfo;
  private baseUrl: string;
  private timeoutMs: number;
  private pullTimeoutMs: number;
  private concurrency: number;
  private headers: Record<string, string>;
  private opts: Required<Pick<OllamaOptions, "autoPull" | "warmupText" | "checkServer">>;
  private log?: ProviderLogger;

  constructor(opts: OllamaOptions) {
    this.log = opts.logger;
    this.baseUrl = opts.baseUrl ?? "http://127.0.0.1:11434";
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.pullTimeoutMs = opts.pullTimeoutMs ?? 120_000;
    this.concurrency = Math.max(1, opts.concurrency ?? 4);
    this.headers = {
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    };
    this.opts = {
      autoPull: opts.autoPull !== false,
      warmupText: opts.warmupText ?? "warm up",
      checkServer: opts.checkServer !== false,
    };

    this.info = {
      name: "ollama",
      model: opts.model,
      supportsBatch: false,
    };
  }

  async initialize(): Promise<void> {
    this.log?.info("initialize", {
      model: this.info.model,
      baseUrl: this.baseUrl,
      timeoutMs: this.timeoutMs,
      concurrency: this.concurrency,
    });

    if (this.opts.checkServer) {
      await this.checkServerAvailability();
    }
    try {
      const vec = await this.embed(this.opts.warmupText);
      this.info.dimension = vec.length;
      this.log?.info("initialized", { dimension: this.info.dimension });
    } catch (e: any) {
      if (this.opts.autoPull && this.isModelMissingError(e)) {
        this.log?.info("model not found, pulling", { model: this.info.model });
        await this.pullModel();
        const vec = await this.embed(this.opts.warmupText);
        this.info.dimension = vec.length;
        this.log?.info("initialized after pull", { dimension: this.info.dimension });
        return;
      }
      this.log?.error("initialize failed", { error: e.message }, undefined, e);
      throw e;
    }
  }

  getDimension(): number | undefined {
    return this.info.dimension;
  }

  private isModelMissingError(e: unknown): boolean {
    const msg = (e as any)?.message?.toLowerCase?.() ?? String(e).toLowerCase();
    return (
      msg.includes("model not found") ||
      msg.includes("no such model") ||
      (msg.includes("not found") && msg.includes(this.info.model.toLowerCase()))
    );
  }

  private async checkServerAvailability(): Promise<void> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 5000));
    try {
      const res = await fetch(`${this.baseUrl}/api/version`, { method: "GET", signal: controller.signal });
      if (!res.ok) {
        const tags = await fetch(`${this.baseUrl}/api/tags`, { method: "GET", signal: controller.signal }).catch(
          () => null,
        );
        if (!tags || !tags.ok) {
          throw new Error(`Ollama server is not reachable: HTTP ${res.status}`);
        }
      }
    } catch (e) {
      throw new Error(`Ollama server check failed: ${(e as Error).message}`);
    } finally {
      clearTimeout(id);
    }
  }

  private async pullModel(): Promise<void> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.pullTimeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/pull`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ name: this.info.model }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Ollama pull failed HTTP ${res.status}: ${body}`);
      }

      const reader = res.body?.getReader?.();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } else {
        await res.arrayBuffer().catch(() => undefined);
      }
    } catch (e) {
      throw new Error(`Ollama pull error: ${(e as Error).message}`);
    } finally {
      clearTimeout(id);
    }
  }

  async embed(text: string, opts?: EmbedOptions): Promise<Float32Array> {
    this.log?.debug("embed()", { len: text?.length }, opts?.requestId);

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ model: this.info.model, prompt: text }),
        signal: opts?.signal ?? controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Ollama HTTP ${res.status}: ${body}`);
      }

      const json: any = await res.json();
      if (!json || !Array.isArray(json.embedding)) {
        throw new Error("Ollama invalid response: missing embedding array");
      }

      const arr = new Float32Array(json.embedding);
      this.info.dimension = this.info.dimension ?? arr.length;
      return arr;
    } finally {
      clearTimeout(id);
    }
  }

  async embedBatch(texts: string[], opts?: EmbedOptions): Promise<Float32Array[]> {
    this.log?.debug("embedBatch()", { count: texts.length }, opts?.requestId);

    const pLimit = (await import("p-limit")).default;
    const limit = pLimit(this.concurrency);
    return Promise.all(texts.map((t) => limit(() => this.embed(t, opts))));
  }
}
