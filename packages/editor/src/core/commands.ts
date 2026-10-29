import type { Editor } from "@milkdown/kit/core";
import type { MarkType, NodeType } from "@milkdown/kit/prose/model";
import type { EditorState } from "@milkdown/kit/prose/state";
import { editorViewCtx } from "@milkdown/kit/core";
import { redo, undo } from "@milkdown/kit/prose/history";
import { setBlockType, wrapIn, lift } from "@milkdown/kit/prose/commands";
import { wrapInList } from "@milkdown/kit/prose/schema-list";
import { NodeSelection, TextSelection } from "@milkdown/kit/prose/state";
import { insertTableCommand } from "@milkdown/kit/preset/gfm";
import { callCommand, insert } from "@milkdown/kit/utils";

export type InlineFormat = "strong" | "emphasis" | "strike_through" | "inlineCode" | "site_mark" | "site_spoiler" | "link";
export type BlockFormat = "paragraph" | "h1" | "h2" | "h3" | "h4" | "blockquote" | "bullet_list" | "ordered_list" | "task_list" | "code_block";

export interface FormatState {
  marks: Set<InlineFormat>;
  block: BlockFormat;
  canUndo: boolean;
  canRedo: boolean;
  link?: string;
}

/**
 * 判断当前选区是否带有某个 mark；空选区看存储的 mark，与 Word 类编辑器的直觉一致。
 * @param state 编辑器状态
 * @param type mark 类型
 * @returns 是否激活
 */
const markActive = (state: EditorState, type: MarkType) => {
  const { from, to, empty, $from } = state.selection;
  if (empty) return Boolean(type.isInSet(state.storedMarks ?? $from.marks()));
  return state.doc.rangeHasMark(from, to, type);
};

/**
 * 推导光标所在块的语义类型，用于工具栏「段落样式」显示。
 * @param state 编辑器状态
 * @returns 块格式
 */
const blockOf = (state: EditorState): BlockFormat => {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "list_item" && node.attrs.checked != null) return "task_list";
    if (node.type.name === "bullet_list") return "bullet_list";
    if (node.type.name === "ordered_list") return "ordered_list";
    if (node.type.name === "blockquote") return "blockquote";
  }
  const parent = $from.parent;
  if (parent.type.name === "heading") return `h${Math.min(parent.attrs.level as number, 4)}` as BlockFormat;
  if (parent.type.name === "code_block") return "code_block";
  return "paragraph";
};

/**
 * 读取工具栏所需的全部状态，一次遍历即可，避免逐个按钮查询。
 * @param state 编辑器状态
 * @returns 格式状态
 */
export const readFormatState = (state: EditorState): FormatState => {
  const marks = new Set<InlineFormat>();
  for (const name of ["strong", "emphasis", "strike_through", "inlineCode", "site_mark", "site_spoiler", "link"] as const) {
    const type = state.schema.marks[name];
    if (type && markActive(state, type)) marks.add(name);
  }
  const linkType = state.schema.marks.link;
  const link = linkType?.isInSet(state.selection.$from.marks())?.attrs.href as string | undefined;
  return { marks, block: blockOf(state), canUndo: undo(state), canRedo: redo(state), link };
};

