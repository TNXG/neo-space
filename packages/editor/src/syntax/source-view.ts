import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import { NodeSelection, Selection } from "@milkdown/kit/prose/state";

export interface SourceViewOptions {
  /** 选中状态顶栏显示的名称。 */
  label: (node: ProseNode) => string;
  /** 根据节点属性生成源码文本。 */
  read: (node: ProseNode) => string;
  /** 把编辑后的源码写回节点属性。 */
  write: (node: ProseNode, source: string) => Record<string, unknown>;
  /** 预览渲染器；返回清理函数。 */
  render: (host: HTMLElement, node: ProseNode) => void | (() => void);
  placeholder?: string;
  /** 行内节点使用 span 并以浮层形式展开源码框。 */
  inline?: boolean;
}

/**
 * 把光标移出原子节点并交还焦点给正文，避免用户被困在源码框里。
 * @param view 编辑器视图
 * @param pos 节点起点
 * @param size 节点大小
 * @param after 是否移动到节点之后
 */
const leave = (view: EditorView, pos: number, size: number, after: boolean) => {
  const target = after ? pos + size : pos;
  const $pos = view.state.doc.resolve(target);
  view.dispatch(view.state.tr.setSelection(Selection.near($pos, after ? 1 : -1)).scrollIntoView());
  view.focus();
};

/**
 * 预览 + 源码双态节点视图：平时显示站点渲染结果，选中后在下方展开源码框，修改实时回写。
 * @param options 视图配置
 * @returns ProseMirror NodeView 构造函数
 */
export const createSourceView = (options: SourceViewOptions) => (initial: ProseNode, view: EditorView, getPos: () => number | undefined): NodeView => {
  let node = initial;
  let cleanup: void | (() => void);

  const tag = options.inline ? "span" : "div";
  const dom = document.createElement(tag);
  dom.className = options.inline ? "ns-source-inline" : "ns-source-block";
  const preview = document.createElement(tag);
  preview.className = "ns-source-preview";
  preview.contentEditable = "false";
  const panel = document.createElement(tag);
  panel.className = "ns-source-panel";
  panel.contentEditable = "false";
  const header = document.createElement(tag);
  header.className = "ns-source-header";
  const label = document.createElement("span");
  const hint = document.createElement("span");
  hint.className = "ns-source-hint";
  hint.textContent = "Esc 完成";
  header.append(label, hint);
  const textarea = document.createElement("textarea");
  textarea.className = "ns-source-input";
  textarea.spellcheck = false;
  textarea.placeholder = options.placeholder ?? "";
  panel.append(header, textarea);
  dom.append(preview, panel);

  /** 依内容高度伸缩，避免内部出现第二条滚动条。 */
  const fit = () => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const paint = () => {
    cleanup?.();
    cleanup = options.render(preview, node);
    label.textContent = options.label(node);
  };

  textarea.value = options.read(node);
  paint();

  textarea.addEventListener("input", () => {
    fit();
    const pos = getPos();
    if (pos === undefined) return;
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...options.write(node, textarea.value) }));
  });

  textarea.addEventListener("keydown", (event) => {
    const pos = getPos();
    if (pos === undefined) return;
    const atStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0;
    const atEnd = textarea.selectionStart === textarea.value.length;
    if (event.key === "Escape" || ((event.metaKey || event.ctrlKey) && event.key === "Enter")) {
      event.preventDefault();
      leave(view, pos, node.nodeSize, true);
    } else if ((event.key === "ArrowUp" || event.key === "ArrowLeft") && atStart) {
      event.preventDefault();
      leave(view, pos, node.nodeSize, false);
    } else if ((event.key === "ArrowDown" || event.key === "ArrowRight") && atEnd) {
      event.preventDefault();
      leave(view, pos, node.nodeSize, true);
    }
  });

  /** 点击预览即进入编辑，与「所见即所得」直觉一致。 */
  preview.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const pos = getPos();
    if (pos === undefined) return;
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
  });

  return {
    dom,
    update: (next) => {
      if (next.type !== node.type) return false;
      const sourceChanged = options.read(next) !== textarea.value;
      node = next;
      if (sourceChanged) {
        textarea.value = options.read(next);
        fit();
      }
      paint();
      return true;
    },
    selectNode: () => {
      dom.classList.add("is-editing");
      requestAnimationFrame(() => {
        fit();
        textarea.focus({ preventScroll: true });
      });
    },
    deselectNode: () => dom.classList.remove("is-editing"),
    stopEvent: event => event.target === textarea || panel.contains(event.target as Node),
    ignoreMutation: () => true,
    destroy: () => cleanup?.(),
  };
};
