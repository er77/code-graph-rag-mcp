import { readFile } from "node:fs/promises";
import type { GraphStorageImpl } from "../storage/graph-storage.js";
import type { Entity } from "../types/storage.js";
import { extractSourceSnippetFromText } from "../utils/source-snippet.js";

export type GetEntitySourceResult = {
  entity: Entity;
  filePath: string;
  entityRange: { startLine: number; endLine: number };
  snippetRange: { startLine: number; endLine: number };
  snippet: string;
  truncated: boolean;
};

export async function getEntitySource(options: {
  storage: GraphStorageImpl;
  entity: Entity;
  filePath: string;
  contextLines?: number;
  maxBytes?: number;
}): Promise<GetEntitySourceResult> {
  const { storage: _storage, entity, filePath, contextLines, maxBytes } = options;
  const text = await readFile(filePath, "utf8");

  const startLine = Number((entity as any).location?.start?.line ?? 1) || 1;
  const endLine = Number((entity as any).location?.end?.line ?? startLine) || startLine;
  const extracted = extractSourceSnippetFromText({
    text,
    startLine,
    endLine,
    contextLines,
    maxBytes,
  });

  return {
    entity,
    filePath,
    entityRange: extracted.entityRange,
    snippetRange: extracted.snippetRange,
    snippet: extracted.snippet,
    truncated: extracted.truncated,
  };
}
