import type { Category, DashboardPageInput, DashboardPostInput, Page, Post } from "@/types/api";

export type ContentKind = "post" | "page";

export type PostDraft = DashboardPostInput;
export type PageDraft = DashboardPageInput;
export type ContentDraft = PostDraft | PageDraft;

export interface ContentIssue {
  field: string;
  message: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 新文章默认使用第一个分类，作者不必每次都先选分类才能保存草稿。 */
export const emptyPost = (categories: Category[] | undefined): PostDraft => ({
  title: "",
  text: "",
  categoryId: categories?.[0]?._id ?? "",
  slug: "",
  tags: [],
  summary: "",
  copyright: true,
  isPublished: false,
});

export const emptyPage = (): PageDraft => ({ title: "", text: "", slug: "", subtitle: "", order: 0 });

/**
 * 把后端文章转换为可编辑草稿，缺省字段补齐为空值，便于逐字段比较。
 * @param post 后端文章
 * @returns 草稿
 */
export const postToDraft = (post: Post): PostDraft => ({
  title: post.title,
  text: post.text,
  categoryId: post.categoryId,
  slug: post.slug,
  tags: post.tags ?? [],
  summary: post.summary ?? "",
  copyright: post.copyright,
  isPublished: post.isPublished,
  meta: post.meta ?? {},
});

export const pageToDraft = (page: Page): PageDraft => ({
  title: page.title,
  text: page.text,
  slug: page.slug,
  subtitle: page.subtitle ?? "",
  order: page.order ?? 0,
  meta: page.meta ?? {},
});

/**
 * 按 JSON 数据结构比较值，忽略对象键顺序，保留数组顺序与正文空白差异。
 * @param left 已保存字段
 * @param right 当前字段
 * @returns 两个字段是否相等
 */
const equalValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => equalValue(value, right[index]));
  }
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.hasOwn(b, key) && equalValue(a[key], b[key]));
};

/**
 * 判断草稿是否真的不同；所有状态、恢复提示及提交使用同一比较规则。
 * @param base 已保存版本
 * @param draft 当前版本
 * @returns 是否有实际修改
 */
export const hasContentChanges = (base: ContentDraft, draft: ContentDraft): boolean => !equalValue(base, draft);

/**
 * 只提交变化的字段，避免覆盖其他端（如 AI 摘要任务）同时写入的值。
 * @param base 已保存版本
 * @param draft 当前草稿
 * @returns 变化字段
 */
export const changedFields = <T extends ContentDraft>(base: T, draft: T): Partial<T> => {
  const changed: Partial<T> = {};
  for (const key of Object.keys(draft) as (keyof T)[]) {
    if (!equalValue(base[key], draft[key])) changed[key] = draft[key];
  }
  return changed;
};

/**
 * 保存前校验；返回的问题按界面自上而下的顺序排列，便于定位第一个。
 * @param kind 内容类型
 * @param draft 草稿
 * @returns 问题列表
 */
export const validateDraft = (kind: ContentKind, draft: ContentDraft): ContentIssue[] => {
  const issues: ContentIssue[] = [];
  if (!draft.title.trim()) issues.push({ field: "title", message: "请填写标题" });
  if (kind === "post" && !(draft as PostDraft).categoryId) issues.push({ field: "categoryId", message: "请选择分类" });
  const slug = draft.slug.trim();
  if (kind === "page" && !slug) issues.push({ field: "slug", message: "独立页面需要填写路径" });
  if (slug && !SLUG_PATTERN.test(slug)) issues.push({ field: "slug", message: "路径只能包含小写字母、数字和连字符" });
  return issues;
};

/**
 * 依据英文标题给出路径建议；中文标题不做拼音转换，留给作者自行决定。
 * @param title 标题
 * @returns 建议路径，无法生成时为空
 */
export const suggestSlug = (title: string) => title
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^\w\s-]/g, "")
  .trim()
  .replace(/[\s_]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");

/** 粗略字数：中日韩字符按字计，其余按词计，与阅读时长估算一致。 */
export const countWords = (text: string) => {
  const plain = text.replace(/```[\s\S]*?```/g, "").replace(/[#>*_`~[\]()!|=-]/g, " ");
  const cjk = plain.match(/[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF]/g)?.length ?? 0;
  const words = plain.replace(/[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF]/g, " ").split(/\s+/).filter(Boolean).length;
  return cjk + words;
};
