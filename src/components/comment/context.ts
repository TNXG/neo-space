import { createContext } from "react";

export interface CommentContextType {
	highlightedId: string | null;
	triggerHighlight: (id: string) => void;
	refreshComments: (() => void) | null;
	setRefreshComments: (fn: () => void) => void;
}

export const CommentContext = createContext<CommentContextType | null>(null);
