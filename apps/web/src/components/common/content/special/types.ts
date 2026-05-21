export type SpecialCodeLanguage = "cargo" | "tokei";

export interface SpecialCodeBlockProps {
  language: SpecialCodeLanguage;
  raw: string;
}

export interface LangStat {
  lang: string;
  files: number;
  lines: number;
  code: number;
  comments: number;
  blanks: number;
}

export interface CargoDepInfo {
  name: string;
  version: string;
  kind: "normal" | "dev" | "build" | string;
  optional: boolean;
  target: string | null;
  features_requested: string[];
  crate_size: number | null;
  depth: number;
}

export interface CargoInfo {
  name: string;
  version: string;
  rust_version: string | null;
  features: Record<string, string[]>;
  deps: CargoDepInfo[];
  total_dep_size: number;
}

export interface CargoRequestSpec {
  crate: string;
  version?: string;
}

export interface PointerTooltipPosition {
  clientX: number;
  clientY: number;
}
