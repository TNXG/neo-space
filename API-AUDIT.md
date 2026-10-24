# API 契约检查报告

检查日期：2026-10-24。

后续状态：用户随后要求移除旧面板，`apps/admin`、后端 `/proxy` 托管及其构建集成已删除；后端管理 API 保留。本报告保留移除前的契约检查快照，不代表已经修复下列问题。后续面板将在 `apps/web` 中实现，本轮未创建替代 UI。

## 1. 范围与结论

本次核对 `apps/web/src/lib/api-client.ts`、`api-client.client.ts`、相关 TypeScript 类型与消费方，对照后端路由挂载、请求提取器、处理器、序列化模型与鉴权规则。

**结论：公共站主要读取接口的 method/path 基本匹配，但客户端并非全部契约一致；它也不是完整的管理 API 客户端，不能直接作为新管理面板全部能力已经可用的证明。**

本次检查阶段没有修复业务代码或修改后端契约，也没有开始面板施工；之后执行的旧面板移除见上方状态说明。本报告与项目内 `skills/neo-space-api-design/SKILL.md` 分工如下：报告记录检查事实；skill 指导后续 API 设计。

### 证据分级

- **源码确认**：直接读到的路由、字段、类型、权限分支或调用代码。
- **源码推导**：根据上述实现推导调用后果，不等于已经运行该业务接口。
- **运行时实测**：本次实际请求观察到的结果。
- **未验证**：依赖不可用、未取得会话或未执行的行为。

下列业务问题均为源码确认，HTTP 后果为源码推导。文件行号是检查时快照，后续修改可能使其偏移。优先级表示对现有消费者的影响，不是漏洞评级。

## 2. 确定的接口与消费方问题

### API-01：读者接口缺少 `/user` 前缀

- 客户端：`apps/web/src/lib/api-client.ts:343-349`。
  - `getReaders()` 调用 `GET /api/readers`。
  - `getReaderById()` 调用 `GET /api/readers/{id}`。
- 后端：`apps/backend/src/app.rs:227` 挂载 `/user`，`apps/backend/src/routes/user.rs:24-31` 注册 `/readers` 和 `/readers/{id}`。
- 实际端点：`GET /api/user/readers`、`GET /api/user/readers/{id}`。
- 后果：现有两方法指向未注册路由，调用将返回 404。检索未发现当前 web 业务调用方，属于尚未触发的错误。
- 注意：公开列表会清空 email，不可据此作为管理用户信息的完整来源，见 `apps/backend/src/handlers/users.rs:294-324`。

### API-02：头像更新请求体与返回类型不一致（P1）

- 客户端：`apps/web/src/lib/api-client.ts:619-633`。
  - `PUT /api/auth/avatar` 发送 `{ provider: "github" | "qq" | "gravatar" }`。
  - 声明返回 `ApiResponse<Reader>`。
- 后端：`apps/backend/src/handlers/auth.rs:36-40,165-186`。
  - 请求实际要求 `{ avatar: string }`，值是头像 URL。
  - 返回 `ApiResponse<string>`，`data` 是头像 URL，不是 Reader。
- 当前消费者：`apps/web/src/components/comment/auth/AvatarSelector.tsx:81-108` 调用 `updateAvatar({ provider }, token)`。
- 后果：有效会话下，请求缺少必填 `avatar`，参数解析失败；即便请求字段正确，声明的返回类型仍然错误。
- 状态码依据：这里使用 `AppJson`，`apps/backend/src/error.rs:126-143` 把解析错误转为 `AppError::BadRequest`，`:49` 映射 HTTP 400。不是框架默认的 422。

### API-03：账号关联方法调用不存在的后端路由

- 客户端：`apps/web/src/lib/api-client.ts:507-518`，`linkAccount()` 调用 `POST /api/auth/link/{provider}`。
- 后端：`apps/backend/src/routes/auth.rs:7-79` 未注册该路由；现有身份绑定入口为 `/bindable-identities`、`/bind-anonymous`、`/skip-bind` 等。
- 后果：该方法调用将返回 404。检索未发现当前 web 业务调用方。
- 边界：不能把已有匿名身份绑定接口当成 OAuth 账号关联接口，它们的业务语义不同。

