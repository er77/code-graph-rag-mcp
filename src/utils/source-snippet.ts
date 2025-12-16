export type SourceSnippetResult = {
  snippet: string;
  snippetRange: { startLine: number; endLine: number };
  entityRange: { startLine: number; endLine: number };
  truncated: boolean;
};

export function extractSourceSnippetFromText(params: {
  text: string;
  startLine: number;
  endLine: number;
  contextLines?: number;
  maxBytes?: number;
}): SourceSnippetResult {
  const { text } = params;
  const contextLines = Math.max(0, Math.min(200, Number(params.contextLines ?? 5) || 0));
  const maxBytes = Math.max(1024, Math.min(512_000, Number(params.maxBytes ?? 64_000) || 64_000));

  const lines = text.split(/\r?\n/);
  const totalLines = lines.length;

  const entityStart = Math.max(1, Math.min(totalLines, Number(params.startLine) || 1));
  const entityEnd = Math.max(entityStart, Math.min(totalLines, Number(params.endLine) || entityStart));

  const snippetStart = Math.max(1, entityStart - contextLines);
  const snippetEnd = Math.min(totalLines, entityEnd + contextLines);

  const rawSnippet = lines.slice(snippetStart - 1, snippetEnd).join("\n");
  const rawBytes = Buffer.byteLength(rawSnippet, "utf8");

  if (rawBytes <= maxBytes) {
    return {
      snippet: rawSnippet,
      snippetRange: { startLine: snippetStart, endLine: snippetEnd },
      entityRange: { startLine: entityStart, endLine: entityEnd },
      truncated: false,
    };
  }

  const truncatedText = rawSnippet.slice(0, maxBytes);
  return {
    snippet: truncatedText,
    snippetRange: { startLine: snippetStart, endLine: snippetEnd },
    entityRange: { startLine: entityStart, endLine: entityEnd },
    truncated: true,
  };
}
