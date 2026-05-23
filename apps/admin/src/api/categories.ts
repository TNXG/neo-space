import type { BackendPost } from "~/api/posts";
import type { CategoryModel, TagModel } from "~/models/category";

import type { PostModel } from "~/models/post";
import { normalizePost } from "~/api/posts";
import { request } from "~/utils/request";

export interface GetCategoriesParams {
  type?: "Category" | "Tag" | "tag";
}

export interface CreateCategoryData {
  name: string;
  slug: string;
  type?: number;
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> {}

interface ApiResponse<T> {
  data: T;
}

type BackendCategory = Omit<CategoryModel, "createdAt"> & {
  created?: string;
  createdAt?: string;
  categoryType?: number;
};

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

function normalizeCategory(category: BackendCategory): CategoryModel {
  return {
    ...category,
    createdAt: category.createdAt ?? category.created ?? "",
    type: category.type ?? category.categoryType ?? 0,
    count: category.count ?? 0,
  };
}

export const categoriesApi = {
  // 获取分类列表
  getList: async (params?: GetCategoriesParams) => {
    const response = await request.get<ApiResponse<BackendCategory[]>>(
      "/categories",
      { params },
    );
    return unwrapApiResponse(response).map(normalizeCategory);
  },

  // 获取单个分类
  getById: async (id: string) => {
    const response = await request.get<ApiResponse<BackendCategory>>(
      `/categories/${id}`,
    );
    return normalizeCategory(unwrapApiResponse(response));
  },

  // 创建分类
  create: async (data: CreateCategoryData) => {
    const response = await request.post<ApiResponse<BackendCategory>>(
      "/categories",
      { data },
    );
    return normalizeCategory(unwrapApiResponse(response));
  },

  // 更新分类
  update: async (id: string, data: UpdateCategoryData) => {
    const response = await request.put<ApiResponse<BackendCategory>>(
      `/categories/${id}`,
      { data },
    );
    return normalizeCategory(unwrapApiResponse(response));
  },

  // 删除分类
  delete: (id: string) => request.delete<void>(`/categories/${id}`),

  // 获取标签列表
  getTags: async () => {
    const response = await request.get<ApiResponse<TagModel[]>>("/categories", {
      params: { type: "tag" },
    });
    return unwrapApiResponse(response);
  },

  // 获取标签关联的文章
  getPostsByTag: async (tagName: string) => {
    const response = await request.get<ApiResponse<BackendPost[]>>(
      `/categories/tags/${encodeURIComponent(tagName)}`,
      {
        params: { tag: "true" },
      },
    );
    return unwrapApiResponse(response).map(normalizePost) as PostModel[];
  },
};
