# Neo-Space

<div align="center">

**现代化全栈博客系统**

基于 Next.js 16 + Rust/Axum 构建的高性能博客平台，使用 Turborepo 编排前端与后端服务

[![License](https://img.shields.io/badge/license-AGPL-blue.svg)](LICENSE.md)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black.svg)](https://nextjs.org/)
[![Rust](https://img.shields.io/badge/Rust-edition_2024-orange.svg)](https://www.rust-lang.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.9-blueviolet.svg)](https://turbo.build/)
[![pnpm](https://img.shields.io/badge/pnpm-11.1-yellow.svg)](https://pnpm.io/)

[功能介绍](#核心特性) • [快速开始](#快速开始) • [项目结构](#项目结构) • [技术架构](#技术架构)

</div>

---

## 项目简介

Neo-Space 是一个功能丰富、性能卓越的现代化博客系统。仓库以 Turborepo monorepo 形式组织，包含两个独立的应用与一个共享包：

- **web**：Next.js 16 + React 19 前端，提供 SSR/SSG 渲染体验
- **backend**：Rust + Axum 的高性能 API 服务，独立构建与部署，不依赖前端静态资源
- **packages/rich-react**：保留的独立富文本 React 组件共享包，供后续复用

### 设计理念

- **性能优先**：Rust 后端 + Next.js 前端，追求极致性能
- **类型安全**：TypeScript / Rust 双端类型安全
- **现代技术栈**：采用 Web 与 Rust 生态最新的最佳实践
- **可扩展性**：模块化 + monorepo 设计，便于维护与扩展

> **管理界面状态**：新后台位于 `apps/web/src/app/[locale]/(dashboard)`，入口 `/dashboard`（登录页 `/dashboard/signin`）。后台已提供独立外壳与「设置 → 用户」资料编辑，参考 `../admin` 的身份概览、基本信息和动态社交条目；设置分组只在外侧导航保留，技术路由为 `/dashboard/settings/profile`。密码 / Passkey、会话及资料读写由浏览器直接请求 Rust，使用 HttpOnly Cookie，不再经过 Next.js 认证代理。内容管理和注册页面尚未接入。业务组件位于 `src/components/business/dashboard`。

---

## 核心特性

### 内容管理

| 功能         | 描述                                            |
| ------------ | ----------------------------------------------- |
| 文章系统     | 支持 Markdown、代码高亮、数学公式、图片管理     |
| 日记系统     | Mood / Weather / Location 标签的碎片化记录      |
| 页面系统     | 静态页面支持，关于、友链等独立页面              |
| 分类管理     | 文章分类系统，支持多级分类                      |

### 评论系统

- 多层级评论：支持无限嵌套回复
- 悄悄说功能：仅评论者和管理员可见
- 评论管理：置顶、隐藏、显示状态管理
- 垃圾评论过滤：多层过滤机制 + Cloudflare Turnstile
- 实时通知：WebSocket 实时推送新评论

### 用户系统

- OAuth 认证：支持 GitHub 与 QQ 登录
- 匿名用户：可绑定邮箱成为正式用户
- 权限管理：区分普通用户和管理员

### 后台登录

- 登录页采用原创 SVG 星海观测站场景：环绕星体、星轨、极光薄雾与局部明暗主题，不依赖外部壁纸或 WebGPU。布局以单屏为目标，小屏将插画退为背景并压缩间距；极小视口或放大文字时仍保留内容可访问性。星轨在系统开启“减少动态效果”时自动停止。输入博主**用户名或邮箱**后调用 `/api/owner/identify`，匹配后仅显示公开头像与名称，不展示账号明细或凭据。
- 密码 / Passkey、会话读取和退出由浏览器通过 `dashboard-api.ts` 直连 Rust，统一 `credentials: include`，JWT 不写入浏览器存储。Cookie 由 Rust 签发与清除；本地 HTTP 使用 SameSite=Lax，HTTPS 配置使用 Secure + SameSite=None 支持跨站 API。浏览器禁用第三方 Cookie 的跨站部署仍需改成同站 API 域名或部署层反向代理。
- 博主密码先在浏览器使用 Web Crypto `RSA-OAEP / SHA-256` 和后端 4096 位公钥加密，再直接提交 Rust。`GET /api/auth/password-key` 返回 `{ keyId, algorithm, publicKey }` 且禁止缓存；`POST /api/auth/tokens` 只接受 `{ identifier, encryptedPassword, keyId }`。Next.js 不持有解密私钥，Rust 仅在校验现有 bcrypt 哈希时短暂解密，并清零临时密码缓冲。浏览器加密失败时不提交登录请求。
- Rust 密码传输使用 `aws-lc-rs 1.18.2` 的 RSA 密钥生成与 OAEP 解密，应用侧公钥指纹使用 `sha2 0.11`，不再直接依赖 RustCrypto `rsa` 或 `sha2_010`；前端协议和数据库 bcrypt 哈希不变。AWS-LC 在本机编译原生代码，需要可用的 C/C++ 构建工具链；这不是 AWS 云服务调用，也不要求 AWS 账号。当前启用非 FIPS 后端，不代表 FIPS 认证部署。`jsonwebtoken` 仍间接依赖 RustCrypto `rsa`，因此锁文件中仍会保留它，但密码解密不再经过该实现。
- 此方案保护请求体，不是零知识密码协议，也不代替 HTTPS：仍须防止公钥被替换、脚本被篡改及会话泄露。私钥仅保存在单个 Rust 进程内，重启后旧密文失效；多实例需保证取公钥和提交登录命中同一实例。密文没有一次性挑战绑定，在进程密钥轮换前仍可能被重放，不能记录密文或将其视为非敏感数据。
- WebAuthn 的 RP 主机名及精确 Origin 使用后端 `FRONTEND_URL`，须与实际访问 Next.js 的地址一致（含协议、端口）；生产环境使用 HTTPS，本地可用 `http://localhost:3000`。`BACKEND_URL` 仍用于 API / OAuth 回调，不作为后台页面 Origin。
- 已在旧 API 域名下登记的 Passkey 无法跨 RP 主机名迁移。切换前端域名后，需通过可用的其他认证方式登录，再在新 Origin 重新登记；本站登录页不提供 Passkey 注册管理。
- 身份识别的等待、查询中、未找到账号及匹配成功状态统一显示在表单上方的身份卡片中；用户名输入框通过 `aria-describedby` 关联该区域，不在输入框下重复显示识别提示。
- `/api/owner/allow-login` 确认 Passkey 已配置后自动创建挑战并请求浏览器凭据，支持条件式填充时不阻塞密码输入；不支持时调用系统验证器。手动入口默认隐藏，仅在 Passkey 失败后显示带无障碍名称的低调密钥重试图标，无需先匹配用户名；密码提交时取消等待中的 Passkey，若已在验签则先等待会话写入完成。身份信息切换使用短透明度过渡，错误就近显示。

### 后台数据架构约定

- **目标架构**：后台 CSR 优先，浏览器使用统一 API 客户端直接调用 Rust；登录、Passkey、会话、退出、业务读取与变更均不经过 Next.js Server Actions / Route Handler 转发。App Router 只保留路由、静态元数据与页面外壳，尽量不用 RSC 获取后台业务数据；公共站 SSR/RSC 不受影响。具体约束见 `AGENTS.md` §20.1。
- **同步方式**：业务读取由 SWR（或该功能域既有 TanStack Query）管理，详情、列表、筛选、分页使用一致的资源 key。变更成功后更新或失效所有关联客户端缓存；退出清理受保护缓存，不依赖 `router.refresh()`、页面重载或 Next.js 缓存失效。后端事件和跨标签页会话变化通过同一缓存入口同步，避免多份数据状态长期分叉。
- **直连认证要求**：Cookie 由 Rust 设置与清除；浏览器启用适当的 `credentials`，后端配置精确的凭据 CORS、SameSite / Secure 和 CSRF 防护。生产环境必须 HTTPS，密码仍须先在浏览器加密。不能通过把 token 放入 localStorage 来绕过 Cookie 部署问题。
- **当前实现**：后台已移除旧 Server Action、服务端会话 Cookie 与认证转发模块，使用 SWR 共享 Owner 会话；旧的 Next.js 会话不会自动迁移，需要重新登录。Cookie 变更及登录请求要求精确可信 Origin 和 `X-Requested-With: Neo-Space-Dashboard`，Bearer API 客户端保持原有鉴权。Profile 变更回读聚合资料并更新会话缓存，Rust 通知公共站失效 `user-profile`。真实部署中的 Cookie、Passkey 与数据库写后回读仍须用授权测试账户验收。

### 用户资料设置

- 设置父菜单下的「用户」对应原后台用户设置页。外侧分组复用 shadcn `Collapsible` 与现有 `Button`，图标统一使用项目 `@/lib/inline-icon`；不在内容区重复设置列表。资料页与配置分组共用固定操作栏、字段行、未保存提示和帮助弹层。移动导航继续使用现有 shadcn Drawer。
- 复用 `GET/PATCH /api/user/profile`；基本字段仅提交修改值，社交变更提交完整 `socialIds`，删除平台时显式清空，保留其他平台。保存失败保留输入；保存成功但回读失败时只重试读取，避免重复提交。昵称、用户名及邮箱必填，URL/邮箱在提交前就地校验。头像当前通过 URL 维护，不提供未接入的上传按钮。
- 会话建立与资料读取各有匹配布局的 shadcn `Skeleton`，预留侧栏、头像、字段行、社交区及保存按钮位置；移动端改为单列。后台 401 不会清除公共站独立的 Reader Bearer 会话。

### 其他后台设置

- 外侧「设置」提供 SEO、地址、评论、友链、邮件、第三方登录、AI、搜索、追番及安全十个分组，路由为 `/dashboard/settings/{seo,url,comments,friend-links,mail,oauth,ai,search,bangumi,security}`。设置区按控件语义重建：开关使用 `Switch`，数字输入限宽并紧邻显示单位，多值字段使用可删除标签或逐条列表，服务商使用折叠摘要集合，长说明与部署环境变量收进帮助弹层。
- 浏览器携带 Cookie 直连 Owner options API；集合读取为 `GET /api/options`（不带尾斜杠），单组读取及保存为 `GET/PUT /api/options/{key}`。读取后保留完整分组及未知字段，通过 PUT 保存本组；未配置与显式 `false`、空串保持区别，凭据使用密码输入且不持久化到浏览器存储。
- 草稿按分组保存在内存，切换设置分类不丢失未保存修改，侧栏显示未保存标记；保存只提交当前分组。保存前校验并定位第一个问题字段，服务商集合会自动展开。保存后回读最终值；回读失败保留草稿并只允许重试读取。部署环境覆盖会提示最终生效值可能被替换；多人同时编辑同一分组仍可能覆盖对方修改。
- AI 服务商支持增删、模型分配与引用校验；模型分配明确区分时间胶囊（文章时效性分析）、内容翻译、评论 AI 审核。时间胶囊沿用 `summaryModel` / `enableSummary`，不是独立摘要生成。已移除 `openAiEndpoint`、`openAiPreferredModel`、`openAiKey` 独立接口配置；后端不再读取它们，后台保存 AI 分组时剔除旧值，连接信息统一来自服务商。OAuth 仅维护后端支持的 GitHub / QQ 声明及 GitHub 凭据，enabled 标记不是登录访问控制。安全设置仅包含后端已有桌面令牌。
- 本轮按用户要求未运行浏览器交互、服务联调或真实数据库写入。重构主体完成后曾执行一次 `tsc --noEmit` 并通过；其后的小幅调整未再复检，真实部署中的持久化与服务生效仍需授权验收。



### 友链系统

- 自动健康检查：定时检测友链可用性
- 申请审核：支持友链申请与审核流程
- RSS 订阅：支持友链 RSS Feed
- 技术栈标签：展示友链使用的技术栈

### AI 集成

- 时间胶囊：AI 分析文章时效性，服务商和模型由 `summaryModel` 分配，`enableSummary` 控制启用。
- 内容翻译：后台按目标语言生成内容翻译，使用 `translationModel` 与 `enableTranslation`。
- 评论 AI 反垃圾：直接判断或评分，使用 `commentReviewModel`；在评论设置中同时启用反垃圾和 AI 审核后生效。
- 所有用途统一从 `providers` 获取接口地址与密钥；无服务商时返回配置错误，不再使用独立接口回退。用途模型留空时使用服务商默认模型。原先只配置独立接口的实例需先添加服务商并完成模型分配。

### 搜索功能

- Meilisearch 引擎：极速全文搜索
- 高亮显示：搜索结果关键词高亮
- 多维度搜索：支持文章和日记搜索

---

## 快速开始

### 环境要求

- Node.js >= 22
- pnpm >= 11
- Rust（edition 2024，建议使用 rustup 维护）
- MongoDB >= 7.0
- Meilisearch（可选，用于全文搜索）

### 安装与启动

```bash
# 克隆项目
git clone https://github.com/tnxg/neo-space.git
cd neo-space

# 安装依赖（pnpm workspace 会处理所有 apps 与 packages）
pnpm install

# 配置环境变量
cp .env.example .env                            # 后端 + docker compose（根目录）
cp apps/web/.env.local.example apps/web/.env.local

# 启动全部开发服务（统一调度）
pnpm dev
```

### 环境变量约定

| 文件 | 使用方 | 说明 |
| --- | --- | --- |
| `.env` | `apps/backend`、`docker-compose.yml` | 后端从 `apps/backend` 启动时由 dotenv 向上查找；`PORT` 默认 8000 |
| `apps/web/.env.local` | Next.js | 只读取应用目录，**不会**读取仓库根 `.env`；默认对接 `http://localhost:8000/api` |

- 本地连接共享 / 线上 MongoDB 时，`.env` 必须保留 `ENV_OPTIONS_SYNC=false`：否则启动后会把本地 `FRONTEND_URL`、OAuth、Turnstile 等值写回数据库 `options` 集合，覆盖线上配置。确实要初始化数据库时改用 `cargo run -- --sync-config`。
- `apps/web` 的 `REVALIDATION_SECRET` / `REVALIDATION_SALT` 必须与根 `.env` 完全一致，ISR 刷新才会生效。
- 后端开发脚本依赖 `cargo-watch`：`cargo install cargo-watch`。

### 单独启动某个应用

```bash
pnpm dev:web      # Next.js 前端 (默认 :3000)
pnpm dev:backend  # Rust/Axum 后端 (默认 :8000)
```

### 构建

```bash
pnpm build           # 构建所有应用（Turbo 自动按依赖顺序）
pnpm build:web       # 仅构建前端
pnpm build:backend   # 仅构建 Rust 后端
```

### Docker

仓库提供了两个 compose 文件：

```bash
docker-compose up -d                       # 默认编排
docker-compose -f docker-compose.backend.yml up -d   # 后端 + MongoDB / Meilisearch
```

---

## 项目结构

```
neo-space/
├── apps/
│   ├── web/                 # Next.js 16 前端 (@neo-space/web)
│   │   ├── src/
│   │   │   ├── app/         # App Router
│   │   │   ├── components/  # 组件库
│   │   │   ├── lib/         # 工具库与 api-client
│   │   │   ├── hooks/       # 自定义 Hooks
│   │   │   ├── stores/      # Zustand 状态
│   │   │   ├── types/       # TypeScript 类型
│   │   │   └── actions/     # Server Actions
│   │   └── public/
│   │
│   └── backend/             # Rust/Axum 后端 (@neo-space/backend)
│       ├── src/
│       │   ├── main.rs      # 服务入口
│       │   ├── app.rs       # 应用状态与路由组装
│       │   ├── handlers/    # 请求处理器（auth/post/comment/link/...）
│       │   ├── routes/      # 路由定义
│       │   ├── models/      # 数据模型
│       │   ├── services/    # 业务服务
│       │   ├── tasks/       # 后台任务
│       │   ├── middleware/  # 中间件
│       │   ├── realtime/    # WebSocket 与事件总线
│       │   └── utils/
│       ├── Cargo.toml
│       └── Dockerfile
│
├── packages/
│   └── rich-react/          # 共享富文本 React 组件 (@neo-space/rich-react)
│
├── scripts/                 # 脚本（统一 dev 启动等）
├── turbo.json               # Turborepo 任务编排
├── pnpm-workspace.yaml      # pnpm workspace 定义
├── docker-compose.yml
└── docker-compose.backend.yml
```

---

<a id="技术架构"></a>

## 技术架构

### 整体架构

```
客户端层 (Browser / Mobile / RSS)
    ↓
CDN / 反向代理层 (Nginx / Cloudflare)
    ↓
应用层
    ├── apps/web       Next.js 前端       → 客户端状态 (Zustand)
    └── apps/backend   Rust/Axum 服务     → 服务端缓存 (Moka)
    ↓
数据层
    ├── MongoDB (主数据库)
    ├── Meilisearch (搜索引擎)
    └── External APIs (OpenAI, OAuth)
```

### 技术栈总览

| 层级       | 选型                | 说明                       |
| ---------- | ------------------- | -------------------------- |
| 编排       | Turborepo 2.9       | monorepo 任务调度          |
| 包管理     | pnpm 11             | workspace 依赖管理         |
| 前端框架   | Next.js 16 / React 19 | SSR / SSG               |
| 前端语言   | TypeScript 5.9      | 类型安全                   |
| 前端样式   | Tailwind CSS 4      | 原子化 CSS                 |
| 后端框架   | Axum 0.8            | 异步 Web 框架              |
| 运行时     | Tokio 1.52          | 异步运行时                 |
| 数据库     | MongoDB 7           | 主数据存储                 |
| 搜索       | Meilisearch         | 全文搜索                   |
| 缓存       | Moka 0.12 / SWR     | 后端 + 前端缓存            |
| 实时       | WebSocket + broadcast | 事件订阅推送             |
| 文档       | Utoipa + Swagger UI | OpenAPI 自动生成           |

### 前端 (apps/web)

- **路由**：Next.js App Router，路由组 `(main)` 共享布局
- **状态**：Zustand（auth / theme / search / comment）+ SWR + URL state
- **主题**：CSS 变量驱动，`light / dark / system` 三模式持久化
- **渲染策略**：SSR（首页、文章、分类）/ SSG（RSS）/ CSR（评论、搜索弹窗等）
- **API**：统一通过 `src/lib/api-client.ts` 调用，类型定义在 `src/types/api.ts`
- **响应包装**：所有接口返回 `ApiResponse<T> = { code, status, message, data }`

### 管理能力

- 后端保留内容管理、站点设置、管理员认证与 dashboard overview 等管理 API。
- JWT、密码与 Passkey 认证不随旧面板移除；管理接口继续遵循原有权限校验。
- 新管理 UI 已提供登录与仪表盘外壳，内容管理尚未接入；不再提供旧面板静态资源或开发反代，也无需构建 Vue 应用。
- `packages/rich-react` 保留为独立共享包，不因旧面板移除而删除其组件能力。

### 后端 (apps/backend)

- **AppState**：MongoDB 连接池、Moka 缓存、reqwest 客户端、WebSocket 事件总线、应用配置、Meilisearch 客户端
- **路由**：`Router::nest()` 模块化分组，附带 CORS / Trace / Auth 中间件
- **处理器分层**：缓存检查 → DB 查询 → 缓存写入 → 事件广播 → 前端缓存失效通知
- **后台任务**：`tokio::spawn` 调度
  - 友链健康检查（定时）
  - 网易云音乐播放状态（轮询）
  - Meilisearch 启动时全量同步
- **写后同步**：后台内容变更成功后，显式失效 Moka 缓存、同步 Meilisearch，并通知 Next.js 刷新 ISR
- **OpenAPI**：通过 Utoipa 宏自动生成，Swagger UI 提供交互式文档

---

## 数据模型

### Post (文章)

- 基础：`_id`、`title`、`text`、`slug`、`categoryId`
- 关联：`category`（查询时填充）
- 摘要：`summary`（手动）、`aiSummary`（AI 生成）
- 其他：`tags[]`、`allowComment`、`isPublished`、`copyright`、`images[]`

### Note (日记)

- 基础：`_id`、`nid`（数字 ID）、`title`、`text`
- 情境：`mood`、`weather`、`location`
- 配置：`allowComment`、`isPublished`、`bookmark`

### Comment (评论)

- 基础：`_id`、`ref`、`refType`、`author`、`mail`、`link`
- 内容：`text`（Markdown）
- 状态：`state`（0=未读 / 1=已读 / 2=垃圾 / 3=隐藏）
- 功能：`pin`（置顶）、`isWhispers`（悄悄说）
- 关联：`rid`（回复 ID）、`pid`（父 ID）、`children`
- AI：`aiReply`

### User (用户)

- 基础：`_id`、`username`、`mail`、`role`
- 认证：`password`、`accounts[]`（OAuth）
- 资料：`avatar`、`website`、`bio`

### Link (友链)

- 基础：`_id`、`name`、`url`、`description`、`avatar`
- 状态：`active`、`isPublished`
- 健康：`healthStatus`、`lastChecked`、`responseTime`
- 其他：`techStack[]`、`rss`

### 索引设计

| 集合       | 索引字段                       | 类型      |
| ---------- | ------------------------------ | --------- |
| posts      | slug, categoryId, created      | 唯一/普通 |
| notes      | nid, created                   | 唯一/普通 |
| comments   | ref+refType, rid, created      | 复合/普通 |
| users      | username, accounts.providerId  | 唯一      |
| links      | url, active                    | 唯一/普通 |
| categories | slug, name                     | 唯一      |

---

## API 设计

### 路由结构

```
/api
├── /auth                # OAuth、当前用户、绑定匿名
├── /posts               # 文章 CRUD、slug、相邻文章
├── /notes               # 日记
├── /comments            # 评论
├── /links               # 友链
├── /categories          # 分类
├── /admin               # 管理接口
├── /aggregate/nav       # 导航聚合（recent + categories）
├── /revalidate          # 前端缓存重验证
├── /config              # 站点配置
├── /health              # 健康检查
└── /ws                  # WebSocket
```

### 标准响应

```json
// 成功
{ "code": 200, "status": "success", "message": "操作成功", "data": { } }

// 分页
{
  "code": 200, "status": "success", "message": "获取成功",
  "data": {
    "items": [],
    "pagination": {
      "total": 100, "current_page": 1, "total_page": 10,
      "size": 10, "has_next_page": true, "has_prev_page": false
    }
  }
}

// 错误
{ "code": 400, "status": "failed", "message": "错误描述", "data": null }
```

---

## 实时通信

### 事件类型

| 事件                | 说明             |
| ------------------- | ---------------- |
| comment.created     | 新评论创建       |
| comment.updated     | 评论更新         |
| comment.deleted     | 评论删除         |
| post.created        | 文章发布         |
| post.updated        | 文章更新         |
| link.health_changed | 友链健康状态变化 |

### 实现

- 后端：`tokio::sync::broadcast` 维护全局事件通道，由业务写入和健康检查任务发布事件
- 前端：`useWebSocket` Hook 自动连接 / 重连，结合 SWR 自动刷新缓存与 Toast 通知

---

## 缓存策略

```
L1  Next.js Data Cache         (服务端)
L2  Browser HTTP Cache         (浏览器)
L3  CDN Cache                  (边缘)
L4  Application Cache          (Moka / SWR / Zustand persist)
L5  Database Query Cache       (MongoDB / Meilisearch)
```

**Moka（后端）**：容量 10,000，TTL 5 分钟，TTI 1 分钟，LRU 驱逐。
**SWR（前端）**：去重 5 秒，重试 3 次，保持旧数据，窗口聚焦/网络重连自动重新验证。
**失效**：路径级 (`revalidatePath`)、标签级 (`revalidateTag`)、TTL/TTI 到期、WebSocket 事件触发。

---

## 安全

- **JWT**：HS256，7 天有效期，HttpOnly Cookie
- **CORS**：白名单 `FRONTEND_URL`，允许凭证，预检缓存 1 小时
- **防垃圾评论**：长度检查、链接数限制、敏感词过滤、Cloudflare Turnstile
- **API 防护**：参数化查询、内容净化、SameSite Cookie，可选速率限制

---

## 部署

### Docker 化

- MongoDB 7（ReplicaSet 模式）
- Meilisearch v1.5
- Backend：CI 使用 Rust / musl 编译二进制，Alpine 3.23 运行镜像保留原生 ONNX Runtime；构建和部署不依赖 JavaScript 管理面板产物
- Frontend：Alpine 基础镜像 + `.next` 缓存优化

### 生产架构

```
负载均衡层 (Nginx / AWS ALB)
    ↓
CDN / WAF (Cloudflare)
    ↓
应用集群
    ├── Frontend (Next.js) × N
    └── Backend (Rust/Axum API) × N
    ↓
数据层
    ├── MongoDB ReplicaSet (3 节点)
    └── Meilisearch
```

### 环境变量

- **backend**：MongoDB 连接串、JWT 密钥、OAuth 应用凭证、OpenAI API Key、Meilisearch 配置、`FRONTEND_URL`
- **web**：`NEXT_PUBLIC_API_URL` 等站点配置

---

## 开发与贡献

```bash
pnpm install
pnpm dev               # 同时启动 web / backend 与共享包开发任务
pnpm lint              # 全仓 lint
pnpm typecheck         # 全仓类型检查
```

提交流程：

1. Fork 项目并创建功能分支
2. 提交更改（建议使用约定式提交）
3. 推送并创建 Pull Request

---

## 许可证与致谢

本项目以 **AGPL-3.0** 协议发布，详见 [LICENSE.md](LICENSE.md)。

### 第三方致谢

- **[mx-space/mx-admin](https://github.com/mx-space/mx-admin)** — 已移除的旧 Vue 管理面板曾派生自该项目（AGPL-3.0），版权归原作者所有；本仓库保留对这段历史来源的致谢，任何保留的派生代码仍遵循相应许可。

- 感谢 Next.js、Axum、MongoDB、Meilisearch、Naive UI 等开源项目使本项目成为可能。
