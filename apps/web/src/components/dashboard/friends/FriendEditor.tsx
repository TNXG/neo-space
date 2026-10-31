"use client";

import type { DashboardLinkInput, Link, LinkStateType } from "@/types/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FriendAvatar } from "@/components/layouts/friends/FriendMeta";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { LinkState } from "@/types/api";
import { TagInput } from "../content/TagInput";

export const STATE_LABELS: Record<LinkStateType, string> = {
  [LinkState.NORMAL]: "朋友们",
  [LinkState.PENDING]: "待审核",
  [LinkState.OUTDATED]: "过时的",
  [LinkState.REJECTED]: "已拒绝",
  [LinkState.BANNED]: "已屏蔽",
};

interface FriendEditorProps {
  /** undefined 关闭；null 新建；Link 编辑 */
  target: Link | null | undefined;
  onClose: () => void;
  onSave: (input: DashboardLinkInput, _id?: string) => Promise<boolean>;
}

type Issues = Partial<Record<"name" | "url" | "avatar" | "rssurl" | "email", string>>;

const toDraft = (link: Link | null): DashboardLinkInput => ({
  name: link?.name ?? "",
  url: link?.url ?? "",
  avatar: link?.avatar ?? "",
  description: link?.description ?? "",
  state: link?.state ?? LinkState.NORMAL,
  email: link?.email ?? null,
  rssurl: link?.rssurl ?? null,
  techstack: link?.techstack ?? null,
});

const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value);

/**
 * 字段校验：输入时即时给出，不等提交。
 * @param draft 草稿
 * @returns 每个字段的问题
 */
function validate(draft: DashboardLinkInput): Issues {
  const issues: Issues = {};
  if (!draft.name.trim()) issues.name = "请填写站点名称";
  if (!isHttpUrl(draft.url.trim())) issues.url = "需要以 http(s):// 开头的完整地址";
  if (draft.avatar.trim() && !isHttpUrl(draft.avatar.trim())) issues.avatar = "头像需是 http(s) 图片地址";
  if (draft.rssurl?.trim() && !isHttpUrl(draft.rssurl.trim())) issues.rssurl = "订阅源需是 http(s) 地址";
  if (draft.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) issues.email = "邮箱格式不正确";
  return issues;
}

