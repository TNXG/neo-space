import "server-only";

import type { ApiResponse, PaginatedData } from "@/types/api";
import type {
  BangumiLibraryData,
  BangumiSubjectCollectionResponse,
  BangumiUserResponse,
} from "@/types/bangumi";
import { API_BASE_URL } from "@/lib/api-client";
import {
  normalizeBangumiMediaPage,
  normalizeBangumiProfile,
} from "@/utils/bangumi/common";

const BANGUMI_PAGE_SIZE = 18;
const BANGUMI_REVALIDATE_SECONDS = 1_800;

/** 从本站后端读取 Bangumi 用户资料与首屏动画收藏。 */
export async function getBangumiLibrary(): Promise<BangumiLibraryData | null> {
  const fetchOptions = {
    next: {
      revalidate: BANGUMI_REVALIDATE_SECONDS,
      tags: ["bangumi"],
    },
  } satisfies RequestInit;
  const [profileResponse, animeResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/bangumi/profile`, fetchOptions),
    fetch(
      `${API_BASE_URL}/bangumi/library?section=anime&page=1&size=${BANGUMI_PAGE_SIZE}`,
      fetchOptions,
    ),
  ]);
  if (profileResponse.status === 404 || animeResponse.status === 404) {
    return null;
  }
  if (!profileResponse.ok || !animeResponse.ok) {
    throw new Error(
      `Bangumi backend request failed: profile=${profileResponse.status}, library=${animeResponse.status}`,
    );
  }

  const profilePayload =
    (await profileResponse.json()) as ApiResponse<BangumiUserResponse>;
  const animePayload = (await animeResponse.json()) as ApiResponse<
    PaginatedData<BangumiSubjectCollectionResponse>
  >;

  return {
    profile: normalizeBangumiProfile(profilePayload.data),
    initialAnimePage: {
      items: normalizeBangumiMediaPage(animePayload.data.items, "anime"),
      pagination: animePayload.data.pagination,
    },
  };
}
