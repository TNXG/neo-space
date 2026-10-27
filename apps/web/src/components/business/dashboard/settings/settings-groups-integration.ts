import type { SettingGroup } from "./settings-schema";

/** 邮件、第三方登录、AI、搜索、追番与桌面令牌；不声明后端未使用的开关。 */
export const integrationGroups: readonly SettingGroup[] = [
  {
    key: "mailOptions",
    slug: "mail",
    title: "邮件服务",
    icon: "mingcute:mail-line",
    help: "验证码、评论通知与博主手动邮件共用此配置；博主通知收件邮箱来自资料设置。",
    sections: [
      {
        title: "发信设置",
        icon: "mingcute:mail-line",
        fields: [
          { path: "enable", label: "启用邮件服务", control: "switch", hint: "通过 SMTP 发送验证码与通知。" },
          {
            path: "from",
            label: "发件邮箱",
            control: "email",
            placeholder: "noreply@example.com",
            hint: "留空时使用 SMTP 用户名。",
            help: "必须使用 SMTP 服务允许的发件地址。",
          },
          { path: "fromName", label: "发件人名称", control: "text", hint: "收件人看到的显示名称。" },
        ],
      },
      {
        title: "SMTP 配置",
        icon: "mingcute:settings-3-line",
        fields: [
          { path: "smtp.host", label: "服务器", control: "text", placeholder: "smtp.example.com", hint: "只填主机名，不含协议或端口。" },
          {
            path: "smtp.port",
            label: "端口",
            control: "number",
            min: 1,
            max: 65535,
            step: 1,
            hint: "常用 465 或 587。",
            help: "465 使用直连 TLS；587 使用 STARTTLS；25 在未启用直连 TLS 时不加密。",
          },
          {
            path: "smtp.secure",
            label: "直连 TLS",
            control: "switch",
            hint: "为非标准端口启用直连 TLS。",
            help: "仅影响 465、587 以外端口的验证码与手动邮件，不控制评论通知的加密方式。",
          },
          { path: "smtp.user", label: "用户名", control: "text" },
          {
            path: "smtp.pass",
            label: "密码或授权码",
            control: "password",
            hint: "仅用于后端 SMTP 认证。",
            help: "清空并保存会删除数据库中的此凭据。",
          },
        ],
      },
      {
        title: "邮件品牌",
        icon: "mingcute:edit-3-line",
        fields: [
          { path: "templates.brand.logoText", label: "标志文字", control: "text", hint: "邮件页眉中的纯文字标志。" },
          { path: "templates.brand.footerText", label: "页脚文字", control: "text", hint: "纯文字显示，不解析 HTML。" },
        ],
      },
      {
        title: "邮箱验证模板",
        icon: "mingcute:shield-shape-line",
        help: "分类与正文标题为固定文案；主题和引导语支持 {{site_name}}。验证码与有效期由后端生成。",
        fields: [
          { path: "templates.verification.category", label: "邮件分类", control: "text" },
          { path: "templates.verification.subject", label: "邮件主题", control: "text" },
          { path: "templates.verification.title", label: "正文标题", control: "text" },
          { path: "templates.verification.intro", label: "验证引导语", control: "textarea" },
        ],
      },
      {
        title: "评论通知模板",
        icon: "mingcute:comment-line",
        help: "支持 {{site_name}}、{{author}}、{{ref_type}}、{{comment_type}}；跳转链接由站点地址自动生成。",
        fields: [
          { path: "templates.comment.category", label: "邮件分类", control: "text" },
          { path: "templates.comment.subject", label: "新评论主题", control: "text" },
          { path: "templates.comment.title", label: "新评论正文标题", control: "text" },
          { path: "templates.comment.intro", label: "新评论引导语", control: "textarea" },
          { path: "templates.comment.replySubject", label: "回复主题", control: "text" },
          { path: "templates.comment.replyTitle", label: "回复正文标题", control: "text" },
          { path: "templates.comment.replyIntro", label: "回复引导语", control: "textarea" },
        ],
      },
      {
        title: "博主来信模板",
        icon: "mingcute:send-plane-line",
        fields: [{ path: "templates.owner.category", label: "邮件分类", control: "text" }],
      },
    ],
  },
  {
    key: "oauth",
    slug: "oauth",
    title: "第三方登录",
    icon: "mingcute:key-2-line",
    help: "当前只支持 GitHub 与 QQ；QQ 通过既定中转服务登录，无需本地凭据。",
    sections: [
      {
        title: "登录提供商",
        icon: "mingcute:user-3-line",
        help: "此列表与启用标记会通过公开站点配置返回，但不作为登录访问控制。",
        fields: [
          {
            path: "providers",
            label: "提供商",
            control: "collection",
            itemLabel: "提供商",
            uniqueBy: "type",
            defaults: { type: "github", enabled: false },
            hint: "每种提供商只保留一项。",
            fields: [
              {
                path: "type",
                label: "类型",
                control: "choice",
                required: true,
                options: [
                  { value: "github", label: "GitHub" },
                  { value: "qq", label: "QQ" },
                ],
              },
              { path: "enabled", label: "公开启用标记", control: "switch", hint: "仅对外展示当前启用状态。" },
            ],
          },
        ],
      },
      {
        title: "GitHub 登录",
        icon: "mingcute:github-line",
        help: "在 GitHub OAuth App 中把回调设置为「服务端地址 + /api/auth/oauth/github/callback」，服务端地址取自地址设置。",
        fields: [
          {
            path: "public.github.clientId",
            label: "Client ID",
            control: "text",
            env: "GITHUB_CLIENT_ID",
            hint: "公开客户端标识，会包含在公共配置中。",
          },
          {
            path: "secrets.github.clientSecret",
            label: "Client Secret",
            control: "password",
            env: "GITHUB_CLIENT_SECRET",
            hint: "仅供后端交换令牌。",
            help: "不会包含在公共配置中。清空并保存可删除数据库中的密钥。",
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
    help: "管理 OpenAI 兼容服务商，以及文章时效性分析、内容翻译和评论 AI 审核的模型分配。",
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
            hint: "展开条目编辑连接信息。",
            help: "移除服务商前，请先调整引用它的模型分配。",
            fields: [
              {
                path: "id",
                label: "技术标识",
                control: "text",
                required: true,
                hint: "模型分配引用的唯一 ID，不是数据库主键。",
              },
              {
                path: "type",
                label: "服务类型",
                control: "choice",
                required: true,
                options: [
                  { value: "openai", label: "OpenAI" },
                  { value: "openai-compatible", label: "OpenAI 兼容接口" },
                ],
              },
              { path: "name", label: "显示名称", control: "text", hint: "仅用于管理界面。" },
              {
                path: "apiKey",
                label: "API 密钥",
                control: "password",
                hint: "后端以 Bearer 令牌发送。",
                help: "密钥不应出现在公开配置中；清空并保存可删除数据库中的密钥。",
              },
              {
                path: "endpoint",
                label: "接口地址",
                control: "url",
                required: true,
                placeholder: "https://api.example.com/v1",
                hint: "包含 /v1 的完整基础地址。",
                help: "后端会直接追加 /chat/completions，不会补默认地址。",
              },
              { path: "defaultModel", label: "默认模型", control: "text", hint: "用途未指定模型时回退到此值。" },
              { path: "enabled", label: "启用", control: "switch", hint: "禁用后不会执行 AI 请求。" },
            ],
          },
        ],
      },
      {
        title: "功能开关",
        icon: "mingcute:toggle-right-line",
        fields: [
          { path: "enableSummary", label: "启用时间胶囊分析", control: "switch", hint: "分析文章内容是否可能随时间过时。", help: "读取现有 enableSummary 开关；本功能不是文章摘要生成。" },
          { path: "enableTranslation", label: "启用内容翻译", control: "switch", hint: "允许后台生成内容翻译。", help: "此开关不会自动生成翻译。" },
        ],
      },
      {
        title: "模型分配",
        icon: "mingcute:link-line",
        help: "各功能从服务商列表获取接口地址和密钥。时间胶囊分析沿用 summaryModel 配置；时间胶囊和翻译未指定服务商时使用第一个已启用的服务商，评论审核必须明确选择。",
        fields: [
          {
            path: "summaryModel.providerId",
            label: "时间胶囊服务商",
            control: "choice",
            optionsFromProviders: true,
            hint: "用于文章时效性分析，不是摘要生成。",
            disabledWhen: [{ path: "enableSummary", equals: false, hint: "需要先启用时间胶囊分析。" }],
          },
          { path: "summaryModel.model", label: "时间胶囊模型", control: "text", hint: "分析文章中的版本、日期和过时风险；留空使用服务商默认模型。", disabledWhen: [{ path: "enableSummary", equals: false, hint: "需要先启用时间胶囊分析。" }] },
          {
            path: "translationModel.providerId",
            label: "内容翻译服务商",
            control: "choice",
            optionsFromProviders: true,
            disabledWhen: [{ path: "enableTranslation", equals: false, hint: "需要先启用翻译。" }],
          },
          { path: "translationModel.model", label: "内容翻译模型", control: "text", hint: "用于后台翻译生成；留空使用服务商默认模型。", disabledWhen: [{ path: "enableTranslation", equals: false, hint: "需要先启用翻译。" }] },
          { path: "commentReviewModel.providerId", label: "评论 AI 审核服务商", control: "choice", optionsFromProviders: true, hint: "用于评论反垃圾的直接判断或评分；需在评论设置中同时启用反垃圾和 AI 审核。" },
          { path: "commentReviewModel.model", label: "评论 AI 审核模型", control: "text", hint: "用于垃圾评论判定与评分；留空使用服务商默认模型。" },
        ],
      },
    ],
  },
  {
    key: "searchOptions",
    slug: "search",
    title: "搜索服务",
    icon: "mingcute:search-2-line",
    help: "后端访问 Meilisearch 的地址与凭证，供搜索和索引管理使用。",
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
            hint: "后端可访问的基础地址。",
            help: "空值会回退到运行时地址；显式环境变量优先于数据库并回写。",
          },
          {
            path: "apiKey",
            label: "API 密钥",
            control: "password",
            env: "MEILISEARCH_API_KEY",
            hint: "用于后端搜索与索引管理。",
            help: "不是前端公开搜索密钥；清空并保存可删除数据库中的密钥。",
          },
        ],
      },
    ],
  },
  {
    key: "bangumiOptions",
    slug: "bangumi",
    title: "追番服务",
    icon: "mingcute:play-circle-line",
    help: "读取指定 Bangumi 用户的公开收藏；当前后端不消费访问令牌。",
    sections: [
      {
        title: "Bangumi",
        icon: "mingcute:play-circle-line",
        fields: [
          {
            path: "username",
            label: "用户名",
            control: "text",
            hint: "用于公开收藏请求，不是昵称。",
            help: "留空后收藏接口返回未配置。",
          },
        ],
      },
    ],
  },
  {
    key: "securityOptions",
    slug: "security",
    title: "安全设置",
    icon: "mingcute:lock-line",
    help: "管理后端实际使用的 Owner 桌面客户端令牌，不涉及账号密码或 JWT 配置。",
    sections: [
      {
        title: "桌面客户端",
        icon: "mingcute:key-2-line",
        fields: [
          {
            path: "ownerDesktopToken",
            label: "Owner 桌面令牌",
            control: "password",
            env: "OWNER_DESKTOP_TOKEN",
            hint: "桌面客户端 WebSocket 必须提供一致令牌。",
            help: "留空时服务器拒绝连接；更换后需同步更新客户端，并修改部署环境才能持久变更。",
          },
        ],
      },
    ],
  },
];
