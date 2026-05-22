import type { PaginateResult } from '~/models/base'
import type { PostModel } from '~/models/post'

import { request } from '~/utils/request'

export interface GetPostsParams {
  page?: number
  size?: number
  select?: string
  sortBy?: string
  sortOrder?: number
  categoryIds?: string[]
  keyword?: string
}

export interface CreatePostData {
  title: string
  text: string
  categoryId: string
  slug?: string
  tags?: string[]
  summary?: string | null
  copyright?: boolean
  isPublished?: boolean
  pin?: string | null
  pinOrder?: number
  relatedId?: string[]
  meta?: Record<string, unknown>
  /** 关联的草稿 ID，发布时传递以标记草稿为已发布 */
  draftId?: string
}

export interface UpdatePostData extends Partial<CreatePostData> {}

interface ApiResponse<T> {
  data: T
}

interface BackendPaginatedPosts {
  items: BackendPost[]
  pagination: PaginateResult<PostModel>['pagination']
}

export type BackendPost = Omit<
  PostModel,
  'createdAt' | 'modifiedAt' | 'category'
> & {
  _id?: string
  id?: string
  created?: string
  modified?: string | null
  createdAt?: string
  modifiedAt?: string | null
  category?:
    | (PostModel['category'] & { _id?: string; categoryType?: number })
    | null
}

function unwrapApiResponse<T>(response: T | ApiResponse<T>): T {
  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    'status' in response
  ) {
    return (response as ApiResponse<T>).data
  }

  return response as T
}

export function normalizePost(post: BackendPost): PostModel {
  const category = post.category
    ? {
        ...post.category,
        id: post.category.id ?? post.category._id ?? '',
        type: post.category.type ?? post.category.categoryType ?? 0,
      }
    : (undefined as unknown as PostModel['category'])
  const postId = post._id ?? post.id ?? ''

  return {
    ...post,
    _id: postId,
    id: post.id ?? postId,
    createdAt: post.createdAt ?? post.created ?? '',
    modifiedAt: post.modifiedAt ?? post.modified ?? null,
    category,
    readCount: post.readCount ?? 0,
    likeCount: post.likeCount ?? 0,
    images: post.images ?? [],
    tags: post.tags ?? [],
  }
}

function normalizePostResponse(response: PostModel | ApiResponse<BackendPost>) {
  return normalizePost(unwrapApiResponse(response as ApiResponse<BackendPost>))
}

function normalizePostListResponse(
  response:
    | PaginateResult<PostModel>
    | ApiResponse<BackendPaginatedPosts>,
): PaginateResult<PostModel> {
  const payload = unwrapApiResponse(response as ApiResponse<BackendPaginatedPosts>)
  const items = 'items' in payload ? payload.items : (payload as any).data

  return {
    data: (items ?? []).map((post: BackendPost) => normalizePost(post)),
    pagination: payload.pagination,
  }
}

export const postsApi = {
  // 获取文章列表
  getList: async (params?: GetPostsParams) => {
    const { categoryIds, ...restParams } = params || {}
    const response = await request.get<ApiResponse<BackendPaginatedPosts>>(
      '/posts',
      {
        bypassTransform: true,
        params: {
          ...restParams,
          categoryIds: categoryIds?.join(','),
        },
      },
    )
    return normalizePostListResponse(response)
  },

  // 获取单篇文章
  getById: async (id: string) => {
    const response = await request.get<ApiResponse<BackendPost>>(`/posts/${id}`, {
      bypassTransform: true,
    })
    return normalizePostResponse(response)
  },

  // 创建文章
  create: async (data: CreatePostData) => {
    const response = await request.post<ApiResponse<BackendPost>>('/posts', {
      bypassTransform: true,
      data,
    })
    return normalizePostResponse(response)
  },

  // 更新文章
  update: async (id: string, data: UpdatePostData) => {
    const response = await request.put<ApiResponse<BackendPost>>(
      `/posts/${id}`,
      { bypassTransform: true, data },
    )
    return normalizePostResponse(response)
  },

  // 删除文章
  delete: (id: string) => request.delete<void>(`/posts/${id}`),

  // 更新发布状态
  patch: async (id: string, data: Partial<PostModel>) => {
    const response = await request.patch<ApiResponse<BackendPost>>(
      `/posts/${id}`,
      { bypassTransform: true, data },
    )
    return normalizePostResponse(response)
  },
}
