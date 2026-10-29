"use client";

import type { EditorCommands, FormatState, InlineFormat } from "@neo-space/editor";
import type { RichEditorView as EditorView } from "@neo-space/editor";
import { readSelectionRect } from "@neo-space/editor";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

const INLINE_ACTIONS: { format: InlineFormat; label: string; icon: string; keys: string }[] = [
  { format: "strong", label: "粗体", icon: "mingcute:bold-line", keys: "Ctrl B" },
  { format: "emphasis", label: "斜体", icon: "mingcute:italic-line", keys: "Ctrl I" },
  { format: "strike_through", label: "删除线", icon: "mingcute:strikethrough-line", keys: "Ctrl Alt X" },
  { format: "inlineCode", label: "行内代码", icon: "mingcute:code-line", keys: "Ctrl E" },
  { format: "site_mark", label: "高亮", icon: "mingcute:mark-pen-line", keys: "==文字==" },
  { format: "site_spoiler", label: "剧透", icon: "mingcute:eye-close-line", keys: "||文字||" },
];

const TOOLBAR_GAP = 10;

interface FloatingToolbarProps {
  view?: EditorView;
  commands?: EditorCommands;
  format?: FormatState;
  revision: number;
  /** 编辑区滚动容器，用于约束水平位置。 */
  boundary: HTMLElement | null;
}

/**
 * 选中文字时浮现的格式工具栏：按下即执行，执行后选区保持，可连续叠加格式。
 * @param props 编辑器视图、命令与格式状态
 * @returns 浮动工具栏
 */
export function FloatingToolbar({ view, commands, format, revision, boundary }: FloatingToolbarProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [pointerSelecting, setPointerSelecting] = useState(false);
  const toolbar = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rect = readSelectionRect(view);
  void revision;

  // 拖选过程中不弹出，松开鼠标再出现，避免工具栏追着指针跳动。
  useEffect(() => {
    const dom = view?.dom;
    if (!dom) return;
    const down = () => setPointerSelecting(true);
    const up = () => setPointerSelecting(false);
    dom.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      dom.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, [view]);

  useEffect(() => {
    if (!rect) setLinkOpen(false);
  }, [rect]);

  const visible = Boolean(rect && commands && format && !pointerSelecting) || linkOpen;
  const viewport = typeof window === "undefined" ? 1024 : window.innerWidth;
  // 触屏系统会在选区上方弹出原生菜单，工具栏改到选区下方以免互相遮挡。
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const width = Math.min(toolbar.current?.offsetWidth ?? 320, viewport - 16);
  const bounds = boundary?.getBoundingClientRect();
  const center = rect ? (rect.left + rect.right) / 2 : 0;
  const minLeft = Math.max(8, (bounds?.left ?? 0) + 8);
  const maxLeft = Math.min(viewport, bounds?.right ?? viewport) - width - 8;
  const left = Math.max(minLeft, Math.min(center - width / 2, maxLeft));
  const flip = rect ? coarse || rect.top - 56 < (bounds?.top ?? 0) : false;
  const top = rect ? (flip ? rect.bottom + TOOLBAR_GAP + (coarse ? 28 : 0) : rect.top - TOOLBAR_GAP) : 0;

  const openLink = () => {
    setHref(format?.link ?? "");
    setLinkOpen(true);
  };

  const applyLink = (value: string) => {
    commands?.setLink(value);
    setLinkOpen(false);
  };

  return (
    <AnimatePresence>
      {visible && rect && (
        <motion.div
          key="floating-toolbar"
          initial={{ transform: `translate(${left}px, ${top}px)` }}
          animate={{ transform: `translate(${left}px, ${top}px)` }}
          transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.3, bounce: 0 }}
          className="pointer-events-none fixed top-0 left-0 z-40"
        >
          <motion.div
          ref={toolbar}
          role="toolbar"
          aria-label="文字格式"
          initial={{ opacity: 0, transform: `translateY(${flip ? "0%" : "-100%"}) translateY(${flip ? -4 : 4}px) scale(0.96)` }}
          animate={{ opacity: 1, transform: `translateY(${flip ? "0%" : "-100%"}) translateY(0px) scale(1)` }}
          exit={{ opacity: 0, transform: `translateY(${flip ? "0%" : "-100%"}) translateY(0px) scale(0.97)`, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
          transition={reduce ? { duration: 0.15 } : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          style={{ transformOrigin: flip ? "top center" : "bottom center" }}
          className="pointer-events-auto flex max-w-[calc(100vw-1rem)] items-center gap-0.5 overflow-x-auto rounded-xl border border-border/60 bg-popover/90 p-1 shadow-lg backdrop-blur-xl reduced-transparency:bg-popover reduced-transparency:backdrop-blur-none"
          onPointerDown={event => event.preventDefault()}
        >
          {linkOpen ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                applyLink(href);
              }}
            >
              <Icon icon="mingcute:link-line" className="ml-1.5 size-4 text-muted-foreground" aria-hidden="true" />
              <input
                autoFocus
                value={href}
                onChange={event => setHref(event.target.value)}
                onPointerDown={event => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setLinkOpen(false);
                    commands?.focus();
                  }
                }}
                placeholder="粘贴或输入链接，回车确认"
                aria-label="链接地址"
                className="h-7 w-[min(15rem,60vw)] bg-transparent px-1 text-[0.8125rem] outline-none placeholder:text-muted-foreground"
              />
              {format?.link && (
                <ToolbarButton label="移除链接" icon="mingcute:unlink-line" onPress={() => applyLink("")} />
              )}
              <ToolbarButton label="确认" icon="mingcute:check-line" onPress={() => applyLink(href)} />
            </form>
          ) : (
            <>
              {INLINE_ACTIONS.map(action => (
                <ToolbarButton
                  key={action.format}
                  label={`${action.label}（${action.keys}）`}
                  icon={action.icon}
                  active={format?.marks.has(action.format)}
                  onPress={() => commands?.toggleInline(action.format)}
                />
              ))}
              <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
              <ToolbarButton label="链接（Ctrl K）" icon="mingcute:link-line" active={format?.marks.has("link")} onPress={openLink} />
            </>
          )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ToolbarButtonProps {
  label: string;
  icon: string;
  active?: boolean;
  onPress: () => void;
}

/** 按下即触发；阻止默认行为以保留编辑器选区。 */
export function ToolbarButton({ label, icon, active, onPress }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onPointerDown={(event) => {
        event.preventDefault();
        if (event.button === 0) onPress();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPress();
        }
      }}
      className={cn(
        "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none pointer-coarse:size-9 transition-[background-color,color,transform] duration-(--motion-duration-press) ease-(--motion-ease-out) focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.94] motion-reduce:active:scale-100",
        active ? "bg-primary/12 text-primary" : "text-foreground/75 hover:bg-foreground/6 hover:text-foreground",
      )}
    >
      <Icon icon={icon} className="size-4" aria-hidden="true" />
    </button>
  );
}
