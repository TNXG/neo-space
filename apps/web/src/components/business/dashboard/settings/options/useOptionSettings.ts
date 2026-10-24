"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import type { DashboardOptions, OptionDocument, OptionValue } from "@/types/api";
import { DASHBOARD_OPTIONS_KEY, getDashboardOption, getDashboardOptions, saveDashboardOption } from "@/lib/dashboard-options";
import { isOptionDocument, optionError, readOption, sameOptionValue, writeOption } from "./option-values";
import type { OptionGroup } from "./option-schema";

interface OptionEdit { original: OptionDocument; draft: OptionDocument; paths: string[]; }

/** 每组保留独立编辑快照；保存失败不丢输入，写后回读失败禁止重复写入。 */
export function useOptionSettings(group: OptionGroup) {
  const { data, error, mutate } = useSWR<DashboardOptions>(DASHBOARD_OPTIONS_KEY, getDashboardOptions, { shouldRetryOnError: false });
  const [edit, setEdit] = useState<OptionEdit | null>(null);
  const [pending, setPending] = useState(false);
  const [awaitingRead, setAwaitingRead] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const inFlight = useRef(false);
  const stored = data?.[group.key];
  const incompatible = stored !== undefined && !isOptionDocument(stored);
  const document = edit?.draft ?? (data && !incompatible ? stored ?? {} : undefined);
  const dirty = edit !== null && !sameOptionValue(edit.original, edit.draft);

  /** 仅在真实数据读取后编辑；后台焦点重验证不会覆盖当前草稿。 */
  function change(path: string, value: OptionValue | undefined) {
    if (inFlight.current || awaitingRead || !document) return;
    setMessage(""); setFailure("");
    setEdit(current => ({ original: current?.original ?? document, draft: writeOption(current?.draft ?? document, path, value), paths: [...new Set([...(current?.paths ?? []), path])] }));
  }

  /** 丢弃本组未保存修改，不发送请求。 */
  function reset() { if (!inFlight.current && !awaitingRead) { setEdit(null); setFailure(""); setMessage(""); } }

  /** 采用后端最终生效值并说明环境变量或后端规范化造成的差异。 */
  async function readSaved() {
    const fresh = await getDashboardOption(group.key);
    if (!isOptionDocument(fresh)) throw new Error("后端返回的配置不是对象，无法确认保存结果。");
    const adjusted = edit?.paths.some(path => !sameOptionValue(readOption(edit.draft, path), readOption(fresh, path)));
    await mutate(current => ({ ...current, [group.key]: fresh }), { revalidate: false });
    setEdit(null); setAwaitingRead(false); setFailure("");
    setMessage(adjusted ? "已保存并回读；部分值被后端调整或被部署环境变量覆盖，页面已显示最终生效值。" : "已保存，并已回读最终生效配置。");
  }

  /** PUT 只替换本分组，其他分组不受影响；数组删除不会被 PATCH 合并复活。 */
  async function save() {
    if (inFlight.current || awaitingRead || !dirty || !edit) return;
    inFlight.current = true; setPending(true); setFailure(""); setMessage("");
    let written = false;
    try {
      await saveDashboardOption(group.key, edit.draft);
      written = true; setAwaitingRead(true);
      await readSaved();
    } catch (cause) {
      setFailure(written ? `配置已保存，但回读失败；请只重试读取。${optionError(cause)}` : `保存失败，修改已保留。${optionError(cause)}`);
    } finally { inFlight.current = false; setPending(false); }
  }

  /** 保存后只重试读取；首次加载失败则重新读取配置集合。 */
  async function retry() {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true);
    try { if (awaitingRead) await readSaved(); else { await mutate(); setFailure(""); } }
    catch (cause) { setFailure(optionError(cause)); }
    finally { inFlight.current = false; setPending(false); }
  }

  return { document, dirty, canReset: edit !== null, pending, awaitingRead, loading: !data && !error, failure: failure || (incompatible ? "该分组的数据格式与配置表单不兼容，未进行覆盖。" : error ? optionError(error) : ""), message, change, reset, save, retry };
}
