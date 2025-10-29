import type { IOptions, IToken, ITokenizer, ITokensMap } from "../core";
import { createTokensMaps } from "./tokens-map";

type ModeHandler = (token: IToken, options?: Partial<IOptions>) => boolean;

const NEWLINE = /\r?\n/;

function classifyToken(value: string): { type: string; normalized: string } {
  const trimmed = value.trim();
  if (!trimmed.length) {
    return { type: "empty", normalized: "" };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("//") ||
    lower.startsWith("#") ||
    lower.startsWith("/*") ||
    lower.startsWith("*") ||
    lower.startsWith("--")
  ) {
    return { type: "comment", normalized: trimmed };
  }

  return { type: "code", normalized: trimmed };
}

function ensureMode(mode: IOptions["mode"]): ModeHandler {
  if (typeof mode === "function") {
    return mode as ModeHandler;
  }
  return (token: IToken): boolean => token.type !== "ignore";
}

export class SimpleTokenizer implements ITokenizer {
  generateMaps(id: string, data: string, format: string, options: Partial<IOptions>): ITokensMap[] {
    const lines = data.split(NEWLINE);
    const tokens: IToken[] = [];
    let cursor = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const length = line.length;
      const { type, normalized } = classifyToken(line);

      const token: IToken = {
        type,
        value: options.ignoreCase ? normalized.toLowerCase() : normalized,
        length,
        format,
        range: [cursor, cursor + length],
        loc: {
          start: { line: i + 1, column: 0, position: cursor },
          end: { line: i + 1, column: length, position: cursor + length },
        },
      };

      tokens.push(token);
      cursor += length + 1; // account for newline
    }

    const mode = ensureMode(options.mode);
    const filtered = tokens.filter((token) => mode(token, options));

    const minTokens = options.minTokens ?? 50;
    if (filtered.length < minTokens) {
      return [];
    }

    return createTokensMaps(id, filtered, format, options);
  }
}
