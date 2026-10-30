import assert from "node:assert/strict";
import { test } from "node:test";

import { collectContentImageSources } from "./image-scan-sources";

test("collects references, inline images, HTML and gallery images once, ignoring code", () => {
  const text = [
    "![first](https://images.test/a.png)",
    "![again](https://images.test/a.png)",
    "![reference][photo]",
    "[photo]: /reference.png \"caption\"",
    "<img src=\"/html.png?x=1&amp;y=2\" alt=\"photo\">",
    "::: gallery",
    "![gallery](/gallery.webp)",
    ":::",
    "`![inline code](/not-an-image.png)`",
    "```md",
    "![code](/also-not.png)",
    "```",
    "<!-- <img src='/comment.png'> -->",
    "<pre><img src='/pre.png'></pre>",
  ].join("\n\n");
  assert.deepEqual(collectContentImageSources(text), [
    "https://images.test/a.png", "/reference.png", "/html.png?x=1&y=2", "/gallery.webp",
  ]);
});

test("HTML sources retain browser-equivalent URL escaping and ignore unresolved references", () => {
  assert.deepEqual(collectContentImageSources("![missing][not-defined]\n\n<img src='/a&#32;b.png'>\n\n<img src=/bare.png>"), [
    "/a b.png", "/bare.png",
  ]);
});
