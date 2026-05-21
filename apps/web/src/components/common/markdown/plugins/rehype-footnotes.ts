import type { Element, ElementContent, Root, Text } from "hast";
import { visit } from "unist-util-visit";
import {
  buildFootnoteItemDomId,
  buildFootnoteRefDomId,
  formatFootnoteLabel,
  normalizeFootnoteId,
  resolveFootnoteRefTargetId,
} from "../../content/Footnote/footnote-utils";

// Static regex patterns to avoid re-compilation
const WHITESPACE_REGEX = /\s+/;
const LAST_WORD_REGEX = /(\S+)(\s*)$/;
const HEADING_TAG_REGEX = /^h\d$/;

function isElement(node: unknown): node is Element {
  return Boolean(node) && typeof node === "object" && (node as Element).type === "element";
}

function getClassNames(node: Element) {
  const className = node.properties.className;
  if (Array.isArray(className))
    return className.map(String);
  if (typeof className === "string")
    return className.split(WHITESPACE_REGEX).filter(Boolean);
  return [];
}

function getProperty(node: Element, key: string) {
  const value = node.properties[key];
  if (Array.isArray(value))
    return String(value[0] ?? "");
  return typeof value === "string" ? value : "";
}

function setTextContent(node: Element, value: string) {
  node.children = [{ type: "text", value } as Text];
}

/**
 * 在脚注引用锚点前的文本节点中，将最后一个词包裹在 data-footnote-anchor span 中，
 * 使读者能直观看到哪个词被脚注标注。
 */
function wrapPrecedingWord(parent: Element, refIndex: number) {
  if (refIndex <= 0)
    return;

  const prevNode = parent.children[refIndex - 1];
  if (!prevNode || prevNode.type !== "text")
    return;

  const text = prevNode.value;
  // 匹配最后一个非空白词（含汉字、标点前的词）
  const lastWordMatch = text.match(LAST_WORD_REGEX);
  if (!lastWordMatch)
    return;

  const wordStart = text.lastIndexOf(lastWordMatch[1]);
  const before = text.slice(0, wordStart);
  const word = lastWordMatch[1];
  const after = lastWordMatch[2];

  const replacements: ElementContent[] = [];
  if (before)
    replacements.push({ type: "text", value: before } as Text);

  replacements.push({
    type: "element",
    tagName: "span",
    properties: { "data-footnote-anchor": "true" },
    children: [{ type: "text", value: word } as Text],
  } as Element);

  if (after)
    replacements.push({ type: "text", value: after } as Text);

  parent.children.splice(refIndex - 1, 1, ...replacements);
}

export const rehypeFootnotes = () => {
  return (tree: Root) => {
    const footnoteRefs = new Map<string, string[]>();
    const footnoteOrder: string[] = [];
    let footnoteRoot: Element | null = null;

    visit(tree, "element", (node, index, parent) => {
      if (!isElement(node))
        return;

      if (node.tagName === "section" && getClassNames(node).includes("footnotes")) {
        footnoteRoot = node;
        node.properties["data-footnotes-root"] = "true";
        node.properties["aria-label"] = getProperty(node, "aria-label") || "Footnotes";

        const firstChild = node.children.find(child => isElement(child) && HEADING_TAG_REGEX.test(child.tagName));
        if (isElement(firstChild)) {
          firstChild.properties.className = ["sr-only"];
          firstChild.properties.id = getProperty(firstChild, "id") || "footnotes-label";
        }
      }

      if (node.tagName === "a") {
        const href = getProperty(node, "href");

        if (href.startsWith("#user-content-fn") || href.startsWith("#fn")) {
          const footnoteId = normalizeFootnoteId(href);
          const refs = footnoteRefs.get(footnoteId) ?? [];
          const refIndex = refs.length + 1;
          const refDomId = buildFootnoteRefDomId(footnoteId, refIndex);
          refs.push(refDomId);
          footnoteRefs.set(footnoteId, refs);
          if (!footnoteOrder.includes(footnoteId))
            footnoteOrder.push(footnoteId);

          node.properties.id = refDomId;
          node.properties.href = `#${buildFootnoteItemDomId(footnoteId)}`;
          node.properties["data-footnote-ref"] = "true";
          node.properties["data-footnote-id"] = footnoteId;
          node.properties["data-footnote-ref-index"] = String(refIndex);
          node.properties["aria-label"] = `Open footnote ${formatFootnoteLabel(footnoteOrder.indexOf(footnoteId) + 1)}`;
          setTextContent(node, formatFootnoteLabel(footnoteOrder.indexOf(footnoteId) + 1));

          // 将引用锚点前的最后一个词包裹进 data-footnote-anchor span
          if (parent && isElement(parent) && typeof index === "number") {
            wrapPrecedingWord(parent, index);
          }
        }

        if ((href.startsWith("#user-content-fnref") || href.startsWith("#fnref")) && parent && isElement(parent)) {
          const footnoteId = normalizeFootnoteId(href);
          const targetRefId = resolveFootnoteRefTargetId(href);
          node.properties.href = `#${targetRefId}`;
          node.properties["data-footnote-backref"] = "true";
          node.properties["data-footnote-id"] = footnoteId;
          node.properties["data-footnote-target-ref"] = targetRefId;
          node.properties["aria-label"] = `Return to footnote ${footnoteId} reference`;
          node.properties.className = [...getClassNames(node), "footnote-backref"];
          // 图标由 MarkdownRenderer 的 <a> 组件覆写注入，这里只留空 span 占位
          node.children = [
            {
              type: "element",
              tagName: "span",
              properties: {
                "aria-hidden": "true",
                "className": ["footnote-backref-icon"],
              },
              children: [],
            } as Element,
          ];
        }
      }

      if (node.tagName === "li" && getProperty(node, "id").startsWith("user-content-fn")) {
        const footnoteId = normalizeFootnoteId(getProperty(node, "id"));
        node.properties.id = buildFootnoteItemDomId(footnoteId);
        node.properties["data-footnote-item"] = "true";
        node.properties["data-footnote-id"] = footnoteId;
        node.properties["data-footnote-ref-ids"] = (footnoteRefs.get(footnoteId) ?? []).join(",");
        node.properties.tabIndex = -1;

        const orderIndex = footnoteOrder.indexOf(footnoteId);
        if (orderIndex >= 0)
          node.properties["data-footnote-label"] = formatFootnoteLabel(orderIndex + 1);
      }
    });

    if (footnoteRoot)
      annotateFootnoteRoot(footnoteRoot);
  };
};

function annotateFootnoteRoot(node: Element) {
  if (node.tagName === "ol") {
    node.properties.className = [...getClassNames(node), "footnote-list"];
  }

  for (const child of node.children) {
    if (!isElement(child))
      continue;

    if (child.tagName === "p" && node.tagName === "li")
      node.properties["data-footnote-has-paragraph"] = "true";

    annotateFootnoteRoot(child);
  }
}

export default rehypeFootnotes;
