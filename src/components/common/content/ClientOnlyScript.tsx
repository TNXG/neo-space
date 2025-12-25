"use client";

import { useEffect, useRef } from "react";
import { useHasMounted } from "@/hook/use-has-mounted";

interface ClientOnlyScriptProps {
	children: React.ReactNode;
	src?: string;
	type?: string;
	node?: any;
	[key: string]: any;
}

export function ClientOnlyScript({ children, node: _node, src, type, ...props }: ClientOnlyScriptProps) {
	const isMounted = useHasMounted();
	const scriptRef = useRef<HTMLScriptElement>(null);

	useEffect(() => {
		if (!isMounted || !scriptRef.current)
			return;

		// 创建新的 script 元素来确保执行
		const script = document.createElement("script");

		// 复制所有属性
		if (src)
			script.src = src;
		if (type)
			script.type = type;
		Object.keys(props).forEach((key) => {
			if (key !== "children") {
				script.setAttribute(key, props[key]);
			}
		});

		// 设置脚本内容
		if (children && typeof children === "string") {
			script.textContent = children;
		} else if (children) {
			// 如果 children 不是字符串，尝试提取文本内容
			const textContent = scriptRef.current.textContent;
			if (textContent) {
				script.textContent = textContent;
			}
		}

		// 插入到当前位置并执行
		scriptRef.current.parentNode?.insertBefore(script, scriptRef.current);

		// 清理函数
		return () => {
			if (script.parentNode) {
				script.parentNode.removeChild(script);
			}
		};
	}, [isMounted, src, type, children, props]);

	// 服务端渲染时返回空的 script 标签（不会执行）
	if (!isMounted) {
		return <script ref={scriptRef} suppressHydrationWarning />;
	}

	// 客户端渲染时返回占位符 script 标签
	return <script ref={scriptRef} suppressHydrationWarning>{children}</script>;
}
