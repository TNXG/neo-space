import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/** 颜色全部取站点语义变量，明暗模式随 CSS 自动切换。 */
const base = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--foreground)", fontSize: "0.875rem" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)", caretColor: "var(--primary)", lineHeight: "1.7" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--primary)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "color-mix(in oklab, var(--primary) 22%, transparent) !important" },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--foreground) 4%, transparent)" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--muted-foreground)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 0.75rem 0 0.5rem", fontVariantNumeric: "tabular-nums" },
  ".cm-searchMatch": { backgroundColor: "color-mix(in oklab, var(--primary) 18%, transparent)", borderRadius: "2px" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "color-mix(in oklab, var(--primary) 36%, transparent)" },
  ".cm-panels": { backgroundColor: "var(--popover)", color: "var(--popover-foreground)", borderColor: "var(--border)" },
  ".cm-tooltip": { backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "0.5rem" },
});

const highlight = HighlightStyle.define([
  { tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: "650", color: "var(--foreground)" },
  { tag: tags.heading1, fontSize: "1.15em" },
  { tag: tags.strong, fontWeight: "650" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--primary)" },
  { tag: [tags.processingInstruction, tags.contentSeparator, tags.meta], color: "var(--muted-foreground)" },
  { tag: tags.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: [tags.monospace], color: "var(--accent-700)" },
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword], color: "var(--accent-700)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--ns-code-string)" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "var(--ns-code-number)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--ns-code-function)" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "var(--ns-code-type)" },
  { tag: [tags.tagName, tags.angleBracket], color: "var(--ns-code-tag)" },
  { tag: [tags.attributeName, tags.propertyName], color: "var(--accent-800)" },
  { tag: tags.invalid, color: "var(--destructive)" },
]);

export const codeMirrorTheme = [base, syntaxHighlighting(highlight)];
