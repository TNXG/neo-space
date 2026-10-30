"use client";

import type { ContentDraft, ContentKind, PageDraft, PostDraft } from "./content-model";
import type { DashboardDraft } from "@/types/api";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { create } from "zustand";
import { createDashboardDraft, createDashboardPage, createDashboardPost, dashboardDraftKey, dashboardNewDraftsKey, dashboardPageKey, dashboardPostKey, DASHBOARD_PAGES_KEY, deleteDashboardDraft, getDashboardDraft, getDashboardDraftByRef, getDashboardPage, getDashboardPost, updateDashboardDraft, updateDashboardPage, updateDashboardPost } from "@/lib/dashboard-content";
import { useRouter } from "@/locales/navigation";
import { changedFields, hasContentChanges, pageToDraft, postToDraft } from "./content-model";

const AUTOSAVE_DELAY = 1500;

/** 未保存草稿按「类型:_id」保存在内存中，跨路由切换不丢输入；新建内容使用 `new`。 */
interface ContentDraftStore {
  drafts: Record<string, ContentDraft>;
  set: (key: string, draft: ContentDraft | undefined) => void;
}

export const useContentDraftStore = create<ContentDraftStore>(set => ({
  drafts: {},
  set: (key, draft) => set((state) => {
    const drafts = { ...state.drafts };
    if (draft) drafts[key] = draft;
    else delete drafts[key];
    return { drafts };
  }),
}));

export const clearContentDrafts = () => useContentDraftStore.setState({ drafts: {} });

export type DraftSyncStatus = "idle" | "pending" | "syncing" | "synced" | "failed";

/** 服务端草稿只存正文以外的属性快照，恢复时与 title/text 合并。 */
const draftToContent = (remote: DashboardDraft, base: ContentDraft): ContentDraft => ({
  ...base,
  ...(remote.typeSpecificData as Partial<ContentDraft> | null ?? {}),
  title: remote.title ?? base.title,
  text: remote.text ?? base.text,
});

const contentToDraftInput = (kind: ContentKind, refId: string | undefined, draft: ContentDraft) => {
  const { title, text, ...rest } = draft;
  return { refType: kind, refId, title, text, contentFormat: "markdown" as const, typeSpecificData: rest as Record<string, unknown> };
};

/** 判断 SWR key 是否属于文章列表，变更后统一失效。 */
const isListKey = (key: unknown) => Array.isArray(key) && (key[0] === "dashboard-posts" || key[0] === "dashboard-new-drafts");

/**
 * 内容编辑状态：已保存版本 + 本地草稿 + 服务端自动保存草稿。
 * 保存只提交差异字段；正式保存后删除服务端草稿并同步详情与列表缓存。
 * @param kind 内容类型
 * @param _id 内容主键，新建为 undefined
 * @param fallback 新建内容的初始草稿
 * @param resumeDraftId 新建时继续编辑的服务端草稿
 * @returns 编辑状态与操作
 */
