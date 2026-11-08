import type { SettingGroup } from "./settings-schema";

/** 站点公开信息、地址、评论与友链策略；字段路径以当前后端消费者为准。 */
export const siteGroups: readonly SettingGroup[] = [
  {
    key: "seo",
    slug: "seo",
    title: "站点信息",
    icon: "mingcute:search-2-line",
    help: "展示在浏览器标签页、搜索引擎与社交分享卡片中的网站信息。",
    sections: [
      {
        title: "基本信息",
        icon: "mingcute:search-2-line",
        fields: [
          { path: "title", label: "网站标题", control: "text", placeholder: "例如 Neo Space" },
          { path: "description", label: "网站简介", control: "textarea", placeholder: "用一两句话介绍你的网站" },
          {
            path: "keywords",
            label: "搜索关键词",
            control: "tags",
            itemLabel: "关键词",
            placeholder: "输入关键词后按 Enter",
            hint: "帮助搜索引擎了解网站主题，可添加多个。",
          },
        ],
      },
    ],
  },
  {
    key: "url",
    slug: "url",
    title: "站点地址",
    icon: "mingcute:link-line",
    help: "用于生成邮件中的文章链接与第三方登录回调地址。",
    sections: [
      {
        title: "访问地址",
        icon: "mingcute:link-line",
        fields: [
          {
            path: "webUrl",
            label: "网站地址",
            control: "url",
            placeholder: "https://example.com",
            env: "FRONTEND_URL",
            hint: "访客访问网站的公开地址。",
          },
          {
            path: "serverUrl",
            label: "后端服务地址",
            control: "url",
            placeholder: "https://api.example.com",
            env: "BACKEND_URL",
            hint: "用于接收第三方登录回调请求。",
          },
        ],
      },
    ],
  },
  {
    key: "commentOptions",
    slug: "comments",
    title: "评论设置",
    icon: "mingcute:comment-line",
    help: "管理访客评论权限、敏感词过滤与 AI 自动审核。",
    sections: [
      {
        title: "评论规则",
        icon: "mingcute:comment-line",
        fields: [
          {
            path: "disableComment",
            label: "关闭全站评论",
            control: "switch",
            env: "COMMENTS_DISABLED",
            hint: "开启后，所有页面将暂停接收新评论。",
          },
          {
            path: "disableNoChinese",
            label: "允许纯外文或表情评论",
            control: "switch",
            env: "COMMENTS_ALLOW_NO_CHINESE",
            hint: "关闭时，评论内容需包含中文汉字才可发表。",
          },
          {
            path: "commentShouldAudit",
            label: "新评论先审后发",
            control: "switch",
            env: "COMMENTS_REQUIRE_AUDIT",
            hint: "开启后，访客评论需经你审核通过后才会公开显示。",
          },
          {
            path: "recordIpLocation",
            label: "记录评论者所在地",
            control: "switch",
            env: "COMMENTS_RECORD_IP_LOCATION",
            hint: "发表评论时根据 IP 记录大致归属地。",
          },
        ],
      },
      {
        title: "垃圾拦截",
        icon: "mingcute:shield-shape-line",
        fields: [
          {
            path: "blockIps",
            label: "屏蔽 IP",
            control: "list",
            itemLabel: "IP 地址",
            env: "COMMENTS_BLOCKED_IPS",
            hint: "来自这些 IP 地址的评论将被直接拒绝。",
          },
          {
            path: "spamKeywords",
            label: "敏感词过滤",
            control: "tags",
            itemLabel: "关键词",
            env: "COMMENTS_SPAM_KEYWORDS",
            placeholder: "输入词语后按 Enter",
            hint: "命中关键词的评论会自动移入垃圾桶。",
          },
          {
            path: "turnstileSecret",
            label: "Turnstile 验证码密钥",
            control: "password",
            env: "TURNSTILE_SECRET",
            hint: "填写 Cloudflare Turnstile 密钥后，未登录访客评论前需完成人机验证。",
          },
        ],
      },
      {
        title: "AI 自动审核",
        icon: "mingcute:sparkles-line",
        help: "开启后，新发表的评论会自动交由 AI 识别广告与垃圾内容。",
        fields: [
          { path: "antiSpam", label: "启用垃圾评论过滤", control: "switch", hint: "使用敏感词过滤与 AI 审核的总开关。" },
          {
            path: "aiReview",
            label: "启用 AI 审核",
            control: "switch",
            hint: "让 AI 自动判断新评论是否为垃圾信息。",
            disabledWhen: [{ path: "antiSpam", equals: false, hint: "请先开启「启用垃圾评论过滤」。" }],
          },
          {
            path: "aiReviewType",
            label: "判定方式",
            control: "choice",
            options: [
              { value: "binary", label: "直接判定（正常 / 垃圾）" },
              { value: "score", label: "按风险打分（1–10 分）" },
            ],
            disabledWhen: [{ path: "aiReview", equals: false, hint: "请先开启「启用 AI 审核」。" }],
          },
          {
            path: "aiReviewThreshold",
            label: "拦截分数线",
            control: "number",
            unit: "分",
            min: 1,
            max: 10,
            step: 1,
            hint: "评分达到或超过该数值的评论会被移入垃圾桶（默认 5 分）。",
            disabledWhen: [
              { path: "aiReview", equals: false, hint: "请先开启「启用 AI 审核」。" },
              { path: "aiReviewType", equals: "binary", hint: "仅在「按风险打分」方式下生效。" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "friendLinkOptions",
    slug: "friend-links",
    title: "友链设置",
    icon: "mingcute:link-line",
    help: "设置访客自助申请友链的规则与自动巡检频率。",
    sections: [
      {
        title: "申请规则",
        icon: "mingcute:link-line",
        fields: [
          {
            path: "allowApply",
            label: "开放友链申请",
            control: "switch",
            env: "FRIEND_LINK_ALLOW_APPLY",
            hint: "允许访客在友链页面提交交换申请。",
          },
          {
            path: "allowSubPath",
            label: "允许非根域名网址",
            control: "switch",
            env: "FRIEND_LINK_ALLOW_SUB_PATH",
            hint: "开启后允许提交如 example.com/blog 这类带路径的地址。",
          },
        ],
      },
      {
        title: "自动巡检",
        icon: "mingcute:settings-3-line",
        help: "定期检测友链网站能否正常打开，并更新对方的最新文章。",
        fields: [
          {
            path: "healthCheckIntervalHours",
            label: "巡检间隔",
            control: "number",
            unit: "小时",
            min: 1,
            step: 1,
            env: "LINK_HEALTH_CHECK_INTERVAL_HOURS / LINK_HEALTH_CHECK_INTERVAL",
            hint: "每隔多少小时自动检测一次全部友链。",
          },
          {
            path: "healthCheckTimeoutSeconds",
            label: "等待超时",
            control: "number",
            unit: "秒",
            min: 1,
            max: 120,
            step: 1,
            env: "LINK_HEALTH_TIMEOUT",
            hint: "检测单个友链网站时的最长等待时间（1–120 秒）。",
          },
        ],
      },
    ],
  },
];
