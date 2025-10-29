import { extname } from "node:path";

import { getDefaultOptions, type IClone, type IOptions } from "../vendor/jscpd";
import { type EntryWithContent, getFilesToDetect } from "../vendor/jscpd/files";

type NumericOption = number | undefined | null;

export interface JscpdRunOptions {
  paths: string[];
  pattern?: string;
  ignore?: string[];
  formats?: string[];
  minLines?: NumericOption;
  maxLines?: NumericOption;
  minTokens?: NumericOption;
  ignoreCase?: boolean;
}

type StatisticRow = {
  lines: number;
  tokens: number;
  sources: number;
  clones: number;
  duplicatedLines: number;
  duplicatedTokens: number;
  percentage: number;
  percentageTokens: number;
  newDuplicatedLines: number;
  newClones: number;
};

type Statistic = {
  detectionDate: string;
  total: StatisticRow;
  formats: Record<
    string,
    {
      total: StatisticRow;
      sources: Record<string, StatisticRow>;
    }
  >;
};

type TokenLine = {
  text: string;
  line: number;
  startColumn: number;
  endColumn: number;
  startPosition: number;
  endPosition: number;
};

type WindowOccurrence = {
  sourceId: string;
  format: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  startPosition: number;
  endPosition: number;
};

const NEWLINE = /\r?\n/;

const createEmptyStatisticRow = (): StatisticRow => ({
  lines: 0,
  tokens: 0,
  sources: 0,
  clones: 0,
  duplicatedLines: 0,
  duplicatedTokens: 0,
  percentage: 0,
  percentageTokens: 0,
  newDuplicatedLines: 0,
  newClones: 0,
});

const createEmptyStatistic = (): Statistic => ({
  detectionDate: new Date().toISOString(),
  total: createEmptyStatisticRow(),
  formats: {},
});

export function buildJscpdOptions(options: JscpdRunOptions): IOptions {
  const defaults = getDefaultOptions();

  const minTokens = options.minTokens != null ? Number(options.minTokens) : (defaults.minTokens ?? 50);

  return {
    ...defaults,
    path: options.paths.length > 0 ? options.paths : defaults.path,
    pattern: options.pattern ?? defaults.pattern,
    ignore: options.ignore ?? defaults.ignore,
    format: options.formats && options.formats.length > 0 ? options.formats : defaults.format,
    minLines: options.minLines != null ? Number(options.minLines) : defaults.minLines,
    maxLines: options.maxLines != null ? Number(options.maxLines) : defaults.maxLines,
    minTokens: minTokens > 0 ? minTokens : 1,
    ignoreCase: options.ignoreCase ?? defaults.ignoreCase,
    absolute: true,
    silent: true,
  };
}

function normalizeLine(line: string, ignoreCase: boolean): string {
  const normalized = line.replace(/\s+/g, " ").trim();
  return ignoreCase ? normalized.toLowerCase() : normalized;
}

function tokenizeContent(entry: EntryWithContent, options: IOptions): TokenLine[] {
  const lines = entry.content.split(NEWLINE);
  const tokens: TokenLine[] = [];
  let position = 0;

  for (let index = 0; index < lines.length; index++) {
    const original = lines[index] ?? "";
    const normalized = normalizeLine(original, options.ignoreCase ?? false);
    const startColumn = Math.max(original.search(/\S/), 0);
    const endColumn = startColumn >= 0 ? original.length : 0;
    const startPosition = position + Math.max(startColumn, 0);
    const endPosition = position + original.length;

    tokens.push({
      text: normalized,
      line: index + 1,
      startColumn: startColumn >= 0 ? startColumn : 0,
      endColumn,
      startPosition,
      endPosition,
    });

    position += original.length + 1;
  }

  return tokens;
}

