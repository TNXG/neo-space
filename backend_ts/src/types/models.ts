/**
 * 数据模型类型定义
 * 定义所有数据库集合的 TypeScript 接口
 */

// ============ Post (文章) ============

export interface PostImage {
  src?: string;
  height?: number;
  width?: number;
  type?: string;
}

export interface Post {
  _id: string;
  title: string;
  text: string;
  slug: string;
  categoryId: string;
  summary?: string;
  aiSummary?: string;
  tags: string[];
  created: Date;
  modified?: Date;
  allowComment: boolean;
  isPublished: boolean;
  copyright: boolean;
  meta?: string;
  images: PostImage[];
}

export interface PostWithCategory extends Post {
  category?: Category;
}

// ============ Note (日记) ============

export interface NoteImage {
  src?: string;
  height?: number;
  width?: number;
  type?: string;
  accent?: string;
}

export interface NoteCount {
  read: number;
  like: number;
}

export interface Note {
  _id: string;
  nid: number;
  title: string;
  text: string;
  created: Date;
  modified?: Date;
  mood?: string;
  weather?: string;
  location?: string;
  allowComment: boolean;
  isPublished: boolean;
  bookmark: boolean;
  images: NoteImage[];
  commentsIndex: number;
  password?: string;
  publicAt?: Date;
  coordinates?: string;
  count?: NoteCount;
  aiSummary?: string;
}

// ============ Category (分类) ============

export interface Category {
  _id: string;
  name: string;
  slug: string;
  type: number;
  created: Date;
}

export interface CategoryWithCount extends Category {
  count: number;
}

// ============ Link (友链) ============

export type LinkStatus = "pending" | "approved" | "rejected";

export interface Link {
  _id: string;
  name: string;
  url: string;
  avatar: string;
  description: string;
  email?: string;
  status: LinkStatus;
  created: Date;
}

export interface LinkApplication {
  name: string;
  url: string;
  avatar: string;
  description: string;
  email: string;
  verificationCode: string;
}

// ============ User (用户) ============

export type UserRole = "admin" | "user";

// JWT Payload 接口
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number; // issued at
  exp?: number; // expiration
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
  created: Date;
  lastLoginTime: Date;
  socialIds?: UserSocialIds;
}

// Reader 模型（读者/评论者）
export interface Reader {
  _id: string;
  email: string;
  name: string;
  handle: string;
  image: string;
  isOwner: boolean;
  emailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Account 模型（OAuth 账号关联）
export interface Account {
  _id: string;
  userId: string; // 关联的 Reader ID
  provider: string; // "github" | "qq"
  accountId: string; // GitHub user ID 或 QQ openid
  accessToken: string;
  scope?: string;
  oauthName?: string; // OAuth 用户昵称
  oauthEmail?: string; // OAuth 用户邮箱
  oauthAvatar?: string; // OAuth 用户头像
  oauthHandle?: string; // OAuth 用户 handle
  createdAt: Date;
  updatedAt: Date;
}

// Account Response（API 返回格式）
export interface AccountResponse {
  _id: string;
  userId: string;
  provider: string;
  accountId: string;
  accessToken: string;
  scope?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Recently (动态) ============

export type RecentlyType = "status" | "link" | "image";

export interface Recently {
  _id: string;
  content: string;
  up: number;
  down: number;
  created: Date;
  refId?: string;
  refType?: string;
}

// ============ Page (页面) ============

export interface Page {
  _id: string;
  title: string;
  slug: string;
  text: string;
  created: Date;
  modified?: Date;
  order: number;
}

// ============ Comment (评论) ============

export type CommentRefType = "post" | "note" | "page";
export type CommentStatus = "pending" | "approved" | "spam";

export interface Comment {
  _id: string;
  author: string;
  mail: string; // 注意：数据库中使用 mail 而不是 email
  avatar?: string;
  text: string;
  refId: string;
  refType: CommentRefType;
  parentId?: string;
  created: Date;
  status: CommentStatus;
  ip?: string;
  userAgent?: string;
}

// ============ Config (配置) ============

export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  owner: {
    name: string;
    email: string;
    avatar: string;
  };
  social: {
    github?: string;
    twitter?: string;
    email?: string;
  };
  seo: {
    keywords: string[];
    description: string;
  };
}

// ============ AI / Time Capsule (时间胶囊) ============

export type TimeSensitivity = "high" | "medium" | "low";

export interface TimeCapsule {
  _id: string;
  refId: string;
  refType: string;
  sensitivity: TimeSensitivity;
  reason: string;
  markers: string[];
  hash: string;
  created: Date;
}

export interface TimeCapsuleResponse {
  sensitivity: TimeSensitivity;
  reason: string;
  markers: string[];
  isNew: boolean;
}
