export interface CommentParentPreview {
  _id: string;
  author: string | null;
  text: string;
  isDeleted: boolean;
}

export interface CommentReplyWindow {
  total: number;
  returned: number;
  threshold: number;
  hasHidden: boolean;
  hiddenCount: number;
  nextCursor?: string;
}

export interface CommentAnchor {
  title?: string | null;
  slug?: string | null;
  categorySlug?: string | null;
  nid?: number | null;
  path: string;
}

export interface CommentModel {
  _id: string;
  createdAt: string;
  refType: "post" | "note" | "page" | "recently";
  state: number;
  author: string;
  text: string;
  mail?: string;
  url?: string;
  ip?: string;
  agent?: string;
  pin?: boolean;
  avatar?: string;
  isWhispers?: boolean;
  parentCommentId?: string | null;
  parent?: CommentParentPreview | null;
  rootCommentId?: string | null;
  replyCount?: number;
  latestReplyAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  editedAt?: string | null;
  anchor?: CommentAnchor | null;
  replies?: CommentModel[];
  replyWindow?: CommentReplyWindow;
  ref: string;
}

export enum CommentState {
  Unread,
  Read,
  Junk,
  Pending,
}
