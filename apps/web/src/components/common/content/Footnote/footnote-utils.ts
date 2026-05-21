export const FOOTNOTE_HIGHLIGHT_DURATION = 2800;
export const FOOTNOTE_TOOLTIP_DELAY = 120;

const FOOTNOTE_REF_PREFIX = "fnref";
const FOOTNOTE_ITEM_PREFIX = "fn";

// Static regex patterns to avoid re-compilation
const HASH_PREFIX_REGEX = /^#/;
const USER_CONTENT_PREFIX_REGEX = /^user-content-/;
const FNREF_PREFIX_REGEX = /^fnref-/;
const FN_PREFIX_REGEX = /^fn-/;
const SUFFIX_NUMBER_REGEX = /-\d+$/;
const DIGITS_REGEX = /^\d+$/;
const FNREF_PATTERN_REGEX = /^fnref-(.+?)(?:-(\d+))?$/;

export function formatFootnoteLabel(index: number, format: "roman-upper" | "roman-lower" | "arabic" = "roman-upper") {
  if (format === "arabic")
    return String(index);

  const numeral = toRoman(index);
  return format === "roman-lower" ? numeral.toLowerCase() : numeral;
}

export function buildFootnoteRefDomId(footnoteId: string, refIndex: number) {
  return `${FOOTNOTE_REF_PREFIX}-${footnoteId}-${refIndex}`;
}

export function buildFootnoteItemDomId(footnoteId: string) {
  return `${FOOTNOTE_ITEM_PREFIX}-${footnoteId}`;
}

export function normalizeFootnoteId(value: string) {
  return value
    .replace(HASH_PREFIX_REGEX, "")
    .replace(USER_CONTENT_PREFIX_REGEX, "")
    .replace(FNREF_PREFIX_REGEX, "")
    .replace(FN_PREFIX_REGEX, "")
    .replace(SUFFIX_NUMBER_REGEX, (match) => {
      const suffix = match.slice(1);
      return DIGITS_REGEX.test(suffix) && value.includes("fnref-") ? "" : match;
    });
}

export function resolveFootnoteRefTargetId(value: string) {
  const clean = value.replace(HASH_PREFIX_REGEX, "").replace(USER_CONTENT_PREFIX_REGEX, "");
  const match = clean.match(FNREF_PATTERN_REGEX);

  if (!match)
    return clean;

  const [, footnoteId, refIndex = "1"] = match;
  return buildFootnoteRefDomId(footnoteId, Number(refIndex));
}

export function scrollToFootnoteElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const offsetTop = rect.top + window.scrollY;
  // 将目标元素居中于视口
  const targetY = offsetTop - (window.innerHeight / 2) + (rect.height / 2);
  window.scrollTo({ top: Math.max(targetY, 0), behavior: "smooth" });
}

export function highlightFootnoteElement(element: HTMLElement, duration = FOOTNOTE_HIGHLIGHT_DURATION) {
  element.dataset.footnoteState = "active";
  const timer = window.setTimeout(() => {
    if (element.dataset.footnoteState === "active")
      delete element.dataset.footnoteState;
  }, duration);

  return () => window.clearTimeout(timer);
}

function toRoman(value: number) {
  if (!Number.isFinite(value) || value <= 0)
    return String(value);

  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  let remainder = Math.trunc(value);
  let result = "";

  for (const [amount, symbol] of numerals) {
    while (remainder >= amount) {
      result += symbol;
      remainder -= amount;
    }
  }

  return result;
}