### API-04：普通读者的删除评论入口与后端权限不一致（P1）

- 客户端方法：`apps/web/src/lib/api-client.ts:557-563`，`deleteAuthComment()` 携带读者 Bearer token 请求 `DELETE /api/comments/{id}`。
- 当前消费者：`apps/web/src/components/comment/comment-item/CommentActions.tsx:43-65,174-207` 为 `isOwnComment` 展示删除按钮并调用该方法。
- 后端注册：`apps/backend/src/routes/comment.rs:16-20`。
- 后端权限：`apps/backend/src/handlers/admin/comment.rs:97-118` 只允许 `auth.is_owner` 删除。
- 后果：对于存在的评论，非 owner 读者即使删除自己的评论也会得到 403。编辑评论另有作者校验，不代表删除权限相同。
- 处理边界：后续应让前端遵守实际权限；不能为了现有按钮擅自扩大后端删除权限。

### API-05：Server Action 的评论更新/删除没有转发身份（P1）

- 客户端：`apps/web/src/lib/api-client.ts:425-439` 的 `updateComment()`、`deleteComment()` 没有 token 参数，也未添加鉴权头。
- 调用路径：`apps/web/src/actions/comment.ts:78-80,106-108` 直接调用这两个方法，没有转发 Cookie 或 Authorization。
- 后端：`apps/backend/src/auth/extractors.rs:31-33,130-147` 从请求 Bearer 或 `admin-auth-token` Cookie 识别身份。
- 权限：`apps/backend/src/handlers/admin/comment.rs:35-51,115-118` 分别要求作者/owner、owner。
- 后果：服务器 fetch 不会自动继承浏览器会话；通过这些 Action 操作存在的评论时，不会因为用户已在浏览器登录就获得权限。当前交互组件另有显式 token 的调用方法，需区分两条路径。

### API-06：评论隐藏、显示、置顶、取消置顶的返回类型错误

- 客户端：`apps/web/src/lib/api-client.ts:569-611` 的 `hideComment`、`showComment`、`pinComment`、`unpinComment` 均声明 `ApiResponse<Comment>`。
- 后端：`apps/backend/src/handlers/admin/comment.rs:170-268` 四个处理器均返回 `ApiResponse<()>`，序列化后 `data: null`。
- 后果：不能读取返回值中的 Comment 字段。当前 `CommentActions.tsx` 只判断 `code` 并刷新，所以此偏差未直接破坏现有成功分支。

### API-07：账号列表期望的头像与昵称字段不在响应中

- 客户端类型：`apps/web/src/lib/api-client.ts:445-452` 声明 `oauth_avatar?`、`oauth_name?`。
- 当前消费者：`apps/web/src/components/comment/auth/ProfilePopover.tsx:125-150` 用这两个字段显示账号头像和昵称。
- 后端：`apps/backend/src/models/account.rs:58-86` 的 `AccountResponse` 只提供 `_id`、`userId`、`provider`、`accountId`、`scope`、`createdAt`、`updatedAt`，没有上述两个字段。
- 后果：账号列表无法从该响应取得 OAuth 头像和昵称，当前界面回退显示 provider/accountId。内部 Account 的字段不能当作公开 AccountResponse 已返回的字段。

### API-08：站主资料的最近登录字段名称不一致

- 客户端：`apps/web/src/types/api.ts:254-265` 声明 `last_login_time`。
- 后端：`apps/backend/src/models/user.rs:28-29` 序列化名称是 `lastLoginTime`。
- 后果：按客户端类型读取 `last_login_time` 得不到服务端值。检索仅发现页面 fallback 对其赋值，未发现实际展示使用，因此当前主要是潜伏类型偏差。
- 后续资料写入契约：`PATCH /api/user/profile` 继续返回 `ReaderResponse`，`isOwner` 取当前 `AuthUser`；普通读者仍可修改基本资料/邮箱，但提交 `introduce`、`url`、`socialIds`（含显式 `null`）在写库前返回 403。`socialIds` 保持整体替换；邮箱与关联 owner mail 的既有写入行为保留。
- 写后同步：`services/user_profile.rs` 成功后广播 `UserProfileUpdated`，站主写入再经既有 ISR 通道触发 `user-profile` 标签失效（依赖原有 revalidation 配置及日志告警）；Rust 资料读取当前无 Moka 缓存。以上为源码契约，未执行运行时验证。

