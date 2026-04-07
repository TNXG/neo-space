export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Rust: "#dea584",
  Go: "#00add8",
  Python: "#3572a5",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Bash: "#89e051",
  JSON: "#94a3b8",
  TOML: "#9c4221",
  YAML: "#cb171e",
};

export const LANGUAGE_FALLBACKS = [
  "#0d9488",
  "#7c3aed",
  "#f97316",
  "#2563eb",
  "#e11d48",
  "#65a30d",
];

export const FUNCTION_COLORS = {
  code: "#3178c6",
  comments: "#7c6ede",
  blanks: "#b0ada6",
} as const;

export const CRATE_PALETTE = [
  "#0f766e",
  "#2563eb",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#be185d",
];

export const KIND_COLORS = {
  normal: "#3178c6",
  optional: "#7c6ede",
  dev: "#b0ada6",
  build: "#34d399",
} as const;

export const TREEMAP_LABEL_FONT = "600 12px \"Noto Sans SC\"";
export const TREEMAP_LABEL_LINE_HEIGHT = 14;
export const TREEMAP_META_FONT = "400 10px \"Noto Sans SC\"";
export const TREEMAP_META_LINE_HEIGHT = 12;
