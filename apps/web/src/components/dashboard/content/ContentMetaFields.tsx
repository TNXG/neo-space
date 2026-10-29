"use client";

import type { ContentDraft, ContentIssue, ContentKind, PageDraft, PostDraft } from "./content-model";
import useSWR from "swr";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DASHBOARD_CATEGORIES_KEY, DASHBOARD_TAGS_KEY, getDashboardCategories, getDashboardTags } from "@/lib/dashboard-content";
import { suggestSlug } from "./content-model";
import { TagInput } from "./TagInput";

type Change = <K extends keyof (PostDraft & PageDraft)>(field: K, value: (PostDraft & PageDraft)[K]) => void;

interface ContentMetaFieldsProps {
  kind: ContentKind;
  draft: ContentDraft;
  issues: ContentIssue[];
  onChange: Change;
}

/**
 * 正文之外的属性字段；文章与页面共享路径字段，其余按类型展示。
 * @param props 类型、草稿、校验问题与修改回调
 * @returns 字段组
 */
export function ContentMetaFields({ kind, draft, issues, onChange }: ContentMetaFieldsProps) {
  const categories = useSWR(kind === "post" ? DASHBOARD_CATEGORIES_KEY : null, getDashboardCategories);
  const tags = useSWR(kind === "post" ? DASHBOARD_TAGS_KEY : null, getDashboardTags);
  const issueOf = (field: string) => issues.find(issue => issue.field === field)?.message;
  const slugHint = suggestSlug(draft.title);
  const post = draft as PostDraft;
  const page = draft as PageDraft;

  return (
    <FieldGroup className="gap-5">
      {kind === "post" && (
        <Field data-invalid={Boolean(issueOf("categoryId")) || undefined} data-field="categoryId">
          <FieldLabel htmlFor="content-category">分类</FieldLabel>
          <Select value={post.categoryId || undefined} onValueChange={value => onChange("categoryId", value)}>
            <SelectTrigger id="content-category" aria-invalid={Boolean(issueOf("categoryId")) || undefined} className="w-full">
              <SelectValue placeholder={categories.isLoading ? "正在读取分类…" : "选择分类"} />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                {categories.data?.map(category => <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          {issueOf("categoryId") && <FieldDescription className="text-destructive">{issueOf("categoryId")}</FieldDescription>}
        </Field>
      )}

      <Field data-invalid={Boolean(issueOf("slug")) || undefined} data-field="slug">
        <FieldLabel htmlFor="content-slug">路径</FieldLabel>
        <Input
          id="content-slug"
          value={draft.slug}
          onChange={event => onChange("slug", event.target.value.toLowerCase().replace(/\s+/g, "-"))}
          placeholder={slugHint || (kind === "post" ? "留空自动生成" : "about")}
          aria-invalid={Boolean(issueOf("slug")) || undefined}
          spellCheck={false}
          className="font-mono text-[0.8125rem]"
        />
        <FieldDescription className={issueOf("slug") ? "text-destructive" : undefined}>
          {issueOf("slug") ?? (kind === "post" ? `/posts/分类/${draft.slug || slugHint || "…"}` : `/${draft.slug || "…"}`)}
        </FieldDescription>
        {!draft.slug && slugHint && (
          <button type="button" onClick={() => onChange("slug", slugHint)} className="w-fit cursor-pointer text-xs text-primary underline-offset-4 hover:underline">
            使用建议路径「{slugHint}」
          </button>
        )}
      </Field>

      {kind === "post" ? (
        <>
          <Field>
            <FieldLabel htmlFor="content-tags">标签</FieldLabel>
            <TagInput id="content-tags" value={post.tags} suggestions={tags.data ?? []} onChange={value => onChange("tags", value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="content-summary">摘要</FieldLabel>
            <Textarea id="content-summary" value={post.summary} onChange={event => onChange("summary", event.target.value)} placeholder="留空则在列表中使用 AI 摘要或正文开头" rows={4} className="resize-none" />
            <FieldDescription className="tabular-nums">{post.summary.length} 字</FieldDescription>
          </Field>
          <Field orientation="horizontal" className="items-center justify-between">
            <FieldLabel htmlFor="content-copyright" className="flex-col items-start gap-0.5">
              <span>版权声明</span>
              <span className="text-xs font-normal text-muted-foreground">文末显示署名与转载说明</span>
            </FieldLabel>
            <Switch id="content-copyright" checked={post.copyright} onCheckedChange={value => onChange("copyright", value)} />
          </Field>
        </>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor="content-subtitle">副标题</FieldLabel>
            <Input id="content-subtitle" value={page.subtitle} onChange={event => onChange("subtitle", event.target.value)} placeholder="可选" />
          </Field>
          <Field>
            <FieldLabel htmlFor="content-order">排序</FieldLabel>
            <Input id="content-order" type="number" inputMode="numeric" value={page.order} onChange={event => onChange("order", Number(event.target.value) || 0)} className="tabular-nums" />
            <FieldDescription>数字越小越靠前</FieldDescription>
          </Field>
        </>
      )}
    </FieldGroup>
  );
}
