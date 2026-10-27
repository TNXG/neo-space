import type { DashboardProfileUpdate, User } from "@/types/api";

const basicFields = ["name", "handle", "email", "url", "image", "introduce"] as const;
export type BasicProfileField = (typeof basicFields)[number];

/** 社交平台只维护后端真实消费的字段。 */
export const socialPlatforms = [
  { key: "github", label: "GitHub", placeholder: "用户名，例如 octocat", type: "text" },
  { key: "bilibili", label: "哔哩哔哩", placeholder: "数字 UID", type: "text" },
  { key: "netease", label: "网易云音乐", placeholder: "用户 ID", type: "text" },
  { key: "twitter", label: "Twitter / X", placeholder: "用户名，不含 @", type: "text" },
  { key: "telegram", label: "Telegram", placeholder: "用户名，不含 @", type: "text" },
  { key: "mail", label: "社交邮箱", placeholder: "name@example.com", type: "email" },
  { key: "rss", label: "RSS", placeholder: "https://example.com/feed", type: "url" },
] as const;

export type SocialProfileField = (typeof socialPlatforms)[number]["key"];

/** 简单资料草稿；未提交前不写回 Profile 缓存。 */
export interface ProfileDraft {
  basic: Record<BasicProfileField, string>;
  social: Record<SocialProfileField, string>;
  order: SocialProfileField[];
}

/** 为所有平台保留空值，序号只包含当前展示的行。 */
export function createProfileDraft(profile: User): ProfileDraft {
  const social = Object.fromEntries(socialPlatforms.map(({ key }) => [key, profile.socialIds?.[key] ?? ""])) as Record<SocialProfileField, string>;
  return {
    basic: {
      name: profile.name ?? "",
      handle: profile.username ?? "",
      email: profile.mail ?? "",
      url: profile.url ?? "",
      image: profile.avatar ?? "",
      introduce: profile.introduce ?? "",
    },
    social,
    order: socialPlatforms.filter(({ key }) => Boolean(social[key])).map(({ key }) => key),
  };
}

/** 只提交真正变化的字段；移除的平台显式清空，其他平台保持原值。 */
export function profileChanges(profile: User, draft: ProfileDraft): DashboardProfileUpdate {
  const original = createProfileDraft(profile);
  const changes: DashboardProfileUpdate = {};
  for (const key of basicFields) if (draft.basic[key] !== original.basic[key]) changes[key] = draft.basic[key];
  for (const { key } of socialPlatforms) {
    const value = draft.order.includes(key) ? draft.social[key] : "";
    if (value === original.social[key]) continue;
    changes.socialIds ??= { ...profile.socialIds };
    changes.socialIds[key] = value;
  }
  return changes;
}

/** 资料必填与链接格式在提交前就地校验。 */
export function profileIssues(draft: ProfileDraft): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (!draft.basic.name.trim()) issues.push({ path: "name", message: "请填写昵称。" });
  if (!draft.basic.handle.trim()) issues.push({ path: "handle", message: "请填写用户名。" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.basic.email)) issues.push({ path: "email", message: "请填写有效的邮箱地址。" });
  if (draft.basic.url && !/^https?:\/\//.test(draft.basic.url)) issues.push({ path: "url", message: "个人网站需要以 http:// 或 https:// 开头。" });
  if (draft.basic.image && !/^(https?:\/\/|\/)/.test(draft.basic.image)) issues.push({ path: "image", message: "头像需要是完整链接或以 / 开头的站内路径。" });
  for (const key of draft.order) {
    const platform = socialPlatforms.find(item => item.key === key)!;
    const value = draft.social[key].trim();
    if (platform.type === "url" && value && !/^https?:\/\//.test(value)) issues.push({ path: `social.${key}`, message: `${platform.label}需要以 http:// 或 https:// 开头。` });
    if (platform.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) issues.push({ path: `social.${key}`, message: `${platform.label}格式不正确。` });
  }
  return issues;
}
