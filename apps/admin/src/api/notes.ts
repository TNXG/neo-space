import type { PaginateResult } from "~/models/base";
import type { NoteModel } from "~/models/note";

import { request } from "~/utils/request";

export interface GetNotesParams {
  page?: number;
  size?: number;
  select?: string;
  sortBy?: string;
  sortOrder?: number;
  db_query?: Record<string, boolean>;
}

export interface CreateNoteData {
  title: string;
  text: string;
  slug?: string;
  mood?: string;
  weather?: string;
  password?: string | null;
  publicAt?: Date | null;
  bookmark?: boolean;
  location?: string | null;
  coordinates?: { longitude: number; latitude: number } | null;
  topicId?: string | null;
  isPublished?: boolean;
  meta?: Record<string, unknown>;
  /** 关联的草稿 ID，发布时传递以标记草稿为已发布 */
  draftId?: string;
}

export interface UpdateNoteData extends Partial<CreateNoteData> {}

// 用于 patch 操作的数据类型，允许将某些字段设为 null
export interface PatchNoteData {
  topicId?: string | null;
  slug?: string | null;
  [key: string]: unknown;
}

interface BackendNote extends Partial<NoteModel> {
  _id?: string;
  created?: string;
  modified?: string | null;
  count?: {
    read?: number;
    like?: number;
  } | null;
  readCount?: number;
  likeCount?: number;
}

interface ApiResponseData<T> {
  data: T;
}

interface BackendPaginatedNotes {
  items?: BackendNote[];
  pagination?: PaginateResult<NoteModel>["pagination"];
}

const unwrapData = <T>(response: T | ApiResponseData<T>): T =>
  response && typeof response === "object" && "data" in response
    ? (response as ApiResponseData<T>).data
    : response as T;

const normalizeNote = (note: BackendNote): NoteModel => {
  if (!note._id) {
    throw new Error("Note response missing _id");
  }

  return {
    ...note,
    _id: note._id,
    createdAt: note.createdAt ?? note.created ?? "",
    modifiedAt: note.modifiedAt ?? note.modified ?? null,
    readCount: note.readCount ?? note.count?.read ?? 0,
    likeCount: note.likeCount ?? note.count?.like ?? 0,
  } as NoteModel;
};

const normalizePaginatedNotes = (
  response: ApiResponseData<BackendPaginatedNotes> | BackendPaginatedNotes,
): PaginateResult<NoteModel> => {
  const data = unwrapData(response);

  return {
    data: (data.items ?? []).map(normalizeNote),
    pagination: data.pagination ?? {
      total: 0,
      size: 0,
      currentPage: 1,
      totalPage: 0,
      hasPrevPage: false,
      hasNextPage: false,
    },
  };
};

export const notesApi = {
  // 获取日记列表
  getList: async (params?: GetNotesParams) => {
    const response = await request.get<
      ApiResponseData<BackendPaginatedNotes> | BackendPaginatedNotes
    >("/notes", { params, bypassTransform: true });
    return normalizePaginatedNotes(response);
  },

  // 获取单篇日记
  getById: async (_id: string, params?: { single?: boolean }) => {
    const response = await request.get<ApiResponseData<BackendNote> | BackendNote>(
      `/notes/${_id}`,
      { params, bypassTransform: true },
    );
    return normalizeNote(unwrapData(response));
  },

  // 创建日记
  create: async (data: CreateNoteData) => {
    const response = await request.post<ApiResponseData<BackendNote> | BackendNote>(
      "/notes",
      { data, bypassTransform: true },
    );
    return normalizeNote(unwrapData(response));
  },

  // 更新日记
  update: async (_id: string, data: UpdateNoteData) => {
    const response = await request.put<ApiResponseData<BackendNote> | BackendNote>(
      `/notes/${_id}`,
      { data, bypassTransform: true },
    );
    return normalizeNote(unwrapData(response));
  },

  // 删除日记
  delete: (_id: string) => request.delete<void>(`/notes/${_id}`),

  // 更新部分字段
  patch: async (_id: string, data: PatchNoteData) => {
    const response = await request.patch<ApiResponseData<BackendNote> | BackendNote>(
      `/notes/${_id}`,
      { data, bypassTransform: true },
    );
    return normalizeNote(unwrapData(response));
  },

  // 更新发布状态
  patchPublish: async (_id: string, isPublished: boolean) => {
    const response = await request.patch<ApiResponseData<BackendNote> | BackendNote>(
      `/notes/${_id}/publish`,
      { data: { isPublished }, bypassTransform: true },
    );
    return normalizeNote(unwrapData(response));
  },

  // 获取专栏下的日记列表
  getByTopic: async (
    topicId: string,
    params?: { page?: number; size?: number },
  ) => {
    const response = await request.get<
      ApiResponseData<BackendPaginatedNotes> | BackendPaginatedNotes
    >(
      `/notes/topics/${topicId}`,
      { params, bypassTransform: true },
    );
    return normalizePaginatedNotes(response);
  },
};
