import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { markdownBaseRehypePlugins, markdownRemarkPlugins } from "@/components/common/markdown/markdown-pipeline";

export interface TOCItem {
  id: string;
  title: string;
  depth: number;
}

/**
 * 从与正文相同的 HAST 管线提取标题，保留 HTML ID 与重复标题的 slug 顺序。
 * @param content Markdown / HTML 正文
 * @returns 与正文 DOM 对应的目录
 */
export async function extractTOC(content: string): Promise<TOCItem[]> {
  const processor = unified()
    .use(remarkParse)
    .use(markdownRemarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(markdownBaseRehypePlugins);
  const tree = await processor.run(processor.parse(content));

  const toc: TOCItem[] = [];

  visit(tree, "element", (node) => {
    if (!/^h[1-6]$/.test(node.tagName) || typeof node.properties.id !== "string")
      return;
    let title = "";
    visit(node, "text", (text) => { title += text.value; });
    if (!title.trim())
      return;

    toc.push({
      id: node.properties.id,
      title,
      depth: Number(node.tagName[1]),
    });
  });

  return toc;
}
