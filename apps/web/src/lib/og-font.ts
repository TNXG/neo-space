/**
 * 与公共站正文一致的 OG 字族。
 * Satori 默认 locale 为 unknown，其 CJK 匹配顺序把 ja-JP 排在前面，
 * 汉字会被渲染成日文字形；这里显式加载简体中文子集来固定字形。
 */
export const OG_FONT_FAMILY = "Noto Sans SC";

const FONT_WEIGHTS = [400, 700] as const;
/** 旧版 Safari UA 才会让 Google Fonts 返回 TrueType，Satori 只能嵌入 TTF。 */
const TTF_USER_AGENT
  = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";
const FONT_FACE_REGEX = /@font-face\s*{([^}]*)}/g;
const FONT_WEIGHT_REGEX = /font-weight:\s*(\d+)/;
const FONT_URL_REGEX = /src:\s*url\(([^)]+)\)/;
/** 两行标题加两行摘要的可见字符远少于该上限，超出的字符由 Satori 按需回退补齐。 */
const MAX_SUBSET_CHARS = 300;

const fontCache = new Map<string, OgFont[]>();

interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

/**
 * 下载一个能覆盖现有文案的字重子集。
 * @param text 需要渲染的文案。
 * @param weight 字重。
 * @returns 可直接交给 ImageResponse 的字体；下载失败时返回 null。
 */
async function loadWeightSubset(text: string, weight: 400 | 700): Promise<OgFont | null> {
  try {
    const cssResponse = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(OG_FONT_FAMILY).replaceAll("%20", "+")}:wght@${weight}&text=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": TTF_USER_AGENT } },
    );
    if (!cssResponse.ok)
      return null;

    const css = await cssResponse.text();
    for (const [, block] of css.matchAll(FONT_FACE_REGEX)) {
      const declaredWeight = block.match(FONT_WEIGHT_REGEX)?.[1];
      const url = block.match(FONT_URL_REGEX)?.[1];
      if (Number(declaredWeight) !== weight || !url)
        continue;

      const fontResponse = await fetch(url);
      if (!fontResponse.ok)
        return null;

      return {
        name: OG_FONT_FAMILY,
        data: await fontResponse.arrayBuffer(),
        weight,
        style: "normal",
      };
    }
  } catch {
    // 字体服务不可达时退回 ImageResponse 自带的语言回退，图片仍可生成。
  }
  return null;
}

/**
 * 为 OG 图准备简体中文字重，字符集只取本次要显示的文案。
 * @param texts 标题、摘要等全部可见文案。
 * @returns 字体列表；任一环节失败时返回空数组以使用默认回退。
 */
export async function loadOgFonts(texts: string[]): Promise<OgFont[]> {
  const characters = [...new Set(texts.join(""))].join("").slice(0, MAX_SUBSET_CHARS);
  if (!characters)
    return [];

  // 行数截断会插入省略号，子集必须包含它，否则 Satori 会画出缺字符方块。
  const text = `${characters}…`;

  const cached = fontCache.get(text);
  if (cached)
    return cached;

  const fonts = (await Promise.all(FONT_WEIGHTS.map(weight => loadWeightSubset(text, weight))))
    .filter((font): font is OgFont => font !== null);

  // 缺字重时宁可不注册，交给 Satori 的语言回退，避免半套字体造成字重跳变。
  if (fonts.length !== FONT_WEIGHTS.length)
    return [];

  fontCache.set(text, fonts);
  return fonts;
}
