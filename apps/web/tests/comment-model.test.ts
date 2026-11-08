import assert from "node:assert/strict";
import { test } from "node:test";
import { commentPageAfterRefresh, commentReplyInput, safeCommentPath } from "../src/components/dashboard/comments/comment-model";

/** Removing the last record must move to the last real page, never an empty phantom page. */
test("refresh clamps a removed final page without resetting an earlier valid page", () => {
  assert.equal(commentPageAfterRefresh(4, 3), 3);
  assert.equal(commentPageAfterRefresh(2, 5), 2);
  assert.equal(commentPageAfterRefresh(1, 0), 1);
});

/** Singular admin refType values must become the public creation contract, preserving parent _id. */
test("owner replies target the selected comment on its original document", () => {
  assert.deepEqual(commentReplyInput({ _id: "parent", ref: "document", refType: "page" }, "正文"), {
    ref: "document", refType: "pages", parent: "parent", text: "正文",
  });
  assert.equal(commentReplyInput({ _id: "p", ref: "d", refType: "unsupported" }, "正文"), null);
});

/** Backend content paths are data, not permission to navigate to a different origin. */
test("comment context links reject external and protocol-relative locations", () => {
  assert.equal(safeCommentPath("/posts/category/hello"), "/posts/category/hello");
  assert.equal(safeCommentPath("//untrusted.example"), null);
  assert.equal(safeCommentPath("/\\untrusted.example"), null);
  assert.equal(safeCommentPath("javascript:alert(1)"), null);
});