### API-09：时间胶囊请求把后端必填字段声明为可选

- 客户端：`apps/web/src/types/api.ts:323-327` 的 `TimeCapsuleRequest.refType?`。
- 后端：`apps/backend/src/handlers/ai/types.rs:53-62` 的 `ref_type` 无默认值；`apps/backend/src/handlers/ai/service.rs:178-182` 使用 `AppJson` 解析。
- 后果：类型允许的 `{ refId }` 请求会因缺少 `refType` 得到 HTTP 400。GET 读取接口的默认 `refType` 与 POST 请求的必填性不可混淆。
- 检索未发现 `analyzeTimeCapsule()` 的当前 web 业务调用方。

## 3. 响应建模与接口基础设施偏差

### API-10：可空值与 JSON 元数据类型不精确

| 字段 | 前端声明 | 后端实际 | 源码依据 |
| --- | --- | --- | --- |
| `Reader.emailVerified` | `boolean` 或缺省 | 可为 `null` | `apps/web/src/types/api.ts:274`；`apps/backend/src/models/reader.rs:58-59` |
| `Post.category` | `Category` 或缺省 | 可为 `null` | `apps/web/src/types/api.ts:41`；`apps/backend/src/models/content.rs:177` |
| `Post.meta` | `string` 或缺省 | JSON 值或 `null` | `apps/web/src/types/api.ts:51`；`apps/backend/src/models/content.rs:196-197` |
| `Post.modified` | `string` 或缺省 | 可序列化为 `null` | `apps/web/src/types/api.ts:47`；`apps/backend/src/models/content.rs:187-189` |

这是已确认的类型差异，不代表当前每个调用方都已发生异常。

### API-11：错误响应没有固定的 `data` 字段

- 项目目标响应为 `{ code, status, message, data }`，失败时 `data: null`。
- 实际 `apps/backend/src/error.rs:79-83` 仅输出 `code`、`status`、`message`，没有 `data`。
- 当前 `api-client.ts:98-129` 在非 2xx 时读取 message 并抛错，因此没有直接解包错误 data；但后续统一 API 消费层不能假设现有失败响应完全符合目标包装。
- 此项是现状与项目契约的差异，本轮未修改后端。

### API-12：OpenAPI 不能作为完整 API 清单

- `apps/backend/src/openapi.rs:16-19` 的 `paths(...)` 只登记 `health_check`。
- 本次运行时读取 `/api-docs/openapi.json`，其 `paths` 也只有 `/health`，与源码一致。
- 后果：不能据 Swagger/OpenAPI 中只有一个端点推断后端能力，也不能据此生成完整客户端。应以 `app.rs` 与各 `routes/` 的实际注册为准。

## 4. 已有但需保留语义的特殊契约

以下不归类为当前调用必错，但后续设计/迁移容易误用：

- 匿名身份绑定与跳过绑定的 token 通过 `message` 返回，`data` 是 Reader；当前调用方按此处理。依据：`apps/backend/src/handlers/oauth.rs` 的 `bind_anonymous`、`skip_bind`，以及 `apps/web/src/app/[locale]/auth/callback/page.tsx`。不能在新调用方中假设 token 位于 `data.token`；未来新 API 不应沿用把业务数据藏在 message 的设计。
- `getComments()` 固定传入资源引用，消费的是公共评论树 `{ comments, count }`；后端 owner 在无 ref 时使用管理分页分支。新面板应单独建模管理查询，不能直接把现有公共评论方法当作完整管理列表。依据：`apps/backend/src/handlers/comment.rs:35-84`、`apps/web/src/lib/api-client.ts:396-411`。
- `/recentlies` 与 `/recently` 是两套真实入口，不能仅凭命名认定前者拼写错误。依据：`apps/backend/src/routes/misc.rs:11-14`、`apps/backend/src/routes/recently.rs:7-18`。
- GET `/ai/time-capsule/{ref_id}` 在条件满足时会生成分析并写入缓存，不保证完全无副作用；检查时不能只按 HTTP 方法判断是否安全。依据：`apps/backend/src/handlers/ai/service.rs:196-234`。

