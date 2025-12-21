"use client";

import type { Reader } from "@/types/api";
import process from "node:process";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
	user: Reader | null;
	token: string | null;
	isAuthenticated: boolean;
	isHydrated: boolean;
	setAuth: (user: Reader, token: string) => void;
	clearAuth: () => void;
	fetchUser: () => Promise<void>;
	setHydrated: (hydrated: boolean) => void;
}

/**
 * 认证状态管理 Store
 *
 * 功能：
 * - 管理用户登录状态和 JWT token
 * - 使用 localStorage 持久化 token 和用户信息
 * - 提供登录、登出和获取用户信息的方法
 */
export const useAuthStore = create<AuthState>()(
	persist(
		(set, get) => ({
			user: null,
			token: null,
			isAuthenticated: false,
			isHydrated: false,

			/**
			 * 设置认证信息
			 * @param user - 用户信息
			 * @param token - JWT token
			 */
			setAuth: (user: Reader, token: string) => {
				set({
					user,
					token,
					isAuthenticated: true,
				});
			},

			/**
			 * 清除认证信息（登出）
			 */
			clearAuth: () => {
				set({
					user: null,
					token: null,
					isAuthenticated: false,
				});
			},

			/**
			 * 设置 hydration 状态
			 */
			setHydrated: (hydrated: boolean) => {
				set({ isHydrated: hydrated });
			},

			/**
			 * 从后端获取当前用户信息
			 * 需要有效的 token
			 */
			fetchUser: async () => {
				const { token } = get();

				if (!token) {
					console.warn("No token available, cannot fetch user");
					return;
				}

				try {
					const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
					const response = await fetch(`${apiUrl}/auth/me`, {
						headers: {
							Authorization: `Bearer ${token}`,
						},
					});

					if (!response.ok) {
						// Token 无效或过期，清除认证状态
						if (response.status === 401) {
							get().clearAuth();
							throw new Error("Token expired or invalid");
						}
						throw new Error(`Failed to fetch user: ${response.statusText}`);
					}

					const data = await response.json();

					// 更新用户信息，保持 token 不变
					set({
						user: data.data,
						isAuthenticated: true,
					});
				} catch (error) {
					console.error("Failed to fetch user:", error);
					throw error;
				}
			},
		}),
		{
			name: "auth-storage", // localStorage key
			partialize: state => ({
				// 持久化 token 和 user 信息
				token: state.token,
				user: state.user,
				isAuthenticated: state.isAuthenticated,
			}),
			onRehydrateStorage: () => (state) => {
				// 当从 localStorage 恢复状态后，设置 hydrated 为 true
				state?.setHydrated(true);
			},
		},
	),
);
