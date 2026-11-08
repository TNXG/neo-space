import type { Root, RootContent } from "hast";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const parser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw);
const IGNORED_ELEMENTS = ["pre", "code", "script", "style", "textarea", "template"];

/** Collect actual Markdown/reference/HTML image sources, excluding code and deduplicating original URLs. */
export const collectContentImageSources = (text: string): string[] => {
  const tree = parser.runSync(parser.parse(text)) as Root;
  const sources = new Set<string>();
  /** Walk rendered elements; custom gallery containers retain their ordinary image children. */
  const walk = (node: Root | RootContent): void => {
    if (node.type === "element") {
      if (IGNORED_ELEMENTS.includes(node.tagName)) return;
      if (node.tagName === "img" && typeof node.properties.src === "string" && node.properties.src) {
        sources.add(node.properties.src);
      }
    }
    if ("children" in node) node.children.forEach(walk);
  };
  walk(tree);
  return [...sources];
};
