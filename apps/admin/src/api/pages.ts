import type { PaginateResult } from "~/models/base";
import type { PageModel } from "~/models/page";

import { request } from "~/utils/request";

export interface GetPagesParams {
  page?: number;
  size?: number;
  select?: string;
}

export interface CreatePageData {
  title: string;
  text: string;
  slug: string;
  subtitle?: string;
  order?: number;
  meta?: Record<string, unknown>;
  /** 关联的草稿 ID，发布时传递以标记草稿为已发布 */
  draftId?: string;
}

export interface UpdatePageData extends Partial<CreatePageData> {}

interface ApiResponse<T> {
  data: T;
  status: "success" | "failed";
}

type BackendPage = Omit<
  PageModel,
  "createdAt" | "modifiedAt"
> & {
  created?: string;
  modified?: string | null;
  createdAt?: string;
  modifiedAt?: string | null;
};

interface BackendPaginatedPages {
  items?: BackendPage[];
  data?: BackendPage[];
  pagination?: PaginateResult<PageModel>["pagination"];
}

function unwrapApiResponse<T>(response: T | ApiResponse<T>): T {
  if (
    response
    && typeof response === "object"
    && "data" in response
    && "status" in response
  ) {
    return (response as ApiResponse<T>).data;
  }

  return response as T;
}

function normalizePage(page: BackendPage): PageModel {
  return {
    ...page,
    _id: page._id,
    created: page.created ?? page.createdAt ?? "",
    modified: page.modified ?? page.modifiedAt ?? null,
    createdAt: page.createdAt ?? page.created ?? "",
    modifiedAt: page.modifiedAt ?? page.modified ?? null,
  };
}

function normalizePageListResponse(
  response: ApiResponse<BackendPage[] | BackendPaginatedPages>,
  params?: GetPagesParams,
): PaginateResult<PageModel> {
  const payload = unwrapApiResponse(response);
  const items = Array.isArray(payload)
    ? payload
    : payload.items ?? payload.data ?? [];
  const size = params?.size ?? items.length;
  const currentPage = params?.page ?? 1;

  return {
    data: items.map(normalizePage),
    pagination: Array.isArray(payload) || !payload.pagination
      ? {
          total: items.length,
          size,
          currentPage,
          totalPage: items.length > 0 && size > 0 ? Math.ceil(items.length / size) : 0,
          hasPrevPage: currentPage > 1,
          hasNextPage: false,
        }
      : payload.pagination,
  };
}

export const pagesApi = {
  // 获取页面列表
  getList: async (params?: GetPagesParams) => {
    const response = await request.get<
      ApiResponse<BackendPage[] | BackendPaginatedPages>
    >("/pages/list", { bypassTransform: true, params });
    return normalizePageListResponse(response, params);
  },

  // 获取单个页面
  getById: async (id: string) => {
    const response = await request.get<ApiResponse<BackendPage>>(
      `/pages/id/${id}`,
      { bypassTransform: true },
    );
    return normalizePage(unwrapApiResponse(response));
  },

  // 创建页面
  create: async (data: CreatePageData) => {
    const response = await request.post<ApiResponse<BackendPage>>("/pages", {
      bypassTransform: true,
      data,
    });
    return normalizePage(unwrapApiResponse(response));
  },

  // 更新页面
  update: async (id: string, data: UpdatePageData) => {
    const response = await request.put<ApiResponse<BackendPage>>(
      `/pages/id/${id}`,
      { bypassTransform: true, data },
    );
    return normalizePage(unwrapApiResponse(response));
  },

  // 删除页面
  delete: (id: string) => request.delete<void>(`/pages/id/${id}`),

  // 重新排序：复用现有页面更新接口，避免为管理端列表新增批量 API。
  reorder: (seq: Array<{ _id: string; order: number }>) =>
    Promise.all(seq.map(item => pagesApi.update(item._id, { order: item.order }))),
};
