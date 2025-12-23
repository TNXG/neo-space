"use client";

import { useCallback, useEffect, useRef } from "react";

interface TurnstileWidgetProps {
	onVerify: (token: string) => void;
	onError?: () => void;
	onExpire?: () => void;
	onStatusChange?: (status: "loading" | "verifying" | "verified" | "error") => void;
	/** 外部触发重置的信号，每次值变化时重置 widget */
	resetTrigger?: number;
}

// 从环境变量获取 Turnstile Site Key
// eslint-disable-next-line node/prefer-global/process
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

declare global {
	interface Window {
		turnstile?: {
			render: (container: string | HTMLElement, options: any) => string;
			reset: (widgetId: string) => void;
			remove: (widgetId: string) => void;
			execute: (container: string | HTMLElement, options: any) => void;
		};
		turnstileScriptLoaded?: boolean;
	}
}

/**
 * Cloudflare Turnstile 人机验证组件（非交互式模式）
 * 使用 compact + appearance: "interaction-only" 实现非交互式验证
 * 只在必要时（如检测到可疑行为）才显示验证面板
 *
 * 支持通过 resetTrigger 属性触发重置，每次值变化时会重新生成 token
 */
export function TurnstileWidget({ onVerify, onError, onExpire, onStatusChange, resetTrigger }: TurnstileWidgetProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | null>(null);
	const isInitializedRef = useRef(false);
	const callbacksRef = useRef({ onVerify, onError, onExpire, onStatusChange });

	// 更新回调引用
	useEffect(() => {
		callbacksRef.current = { onVerify, onError, onExpire, onStatusChange };
	}, [onVerify, onError, onExpire, onStatusChange]);

	// 渲染 widget 的函数
	const renderWidget = useCallback(() => {
		if (!containerRef.current || !window.turnstile) {
			return;
		}

		// 清理现有的 widget
		if (widgetIdRef.current) {
			try {
				window.turnstile.remove(widgetIdRef.current);
			} catch (error) {
				console.error("Failed to remove existing widget:", error);
			}
			widgetIdRef.current = null;
		}

		callbacksRef.current.onStatusChange?.("verifying");

		try {
			widgetIdRef.current = window.turnstile.render(containerRef.current, {
				"sitekey": TURNSTILE_SITE_KEY,
				"theme": "light",
				"size": "compact",
				"appearance": "interaction-only",
				"callback": (token: string) => {
					callbacksRef.current.onStatusChange?.("verified");
					callbacksRef.current.onVerify(token);
				},
				"error-callback": () => {
					callbacksRef.current.onStatusChange?.("error");
					callbacksRef.current.onError?.();
				},
				"expired-callback": () => {
					callbacksRef.current.onStatusChange?.("error");
					callbacksRef.current.onExpire?.();
				},
			});
		} catch (error) {
			console.error("Failed to render Turnstile widget:", error);
			callbacksRef.current.onStatusChange?.("error");
			callbacksRef.current.onError?.();
		}
	}, []);

	// 重置 widget 的函数
	const resetWidget = useCallback(() => {
		if (widgetIdRef.current && window.turnstile) {
			try {
				window.turnstile.reset(widgetIdRef.current);
				callbacksRef.current.onStatusChange?.("verifying");
			} catch (error) {
				console.error("Failed to reset Turnstile widget:", error);
				// 如果重置失败，尝试重新渲染
				renderWidget();
			}
		} else {
			// 如果 widget 不存在，重新渲染
			renderWidget();
		}
	}, [renderWidget]);

	// 监听外部重置信号
	useEffect(() => {
		if (resetTrigger && resetTrigger > 0) {
			resetWidget();
		}
	}, [resetTrigger, resetWidget]);

	// 加载脚本并初始化 widget
	useEffect(() => {
		if (isInitializedRef.current || !containerRef.current) {
			return;
		}

		// 通知开始加载
		callbacksRef.current.onStatusChange?.("loading");

		const initWidget = () => {
			if (!containerRef.current || !window.turnstile || isInitializedRef.current) {
				return;
			}

			isInitializedRef.current = true;
			renderWidget();
		};

		// 如果脚本已加载，直接初始化
		if (window.turnstileScriptLoaded && window.turnstile) {
			initWidget();
			return;
		}

		// 检查是否已有脚本在加载
		const existingScript = document.querySelector("script[src*=\"turnstile\"]");
		if (existingScript) {
			const checkLoaded = setInterval(() => {
				if (window.turnstile) {
					window.turnstileScriptLoaded = true;
					initWidget();
					clearInterval(checkLoaded);
				}
			}, 100);
			return () => clearInterval(checkLoaded);
		}

		// 加载新脚本
		const script = document.createElement("script");
		script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
		script.async = true;
		script.defer = true;

		script.onload = () => {
			window.turnstileScriptLoaded = true;
			initWidget();
		};

		script.onerror = () => {
			console.error("Failed to load Turnstile script");
			callbacksRef.current.onStatusChange?.("error");
			callbacksRef.current.onError?.();
		};

		document.head.appendChild(script);

		return () => {
			// 组件卸载时清理 widget
			if (widgetIdRef.current && window.turnstile) {
				try {
					window.turnstile.remove(widgetIdRef.current);
				} catch (error) {
					console.error("Failed to remove Turnstile widget:", error);
				}
				widgetIdRef.current = null;
			}
			isInitializedRef.current = false;
		};
	}, [renderWidget]);

	return <div ref={containerRef} className="hidden" />;
}
