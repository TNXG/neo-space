/**
 * API Response Types
 */

export interface ApiResponse<T = unknown> {
  code: number;
  status: "success" | "failed";
  message: string;
  data: T;
}

export interface Pagination {
  total: number;
  current_page: number;
  total_page: number;
  size: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: Pagination;
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

/**
 * Data Models
 */

export interface Post {
  _id: string;
  title: string;
  text: string;
  slug: string;
  categoryId: string;
  category?: Category;
  summary?: string;
  /** AI 生成的摘要 */
  aiSummary?: string;
  tags: string[];
  created: string;
  modified?: string;
  allowComment: boolean;
  isPublished: boolean;
  copyright: boolean;
  meta?: string;
  images: PostImage[];
}

export interface PostImage {
  src: string;
  height?: number;
  width?: number;
  type?: string;
}

export interface Note {
  _id: string;
  nid: number;
  title: string;
  text: string;
  created: string;
  modified?: string;
  mood?: string;
  weather?: string;
  location?: string;
  allowComment: boolean;
  isPublished: boolean;
  bookmark: boolean;
  images: NoteImage[];
  aiSummary?: string;
}

export interface NoteImage {
  src: string;
  height?: number;
  width?: number;
  type?: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  type: number;
  created: string;
}

/**
 * 友链状态
 * - 0: 正常
 * - 1: 待审核
 * - 2: 过时/失效
 * - 3: 封禁
 * - 4: 拒绝
 */
export const LinkState = {
  NORMAL: 0,
  PENDING: 1,
  OUTDATED: 2,
  BANNED: 3,
  REJECTED: 4,
} as const;

export type LinkStateType = typeof LinkState[keyof typeof LinkState];

/**
 * 友链类型
 * - 0: 朋友（默认）
 * - 1: 收藏
 */
export const LinkType = {
  FRIEND: 0,
  COLLECTION: 1,
} as const;

export type LinkTypeValue = typeof LinkType[keyof typeof LinkType];

/**
 * 部署服务商类型
 */
export enum HostingProvider {
  Vercel = "vercel",
  Cloudflare = "cloudflare",
  Netlify = "netlify",
  GitHub = "github",
  Render = "render",
  Railway = "railway",
  Fly = "fly",
  Heroku = "heroku",
  AWS = "aws",
  Azure = "azure",
  GCP = "gcp",
  Aliyun = "aliyun",
  Tencent = "tencent",
  Nginx = "nginx",
  Caddy = "caddy",
  Apache = "apache",
  Unknown = "unknown",
}

/**
 * 友链健康状态
 */
export interface LinkHealthStatus {
  /** 友链 ID */
  link_id: string;
  /** 友链 URL */
  url: string;
  /** 是否存活 */
  is_alive: boolean;
  /** HTTP 状态码 */
  status_code?: number;
  /** 响应延迟（毫秒） */
  latency_ms?: number;
  /** 部署服务商 */
  hosting_provider: HostingProvider;
  /** 检查时间 */
  checked_at: string;
  /** 错误信息 */
  error_message?: string;
  /** 是否为过期数据（正在后台刷新） */
  is_stale: boolean;
}

/**
 * 友链（含健康状态）
 */
export interface Link {
  _id: string;
  name: string;
  url: string;
  avatar: string;
  description: string;
  state: LinkStateType;
  type: LinkTypeValue;
  created: string;
  rssurl?: string;
  techstack?: string[];
  /** 健康状态（可选，仅在 /api/links 接口返回） */
  health?: LinkHealthStatus;
}

/**
 * 友链申请请求
 */
export interface LinkApplyRequest {
  name: string;
  url: string;
  avatar: string;
  description: string;
  email: string;
  rssurl?: string;
  techstack?: string[];
}

export interface Activity {
  _id: string;
  type: number;
  payload: string;
  created: string;
}

export interface Recently {
  _id: string;
  content: string;
  up: number;
  down: number;
  created: string;
  ref_id?: string;
  refType?: string;
}

/** 带预渲染内容的 Recently（用于首页） */
export interface RecentlyWithRendered extends Recently {
  renderedContent: React.ReactNode;
}

export interface UserSocialIds {
  github?: string;
  bilibili?: string;
  netease?: string;
  twitter?: string;
  telegram?: string;
  mail?: string;
  rss?: string;
}

export interface User {
  _id: string;
  username: string;
  name: string;
  introduce: string;
  avatar: string;
  mail: string;
  url: string;
  created: string;
  last_login_time: string;
  socialIds?: UserSocialIds;
}

export interface Reader {
  _id: string;
  email: string;
  name: string;
  handle: string;
  image: string;
  isOwner: boolean;
  emailVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  _id: string;
  title: string;
  text: string;
  slug: string;
  created: string;
  allowComment: boolean;
  commentsIndex: number;
}

/**
 * Time Capsule - 文章时效性分析
 */
export type TimeSensitivity = "high" | "medium" | "low";

export interface TimeCapsuleResponse {
  sensitivity: TimeSensitivity;
  reason: string;
  markers: string[];
  isNew: boolean;
}

export interface TimeCapsuleRequest {
  refId: string;
  refType?: "post" | "note" | "page";
}

/**
 * Site Configuration (from options collection)
 */

export interface SeoOptions {
  title: string;
  description: string;
  keywords: string[];
}

export interface UrlOptions {
  wsUrl?: string;
  adminUrl?: string;
  serverUrl?: string;
  webUrl?: string;
}

export interface FeatureListOptions {
  emailSubscribe: boolean;
}

export interface FriendLinkOptions {
  allowApply: boolean;
  allowSubPath: boolean;
}

export interface CommentOptionsPublic {
  disableComment: boolean;
  disableNoChinese: boolean;
}

export interface OAuthProvider {
  type: string;
  enabled: boolean;
}

export interface OAuthPublicOptions {
  providers: OAuthProvider[];
  github_client_id?: string;
}

export interface AlgoliaPublicOptions {
  enable: boolean;
  appId?: string;
  indexName?: string;
}

export interface AdminExtraPublic {
  title?: string;
  background?: string;
}

export interface SiteConfig {
  seo: SeoOptions;
  url: UrlOptions;
  features: FeatureListOptions;
  friend_link: FriendLinkOptions;
  comment: CommentOptionsPublic;
  oauth: OAuthPublicOptions;
  algolia: AlgoliaPublicOptions;
  admin_extra: AdminExtraPublic;
}

/**
 * Comment Types
 */

/**
 * 评论状态常量
 * - 0: 未读 + 正常
 * - 1: 已读 + 正常
 * - 2: 垃圾评论
 * - 3: 待审核
 */
export const CommentState = {
  UNREAD: 0,
  READ: 1,
  SPAM: 2,
  PENDING: 3,
} as const;

export type CommentStateType = typeof CommentState[keyof typeof CommentState];

/**
 * 用户代理信息（浏览器/系统）
 */
export interface UAInfo {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: "mobile" | "desktop";
}

export interface Comment {
  _id: string;
  ref: string;
  refType: "posts" | "pages" | "notes";
  author: string;
  text: string;
  /** 评论状态: 0=未读+正常, 1=已读+正常, 2=垃圾, 3=待审核 */
  state: CommentStateType;
  children: Comment[];
  commentsIndex: number;
  key: string;
  pin: boolean;
  /** 悄悄说功能（仅评论者和管理员可见） */
  isWhispers: boolean;
  isAdmin?: boolean;
  source?: string;
  avatar?: string;
  created: string;
  location?: string;
  url?: string;
  parent?: string;
  /** 用户代理信息（浏览器/系统） */
  ua?: UAInfo;
}

export interface CommentListResponse {
  comments: Comment[];
  count: number;
}

export interface CreateCommentRequest {
  ref: string;
  refType: "posts" | "pages" | "notes";
  author: string;
  mail: string;
  text: string;
  url?: string;
  parent?: string;
  /** Cloudflare Turnstile token (仅非登录用户需要) */
  turnstileToken?: string;
  /** 用户代理信息（浏览器/系统） */
  ua?: UAInfo;
}

export interface UpdateCommentRequest {
  text: string;
}
