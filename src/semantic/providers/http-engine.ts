import pLimit from "p-limit";

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: string,
  ) {
    super(`HTTP ${status} ${statusText}${body ? `: ${body.slice(0, 300)}` : ""}`);
  }
}

export interface HttpEngineOptions {
  baseUrl: string;
  timeoutMs?: number;
  concurrency?: number;
  maxRetries?: number;
  backoffMs?: number;
  defaultHeaders?: Record<string, string>;
}

export interface RequestConfig<TBody = any> {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  buildBody?: (input: any) => TBody;
}

export class HttpEngine {
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private backoffMs: number;
  private defaultHeaders: Record<string, string>;
  private limit: ReturnType<typeof pLimit>;

  constructor(opts: HttpEngineOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? 10000;
    this.maxRetries = Math.max(0, opts.maxRetries ?? 2);
    this.backoffMs = opts.backoffMs ?? 200;
    this.defaultHeaders = opts.defaultHeaders ?? { "Content-Type": "application/json" };
    this.limit = pLimit(Math.max(1, opts.concurrency ?? 4));
  }

  private async fetchWithRetry(path: string, init: RequestInit): Promise<Response> {
    let attempt = 0;
    const url = `${this.baseUrl}${path}`;

    while (true) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url, {
          ...init,
          signal: init.signal ?? controller.signal,
        });

        if (res.ok) return res;

        if ((res.status === 429 || (res.status >= 500 && res.status < 600)) && attempt < this.maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, this.backoffMs * attempt));
          continue;
        }

        const body = await res.text().catch(() => "");
        throw new HttpError(res.status, res.statusText, body);
      } catch (err) {
        if (attempt < this.maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, this.backoffMs * attempt));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(id);
      }
    }
  }

  async callSingle<TParsed = any>(
    config: RequestConfig,
    input: any,
    parser: (json: any) => TParsed,
    opts?: { signal?: AbortSignal },
  ): Promise<TParsed> {
    return this.limit(async () => {
      const body = config.buildBody ? config.buildBody(input) : input;
      const headers = { ...this.defaultHeaders, ...(config.headers ?? {}) };

      const init: RequestInit = {
        method: config.method ?? "POST",
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: opts?.signal,
      };

      const res = await this.fetchWithRetry(config.path, init);
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      return parser(json);
    });
  }

  async callBatch<TParsed = any>(
    config: RequestConfig,
    inputs: any[],
    parseSingle: (json: any) => TParsed,
    opts?: { signal?: AbortSignal },
  ): Promise<TParsed[]> {
    return Promise.all(inputs.map((input) => this.callSingle(config, input, parseSingle, opts)));
  }
}
