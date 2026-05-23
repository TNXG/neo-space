import type { UserModel } from "~/models/user";

import {
  clearAdminAuthToken,
  getAdminAuthToken,
  isAdminTokenValid,
  setAdminAuthToken,
} from "~/utils/admin-auth";
import { request } from "~/utils/request";

export interface LoginData {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserModel;
}

export interface UpdateOwnerData {
  name?: string;
  username?: string;
  mail?: string;
  url?: string;
  avatar?: string;
  introduce?: string;
  socialIds?: Record<string, string | number>;
}

export interface Session {
  id: string;
  token: string;
  ua: string;
  ip: string;
  lastActiveAt: string;
  current?: boolean;
}

export interface AllowLoginResponse {
  password: boolean;
  passkey: boolean;
  github?: boolean;
  qq?: boolean;
  google?: boolean;
  [key: string]: boolean | undefined;
}

interface ApiEnvelope<T> {
  data: T;
}

export const userApi = {
  // 获取当前 Owner 信息
  getOwner: async () => {
    const response = await request.get<ApiEnvelope<UserModel>>("/user/profile");
    return response.data;
  },

  // 检查是否已登录（只校验本地 JWT，不引入服务端 session）
  checkLogged: async () => {
    const token = getAdminAuthToken();
    if (!isAdminTokenValid(token)) {
      clearAdminAuthToken();
      return { ok: 0 };
    }

    return { ok: 1 };
  },

  // 用户名密码登录（单次请求，后端校验 bcrypt 并写 JWT Cookie）
  loginWithPassword: async (data: LoginData) => {
    const response = await request.post<ApiEnvelope<LoginResponse>>(
      "/auth/tokens",
      {
        data: {
          username: data.username,
          password: data.password,
        },
      },
    );

    setAdminAuthToken(response.data.token);
    return response.data;
  },

  // 获取允许的登录方式
  getAllowLogin: async () => {
    const response
      = await request.get<ApiEnvelope<AllowLoginResponse>>("/owner/allow-login");
    return response.data;
  },

  // 更新 Owner 信息
  updateOwner: (data: UpdateOwnerData) =>
    request.patch<UserModel>("/user/profile", { data }),

  // 登出当前会话
  logout: async () => {
    try {
      await request.delete<ApiEnvelope<void>>("/auth/tokens");
    } finally {
      clearAdminAuthToken();
    }
  },

  // JWT 不保留服务端 session 列表。
  getSessions: async () => [] as Session[],

  // 删除指定会话
  deleteSession: async (_token: string) => {
    clearAdminAuthToken();
  },

  // 删除所有其他会话
  deleteAllSessions: async () => {},
};
