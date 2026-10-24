import type { OptionGroup } from "./option-schema";

/** 后端实际消费的站点、地址、评论和友链配置；不为未设置的字段填充默认值。 */
export const siteOptionGroups: readonly OptionGroup[] = [
  {
    key: "seo",
    slug: "seo",
    title: "SEO 设置",
    icon: "mingcute:search-2-line",
    description: "站点公开信息，会通过站点配置接口向访客公开。",
    sections: [
      {
        title: "站点信息",
        icon: "mingcute:search-2-line",
        fields: [
          { path: "title", label: "网站标题", type: "text" },
          { path: "description", label: "网站描述", type: "textarea" },
          { path: "keywords", label: "网站关键词", type: "lines", description: "每行一个关键词，保存为字符串数组。" },
        ],
      },
    ],
  },
  {
    key: "url",
    slug: "url",
    title: "地址设置",
    icon: "mingcute:link-line",
    description: "站点公开访问地址；显式环境变量优先，并会在配置同步时写回数据库。",
    sections: [
      {
        title: "访问地址",
        icon: "mingcute:link-line",
        fields: [
          { path: "webUrl", label: "网站地址", type: "url", environment: "FRONTEND_URL", description: "前台公开地址，也用于生成站点跳转链接；向访客公开。" },
          { path: "serverUrl", label: "服务端地址", type: "url", environment: "BACKEND_URL", description: "后端公开访问地址；向访客公开。" },
        ],
      },
    ],
  },
  {
    key: "commentOptions",
    slug: "comments",
    title: "评论设置",
    icon: "mingcute:comment-line",
    description: "评论提交规则与反垃圾设置；显式环境变量优先，并会在配置同步时写回数据库。",
    sections: [
      {
        title: "评论规则",
        icon: "mingcute:comment-line",
        fields: [
          {
            path: "disableComment", label: "禁用评论", type: "boolean",
            environment: "COMMENTS_DISABLED",
            description: "开启后拒绝新评论提交（包括站长）；此开关向访客公开。",
          },
          {
            path: "disableNoChinese", label: "允许不含中文的评论", type: "boolean",
            environment: "COMMENTS_ALLOW_NO_CHINESE",
            description: "开启即跳过中文检查；关闭时正文须含 U+4E00–U+9FFF 范围内字符。此开关向访客公开。",
          },
          {
            path: "commentShouldAudit", label: "评论需要审核", type: "boolean",
            environment: "COMMENTS_REQUIRE_AUDIT",
            description: "非站长评论默认进入待审核；命中垃圾关键词时优先标记为垃圾。此设置不公开。",
          },
          {
            path: "recordIpLocation", label: "记录 IP 归属地", type: "boolean",
            environment: "COMMENTS_RECORD_IP_LOCATION",
            description: "根据提交者 IP 查询并记录评论归属地；此开关不通过公开配置接口返回。",
          },
        ],
      },
      {
        title: "反垃圾与验证",
        icon: "mingcute:settings-3-line",
        description: "以下字段不通过公开站点配置接口返回。",
        fields: [
          {
            path: "blockIps", label: "屏蔽 IP", type: "lines",
            environment: "COMMENTS_BLOCKED_IPS",
            description: "每行一个 IP；与请求来源 IP 精确匹配时拒绝提交，不支持 CIDR。",
          },
          {
            path: "spamKeywords", label: "垃圾评论关键词", type: "lines",
            environment: "COMMENTS_SPAM_KEYWORDS",
            description: "每行一个；忽略大小写进行正文子串匹配，命中后将非站长评论标记为垃圾，而非拒绝提交。",
          },
          {
            path: "turnstileSecret", label: "Turnstile 服务端密钥", type: "password",
            environment: "TURNSTILE_SECRET",
            description: "有效密钥启用匿名评论验证码校验；留空不校验。密钥仅供后端使用。",
          },
        ],
      },
      {
        title: "AI 反垃圾审核",
        icon: "mingcute:sparkles-line",
        description: "同时启用反垃圾与 AI 审核后，异步审核新评论；服务商和模型在 AI 服务中配置。",
        fields: [
          { path: "antiSpam", label: "启用反垃圾", type: "boolean" },
          { path: "aiReview", label: "启用 AI 审核", type: "boolean", description: "会向已配置的 AI 服务发送评论内容、作者和邮箱，可能产生费用。" },
          { path: "aiReviewType", label: "审核模式", type: "select", choices: [{ value: "binary", label: "直接判断" }, { value: "score", label: "评分判断" }] },
          { path: "aiReviewThreshold", label: "垃圾评分阈值", type: "number", min: 0, max: 10, step: 1, description: "评分模式下，0–10 分中达到或超过此值的评论标记为垃圾；缺省为 5。" },
        ],
      },
    ],
  },
  {
    key: "friendLinkOptions",
    slug: "friend-links",
    title: "友链设置",
    icon: "mingcute:link-line",
    description: "友链申请策略及健康检查；显式环境变量会同步写入数据库，并优先覆盖运行时配置。",
    sections: [
      {
        title: "申请规则",
        icon: "mingcute:link-line",
        description: "申请开关与子路径规则会通过站点配置接口向访客公开。",
        fields: [
          {
            path: "allowApply", label: "允许申请友链", type: "boolean",
            environment: "FRIEND_LINK_ALLOW_APPLY",
            description: "关闭后拒绝访客提交友链申请。",
          },
          {
            path: "allowSubPath", label: "允许子路径地址", type: "boolean",
            environment: "FRIEND_LINK_ALLOW_SUB_PATH",
            description: "关闭时申请地址的路径须为空或 /，仅接受站点根路径。",
          },
        ],
      },
      {
        title: "健康检查",
        icon: "mingcute:settings-3-line",
        description: "后台任务参数，不通过公开站点配置接口返回。",
        fields: [
          {
            path: "healthCheckIntervalHours", label: "检查间隔（小时）", type: "number",
            min: 1, step: 1,
            environment: "LINK_HEALTH_CHECK_INTERVAL_HOURS / LINK_HEALTH_CHECK_INTERVAL",
            description: "自动检查的等待间隔，运行时至少 1 小时；前一个环境变量优先。配置变更后重新计时。",
          },
          {
            path: "healthCheckTimeoutSeconds", label: "请求超时（秒）", type: "number",
            min: 1, max: 120, step: 1,
            environment: "LINK_HEALTH_TIMEOUT",
            description: "自动与手动健康检查共用；请求超时在运行时限制为 1–120 秒。",
          },
        ],
      },
    ],
  },
];
