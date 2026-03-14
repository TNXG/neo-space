import type { Root } from "mdast";
import { visit } from "unist-util-visit";

// Static regex patterns to avoid re-compilation
const BLOCK_MATH_REGEX = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g;
const INLINE_MATH_REGEX = /\$([^$\n]+)\$|\\\(([^)]+)\\\)/g;

/**
 * Remark plugin to convert LaTeX delimiters to math nodes
 * Supports:
 * - Inline: $...$ or \(...\)
 * - Block: $$...$$ or \[...\]
 */
export function remarkMathDelimiters() {
  return (tree: Root) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || index === undefined || typeof node.value !== "string")
        return;

      const { value } = node;
      const parts: any[] = [];
      let lastIndex = 0;

      // Match block math: $$...$$ or \[...\]
      const blockRegex = BLOCK_MATH_REGEX;
      // Match inline math: single $ (not $$) or \(...\)
      const inlineRegex = INLINE_MATH_REGEX;

      const allMatches: Array<{ start: number; end: number; content: string; type: "inlineMath" | "math" }> = [];

      // Find all block math matches first
      let blockMatch: RegExpExecArray | null;
      // eslint-disable-next-line no-cond-assign
      while ((blockMatch = blockRegex.exec(value)) !== null) {
        allMatches.push({
          start: blockMatch.index,
          end: blockMatch.index + blockMatch[0].length,
          content: blockMatch[1] || blockMatch[2],
          type: "math",
        });
      }

      // Find all inline math matches
      let inlineMatch: RegExpExecArray | null;
      // eslint-disable-next-line no-cond-assign
      while ((inlineMatch = inlineRegex.exec(value)) !== null) {
        // Check if this match is inside a block math
        const isInsideBlock = allMatches.some(
          m => m.type === "math" && inlineMatch!.index >= m.start && inlineMatch!.index < m.end,
        );
        if (!isInsideBlock) {
          allMatches.push({
            start: inlineMatch.index,
            end: inlineMatch.index + inlineMatch[0].length,
            content: inlineMatch[1] || inlineMatch[2],
            type: "inlineMath",
          });
        }
      }

      // Sort matches by start position
      allMatches.sort((a, b) => a.start - b.start);

      // Build new nodes
      for (const mathMatch of allMatches) {
        // Add text before match
        if (mathMatch.start > lastIndex) {
          parts.push({
            type: "text",
            value: value.slice(lastIndex, mathMatch.start),
          });
        }

        // Add math node
        parts.push({
          type: mathMatch.type,
          value: mathMatch.content,
          data: {
            hName: mathMatch.type === "math" ? "div" : "span",
            hProperties: {
              className: mathMatch.type === "math" ? "math math-display" : "math math-inline",
            },
          },
        });

        lastIndex = mathMatch.end;
      }

      // Add remaining text
      if (lastIndex < value.length) {
        parts.push({
          type: "text",
          value: value.slice(lastIndex),
        });
      }

      // Replace node if we found any math
      if (parts.length > 0) {
        parent.children.splice(index, 1, ...parts);
      }
    });
  };
}
