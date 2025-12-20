"use client";

import { useSyncExternalStore } from "react";

/**
 * Hook to detect if the current viewport is mobile size
 */
export function useIsMobile(breakpoint = 768): boolean {
	// 提示：其实用 matchMedia 监听比 resize 事件性能更高
	const subscribe = (onStoreChange: () => void) => {
		const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
		mql.addEventListener("change", onStoreChange);
		return () => mql.removeEventListener("change", onStoreChange);
	};

	// 2. 客户端快照：如何判断是否为移动端
	const getSnapshot = () => {
		return window.innerWidth < breakpoint;
	};

	// 3. 服务端快照：在服务器上默认为 false (或者你希望的默认值)
	const getServerSnapshot = () => false;

	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
