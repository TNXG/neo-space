import type { CargoDepInfo, CargoRequestSpec, LangStat } from "./types";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import {
  KIND_COLORS,
  LANGUAGE_COLORS,
  LANGUAGE_FALLBACKS,
} from "./constants";

const preparedTextCache = new Map<
  string,
  ReturnType<typeof prepareWithSegments>
>();

const RE_SEPARATOR_LINE = /^[━─]/;
const RE_LANGUAGE_HEADER = /Language\s+Files/;
const RE_TOTAL_LINE = /^\(Total\)/;
const RE_TOTAL_SUMMARY = /^Total\s/;
const RE_TABLE_SEPARATOR = /^\|-\s/;
const RE_TOKEI_ROW = /^(\S+(?:\s\S+)*)\s{2,}(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/;
const RE_CARGO_SPEC = /^([\w-]+)(?:@(\S+))?$/;
const RE_TRAILING_ZERO = /\.0$/;
const RE_NEWLINE = /\r?\n/;

export function parseTokei(raw: string): LangStat[] {
  const lines = raw.split("\n");
  const results: LangStat[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      !trimmed
      || RE_SEPARATOR_LINE.test(trimmed)
      || RE_LANGUAGE_HEADER.test(line)
      || RE_TOTAL_LINE.test(trimmed)
      || RE_TOTAL_SUMMARY.test(trimmed)
      || RE_TABLE_SEPARATOR.test(trimmed)
    ) {
      continue;
    }

    const match = trimmed.match(RE_TOKEI_ROW);
    if (!match) {
      continue;
    }

    results.push({
      lang: match[1].trim(),
      files: Number(match[2]),
      lines: Number(match[3]),
      code: Number(match[4]),
      comments: Number(match[5]),
      blanks: Number(match[6]),
    });
  }

  return results.filter(stat => stat.lines > 0);
}

export function parseCargoSpec(raw: string): CargoRequestSpec | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        crate?: string;
        name?: string;
        version?: string;
      };
      const crateName = parsed.crate || parsed.name;
      if (!crateName) {
        return null;
      }
      return { crate: crateName, version: parsed.version };
    } catch {
      return null;
    }
  }

  const firstLine = trimmed.split(RE_NEWLINE, 1)[0]?.trim();
  if (!firstLine) {
    return null;
  }

  const match = firstLine.match(RE_CARGO_SPEC);
  if (!match) {
    return null;
  }

  return {
    crate: match[1],
    version: match[2],
  };
}

export function getLanguageColor(language: string) {
  if (LANGUAGE_COLORS[language]) {
    return LANGUAGE_COLORS[language];
  }

  const seed = Array.from(language).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return LANGUAGE_FALLBACKS[seed % LANGUAGE_FALLBACKS.length];
}

export function getKindColor(dep: CargoDepInfo) {
  if (dep.optional) {
    return KIND_COLORS.optional;
  }

  if (dep.kind === "dev") {
    return KIND_COLORS.dev;
  }

  if (dep.kind === "build") {
    return KIND_COLORS.build;
  }

  return KIND_COLORS.normal;
}

export function percentage(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

export function formatCompact(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(RE_TRAILING_ZERO, "")}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(RE_TRAILING_ZERO, "")}K`;
  }

  return String(value);
}

export function formatFull(value: number) {
  return value.toLocaleString();
}

export function formatBytes(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1).replace(RE_TRAILING_ZERO, "")} MB`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(1).replace(RE_TRAILING_ZERO, "")} KB`;
  }

  return `${value} B`;
}

export function layoutTreemapText(
  text: string,
  maxWidth: number,
  font: string,
  lineHeight: number,
  maxLines: number,
) {
  const normalizedText = text.trim();
  if (!normalizedText || maxWidth <= 0 || maxLines <= 0) {
    return [] as string[];
  }

  const prepared = getPreparedText(normalizedText, font);
  const layoutResult = layoutWithLines(prepared, maxWidth, lineHeight);
  const renderedLines = layoutResult.lines
    .map(line => line.text.trim())
    .filter(Boolean);

  if (renderedLines.length <= maxLines) {
    return renderedLines;
  }

  const leadingLines = renderedLines.slice(0, Math.max(0, maxLines - 1));
  const remainingText = renderedLines
    .slice(Math.max(0, maxLines - 1))
    .join(" ")
    .trim();
  const tailLine = fitEllipsisLine(remainingText, maxWidth, font, lineHeight);

  return [...leadingLines, tailLine].filter(Boolean);
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPreparedText(text: string, font: string) {
  const cacheKey = `${font}__${text}`;
  const cached = preparedTextCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const prepared = prepareWithSegments(text, font);
  preparedTextCache.set(cacheKey, prepared);
  return prepared;
}

function fitEllipsisLine(
  text: string,
  maxWidth: number,
  font: string,
  lineHeight: number,
) {
  if (!text) {
    return "";
  }

  const fullText = `${text}…`;
  if (
    layoutWithLines(getPreparedText(fullText, font), maxWidth, lineHeight)
      .lineCount <= 1
  ) {
    return fullText;
  }

  let low = 0;
  let high = text.length;
  let best = "…";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${text.slice(0, mid).trimEnd()}…`;
    const lineCount = layoutWithLines(
      getPreparedText(candidate, font),
      maxWidth,
      lineHeight,
    ).lineCount;

    if (lineCount <= 1) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}
