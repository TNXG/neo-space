"use client";

import type { Comment } from "@/types/api";
import { CommentItem } from "./CommentItem";

interface CommentListProps {
	comments: Comment[];
	refId: string;
	refType: "posts" | "pages" | "notes";
	onRefresh: () => void;
}

export function CommentList({
	comments,
	refId,
	refType,
	onRefresh,
}: CommentListProps) {
	if (!comments || comments.length === 0)
		return null; // Empty state handled in parent

	return (
		<>
			{comments.map(comment => (
				<CommentItem
					key={comment._id}
					comment={comment}
					refId={refId}
					refType={refType}
					onRefresh={onRefresh}
					depth={0}
				/>
			))}
		</>
	);
}
