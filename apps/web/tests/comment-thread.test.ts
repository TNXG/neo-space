import assert from "node:assert/strict";
import { test } from "node:test";
import type { Comment } from "../src/types/api";
import { countThreadComments, findCommentThread, findThreadComment } from "../src/components/dashboard/comments/comment-model";

/** Build a complete API-shaped node with explicit ancestry for conversation boundary checks. */
function node(_id: string, children: Comment[] = []): Comment {
  return { _id, children, ref: "document", refType: "posts", author: _id, text: _id, state: 1, commentsIndex: 0, key: _id, pin: false, isWhispers: false, created: "2026-11-08T00:00:00Z" };
}

/** Selecting a deep reply must preserve both its ancestors and siblings, without unrelated roots. */
test("a nested card opens the complete containing root rather than the leaf subtree", () => {
  const leaf = node("leaf");
  const sibling = node("sibling");
  const branch = node("branch", [leaf]);
  const root = node("root", [branch, sibling]);
  const unrelated = node("unrelated");
  const thread = findCommentThread([unrelated, root], { _id: "leaf", rootCommentId: "unrelated" });
  assert.equal(thread, root);
  assert.equal(thread.children[1], sibling);
  assert.equal(findThreadComment(thread, "leaf"), leaf);
  assert.equal(findThreadComment(thread, "unrelated"), null);
  assert.equal(countThreadComments(thread), 4);
});

/** Missing or removed nodes must never display an unrelated first conversation as their context. */
test("missing selections fall back only to an explicitly matching root", () => {
  const unrelated = node("other");
  const root = node("root");
  assert.equal(findCommentThread([unrelated, root], { _id: "removed", rootCommentId: "root" }), root);
  assert.equal(findCommentThread([unrelated], { _id: "removed", rootCommentId: "root" }), null);
  assert.equal(findCommentThread([unrelated], { _id: "removed" }), null);
  assert.equal(findCommentThread([], { _id: "removed" }), null);
});
