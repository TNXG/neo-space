/**
 * 配置管理模块
 * 读取环境变量和配置文件，提供统一的配置访问接口
 */

import type { AppConfig } from "@/types/common";

let cachedConfig: AppConfig | null = null;

/**
 * 获取应用配置
 * 从环境变量读取配置，支持缓存
 */
export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // 优先使用 MONGODB_URI，如果没有则使用单独的配置项
  const mongodbUri = process.env.MONGODB_URI;
  let mongodbConfig: AppConfig["mongodb"];

  if (mongodbUri) {
    // 使用 URI 连接
    mongodbConfig = {
      uri: mongodbUri,
      database: process.env.MONGODB_DATABASE || "mx-space",
      poolSize: {
        min: Number.parseInt(process.env.MONGODB_POOL_MIN || "5", 10),
        max: Number.parseInt(process.env.MONGODB_POOL_MAX || "50", 10),
      },
    };
  } else {
    // 使用单独的配置项
    mongodbConfig = {
      host: process.env.MONGODB_HOST || "127.0.0.1",
      port: Number.parseInt(process.env.MONGODB_PORT || "27017", 10),
      user: process.env.MONGODB_USER,
      password: process.env.MONGODB_PASSWORD,
      database: process.env.MONGODB_DATABASE || "mx-space",
      directConnection: process.env.MONGODB_DIRECT_CONNECTION !== "false",
      poolSize: {
        min: Number.parseInt(process.env.MONGODB_POOL_MIN || "5", 10),
        max: Number.parseInt(process.env.MONGODB_POOL_MAX || "50", 10),
      },
    };
  }

  const config: AppConfig = {
    mongodb: mongodbConfig,
    server: {
      port: Number.parseInt(process.env.PORT || "3000", 10),
      host: process.env.HOST || "0.0.0.0",
      frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
    },
    jwt: {
      secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
    oauth: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID || "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
        callbackUrl: process.env.GITHUB_CALLBACK_URL,
        redirectUri: process.env.GITHUB_REDIRECT_URI,
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        callbackUrl: process.env.GOOGLE_CALLBACK_URL,
        redirectUri: process.env.GOOGLE_REDIRECT_URI,
      },
      qq: {
        clientId: process.env.QQ_CLIENT_ID || "",
        clientSecret: process.env.QQ_CLIENT_SECRET || "",
        callbackUrl: process.env.QQ_CALLBACK_URL,
        redirectUri: process.env.QQ_REDIRECT_URI,
      },
    },
    email: {
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: Number.parseInt(process.env.EMAIL_PORT || "587", 10),
      user: process.env.EMAIL_USER || "",
      password: process.env.EMAIL_PASSWORD || "",
      from: process.env.EMAIL_FROM,
    },
  };

  cachedConfig = config;
  return config;
}

/**
 * 清除配置缓存
 * 用于测试或需要重新加载配置的场景
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * 验证配置是否完整
 * 检查必需的配置项是否存在
 */
export function validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 验证 MongoDB 配置
  if (!config.mongodb.host) {
    errors.push("MongoDB host is required");
  }
  if (!config.mongodb.database) {
    errors.push("MongoDB database is required");
  }

  // 验证 JWT 配置
  if (!config.jwt.secret || config.jwt.secret === "your-secret-key-change-in-production") {
    errors.push("JWT secret must be set in production");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
