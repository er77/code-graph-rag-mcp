import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { isFileSupported } from "../parsers/language-configs.js";

export const DEFAULT_INDEX_EXCLUDE_PATTERNS = [
  "node_modules/**",
  ".git/**",
  ".code-graph-rag/**",
  "dist/**",
  "build/**",
  "out/**",
  ".next/**",
  ".nuxt/**",
  "coverage/**",
  ".nyc_output/**",
  "__pycache__/**",
  "*.pyc",
  ".pytest_cache/**",
  "venv/**",
  "env/**",
  ".venv/**",
  ".env/**",
  "vendor/**",
  "target/**",
  ".gradle/**",
  ".idea/**",
  ".vscode/**",
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/.memory_bank/**",
  "tmp/**",
  "temp/**",
  "**/tmp/**",
  "**/temp/**",
  "*.log",
  "*.tmp",
  "*.cache",
  "*.zip",
  "*.tar",
  "*.tar.gz",
  "*.tgz",
  "*.gz",
  "*.bz2",
  "*.xz",
  "*.7z",
  "*.rar",
  "*.zst",
  ".DS_Store",
  "Thumbs.db",
] as const;

export const DEFAULT_INDEX_PRUNE_DIR_NAMES = [
  "node_modules",
  ".git",
  ".code-graph-rag",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  ".nyc_output",
  "__pycache__",
  ".pytest_cache",
  "venv",
  "env",
  ".venv",
  ".env",
  "vendor",
  "target",
  ".gradle",
  ".idea",
  ".vscode",
  ".memory_bank",
  "tmp",
  "temp",
] as const;

type IndexFileCollectionStats = {
  scannedFiles: number;
  includedFiles: number;
  excludedByPatterns: number;
  excludedByPruneDir: number;
  skippedSymlinks: number;
  skippedUnreadableDirs: number;
  unsupportedExtensions: number;
};

export type IndexFileCollectionResult = {
  files: string[];
  stats: IndexFileCollectionStats;
};

function normalizeGlobPath(p: string): string {
  return p.split("\\").join("/");
}

function globPatternToRegExp(pattern: string): RegExp {
  const normalized = normalizeGlobPath(pattern);
  const hasSlash = normalized.includes("/");
  const prefix = hasSlash ? "" : "(?:^|.*/)";

  let source = prefix;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]!;
    if (ch === "*") {
      const next = normalized[i + 1];
      if (next === "*") {
        source += ".*";
        i++;
        continue;
      }
      source += "[^/]*";
      continue;
    }
    if (ch === "?") {
      source += "[^/]";
      continue;
    }
    source += ch.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }

  return new RegExp(`^${source}$`);
}

export function collectIndexableFiles(targetDir: string, excludePatterns: string[]): IndexFileCollectionResult {
  const dir = resolve(targetDir);
  const regexes = excludePatterns
    .filter((pattern) => pattern && pattern !== "__batch_processing_enabled__")
    .map((pattern) => globPatternToRegExp(pattern));

  const stats: IndexFileCollectionStats = {
    scannedFiles: 0,
    includedFiles: 0,
    excludedByPatterns: 0,
    excludedByPruneDir: 0,
    skippedSymlinks: 0,
    skippedUnreadableDirs: 0,
    unsupportedExtensions: 0,
  };

  const shouldExclude = (relPath: string, isDir: boolean): boolean => {
    const normalized = normalizeGlobPath(relPath);
    const candidate = isDir && normalized.length > 0 && !normalized.endsWith("/") ? `${normalized}/` : normalized;
    return regexes.some((re) => re.test(candidate) || re.test(normalized));
  };

  const files: string[] = [];
  const stack: string[] = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let entries: Array<{
      name: string;
      isDirectory: () => boolean;
      isFile: () => boolean;
      isSymbolicLink: () => boolean;
    }>;
    try {
      entries = readdirSync(current, { withFileTypes: true }) as any;
    } catch {
      stats.skippedUnreadableDirs += 1;
      continue;
    }

    for (const entry of entries) {
      if (!entry?.name) continue;
      const fullPath = join(current, entry.name);
      const relPath = normalizeGlobPath(relative(dir, fullPath));

      if (entry.isSymbolicLink()) {
        stats.skippedSymlinks += 1;
        continue;
      }
      if (relPath === "" || relPath.startsWith("..")) continue;

      if (entry.isDirectory()) {
        const lower = entry.name.toLowerCase();
        if (DEFAULT_INDEX_PRUNE_DIR_NAMES.includes(lower as (typeof DEFAULT_INDEX_PRUNE_DIR_NAMES)[number])) {
          stats.excludedByPruneDir += 1;
          continue;
        }
        if (shouldExclude(relPath, true)) {
          stats.excludedByPatterns += 1;
          continue;
        }
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      stats.scannedFiles += 1;

      if (shouldExclude(relPath, false)) {
        stats.excludedByPatterns += 1;
        continue;
      }

      if (!isFileSupported(fullPath)) {
        stats.unsupportedExtensions += 1;
        continue;
      }

      files.push(fullPath);
      stats.includedFiles += 1;
    }
  }

  return { files, stats };
}
