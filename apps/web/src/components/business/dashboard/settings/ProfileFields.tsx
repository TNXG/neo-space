"use client";

import Image from "next/image";
import { useState } from "react";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Icon } from "@/lib/inline-icon";
import { ProfileSettingRow } from "./ProfileSettingRow";
import type { BasicProfileField, ProfileDraft } from "./profile-settings-model";

interface ProfileFieldsProps {
  draft: ProfileDraft;
  disabled: boolean;
  onBasicChange: (key: BasicProfileField, value: string) => void;
}

/** 与参考用户页一致，先展示头像与身份概览，失败时回退昵称首字。 */
function ProfileOverview({ draft }: { draft: ProfileDraft }) {
  const [failedSource, setFailedSource] = useState("");
  const source = draft.basic.image.trim();
  const valid = /^(https?:\/\/|\/)/.test(source);
  return (
    <div className="flex items-center gap-5 pb-2">
      <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xl font-medium">
        {valid && failedSource !== source ? <Image src={source} alt="头像预览" width={80} height={80} unoptimized className="size-full object-cover" onError={() => setFailedSource(source)} /> : draft.basic.name.slice(0, 2).toUpperCase() || "?"}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="truncate text-lg font-semibold">{draft.basic.name || "未填写昵称"}</h2>
        <p className="truncate text-sm text-muted-foreground">@{draft.basic.handle}</p>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><Icon icon="mingcute:mail-line" aria-hidden="true" /><span className="truncate">{draft.basic.email}</span></p>
      </div>
    </div>
  );
}

/** 对齐 ../admin 用户页的字段顺序及分栏行布局。 */
export function ProfileFields({ draft, disabled, onBasicChange }: ProfileFieldsProps) {
  /** 构造基础字段的受控输入属性。 */
  const basic = (key: BasicProfileField) => ({ id: `profile-${key}`, value: draft.basic[key], disabled, onChange: (value: string) => onBasicChange(key, value) });
  return (
    <>
      <ProfileOverview draft={draft} />
      <FieldSet disabled={disabled}>
        <FieldLegend className="mb-0 flex items-center gap-3 text-sm font-semibold"><span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Icon icon="mingcute:user-3-line" aria-hidden="true" /></span>基本信息</FieldLegend>
        <FieldGroup className="gap-0 border-y border-border/60">
          <ProfileSettingRow {...basic("name")} label="昵称" required autoComplete="name" />
          <ProfileSettingRow {...basic("handle")} label="用户名" required autoComplete="username" />
          <ProfileSettingRow {...basic("email")} label="邮箱" required type="email" autoComplete="email" description="此邮箱展示在公开主页的邮件入口。" />
          <ProfileSettingRow {...basic("url")} label="个人网站" type="url" autoComplete="url" />
          <ProfileSettingRow {...basic("introduce")} label="个人简介" multiline />
          <ProfileSettingRow {...basic("image")} label="头像 URL" type="url" description="填写可公开访问的图片链接。" />
        </FieldGroup>
      </FieldSet>
    </>
  );
}
