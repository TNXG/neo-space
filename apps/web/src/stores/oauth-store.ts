"use client";

import { create } from "zustand";

interface OAuthState {
  /**
   * 是否正在进行 OAuth 登录流程
   */
  isLoading: boolean;

  /**
   * 当前打开的 OAuth 弹窗引用
   */
  popup: Window | null;

  /**
   * 是否已收到来自弹窗的消息回调
   */
  messageReceived: boolean;

  /**
   * 开始 OAuth 登录流程
   */
  startLogin: (popup: Window) => void;

  /**
   * 标记已收到消息回调
   */
  markMessageReceived: () => void;

  /**
   * 结束 OAuth 登录流程
   */
  endLogin: () => void;

  /**
   * 重置状态
   */
  reset: () => void;
}

/**
 * OAuth 登录状态管理 Store
 *
 * 功能：
 * - 管理 OAuth 登录流程的状态（loading、popup、消息接收状态）
 * - 提供统一的状态管理，避免组件间状态不一致
 * - 支持弹窗关闭检测和超时处理
 */
export const useOAuthStore = create<OAuthState>(set => ({
  isLoading: false,
  popup: null,
  messageReceived: false,

  startLogin: (popup: Window) => {
    set({
      isLoading: true,
      popup,
      messageReceived: false,
    });
  },

  markMessageReceived: () => {
    set({ messageReceived: true });
  },

  endLogin: () => {
    set({
      isLoading: false,
      popup: null,
      messageReceived: false,
    });
  },

  reset: () => {
    set({
      isLoading: false,
      popup: null,
      messageReceived: false,
    });
  },
}));
