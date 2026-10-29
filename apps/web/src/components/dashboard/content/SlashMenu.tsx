"use client";

import type { EditorCommands } from "@neo-space/editor";
import type { RichEditorView as EditorView } from "@neo-space/editor";
import type { SlashItem } from "./slash-items";
import { readSlashState } from "@neo-space/editor";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { filterSlashItems } from "./slash-items";

const MENU_HEIGHT = 320;
const MENU_WIDTH = 272;
const EDGE = 8;

interface SlashMenuProps {
  view?: EditorView;
  commands?: EditorCommands;
  revision: number;
  onPickImage: () => void;
}

/**
 * 段首输入「/」唤起的插入菜单；方向键选择、回车确认、Esc 关闭，指针悬停同步高亮。
 * @param props 编辑器视图、命令与图片选择回调
 * @returns 斜杠菜单
 */
export function SlashMenu({ view, commands, revision, onPickImage }: SlashMenuProps) {
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string>();
  const list = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  void revision;
  const slash = readSlashState(view);
  const anchorKey = slash && view ? String(view.state.selection.$from.start()) : undefined;
  const open = Boolean(slash && commands && anchorKey !== dismissed);
  const items = slash ? filterSlashItems(slash.query) : [];
  const index = Math.min(active, Math.max(items.length - 1, 0));

  // 查询变化时回到第一项，结果顺序已把最相关的放在最前。
  useEffect(() => setActive(0), [slash?.query]);
  useEffect(() => {
    if (!slash) setDismissed(undefined);
  }, [slash]);

  const choose = (item: SlashItem) => {
    if (!commands || !slash) return;
    commands.clearTrigger(slash.query.length + 1);
    item.run(commands, { pickImage: onPickImage });
  };

  useEffect(() => {
    const dom = view?.dom;
    if (!dom || !open) return;
    const handle = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        if (!items.length) return;
        setActive(current => (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
      } else if ((event.key === "Enter" || event.key === "Tab") && items[index]) {
        event.preventDefault();
        event.stopPropagation();
        choose(items[index]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setDismissed(anchorKey);
      }
    };
    dom.addEventListener("keydown", handle, true);
    return () => dom.removeEventListener("keydown", handle, true);
  });

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const height = Math.min(MENU_HEIGHT, window.innerHeight * 0.45) + 40;
  const below = slash ? slash.rect.bottom + height + 16 < window.innerHeight || slash.rect.top < height : true;
  const width = Math.min(MENU_WIDTH, window.innerWidth - EDGE * 2);
  const left = slash ? Math.max(EDGE, Math.min(slash.rect.left - 8, window.innerWidth - width - EDGE)) : 0;
  const top = slash ? (below ? slash.rect.bottom + 6 : slash.rect.top - 6) : 0;
  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && slash && (
        <motion.div
          key="slash-menu"
          role="listbox"
          aria-label="插入内容"
          aria-activedescendant={items[index] ? `slash-${items[index].id}` : undefined}
          initial={{ opacity: 0, transform: `translateY(${below ? -4 : 4}px) scale(0.97)` }}
          animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
          exit={{ opacity: 0, transform: "translateY(0px) scale(0.98)", transition: { duration: 0.1 } }}
          transition={reduce ? { duration: 0.12 } : { duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          style={{ left, top, width, transformOrigin: below ? "top left" : "bottom left", translate: below ? undefined : "0 -100%" }}
          className="fixed z-40 overflow-hidden rounded-xl border border-border/60 bg-popover/92 shadow-lg backdrop-blur-xl reduced-transparency:bg-popover reduced-transparency:backdrop-blur-none"
          onPointerDown={event => event.preventDefault()}
        >
          <div ref={list} className="flex max-h-[min(20rem,45svh)] flex-col overflow-y-auto overscroll-contain p-1">
            {items.length === 0 && <p className="px-3 py-6 text-center text-[0.8125rem] text-muted-foreground">没有匹配「{slash.query}」的内容</p>}
            {items.map((item, itemIndex) => {
              const header = item.group !== lastGroup ? item.group : undefined;
              lastGroup = item.group;
              return (
                <div key={item.id} className="contents">
                  {header && <p className="px-2.5 pt-2 pb-1 text-[0.6875rem] font-medium tracking-[0.06em] text-muted-foreground">{header}</p>}
                  <button
                    id={`slash-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={itemIndex === index}
                    data-index={itemIndex}
                    onPointerMove={() => setActive(itemIndex)}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      if (event.button === 0) choose(item);
                    }}
                    className={cn(
                      "flex h-9 w-full cursor-pointer items-center pointer-coarse:h-11 gap-2.5 rounded-lg px-2 text-left text-[0.8125rem] outline-none transition-colors duration-75",
                      itemIndex === index ? "bg-accent text-accent-foreground" : "text-foreground/85",
                    )}
                  >
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors duration-75", itemIndex === index ? "border-primary/25 bg-background/70 text-primary" : "border-border/70 bg-background/60")}>
                      <Icon icon={item.icon} className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="font-mono text-[0.6875rem] text-muted-foreground">{item.hint}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 border-t border-border/50 px-3 py-1.5 text-[0.6875rem] text-muted-foreground pointer-coarse:hidden">
            <span>↑↓ 选择</span><span>↵ 插入</span><span>Esc 关闭</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