function buildStatistic(
  files: Array<{ entry: EntryWithContent; tokens: TokenLine[]; format: string }>,
  clones: IClone[],
): Statistic {
  const statistic = createEmptyStatistic();

  for (const { entry, tokens, format } of files) {
    const fileLines = entry.content.split(NEWLINE).length;
    const fileTokens = tokens.length;

    if (!statistic.formats[format]) {
      statistic.formats[format] = {
        total: createEmptyStatisticRow(),
        sources: {},
      };
    }

    const formatStat = statistic.formats[format];
    const sourceStat = (formatStat.sources[entry.path] ??= createEmptyStatisticRow());

    statistic.total.sources += 1;
    statistic.total.lines += fileLines;
    statistic.total.tokens += fileTokens;

    formatStat.total.sources += 1;
    formatStat.total.lines += fileLines;
    formatStat.total.tokens += fileTokens;

    sourceStat.sources = 1;
    sourceStat.lines += fileLines;
    sourceStat.tokens += fileTokens;
  }

  const accumulateClone = (statRow: StatisticRow, clone: IClone) => {
    const lines = Math.max(
      clone.duplicationA.end.line - clone.duplicationA.start.line,
      clone.duplicationB.end.line - clone.duplicationB.start.line,
      1,
    );
    const tokens =
      clone.duplicationA.range[1] -
      clone.duplicationA.range[0] +
      (clone.duplicationB.range[1] - clone.duplicationB.range[0]);

    statRow.clones += 1;
    statRow.duplicatedLines += lines;
    statRow.newDuplicatedLines += lines;
    statRow.duplicatedTokens += Math.max(tokens, 0);
    statRow.newClones += 1;
  };

  for (const clone of clones) {
    const format = clone.format;
    statistic.total.clones += 1;
    accumulateClone(statistic.total, clone);

    if (!statistic.formats[format]) {
      statistic.formats[format] = {
        total: createEmptyStatisticRow(),
        sources: {},
      };
    }

    const formatStat = statistic.formats[format];
    accumulateClone(formatStat.total, clone);

    const { sourceId: sourceA } = clone.duplicationA;
    const { sourceId: sourceB } = clone.duplicationB;

    if (!formatStat.sources[sourceA]) {
      formatStat.sources[sourceA] = createEmptyStatisticRow();
    }
    if (!formatStat.sources[sourceB]) {
      formatStat.sources[sourceB] = createEmptyStatisticRow();
    }

    accumulateClone(formatStat.sources[sourceA], clone);
    accumulateClone(formatStat.sources[sourceB], clone);
  }

  const calculatePercentage = (duplicated: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((duplicated / total) * 10000) / 100;
  };

  statistic.total.percentage = calculatePercentage(statistic.total.duplicatedLines, statistic.total.lines);
  statistic.total.percentageTokens = calculatePercentage(statistic.total.duplicatedTokens, statistic.total.tokens);

  for (const format of Object.values(statistic.formats)) {
    format.total.percentage = calculatePercentage(format.total.duplicatedLines, format.total.lines);
    format.total.percentageTokens = calculatePercentage(format.total.duplicatedTokens, format.total.tokens);

    for (const source of Object.values(format.sources)) {
      source.percentage = calculatePercentage(source.duplicatedLines, source.lines);
      source.percentageTokens = calculatePercentage(source.duplicatedTokens, source.tokens);
    }
  }

  return statistic;
}

function buildClone(a: WindowOccurrence, b: WindowOccurrence): IClone {
  return {
    format: a.format,
    foundDate: Date.now(),
    duplicationA: {
      sourceId: a.sourceId,
      start: { line: a.startLine, column: a.startColumn, position: a.startPosition },
      end: { line: a.endLine, column: a.endColumn, position: a.endPosition },
      range: [a.startPosition, a.endPosition],
    },
    duplicationB: {
      sourceId: b.sourceId,
      start: { line: b.startLine, column: b.startColumn, position: b.startPosition },
      end: { line: b.endLine, column: b.endColumn, position: b.endPosition },
      range: [b.startPosition, b.endPosition],
    },
  };
}

function slidingWindowOccurrences(tokens: TokenLine[], windowSize: number): Array<[string, WindowOccurrence]> {
  const windows: Array<[string, WindowOccurrence]> = [];

  if (tokens.length < windowSize) {
    return windows;
  }

  for (let index = 0; index <= tokens.length - windowSize; index++) {
    const slice = tokens.slice(index, index + windowSize);
    const key = slice.map((token) => token.text).join("\n");
    const start = slice[0]!;
    const end = slice[slice.length - 1]!;

    windows.push([
      key,
      {
        sourceId: "",
        format: "",
        startLine: start.line,
        endLine: end.line,
        startColumn: start.startColumn,
        endColumn: end.endColumn,
        startPosition: start.startPosition,
        endPosition: end.endPosition,
      },
    ]);
  }

  return windows;
}

