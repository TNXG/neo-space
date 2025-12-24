/**
 * CommentForm 相关类型定义
 */

export interface OwOItem {
	text: string;
	icon: string;
}

export interface OwOPackage {
	type: string;
	container: OwOItem[];
}

export type OwOResponse = Record<string, OwOPackage>;

export interface CommentFormProps {
	refId: string;
	refType: "posts" | "pages" | "notes";
	parentId?: string;
	onSuccess?: () => void;
	onCancel?: () => void;
	autoFocus?: boolean;
}

export interface GuestUser {
	name: string;
	email: string;
	url: string;
}

export type TurnstileStatus = "loading" | "verifying" | "verified" | "error";
