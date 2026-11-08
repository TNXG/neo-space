import assert from "node:assert/strict";
import { test } from "node:test";
import { extractTOC } from "../src/lib/content/toc";

// Parsing only Markdown headings loses authored HTML targets and desynchronizes duplicate slugs.
test("TOC includes HTML headings and preserves their explicit IDs", async () => {
  const content = '<h2 id="安装:中文">安装 <em>说明</em></h2>\n\n<h3>重复</h3>\n\n## 重复\n\n##### 深层标题';
  assert.deepEqual(await extractTOC(content), [
    { id: "安装:中文", title: "安装 说明", depth: 2 },
    { id: "重复", title: "重复", depth: 3 },
    { id: "重复-1", title: "重复", depth: 2 },
    { id: "深层标题", title: "深层标题", depth: 5 },
  ]);
});

// GFM strikethrough and inline HTML must be parsed before deriving the target ID.
test("TOC IDs reflect the same formatted heading text as the body", async () => {
  assert.deepEqual(await extractTOC('## ~~旧~~ <em>新</em> `API`\n\n## ~~旧~~ <em>新</em> `API`'), [
    { id: "旧-新-api", title: "旧 新 API", depth: 2 },
    { id: "旧-新-api-1", title: "旧 新 API", depth: 2 },
  ]);
});