## 5. 后端 API 能力与客户端覆盖

常规端点统一加 `/api` 前缀。以下是按能力归类的覆盖地图，不是每个端点都已完成运行时验证，也不是要求把全部能力塞进同一个 `api-client.ts`。

### 已有公共站封装

| 能力 | 当前封装/路径 | 结论 |
| --- | --- | --- |
| 文章 | `/posts`、`/posts/{id}`、`/posts/slug/{slug}`、相邻文章 | 路径匹配；部分响应字段类型需校准 |
| 日记 | `/notes`、`/notes/{id}`、`/notes/nid/{nid}`、解锁、相邻日记 | 路径匹配；公共接口不等于管理列表 |
| 独立页面 | `GET /pages/{slug}` | 路径匹配 |
| 分类 | `GET /categories` | 路径匹配；标签专用入口未在该文件封装 |
| 友链 | 列表、详情、申请、验证码 | 路径匹配；管理审核等未覆盖 |
| 速记 | `GET /recentlies` | 路径匹配 |
| 站主/配置 | `GET /user/profile`、`GET /config` | 路径匹配；资料字段偏差见 API-08 |
| 评论 | 公共列表、创建、编辑、删除、隐藏/置顶 | 权限、凭据和返回类型偏差见 API-04/05/06 |
| 登录用户/OAuth | `/auth/me`、`/auth/accounts`、绑定、头像、OAuth 跳转 | 部分契约偏差见 API-02/03/07 |
| 读者 | `getReaders`、`getReaderById` | 路径错误，见 API-01 |
| 时间胶囊 | `/ai/time-capsule` 与 `/{ref_id}` | 路径匹配；POST 必填性偏差见 API-09 |
| 客户端分页与搜索 | `api-client.client.ts` 的文章/日记/友链 SWR 与 `/search` | method/path 匹配；不是管理 API 的完整封装 |

### 后端已有、但 `api-client.ts` 尚未封装的管理能力

