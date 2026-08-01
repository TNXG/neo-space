import type { FormField, FormSection, UIComponent } from "~/components/config-form/types";

function field(
  key: string,
  title: string,
  component: UIComponent,
  description?: string,
  extra?: Partial<FormField["ui"]>,
): FormField {
  return { key, title, description, ui: { component, ...extra } };
}

function nested(
  key: string,
  title: string,
  fields: FormField[],
  description?: string,
): FormField {
  return {
    key,
    title,
    fields,
    subsection: { title, description },
    ui: { component: "input" },
  };
}

export const OPTION_FORM_SCHEMAS: Record<string, FormSection[]> = {
  bangumiOptions: [{
    key: "bangumiOptions",
    title: "Bangumi 收藏",
    description: "后端使用该用户名读取并聚合 Bangumi 的公开收藏",
    fields: [
      field("username", "Bangumi 用户名", "input", "保存后前台收藏页会从本站后端重新读取数据"),
    ],
  }],
  seo: [{
    key: "seo",
    title: "站点信息",
    description: "用于页面标题、订阅与搜索引擎展示",
    fields: [
      field("title", "站点名称", "input", "显示在浏览器标题和邮件通知中"),
      field("description", "站点描述", "textarea", "用于 SEO 与社交分享摘要"),
      field("keywords", "搜索关键词", "tags", "按回车添加关键词"),
    ],
  }],
  url: [{
    key: "url",
    title: "访问地址",
    fields: [
      field("webUrl", "前台地址", "input"),
      field("serverUrl", "后端服务地址", "input", "OAuth 回调与静态资源使用此地址"),
    ],
  }],
  mailOptions: [{
    key: "mailOptions",
    title: "邮件服务",
    fields: [
      field("enable", "启用邮件", "switch"),
      field("from", "发件人地址", "input"),
      nested("smtp", "SMTP", [
        field("host", "服务器", "input"),
        field("port", "端口", "number"),
        field("user", "用户名", "input"),
        field("pass", "密码", "password"),
        field("secure", "使用 TLS", "switch"),
      ]),
    ],
  }],
  commentOptions: [{
    key: "commentOptions",
    title: "评论策略",
    fields: [
      field("disableComment", "关闭评论", "switch"),
      field("commentShouldAudit", "评论需要审核", "switch"),
      field("antiSpam", "启用反垃圾", "switch"),
      field("disableNoChinese", "允许无中文评论", "switch"),
      field("spamKeywords", "垃圾关键词", "tags"),
      field("blockIps", "封禁 IP", "tags"),
      field("recordIpLocation", "记录 IP 地区", "switch"),
      field("aiReview", "启用 AI 审核", "switch", "审核服务商与具体模型在 AI 设置的「评论 AI 审核」中指定"),
      field("aiReviewType", "AI 审核模式", "select", undefined, {
        options: [{ label: "评分", value: "score" }, { label: "二元判断", value: "binary" }],
      }),
      field("aiReviewThreshold", "垃圾评分阈值", "number"),
      field("turnstileSecret", "Turnstile Secret", "password", "由后端验证评论请求，不会公开给前台"),
    ],
  }],
  friendLinkOptions: [{
    key: "friendLinkOptions",
    title: "友链策略",
    fields: [
      field("allowApply", "允许申请友链", "switch"),
      field("allowSubPath", "允许子路径", "switch"),
      field("healthCheckIntervalHours", "检测间隔（小时）", "number"),
      field("healthCheckTimeoutSeconds", "请求超时（秒）", "number"),
    ],
  }],
  searchOptions: [{
    key: "searchOptions",
    title: "全文搜索",
    description: "Meilisearch 连接配置",
    fields: [
      field("endpoint", "服务地址", "input"),
      field("apiKey", "API Key", "password"),
    ],
  }],
  securityOptions: [{
    key: "securityOptions",
    title: "运行时安全",
    description: "JWT Secret 仍只允许通过后端环境变量配置",
    fields: [
      field(
        "ownerDesktopToken",
        "桌面客户端令牌",
        "password",
        "用于 Owner 桌面客户端 WebSocket 鉴权，保存后立即生效",
      ),
    ],
  }],
};
