"use client";

import { useSyncExternalStore } from "react";

/**
 * 订阅函数：由于挂载状态在生命周期内只会从 false 变为 true 且不再改变，
 * 所以我们不需要实际的订阅逻辑。
 */
const emptySubscribe = () => () => {};

/**
 * 一个高性能的 Hook，用于判断当前组件是否已在客户端挂载
 * 替代传统的 const [m, setM] = useState(false); useEffect(() => setM(true), []);
 */
export function useHasMounted() {
	return useSyncExternalStore(
		emptySubscribe,
		// 客户端渲染时返回的值
		() => true,
		// 服务端渲染（SSR）或水合（Hydration）初期返回的值
		() => false,
	);
}
