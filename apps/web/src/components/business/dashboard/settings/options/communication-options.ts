import type { OptionGroup } from "./option-schema";

/** 邮件与第三方登录配置；字段路径以当前后端消费者为准。 */
export const communicationOptionGroups: readonly OptionGroup[] = [
  {
    key: "mailOptions",
    slug: "mail",
    title: "邮件服务",
    icon: "mingcute:mail-line",
    description: "配置 SMTP 发信与品牌邮件文案。未填写的模板字段由后端使用默认文案，不支持 Resend 或自定义 HTML 模板。",
    sections: [
      {
        title: "发信设置",
        icon: "mingcute:mail-line",
        description: "验证码、评论通知与博主手动邮件共用此配置；博主通知收件邮箱来自博主资料，不在此设置。",
        fields: [
          { path: "enable", label: "启用邮件服务", type: "boolean" },
          { path: "from", label: "发件邮箱", type: "email", description: "字段未设置时使用 SMTP 用户名；需使用 SMTP 服务允许的发件地址。" },
          { path: "fromName", label: "发件人名称", type: "text", description: "收件人可见的发件人显示名称。" },
        ],
      },
      {
        title: "SMTP 配置",
        icon: "mingcute:settings-3-line",
        description: "评论通知当前始终使用 STARTTLS；验证码与手动邮件按端口及直连 TLS 设置选择加密方式。",
        fields: [
          { path: "smtp.host", label: "SMTP 服务器", type: "text", description: "填写主机名，不包含协议或端口。" },
          { path: "smtp.port", label: "SMTP 端口", type: "number", min: 1, max: 65535, step: 1, description: "465 使用直连 TLS，587 使用 STARTTLS；25 在未启用直连 TLS 时不加密，其他端口按直连 TLS 开关选择 TLS 或 STARTTLS。" },
          { path: "smtp.secure", label: "直连 TLS", type: "boolean", description: "仅影响 465、587 以外端口的验证码与手动邮件；不控制评论通知的加密方式。" },
          { path: "smtp.user", label: "SMTP 用户名", type: "text" },
          { path: "smtp.pass", label: "SMTP 密码或授权码", type: "password", description: "仅用于后端 SMTP 认证。" },
        ],
      },
      {
        title: "邮件品牌",
        icon: "mingcute:edit-3-line",
        description: "用于三类邮件的 HTML 外观。站点名称取自站点标题，页脚年份自动生成；纯文本降级邮件不使用这些品牌字段。空白模板文案回退后端默认值。",
        fields: [
          { path: "templates.brand.logoText", label: "标志文字", type: "text", description: "邮件页眉中的文字标志，不是图片地址。" },
          { path: "templates.brand.footerText", label: "页脚文字", type: "text", description: "以纯文字显示，不解析 HTML，也不生成自定义页脚链接。" },
        ],
      },
      {
        title: "邮箱验证模板",
        icon: "mingcute:shield-shape-line",
        description: "分类与正文标题为固定文案；邮件主题和引导语支持 {{site_name}}。验证码与十分钟有效期由后端生成，不能通过模板更改。",
        fields: [
          { path: "templates.verification.category", label: "邮件分类", type: "text" },
          { path: "templates.verification.subject", label: "邮件主题", type: "text" },
          { path: "templates.verification.title", label: "正文标题", type: "text" },
          { path: "templates.verification.intro", label: "验证引导语", type: "textarea", description: "HTML 邮件中的纯文字引导语，不解析 HTML。" },
        ],
      },
      {
        title: "评论通知模板",
        icon: "mingcute:comment-line",
        description: "主题、正文标题与引导语支持 {{site_name}}、{{author}}、{{ref_type}}、{{comment_type}}。博主收到常规通知，被回复者使用回复文案；跳转链接由站点网址与内容自动生成。",
        fields: [
          { path: "templates.comment.category", label: "邮件分类", type: "text", description: "固定显示文案，不替换模板变量。" },
          { path: "templates.comment.subject", label: "新评论邮件主题", type: "text" },
          { path: "templates.comment.title", label: "新评论正文标题", type: "text" },
          { path: "templates.comment.intro", label: "新评论引导语", type: "textarea", description: "仅影响 HTML 邮件，纯文本引导语由后端生成。" },
          { path: "templates.comment.replySubject", label: "回复邮件主题", type: "text" },
          { path: "templates.comment.replyTitle", label: "回复正文标题", type: "text" },
          { path: "templates.comment.replyIntro", label: "回复引导语", type: "textarea", description: "仅影响 HTML 邮件，纯文本引导语由后端生成。" },
        ],
      },
      {
        title: "博主来信模板",
        icon: "mingcute:send-plane-fill",
        description: "手动邮件的主题和正文在发送时撰写，此处只配置 HTML 邮件中的分类标签。",
        fields: [
          { path: "templates.owner.category", label: "邮件分类", type: "text" },
        ],
      },
    ],
  },
  {
    key: "oauth",
    slug: "oauth",
    title: "第三方登录",
    icon: "mingcute:key-2-line",
    description: "当前登录实现仅支持 GitHub 与 QQ。GitHub 使用本地 OAuth 凭据，QQ 通过既定中转服务登录，无需本地 App ID 或 App Key。",
    sections: [
      {
        title: "提供商声明",
        icon: "mingcute:user-3-line",
        description: "此列表及启用标记通过公共站点配置对外提供；当前登录接口和登录按钮不以该标记禁用登录，不能将它用作访问控制。",
        fields: [
          {
            path: "providers",
            label: "登录提供商",
            type: "object-list",
            description: "仅维护当前后端支持的提供商，同一提供商只保留一项。",
            initial: { type: "github", enabled: false },
            fields: [
              {
                path: "type",
                label: "提供商",
                type: "select",
                choices: [
                  { value: "github", label: "GitHub" },
                  { value: "qq", label: "QQ" },
                ],
              },
              { path: "enabled", label: "公开启用标记", type: "boolean" },
            ],
          },
        ],
      },
      {
        title: "GitHub 登录",
        icon: "mingcute:github-line",
        description: "在 GitHub OAuth App 设置回调为「后端服务地址 + /api/auth/oauth/github/callback」，后端服务地址来自站点网址设置的 serverUrl（BACKEND_URL 优先），不要使用参考后台的 /auth/callback/github。",
        fields: [
          {
            path: "public.github.clientId",
            label: "Client ID",
            type: "text",
            environment: "GITHUB_CLIENT_ID",
            description: "公开客户端标识，会包含在公共站点配置中。显式环境变量优先，启动时同步到数据库。",
          },
          {
            path: "secrets.github.clientSecret",
            label: "Client Secret",
            type: "password",
            environment: "GITHUB_CLIENT_SECRET",
            description: "仅供后端交换令牌，不包含在公共配置中。显式环境变量优先，启动时同步到数据库。",
          },
        ],
      },
    ],
  },
];
