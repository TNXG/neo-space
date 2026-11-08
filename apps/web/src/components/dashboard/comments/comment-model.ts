import type { Comment } from "@/types/api";
import type { DashboardCommentReply } from "@/types/dashboard-comments";

/** Keep a refreshed list on its current page unless that page no longer exists. */
export function commentPageAfterRefresh(page: number, totalPages: number): number {
  return Math.max(1, Math.min(page, Math.max(1, totalPages)));
}

/** Find a comment anywhere in a complete thread without changing its structure. */
export function findThreadComment(root: Comment, _id: string): Comment | null {
  if (root._id === _id) return root;
  for (const child of root.children) {
    const match = findThreadComment(child, _id);
    if (match) return match;
  }
  return null;
}

/** Return the containing root, preserving ancestors and siblings of the selection. */
export function findCommentThread(
  roots: Comment[],
  selected: { _id: string; rootCommentId?: string | null },
): Comment | null {
  for (const root of roots) {
    if (findThreadComment(root, selected._id)) return root;
  }
  return roots.find((root) => root._id === selected.rootCommentId) ?? null;
}

/** Count the root and every descendant in a thread. */
export function countThreadComments(root: Comment): number {
  return 1 + root.children.reduce((count, child) => count + countThreadComments(child), 0);
}

/** Narrow a document reference type to the public comment API contract. */
export function isCommentRefType(value: string): value is "posts" | "pages" | "notes" {
  return value === "posts" || value === "pages" || value === "notes";
}

/** Translate legacy admin reference types while replying to the selected comment. */
export function commentReplyInput(
  selected: { _id: string; ref: string; refType: string },
  text: string,
): DashboardCommentReply | null {
  const refType = selected.refType === "post" ? "posts"
    : selected.refType === "page" ? "pages"
      : selected.refType === "note" ? "notes" : selected.refType;
  if (!isCommentRefType(refType)) return null;
  return { ref: selected.ref, refType, parent: selected._id, text };
}

/** Accept only same-origin absolute paths, never schemes or URL authority syntax. */
export function safeCommentPath(value: string | null | undefined): string | null {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) {
    return null;
  }
  return value;
}
