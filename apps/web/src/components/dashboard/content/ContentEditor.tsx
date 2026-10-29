"use client";

import type { ContentDraft, ContentIssue, ContentKind, PostDraft } from "./content-model";
import type { EditorMode } from "./EditorModeSwitch";
import type { SaveStatus } from "./EditorTopBar";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { DASHBOARD_CATEGORIES_KEY, getDashboardCategories } from "@/lib/dashboard-content";
import { Icon } from "@/lib/inline-icon";
import { countWords, emptyPage, emptyPost, validateDraft } from "./content-model";
import { ContentEditorSurface } from "./ContentEditorSurface";
import { ContentMetaFields } from "./ContentMetaFields";
import { EditorTopBar } from "./EditorTopBar";
import { useContentEditor } from "./use-content-editor";

const MODE_KEY = "neo-dashboard-editor-mode";

/**
 * 读取并持久化作者偏好的编辑模式；只是界面偏好，不含业务数据。
 * @returns 当前模式与设置函数
 */
function useEditorMode() {
  const [mode, setMode] = useState<EditorMode>("rich");
  useEffect(() => {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "rich" || saved === "split" || saved === "source") setMode(saved);
  }, []);
  const change = (next: EditorMode) => {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
  };
  return [mode, change] as const;
}

/**
 * 标题输入：自动增高、回车跳入正文，与正文同一排版节奏。
 * @param props 标题、修改回调与校验信息
 * @returns 标题区域
 */
function TitleInput({ value, onChange, invalid }: { value: string; onChange: (value: string) => void; invalid?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);
  return (
    <div className="mb-6 flex flex-col gap-1" data-field="title">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={event => onChange(event.target.value.replace(/\n/g, ""))}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.closest("[data-editor-root]")?.querySelector<HTMLElement>(".ns-prose, .cm-content")?.focus();
          }
        }}
        placeholder="无标题"
        aria-label="标题"
        aria-invalid={Boolean(invalid) || undefined}
        className="w-full resize-none overflow-hidden bg-transparent text-3xl leading-tight font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50 lg:text-5xl"
      />
      {invalid && <p role="alert" className="text-sm text-destructive">{invalid}</p>}
    </div>
  );
}

interface ContentEditorProps {
  kind: ContentKind;
  _id?: string;
  /** 新建时继续编辑的服务端草稿。 */
  resumeDraftId?: string;
}

const relativeTime = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

/**
 * 把草稿保存时间转换为「3 分钟前」这类相对描述。
 * @param iso ISO 时间
 * @returns 相对时间文本
 */
const sinceText = (iso: string | undefined) => {
  if (!iso) return "";
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  return relativeTime.format(Math.round(hours / 24), "day");
};

/**
 * 文章 / 页面编辑器：标题、正文三模式与属性面板；Ctrl S 保存，离开前提醒未保存修改。
 * @param props 内容类型与主键
 * @returns 编辑器
 */
