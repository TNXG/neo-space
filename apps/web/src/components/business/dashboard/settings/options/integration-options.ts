import type { OptionGroup } from "./option-schema";

/** 后端实际消费的集成配置；服务商数组必须整体替换，不能通过 PATCH 删除。 */
export const integrationOptionGroups: readonly OptionGroup[] = [
  {
    key: "ai",
    slug: "ai",
    title: "AI 服务",
    icon: "mingcute:sparkles-line",
    description: "管理 OpenAI 兼容服务商及摘要、翻译、评论审核模型；配置本身不会发起模型请求。",
    sections: [
      {
        title: "服务商配置",
        icon: "mingcute:link-line",
        description: "仅支持后端可解析的两种类型。密钥仅供后端请求使用；显示名称仅用于管理界面。",
        fields: [
          {
            path: "providers",
            label: "AI 服务商",
            type: "object-list",
            description: "可添加、编辑或移除服务商。移除前请调整引用该服务商的模型分配。",
            initial: { id: "", name: "", type: "openai-compatible", apiKey: "", endpoint: "", defaultModel: "", enabled: false },
            fields: [
              { path: "id", label: "服务商标识", type: "text", required: true, description: "模型分配引用的唯一技术 ID（不是数据库 _id）；修改后须同步所有分配。" },
              {
                path: "type", label: "服务类型", type: "select", required: true,
                choices: [
                  { value: "openai", label: "OpenAI" },
                  { value: "openai-compatible", label: "OpenAI 兼容接口" },
                ],
              },
              { path: "name", label: "显示名称", type: "text", description: "仅作为管理界面的服务商标签，不影响后端路由。" },
              { path: "apiKey", label: "API 密钥", type: "password", description: "后端以 Bearer 令牌发送，不应在公开配置中展示。" },
              { path: "endpoint", label: "接口地址", type: "url", required: true, description: "完整 API 基础地址（通常包含 /v1）；后端直接追加 /chat/completions，不会补默认地址。" },
              { path: "defaultModel", label: "默认模型", type: "text", description: "填写接口实际支持的模型标识；用途未指定模型时回退到此值。" },
              { path: "enabled", label: "启用服务商", type: "boolean", description: "禁用后该服务商不会执行 AI 请求。" },
            ],
          },
        ],
      },
      {
        title: "功能开关",
        icon: "mingcute:settings-3-line",
        fields: [
          { path: "enableSummary", label: "启用摘要", type: "boolean", description: "控制摘要用途的 AI 服务，也影响文章时效性分析。" },
          { path: "enableTranslation", label: "启用翻译", type: "boolean", description: "控制翻译用途的 AI 服务，不会自动生成翻译。" },
        ],
      },
      {
        title: "摘要模型",
        icon: "mingcute:sparkles-line",
        description: "未指定服务商或引用失效时，后端回退到第一个已启用服务商。",
        fields: [
          { path: "summaryModel.providerId", label: "服务商", type: "select", providerChoices: true },
          { path: "summaryModel.model", label: "模型", type: "text", description: "留空使用所选服务商的默认模型。" },
        ],
      },
      {
        title: "翻译模型",
        icon: "mingcute:sparkles-line",
        description: "未指定服务商或引用失效时，后端回退到第一个已启用服务商。",
        fields: [
          { path: "translationModel.providerId", label: "服务商", type: "select", providerChoices: true },
          { path: "translationModel.model", label: "模型", type: "text", description: "留空使用所选服务商的默认模型。" },
        ],
      },
      {
        title: "评论审核模型",
        icon: "mingcute:message-3-line",
        description: "由评论设置中的 AI 审核开关控制。配置服务商列表后，审核必须明确指定有效服务商。",
        fields: [
          { path: "commentReviewModel.providerId", label: "服务商", type: "select", providerChoices: true },
          { path: "commentReviewModel.model", label: "模型", type: "text", description: "留空回退到服务商默认模型；审核要求最终模型非空且服务商已启用。" },
        ],
      },
      {
        title: "无服务商列表时的接口配置",
        icon: "mingcute:link-line",
        description: "仅当服务商列表为空时生效；添加服务商后以下三个字段均被忽略。",
        fields: [
          { path: "openAiEndpoint", label: "接口地址", type: "url", description: "后端直接追加 /chat/completions，不会补默认地址。" },
          { path: "openAiPreferredModel", label: "模型", type: "text" },
          { path: "openAiKey", label: "API 密钥", type: "password", description: "仅供后端 Bearer 鉴权使用。" },
        ],
      },
    ],
  },
  {
    key: "searchOptions",
    slug: "search",
    title: "搜索服务",
    icon: "mingcute:search-2-line",
    description: "配置后端访问 Meilisearch 的地址与凭证，供搜索和索引管理使用。",
    sections: [
      {
        title: "Meilisearch",
        icon: "mingcute:search-2-line",
        fields: [
          {
            path: "endpoint", label: "服务地址", type: "url",
            description: "后端可访问的 Meilisearch 基础地址；空值会回退到运行时原有地址。",
            environment: "MEILISEARCH_URL 优先于 MEILISEARCH_HOST；显式设置的环境变量优先于数据库并回写。",
          },
          {
            path: "apiKey", label: "API 密钥", type: "password",
            description: "供后端搜索与索引管理鉴权，不是前端公开搜索密钥。",
            environment: "MEILISEARCH_API_KEY 显式设置时优先于数据库并回写。",
          },
        ],
      },
    ],
  },
  {
    key: "bangumiOptions",
    slug: "bangumi",
    title: "追番服务",
    icon: "mingcute:link-line",
    description: "读取指定 Bangumi 用户的公开收藏；当前后端不消费访问令牌配置。",
    sections: [
      {
        title: "Bangumi",
        icon: "mingcute:link-line",
        fields: [
          { path: "username", label: "用户名", type: "text", description: "用于公开收藏请求的 Bangumi 用户名，不是昵称；留空后收藏接口返回未配置。" },
        ],
      },
    ],
  },
  {
    key: "securityOptions",
    slug: "security",
    title: "安全设置",
    icon: "mingcute:lock-line",
    description: "管理后端实际使用的 Owner 桌面客户端鉴权令牌，不涉及账号密码或 JWT 配置。",
    sections: [
      {
        title: "桌面客户端",
        icon: "mingcute:key-2-line",
        fields: [
          {
            path: "ownerDesktopToken", label: "Owner 桌面令牌", type: "password",
            description: "桌面客户端 WebSocket 必须提供完全一致的令牌；留空时服务器拒绝连接。更换后同步更新客户端。",
            environment: "OWNER_DESKTOP_TOKEN 显式设置时优先于数据库并回写；需同时修改部署环境才能持久变更。",
          },
        ],
      },
    ],
  },
];
