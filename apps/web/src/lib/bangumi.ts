import "server-only";

import type { ApiResponse } from "@/types/api";
import type {
  BangumiCharacterCollection,
  BangumiCharacterType,
  BangumiCollectionStatus,
  BangumiImageCrop,
  BangumiImages,
  BangumiLibraryData,
  BangumiMediaCollection,
  BangumiMediaKind,
  BangumiPersonCareer,
  BangumiPersonCollection,
  BangumiPersonType,
  BangumiProfile,
} from "@/types/bangumi";
import { API_BASE_URL } from "@/lib/api-client";

const BANGUMI_REVALIDATE_SECONDS = 1_800;

interface BangumiUserResponse {
  username: string;
  nickname: string;
  sign?: string;
  avatar?: {
    large?: string;
    medium?: string;
    small?: string;
  };
}

interface BangumiSubjectCollectionResponse {
  subject_id: number;
  rate: number;
  type: BangumiCollectionStatus;
  comment?: string | null;
  tags: string[];
  ep_status: number;
  vol_status: number;
  updated_at: string;
  private: boolean;
  subject?: {
    name: string;
    name_cn: string;
    short_summary: string;
    date?: string;
    images?: BangumiImages;
    score: number;
    rank: number;
    eps: number;
    volumes: number;
  };
}

interface BangumiCharacterCollectionResponse {
  id: number;
  name: string;
  type: BangumiCharacterType;
  images?: BangumiImages;
  created_at: string;
  crop?: BangumiImageCrop;
}

interface BangumiPersonCollectionResponse {
  id: number;
  name: string;
  type: BangumiPersonType;
  career?: BangumiPersonCareer[];
  images?: BangumiImages;
  created_at: string;
  crop?: BangumiImageCrop;
}

interface BangumiBackendLibraryResponse {
  profile: BangumiUserResponse;
  media: Record<BangumiMediaKind, BangumiSubjectCollectionResponse[]>;
  characters: BangumiCharacterCollectionResponse[];
  persons: BangumiPersonCollectionResponse[];
}

/** 从本站后端读取已经附带持久化裁切参数的 Bangumi 聚合数据。 */
async function fetchBackendLibrary(): Promise<BangumiBackendLibraryResponse | null> {
  const response = await fetch(`${API_BASE_URL}/bangumi/library`, {
    next: {
      revalidate: BANGUMI_REVALIDATE_SECONDS,
      tags: ["bangumi", "bangumi-crops"],
    },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Bangumi backend request failed: ${response.status}`);
  }
  const payload =
    (await response.json()) as ApiResponse<BangumiBackendLibraryResponse>;
  return payload.data;
}

/** 将后端用户响应压缩为页面需要的公开资料。 */
function normalizeProfile(user: BangumiUserResponse): BangumiProfile {
  return {
    username: user.username,
    nickname: user.nickname,
    sign: user.sign,
    avatar: user.avatar?.large || user.avatar?.medium || user.avatar?.small,
  };
}

/** 将后端作品条目转换为稳定站内类型；作品封面不接收人物裁切参数。 */
function normalizeMediaCollection(
  item: BangumiSubjectCollectionResponse,
  kind: BangumiMediaKind,
): BangumiMediaCollection | null {
  if (item.private || !item.subject) {
    return null;
  }
  return {
    subjectId: item.subject_id,
    kind,
    status: item.type,
    title: item.subject.name_cn || item.subject.name,
    originalTitle: item.subject.name,
    summary: item.subject.short_summary,
    date: item.subject.date,
    images: item.subject.images,
    score: item.subject.score,
    rank: item.subject.rank,
    rate: item.rate,
    episodeProgress: item.ep_status,
    episodes: item.subject.eps,
    volumeProgress: item.vol_status,
    volumes: item.subject.volumes,
    comment: item.comment || undefined,
    tags: item.tags,
    updatedAt: item.updated_at,
  };
}

/** 归一化同一作品类型，并过滤私密或缺少 subject 的异常条目。 */
function normalizeMediaCollections(
  items: BangumiSubjectCollectionResponse[],
  kind: BangumiMediaKind,
): BangumiMediaCollection[] {
  return items.flatMap((item) => {
    const normalized = normalizeMediaCollection(item, kind);
    return normalized ? [normalized] : [];
  });
}

/** 获取后端聚合并完成裁切关联的完整兴趣收藏。 */
export async function getBangumiLibrary(): Promise<BangumiLibraryData | null> {
  const library = await fetchBackendLibrary();
  if (!library) {
    return null;
  }

  const characters: BangumiCharacterCollection[] = library.characters.map(
    (item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      images: item.images,
      createdAt: item.created_at,
      crop: item.crop,
    }),
  );
  const persons: BangumiPersonCollection[] = library.persons.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    careers: item.career ?? [],
    images: item.images,
    createdAt: item.created_at,
    crop: item.crop,
  }));

  return {
    profile: normalizeProfile(library.profile),
    media: {
      anime: normalizeMediaCollections(library.media.anime, "anime"),
      game: normalizeMediaCollections(library.media.game, "game"),
      book: normalizeMediaCollections(library.media.book, "book"),
    },
    characters,
    persons,
  };
}
