"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import type { Reader, User } from "@/types/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/lib/inline-icon";
import { DASHBOARD_PROFILE_KEY, DASHBOARD_SESSION_KEY, getDashboardProfile, updateDashboardProfile } from "@/lib/dashboard-api";
import { failureMessage } from "./settings-model";
import { SettingsRow } from "./settings-row";
import { focusSettingsField, SettingsIssueList, SettingsNotice, SettingsSaveBar } from "./settings-savebar";
import { ProfileSkeleton } from "./profile-skeleton";
import {
  createProfileDraft,
  profileChanges,
  profileIssues,
  socialPlatforms,
  type BasicProfileField,
  type ProfileDraft,
  type SocialProfileField,
} from "./profile-model";
import { useProfileDraftStore } from "./use-settings-draft";

/** 资料页共用设置页浮动操作条与字段行；保存后回读确认最终值。 */
export function ProfileForm() {
  const { data, error, mutate } = useSWR<User>(DASHBOARD_PROFILE_KEY, getDashboardProfile);
  const { mutate: mutateCache } = useSWRConfig();
  const draft = useProfileDraftStore(state => state.draft);
  const setDraft = useProfileDraftStore(state => state.setDraft);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [pending, setPending] = useState(false);
  const [awaitingRead, setAwaitingRead] = useState(false);
  const [failure, setFailure] = useState("");
  const [attention, setAttention] = useState(0);
  const [focusKey, setFocusKey] = useState<string>();
  const inFlight = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const current = draft ?? (data ? createProfileDraft(data) : undefined);
  const changes = data && current ? profileChanges(data, current) : {};
  const dirty = Object.keys(changes).length > 0;
  const busy = pending || awaitingRead;

  useEffect(() => {
    if (!focusKey) return;
    const frame = requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>(`[data-social="${focusKey}"] input`)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusKey]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** 统一写入草稿：与服务端一致时清空，导航上的未保存标记随之消失。 */
  function update(path: string, next: (base: ProfileDraft) => ProfileDraft) {
    if (busy || !data) return;
    const updated = next(useProfileDraftStore.getState().draft ?? createProfileDraft(data));
    setDraft(Object.keys(profileChanges(data, updated)).length ? updated : undefined);
    setIssues(list => list.filter(issue => issue.path !== path));
    setFailure("");
  }

  /** 新增第一个未使用平台，并把焦点交给新行。 */
  function addSocial() {
    if (!current) return;
    const available = socialPlatforms.find(platform => !current.order.includes(platform.key));
    if (!available) return;
    update(`social.${available.key}`, base => ({ ...base, order: [...base.order, available.key] }));
    setFocusKey(available.key);
  }

  /** 放弃修改可通过提示条恢复，避免误点清空整页输入。 */
  function discard() {
    const snapshot = draft;
    setDraft(undefined);
    setIssues([]);
    if (snapshot) toast("已放弃资料修改", { id: "discard-profile", action: { label: "恢复", onClick: () => setDraft(snapshot) } });
  }

  async function readFresh() {
    const fresh = await getDashboardProfile();
    await mutate(fresh, { revalidate: false });
    setDraft(undefined);
    setAwaitingRead(false);
    setFailure("");
  }

  /** 保存失败保留输入；写入成功但回读失败时只允许重试读取。 */
  async function save() {
    if (inFlight.current || awaitingRead || !data || !current || !dirty) return;
    const found = profileIssues(current);
    setIssues(found);
    if (found.length) {
      setAttention(value => value + 1);
      requestAnimationFrame(() => focusSettingsField(form.current, found[0].path));
      return;
    }
    inFlight.current = true;
    setPending(true);
    setFailure("");
    let saved = false;
    try {
      const reader = await updateDashboardProfile(changes);
      saved = true;
      setAwaitingRead(true);
      await mutateCache<Reader | null>(DASHBOARD_SESSION_KEY, session => session ? { ...reader, isOwner: session.isOwner || reader.isOwner } : reader, { revalidate: false });
      await readFresh();
      toast.success("个人资料已保存");
    } catch (cause) {
      setFailure(saved ? `资料已保存，但未能重新读取最新资料；请只重试读取。${failureMessage(cause)}` : `保存失败，输入内容已保留。${failureMessage(cause)}`);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  /** 读取失败重新拉取；保存成功后的失败只重读资料。 */
  async function retry() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      if (awaitingRead) await readFresh();
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

  const errorFor = (path: string) => issues.find(issue => issue.path === path)?.message;
  const basic = (key: BasicProfileField, label: string, hint?: string, type = "text", multiline = false) => {
    const props = {
      id: `profile-${key}`,
      "aria-invalid": Boolean(errorFor(key)),
      value: current?.basic[key] ?? "",
      disabled: busy,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(key, base => ({ ...base, basic: { ...base.basic, [key]: event.target.value } })),
    };
    return (
      <SettingsRow key={key} id={`profile-${key}`} controlId={`profile-${key}`} path={key} label={label} hint={hint} error={errorFor(key)}>
        {multiline ? <Textarea {...props} rows={3} /> : <Input {...props} type={type} />}
      </SettingsRow>
    );
  };

  return (
    <form
      ref={form}
      aria-label="用户资料"
      aria-busy={pending}
      className="flex h-full min-h-0 min-w-0 flex-col"
      onKeyDown={event => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) event.preventDefault();
      }}
      onSubmit={event => { event.preventDefault(); void save(); }}
      onReset={event => { event.preventDefault(); discard(); }}
      data-settings-form
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pt-5 lg:px-6 lg:pt-8">
          <SettingsNotice show={Boolean(error) && !failure}>
            <Alert variant="destructive"><AlertTitle>无法读取资料</AlertTitle><AlertDescription><p>{failureMessage(error)}</p><Button type="button" variant="outline" size="sm" onClick={() => { void retry(); }}>重试读取</Button></AlertDescription></Alert>
          </SettingsNotice>
          <SettingsNotice show={Boolean(failure)}>
            <Alert variant="destructive"><AlertTitle>{awaitingRead ? "已保存，等待确认最新资料" : "保存失败"}</AlertTitle><AlertDescription><p>{failure}</p>{awaitingRead && <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => { void retry(); }}>重新读取已保存资料</Button>}</AlertDescription></Alert>
          </SettingsNotice>
          <SettingsNotice show={issues.length > 0}>
            <Alert variant="destructive"><AlertTitle>还有 {issues.length} 项需要处理</AlertTitle><AlertDescription><SettingsIssueList issues={issues} onSelect={path => focusSettingsField(form.current, path)} /></AlertDescription></Alert>
          </SettingsNotice>

          {current ? <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }} className="flex items-center gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-lg font-medium">
                {current.basic.image ? <Image src={current.basic.image} alt="头像预览" width={64} height={64} unoptimized className="size-full object-cover" /> : (current.basic.name.slice(0, 2).toUpperCase() || "?")}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">{current.basic.name || "未填写昵称"}</h2>
                <p className="truncate text-sm text-muted-foreground">@{current.basic.handle || "未填写用户名"}</p>
              </div>
            </motion.div>

            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.04, ease: [0.23, 1, 0.32, 1] }} className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon icon="mingcute:user-3-line" className="size-4 text-muted-foreground" aria-hidden="true" />基本信息</h3>
              <div className="divide-y divide-border/50 rounded-xl border border-border px-3 lg:px-4">
                {basic("name", "昵称")}
                {basic("handle", "用户名")}
                {basic("email", "邮箱", "展示在公开主页的邮件入口。", "email")}
                {basic("url", "个人网站", "以 http:// 或 https:// 开头。", "url")}
                {basic("image", "头像地址", "公开图片链接，或以 / 开头的站内路径。", "url")}
                {basic("introduce", "个人简介", undefined, "text", true)}
              </div>
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08, ease: [0.23, 1, 0.32, 1] }} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon icon="mingcute:link-line" className="size-4 text-muted-foreground" aria-hidden="true" />社交链接</h3>
                <Button type="button" variant="secondary" size="sm" disabled={busy || current.order.length === socialPlatforms.length} onClick={addSocial}><Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />添加</Button>
              </div>
              <div className="overflow-hidden rounded-xl border border-border px-3 lg:px-4">
                {current.order.length === 0 && <p className="py-4 text-sm text-muted-foreground">尚未添加社交链接。</p>}
                <AnimatePresence initial={false}>
                  {current.order.map(key => {
                    const platform = socialPlatforms.find(item => item.key === key)!;
                    const path = `social.${key}`;
                    return (
                      <motion.div
                        key={key}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden border-b border-border/50 last:border-b-0"
                      >
                        <div data-social={key} data-path={path} className="flex flex-col gap-2 py-3 lg:flex-row lg:flex-wrap lg:items-center">
                          <span className="w-32 shrink-0 text-sm">{platform.label}</span>
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Input type={platform.type} aria-label={`${platform.label}账号`} aria-invalid={Boolean(errorFor(path))} placeholder={platform.placeholder} value={current.social[key]} disabled={busy} spellCheck={false} onChange={event => update(path, base => ({ ...base, social: { ...base.social, [key]: event.target.value } }))} />
                            <Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label={`移除${platform.label}`} className="text-muted-foreground hover:text-destructive" onClick={() => update(path, base => ({ ...base, order: base.order.filter(item => item !== key), social: { ...base.social, [key]: "" } }))}><Icon icon="mingcute:delete-line" aria-hidden="true" /></Button>
                          </div>
                          {errorFor(path) && <p className="text-xs text-destructive lg:w-full lg:pl-32">{errorFor(path)}</p>}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.section>
          </> : !error && <ProfileSkeleton />}
        </div>
        <SettingsSaveBar dirty={dirty} pending={pending} disabled={busy} attention={attention} saveLabel="保存" />
      </div>
    </form>
  );
}