/** 工具栏与快捷键共用的命令集合；所有命令执行后都把焦点交还正文。 */
export const createCommands = (editor: Editor): EditorCommands => {
  const run = (fn: Parameters<Editor["action"]>[0]) => {
    editor.action(fn);
    editor.action(ctx => ctx.get(editorViewCtx).focus());
  };
  const view = () => editor.ctx.get(editorViewCtx);
  const node = (name: string): NodeType => view().state.schema.nodes[name];

  const toggleInline = (format: InlineFormat) => {
    const commands: Record<Exclude<InlineFormat, "link">, string> = {
      strong: "ToggleStrong",
      emphasis: "ToggleEmphasis",
      strike_through: "ToggleStrikeThrough",
      inlineCode: "ToggleInlineCode",
      site_mark: "ToggleSiteMark",
      site_spoiler: "ToggleSiteSpoiler",
    };
    if (format !== "link") run(callCommand(commands[format]));
  };

  /** 有链接时更新/移除，无链接时创建；空 href 视为移除。 */
  const setLink = (href: string) => {
    const { state, dispatch } = view();
    const type = state.schema.marks.link;
    let { from, to } = state.selection;
    if (state.selection.empty) {
      const $pos = state.selection.$from;
      const range = $pos.parent.childAfter($pos.parentOffset);
      if (range.node && type.isInSet(range.node.marks)) {
        from = $pos.start() + range.offset;
        to = from + range.node.nodeSize;
      }
    }
    const tr = state.tr.removeMark(from, to, type);
    if (href.trim()) {
      if (from === to) {
        tr.insertText(href, from).addMark(from, from + href.length, type.create({ href }));
      } else {
        tr.addMark(from, to, type.create({ href: href.trim() }));
      }
    }
    dispatch(tr.scrollIntoView());
    view().focus();
  };

  const setBlock = (format: BlockFormat) => {
    const { state, dispatch } = view();
    const current = blockOf(state);
    const lifted = () => {
      while (lift(view().state, view().dispatch));
    };
    if (format === current && format !== "paragraph") {
      lifted();
      setBlockType(node("paragraph"))(view().state, view().dispatch);
      view().focus();
      return;
    }
    if (["blockquote", "bullet_list", "ordered_list", "task_list"].includes(current)) lifted();
    const next = view().state;
    switch (format) {
      case "paragraph": setBlockType(node("paragraph"))(next, dispatch); break;
      case "h1": case "h2": case "h3": case "h4":
        setBlockType(node("heading"), { level: Number(format[1]) })(next, dispatch); break;
      case "blockquote": wrapIn(node("blockquote"))(next, dispatch); break;
      case "bullet_list": wrapInList(node("bullet_list"))(next, dispatch); break;
      case "ordered_list": wrapInList(node("ordered_list"))(next, dispatch); break;
      case "task_list": {
        wrapInList(node("bullet_list"))(next, dispatch);
        const after = view().state;
        const { $from } = after.selection;
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === "list_item") {
            dispatch(after.tr.setNodeAttribute($from.before(depth), "checked", false));
            break;
          }
        }
        break;
      }
      case "code_block": setBlockType(node("code_block"))(next, dispatch); break;
    }
    view().focus();
  };

  /**
   * 插入原子块并自动选中，使源码框立即展开，用户可以直接开始输入。
   * @param markdown 要插入的 Markdown
   */
  const insertAtom = (markdown: string) => {
    run(insert(markdown));
    const { state, dispatch } = view();
    const { $from } = state.selection;
    const before = $from.nodeBefore ?? state.doc.resolve(Math.max(0, $from.before($from.depth))).nodeBefore;
    if (before?.isAtom) {
      const pos = $from.pos - before.nodeSize;
      if (pos >= 0) dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
    }
  };

  /** 删除当前空段落中的触发字符（如斜杠），再执行插入。 */
  const clearTrigger = (length: number) => {
    const { state, dispatch } = view();
    const { $from } = state.selection;
    const from = $from.pos - length;
    if (from >= $from.start()) dispatch(state.tr.delete(from, $from.pos).setSelection(TextSelection.create(state.tr.doc, from)));
  };

  return {
    undo: () => run(ctx => undo(ctx.get(editorViewCtx).state, ctx.get(editorViewCtx).dispatch)),
    redo: () => run(ctx => redo(ctx.get(editorViewCtx).state, ctx.get(editorViewCtx).dispatch)),
    toggleInline,
    setLink,
    setBlock,
    clearTrigger,
    insertTable: () => run(callCommand(insertTableCommand.key, { row: 3, col: 3 })),
    insertDivider: () => run(callCommand("InsertHr")),
    insertImage: (src: string, alt = "") => run(callCommand("InsertImage", { src, alt })),
    insertMath: () => insertAtom("$$\n\n$$"),
    insertContainer: (kind: string, body: string, params = "") => insertAtom(`::: ${kind}${params ? ` {${params}}` : ""}\n${body}\n:::`),
    focus: () => view().focus(),
  };
};

/** 工具栏、斜杠菜单与快捷键共享的编辑命令。 */
export interface EditorCommands {
  undo: () => void;
  redo: () => void;
  toggleInline: (format: InlineFormat) => void;
  setLink: (href: string) => void;
  setBlock: (format: BlockFormat) => void;
  /** 删除光标前指定长度的触发字符（如斜杠查询）。 */
  clearTrigger: (length: number) => void;
  insertTable: () => void;
  insertDivider: () => void;
  insertImage: (src: string, alt?: string) => void;
  insertMath: () => void;
  insertContainer: (kind: string, body: string, params?: string) => void;
  focus: () => void;
}
