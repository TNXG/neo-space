import { use } from "react";
import { CommentContext } from "./context";

/**
 * 使用评论高亮功能的 Hook
 */
export function useCommentHighlight() {
	const context = use(CommentContext);
	if (!context) {
		throw new Error("useCommentHighlight must be used within a CommentProvider");
	}
	return context;
}

/**
 * 使用评论刷新功能的 Hook
 */
export function useCommentRefresh() {
	const context = use(CommentContext);
	if (!context) {
		throw new Error("useCommentRefresh must be used within a CommentProvider");
	}
	return {
		refreshComments: context.refreshComments,
		setRefreshComments: context.setRefreshComments,
	};
}