export function useContentEditor(kind: ContentKind, _id: string | undefined, fallback: ContentDraft, resumeDraftId?: string) {
  const storeKey = `${kind}:${_id ?? resumeDraftId ?? "new"}`;
  const saved = useSWR(
    _id ? (kind === "post" ? dashboardPostKey(_id) : dashboardPageKey(_id)) : null,
    async (): Promise<ContentDraft> => kind === "post" ? postToDraft(await getDashboardPost(_id!)) : pageToDraft(await getDashboardPage(_id!)),
    { revalidateOnFocus: false },
  );
  const remote = useSWR(
    _id || resumeDraftId ? dashboardDraftKey(kind, _id, resumeDraftId) : null,
    () => resumeDraftId && !_id ? getDashboardDraft(resumeDraftId) : getDashboardDraftByRef(kind, _id!),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const stored = useContentDraftStore(state => state.drafts[storeKey]);
  const setStored = useContentDraftStore(state => state.set);
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const remoteId = useRef<string>(undefined);
  const [sync, setSync] = useState<DraftSyncStatus>("idle");
  const [offerDismissed, setOfferDismissed] = useState(false);
  const timer = useRef<number>(undefined);
  const syncing = useRef<Promise<unknown>>(undefined);

  const base = _id ? saved.data : fallback;
  const remoteDraft = remote.data ?? undefined;
  const draftId = remoteId.current ?? remoteDraft?._id;

  // 继续编辑新草稿：草稿即内容本身，直接作为本地草稿载入。
  useEffect(() => {
    if (_id || !resumeDraftId || !remoteDraft || stored) return;
    setStored(storeKey, draftToContent(remoteDraft, fallback));
  }, [_id, resumeDraftId, remoteDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const remoteContent = _id && remoteDraft && base ? draftToContent(remoteDraft, base) : undefined;
  const remoteDiffers = Boolean(remoteContent && base && hasContentChanges(base, remoteContent));
  const offerRestore = remoteDiffers && !stored && !offerDismissed;

  const draft = stored ?? base;
  const dirty = Boolean(stored && base && hasContentChanges(base, stored));

  /** 把本地草稿推送到服务端；串行执行，后一次总以最新内容为准。 */
  const pushRemote = async () => {
    await syncing.current;
    const latest = useContentDraftStore.getState().drafts[storeKey];
    if (!latest || !base || !hasContentChanges(base, latest)) return;
    setSync("syncing");
    const input = contentToDraftInput(kind, _id, latest);
    const id = remoteId.current ?? draftId;
    const job = (id ? updateDashboardDraft(id, input) : createDashboardDraft(input))
      .then((result) => {
        remoteId.current = result._id;
        setSync("synced");
        if (!_id && !resumeDraftId) {
          // 新建内容首次落盘后把草稿 id 写进地址，刷新或换设备都能继续。
          window.history.replaceState(null, "", `${window.location.pathname}?draft=${result._id}`);
        }
      })
      .catch(() => setSync("failed"));
    syncing.current = job;
    await job;
  };

  /** 停止输入一段时间后自动保存到服务端草稿。 */
  useEffect(() => {
    if (!dirty) return;
    setSync("pending");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void pushRemote(); }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer.current);
  }, [stored]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 修改单个字段；回到与已保存版本一致时自动清除本地草稿。 */
  const change = <K extends keyof (PostDraft & PageDraft)>(field: K, value: (PostDraft & PageDraft)[K]) => {
    const current = useContentDraftStore.getState().drafts[storeKey] ?? base;
    if (!current || !base) return;
    const next = { ...current, [field]: value } as ContentDraft;
    if (hasContentChanges(base, next)) {
      setStored(storeKey, next);
    } else {
      setStored(storeKey, undefined);
      setOfferDismissed(true);
      void removeRemote();
    }
  };

  const removeRemote = async () => {
    window.clearTimeout(timer.current);
    await syncing.current;
    const id = remoteId.current ?? draftId;
    remoteId.current = undefined;
    setSync("idle");
    if (!id) return;
    await deleteDashboardDraft(id).catch(() => undefined);
    await remote.mutate(null, { revalidate: false });
    await mutate(dashboardNewDraftsKey(kind));
  };

  /** 放弃修改：同时丢弃本地与服务端草稿，回到已保存版本。 */
  const discard = async () => {
    setStored(storeKey, undefined);
    await removeRemote();
  };

  const restore = () => {
    if (remoteContent) setStored(storeKey, remoteContent);
    setOfferDismissed(true);
  };

  const dismissRestore = async () => {
    setOfferDismissed(true);
    await removeRemote();
  };

  /**
   * 正式保存；可在同一次提交中覆盖发布状态。成功后删除服务端草稿。
   * @param override 额外写入的字段（如 isPublished）
   * @returns 是否成功
   */
  const save = async (override: Partial<PostDraft> = {}) => {
    if (!draft || !base) return false;
    const next = { ...draft, ...override } as ContentDraft;
    window.clearTimeout(timer.current);
    try {
      if (!_id) {
        const created = kind === "post"
          ? await createDashboardPost({ ...(next as PostDraft), slug: next.slug.trim() })
          : await createDashboardPage(next as PageDraft);
        await removeRemote();
        setStored(storeKey, undefined);
        await mutate(isListKey, undefined, { revalidate: true });
        if (kind === "page") await mutate(DASHBOARD_PAGES_KEY);
        router.replace(`/dashboard/${kind === "post" ? "posts" : "pages"}/${created._id}`);
        return true;
      }
      const patch = changedFields(base, next);
      let updated = base;
      if (Object.keys(patch).length) {
        updated = kind === "post"
          ? postToDraft(await updateDashboardPost(_id, patch as Partial<PostDraft>))
          : pageToDraft(await updateDashboardPage(_id, patch as Partial<PageDraft>));
      }
      const current = useContentDraftStore.getState().drafts[storeKey] ?? base;
      // 只把请求发出后产生的编辑叠到服务端版本，发布覆盖值不会被误判为继续输入。
      const editsDuringSave = changedFields(draft, current);
      const remaining = { ...updated, ...editsDuringSave } as ContentDraft;
      setStored(storeKey, hasContentChanges(updated, remaining) ? remaining : undefined);
      await saved.mutate(updated, { revalidate: false });
      if (!hasContentChanges(updated, remaining)) await removeRemote();
      await mutate(isListKey, undefined, { revalidate: true });
      if (kind === "page") await mutate(DASHBOARD_PAGES_KEY);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败，草稿已保留");
      return false;
    }
  };

  return {
    draft,
    base,
    dirty,
    sync,
    remoteDraft: offerRestore ? remoteDraft : undefined,
    loading: Boolean(_id) && saved.isLoading,
    error: saved.error as Error | undefined,
    retry: () => saved.mutate(),
    change,
    discard,
    restore,
    dismissRestore,
    save,
    flush: pushRemote,
  };
}