| 模块 | 代表性真实端点（均省略 `/api`） | 路由依据 |
| --- | --- | --- |
| 密码登录/会话 | `GET /auth/password-key`、`GET/POST/DELETE /auth/tokens` | `apps/backend/src/routes/auth.rs`；当前密码传输契约见下文 |
| Passkey | 列表、删除、`/auth/passkeys/register/{start,finish}`、`authenticate/{start,finish}` | `apps/backend/src/routes/auth.rs:54-78` |
| 登录前探测 | `GET /owner/allow-login`、`GET /owner/identify` | `apps/backend/src/routes/owner.rs:7-16` |
| 仪表盘 | `GET /dashboard/overview` | `apps/backend/src/routes/admin_dashboard.rs:6-10` |
| 文章写入 | `POST /posts`、`PUT/PATCH/DELETE /posts/{id}`、`DELETE /posts/batch` | `apps/backend/src/routes/admin_posts.rs:7-16` |
| 日记管理 | `GET /notes/admin/all`、`POST /notes`、`PUT/DELETE /notes/{id}`、`DELETE /notes/batch` | `apps/backend/src/routes/admin_notes.rs:7-15` |
| 页面管理 | `GET /pages/list`、`POST /pages`、`GET/PUT/DELETE /pages/id/{id}` | `apps/backend/src/routes/pages.rs:10-18` |
| 分类/标签 | `POST /categories`、`PUT/DELETE /categories/{id}`；标签列表与按标签读文章 | `apps/backend/src/routes/categories.rs:7-18` |
| 评论审核/批量 | `PATCH /comments/state`、`PATCH /comments/{id}/state`、`DELETE /comments/batch` | `apps/backend/src/routes/admin_comments.rs:7-11` |
| 友链管理 | `/links/admin`、`/links/state`、`/links/health`、创建、更新、删除、通知 | `apps/backend/src/routes/admin_links.rs:7-20` |
| 用户管理 | `GET /user`、`GET/DELETE /user/{id}`、账号列表/解绑、按 email 查询 | `apps/backend/src/routes/user.rs:32-50` |
| 草稿 | CRUD、历史列表/版本、恢复、发布、按 ref 查询 | `apps/backend/src/routes/drafts.rs:7-39` |
| 说说/速记 | `/says` 创建/更新/删除；`/recently` 创建/更新/删除/清空 | `apps/backend/src/routes/says.rs:7-10`；`recently.rs:7-18` |
| 专栏/片段/项目 | `/topics` 读写与详情；`/snippets`、`/projects` 列表/创建/删除 | `apps/backend/src/routes/topics.rs:7-15`；`snippets.rs:7-13`；`projects.rs:7-13` |
| 系统配置 | `GET /options`、`GET/PATCH/PUT /options/{key}`、`/options/url`、测试邮件 | `apps/backend/src/routes/options.rs:7-22` |
| 文件上传 | `POST /files/upload` | `apps/backend/src/routes/files.rs:7-8` |
| AI 管理 | 写作生成、模型/配置测试、摘要、翻译、时间胶囊内容、Agent 会话/消息/流式聊天 | `apps/backend/src/routes/ai_admin.rs:12-77` |
| 搜索管理 | `/admin/meilisearch` 下索引、文档、设置、任务、向量配置、维护/重建/计划 | `apps/backend/src/routes/meilisearch_admin.rs:11-81` |

权限需逐接口核对：内容和配置写入等主要要求 owner，但页面列表、部分分类/标签和辅助内容读取为公开接口；不能仅凭本表“管理能力”标签判定所有 GET 都需要 owner。

### 当前 Owner 密码登录传输契约

- `GET /api/auth/password-key` 匿名可读，返回 `ApiResponse<{ keyId: string, algorithm: "RSA-OAEP-256", publicKey: string }>`；`publicKey` 是 WebCrypto 可导入的 SPKI PEM，响应带 `Cache-Control: no-store`。
- `POST /api/auth/tokens` 仅接收 `{ identifier, encryptedPassword, keyId }`。浏览器先用 RSA-OAEP/SHA-256 加密 UTF-8 密码，再以标准 base64 直传 Rust；Next.js 不再转发认证请求。禁止提交 `password`、旧 `username` 别名或任何未知字段。请求体上限为 4096 字节，4096-bit RSA 密文必须为 512 字节（base64 长度 684）；字段缺失、密钥不匹配、密文错误均返回 400。
- Rust 启动时在阻塞工作线程通过 `aws-lc-rs 1.18.2` 生成一次 4096-bit RSA 密钥，失败则终止启动；私钥只保存在该进程内存。每次登录的 AWS-LC OAEP-SHA-256/MGF1-SHA-256 解密及既有 bcrypt 校验也在阻塞工作线程运行；仅将解密返回的有效明文片段交给 UTF-8 与 bcrypt 校验，完整输出缓冲使用 `Zeroizing` 在成功或失败退出时擦除。应用指纹计算使用 `sha2 0.11`，已移除直接依赖的 RustCrypto `rsa` 与 `sha2_010`，但 `jsonwebtoken` 的传递依赖仍保留 `rsa`。不修改数据库密码，不引入 OPAQUE，不重置已有密码。
- Owner 查询/权限规则、成功响应中的 JWT 与用户不变；Cookie 现在由浏览器直接接收，属性与 CSRF 要求见下节。凭据不匹配仍为 401；本节是源码契约，尚未用真实账户验收登录部署链路。
- 密钥随进程重启轮换，客户端遇到旧 `keyId` 必须重新获取公钥并加密。该传输方案不是一次性挑战协议：同一密文在密钥轮换前可重复提交，仍需 HTTPS；多进程部署须保证取公钥与登录命中同一进程。
- 已执行无需数据库或真实账号的互通冒烟：使用实际密码服务生成 SPKI PEM，Node WebCrypto 以 RSA-OAEP/SHA-256 加密含中文及 emoji 的密码，AWS-LC 解密后通过 bcrypt；错误密码返回不匹配，旧 keyId、异常 base64/密文长度、无效 OAEP 密文、错误 hash/label 和非 UTF-8 明文均被拒绝。此验证不覆盖真实账号、Cookie 或跨源部署。

