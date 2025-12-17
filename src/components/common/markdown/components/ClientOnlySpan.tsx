"use client";

import { useSyncExternalStore } from "react";

interface ClientOnlySpanProps {
	id?: string;
	className?: string;
	children: React.ReactNode;
	node?: any;
	[key: string]: any;
}

function getSnapshot() {
	return typeof window !== "undefined";
}

function getServerSnapshot() {
	return false;
}

export function ClientOnlySpan({ children, node: _node, ...props }: ClientOnlySpanProps) {
	const isMounted = useSyncExternalStore(
		() => () => {}, // subscribe function (no-op since we don't need to listen for changes)
		getSnapshot,
		getServerSnapshot,
	);

	// 在服务端渲染和客户端初始渲染时，不包含可能被 JS 修改的属性
	if (!isMounted) {
		return <span>{children}</span>;
	}

	// 客户端水合完成后，渲染完整的 span（过滤掉 node 属性）
	return <span {...props}>{children}</span>;
}
