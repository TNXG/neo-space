import assert from "node:assert/strict";
import { test } from "node:test";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { markdownBaseRehypePlugins, markdownRemarkPlugins } from "../markdown-pipeline";

/** Exercise the published and editor-preview parser chain without fetching external images. */
const render = async (content: string) => {
  const result = await unified()
    .use(remarkParse)
    .use(markdownRemarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(markdownBaseRehypePlugins)
    .use(rehypeStringify)
    .process(content);
  return String(result);
};

// Losing the opening paragraph or splicing the consumed range twice drops photos and following content.
test("grid keeps its first photo and the following document content", async () => {
  const html = await render("前文\n\n::: grid {cols=4}\n![机场](https://example.com/airport.jpg)\n\n![飞行](https://example.com/flight.jpg)\n\n:::\n\n后文");
  assert.match(html, /<div data-container-type="grid"/);
  assert.match(html, /<img src="https:\/\/example.com\/airport.jpg" alt="机场">/);
  assert.match(html, /<img src="https:\/\/example.com\/flight.jpg" alt="飞行">/);
  assert.match(html, /<p>前文<\/p>/);
  assert.match(html, /<\/div>\n<p>后文<\/p>$/);
});

// Editor serialization deliberately does not depend on blank lines around container markers.
test("compact container renders when both markers share the image paragraph", async () => {
  const html = await render("::: grid {cols=4}\n![机场](https://example.com/airport.jpg)\n:::");
  assert.match(html, /<div data-container-type="grid"/);
  assert.match(html, /<img src="https:\/\/example.com\/airport.jpg" alt="机场">/);
  assert.doesNotMatch(html, /:::/);
});

// Repeated mutations used to duplicate one container and delete its next sibling.
test("adjacent containers render once each without consuming the next section", async () => {
  const html = await render("::: info\n\n**第一块**\n\n:::\n\n::: success\n第二块\n:::\n\n## 下一节");
  assert.equal(html.match(/data-container-type="info"/g)?.length, 1);
  assert.equal(html.match(/data-container-type="success"/g)?.length, 1);
  assert.match(html, /<strong>第一块<\/strong>/);
  assert.match(html, /第二块/);
  assert.match(html, /<h2 id="下一节">下一节<\/h2>$/);
});

// A closing marker inside a fenced example must not terminate the surrounding container.
test("fenced container markers remain code and an unclosed container stays literal", async () => {
  const html = await render("::: info\n\n```text\n:::\n```\n\n正文\n\n:::\n\n::: grid {cols=4}\n未结束");
  assert.equal(html.match(/data-container-type=/g)?.length, 1);
  assert.match(html, /<code class="language-text">:::\n<\/code>/);
  assert.match(html, /正文/);
  assert.match(html, /::: grid \{cols=4\}/);
});
