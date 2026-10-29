import type { LanguageDescription } from "@codemirror/language";
import type { BlockPreviewRenderer } from "../syntax/container";
import type { ProseClassMap } from "./prose-classes";
import type { ViewListener } from "./view-bridge";
import { defaultValueCtx, Editor, editorViewOptionsCtx, rootCtx } from "@milkdown/kit/core";
import { codeBlockComponent, codeBlockConfig } from "@milkdown/kit/component/code-block";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { cursor } from "@milkdown/kit/plugin/cursor";
import { history } from "@milkdown/kit/plugin/history";
import { indent } from "@milkdown/kit/plugin/indent";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { upload, uploadConfig } from "@milkdown/kit/plugin/upload";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { blockPreviewCtx, containerPlugins } from "../syntax/container";
import { inlineMarks } from "../syntax/inline-marks";
import { mathPlugins } from "../syntax/math";
import { codeMirrorTheme } from "./codemirror-theme";
import { applyProseClasses } from "./prose-classes";
import { viewBridge, viewBridgeCtx } from "./view-bridge";

export interface CreateEditorOptions {
  root: HTMLElement;
  value: string;
  languages: LanguageDescription[];
  onChange: (markdown: string) => void;
  onView: ViewListener;
  /** 上传单个文件，返回可公开访问的地址。 */
  upload?: (file: File) => Promise<string>;
  renderBlock?: BlockPreviewRenderer;
  onCopy?: (text: string) => void;
  /** 与公共站一致的正文类名。 */
  proseClasses?: ProseClassMap;
}

/**
 * 组装站点 Milkdown 编辑器：CommonMark + GFM + 站点私有语法，以及代码块、上传与视图桥接。
 * @param options 创建参数
 * @returns 已创建的 Milkdown 实例
 */
export const createSiteEditor = (options: CreateEditorOptions) => Editor.make()
  .config((ctx) => {
    ctx.set(rootCtx, options.root);
    ctx.set(defaultValueCtx, options.value);
    ctx.update(editorViewOptionsCtx, prev => ({
      ...prev,
      attributes: { "class": "ns-prose", "spellcheck": "false", "aria-label": "正文", "aria-multiline": "true", "role": "textbox" },
    }));
    if (options.proseClasses) applyProseClasses(ctx, options.proseClasses);
    ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => options.onChange(markdown));
    ctx.set(viewBridgeCtx.key, { listener: options.onView });
    ctx.set(blockPreviewCtx.key, { render: options.renderBlock });
    ctx.update(codeBlockConfig.key, prev => ({
      ...prev,
      languages: options.languages,
      extensions: [codeMirrorTheme],
      searchPlaceholder: "搜索语言",
      noResultText: "没有匹配的语言",
      copyText: "复制",
      onCopy: options.onCopy,
      renderLanguage: (language, selected) => `${selected ? "✓ " : ""}${language || "纯文本"}`,
      previewLabel: "预览",
    }));
    const uploadFile = options.upload;
    if (uploadFile) {
      ctx.update(uploadConfig.key, prev => ({
        ...prev,
        uploader: async (files, schema) => {
          const images = Array.from(files).filter(file => file.type.startsWith("image/"));
          const nodes = await Promise.all(images.map(async (file) => {
            const src = await uploadFile(file);
            return schema.nodes.image.createAndFill({ src, alt: file.name.replace(/\.[^.]+$/, "") });
          }));
          return nodes.filter(node => node !== null);
        },
      }));
    }
  })
  .use(commonmark)
  .use(gfm)
  .use(history)
  .use(listener)
  .use(clipboard)
  .use(cursor)
  .use(indent)
  .use(trailing)
  .use(upload)
  .use(codeBlockComponent)
  .use(inlineMarks)
  .use(mathPlugins)
  .use(containerPlugins)
  .use(viewBridge);