export function ContentEditor({ kind, _id, resumeDraftId }: ContentEditorProps) {
  const categories = useSWR(kind === "post" ? DASHBOARD_CATEGORIES_KEY : null, getDashboardCategories);
  const fallback: ContentDraft = kind === "post" ? emptyPost(categories.data) : emptyPage();
  const state = useContentEditor(kind, _id, fallback, resumeDraftId);
  const [mode, setMode] = useEditorMode();
  const [metaOpen, setMetaOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [issues, setIssues] = useState<ContentIssue[]>([]);
  const isMobile = useIsMobile();
  const narrow = useIsMobile(1024);
  const reduce = useReducedMotion();
  const effectiveMode: EditorMode = narrow && mode === "split" ? "source" : mode;
  const draft = state.draft;

  /** 校验失败时打开属性面板并定位第一个问题字段。 */
  const submit = async (override: Partial<PostDraft> = {}) => {
    if (!draft || saving) return;
    const found = validateDraft(kind, { ...draft, ...override } as ContentDraft);
    setIssues(found);
    if (found.length) {
      if (found.some(issue => issue.field !== "title")) setMetaOpen(true);
      toast.error(found[0].message);
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-field="${found[0].field}"] input, [data-field="${found[0].field}"] textarea, [data-field="${found[0].field}"] button`)?.focus());
      return;
    }
    setSaving(true);
    const ok = await state.save(override);
    setSaving(false);
    if (ok) {
      setJustSaved(true);
      if ("isPublished" in override) toast.success(override.isPublished ? "已发布" : "已撤回为草稿");
    }
  };

  useEffect(() => {
    if (state.dirty) setJustSaved(false);
  }, [state.dirty]);

  useEffect(() => {
    if (!state.dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty]);

  // 编辑器专属快捷键：保存、切换模式、属性面板。输入法组合期间不响应。
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.isComposing || event.altKey) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      } else if (["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        setMode((["rich", "split", "source"] as const)[Number(event.key) - 1]);
      } else if (event.key === ".") {
        event.preventDefault();
        setMetaOpen(open => !open);
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  });

  if (state.error) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col p-6">
        <Alert variant="destructive">
          <AlertTitle>读取失败</AlertTitle>
          <AlertDescription>
            <p>{state.error.message}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => { void state.retry(); }}>重试</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="flex h-full flex-col" aria-busy="true">
        <div className="h-12 border-b border-border/50" />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 pt-20 lg:px-8">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    );
  }

  const status: SaveStatus = saving ? "saving" : state.dirty ? "dirty" : justSaved ? "saved" : "clean";
  const restoreBanner = state.remoteDraft && (
    <Alert className="mb-6">
      <Icon icon="mingcute:history-line" aria-hidden="true" />
      <AlertTitle>有一份未发布的草稿</AlertTitle>
      <AlertDescription>
        <p>保存于{sinceText(state.remoteDraft.updated ?? state.remoteDraft.created)}，与当前已保存版本不同。</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="rounded-lg" onClick={state.restore}>恢复草稿</Button>
          <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => { void state.dismissRestore(); }}>丢弃</Button>
        </div>
      </AlertDescription>
    </Alert>
  );
  const published = kind === "post" ? (state.base as PostDraft | undefined)?.isPublished : undefined;
  const titleIssue = issues.find(issue => issue.field === "title")?.message;
  const header = <>{restoreBanner}<TitleInput value={draft.title} onChange={value => state.change("title", value)} invalid={titleIssue} /></>;
  const meta = <ContentMetaFields kind={kind} draft={draft} issues={issues} onChange={(field, value) => {
    setIssues(current => current.filter(issue => issue.field !== field));
    state.change(field, value);
  }} />;

  return (
    <div data-editor-root className="flex h-full min-h-0 flex-col">
      <EditorTopBar
        kind={kind}
        isNew={!_id}
        published={published}
        status={status}
        sync={state.sync}
        words={countWords(draft.text)}
        mode={effectiveMode}
        allowSplit={!narrow}
        metaOpen={metaOpen}
        onModeChange={setMode}
        onToggleMeta={() => setMetaOpen(open => !open)}
        onSave={() => { void submit(); }}
        onPublish={_id && kind === "post" ? value => { void submit({ isPublished: value }); } : undefined}
        onDiscard={() => { void state.discard(); setIssues([]); }}
      />
      <div className="flex min-h-0 flex-1">
        <ContentEditorSurface mode={effectiveMode} value={draft.text} onChange={value => state.change("text", value)} header={header} />

        {!isMobile && (
          <AnimatePresence initial={false}>
            {metaOpen && (
              <motion.aside
                key="meta"
                aria-label="属性"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "20rem", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={reduce ? { duration: 0.15 } : { duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
                className="shrink-0 overflow-hidden border-l border-border/50"
              >
                <div className="flex h-full w-80 flex-col overflow-y-auto overscroll-contain">
                  <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/50 px-4">
                    <h2 className="text-[0.8125rem] font-semibold">属性</h2>
                    <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-lg" aria-label="关闭属性" onClick={() => setMetaOpen(false)}>
                      <Icon icon="mingcute:close-line" aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="p-4">{meta}</div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        )}
      </div>

      {isMobile && (
        <Drawer open={metaOpen} onOpenChange={setMetaOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>属性</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">{meta}</DrawerBody>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
