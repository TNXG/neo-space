/**
 * API 请求和响应类型定义
 * 定义所有 API 端点的请求参数和响应格式
 */

// ============ 响应格式 ============

export enum ResponseStatus {
  Success = "success",
  Failed = "failed",
}

export interface ApiResponse<T> {
  code: number;
  status: ResponseStatus;
  message: string;
  data: T;
}

export interface PaginationMeta {
  total: number;
  current_page: number;
  total_page: number;
  size: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

// ============ 请求参数 ============

export interface PaginationParams {
  page?: number;
  size?: number;
}

export interface FilterParams {
  [key: string]: any;
}

export interface SortParams {
  sortBy?: string;
  order?: "asc" | "desc";
}

export interface ListQueryParams extends PaginationParams, SortParams {
  [key: string]: any;
}

// ============ Posts API ============

export interface PostsListQuery extends ListQueryParams {
  category?: string;
  tag?: string;
}

export interface AdjacentPosts {
  prev: any | null;
  next: any | null;
}

// ============ Notes API ============

export interface NotesListQuery extends ListQueryParams {
  mood?: string;
  weather?: string;
}

// ============ Links API ============

export interface LinkApplicationRequest {
  name: string;
  url: string;
  avatar: string;
  description: string;
  email: string;
}

export interface VerificationCodeRequest {
  email: string;
}

// ============ Comments API ============

export interface CommentsListQuery extends ListQueryParams {
  refId?: string;
  refType?: string;
  author?: string;
  status?: string;
}

export interface CreateCommentRequest {
  author: string;
  email: string;
  text: string;
  refId: string;
  refType: "post" | "note" | "page";
  parentId?: string;
}

export interface UpdateCommentRequest {
  text?: string;
  status?: "pending" | "approved" | "spam";
}

// ============ Auth API ============

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface OAuthCallbackQuery {
  code: string;
  state?: string;
}

export interface BindAccountRequest {
  token: string;
  provider: string;
}

// ============ AI API ============

export interface TimeCapsuleAnalyzeRequest {
  refId: string;
  refType: "post" | "note";
  content: string;
}

// ============ WebSocket Messages ============

export type OwnerDesktopMessageType = "window_info" | "media_playback" | "upload_artwork" | "upload_artwork_meta";

export interface OwnerDesktopMessage {
  type: OwnerDesktopMessageType;
  data?: any;
}

export type ServerToOwnerMessageType = "connected" | "error" | "artwork_uploaded";

export interface ServerToOwnerMessage {
  type: ServerToOwnerMessageType;
  message?: string;
  data?: any;
}

// ============ SSE Events ============

export type SSEEventType = "connected" | "owner_window_info" | "owner_media_playback" | "new_post" | "new_comment" | "status_update";

export interface SSEEvent {
  type: SSEEventType;
  data?: any;
}