/** 表单本体；以 key 重建，切换编辑对象时草稿自然重置。 */
function EditorForm({ link, onClose, onSave }: { link: Link | null; onClose: () => void; onSave: FriendEditorProps["onSave"] }) {
  const [draft, setDraft] = useState(() => toDraft(link));
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const issues = validate(draft);
  const invalid = Object.keys(issues).length > 0;
  const issueOf = (field: keyof Issues) => touched.has(field) ? issues[field] : undefined;
  const update = <K extends keyof DashboardLinkInput>(field: K, value: DashboardLinkInput[K]) => {
    setDraft(current => ({ ...current, [field]: value }));
    setTouched(current => new Set(current).add(field));
  };
  const optional = (value: string) => value.trim() || null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(new Set(["name", "url", "avatar", "rssurl", "email"]));
    if (invalid) return;
    setSaving(true);
    const ok = await onSave({
      ...draft,
      name: draft.name.trim(),
      url: draft.url.trim(),
      avatar: draft.avatar.trim(),
      description: draft.description.trim(),
      email: optional(draft.email ?? ""),
      rssurl: optional(draft.rssurl ?? ""),
      techstack: draft.techstack?.length ? draft.techstack : null,
    }, link?._id);
    setSaving(false);
    if (ok) onClose();
  };

  const text = (field: "name" | "url" | "avatar", label: string, placeholder: string) => (
    <Field data-invalid={Boolean(issueOf(field)) || undefined}>
      <FieldLabel htmlFor={`friend-${field}`}>{label}</FieldLabel>
      <Input id={`friend-${field}`} value={draft[field]} placeholder={placeholder} aria-invalid={Boolean(issueOf(field)) || undefined} onChange={event => update(field, event.target.value)} />
      {issueOf(field) && <FieldError>{issueOf(field)}</FieldError>}
    </Field>
  );

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DrawerBody className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3">
          <FriendAvatar key={draft.avatar} link={{ avatar: isHttpUrl(draft.avatar) ? draft.avatar : "", name: draft.name || "?" }} className="size-11 rounded-lg text-base" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{draft.name || "站点名称"}</span>
            <span className="truncate text-xs text-muted-foreground">{draft.description || "站点简介会显示在这里"}</span>
          </div>
        </div>
        <FieldGroup className="gap-5">
          {text("name", "名称", "我的博客")}
          {text("url", "地址", "https://example.com")}
          {text("avatar", "头像", "https://example.com/avatar.png")}
          <Field>
            <FieldLabel htmlFor="friend-description">简介</FieldLabel>
            <Textarea id="friend-description" rows={2} value={draft.description} onChange={event => update("description", event.target.value)} />
          </Field>
          <Field data-invalid={Boolean(issueOf("rssurl")) || undefined}>
            <FieldLabel htmlFor="friend-rssurl">订阅源</FieldLabel>
            <Input id="friend-rssurl" value={draft.rssurl ?? ""} placeholder="https://example.com/feed.xml" aria-invalid={Boolean(issueOf("rssurl")) || undefined} onChange={event => update("rssurl", event.target.value)} />
            {issueOf("rssurl")
              ? <FieldError>{issueOf("rssurl")}</FieldError>
              : <FieldDescription>填写后，友链页会以对方最新文章展示；抓取失败时自动降级为名片。</FieldDescription>}
          </Field>
          <Field>
            <FieldLabel htmlFor="friend-techstack">技术栈</FieldLabel>
            <TagInput id="friend-techstack" value={draft.techstack ?? []} suggestions={[]} onChange={tags => update("techstack", tags)} />
          </Field>
          <Field data-invalid={Boolean(issueOf("email")) || undefined}>
            <FieldLabel htmlFor="friend-email">联系邮箱</FieldLabel>
            <Input id="friend-email" type="email" value={draft.email ?? ""} placeholder="仅后台可见" aria-invalid={Boolean(issueOf("email")) || undefined} onChange={event => update("email", event.target.value)} />
            {issueOf("email") && <FieldError>{issueOf("email")}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="friend-state">状态</FieldLabel>
            <Select value={String(draft.state)} onValueChange={value => update("state", Number(value) as LinkStateType)}>
              <SelectTrigger id="friend-state" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {Object.entries(STATE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </DrawerBody>
      <DrawerFooter className="flex-row justify-end gap-2 px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
        <Button type="submit" disabled={saving || (invalid && touched.size > 0)}>{saving ? "保存中…" : link ? "保存" : "添加"}</Button>
      </DrawerFooter>
    </form>
  );
}

/**
 * 新建 / 编辑友链：桌面端右侧抽屉，移动端底部面板，不打断列表上下文。
 * @param props 编辑目标与回调
 * @returns 编辑抽屉
 */
export function FriendEditor({ target, onClose, onSave }: FriendEditorProps) {
  const isMobile = useIsMobile();
  return (
    <Drawer open={target !== undefined} onOpenChange={open => !open && onClose()} direction={isMobile ? "bottom" : "right"}>
      <DrawerContent className="flex flex-col data-[vaul-drawer-direction=right]:sm:max-w-md data-[vaul-drawer-direction=bottom]:max-h-[90vh]">
        <DrawerHeader className="text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          <DrawerTitle>{target ? `编辑「${target.name}」` : "添加友链"}</DrawerTitle>
          <DrawerDescription>保存后会在后台检测站点可用性与订阅源。</DrawerDescription>
        </DrawerHeader>
        {target !== undefined && <EditorForm key={target?._id ?? "new"} link={target} onClose={onClose} onSave={onSave} />}
      </DrawerContent>
    </Drawer>
  );
}
