"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { Reader, User } from "@/types/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/lib/inline-icon";
import { DASHBOARD_PROFILE_KEY, DASHBOARD_SESSION_KEY, getDashboardProfile, updateDashboardProfile } from "@/lib/dashboard-api";
import { failureMessage } from "./settings-model";
import { SettingsRow } from "./settings-row";
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

/** 资料页共用设置页操作栏与字段行；保存后回读确认最终值。 */
export function ProfileForm() {
  const { data, error, mutate } = useSWR<User>(DASHBOARD_PROFILE_KEY, getDashboardProfile);
  const { mutate: mutateCache } = useSWRConfig();
  const [draft, setDraft] = useState<ProfileDraft>();
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [pending, setPending] = useState(false);
  const [awaitingRead, setAwaitingRead] = useState(false);
  const [failure, setFailure] = useState("");
  const [message, setMessage] = useState("");
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

  /** 编辑时保留已有草稿；首次输入才从服务端快照建立草稿。 */
  function changeBasic(key: BasicProfileField, value: string) {
    if (busy || !data) return;
    setDraft(currentDraft => {
      const base = currentDraft ?? createProfileDraft(data);
      return { ...base, basic: { ...base.basic, [key]: value } };
    });
    setIssues([]);
    setMessage("");
  }

  /** 同步修改展示顺序与值，新增平台不写入空值请求体。 */
  function changeSocial(key: SocialProfileField, value: string) {
    if (busy || !data) return;
    setDraft(currentDraft => {
      const base = currentDraft ?? createProfileDraft(data);
      return { ...base, social: { ...base.social, [key]: value } };
    });
    setIssues([]);
    setMessage("");
  }

  /** 新增第一个未使用平台，并把焦点交给新行。 */
  function addSocial() {
    if (busy || !data) return;
    const base = draft ?? createProfileDraft(data);
    const available = socialPlatforms.find(platform => !base.order.includes(platform.key));
    if (!available) return;
    setDraft({ ...base, order: [...base.order, available.key] });
    setFocusKey(available.key);
  }

  /** 移除平台并把旧平台的草稿值清空，保存时显式删除。 */
  function removeSocial(key: SocialProfileField) {
    if (busy || !data) return;
    setDraft(currentDraft => {
      const base = currentDraft ?? createProfileDraft(data);
      return { ...base, order: base.order.filter(item => item !== key), social: { ...base.social, [key]: "" } };
    });
  }

  /** 保存失败保留输入；写入成功但回读失败时只允许重试读取。 */
  async function save() {
    if (inFlight.current || awaitingRead || !data || !current || !dirty) return;
    const found = profileIssues(current);
    setIssues(found);
    if (found.length) {
      requestAnimationFrame(() => {
        const target = form.current?.querySelector<HTMLElement>(`[data-path="${found[0].path}"]`);
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
        target?.querySelector<HTMLElement>("input, textarea, select")?.focus({ preventScroll: true });
      });
      return;
    }
    inFlight.current = true;
    setPending(true);
    setFailure("");
    setMessage("");
    let saved = false;
    try {
      const reader = await updateDashboardProfile(changes);
      saved = true;
      setAwaitingRead(true);
      await mutateCache<Reader | null>(DASHBOARD_SESSION_KEY, session => session ? { ...reader, isOwner: session.isOwner || reader.isOwner } : reader, { revalidate: false });
      const fresh = await getDashboardProfile();
      await mutate(fresh, { revalidate: false });
      setDraft(undefined);
      setAwaitingRead(false);
      setMessage("个人资料已保存，并已读取最新资料。");
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
      if (awaitingRead) {
        const fresh = await getDashboardProfile();
        await mutate(fresh, { revalidate: false });
        setDraft(undefined);
        setAwaitingRead(false);
        setFailure("");
        setMessage("已重新读取最新资料。");
      } else {
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
  const basic = (key: BasicProfileField, label: string, hint?: string, type = "text", multiline = false) => (
    <SettingsRow key={key} id={`profile-${key}`} controlId={`profile-${key}`} path={key} label={label} hint={hint} error={errorFor(key)}>
      {multiline
        ? <Textarea id={`profile-${key}`} aria-invalid={Boolean(errorFor(key))} value={current?.basic[key] ?? ""} disabled={busy} rows={3} onChange={event => changeBasic(key, event.target.value)} />
        : <Input id={`profile-${key}`} type={type} aria-invalid={Boolean(errorFor(key))} value={current?.basic[key] ?? ""} disabled={busy} onChange={event => changeBasic(key, event.target.value)} />}
    </SettingsRow>
  );

  return (
    <form ref={form} aria-label="用户资料" aria-busy={pending} className="flex h-full min-h-0 min-w-0 flex-col" onSubmit={event => { event.preventDefault(); void save(); }} onReset={event => { event.preventDefault(); setDraft(undefined); setIssues([]); setMessage(""); }}>
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 lg:px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-tight">用户资料</h1>
          {dirty && <span role="status" className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">未保存</span>}
        </div>
        <div className="flex items-center gap-2">
          {dirty && <Button type="reset" variant="ghost" size="sm" disabled={busy}>撤销修改</Button>}
          {!data && !error ? <Skeleton aria-hidden="true" className="h-8 w-24 rounded-lg" /> : <Button type="submit" size="sm" disabled={!dirty || busy}>
              {pending
                ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
                : <Icon icon="mingcute:check-line" data-icon="inline-start" aria-hidden="true" />}
              {pending ? "保存中…" : "保存资料"}
            </Button>}
        </div>
        </header>

        <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 lg:p-6">
          {error && !failure && <Alert variant="destructive"><AlertTitle>无法读取资料</AlertTitle><AlertDescription><p>{failureMessage(error)}</p><Button type="button" variant="outline" size="sm" onClick={() => { void retry(); }}>重试读取</Button></AlertDescription></Alert>}
          {failure && <Alert variant="destructive"><AlertTitle>{awaitingRead ? "已保存，等待确认最新资料" : "保存失败"}</AlertTitle><AlertDescription><p>{failure}</p>{awaitingRead && <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => { void retry(); }}>重新读取已保存资料</Button>}</AlertDescription></Alert>}
          {issues.length > 0 && <Alert variant="destructive"><AlertTitle>还有 {issues.length} 项需要处理</AlertTitle><AlertDescription><ul className="list-disc pl-4">{issues.map((issue, index) => <li key={`${issue.path}-${index}`}>{issue.message}</li>)}</ul></AlertDescription></Alert>}
          {message && <Alert role="status"><AlertTitle>保存完成</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}

          {current ? <>
            <div className="flex items-center gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-lg font-medium">
                {current.basic.image ? <Image src={current.basic.image} alt="头像预览" width={64} height={64} unoptimized className="size-full object-cover" /> : (current.basic.name.slice(0, 2).toUpperCase() || "?")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{current.basic.name || "未填写昵称"}</p>
                <p className="truncate text-sm text-muted-foreground">@{current.basic.handle || "未填写用户名"}</p>
              </div>
            </div>

            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon icon="mingcute:user-3-line" className="size-4 text-muted-foreground" aria-hidden="true" />基本信息</h2>
              <div className="divide-y divide-border/50 rounded-xl border border-border px-3 lg:px-4">
                {basic("name", "昵称")}
                {basic("handle", "用户名")}
                {basic("email", "邮箱", "展示在公开主页的邮件入口。", "email")}
                {basic("url", "个人网站", "以 http:// 或 https:// 开头。", "url")}
                {basic("image", "头像地址", "公开图片链接，或以 / 开头的站内路径。", "url")}
                {basic("introduce", "个人简介", undefined, "text", true)}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon icon="mingcute:link-line" className="size-4 text-muted-foreground" aria-hidden="true" />社交链接</h2>
                <Button type="button" variant="secondary" size="sm" disabled={busy || current.order.length === socialPlatforms.length} onClick={addSocial}><Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />添加</Button>
              </div>
              <div className="divide-y divide-border/50 rounded-xl border border-border px-3 lg:px-4">
                {current.order.length === 0 && <p className="py-4 text-sm text-muted-foreground">尚未添加社交链接。</p>}
                {current.order.map(key => {
                  const platform = socialPlatforms.find(item => item.key === key)!;
                  return (
                    <div key={key} data-social={key} data-path={`social.${key}`} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center">
                      <span className="w-32 shrink-0 text-sm">{platform.label}</span>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Input type={platform.type} aria-label={`${platform.label}账号`} aria-invalid={Boolean(errorFor(`social.${key}`))} placeholder={platform.placeholder} value={current.social[key]} disabled={busy} spellCheck={false} onChange={event => changeSocial(key, event.target.value)} />
                        <Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label={`移除${platform.label}`} onClick={() => removeSocial(key)}><Icon icon="mingcute:delete-line" aria-hidden="true" /></Button>
                      </div>
                      {errorFor(`social.${key}`) && <p className="text-xs text-destructive lg:w-full lg:pl-32">{errorFor(`social.${key}`)}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          </> : !error && <ProfileSkeleton />}
        </div>
      </div>
    </form>
  );
}