### 后台 CSR 与 API 直连现状

- 密码、Passkey、Owner 会话恢复及退出已经迁移到 `dashboard-api.ts`，浏览器 `credentials: include`，SWR 共享会话；旧 Next.js Server Action、服务端会话读取和认证转发模块已删除，旧 Next Cookie 需重新登录。公共站仍使用原有 SSR/RSC 与 ISR。
- Rust 签发/删除同名 HttpOnly Cookie，HTTP 开发为 SameSite=Lax，HTTPS 配置为 Secure + SameSite=None；跨站仍受浏览器第三方 Cookie 限制，部署宜使用同站 API 域名或部署层代理。凭据 CORS 使用精确 Origin。
- Cookie 认证变更及登录接口要求可信 Origin 和 `X-Requested-With: Neo-Space-Dashboard`；Bearer 调用保留既有认证。UI 守卫不替代 Rust Owner 权限。JWT 不进入持久化浏览器存储。
- 用户资料编辑复用 `GET/PATCH /api/user/profile`；基本资料按脏字段提交，社交对象完整提交、保留未改平台。变更后回读资料并更新会话，Rust 广播内部 `UserProfileUpdated` 事件并失效公共站 `user-profile`。后台缓存与公共站 ISR 各自处理。
- 已执行前端类型检查、后端 Profile 字段权限及 CSRF 单元检查，并用浏览器临时响应检查表单交互；未启动数据库或使用真实账户，未证明生产 Cookie / Passkey 登录和数据库持久化闭环。


### 不应误判为后端缺失的其他能力

- `/search` 已在 `apps/web/src/lib/api-client.client.ts` 中封装。
- `/aggregate/nav`、Bangumi、crates 等已有其他模块或组件请求，不因未出现在 `api-client.ts` 就算后端不存在。
- `/ws/reader`、`/ws/owner-desktop` 已注册，WebSocket 协议与鉴权未在本轮深入验证。
- `/health`、`/api/artworks/{filename}`、`/api/static/artworks/{filename}` 为独立健康/资源能力，不是管理 CRUD。

## 6. 顺带发现的数据可见性风险

这两项不是 `api-client.ts` 路径问题，也未在本轮修改，但应在后续 API 设计时单独评估：

- 公开 `GET /api/user/readers/{id}` 返回真实 email。依据：`apps/backend/src/routes/user.rs:28-31`、`apps/backend/src/handlers/users.rs:327-344`。公开列表却清空 email，两者的隐私边界不一致。
- 公开友链详情未按审核状态过滤，并可能序列化申请 email。依据：`apps/backend/src/handlers/link.rs` 的 `get_link` 与 `apps/backend/src/models/link.rs` 的 Link 模型。后续应确认这些信息是否确需公开；本轮未做线上数据暴露测试。

## 7. 实际验证与限制

### 本次实际观察

1. 初次检查时本地有后端进程监听 `:8000`。
2. `GET http://127.0.0.1:8000/health` 成功返回 JSON，`status` 为 `healthy`。
3. `GET http://127.0.0.1:8000/api-docs/openapi.json` 成功返回，`paths` 只有 `/health`。
4. 后续 Python HTTP、curl 与读取工具请求业务端点时连接被拒绝；curl 状态为 `000`、退出码为 7，读取工具报 `ECONNREFUSED`。这是连接失败，不是业务接口返回 HTTP 错误。

因此，**不能宣称业务 API 已全部实测可用**，也不能用当时的连接失败认定具体业务处理器有故障。

