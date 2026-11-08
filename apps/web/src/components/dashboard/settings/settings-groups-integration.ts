import type { SettingGroup } from "./settings-schema";

/** 邮件、第三方登录、AI、搜索、追番与桌面令牌；不声明后端未使用的开关。 */
export const integrationGroups: readonly SettingGroup[] = [
  {
    key: "mailOptions",
    slug: "mail",
    title: "邮件服务",
    icon: "mingcute:mail-line",
    help: "用于发送评论回复通知、邮箱验证码与友链来信。站长接收通知的邮箱可在「个人资料」中设置。",
    sections: [
      {
        title: "发件人信息",
        icon: "mingcute:mail-line",
        fields: [
          { path: "enable", label: "启用邮件发送", control: "switch", hint: "开启后通过下方 SMTP 服务器发送各类通知邮件。" },
          {
            path: "from",
            label: "发件邮箱",
            control: "email",
            placeholder: "noreply@example.com",
            hint: "留空时默认使用下方 SMTP 登录账号。",
          },
          { path: "fromName", label: "发件人名称", control: "text", hint: "收件人看到的显示名称，例如网站名称。" },
        ],
      },
      {
        title: "SMTP 服务器",
        icon: "mingcute:settings-3-line",
        fields: [
          { path: "smtp.host", label: "服务器地址", control: "text", placeholder: "smtp.example.com", hint: "填写邮箱服务商提供的 SMTP 主机名。" },
          {
            path: "smtp.port",
            label: "端口",
            control: "number",
            min: 1,
            max: 65535,
            step: 1,
            hint: "常用加密端口为 465（SSL）或 587（STARTTLS）。",
          },
          {
            path: "smtp.secure",
            label: "强制 SSL 加密",
            control: "switch",
            hint: "465 端口会自动加密；仅在其他特殊加密端口时开启。",
          },
          { path: "smtp.user", label: "登录账号", control: "text" },
          {
            path: "smtp.pass",
            label: "密码或授权码",
            control: "password",
            hint: "填写邮箱服务商提供的客户端专用密码或授权码。",
          },
        ],
      },
      {
        title: "邮件外观",
        icon: "mingcute:edit-3-line",
        fields: [
          { path: "templates.brand.logoText", label: "顶部标志文字", control: "text", hint: "显示在邮件页眉的网站名称或短标题。" },
          { path: "templates.brand.footerText", label: "底部说明文字", control: "text", hint: "显示在邮件页脚的说明信息。" },
        ],
      },
      {
        title: "验证码邮件模板",
        icon: "mingcute:shield-shape-line",
        help: "主题与引导语中可使用 {{site_name}} 代表网站名称。",
        fields: [
          { path: "templates.verification.category", label: "类型标签", control: "text" },
          { path: "templates.verification.subject", label: "邮件主题", control: "text" },
          { path: "templates.verification.title", label: "正文标题", control: "text" },
          { path: "templates.verification.intro", label: "正文引导语", control: "textarea" },
        ],
      },
      {
        title: "评论通知邮件模板",
        icon: "mingcute:comment-line",
        help: "可使用 {{site_name}}（网站名称）、{{author}}（评论者）等变量。",
        fields: [
          { path: "templates.comment.category", label: "类型标签", control: "text" },
          { path: "templates.comment.subject", label: "新评论邮件主题", control: "text" },
          { path: "templates.comment.title", label: "新评论正文标题", control: "text" },
          { path: "templates.comment.intro", label: "新评论正文引导语", control: "textarea" },
          { path: "templates.comment.replySubject", label: "收到回复邮件主题", control: "text" },
          { path: "templates.comment.replyTitle", label: "收到回复正文标题", control: "text" },
          { path: "templates.comment.replyIntro", label: "收到回复正文引导语", control: "textarea" },
        ],
      },
      {
        title: "站长来信模板",
        icon: "mingcute:send-plane-line",
        fields: [{ path: "templates.owner.category", label: "类型标签", control: "text" }],
      },
    ],
  },
  {
    key: "oauth",
    slug: "oauth",
    title: "第三方登录",
    icon: "mingcute:key-2-line",
    help: "让访客在评论区可以使用 GitHub 或 QQ 账号快捷登录。",
    sections: [
      {
        title: "登录方式",
        icon: "mingcute:user-3-line",
        fields: [
          {
            path: "providers",
            label: "登录方式",
            control: "collection",
            itemLabel: "登录方式",
            uniqueBy: "type",
            defaults: { type: "github", enabled: false },
            fields: [
              {
                path: "type",
                label: "平台",
                control: "choice",
                required: true,
                options: [
                  { value: "github", label: "GitHub" },
                  { value: "qq", label: "QQ" },
                ],
              },
              { path: "enabled", label: "在评论区显示", control: "switch" },
            ],
          },
        ],
      },
      {
        title: "GitHub 登录",
        icon: "mingcute:github-line",
        fields: [
          {
            path: "public.github.clientId",
            label: "Client ID",
            control: "text",
            env: "GITHUB_CLIENT_ID",
            hint: "在 GitHub OAuth App 页面获取的 Client ID。",
          },
          {
            path: "secrets.github.clientSecret",
            label: "Client Secret",
            control: "password",
            env: "GITHUB_CLIENT_SECRET",
            hint: "在 GitHub OAuth App 页面生成的 Client Secret；清空后保存即可移除。",
          },
        ],
      },
    ],
  },
  {
    key: "ai",
    slug: "ai",
    title: "AI 服务",
    icon: "mingcute:sparkles-line",
    help: "添加大模型服务商，为文章时效提醒、内容翻译与评论审核提供支持。",
    sections: [
      {
        title: "服务商",
        icon: "mingcute:link-line",
        fields: [
          {
            path: "providers",
            label: "AI 服务商",
            control: "collection",
            itemLabel: "服务商",
            uniqueBy: "id",
            defaults: { id: "", name: "", type: "openai-compatible", apiKey: "", endpoint: "", defaultModel: "", enabled: false },
            fields: [
              {
                path: "id",
                label: "服务商标识",
                control: "text",
                required: true,
              },
              { path: "name", label: "显示名称", control: "text" },
              {
                path: "type", label: "接口类型", control: "choice",
                options: [{ value: "openai-compatible", label: "OpenAI 兼容" }, { value: "openai", label: "OpenAI" }, { value: "jev", label: "Jev 反垃圾" }],
              },
              {
                path: "apiKey",
                label: "API 密钥",
                control: "password",
              },
              {
                path: "endpoint",
                label: "接口地址",
                control: "url",
                required: true,
                placeholder: "https://api.example.com/v1",
              },
              { path: "defaultModel", label: "默认模型", control: "text" },
              { path: "enabled", label: "启用", control: "switch" },
            ],
          },
        ],
      },
      {
        title: "功能开关",
        icon: "mingcute:toggle-right-line",
        fields: [
          { path: "enableSummary", label: "启用文章时效提醒", control: "switch" },
          { path: "enableTranslation", label: "启用内容翻译", control: "switch" },
        ],
      },
      {
        title: "模型分配",
        icon: "mingcute:link-line",
        fields: [
          {
            path: "summaryModel.providerId",
            label: "文章时效提醒服务商",
            control: "choice",
            optionsFromProviders: true,
            disabledWhen: [{ path: "enableSummary", equals: false, hint: "请先开启「文章时效提醒」。" }],
          },
          { path: "summaryModel.model", label: "文章时效提醒模型", control: "text", disabledWhen: [{ path: "enableSummary", equals: false, hint: "请先开启「文章时效提醒」。" }] },
          {
            path: "translationModel.providerId",
            label: "内容翻译服务商",
            control: "choice",
            optionsFromProviders: true,
            disabledWhen: [{ path: "enableTranslation", equals: false, hint: "请先开启「内容翻译」。" }],
          },
          { path: "translationModel.model", label: "内容翻译模型", control: "text", disabledWhen: [{ path: "enableTranslation", equals: false, hint: "请先开启「内容翻译」。" }] },
          { path: "commentReviewModel.providerId", label: "评论 AI 审核服务商", control: "choice", optionsFromProviders: true },
          { path: "commentReviewModel.model", label: "评论 AI 审核模型", control: "text" },
        ],
      },
    ],
  },
  {
    key: "searchOptions",
    slug: "search",
    title: "站内搜索",
    icon: "mingcute:search-2-line",
    help: "连接 Meilisearch 搜索服务，为访客提供文章检索。",
    sections: [
      {
        title: "Meilisearch",
        icon: "mingcute:search-2-line",
        fields: [
          {
            path: "endpoint",
            label: "服务地址",
            control: "url",
            env: "MEILISEARCH_URL / MEILISEARCH_HOST",
            placeholder: "http://127.0.0.1:7700",
            hint: "Meilisearch 服务的访问地址。",
          },
          {
            path: "apiKey",
            label: "管理密钥",
            control: "password",
            env: "MEILISEARCH_API_KEY",
            hint: "用于同步文章索引与执行搜索；清空后保存即可移除。",
          },
        ],
      },
    ],
  },
  {
    key: "bangumiOptions",
    slug: "bangumi",
    title: "追番展示",
    icon: "mingcute:play-circle-line",
    help: "在网站追番页面展示你的 Bangumi 公开追番进度。",
    sections: [
      {
        title: "Bangumi",
        icon: "mingcute:play-circle-line",
        fields: [
          {
            path: "username",
            label: "Bangumi 用户名",
            control: "text",
            placeholder: "例如 sai",
            hint: "填写你 Bangumi 个人主页地址中的用户名或数字 ID。",
          },
        ],
      },
    ],
  },
  {
    key: "securityOptions",
    slug: "security",
    title: "桌面客户端",
    icon: "mingcute:lock-line",
    help: "管理桌面客户端连接本站时使用的访问密钥。",
    sections: [
      {
        title: "连接授权",
        icon: "mingcute:key-2-line",
        fields: [
          {
            path: "ownerDesktopToken",
            label: "连接密钥",
            control: "password",
            env: "OWNER_DESKTOP_TOKEN",
            hint: "在桌面客户端中填写相同的密钥即可连接；留空则关闭桌面端连接。",
          },
        ],
      },
    ],
  },
];
