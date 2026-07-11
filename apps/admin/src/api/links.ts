import type {
  LinkHealthStatus,
  LinkModel,
  LinkResponse,
  LinkStateCount,
} from "~/models/link";

import { request } from "~/utils/request";

export interface GetLinksParams {
  page?: number;
  size?: number;
  state?: number;
}

export interface CreateLinkData {
  name: string;
  url: string;
  avatar?: string;
  description?: string;
  type?: number;
  state?: number;
  email?: string | null;
  rssurl?: string | null;
  techstack?: string[] | null;
}

export interface UpdateLinkData extends Partial<CreateLinkData> {}

interface ApiResponse<T> {
  code: number;
  status: "success" | "failed";
  message: string;
  data: T;
}

interface BackendPaginatedData<T> {
  items: T[];
  pagination: {
    total: number;
    current_page: number;
    total_page: number;
    size: number;
    has_next_page: boolean;
    has_prev_page: boolean;
  };
}

function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  return response.data;
}

function normalizeLinkList(response: ApiResponse<BackendPaginatedData<LinkModel>>): LinkResponse {
  const payload = unwrapApiResponse(response);
  return {
    data: payload.items,
    pagination: {
      total: payload.pagination.total,
      currentPage: payload.pagination.current_page,
      totalPage: payload.pagination.total_page,
      size: payload.pagination.size,
      hasNextPage: payload.pagination.has_next_page,
      hasPrevPage: payload.pagination.has_prev_page,
    },
  };
}

export const linksApi = {
  // 获取友链列表
  getList: async (params?: GetLinksParams) => {
    const response = await request.get<ApiResponse<BackendPaginatedData<LinkModel>>>(
      "/links/admin",
      { params, bypassTransform: true },
    );
    return normalizeLinkList(response);
  },

  // 获取状态计数
  getStateCount: async () => {
    const response = await request.get<ApiResponse<LinkStateCount>>("/links/state", {
      bypassTransform: true,
    });
    return unwrapApiResponse(response);
  },

  // 获取单个友链
  getById: async (id: string) => {
    const response = await request.get<ApiResponse<LinkModel>>(`/links/${id}`, {
      bypassTransform: true,
    });
    return unwrapApiResponse(response);
  },

  // 创建友链
  create: async (data: CreateLinkData) => {
    const response = await request.post<ApiResponse<LinkModel>>("/links", {
      data,
      bypassTransform: true,
    });
    return unwrapApiResponse(response);
  },

  // 更新友链
  update: async (id: string, data: UpdateLinkData) => {
    const response = await request.patch<ApiResponse<LinkModel>>(`/links/${id}`, {
      data,
      bypassTransform: true,
    });
    return unwrapApiResponse(response);
  },

  // 删除友链
  delete: async (id: string) => {
    const response = await request.delete<ApiResponse<void>>(`/links/${id}`, {
      bypassTransform: true,
    });
    return unwrapApiResponse(response);
  },

  // 更新友链状态
  updateState: (id: string, state: number) =>
    linksApi.update(id, { state }),

  // 检查友链健康状态
  checkHealth: async (options?: { timeout?: number }) => {
    const response = await request.get<ApiResponse<Record<string, LinkHealthStatus>>>(
      "/links/health",
      { timeout: options?.timeout, bypassTransform: true },
    );

    return unwrapApiResponse(response);
  },

  // 审核通过友链
  auditPass: (id: string) => linksApi.updateState(id, 0),
};
