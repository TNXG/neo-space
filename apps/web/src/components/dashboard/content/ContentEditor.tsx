"use client";

import type { ContentDraft, ContentIssue, ContentKind, PostDraft } from "./content-model";
import type { EditorMode } from "./EditorModeSwitch";
import type { SaveStatus } from "./EditorTopBar";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { DASHBOARD_CATEGORIES_KEY, getDashboardCategories } from "@/lib/dashboard-content";
import { Icon } from "@/lib/inline-icon";
import { countWords, emptyPage, emptyPost, validateDraft } from "./content-model";
import { ContentEditorSurface } from "./ContentEditorSurface";
import { ContentMetaFields } from "./ContentMetaFields";
import { EditorHeader, EditorLoading } from "./EditorHeader";
import { EditorTopBar } from "./EditorTopBar";
import { ImageMetadataPanel } from "./ImageMetadataPanel";
import { useContentEditor } from "./use-content-editor";
import { useEditorMode } from "./use-editor-mode";
import { useImageMatching } from "./use-image-matching";

interface ContentEditorProps {
  kind: ContentKind;
  _id?: string;
  /** 新建时继续编辑的服务端草稿。 */
  resumeDraftId?: string;
}
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
  const imageMatching = useImageMatching(draft, meta => state.change("meta", meta));

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

  if (!draft) return <EditorLoading />;

  const status: SaveStatus = saving ? "saving" : state.dirty ? "dirty" : justSaved ? "saved" : "clean";
  const published = kind === "post" ? (state.base as PostDraft | undefined)?.isPublished : undefined;
  const titleIssue = issues.find(issue => issue.field === "title")?.message;
  const header = <EditorHeader title={draft.title} invalid={titleIssue} remoteDraft={state.remoteDraft} onTitleChange={value => state.change("title", value)} onRestore={state.restore} onDismiss={() => { void state.dismissRestore(); }} />;
  const meta = (
    <div className="flex min-w-0 flex-col gap-5">
      <ContentMetaFields kind={kind} draft={draft} issues={issues} onChange={(field, value) => {
        setIssues(current => current.filter(issue => issue.field !== field));
        state.change(field, value);
      }} />
      <ImageMetadataPanel draft={draft} matching={imageMatching} disabled={saving} />
    </div>
  );

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
        <ContentEditorSurface mode={effectiveMode} value={draft.text} meta={draft.meta} onChange={value => state.change("text", value)} header={header} />

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
