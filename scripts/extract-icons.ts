#!/usr/bin/env node
/// <reference types="node" />
/**
 * 按需提取图标脚本（自动扫描版）
 * 自动扫描 src/ 下所有 .tsx/.ts 文件，收集用到的图标，
 * 生成 src/lib/icon-data.ts（纯静态数据，无运行时 JSON 加载）。
 *
 * 扫描来源：
 *  1. icon="collection:name" 属性（覆盖 @iconify/react/offline 用法）
 *  2. createSimpleIcon("key") / createMingcuteIcon("key")（file-icons.tsx）
 *  3. ext2lang 映射值 + "file" 兜底（catppuccin 集合）
 *
 * 用法：pnpm icons:extract
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "src");

// ─── 递归枚举源文件 ───────────────────────────────────────────────────────────

function walkSrc(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      walkSrc(full, files);
    } else if ([".tsx", ".ts"].includes(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = walkSrc(SRC);
console.log(`🔎 扫描 ${allFiles.length} 个 .tsx/.ts 文件...`);

// ─── 收集 icon="collection:name" 用法 ────────────────────────────────────────

interface IconCollection {
  icons?: Record<string, Icon>;
  aliases?: Record<string, Alias>;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

interface Icon {
  body: string;
  width?: number;
  height?: number;
}

interface Alias {
  parent?: string;
  body?: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

interface IconData {
  body: string;
  viewBox: string;
}

// 第一步：定位 icon= 或 icon: 出现的位置
const ICON_START_RE = /\bicon\s*[=:]\s*/g;
// 第二步：从该位置提取所有 "collection:name" 模式
const COL_NAME_RE = /["']([\w-]+):([\w.-]+)["']/g;
const ICONS_JSON_RE = /icons\.json$/;
const EXT2LANG_VALUE_RE = /:\s*["']([\w.-]+)["']/g;
const HYPHEN_RE = /-/g;
const byCollection: Record<string, Set<string>> = {};

for (const file of allFiles) {
  const src = readFileSync(file, "utf-8");
  for (const m of src.matchAll(ICON_START_RE)) {
    // 从 icon= 位置往后取一行，提取其中的所有 collection:name
    const nextNewline = src.indexOf("\n", m.index!);
    const rest = src.slice(m.index!, nextNewline > -1 ? nextNewline : undefined);
    for (const cn of rest.matchAll(COL_NAME_RE)) {
      const col = cn[1];
      const name = cn[2];
      if (!byCollection[col])
        byCollection[col] = new Set();
      byCollection[col].add(name);
    }
  }
}

// ─── 扫描 return "collection:name" 模式 ──────────────────────────────────────

const RETURN_ICON_RE = /return\s+["']([\w-]+):([\w.-]+)["']/g;

for (const file of allFiles) {
  const src = readFileSync(file, "utf-8");
  for (const m of src.matchAll(RETURN_ICON_RE)) {
    const col = m[1];
    const name = m[2];
    if (!byCollection[col])
      byCollection[col] = new Set();
    byCollection[col].add(name);
  }
}

// ─── 额外扫描 file-icons.tsx 中的 createXxxIcon("key") ───────────────────────

const FILE_ICONS_PATH = resolve(SRC, "lib/file-icons.tsx");
const fileIconsSrc = readFileSync(FILE_ICONS_PATH, "utf-8");

const CREATE_SI_RE = /createSimpleIcon\(["']([\w.-]+)["']/g;
const CREATE_MG_RE = /createMingcuteIcon\(["']([\w.-]+)["']/g;

for (const m of fileIconsSrc.matchAll(CREATE_SI_RE)) {
  if (!byCollection["simple-icons"])
    byCollection["simple-icons"] = new Set();
  byCollection["simple-icons"].add(m[1]);
}
for (const m of fileIconsSrc.matchAll(CREATE_MG_RE)) {
  if (!byCollection.mingcute)
    byCollection.mingcute = new Set();
  byCollection.mingcute.add(m[1]);
}

// ─── catppuccin：提取 ext2lang 所有值 + 兜底 "file" ──────────────────────────

const EXT2LANG_RE = /ext2lang[^=]*=\s*\{([^}]+)\}/;
const ext2langMatch = fileIconsSrc.match(EXT2LANG_RE);
if (ext2langMatch) {
  for (const m of ext2langMatch[1]!.matchAll(EXT2LANG_VALUE_RE)) {
    if (!byCollection.catppuccin)
      byCollection.catppuccin = new Set();
    byCollection.catppuccin.add(m[1]);
  }
}
if (!byCollection.catppuccin)
  byCollection.catppuccin = new Set();
byCollection.catppuccin.add("file");

// ─── 打印汇总 ─────────────────────────────────────────────────────────────────

for (const [col, names] of Object.entries(byCollection)) {
  console.log(`  ${col}: ${names.size} 个图标`);
}

// ─── 从 JSON 提取 SVG 数据 ────────────────────────────────────────────────────

function getIconBody(collection: IconCollection, iconName: string): IconData | null {
  const icons = collection.icons || {};
  const aliases = collection.aliases || {};

  if (icons[iconName]) {
    const icon = icons[iconName];
    const w = icon.width ?? collection.width ?? 24;
    const h = icon.height ?? collection.height ?? 24;
    const left = collection.left ?? 0;
    const top = collection.top ?? 0;
    return { body: icon.body, viewBox: `${left} ${top} ${w} ${h}` };
  }
  if (aliases[iconName]) {
    const alias = aliases[iconName];
    const parent = alias.parent;
    if (parent && icons[parent]) {
      const icon = { ...icons[parent], ...alias };
      const w = icon.width ?? collection.width ?? 24;
      const h = icon.height ?? collection.height ?? 24;
      const left = collection.left ?? 0;
      const top = collection.top ?? 0;
      return { body: icon.body ?? icons[parent].body, viewBox: `${left} ${top} ${w} ${h}` };
    }
  }
  return null;
}

const COLLECTION_PKG: Record<string, string> = {
  "simple-icons": "@iconify-json/simple-icons/icons.json",
  "mingcute": "@iconify-json/mingcute/icons.json",
  "catppuccin": "@iconify-json/catppuccin/icons.json",
};

// 从同目录的 info.json 读取集合的默认尺寸（icons.json 中可能缺失）
function readCollectionInfo(pkgPath: string): { width?: number; height?: number } {
  try {
    const infoPath = pkgPath.replace(ICONS_JSON_RE, "info.json");
    const info = require(infoPath) as Record<string, unknown>;
    return {
      width: typeof info.width === "number" ? info.width : typeof info.height === "number" ? info.height : undefined,
      height: typeof info.height === "number" ? info.height : typeof info.width === "number" ? info.width : undefined,
    };
  } catch {
    return {};
  }
}

const extracted: Record<string, Record<string, IconData>> = {};

for (const [col, names] of Object.entries(byCollection)) {
  const pkg = COLLECTION_PKG[col];
  if (!pkg) {
    console.warn(`⚠️  未知集合 "${col}"，跳过`);
    continue;
  }
  const json = require(pkg) as IconCollection;
  // 补充 info.json 中的默认尺寸
  const info = readCollectionInfo(pkg);
  if (!json.width && info.width)
    json.width = info.width;
  if (!json.height && info.height)
    json.height = info.height;
  extracted[col] = {};
  const missing: string[] = [];
  for (const name of names) {
    const data = getIconBody(json, name);
    if (data)
      extracted[col][name] = data;
    else missing.push(name);
  }
  if (missing.length)
    console.warn(`  ⚠️  ${col} 中未找到：${missing.join(", ")}`);
  console.log(`  ✅ ${col}: 提取 ${Object.keys(extracted[col]).length}/${names.size}`);
}

// ─── 生成 TypeScript 文件 ─────────────────────────────────────────────────────

function toTsRecord(obj: Record<string, IconData>): string {
  const entries = Object.entries(obj)
    .map(([k, v]) => `  "${k}": { body: ${JSON.stringify(v.body)}, viewBox: "${v.viewBox}" }`)
    .join(",\n");
  return `{\n${entries},\n}`;
}

const totalIcons = Object.values(extracted).reduce((s, m) => s + Object.keys(m).length, 0);

const collectionVarNames: Record<string, string> = {
  "simple-icons": "simpleIconsData",
  "mingcute": "mingcuteIconsData",
  "catppuccin": "catppuccinIconsData",
};

let tsBody = `// ⚠️  此文件由 scripts/extract-icons.ts 自动生成，请勿手动编辑。
// 新增图标只需在组件里写 icon="collection:name" 或 createXxxIcon("key")，
// 然后重新运行：pnpm icons:extract

export interface IconEntry { body: string; viewBox: string }

`;

for (const [col, data] of Object.entries(extracted)) {
  const varName = collectionVarNames[col] ?? `${col.replace(HYPHEN_RE, "_")}IconsData`;
  tsBody += `export const ${varName}: Record<string, IconEntry> = ${toTsRecord(data)};\n\n`;
}

// 汇总映射表，供 InlineIcon 按集合名查找
tsBody += `export const allIconCollections: Record<string, Record<string, IconEntry>> = {\n`;
for (const col of Object.keys(extracted)) {
  const varName = collectionVarNames[col] ?? `${col.replace(HYPHEN_RE, "_")}IconsData`;
  tsBody += `  "${col}": ${varName},\n`;
}
tsBody += `};\n`;

const outPath = resolve(ROOT, "src/lib/icon-data.ts");
writeFileSync(outPath, tsBody, "utf-8");
console.log(`\n📄 已生成 src/lib/icon-data.ts（共 ${totalIcons} 个图标）`);
