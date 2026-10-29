"use client";

import type { EditorMode } from "./EditorModeSwitch";
import type { ContentKind } from "./content-model";
import type { DraftSyncStatus } from "./use-content-editor";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { KbdShortcut } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/lib/inline-icon";
import { Link } from "@/locales/navigation";
import { cn } from "@/lib/utils";
import { EditorModeSwitch } from "./EditorModeSwitch";

export type SaveStatus = "clean" | "dirty" | "saving" | "saved";

interface EditorTopBarProps {
  kind: ContentKind;
  isNew: boolean;
  published?: boolean;
  status: SaveStatus;
  /** 服务端自动保存草稿的同步状态。 */
  sync: DraftSyncStatus;
  words: number;
  mode: EditorMode;
  allowSplit: boolean;
  metaOpen: boolean;
  onModeChange: (mode: EditorMode) => void;
  onToggleMeta: () => void;
  onSave: () => void;
  onPublish?: (published: boolean) => void;
  onDiscard: () => void;
}

/** 有未发布修改时显示草稿同步进度，让作者知道关掉页面也不会丢。 */
const SYNC_TEXT: Record<DraftSyncStatus, string> = {
  idle: "未保存",
  pending: "未保存",
  syncing: "正在存草稿",
  synced: "草稿已存",
  failed: "草稿同步失败",
};

const STATUS_TEXT: Record<SaveStatus, string> = {
  clean: "已同步",
  dirty: "未保存",
  saving: "正在保存",
  saved: "已保存",
};

/**
 * 编辑器顶栏：左侧返回与状态，中间模式，右侧操作；主操作（保存/发布）固定在最右，与阅读顺序一致。
 * @param props 状态与回调
 * @returns 顶栏
 */
export function EditorTopBar(props: EditorTopBarProps) {
  const { kind, isNew, published, status, sync, words, mode, allowSplit, metaOpen } = props;
  const label = status === "dirty" ? SYNC_TEXT[sync] : isNew && status !== "saving" ? "新建" : STATUS_TEXT[status];
  const listHref = kind === "post" ? "/dashboard/posts" : "/dashboard/pages";

  return (
    <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border/50 px-2 sm:gap-2 lg:px-3">
      <Button asChild variant="ghost" size="icon-sm" className="rounded-lg">
        <Link href={listHref} aria-label={kind === "post" ? "返回文章列表" : "返回页面列表"}>
          <Icon icon="mingcute:left-line" aria-hidden="true" />
        </Link>
      </Button>

      <div className="flex min-w-0 items-center gap-2 truncate text-xs text-muted-foreground" role="status" aria-live="polite">
        {kind === "post" && !isNew && (
          <span className={cn("hidden shrink-0 rounded-md px-1.5 py-0.5 font-medium sm:inline", published ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground")}>
            {published ? "已发布" : "草稿"}
          </span>
        )}
        <span className="relative flex min-w-0 items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full transition-colors duration-(--motion-duration-fast)", status === "dirty" ? (sync === "failed" ? "bg-destructive" : sync === "synced" ? "bg-primary/60" : "bg-foreground/45") : status === "saving" ? "bg-primary animate-pulse" : "bg-primary/60")} aria-hidden="true" />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={label} initial={{ opacity: 0, transform: "translateY(4px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} exit={{ opacity: 0, transform: "translateY(-4px)" }} transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}>
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="hidden tabular-nums md:inline">· {words} 字</span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        <EditorModeSwitch mode={mode} onChange={props.onModeChange} allowSplit={allowSplit} />
        <Button type="button" variant={metaOpen ? "secondary" : "ghost"} size="icon-sm" className="rounded-lg" aria-label="属性" aria-pressed={metaOpen} title="属性（Ctrl .）" onClick={props.onToggleMeta}>
          <Icon icon="mingcute:settings-6-line" aria-hidden="true" />
        </Button>
        {status === "dirty" && !isNew && (
          <Button type="button" variant="ghost" size="sm" className="hidden rounded-lg md:inline-flex" onClick={props.onDiscard}>放弃</Button>
        )}
        {kind === "post" && props.onPublish && (
          <Button type="button" variant="outline" size="sm" className="hidden rounded-lg md:inline-flex" disabled={status === "saving"} onClick={() => props.onPublish?.(!published)}>
            {published ? "撤回为草稿" : "发布"}
          </Button>
        )}
        {(props.onPublish || (status === "dirty" && !isNew)) && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="rounded-lg md:hidden" aria-label="更多操作">
                <Icon icon="mingcute:more-2-line" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6}>
              <DropdownMenuGroup>
                {kind === "post" && props.onPublish && (
                  <DropdownMenuItem disabled={status === "saving"} onSelect={() => props.onPublish?.(!published)}>
                    <Icon icon={published ? "mingcute:eye-close-line" : "mingcute:send-plane-line"} aria-hidden="true" />
                    {published ? "撤回为草稿" : "发布"}
                  </DropdownMenuItem>
                )}
                {status === "dirty" && !isNew && (
                  <DropdownMenuItem onSelect={props.onDiscard}>
                    <Icon icon="mingcute:back-line" aria-hidden="true" />
                    放弃修改
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button type="button" size="sm" className="rounded-lg max-sm:px-3 sm:min-w-20" disabled={status === "saving" || (status !== "dirty" && !isNew)} onClick={props.onSave}>
          {status === "saving" ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Icon icon="mingcute:check-line" data-icon="inline-start" aria-hidden="true" />}
          <span className="max-sm:sr-only">{isNew ? "创建" : "保存"}</span>
          <KbdShortcut keys={["Ctrl", "S"]} className="ml-0.5 hidden opacity-80 xl:inline-flex [&_kbd]:border-white/30 [&_kbd]:bg-white/15 [&_kbd]:text-white [&_kbd]:shadow-none" />
        </Button>
      </div>
    </div>
  );
}
