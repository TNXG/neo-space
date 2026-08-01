"use client";

import type { ApiResponse, PaginatedData } from "@/types/api";
import type {
  BangumiCharacterCollection,
  BangumiCharacterCollectionResponse,
  BangumiCollectionStatus,
  BangumiMediaCollection,
  BangumiMediaKind,
  BangumiPersonCollection,
  BangumiPersonCollectionResponse,
  BangumiSubjectCollectionResponse,
} from "@/types/bangumi";
import useSWRInfinite from "swr/infinite";
import { API_BASE_URL } from "@/lib/api-client";
import {
  normalizeBangumiCharacter,
  normalizeBangumiMediaPage,
  normalizeBangumiPerson,
} from "@/utils/bangumi/common";

const BANGUMI_PAGE_SIZE = 18;

interface BangumiInfiniteResult<T> {
  items: T[];
  total: number;
  hasNextPage: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error?: Error;
  loadMore: () => void;
}

/** 请求并归一化一个作品收藏分页。 */
async function fetchMediaPage([url, kind]: [string, BangumiMediaKind]): Promise<
  ApiResponse<PaginatedData<BangumiMediaCollection>>
> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Bangumi API Error: ${response.status}`);
  }
  const payload = (await response.json()) as ApiResponse<
    PaginatedData<BangumiSubjectCollectionResponse>
  >;
  return {
    ...payload,
    data: {
      items: normalizeBangumiMediaPage(payload.data.items, kind),
      pagination: payload.data.pagination,
    },
  };
}

/** 请求并归一化一个人物收藏分页。 */
async function fetchPeoplePage([url, kind]: [
  string,
  "characters" | "persons",
]): Promise<
  ApiResponse<
    PaginatedData<BangumiCharacterCollection | BangumiPersonCollection>
  >
> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Bangumi API Error: ${response.status}`);
  }
  if (kind === "characters") {
    const payload = (await response.json()) as ApiResponse<
      PaginatedData<BangumiCharacterCollectionResponse>
    >;
    return {
      ...payload,
      data: {
        items: payload.data.items.map(normalizeBangumiCharacter),
        pagination: payload.data.pagination,
      },
    };
  }
  const payload = (await response.json()) as ApiResponse<
    PaginatedData<BangumiPersonCollectionResponse>
  >;
  return {
    ...payload,
    data: {
      items: payload.data.items.map(normalizeBangumiPerson),
      pagination: payload.data.pagination,
    },
  };
}

/** 按作品类型和收藏状态逐页读取，不在浏览器内预取完整收藏。 */
export function useBangumiMediaInfinite(
  kind: BangumiMediaKind,
  status: "all" | BangumiCollectionStatus,
  initialPage?: PaginatedData<BangumiMediaCollection>,
): BangumiInfiniteResult<BangumiMediaCollection> {
  const fallbackData = initialPage
    ? [
        {
          code: 200,
          status: "success" as const,
          message: "Success",
          data: initialPage,
        },
      ]
    : undefined;
  const swr = useSWRInfinite<
    ApiResponse<PaginatedData<BangumiMediaCollection>>
  >(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.data.pagination.has_next_page) {
        return null;
      }
      const statusParam = status === "all" ? "" : `&status=${status}`;
      return [
        `${API_BASE_URL}/bangumi/library?section=${kind}&page=${pageIndex + 1}&size=${BANGUMI_PAGE_SIZE}${statusParam}`,
        kind,
      ] as [string, BangumiMediaKind];
    },
    fetchMediaPage,
    {
      fallbackData,
      revalidateFirstPage: false,
      revalidateOnFocus: false,
    },
  );
  const lastPage = swr.data?.at(-1)?.data;
  return {
    items: swr.data?.flatMap((page) => page.data.items) ?? [],
    total: lastPage?.pagination.total ?? initialPage?.pagination.total ?? 0,
    hasNextPage: lastPage?.pagination.has_next_page ?? false,
    isLoading: swr.isLoading,
    isLoadingMore: swr.isValidating && Boolean(swr.data?.length),
    error: swr.error,
    loadMore: () => void swr.setSize((size) => size + 1),
  };
}

/** 按虚构角色或现实人物逐页读取，裁切缺失时后端只负责入队。 */
export function useBangumiPeopleInfinite(
  kind: "characters" | "persons",
): BangumiInfiniteResult<BangumiCharacterCollection | BangumiPersonCollection> {
  const swr = useSWRInfinite<
    ApiResponse<
      PaginatedData<BangumiCharacterCollection | BangumiPersonCollection>
    >
  >(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.data.pagination.has_next_page) {
        return null;
      }
      return [
        `${API_BASE_URL}/bangumi/library?section=${kind}&page=${pageIndex + 1}&size=${BANGUMI_PAGE_SIZE}`,
        kind,
      ] as [string, "characters" | "persons"];
    },
    fetchPeoplePage,
    { revalidateFirstPage: false, revalidateOnFocus: false },
  );
  const lastPage = swr.data?.at(-1)?.data;
  return {
    items: swr.data?.flatMap((page) => page.data.items) ?? [],
    total: lastPage?.pagination.total ?? 0,
    hasNextPage: lastPage?.pagination.has_next_page ?? false,
    isLoading: swr.isLoading,
    isLoadingMore: swr.isValidating && Boolean(swr.data?.length),
    error: swr.error,
    loadMore: () => void swr.setSize((size) => size + 1),
  };
}
