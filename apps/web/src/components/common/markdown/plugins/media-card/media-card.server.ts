import "server-only";

import { extractMediaCardUrls, parseMediaCardUrl } from "./index";
import type { MediaCardData, ParsedMediaUrl } from "./index";

const HTML_META_REGEX = /<meta\s+([^>]+)>/giu;
const HTML_ATTRIBUTE_REGEX = /([\w:-]+)\s*=\s*(["'])(.*?)\2/gu;

interface BangumiSubjectResponse {
  name?: string;
  name_cn?: string;
  summary?: string;
  date?: string;
  platform?: string;
  images?: {
    large?: string;
    common?: string;
  };
  rating?: {
    score?: number;
  };
  tags?: Array<{
    name?: string;
  }>;
}

interface TmdbDetailsResponse {
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genres?: Array<{
    name?: string;
  }>;
}

/** 将 HTML 实体还原为可展示文本，避免 Open Graph 降级内容出现编码字符。 */
const decodeHtmlEntities = (value: string): string => value
  .replace(/&quot;/giu, "\"")
  .replace(/&#39;|&apos;/giu, "'")
  .replace(/&amp;/giu, "&")
  .replace(/&lt;/giu, "<")
  .replace(/&gt;/giu, ">")
  .replace(/&#(\d+);/gu, (_match, codePoint: string) => String.fromCodePoint(Number(codePoint)));

/** 读取 Bangumi 公共 API 并统一为卡片数据。 */
const fetchBangumiMetadata = async (parsedUrl: ParsedMediaUrl): Promise<MediaCardData | null> => {
  const response = await fetch(`https://api.bgm.tv/v0/subjects/${parsedUrl.id}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "tnxg-blog/1.0 (https://tnxg.top)",
    },
    next: { revalidate: 86400 },
  });

  if (!response.ok)
    return null;

  const subject = await response.json() as BangumiSubjectResponse;
  const title = subject.name_cn || subject.name;
  if (!title)
    return null;

  return {
    url: parsedUrl.url,
    source: "bangumi",
    sourceLabel: "Bangumi",
    title,
    originalTitle: subject.name,
    description: subject.summary?.replace(/\s+/gu, " ").trim(),
    posterUrl: subject.images?.large || subject.images?.common,
    releaseDate: subject.date,
    mediaType: subject.platform,
    rating: subject.rating?.score,
    genres: subject.tags?.slice(0, 3).flatMap(tag => tag.name ? [tag.name] : []) ?? [],
  };
};

/** 使用服务器端 TMDB 凭证读取结构化详情，凭证不会进入客户端 bundle。 */
const fetchTmdbApiMetadata = async (parsedUrl: ParsedMediaUrl): Promise<MediaCardData | null> => {
  const accessToken = process.env.TMDB_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if ((!accessToken && !apiKey) || !parsedUrl.mediaType)
    return null;

  const endpoint = new URL(`https://api.themoviedb.org/3/${parsedUrl.mediaType}/${parsedUrl.id}`);
  endpoint.searchParams.set("language", "zh-CN");
  if (apiKey)
    endpoint.searchParams.set("api_key", apiKey);

  const response = await fetch(endpoint, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    next: { revalidate: 86400 },
  });
  if (!response.ok)
    return null;

  const details = await response.json() as TmdbDetailsResponse;
  const title = details.title || details.name;
  if (!title)
    return null;

  return {
    url: parsedUrl.url,
    source: "tmdb",
    sourceLabel: "TMDB",
    title,
    originalTitle: details.original_title || details.original_name,
    description: details.overview,
    posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined,
    backdropUrl: details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : undefined,
    releaseDate: details.release_date || details.first_air_date,
    mediaType: parsedUrl.mediaType === "movie" ? "电影" : "剧集",
    rating: details.vote_average,
    genres: details.genres?.flatMap(genre => genre.name ? [genre.name] : []) ?? [],
  };
};

/** 从 TMDB 页面读取 Open Graph，作为未配置 API 凭证时的服务端降级方案。 */
const fetchTmdbOpenGraphMetadata = async (parsedUrl: ParsedMediaUrl): Promise<MediaCardData | null> => {
  const response = await fetch(parsedUrl.url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0 (compatible; tnxg-blog/1.0; +https://tnxg.top)",
    },
    next: { revalidate: 86400 },
  });
  if (!response.ok)
    return null;

  const html = await response.text();
  const metadata = new Map<string, string>();
  for (const metaMatch of html.matchAll(HTML_META_REGEX)) {
    const attributes = new Map<string, string>();
    for (const attributeMatch of metaMatch[1].matchAll(HTML_ATTRIBUTE_REGEX)) {
      attributes.set(attributeMatch[1].toLowerCase(), decodeHtmlEntities(attributeMatch[3]));
    }
    const key = attributes.get("property") || attributes.get("name");
    const value = attributes.get("content");
    if (key && value && !metadata.has(key))
      metadata.set(key, value);
  }

  const title = metadata.get("og:title");
  if (!title)
    return null;

  return {
    url: parsedUrl.url,
    source: "tmdb",
    sourceLabel: "TMDB",
    title,
    description: metadata.get("og:description"),
    posterUrl: metadata.get("og:image"),
    mediaType: parsedUrl.mediaType === "movie" ? "电影" : "剧集",
    genres: [],
  };
};

/** 解析一个目标链接，任何上游失败都返回 null 交由展示层降级。 */
export const resolveMediaCard = async (url: string): Promise<MediaCardData | null> => {
  const parsedUrl = parseMediaCardUrl(url);
  if (!parsedUrl)
    return null;

  try {
    if (parsedUrl.source === "bangumi")
      return await fetchBangumiMetadata(parsedUrl);

    return await fetchTmdbApiMetadata(parsedUrl) || await fetchTmdbOpenGraphMetadata(parsedUrl);
  } catch {
    return null;
  }
};

/** 并发预取正文中所有影视链接，供本次 Server Render 注入完整初始数据。 */
export const resolveMediaCards = async (content: string): Promise<Map<string, MediaCardData>> => {
  const urls = extractMediaCardUrls(content);
  const resolvedCards = await Promise.all(urls.map(async url => [url, await resolveMediaCard(url)] as const));

  return new Map(
    resolvedCards.flatMap(([url, card]) => card ? [[url, card] as const] : []),
  );
};
