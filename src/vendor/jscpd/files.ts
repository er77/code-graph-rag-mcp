import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, join, posix, resolve } from "node:path";

import type { IOptions } from "./core";

export interface EntryWithContent {
  path: string;
  content: string;
}

type GlobFilter = (relativePath: string) => boolean;

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/([.+^${}()|[\]\\])/g, "\\$1");
  const replaced = escaped
    .replace(/\*\*/g, "§§DOUBLE_STAR§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§DOUBLE_STAR§§/g, ".*");
  return new RegExp(`^${replaced}$`);
}

function buildGlobFilter(patterns: string[] | undefined): GlobFilter {
  if (!patterns || patterns.length === 0) {
    return () => true;
  }

  const regexes = patterns.map((pattern) => globToRegex(pattern));
  return (filePath: string) => regexes.some((regex) => regex.test(filePath));
}

function buildIgnoreFilter(patterns: string[] | undefined): GlobFilter {
  if (!patterns || patterns.length === 0) {
    return () => false;
  }

  const regexes = patterns.map((pattern) => globToRegex(pattern));
  return (filePath: string) => regexes.some((regex) => regex.test(filePath));
}

function parseSize(limit: string | undefined): number | undefined {
  if (!limit) return undefined;
  const match = /^\s*(\d+)(kb|mb|gb)?\s*$/i.exec(limit);
  if (!match) return undefined;

  const value = Number(match[1]);
  const unitMatch = typeof match[2] === "string" ? match[2] : undefined;
  const unit = (unitMatch ?? "kb").toLowerCase();

  const units: Record<string, number> = {
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const supportedUnits = new Set(["kb", "mb", "gb"]);
  const normalizedUnit = supportedUnits.has(unit) ? (unit as "kb" | "mb" | "gb") : "kb";
  const multiplier = (units[normalizedUnit] ?? units.kb) as number;
  return value * multiplier;
}

function withinLineBounds(content: string, options: IOptions): boolean {
  const lines = content.split(/\r?\n/).length;
  const minLines = options.minLines ?? 0;
  const maxLines = options.maxLines ?? Number.MAX_SAFE_INTEGER;
  return lines >= minLines && lines <= maxLines;
}

function formatAllowed(path: string, options: IOptions): boolean {
  if (!options.format || options.format.length === 0) return true;
  const extension = basename(path).split(".").pop();
  if (!extension) return false;
  return options.format.includes(extension.toLowerCase());
}

function collectFromDirectory(
  root: string,
  relativeDir: string,
  include: GlobFilter,
  ignore: GlobFilter,
  followSymlinks: boolean,
  entries: string[],
) {
  const absoluteDir = relativeDir ? join(root, relativeDir) : root;
  const dirEntries = readdirSync(absoluteDir, { withFileTypes: true });

  for (const entry of dirEntries) {
    const entryRelative = relativeDir ? join(relativeDir, entry.name) : entry.name;
    const posixRelative = posix.normalize(entryRelative.split("\\").join("/"));

    if (!followSymlinks && entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      collectFromDirectory(root, entryRelative, include, ignore, followSymlinks, entries);
      continue;
    }

    if (!entry.isFile()) continue;

    if (!include(posixRelative) || ignore(posixRelative)) {
      continue;
    }

    entries.push(join(root, entryRelative));
  }
}

function listMatchingFiles(
  paths: string[],
  pattern: string | undefined,
  ignore: string[] | undefined,
  followSymlinks: boolean,
): string[] {
  const includeGlob = pattern ? buildGlobFilter([pattern]) : () => true;
  const ignoreGlob = buildIgnoreFilter(ignore);

  const results: string[] = [];

  for (const rootPath of paths) {
    const absoluteRoot = isAbsolute(rootPath) ? rootPath : resolve(rootPath);
    const stats = statSync(absoluteRoot, { throwIfNoEntry: false });
    if (!stats) continue;

    if (stats.isFile()) {
      const rel = basename(absoluteRoot);
      if (includeGlob(rel) && !ignoreGlob(rel)) {
        results.push(absoluteRoot);
      }
      continue;
    }

    if (stats.isDirectory()) {
      collectFromDirectory(absoluteRoot, "", includeGlob, ignoreGlob, followSymlinks, results);
    }
  }

  return results;
}

export function getFilesToDetect(options: IOptions): EntryWithContent[] {
  const roots = options.path && options.path.length > 0 ? options.path : [process.cwd()];
  const followSymlinks = !(options.noSymlinks ?? false);
  const maxSize = parseSize(options.maxSize);

  const files = listMatchingFiles(roots, options.pattern, options.ignore, followSymlinks);

  return files
    .map((path) => {
      const stats = statSync(path, { throwIfNoEntry: false });
      if (!stats?.isFile()) return undefined;
      if (maxSize !== undefined && stats.size > maxSize) return undefined;
      if (!formatAllowed(path, options)) return undefined;

      const content = readFileSync(path, "utf-8");
      if (!withinLineBounds(content, options)) return undefined;

      return { path, content } satisfies EntryWithContent;
    })
    .filter((entry): entry is EntryWithContent => entry !== undefined);
}
