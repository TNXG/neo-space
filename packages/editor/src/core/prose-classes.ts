import type { Ctx } from "@milkdown/kit/ctx";
import { blockquoteAttr, bulletListAttr, headingAttr, inlineCodeAttr, linkAttr, listItemAttr, orderedListAttr, paragraphAttr } from "@milkdown/kit/preset/commonmark";

/** 宿主应用提供的正文类名；键与公共站渲染器的组件一一对应。 */
export interface ProseClassMap {
  h1: string;
  h2: string;
  h3: string;
  h4: string;
  link: string;
  ul: string;
  ol: string;
  li: string;
  blockquote: string;
  inlineCode: string;
  p: string;
}

/**
 * 把站点渲染器的类名挂到 ProseMirror 节点上，编辑器与前台共用同一套 Tailwind 排版。
 * @param ctx Milkdown 上下文
 * @param classes 宿主类名
 */
export const applyProseClasses = (ctx: Ctx, classes: ProseClassMap) => {
  ctx.set(headingAttr.key, node => ({ class: classes[`h${Math.min(node.attrs.level as number, 4)}` as "h1"] }));
  ctx.set(paragraphAttr.key, () => ({ class: classes.p }));
  ctx.set(blockquoteAttr.key, () => ({ class: classes.blockquote }));
  ctx.set(bulletListAttr.key, () => ({ class: classes.ul }));
  ctx.set(orderedListAttr.key, () => ({ class: classes.ol }));
  ctx.set(listItemAttr.key, () => ({ class: classes.li }));
  ctx.set(inlineCodeAttr.key, () => ({ class: classes.inlineCode }));
  ctx.set(linkAttr.key, () => ({ class: classes.link }));
};
