import { basename } from "node:path";
import type { EntityRelationship, ParsedEntity } from "../types/parser.js";

function computeLineStartIndices(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function locationForLine(lineStarts: number[], line: number, lineText: string) {
  const startIdx = lineStarts[Math.max(0, line - 1)] ?? 0;
  const endIdx = startIdx + lineText.length;
  return {
    start: { line, column: 0, index: startIdx },
    end: { line, column: Math.max(0, lineText.length), index: endIdx },
  };
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export class MarkdownAnalyzer {
  analyze(content: string, filePath: string): { entities: ParsedEntity[]; relationships: EntityRelationship[] } {
    const entities: ParsedEntity[] = [];
    const relationships: EntityRelationship[] = [];

    const lines = content.split(/\r?\n/);
    const lineStarts = computeLineStartIndices(content);

    const docId = `${filePath}:document`;
    entities.push({
      id: docId,
      name: basename(filePath),
      type: "document",
      filePath,
      location: {
        start: { line: 1, column: 0, index: 0 },
        end: { line: Math.max(1, lines.length), column: 0, index: content.length },
      },
      metadata: { language: "markdown" },
    } as any);

    const headingStack: Array<{ id: string; level: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i] ?? "";
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (!match) continue;

      const level = match[1]!.length;
      const title = match[2]!;
      const slug = slugify(title) || `heading-${lineNum}`;
      const headingId = `${filePath}:heading:${slug}:${lineNum}`;

      entities.push({
        id: headingId,
        name: title,
        type: "heading",
        filePath,
        location: locationForLine(lineStarts, lineNum, line),
        metadata: { level, slug, language: "markdown" },
      } as any);

      while (headingStack.length && headingStack[headingStack.length - 1]!.level >= level) {
        headingStack.pop();
      }

      const parentId = headingStack.length ? headingStack[headingStack.length - 1]!.id : docId;
      relationships.push({
        from: parentId,
        to: headingId,
        type: "contains",
        metadata: { line: lineNum, confidence: 1, isDirectRelation: true },
      });

      headingStack.push({ id: headingId, level });
    }

    return { entities, relationships };
  }
}
