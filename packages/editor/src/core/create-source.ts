import type { LanguageDescription } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, keymap, placeholder as placeholderExtension } from "@codemirror/view";
import { codeMirrorTheme } from "./codemirror-theme";

export interface CreateSourceOptions {
  parent: HTMLElement;
  value: string;
  languages: LanguageDescription[];
  placeholder?: string;
  onChange: (value: string) => void;
}

/**
 * 源码模式：CodeMirror 6 + Markdown 语言包，围栏代码块内嵌各语言高亮。
 * @param options 创建参数
 * @returns 编辑器视图
 */
export const createSourceEditor = (options: CreateSourceOptions) => new EditorView({
  parent: options.parent,
  state: EditorState.create({
    doc: options.value,
    extensions: [
      history(),
      drawSelection(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      search({ top: true }),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: options.languages }),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      placeholderExtension(options.placeholder ?? ""),
      EditorView.contentAttributes.of({ "aria-label": "Markdown 源码" }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange(update.state.doc.toString());
      }),
      codeMirrorTheme,
    ],
  }),
});
