"use client";

import type { ReactNode } from "react";
import { createContext, use, useCallback, useState } from "react";

interface CommentContextType {
	highlightedId: string | null;
	triggerHighlight: (id: string) => void;
}

const CommentContext = createContext<CommentContextType | null>(null);

export function CommentProvider({ children }: { children: ReactNode }) {
	const [highlightedId, setHighlightedId] = useState<string | null>(null);

	const triggerHighlight = useCallback((id: string) => {
		// 1. 设置当前高亮ID
		setHighlightedId(id);

		// 2. 滚动到该元素 (DOM 操作仅用于滚动)
		const element = document.getElementById(id);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "center" });
		}

		// 3. 3秒后自动清除状态
		setTimeout(() => {
			setHighlightedId(current => (current === id ? null : current));
		}, 3000);
	}, []);

	return (
		<CommentContext value={{ highlightedId, triggerHighlight }}>
			{children}
		</CommentContext>
	);
}

export function useCommentHighlight() {
	const context = use(CommentContext);
	if (!context) {
		throw new Error("useCommentHighlight must be used within a CommentProvider");
	}
	return context;
}
