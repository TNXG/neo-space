/**
 * CommentForm 相关类型定义
 */

export interface OwOItem {
  text: string;
  icon: string; // 直接的图片 URL
}

export interface OwOPackage {
  type: string;
  container: OwOItem[];
}

export type OwOResponse = Record<string, OwOPackage>;

/**
 * OwO 表情映射表，用于解析特殊语法
 * 格式: { "表情名": "图片URL" }
 */
export type OwOEmojiMap = Record<string, string>;

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