function groupOccurrences(
  files: Array<{ entry: EntryWithContent; tokens: TokenLine[]; format: string }>,
  windowSize: number,
): Map<string, WindowOccurrence[]> {
  const map = new Map<string, WindowOccurrence[]>();

  for (const file of files) {
    const windows = slidingWindowOccurrences(file.tokens, windowSize);

    for (const [key, occurrence] of windows) {
      occurrence.sourceId = file.entry.path;
      occurrence.format = file.format;

      const existing = map.get(key);
      if (existing) {
        existing.push(occurrence);
      } else {
        map.set(key, [occurrence]);
      }
    }
  }

  return map;
}

function detectClonePairs(grouped: Map<string, WindowOccurrence[]>): IClone[] {
  const clones: IClone[] = [];

  for (const occurrences of grouped.values()) {
    if (occurrences.length < 2) continue;

    for (let i = 0; i < occurrences.length - 1; i++) {
      for (let j = i + 1; j < occurrences.length; j++) {
        const first = occurrences[i]!;
        const second = occurrences[j]!;
        if (first.sourceId === second.sourceId && first.startLine === second.startLine) {
          continue;
        }
        clones.push(buildClone(first, second));
      }
    }
  }

  return clones;
}

function computeWindowSize(options: IOptions): number {
  const minTokens = options.minTokens ?? 50;
  const minLines = options.minLines ?? 5;
  return Math.max(minTokens, minLines, 1);
}

function determineFormat(path: string): string {
  const ext = extname(path).replace(".", "").toLowerCase();
  return ext || "text";
}

export interface JscpdCloneDetail {
  clone: IClone;
  snippetA: string;
  snippetB: string;
}

export interface JscpdCloneSummary {
  totalLinesAnalyzed: number;
  totalTokensAnalyzed: number;
  duplicatedLines: number;
  duplicatedTokens: number;
  duplicationPercentage: number;
  duplicationTokensPercentage: number;
  cloneCount: number;
  clones: JscpdCloneDetail[];
}

export interface JscpdCloneResult {
  clones: IClone[];
  statistic: Statistic;
  summary: JscpdCloneSummary;
}

export async function runJscpdCloneDetection(options: JscpdRunOptions): Promise<JscpdCloneResult> {
  const jscpdOptions = buildJscpdOptions(options);
  const entries = getFilesToDetect(jscpdOptions);

  if (entries.length === 0) {
    return {
      clones: [],
      statistic: createEmptyStatistic(),
      summary: {
        totalLinesAnalyzed: 0,
        totalTokensAnalyzed: 0,
        duplicatedLines: 0,
        duplicatedTokens: 0,
        duplicationPercentage: 0,
        duplicationTokensPercentage: 0,
        cloneCount: 0,
        clones: [],
      },
    };
  }

  const files = entries.map((entry) => {
    const tokens = tokenizeContent(entry, jscpdOptions);
    const format = determineFormat(entry.path);
    return { entry, tokens, format };
  });

  const windowSize = computeWindowSize(jscpdOptions);
  const grouped = groupOccurrences(files, windowSize);
  const clones = detectClonePairs(grouped);
  const statistic = buildStatistic(files, clones);

  const linesByPath = new Map<string, string[]>();
  for (const { entry } of files) {
    linesByPath.set(entry.path, entry.content.split(NEWLINE));
  }

  const excerpt = (path: string, startLine: number, endLine: number): string => {
    const lines = linesByPath.get(path);
    if (!lines) return "";
    const adjustedStart = Math.max(startLine - 1, 0);
    const adjustedEnd = Math.max(endLine, adjustedStart + 1);
    return lines.slice(adjustedStart, adjustedEnd).join("\n");
  };

  const cloneDetails: JscpdCloneDetail[] = clones.map((clone) => ({
    clone,
    snippetA: excerpt(clone.duplicationA.sourceId, clone.duplicationA.start.line, clone.duplicationA.end.line),
    snippetB: excerpt(clone.duplicationB.sourceId, clone.duplicationB.start.line, clone.duplicationB.end.line),
  }));

  const summary: JscpdCloneSummary = {
    totalLinesAnalyzed: statistic.total.lines,
    totalTokensAnalyzed: statistic.total.tokens,
    duplicatedLines: statistic.total.duplicatedLines,
    duplicatedTokens: statistic.total.duplicatedTokens,
    duplicationPercentage: statistic.total.percentage,
    duplicationTokensPercentage: statistic.total.percentageTokens,
    cloneCount: clones.length,
    clones: cloneDetails,
  };

  return {
    clones,
    statistic,
    summary,
  };
}
