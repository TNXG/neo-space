import type { EditorView } from "@milkdown/kit/prose/view";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $ctx, $prose } from "@milkdown/kit/utils";

/** 编辑器视图变化回调，React 层据此定位浮动工具栏与斜杠菜单。 */
export type ViewListener = (view: EditorView) => void;

export const viewBridgeCtx = $ctx<{ listener?: ViewListener }, "siteViewBridge">({}, "siteViewBridge");

const bridgeKey = new PluginKey("siteViewBridge");

/**
 * 每次事务或焦点变化都把视图交给 React，React 自己决定是否需要重渲染。
 * @returns ProseMirror 插件
 */
export const viewBridgePlugin = $prose(ctx => new Plugin({
  key: bridgeKey,
  view: (view) => {
    const notify = () => ctx.get(viewBridgeCtx.key).listener?.(view);
    const onFocusChange = () => queueMicrotask(notify);
    view.dom.addEventListener("focus", onFocusChange);
    view.dom.addEventListener("blur", onFocusChange);
    notify();
    return {
      update: notify,
      destroy: () => {
        view.dom.removeEventListener("focus", onFocusChange);
        view.dom.removeEventListener("blur", onFocusChange);
      },
    };
  },
}));

export const viewBridge = [viewBridgeCtx, viewBridgePlugin].flat();
