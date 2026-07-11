import { request } from "~/utils/request";

interface ApiResponse<T> {
  code: number;
  status: "success" | "failed";
  message: string;
  data: T | null;
}

export interface BackendPagination {
  total: number;
  current_page: number;
  total_page: number;
  size: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

export interface PaginatedPayload<T> {
  items: T[];
  pagination: BackendPagination;
}

const unwrapApiResponse = <T>(response: ApiResponse<T>): T => {
  if (response.data === null)
    throw new Error(response.message || "接口未返回数据");
  return response.data;
};

export enum AiQueryType {
  TitleSlug = "title-slug",
  Slug = "slug",
}

export interface AIWriterGenerateData {
  type: AiQueryType;
  text?: string;
  title?: string;
}

export interface AIWriterGenerateResponse {
  title?: string;
  slug?: string;
}

export interface AISummary {
  _id: string;
  created: string;
  summary: string;
  hash: string;
  refId: string;
  lang: string;
}

export interface SummaryListResponse {
  items: AISummary[];
  pagination: BackendPagination;
}

export interface ArticleInfo {
  _id: string;
  type: "posts" | "notes" | "pages" | "recently";
  title: string;
}

export interface AITranslation {
  _id: string;
  created: string;
  hash: string;
  refId: string;
  refType: string;
  lang: string;
  sourceLang: string;
  title?: string;
  text?: string;
  summary?: string;
  tags?: string[];
  aiModel?: string;
  aiProvider?: string;
}

export interface GroupedTranslationData {
  article: ArticleInfo;
  translations: AITranslation[];
}

export interface GroupedTranslationResponse {
  items: GroupedTranslationData[];
  pagination: BackendPagination;
}

export interface TranslationByRefResponse {
  translations: AITranslation[];
  article: ArticleInfo | null;
}

export interface ProviderModel {
  id: string;
  name: string;
}

export interface ProviderModelsResponse {
  providerId: string;
  providerName: string;
  providerType: string;
  models: ProviderModel[];
  error?: string;
}

export interface AITestData {
  providerId: string;
  type: string;
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

export interface AIModelListData {
  providerId: string;
  type: string;
  apiKey?: string;
  endpoint?: string;
}

export interface AICommentReviewTestData {
  text: string;
  author?: string;
}

export interface AICommentReviewTestResponse {
  isSpam: boolean;
  score?: number;
  reason?: string;
}

export type TranslationEntryKeyPath
  = | "category.name"
    | "topic.name"
    | "topic.introduce"
    | "note.mood"
    | "note.weather";

export interface TranslationEntry {
  _id: string;
  created: string;
  keyPath: TranslationEntryKeyPath;
  lang: string;
  keyType: "entity" | "dict";
  lookupKey: string;
  sourceText: string;
  translatedText: string;
  sourceUpdatedAt?: string;
}

export interface TranslationEntriesResponse {
  items: TranslationEntry[];
  pagination: BackendPagination;
}

export type TimeSensitivity = "high" | "medium" | "low";

export interface TimeCapsuleRequest {
  refId: string;
  refType: TimeCapsuleContentType;
  lang?: string;
}

export interface GetTimeCapsuleParams {
  refType?: string;
  lang?: string;
}

export interface TimeCapsuleResult {
  sensitivity: TimeSensitivity;
  reason: string;
  markers: string[];
  isNew: boolean;
}

export type TimeCapsuleContentType = "post" | "note" | "page" | "recently";

export interface TimeCapsuleSummary {
  lang: string;
  sensitivity: TimeSensitivity;
  reason: string;
  markers: string[];
  created: string;
}

export interface TimeCapsuleContent {
  _id: string;
  type: TimeCapsuleContentType;
  title: string;
  created: string;
  availableLanguages: string[];
  capsules: TimeCapsuleSummary[];
}

export interface TimeCapsuleContentsResponse {
  items: TimeCapsuleContent[];
  pagination: BackendPagination;
}

export const aiApi = {
  writerGenerate: async (data: AIWriterGenerateData) => {
    const response = await request.post<ApiResponse<AIWriterGenerateResponse>>(
      "/ai/writer/generate",
      { data, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  getSummaries: async (params?: { page?: number; size?: number }) => {
    const response = await request.get<ApiResponse<SummaryListResponse>>(
      "/ai/summaries",
      { params, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  deleteSummary: async (id: string) => {
    await request.delete<ApiResponse<void>>(
      `/ai/summaries/${id}`,
      { bypassTransform: true },
    );
  },

  getTranslationsGrouped: async (params?: {
    page?: number;
    size?: number;
    search?: string;
  }) => {
    const response = await request.get<ApiResponse<GroupedTranslationResponse>>(
      "/ai/translations/grouped",
      { params, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  getTranslationsByRef: async (refId: string, params?: { refType?: string }) => {
    const response = await request.get<ApiResponse<TranslationByRefResponse>>(
      `/ai/translations/ref/${refId}`,
      { params, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  generateTranslations: async (data: {
    refId: string;
    refType: ArticleInfo["type"];
    targetLanguages: string[];
  }) => {
    const response = await request.post<ApiResponse<AITranslation[]>>(
      "/ai/translations/generate",
      { data, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  deleteTranslation: async (id: string) => {
    await request.delete<ApiResponse<void>>(
      `/ai/translations/${id}`,
      { bypassTransform: true },
    );
  },

  updateTranslation: async (
    id: string,
    data: {
      title?: string;
      text?: string;
      summary?: string;
      tags?: string[];
    },
  ) => {
    const response = await request.patch<ApiResponse<AITranslation>>(
      `/ai/translations/${id}`,
      { data, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  getTranslationEntries: async (params?: {
    keyPath?: TranslationEntryKeyPath;
    lang?: string;
    page?: number;
    size?: number;
  }) => {
    const response = await request.get<ApiResponse<TranslationEntriesResponse>>(
      "/ai/translations/entries",
      { params, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  updateTranslationEntry: async (id: string, data: { translatedText: string }) => {
    const response = await request.patch<ApiResponse<TranslationEntry>>(
      `/ai/translations/entries/${id}`,
      { data, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  deleteTranslationEntry: async (id: string) => {
    await request.delete<ApiResponse<void>>(
      `/ai/translations/entries/${id}`,
      { bypassTransform: true },
    );
  },

  analyzeTimeCapsule: async (data: TimeCapsuleRequest) => {
    const response = await request.post<ApiResponse<TimeCapsuleResult>>(
      "/ai/time-capsule",
      { data, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  getTimeCapsuleContents: async (params?: {
    page?: number;
    size?: number;
    search?: string;
    type?: TimeCapsuleContentType;
  }) => {
    const response = await request.get<ApiResponse<TimeCapsuleContentsResponse>>(
      "/ai/time-capsule/contents",
      { params, bypassTransform: true },
    );
    return unwrapApiResponse(response);
  },

  getTimeCapsule: async (refId: string, params?: GetTimeCapsuleParams) => {
    const response = await request.get<ApiResponse<TimeCapsuleResult | null>>(
      `/ai/time-capsule/${refId}`,
      { params, bypassTransform: true },
    );
    return response.data;
  },

  testCommentReview: (_data: AICommentReviewTestData): Promise<AICommentReviewTestResponse> =>
    Promise.reject(new Error("当前后端未提供 AI 评论审核测试接口")),

  getModels: () => Promise.resolve([] as ProviderModelsResponse[]),

  getModelList: (_data: AIModelListData) =>
    Promise.resolve({ models: [] as ProviderModel[], error: undefined as string | undefined }),

  testConfig: (_data: AITestData) =>
    Promise.reject(new Error("当前后端未提供 AI 配置测试接口")),

};
