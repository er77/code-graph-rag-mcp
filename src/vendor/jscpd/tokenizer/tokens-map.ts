import { createHash } from "node:crypto";

import type { IMapFrame, IOptions, IToken, ITokensMap } from "../core";

const TOKEN_HASH_LENGTH = 20;

const defaultHash = (value: string): string =>
  createHash("md5").update(value).digest("hex").substring(0, TOKEN_HASH_LENGTH);

export class TokensMap implements ITokensMap, Iterator<IMapFrame | boolean>, Iterable<IMapFrame | boolean> {
  private position = 0;
  private readonly tokenHashes: string[];
  private readonly minTokens: number;

  constructor(
    private readonly id: string,
    private readonly tokens: IToken[],
    private readonly format: string,
    private readonly options: Partial<IOptions>,
  ) {
    const rawMinTokens = options.minTokens ?? 50;
    this.minTokens = rawMinTokens > 0 ? rawMinTokens : 1;
    const hashFn = options.hashFunction ?? defaultHash;
    this.tokenHashes = tokens.map((token) => hashFn(token.type + token.value));
  }

  getTokensCount(): number {
    if (this.tokens.length === 0) return 0;
    const first = this.tokens[0]!;
    const last = this.tokens[this.tokens.length - 1]!;
    const firstLoc = first.loc?.start;
    const lastLoc = last.loc?.end;
    if (!firstLoc || !lastLoc) return 0;
    const startPos = firstLoc.position ?? 0;
    const endPos = lastLoc.position ?? startPos;
    return endPos - startPos;
  }

  getId(): string {
    return this.id;
  }

  getLinesCount(): number {
    if (this.tokens.length === 0) return 0;
    const first = this.tokens[0]!;
    const last = this.tokens[this.tokens.length - 1]!;
    const firstLoc = first.loc?.start;
    const lastLoc = last.loc?.end;
    if (!firstLoc || !lastLoc) return 0;
    return lastLoc.line - firstLoc.line;
  }

  getFormat(): string {
    return this.format;
  }

  [Symbol.iterator](): Iterator<IMapFrame | boolean> {
    return this;
  }

  next(): IteratorResult<IMapFrame | boolean> {
    if (this.tokens.length < this.minTokens || this.position > this.tokens.length - this.minTokens) {
      return {
        done: true,
        value: false,
      };
    }

    if (this.position + this.minTokens - 1 >= this.tokens.length) {
      return {
        done: true,
        value: false,
      };
    }

    const hashSlice = this.tokenHashes.slice(this.position, this.position + this.minTokens).join("");

    const hashFn = this.options.hashFunction ?? defaultHash;
    const mapFrameId = hashFn(hashSlice).substring(0, TOKEN_HASH_LENGTH);

    const startToken = this.tokens[this.position]!;
    const endToken = this.tokens[this.position + this.minTokens - 1]!;
    this.position += 1;

    return {
      done: false,
      value: {
        id: mapFrameId,
        sourceId: this.id,
        start: startToken,
        end: endToken,
      },
    };
  }
}

export function createTokensMaps(
  id: string,
  tokens: IToken[],
  format: string,
  options: Partial<IOptions>,
): TokensMap[] {
  if (!tokens.length) return [];
  return [new TokensMap(id, tokens, format, options)];
}
