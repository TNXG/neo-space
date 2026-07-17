import { parseMediaCardUrl } from "./index";
import type { MediaCardData } from "./types";

interface BangumiClientResponse {
  name?: string;
  name_cn?: string;
  summary?: string;
  date?: string;
  platform?: string;
  images?: { large?: string; common?: string };
  rating?: { score?: number };
  tags?: Array<{ name?: string }>;
}

interface TmdbClientResponse {
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
  genres?: Array<{ name?: string }>;
}

/** 客户端直接读取 Bangumi 官方公共 API。 */
const fetchBangumiCard = async (url: string, id: string, signal: AbortSignal): Promise<MediaCardData | null> => {
  const response = await fetch(`https://api.bgm.tv/v0/subjects/${id}`, { signal });
  if (!response.ok)
    return null;

  const subject = await response.json() as BangumiClientResponse;
  const title = subject.name_cn || subject.name;
  if (!title)
    return null;

  return {
    url,
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

/** 客户端使用显式公开的 TMDB API Key 读取官方 API，不复用任何服务端凭证。 */
const fetchTmdbCard = async (
  url: string,
  id: string,
  mediaType: "movie" | "tv",
  signal: AbortSignal,
): Promise<MediaCardData | null> => {
  const publicApiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!publicApiKey)
    return null;

  const endpoint = new URL(`https://api.themoviedb.org/3/${mediaType}/${id}`);
  endpoint.searchParams.set("language", "zh-CN");
  endpoint.searchParams.set("api_key", publicApiKey);
  const response = await fetch(endpoint, { signal });
  if (!response.ok)
    return null;

  const details = await response.json() as TmdbClientResponse;
  const title = details.title || details.name;
  if (!title)
    return null;

  return {
    url,
    source: "tmdb",
    sourceLabel: "TMDB",
    title,
    originalTitle: details.original_title || details.original_name,
    description: details.overview,
    posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined,
    backdropUrl: details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : undefined,
    releaseDate: details.release_date || details.first_air_date,
    mediaType: mediaType === "movie" ? "电影" : "剧集",
    rating: details.vote_average,
    genres: details.genres?.flatMap(genre => genre.name ? [genre.name] : []) ?? [],
  };
};

/** 根据受支持链接选择对应官方 API，无法获取时交由基础卡片降级。 */
export const fetchMediaCard = async (url: string, signal: AbortSignal): Promise<MediaCardData | null> => {
  const parsedUrl = parseMediaCardUrl(url);
  if (!parsedUrl)
    return null;

  if (parsedUrl.source === "bangumi")
    return fetchBangumiCard(url, parsedUrl.id, signal);

  return parsedUrl.mediaType
    ? fetchTmdbCard(url, parsedUrl.id, parsedUrl.mediaType, signal)
    : null;
};
