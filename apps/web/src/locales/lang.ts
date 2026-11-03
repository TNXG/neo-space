import type { AppLocale } from "./index";

/**
 * 站内 locale → 完整 BCP 47 语言标签。
 * 裸 `zh` 无法让 OpenType `locl` 明确选择简体字形，也不利于 `hyphens: auto`。
 */
const BCP47_LANG: Record<AppLocale, string> = {
  zh: "zh-CN",
  ja: "ja-JP",
  en: "en-US",
};

/**
 * 把站内 locale 或后端内容语言统一成可写入 HTML `lang` 的标签。
 * @param value 例如 "zh"、"en" 或已经是 "zh-CN" 的标签
 * @returns 完整 BCP 47 标签；无法识别时原样返回
 */
export function toBcp47(value: string): string {
  if (value.includes("-"))
    return value;
  return BCP47_LANG[value as AppLocale] ?? value;
}
