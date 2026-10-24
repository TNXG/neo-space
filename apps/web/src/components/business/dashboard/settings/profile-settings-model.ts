import type { DashboardProfileUpdate, User } from "@/types/api";

const basicFields = ["name", "handle", "image", "email", "introduce", "url"] as const;
export type BasicProfileField = (typeof basicFields)[number];

export const socialFields = [
  { key: "github", label: "GitHub", description: "填写用户名，不是完整链接，例如 octocat。", type: "text" },
  { key: "bilibili", label: "哔哩哔哩", description: "填写个人空间的数字 UID，不是昵称或完整链接。", type: "text" },
  { key: "netease", label: "网易云音乐", description: "填写个人主页中的用户 ID，不是昵称或完整链接。", type: "text" },
  { key: "twitter", label: "Twitter / X", description: "填写用户名，不含 @，不是完整链接。", type: "text" },
  { key: "telegram", label: "Telegram", description: "填写用户名，不含 @ 或 t.me/ 前缀。", type: "text" },
  { key: "mail", label: "社交邮箱", description: "保留的社交邮箱字段。主页邮件入口实际使用上方基本资料邮箱。", type: "email" },
  { key: "rss", label: "RSS", description: "填写完整订阅链接，包含 https:// 或 http://。", type: "url" },
] as const;

export type SocialProfileField = (typeof socialFields)[number]["key"];
export interface ProfileDraft {
  basic: Record<BasicProfileField, string>;
  social: Record<SocialProfileField, string>;
  socialKeys: SocialProfileField[];
}

/** 只为已填写的平台建立条目；保留 API 原对象供完整替换时使用。 */
export function createProfileDraft(profile: User): ProfileDraft {
  return {
    basic: {
      name: profile.name ?? "",
      handle: profile.username ?? "",
      image: profile.avatar ?? "",
      email: profile.mail ?? "",
      introduce: profile.introduce ?? "",
      url: profile.url ?? "",
    },
    social: {
      github: profile.socialIds?.github ?? "",
      bilibili: profile.socialIds?.bilibili ?? "",
      netease: profile.socialIds?.netease ?? "",
      twitter: profile.socialIds?.twitter ?? "",
      telegram: profile.socialIds?.telegram ?? "",
      mail: profile.socialIds?.mail ?? "",
      rss: profile.socialIds?.rss ?? "",
    },
    socialKeys: socialFields.filter(({ key }) => Boolean(profile.socialIds?.[key])).map(({ key }) => key),
  };
}

/** Replace social IDs only when values change, clearing removed rows and retaining untouched keys/nulls. */
export function profileChanges(profile: User, draft: ProfileDraft): DashboardProfileUpdate {
  const original = createProfileDraft(profile);
  const changes: DashboardProfileUpdate = {};
  for (const key of basicFields) {
    if (draft.basic[key] !== original.basic[key]) changes[key] = draft.basic[key];
  }
  for (const { key } of socialFields) {
    const value = draft.socialKeys.includes(key) ? draft.social[key] : "";
    if (value === original.social[key]) continue;
    changes.socialIds ??= { ...profile.socialIds };
    changes.socialIds[key] = value;
  }
  return changes;
}

/** Return a useful API failure message without assuming a particular thrown value. */
export function profileError(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "请检查连接后重试。";
}
