import type { Link, Paragraph, Root } from "mdast";
import { visit } from "unist-util-visit";

const SUPPORTED_MEDIA_URL_REGEX = /https?:\/\/(?:bgm\.tv|bangumi\.tv|www\.themoviedb\.org|themoviedb\.org)\/[^\s<>()\]]+/giu;
const BANGUMI_PATH_REGEX = /^\/subject\/(\d+)\/?$/;
const TMDB_PATH_REGEX = /^\/(movie|tv)\/(\d+)(?:-[^/]+)?\/?$/;

export interface ParsedMediaUrl {
  source: "bangumi" | "tmdb";
  url: string;
  id: string;
  mediaType?: "movie" | "tv";
}

/** 仅允许已知站点与影视详情路径，避免服务端抓取任意 Markdown 地址。 */
export const parseMediaCardUrl = (rawUrl: string): ParsedMediaUrl | null => {
  try {
    const parsedUrl = new URL(rawUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (hostname === "bgm.tv" || hostname === "bangumi.tv") {
      const match = parsedUrl.pathname.match(BANGUMI_PATH_REGEX);
      return match?.[1]
        ? { source: "bangumi", url: rawUrl, id: match[1] }
        : null;
    }

    if (hostname === "themoviedb.org" || hostname === "www.themoviedb.org") {
      const match = parsedUrl.pathname.match(TMDB_PATH_REGEX);
      const mediaType = match?.[1];
      return match?.[2] && (mediaType === "movie" || mediaType === "tv")
        ? { source: "tmdb", url: rawUrl, id: match[2], mediaType }
        : null;
    }
  } catch {
    return null;
  }

  return null;
};

/** 从 Markdown 源文本中提取受支持链接，供 SSR 阶段并发预取数据。 */
export const extractMediaCardUrls = (content: string): string[] => {
  const urls = content.match(SUPPORTED_MEDIA_URL_REGEX) ?? [];
  return [...new Set(
    urls
      .map(url => url.replace(/[.,;:!?]+$/u, ""))
      .filter(url => parseMediaCardUrl(url) !== null),
  )];
};

/** 判断段落是否只包含一个目标链接，避免将行内链接扩展为大型卡片。 */
const getParagraphMediaUrl = (paragraph: Paragraph): string | null => {
  if (paragraph.children.length !== 1)
    return null;

  const child = paragraph.children[0];
  if (child.type !== "link")
    return null;

  const url = (child as Link).url;
  return parseMediaCardUrl(url) ? url : null;
};

/**
 * 将独占段落的 Bangumi/TMDB 链接转换为带数据标记的容器。
 *
 * 数据获取由渲染组件决定：服务端可注入预取结果，客户端则通过官方 API 降级加载。
 */
export const remarkMediaCard = () => (tree: Root): void => {
  visit(tree, "paragraph", (paragraph) => {
    const url = getParagraphMediaUrl(paragraph);
    if (!url)
      return;

    paragraph.data = {
      ...paragraph.data,
      hName: "div",
      hProperties: {
        ...paragraph.data?.hProperties,
        "data-media-card-url": url,
      },
    };
    paragraph.children = [];
  });
};

/** 从 react-markdown 组件属性中安全读取插件写入的链接。 */
export const getMediaCardUrlFromProps = (props: unknown): string | null => {
  if (!props || typeof props !== "object")
    return null;

  const url = (props as Record<string, unknown>)["data-media-card-url"];
  return typeof url === "string" && parseMediaCardUrl(url) ? url : null;
};

export type { MediaCardData, MediaSource } from "./types";
