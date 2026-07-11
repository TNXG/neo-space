import type { RecentlyModel } from "~/models/recently";

import { request } from "~/utils/request";

interface ApiResponse<T> {
  code: number;
  status: "success" | "failed";
  message: string;
  data: T;
}

export interface RecentlyCreatePayload {
  content: string;
}

export type RecentlyUpdatePayload = RecentlyCreatePayload;

function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  return response.data;
}

export const recentlyApi = {
  // 获取 /thinking 页面展示的说说列表
  getAll: async () => {
    const response = await request.get<ApiResponse<RecentlyModel[]>>(
      "/recently",
      { bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  // 创建说说
  create: async (data: RecentlyCreatePayload) => {
    const response = await request.post<ApiResponse<RecentlyModel>>(
      "/recently",
      { data, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  // 更新说说
  update: async (id: string, data: RecentlyUpdatePayload) => {
    const response = await request.put<ApiResponse<RecentlyModel>>(
      `/recently/${id}`,
      { data, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  // 删除说说
  delete: async (id: string) => {
    const response = await request.delete<ApiResponse<void>>(`/recently/${id}`, {
      bypassTransform: true,
    });
    return unwrapApiResponse(response);
  },

  // 清空说说
  clear: async () => {
    const response = await request.delete<ApiResponse<number>>("/recently", {
      bypassTransform: true,
    });
    return unwrapApiResponse(response);
  },
};
