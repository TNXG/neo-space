## TODO

## Issue

### Issue #5: 评论区验证码有效域名没有更新

- [x] 在 Cloudflare 更新 Turnstile 验证码的有效域名配置
- [x] 将有效域名从 blog.tnxg.moe 更新为 www.tnxg.moe

### Issue #4: 优化站点SEO

- [x] 添加 sitemap.xml 文件
- [x] 添加 robots.txt 文件
- [x] 补充站点的 OG 图（Open Graph）等内容
- [x] 进一步优化站点的 SEO 配置

### Issue #3: 重构 OwO 表情逻辑

- [x] 重构评论区 OwO 表情解析逻辑
- [x] 实现表情选择器填入特殊语法而非直接 Markdown 图片链接
- [x] 使用 react-markdown 解析表情特殊语法并转换为 IMG 标签
- [x] 将旧表情替换为邦邦系列表情（Poppin Party、Roselia、MyGO 等）

来源: https://github.com/TNXG/neo-space/issues

## Frontend

1. `src/contexts/PageContext.tsx` 当中的 `usePageContext()` 有 warning

---

## 路线图

### 计划中 🚧

- [ ] 管理后台界面（按顺序逐项交付）
  - 执行规则：每次完成一个业务闭环，再推进下一项；先核对真实后端 API，再完成类型、客户端封装、界面、缓存同步与必要验证，不用假数据或空入口冒充已完成。
  - 配套设置规则：每完成一个业务域，同时在「设置」提供该域现有数据库字段的维护入口；未完成字段编辑、保存回读和关联界面同步，不勾选该业务域完成。不要把所有设置都推迟到第 8 阶段，也不为尚无后端消费者的开关创建空配置。
  - 设置按「个人资料与社交链接 / 站点 / 评论 / 友链 / 邮件 / 第三方集成 / 安全」分组，复用同一个设置外壳；分组按实际完成的能力逐步开放。
  - 字段维护验收：说明字段用途、格式及公开范围；区分未修改、清空、删除与环境变量覆盖；只提交允许维护的字段，保存后回读最终生效值，更新客户端缓存，并由后端按需失效公共站缓存。
  - 数据依据：以下字段来自现有数据库读写代码与模型，尚未读取运行中 MongoDB 的实际文档或敏感值。实施表单前再次核对真实接口及部署中的字段存在性，不把模型默认值当作数据库现值。
  - [ ] 1. 认证与会话闭环
    - 浏览器直连 Rust，贯通密码、Passkey、会话恢复、过期处理与退出。
    - 验收：Rust 管理 Cookie，明确 CORS / CSRF 边界；移除旧 Next.js 认证代理与服务端会话路径，不将 JWT 持久化到浏览器存储。
    - 实现进度：认证请求与 Cookie 会话已改为浏览器直连 Rust，旧 Next.js 认证代理已移除；完整密码 / Passkey / Cookie 部署链路仍待授权测试账户验收。
    - 配套设置：接入已有的账户资料和认证管理能力；Cookie / CORS / CSRF 属于部署与后端安全边界，不做成随意可改的前端开关。
  - [ ] 2. 后台公共外壳定稿
    - 统一侧栏、移动导航、账户菜单、当前导航状态及加载与错误反馈。
    - 验收：桌面、折叠与移动端交互完整；未授权不能访问受保护数据，不展示无效导航入口。
    - [ ] 同步交付「设置 → 用户」的个人资料与社交链接，不等到第 8 阶段。
      - [x] 用户设置页、动态社交条目和保存回读逻辑已实现；仅保留外侧设置分组，复用 shadcn Collapsible / Button，图标沿用 inline-icon，移动导航沿用 Drawer。
      - [x] 会话与资料读取提供匹配布局的 Skeleton，覆盖桌面、移动端及减少动态效果。
      - 验证范围：已检查临时 API 响应下的保存/失败保留/回读重试、完整 socialIds 保留与删除、会话区同步；真实数据库持久化与公共站实际更新尚未验收，父任务保持未完成。
      - `readers`：`name`、`handle`、`image`、`email`；`owner_profiles`：`introduce`、`url`、`mail`、`socialIds`。
      - `socialIds`：`github`、`bilibili`、`netease`、`twitter`、`telegram`、`mail`、`rss`；平台账号/ID 与完整链接分开说明，保存前按实际消费方式校验，不把所有字段都当 URL。
      - 现有入口：`GET /api/user/profile` 读取聚合资料，`PATCH /api/user/profile` 更新当前账户；写入资料返回 Reader，社交资料须重新读取聚合接口。实施时核对 Owner 权限，不混淆 `owner_profiles._id`、`readerId` 与 `readers._id`。
      - `socialIds` 当前为整对象替换，修改一个平台时必须保留其他平台；邮箱更新同时涉及 `readers.email` 和 `owner_profiles.mail`。公共站邮件链接目前读取 `profile.mail`，不能把 `socialIds.mail` 当作已生效的独立邮箱入口。
      - 验收：可修改、清空自己的社交资料；刷新后保留，账户区与公共站实际显示更新；核对写后缓存失效，不能只显示保存成功。
  - [ ] 3. 文章管理
    - 接入列表、筛选、分页、创建、编辑、保存、发布与删除。
    - 验收：真实数据读写闭环，失败保留编辑内容；变更后同步详情、列表和相关计数缓存。
    - 配套设置：接入已有 AI 摘要能力时同步维护 `options.ai` 的 `providers`、`summaryModel`、`enableSummary`；启用翻译时同步维护 `translationModel`、`enableTranslation`，不恢复已移除的旧摘要开关。
  - [ ] 4. 分类与标签
    - 接入后端支持的分类、标签管理操作，并与文章编辑及筛选联动。
    - 验收：新增、修改与删除结果正确同步到关联页面，实体主键统一使用 `_id`。
    - 配套设置：分类与标签自身作为实体维护，不另造重复的 options 配置；关联删除、文章选择与筛选使用同一份真实数据。
  - [ ] 5. 日记与独立页面
    - 分别接入列表、编辑、发布及删除，复用已稳定的编辑能力。
    - 验收：各自完成真实读写闭环，保存状态、错误提示和客户端缓存同步完整。
    - 配套设置：与文章共用已完成的编辑、翻译等实际能力配置；没有现存配置字段和消费逻辑时，不新增无效开关。
  - [ ] 6. 评论管理
    - 接入分页、筛选、回复与后端已有的审核操作。
    - 验收：权限、操作反馈及变更后列表同步完整，失败不伪装为成功。
    - 配套设置：`options.commentOptions` 的 `disableComment`、`disableNoChinese`、`commentShouldAudit`、`recordIpLocation`、`blockIps`、`spamKeywords`、`turnstileSecret`；接入 AI 审核时同步维护 `options.ai.commentReviewModel`。密钥仅在 Owner 设置边界处理，不进入公共配置。
    - 邮件通知接入时同步交付 `options.mailOptions` 的 `enable`、`smtp`、`from`、`fromName` 与实际使用的 `templates`，复用现有测试邮件接口；不未经授权向真实邮箱发送验证邮件。
  - [ ] 7. 友链管理
    - 接入申请处理、编辑、删除与健康状态展示。
    - 验收：处理结果与真实状态一致，相关列表和计数同步更新。
    - 配套设置：`options.friendLinkOptions` 的 `allowApply`、`allowSubPath`、`healthCheckIntervalHours`、`healthCheckTimeoutSeconds`；保存后回读最终值，并核对申请入口与健康检查的生效时机。
  - [ ] 8. 站点设置与账户安全
    - 补齐而非集中拖延前述设置：站点 SEO/地址、邮件、第三方集成、安全，以及前序阶段已上线配置的统一维护。
    - 验收：敏感操作鉴权与错误处理完整，不为界面扩大后端权限。
    - [x] 已接入十个白名单配置分组的真实字段表单、外侧导航、加载骨架、保存与最终值回读；AI/OAuth 服务商支持增删及引用检查，凭据使用密码输入。
    - 已验证：TypeScript 与浏览器临时响应下的保存/失败/重试、数组删除、环境覆盖提示、桌面折叠及移动导航。未验证真实数据库持久化、SMTP/AI 服务或生产部署生效，阶段验收保持未勾选。
    - `options.seo`：`title`、`description`、`keywords`；`options.url`：`webUrl`、`serverUrl`。不照搬参考项目初始化表单中的 `adminUrl` / `wsUrl`，当前后端迁移已删除这两个字段。
    - `options.searchOptions`：`endpoint`、`apiKey`；`options.bangumiOptions`：`username`；`options.oauth`：按现有 `public` / `secrets` 结构维护；`options.securityOptions`：仅接入后端已有且安全边界明确的字段。
    - `options` 管理白名单：`ai`、`bangumiOptions`、`commentOptions`、`friendLinkOptions`、`mailOptions`、`oauth`、`searchOptions`、`securityOptions`、`seo`、`url`。不提供任意数据库键值编辑器。
    - 写入契约：`PATCH /api/options/{key}` 深度合并，带 `type` 的数组按类型合并；`PUT` 整体替换，仅在明确需要删除字段且保留完整文档时使用。密钥未修改不得被空输入覆盖。
    - 环境变量覆盖数据库：部分字段保存后会被部署环境值回写；界面展示最终生效值并说明覆盖来源，不能显示“已修改”却仍沿用旧值。
  - [ ] 9. 仪表盘总览
    - 接入真实统计、待处理事项与已完成业务入口。
    - 验收：不展示示例数据，加载、空状态与请求失败可区分，统计随业务变更同步。
  - [ ] 10. 上线收口
    - 检查权限、Cookie / CORS / CSRF、移动端、空状态与部署说明。
    - 验收：按实际部署场景完成必要验证，记录未验证项并更新文档。
    - 配套设置验收：核对每个已完成业务域均有必要字段维护入口、保存回读、失败反馈与缓存同步；个人社交资料、评论开关和友链申请开关纳入实际场景检查。

- [ ] 邮件订阅功能
  - 订阅表单
  - 订阅管理后台
  - 新文章邮件推送
  - 订阅确认/取消流程

- [ ] 多语言支持 (i18n)
  - i18n 配置
  - 语言切换组件
  - 内容翻译管理
  - 默认语言设置

### 未来展望 🔮

- [ ] 文章版本历史
  - 版本记录存储
  - 版本对比功能
  - 版本回滚功能
  - 版本历史查看界面


- [ ] 管理面板的 App 化
  - 使用 Flutter 或 React Native 开发移动端 App
  - 实现文章管理、评论管理等核心功能
  - 推送通知功能（新评论）
  - 主要为了随时记录灵感和快速处理评论
