/**
 * 通用类型定义
 * 定义跨模块使用的通用类型
 */

// ============ 配置类型 ============

export interface MongoDBConfig {
  uri?: string; // MongoDB 连接 URI（优先使用）
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string; // 数据库名称
  directConnection?: boolean;
  // 连接池配置
  poolSize?: {
    min?: number; // 最小连接数
    max?: number; // 最大连接数
  };
}

export interface ServerConfig {
  port: number;
  host: string;
  frontendUrl?: string; // 前端 URL，用于 OAuth 回调重定向
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
}

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl?: string;
  redirectUri?: string; // OAuth 重定向 URI
}

export interface OAuthConfig {
  github: OAuthProviderConfig;
  google: OAuthProviderConfig;
  qq?: OAuthProviderConfig; // QQ OAuth 配置（可选）
}

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from?: string;
}

export interface AppConfig {
  mongodb: MongoDBConfig;
  server: ServerConfig;
  jwt: JWTConfig;
  oauth: OAuthConfig;
  email: EmailConfig;
}

// ============ 数据库操作选项 ============

export interface DBQueryOptions {
  skip?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  projection?: Record<string, 0 | 1>;
}

// ============ 缓存选项 ============

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

// ============ 工具类型 ============

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// ============ 事件总线类型 ============

export interface OwnerState {
  windowInfo?: any;
  mediaPlayback?: {
    metadata: any;
    playbackState: any;
  };
  lastUpdate: number;
}

export type SSEHandler = (event: string, data: any) => void;
