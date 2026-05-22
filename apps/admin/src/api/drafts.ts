import type { Image, PaginateResult } from '~/models/base'
import type {
  DraftHistoryListItem,
  DraftModel,
  DraftRefType,
  TypeSpecificData,
} from '~/models/draft'

import { request } from '~/utils/request'

export interface GetDraftsParams {
  page?: number
  size?: number
  refType?: DraftRefType
  hasRef?: boolean
  sortBy?: string
  sortOrder?: 1 | -1
}

export interface CreateDraftData {
  refType: DraftRefType
  refId?: string
  title?: string
  text?: string
  contentFormat?: 'markdown' | 'lexical'
  content?: string
  images?: Image[]
  meta?: Record<string, any>
  typeSpecificData?: TypeSpecificData
}

export interface UpdateDraftData extends Partial<CreateDraftData> {}

interface ApiResponse<T> {
  data: T
  status?: string
}

interface BackendPaginatedDrafts {
  items?: BackendDraft[]
  data?: BackendDraft[]
  pagination: PaginateResult<DraftModel>['pagination']
}

type BackendDraftHistory = Omit<DraftHistoryListItem, 'savedAt'> & {
  savedAt?: string
  saved_at?: string
}

type BackendDraft = Omit<
  DraftModel,
  '_id' | 'id' | 'createdAt' | 'updatedAt' | 'meta' | 'typeSpecificData' | 'history'
> & {
  _id?: string
  id?: string
  created?: string
  createdAt?: string
  updated?: string
  updatedAt?: string
  modified?: string | null
  meta?: Record<string, any> | string | null
  typeSpecificData?: TypeSpecificData | string | null
  history?: BackendDraftHistory[]
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

function parseJsonObject<T>(value: T | string | null | undefined): T | undefined {
  if (typeof value !== 'string') return value ?? undefined
  if (!value || value === 'null') return undefined

  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

function normalizeHistoryItem(item: BackendDraftHistory): DraftHistoryListItem {
  return {
    ...item,
    savedAt: item.savedAt ?? item.saved_at ?? '',
  }
}

function normalizeDraft(draft: BackendDraft): DraftModel {
  const draftId = draft._id ?? draft.id ?? ''

  return {
    ...draft,
    _id: draft._id ?? draftId,
    id: draftId,
    refType:
      draft.refType === ('pages' as DraftRefType)
        ? DraftRefType.Page
        : draft.refType,
    title: draft.title ?? '',
    text: draft.text ?? '',
    version: draft.version ?? 1,
    createdAt: draft.createdAt ?? draft.created ?? '',
    updatedAt: draft.updatedAt ?? draft.updated ?? draft.modified ?? draft.created ?? '',
    meta: parseJsonObject<Record<string, any>>(draft.meta),
    typeSpecificData: parseJsonObject<TypeSpecificData>(
      draft.typeSpecificData,
    ),
    history: (draft.history ?? []).map(normalizeHistoryItem),
  }
}

function normalizeDraftListResponse(
  response:
    | PaginateResult<DraftModel>
    | ApiResponse<BackendPaginatedDrafts>,
): PaginateResult<DraftModel> {
  const payload = unwrapApiResponse(
    response as ApiResponse<BackendPaginatedDrafts>,
  )
  const items = payload.items ?? payload.data ?? []

  return {
    data: items.map(normalizeDraft),
    pagination: payload.pagination,
  }
}

function normalizeDraftResponse(response: DraftModel | ApiResponse<BackendDraft>) {
  return normalizeDraft(unwrapApiResponse(response as ApiResponse<BackendDraft>))
}

function normalizeHistoryResponse(
  response: DraftHistoryListItem[] | ApiResponse<BackendDraftHistory[]>,
) {
  return unwrapApiResponse(
    response as ApiResponse<BackendDraftHistory[]>,
  ).map(normalizeHistoryItem)
}

export const draftsApi = {
  // 获取草稿列表
  getList: async (params?: GetDraftsParams) => {
    const response = await request.get<ApiResponse<BackendPaginatedDrafts>>(
      '/drafts',
      { bypassTransform: true, params },
    )
    return normalizeDraftListResponse(response)
  },

  // 获取单个草稿
  getById: async (id: string) => {
    const response = await request.get<ApiResponse<BackendDraft>>(
      `/drafts/${id}`,
      { bypassTransform: true },
    )
    return normalizeDraftResponse(response)
  },

  // 根据引用获取草稿
  getByRef: async (refType: DraftRefType, refId: string) => {
    const response = await request.get<ApiResponse<BackendDraft | null>>(
      `/drafts/by-ref/${refType}/${refId}`,
      { bypassTransform: true },
    )
    const draft = unwrapApiResponse(response)
    return draft ? normalizeDraft(draft) : null
  },

  // 获取新草稿列表（无关联的草稿）
  getNewDrafts: async (refType: DraftRefType) => {
    const response = await request.get<ApiResponse<BackendDraft[]>>(
      `/drafts/by-ref/${refType}/new`,
      { bypassTransform: true },
    )
    return unwrapApiResponse(response).map(normalizeDraft)
  },

  // 获取历史版本列表
  getHistory: async (id: string) => {
    const response = await request.get<ApiResponse<BackendDraftHistory[]>>(
      `/drafts/${id}/history`,
      { bypassTransform: true },
    )
    return normalizeHistoryResponse(response)
  },

  // 获取特定历史版本
  getHistoryVersion: async (id: string, version: number) => {
    const response = await request.get<ApiResponse<BackendDraft>>(
      `/drafts/${id}/history/${version}`,
      { bypassTransform: true },
    )
    return normalizeDraftResponse(response)
  },

  // 创建草稿
  create: async (data: CreateDraftData) => {
    const response = await request.post<ApiResponse<BackendDraft>>('/drafts', {
      bypassTransform: true,
      data,
    })
    return normalizeDraftResponse(response)
  },

  // 更新草稿
  update: async (id: string, data: UpdateDraftData) => {
    const response = await request.put<ApiResponse<BackendDraft>>(
      `/drafts/${id}`,
      { bypassTransform: true, data },
    )
    return normalizeDraftResponse(response)
  },

  // 删除草稿
  delete: (id: string) => request.delete<{ success: boolean }>(`/drafts/${id}`),

  // 恢复到特定版本
  restoreVersion: async (id: string, version: number) => {
    const response = await request.post<ApiResponse<BackendDraft>>(
      `/drafts/${id}/restore/${version}`,
      { bypassTransform: true },
    )
    return normalizeDraftResponse(response)
  },
}