### 未完成的运行时覆盖

- 文章、日记、分类、友链、配置、读者等业务响应的实际数据验证。
- 带有效普通读者、作者与 owner 会话的权限矩阵。
- 任何写入、删除、批量操作、验证码或邮件发送。
- AI/搜索/上传等外部依赖、流式响应与 WebSocket 握手。
- 写后缓存失效、事件、前端 revalidation 与页面实际交互。

以上为契约检查阶段的验证记录：没有为检查而重启后端，没有发送写请求，也没有运行 build、lint 或测试套件。后续旧面板移除的构建与烟雾验证不在这份历史快照内。本报告不是业务 API 端到端验收通过证明。

## 8. 后续工作边界

- 先决定并明确修复上述前端契约问题，再让新面板消费已确认的管理 API。
- 新管理客户端需补充真实的会话、内容管理、配置、AI、搜索等方法与 DTO，不沿用公共站方法的权限/返回形状假设。
- 后续在 `apps/web` 路由组内重建面板；旧面板已按后续指令移除，但未创建新面板或修复上述契约问题。
- 新 API 的设计与验收按项目 skill `skills/neo-space-api-design/SKILL.md` 执行。

## 9. 旧管理面板移除后的验证

本节记录后续移除工作，不改变前述契约检查结论。已删除旧 Vue 应用、后端嵌入/开发代理、admin 专用配置和构建依赖；保留管理路由与密码、JWT、Passkey 鉴权。OAuth 回调不再跳转旧面板，统一使用已有 web 回调；未创建替代面板。

### 已执行检查

- `pnpm install --lockfile-only --ignore-scripts`：成功更新剩余 workspace 的锁文件。
- `pnpm install --frozen-lockfile --ignore-scripts`：通过，安装输出清理了 697 个包。
- `pnpm --filter @neo-space/web --filter @neo-space/rich-react typecheck`：两者均通过。
- `cargo check --locked --bin neo-space-backend-axum`：通过；保留既有 `handlers/admin/ai_agent_chat.rs` 中 `Json` 未使用的警告，未扩大范围修复。
- `pnpm exec turbo run build --dry-run=json` 与 `dev --dry-run=json`：任务图仅包含 backend、rich-react、web，不再包含旧面板。

### 实际 HTTP 烟雾验证

临时 Rust 程序直接加载真实应用模块并启动本地 Axum 服务。数据库指向本机未开放端口，不运行数据库初始化、迁移、模型准备或任何后台任务；只请求无需业务数据库即可判断的路径。临时源码已移除。

| 实际请求 | 观察结果 |
| --- | --- |
| `GET /health` | 200，`status: healthy` |
| `GET /proxy`、`/proxy/`、`/proxy/assets/index.js` | 均为 404，不再提供旧面板 |
| 无凭据 `GET /api/dashboard/overview` | 401，管理总览 API 保留且受保护 |
| 无凭据 `GET /api/auth/tokens`、`/api/auth/passkeys` | 均为 401，鉴权管理入口保留 |
| 无凭据 `GET /api/notes/admin/all`、`/api/options`、`/api/admin/meilisearch/overview` | 均为 401，管理入口保留且受保护 |
| `GET /api-docs/openapi.json` | 200 |
| 带 `Origin: http://localhost:3000` 请求 health | 返回允许该来源的 CORS 头 |
| 带 `Origin: http://localhost:9528` 请求 health | 不再返回允许旧 Vite 来源的 CORS 头 |

### 验证限制与既有问题

- 管理入口的 401 证明路由与拒绝匿名访问仍生效，不等于已验证登录后 CRUD、数据库操作或 OAuth 第三方交换流程。
- Turbo 2.9.6 对当前 pnpm 多文档 YAML 锁文件报告解析兼容性警告；任务图仍输出，但部分依赖解析/缓存能力受影响。该多文档结构在移除前已经存在，本轮未改换包管理器或锁文件格式。
- 未执行 Docker 镜像构建/发布。前端部署工作流既有的根目录产物路径与 standalone 配置问题未纳入本次旧面板移除。
