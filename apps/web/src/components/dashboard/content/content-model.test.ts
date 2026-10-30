import assert from "node:assert/strict";
import { test } from "node:test";
import { changedFields, emptyPage, pageToDraft, postToDraft } from "./content-model";

/** Reordered JSON object keys must not create an unsaved change. */
test("equivalent metadata does not produce a save patch", () => {
  const base = { ...emptyPage(), meta: { custom: { a: 1, b: 2 } } };
  const draft = { ...emptyPage(), meta: { custom: { b: 2, a: 1 } } };
  assert.deepEqual(changedFields(base, draft), {});
});

/** A reverted field must leave no patch; actual whitespace changes still count. */
test("only actual remaining field changes are saved", () => {
  const base = { ...emptyPage(), title: "Title", text: "Hello\n" };
  assert.deepEqual(changedFields(base, { ...base, title: "Title 2" }), { title: "Title 2" });
  assert.deepEqual(changedFields(base, { ...base, title: "Title" }), {});
  assert.deepEqual(changedFields(base, { ...base, text: "Hello\n\n" }), { text: "Hello\n\n" });
});

/** Loading a document cannot discard unrelated metadata before scanning/saving. */
test("post and page drafts preserve existing metadata", () => {
  const meta = { custom: { theme: "stone" } };
  const post = postToDraft({ _id: "p", title: "Title", text: "Text", lang: "zh", sourceLang: "zh", isAiTranslated: false, slug: "title", categoryId: "c", tags: [], created: "2026-10-30", allowComment: true, isPublished: false, copyright: true, images: [], meta });
  const page = pageToDraft({ _id: "p", title: "Title", text: "Text", slug: "title", created: "2026-10-30", allowComment: true, commentsIndex: 0, meta });
  assert.deepEqual(post.meta, meta);
  assert.deepEqual(page.meta, meta);
});
