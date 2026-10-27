"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { create } from "zustand";
import type { DashboardOptions, ManagedOptionKey, OptionDocument, OptionValue } from "@/types/api";
import { DASHBOARD_OPTIONS_KEY, getDashboardOption, getDashboardOptions, saveDashboardOption } from "@/lib/dashboard-options";
import type { SettingGroup } from "./settings-schema";
import { failureMessage, isDocument, readValue, sameValue, writeValue } from "./settings-model";

/** 草稿按分组保存在内存中，切换设置分类不会丢失未保存输入。 */
export interface GroupDraft {
  base: OptionDocument;
  draft: OptionDocument;
  edited: string[];
}

interface DraftStore {
  drafts: Partial<Record<ManagedOptionKey, GroupDraft>>;
  edit: (key: ManagedOptionKey, base: OptionDocument, path: string, value: OptionValue | undefined) => void;
  discard: (key: ManagedOptionKey) => void;
}

export const useDraftStore = create<DraftStore>(set => ({
  drafts: {},
  edit: (key, base, path, value) => set(state => {
    const current = state.drafts[key] ?? { base, draft: base, edited: [] };
    const draft = writeValue(current.draft, path, value);
    return { drafts: { ...state.drafts, [key]: { base: current.base, draft, edited: [...new Set([...current.edited, path])] } } };
  }),
  discard: key => set(state => {
    const drafts = { ...state.drafts };
    delete drafts[key];
    return { drafts };
  }),
}));

/** 返回草稿映射本身，调用方按需派生未保存分组，避免选择器每次产生新数组。 */
export function useSettingsDrafts() {
  return useDraftStore(state => state.drafts);
}

/** 管理单个分组的读取、草稿、保存与回读确认。 */
export function useGroupSettings(group: SettingGroup) {
  const { data, error, mutate } = useSWR<DashboardOptions>(DASHBOARD_OPTIONS_KEY, getDashboardOptions, { shouldRetryOnError: false });
  const draft = useDraftStore(state => state.drafts[group.key]);
  const discard = useDraftStore(state => state.discard);
  const [pending, setPending] = useState(false);
  const [awaitingRead, setAwaitingRead] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const inFlight = useRef(false);
  const stored = data?.[group.key];
  const incompatible = stored !== undefined && !isDocument(stored);
  const document = draft?.draft ?? (isDocument(stored) ? stored : undefined);
  const dirty = draft !== undefined && !sameValue(draft.base, draft.draft);
  const busy = pending || awaitingRead;

  /** 写入草稿；等待回读期间禁止继续编辑，避免结果指向未知状态。 */
  function change(path: string, value: OptionValue | undefined) {
    if (busy || !document) return;
    setMessage("");
    setFailure("");
    useDraftStore.getState().edit(group.key, draft?.base ?? document, path, value);
  }

  /** 丢弃本组草稿，回到当前服务端快照。 */
  function reset() {
    if (busy) return;
    discard(group.key);
    setMessage("");
    setFailure("");
  }

  /** 写入后回读并采用最终生效值，解释环境变量或后端规范化造成的差异。 */
  async function readSaved() {
    const fresh = await getDashboardOption(group.key);
    if (!isDocument(fresh)) throw new Error("后端返回的配置格式不正确，无法确认保存结果。");
    const entry = useDraftStore.getState().drafts[group.key];
    const adjusted = entry?.edited.some(path => !sameValue(readValue(entry.draft, path), readValue(fresh, path))) ?? false;
    await mutate(current => ({ ...current, [group.key]: fresh }), { revalidate: false });
    discard(group.key);
    setAwaitingRead(false);
    setFailure("");
    setMessage(adjusted ? "已保存并回读；部分值被后端调整或被部署环境变量覆盖，页面已显示最终生效值。" : "已保存，并已回读最终生效配置。");
  }

  /** 只提交本组完整文档；写入失败保留草稿，回读失败禁止重复写入。 */
  async function save() {
    const entry = useDraftStore.getState().drafts[group.key];
    if (inFlight.current || awaitingRead || !entry || sameValue(entry.base, entry.draft)) return;
    inFlight.current = true;
    setPending(true);
    setFailure("");
    setMessage("");
    let written = false;
    try {
      await saveDashboardOption(group.key, entry.draft);
      written = true;
      setAwaitingRead(true);
      await readSaved();
    } catch (cause) {
      setFailure(written ? `配置已保存，但回读失败；请只重试读取。${failureMessage(cause)}` : `保存失败，修改已保留。${failureMessage(cause)}`);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  /** 首次加载失败重新拉取集合；写入成功后的失败重试只读单组。 */
  async function retry() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      if (awaitingRead) await readSaved();
      else {
        await mutate();
        setFailure("");
      }
    } catch (cause) {
      setFailure(failureMessage(cause));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return {
    document, dirty, pending, awaitingRead, busy, message,
    failure: failure || (incompatible ? "该分组的数据格式与表单不兼容，已停止覆盖。" : error ? failureMessage(error) : ""),
    loading: !data && !error,
    change, reset, save, retry,
  };
}
