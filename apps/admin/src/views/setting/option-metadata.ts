import type { OptionValue, SystemOptions } from "~/api/options";

export interface OptionMetadata {
  title: string;
  description: string;
  icon: string;
}

const OPTION_METADATA: Record<string, OptionMetadata> = {
  seo: { title: "站点信息", description: "标题、描述与搜索关键词", icon: "globe" },
  bangumiOptions: { title: "Bangumi", description: "公开收藏账号与聚合配置", icon: "database" },
  url: { title: "站点地址", description: "前台、后台与服务端 URL", icon: "link" },
  mailOptions: { title: "邮件", description: "邮件服务与发信配置", icon: "mail" },
  commentOptions: { title: "评论", description: "评论审核与交互策略", icon: "message-square" },
  ai: { title: "AI", description: "模型提供商与内容生成配置", icon: "sparkles" },
  oauth: { title: "登录与安全", description: "Passkey 与第三方登录配置", icon: "shield" },
  friendLinkOptions: { title: "友链", description: "友链申请与校验策略", icon: "link" },
  searchOptions: { title: "全文搜索", description: "Meilisearch 服务配置", icon: "search" },
  securityOptions: { title: "运行时安全", description: "桌面客户端等运行时鉴权配置", icon: "shield" },
};

const DISPLAY_ORDER = [
  "seo",
  "bangumiOptions",
  "url",
  "mailOptions",
  "commentOptions",
  "friendLinkOptions",
  "searchOptions",
  "securityOptions",
  "oauth",
  "ai",
];

/** 将 options 集合的原始键转换为设置面板的展示信息，不改变持久化键。 */
export function getOptionMetadata(key: string): OptionMetadata {
  const metadata = OPTION_METADATA[key] ?? {
    title: key,
    description: "数据库中的原始配置文档",
    icon: "file-text",
  };
  return metadata;
}

/** 保证编辑器只能提交可由 JSON 表示的 options value。 */
export function isOptionValue(value: unknown): value is OptionValue {
  if (
    value === null
    || typeof value === "boolean"
    || typeof value === "number"
    || typeof value === "string"
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isOptionValue);
  }
  return typeof value === "object" && Object.values(value).every(isOptionValue);
}

export function optionEntries(options: SystemOptions | null): Array<[string, OptionValue]> {
  if (!options) {
    return [];
  }
  return DISPLAY_ORDER
    .filter(key => Object.hasOwn(options, key))
    .map(key => [key, options[key]]);
}
