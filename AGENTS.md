# Neo-Space 开发规范 (Monorepo Edition)

本规范覆盖 Turborepo 编排下的三应用 + 一共享包：

- `apps/web` — Next.js 16 (App Router) + React 19 + TypeScript 前端
- `apps/admin` — Vue 3 + Vite + Naive UI 管理后台（派生自 mx-space/mx-admin，AGPL-3.0）
- `apps/backend` — Rust + Axum 后端，构建期通过 `rust-embed` 内联 admin 产物
- `packages/rich-react` — 跨应用共享的富文本 React 组件

> 默认范围：除非明确标注 `[admin]` 或 `[backend]`，本文档其余条款面向 `apps/web` 前端。

---

## 0. API ID Contract（最高契约，必读）

> 任何端到端的不一致，**优先改前端，不要改后端**。

- **主键统一为 `_id`**：本站后端实体主键以 MongoDB 默认的 `_id` 为准（`String`，序列化后即为 ObjectId 文本）。
- **前端禁用 `id` 兜底**：`apps/web` 与 `apps/admin` 在请求 / 提交后端 API 时**必须使用 `_id`**，不允许出现 `entity.id || entity._id` 之类的双轨兼容写法。
- **路由参数名不等于数据字段**：管理后台 URL query 可以继续使用 `?id=<mongo _id>` 作为路由参数名；这里的 `id` 只是 URL 参数名称，不代表 API / 数据模型可以新增或依赖 `id` 字段。
- **响应包装恒定**：所有后端接口统一返回 `ApiResponse<T> = { code: number, status: 'success' | 'failed', message: string, data: T | null }`。
  - SWR / fetch / axios 的泛型必须使用 `ApiResponse<T>`，访问业务数据走 `res.data?.data?.xxx`。
  - 分页结构固定为 `{ items: T[], pagination: { total, current_page, total_page, size, has_next_page, has_prev_page } }`。
- **遇到 `id` / `_id` 不一致时的处置顺序**（不可绕过）：
  1. 修改前端 TypeScript 模型（`src/types/api.ts` / `apps/admin` 同名模型）；
  2. 修改 adapter / 归一化层（如 `apps/admin/src/api/*` 中的 normalizer）；
  3. 修改组件传参与 prop 名称；
  4. 永远不要为了让 admin 跑通而修改后端返回字段。
- **派生字段的边界**：前端组件可以按需派生本地字段（例如把 `_id` 别名为 `key` 给 Naive UI 表格用），但派生只发生在视图层，**离开组件即恢复 `_id`**。

---

## 1. 项目结构与App Router

- **monorepo 根**：所有源码在 `apps/*` 与 `packages/*` 之下，根 `package.json` 仅承载 turbo / pnpm 编排。
- **src/ 根目录结构**：每个 app 内源代码统一放置在 `src/` 目录下，确保代码组织的清晰性和一致性。
- **App Router 优先**：始终使用 Next.js 16 的 App Router (`src/app/` 目录) 作为核心路由和渲染机制。
- **共置原则 (Colocation)**：将路由处理程序、加载/错误状态、页面级组件、布局及私有组件共置于 `src/app/` 目录下，与对应路由紧密关联。
- **页面角色明确（解耦核心）**：`page.tsx` **仅作为"编排者" (Orchestrator)**。其职责限制为：1. 获取数据；2. 定义元数据；3. 导入并组装各个组件。**严禁在 `page.tsx` 中编写复杂的 UI 标记或业务逻辑**，必须将其拆分为独立的组件。
- **路由组**：使用路由组 `()` 组织路由，实现逻辑分组而不影响URL结构。
- **复杂布局**：通过并行路由 (Parallel Routes) 或拦截路由 (Intercepting Routes) 实现复杂布局和模态框等高级UI模式。
- **组件分类组织**：共享的、可复用的 UI 组件存放于 `src/components/` 目录，按功能域进行详细分类：
  - `src/components/ui/` - 基础组件
  - `src/components/common/` - 通用组件（如头部、主题切换等）
  - `src/components/layouts/` - 页面级布局组件（按页面功能分类）
  - `src/components/business/` - **业务组件**（封装特定业务逻辑的组件，实际上是 `/app` 路由下的客户端组件，保持 page 简洁）
- **共享逻辑/工具**：通用工具函数、类型定义、常量等共享逻辑按功能域组织：
  - **功能域工具函数 (`@/utils/`)**：按功能域分类的工具函数统一放置在 `src/utils/` 目录：
    - `@/utils/auth/` - 认证相关工具函数（含客户端 `client.ts`、服务器端 `server.ts` 和共享 `common.ts`）
    - `@/utils/common/` - 通用工具函数（如邮件验证等）
    - `@/utils/afdian/` - 第三方服务集成工具
  - **客户端/服务器分离**：在同一功能域内，通过明确的文件命名和指令区分：
    - 客户端专用：`client.ts` 文件标记 `"use client"`
    - 服务器专用：`server.ts` 文件标记 `"use server"` 和 `server-only`
    - 共享函数：`common.ts` 或 `index.ts` 文件
  - **核心库函数 (`@/lib/`)**：核心框架和基础设施相关函数：
    - `@/lib/api-client.ts` - 后端 API 客户端 + 所有 API 函数
    - `@/lib/constants.ts` - 全局常量定义
    - `@/lib/config.ts` - 配置管理
    - 其他纯服务器端核心函数使用 `server-only` 包强制检查
- **类型定义**：所有 TypeScript 类型定义按域分类放置在 `src/types/` 目录，其中 `src/types/api.ts` 承载所有后端响应类型。
- **状态管理**：使用 Zustand 进行状态管理，状态文件放置在 `src/stores/` 目录。
- **自定义 Hooks**：自定义 React Hooks 放置在 `src/hooks/` 目录。
- **静态资源**：图像、字体等静态资源放置在 `public/` 目录。
- **全局布局**：应用的全局布局定义在 `src/app/layout.tsx`。
- **命名约定**：
  - 组件文件：`PascalCase.tsx` (例如 `Button.tsx`, `UserProfile.tsx`)。
  - 目录：`kebab-case` (例如 `user-profile`, `data-display`)。

### Monorepo 协作纪律

- **跨 app 复用走 `packages/`**：当 React 组件需被 `apps/web` 与 `apps/admin` 复用时，沉淀到 `packages/rich-react`，禁止跨 app 路径相对引用。
- **环境变量分文件**：`apps/web/.env.local` / `apps/backend/.env`，不要在根目录设全局 .env。
- **`pnpm dev` 是统一入口**：背后由 `scripts/dev.mjs` 调度三应用，不要直接 `cd apps/* && pnpm dev` 启动单端，除非你只在调试该 app。

---

## 2. 代码风格与TypeScript

- **TypeScript 强制**：始终使用 TypeScript，并启用严格模式 (`strict: true`)。明确定义类型，**严禁使用 `any`**，优先使用 `unknown` 或更具体的类型。
- **组件类型**：优先使用 React 19 函数式组件、Hooks 和 Next.js 16 服务器组件。避免使用 `React.FC`。
- **命名约定**：
  - 组件、类、类型 (Type)、接口 (Interface)：`PascalCase` (例如 `UserCard`, `IUserData`)。
  - 变量、函数、Hooks：`camelCase` (例如 `userName`, `fetchPosts`, `useActionState`, `useOptimistic`)。
  - 常量：`SCREAMING_SNAKE_CASE` (例如 `MAX_RETRIES`)。
  - 描述性名称：使用具有描述性的名称，避免无意义的缩写。
- **Props 定义**：通过接口 (`interface`) 或类型别名 (`type`) 明确定义 props 类型，并在函数签名中进行类型化。明确包含 `children`（如果组件接收子元素）。
- **Ref 处理 (React 19)**：在函数组件中，将 `ref` 作为常规 prop 进行接收和处理，**避免使用 `forwardRef`**。
- **函数风格**：优先使用箭头函数 (`=>`)，特别是在回调函数和短函数体场景。
- **括号风格**：采用 K&R 风格（左括号不换行）。
- **缩进风格**：强制使用 2 个空格进行缩进，保持全局一致性。
- **工具链**：强制使用 ESLint 和 Prettier 进行代码风格和质量检查，并在提交前自动格式化。

---

## 3. 注释与代码组织

- **函数注释**：每个函数都必须有明确的 JSDoc 风格注释，说明其功能、参数和返回值。
- **逻辑注释**：复杂或非直观的逻辑部分需要添加适当的行内注释，解释代码意图和实现方式。
- **分组注释**：不同功能或逻辑块的代码应使用注释进行适当分组和分隔。
- **结构清晰**：代码文件的组织结构应该清晰，便于快速理解和维护。
- **封装原则**：避免使用全局变量。尽量将数据和操作封装在函数或组件内部，遵循单一职责原则。
- **简洁性**：循环和条件语句保持逻辑简洁，避免嵌套过深（建议不超过三层）。
- **单一职责原则与拆分**：当组件的逻辑变得复杂或功能过多时，应立即将其拆分为更小、职责单一的子组件或Hooks，以增强可读性和复用性。

---

## 4. 导入规范

- **导入顺序**：
  1.  Node.js 内置模块 (例如 `path`, `fs`)。
  2.  第三方库 (例如 `react`, `next`, `lodash`)。
  3.  `@/` 绝对路径导入。
  4.  `../` 相对路径导入 (从上级目录)。
  5.  `./` 相对路径导入 (当前目录或子目录)。
  6.  样式文件。
- **路径格式**：
  - **当前目录及子目录**：只能使用 `./文件名` 或 `./子目录/文件名` 的相对导入。
  - **同一层级或下级目录**：统一使用 `./` 开头的相对路径，不允许出现 `../`。
  - **层数不高的上级目录**：统一使用 `../` 开头的相对路径，**避免出现 `../../../` 这类超过两层以上的相对路径**。
  - **跨目录/公共模块**：统一使用 `@/路径/路径` 绝对路径导入，用于公共模块、全局工具、核心组件等。
  - **跨 app 引用**：仅允许通过 `packages/*` workspace 包名导入（例如 `@neo-space/rich-react`），**严禁** `../../admin/...` 之类的跨 app 相对路径。
- **导入格式**：优先使用命名导入 `import { Component } from "library"`，避免使用默认导入 `import Component from "library"`，以利于 Tree Shaking 和代码一致性。
- **禁止通配符导入**：严禁使用 `import * as Library from "library"`，除非特殊场景（如导入大型库的所有内容）。
- **await import**：尽量避免使用动态导入 (`await import(...)`)，除非用于代码分割或按需加载脚本。

---

## 5. 服务器组件 (Server Components)

- **角色定位**：**编排者 (Orchestrator)**。`app/` 目录下组件默认是服务器组件，负责从后端 RESTful API 获取数据并组织页面结构。
- **瘦组件原则 (Thin Components)**：**避免**在服务器组件中堆积复杂逻辑。主要职责：1. 调用后端 RESTful API 获取数据；2. 将数据作为 props 下发给子组件（包括客户端组件）。
- **组合模式 (Composition Pattern)**：优先使用 `children` 或 Slot 模式组合页面结构，减少深层级 Props 传递，**让布局与内容彻底解耦**。
- **数据传递**：推荐在服务器组件中直接调用 RESTful API 获取数据，再把数据通过 props 提供给客户端组件。客户端组件只处理交互与本地状态，不负责数据获取。
- **限制**：**禁止**服务器组件使用任何客户端 Hook (`useState`, `useEffect`) 或浏览器 API (`window`, `document`)。如需交互，必须拆分为客户端组件。
- **强制检查**：使用 `server-only` 包保证服务器组件不误导入客户端专属模块（如 UI 事件库）。
- **流式传输/加载**：通过 `Suspense` 创建边界，实现流式渲染，加速首屏体验。
- **SEO**：使用 `layout.tsx` 与 `page.tsx` 中的 `generateMetadata` 提供静态或动态 SEO。
- **完全动态**：若需要完全跳过缓存，可在服务器组件的数据获取逻辑中调用 `unstable_noStore()`，确保每次都从 API 实时拉取数据。

---

## 6. 客户端组件 (Client Components)

- **明确标记**：必须在文件顶部明确标记 `"use client"`。
- **职责**：**交互叶子节点**。仅用于包含用户交互（点击、输入）、浏览器特定 API（`window`, `localStorage`）以及使用 React Hooks 的逻辑。**尽量将客户端组件推向组件树的末端**，保持父组件为服务器组件以利于 SEO 和初始加载性能。
- **导航**：使用 `next/navigation` 提供的 `useRouter`、`usePathname` 等 Hooks，**严禁使用 `next/router`**。
- **数据获取 (Reads)**：
  - **严禁** 调用 Server Actions 来获取数据。
  - **严禁**在 `useEffect` 中手动编写 `fetch` 请求。
  - **推荐** 使用 **SWR** 或 **TanStack Query** 在客户端组件中直接请求后端 RESTful API（或通过 Route Handler 代理）。
  - 处理需要实时更新、轮询、无限滚动或与用户浏览器状态（如地理位置）相关的数据。
  - SWR 泛型遵循 §0 契约：`useSWR<ApiResponse<T>>`，业务字段从 `data?.data?.xxx` 取。
- **数据提交 (Mutations)**：
  - 涉及数据变更的表单优先通过 **Server Actions** 提交，结合 `useFormStatus`（加载状态）和 `useFormState`（结果处理）优化体验。
  - 即时性要求极高的交互（如点赞动画、即时搜索）可使用 `useOptimistic` 实现乐观更新——这类请求允许直接打后端而不走 Server Actions。
- **限制**：避免在客户端组件中直接暴露敏感的 API Key。如果 API 需要鉴权且 Token 存储在 HttpOnly Cookie 中，优先考虑通过 Server Components 或 Server Actions 转发请求。

---

## 7. 数据获取与缓存策略 (RESTful 架构核心)

- **核心原则**：严格分离 **读取 (Reads)** 与 **变更 (Mutations)**。Next.js 作为 BFF (Backend for Frontend) 层，负责聚合数据和代理变更。
- **API Base URL**：`process.env.NEXT_PUBLIC_API_URL` || `https://api-blog.tnxg.top/api`。

### 7.1 数据获取 (Reads - Server Components)

- **场景**：页面首屏渲染、SEO 关键内容。
- **实现**：**必须**在 Server Components 中直接使用 `fetch` 调用后端 RESTful API。
- **禁止**：**严禁**使用 Server Actions 来获取数据（Server Actions 串行化会导致不必要的性能开销）。
- **工具封装**：使用 `@/lib/api-client` 封装 `fetch`，统一处理 Header（如透传 `cookies` 中的 Token）和 Base URL。

### 7.2 数据变更 (Mutations - Server Actions)

- **场景**：表单提交、状态变更 (POST, PUT, DELETE)。
- **职责**：**Server Actions 是唯一的变更入口**——接收前端参数 → 组装鉴权 Header → 调用后端 API → 处理错误 → 返回结果。
- **状态刷新**：变更成功后，**必须**调用 `revalidatePath` 或 `revalidateTag` 清除 Next.js 缓存，驱动页面更新。

### 7.3 ISR 与缓存控制

- **基于时间**：`fetch(url, { next: { revalidate: 1800 } })`——每 30 分钟重新生成。
- **基于标签**：`fetch(url, { next: { tags: ['posts'] } })`，方便后端通过 `revalidateTag` 精准失效。

### 7.4 按需验证接口（On-Demand Revalidation）

- **目的**：当后端数据库发生变化（如 admin 更新文章）时，后端服务需要主动通知 Next.js 刷新缓存，而不是等待 TTL 过期。
- **实现**：**必须**创建 Route Handler（如 `app/api/revalidate/route.ts`），校验后端传递的 Secret Token，再调用 `revalidateTag(tag)` 或 `revalidatePath(path)`。
- **示例流程**：后端写库 → 后端调用 `/api/revalidate` → Next.js 清除缓存 → 用户下次访问看到最新数据。

---

## 8. 中间件与Edge Runtime

- **中间件**：使用 `proxy.ts` 进行路由拦截、认证、重定向、重写和国际化处理。
- **Edge Runtime**：优先选择 Edge Runtime (`export const runtime = 'edge'`) 以获得更快的启动时间和更低的延迟，适用于轻量级、I/O 密集型任务。
- **处理**：在中间件中高效处理 cookies、headers 和动态重写。
- **注意**：留意 Edge Runtime 的约束，避免使用 Node.js 特有的 API。

---

## 9. 样式与资产

- **主要样式方案**：**优先且主要使用 Tailwind CSS 工具类**进行一致性样式设计。
- **自定义 CSS**：仅在特殊、复杂或 Tailwind 无法直接实现的场景下，才使用自定义 CSS（例如 CSS Modules）。
- **类组织**：逻辑地组织 Tailwind 类（例如：布局、间距、颜色、排版），遵循原子化设计原则。
- **响应式与状态变体**：在标记中广泛使用响应式 (`sm:`, `md:`, `lg:`) 和状态变体 (`hover:`, `focus:`, `active:`)。
- **暗色模式样式**：**严禁使用 `dark:` 前缀类**，所有颜色通过语义化变量自动适配暗色模式。
  - ✅ 正确：`className="bg-background text-foreground hover:bg-accent"`
  - ❌ 错误：`className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white"`
- **指针交互反馈**：**所有交互元素（如按钮、链接、可点击的卡片/图标）必须显式设置 `cursor-pointer`**，确保鼠标悬停时指针变为手型，提供清晰的视觉反馈。
- **统一设计语言**：**强烈依赖 Tailwind 类**，而非内联样式或独立的外部 CSS 文件，以维护统一的设计语言和可维护性。
- **图片优化**：统一使用内置的 `<Image />` 组件进行图片优化、懒加载和响应式处理。
- **字体优化**：使用 `@next/font` 或 React 19 新的字体 API 进行字体优化，自动处理字体加载和性能。

---

## 10. 设计哲学与视觉体系

本节阐述本站的核心设计哲学与视觉体系，旨在为全站提供统一、沉浸且高度一致的用户体验。

### 10.1 设计哲学：极简通透与 Z 轴纵深感

**核心美学定位**

- **设计目标**：创建一个"轻量、通透、呼吸感"的阅读环境，减少视觉负担，让用户聚焦于内容本身。
- **Z 轴层次感**：通过模糊（blur）、透明度（opacity）、圆角、阴影和缩放（scale）的组合，建立清晰的视觉层级，让界面元素在 Z 轴上呈现纵深关系。
- **全站一致性价值**：通过统一的视觉语言（圆角、间距、颜色、动效），让所有页面保持一致的感知；用户在任何页面都能感知到一致的空间感和设计品质，提升品牌认知度。

### 10.2 暗色模式与颜色体系

**暗色模式自动化**

- **设计原则**：暗色模式不是"补丁"，而是通过 CSS 变量系统原生支持的同等重要体验。
- **强制约束**：严禁使用 `dark:` 前缀类（如 `dark:bg-gray-900`），所有颜色通过语义化变量自动切换。
  - 亮色模式：`:root` 选择器定义变量
  - 暗色模式：`.dark` 选择器重新定义变量
  - 组件使用语义化变量（如 `bg-background`、`text-foreground`）即可自动适配
- **全站一致性价值**：确保亮色/暗色模式下的视觉对比度、可读性保持一致；降低维护成本，避免新组件忘记适配暗色模式。

**双色调色板策略**

- **Primary Scale（Stone 石色）**：作为中性色系，负责背景、文本、边框等基础元素。
- **Accent Scale（Teal 青绿）**：作为品牌色，负责行动点、强调元素、链接等交互元素，主色调 `--accent-600` (#0d9488)。
- **语义化变量**：必须且唯一地使用 Shadcn UI 语义映射——`--background` / `--foreground`、`--card` / `--card-foreground`、`--primary` / `--primary-foreground`、`--secondary` / `--muted`、`--border` / `--ring`。

### 10.3 圆角体系与视觉语言

- **统一原则**：通过圆角的大小和样式，区分不同类型的元素。
- **典型应用**：卡片与主要容器使用适度的圆角；交互元素（按钮、标签）可通过更圆润的角强化"可点击"暗示。
- **全站一致性价值**：用户能通过圆角大小快速识别元素类型，统一的圆角语言降低认知负担。

### 10.4 容器效果与层次感

**Glassmorphism（可选的设计特征）**

- **适用场景**：卡片、导航胶囊、弹窗等需要突出显示的容器元素。
- **技术参数**：`backdrop-filter: blur(8px)`；玻璃卡片组合 `bg-card/30 backdrop-blur-xl border border-border/40`。
- **全站一致性价值**：统一的材质感让用户感知到界面的精致度，通过背景模糊自然建立视觉层级（背景层 < 内容层 < 交互层）。

### 10.5 排版与易读性

- **行高强制要求**：1.6（确保长文阅读的舒适度）。
- **对比度最低标准**：4.5:1（WCAG AA 级）。
- **字体单位**：使用 `rem` 或 `em` 而非 `px`，确保用户浏览器字号设置生效。

### 10.6 布局策略：Mobile First

- **默认单列布局**：所有页面默认（移动端）采用单列垂直内容流。
- **响应式断点**：仅在 ≥1024px 时才切换到多列布局。
- **流式设计**：主内容区严禁使用固定像素宽度，必须使用百分比或 `max-width` 实现自适应。

**信息层级与视觉引导**

- **一级层级（内容板块）**：使用 `<section>` 标签分隔。
- **二级层级（板块标题）**：通过统一的标题样式、图标和边界处理。
- **三级层级（列表项）**：通过视觉引导元素（如左侧小圆点、虚线分隔）引导视线流动。

### 10.7 交互模式：非阻断式与 Z 轴动效

**次级界面策略**

- **禁用阻断式弹窗**：严禁使用 `alert()` 或模态弹窗。
- **次级界面规范**：桌面端使用侧边抽屉，移动端使用底部上滑面板。
- **悬停预览**：桌面端列表项悬停时在固定面板显示详情，避免页面跳转。

**Z 轴动效与反馈**

- **背景纵深**：打开新视图时，背景层执行 `scale(0.98)` + `blur(12px)`。
- **动画时长统一**：所有视图切换动画统一为 300ms，使用 `ease-out` 曲线。
- **进场动画组合**：模糊 + 缩放 + 透明度 + 位移，营造"从远处飞来"的空间感。
- **悬停反馈**：所有可交互元素必须显示 `cursor-pointer`，并通过颜色变化、位移动画提供即时反馈。

**动画库使用（Framer Motion）**

- **进场动画**：模糊 + 缩放 + 透明度组合，延时递增实现列表项依次进场。
- **布局动画**：使用 `layoutId` 实现元素在组件间的平滑过渡。
- **性能优化**：使用 `transform` 和 `opacity` 属性（GPU 加速），避免动画 `width/height`；避免在大型列表中为每个元素添加复杂动画。

### 10.8 设计系统的可扩展性

- 本节阐述的是"为什么"和"是什么"（设计原则和视觉语言），而非"怎么做"（具体实现）。
- 新增页面或组件时，应遵循上述设计哲学，而非复制粘贴现有组件的代码。
- 所有设计决策都应回答：这个选择如何帮助全站保持一致性？当现有模式无法满足需求时，应更新本文档。

---

## 11. 性能优化

- **渲染优化**：使用流式传输 (Streaming) 和 Suspense 加快初始渲染时间。
- **代码分割**：在客户端组件中动态导入大型依赖 (`React.lazy` 和 `next/dynamic`)，减少初始加载包体积。
- **重渲染优化**：在客户端组件中，谨慎使用 `React.useMemo` 和 `React.useCallback` 避免不必要的重渲染。
- **数据缓存**：充分利用 Server Actions 内部的 `fetch` 缓存机制、`revalidate` 选项和 `React.cache` 进行请求去重。
- **客户端包体积**：避免阻塞主线程，利用代码分割或将逻辑迁移到服务器组件。
- **图像/字体优化**：使用 Next.js 内置的 `<Image />` 和 `@next/font` 进行优化。

---

## 12. 工具函数组织架构 (`@/utils/`)

- **功能域优先原则**：所有工具函数按业务功能域组织在 `@/utils/` 目录下，而非按运行环境分离。
- **文件命名约定**：
  - `client.ts` - 客户端专用函数，必须标记 `"use client"`
  - `server.ts` - 服务器专用函数，必须标记 `"use server"` 和 `import "server-only"`
  - `common.ts` - 客户端/服务器共享的安全函数
  - `index.ts` - 功能域的统一导出入口
- **导入规范**：
  - 优先从功能域统一导入：`import { functionName } from "@/utils/auth"`
  - 避免直接导入具体文件：`import { functionName } from "@/utils/auth/client"`
- **与 `@/lib/` 的分工**：
  - `@/utils/` - 业务功能域的工具函数
  - `@/lib/` - 框架基础设施（含 `api-client.ts`）

---

## 13. SEO

- **元数据管理**：统一使用 `generateMetadata` 函数在 `layout.tsx` 或 `page.tsx` 中进行 SEO 元数据管理，包括 `title`、`description`、`og:image` 等。
- **React 19 Head API**：结合 React 19 的新特性，更灵活地管理 `<head>` 中的 `link` 和 `meta` 标签。
- **SSR/SSG 优势**：充分利用 Next.js 的 SSR/SSG 能力，确保搜索引擎能抓取到完整的页面内容。
- **语义化 HTML**：使用语义化 HTML 结构，提高内容可理解性。

---

## 14. 部署与开发设置

- **部署平台**：Vercel（前端）或自托管（Node / Docker）；后端走 `apps/backend/Dockerfile` 多阶段构建。
- **测试**：彻底测试 SSR 和静态输出，确保在生产环境下的表现一致。
- **环境变量**：区分客户端 (`NEXT_PUBLIC_`) 和服务器端环境变量，绝不在客户端代码中暴露私有值。
- **静态资产**：所有静态资源放在 `public/` 目录。
- **工具**：强制使用 TypeScript、ESLint、Prettier。
- **Monorepo**：本仓库使用 pnpm workspaces + Turborepo 2.9 编排，构建顺序由 `turbo.json` 描述。

---

## 15. 测试与Linting

- **Linting**：使用 `next lint` (ESLint) 并紧密集成 Prettier，确保代码质量和风格一致性。忽略一切 tailwindcss 相关的类名顺序警告。
- **类型检查**：强制使用 TypeScript 编译器进行类型检查，确保无类型错误。`pnpm typecheck` 一键覆盖全 monorepo。
- **测试框架**：优先选择 Jest 结合 React Testing Library 进行单元和集成测试，或 Cypress 进行端到端测试。
- **文件位置**：测试文件应靠近相关组件或模块，遵循 `*.test.tsx` 或 `*.spec.tsx` 命名约定。
- **覆盖率**：争取达到高代码覆盖率，特别是核心业务逻辑。

---

## 16. 路由规范

站内路由强制要求使用约定俗成的路径结构，确保一致性和可预测性。

使用 Next.js 提供的 `Link` 组件进行导航，避免硬编码 URL。

> 路由的约定能很大程度保证网站因更换不同前端主题导致 SEO 异常、死链接等问题。

| Path                     | Description                     | Mark     |
| ------------------------ | ------------------------------- | -------- |
| `/`                      | 主页                            | 强制要求 |
| `/posts`                 | 博文列表                        | 强制要求 |
| `/posts/:category/:slug` | 博文详情页                      | 强制要求 |
| `/pages/:slug`           | 独立页面详情页                  | 强制要求 |
| `/notes/:nid`            | 日记详情页                      | 强制要求 |
| `/feed`                  | RSS 订阅                        | 强制要求 |
| `/:category/:slug`       | 302 -> `/posts/:category/:slug` | 建议     |
| `/category/:slug`        | 分类中文章列表页                | 建议     |
| `/notes`                 | 日记列表或者跳转最新日记页      | 建议     |
| `/notes/latest`          | 最新日记详情页                  | 建议     |
| `/friends`               | 友链                            | 建议     |
| `/says`                  | 一言详情页                      | 可选     |
| `/sitemap`               | 站点地图                        | 建议     |
| `/timeline`              | 时间线                          | 可选     |
| `/recently`              | 动态页                          | 可选     |
| `/favorite/:type`        | 附加页                          | 可选     |
| `/projects`              | 项目页                          | 可选     |
| `/projects/:id`          | 项目详情页                      | 可选     |

---

## 17. 最佳实践 (Dos & Don'ts)

### Do

- **目录结构**：在 `app` 目录组织路由和组件，严格遵循共置原则。
- **渲染策略**：利用服务器组件进行初始渲染和 SEO 数据获取，但**仅作为编排者**，避免在其中编写复杂的业务计算逻辑。
- **数据变更 (Mutations)**：**强制使用 Server Actions 处理所有数据提交、变更和表单操作**，作为后端 API 的安全代理。
- **数据获取 (Reads)**：服务器组件用 `@/lib/api-client`；客户端组件用 SWR / TanStack Query。
- **架构分层**：**使用组合模式**构建页面，将具体业务逻辑下沉到 `@/services` 或 `@/lib` 层。
- **路由与加载**：使用 `next/link` 进行内部导航；使用 `loading.tsx` 和 `Suspense` 实现流式加载。
- **边界分离**：仔细分离服务器和客户端逻辑，利用 `server-only` / `client-only` 包防止代码泄露。
- **工具函数**：按功能域组织代码到 `@/utils/`，并通过文件名（`client.ts` / `server.ts` / `common.ts`）明确区分运行环境。
- **UI 规范**：
  - 确保所有交互元素（按钮、链接、卡片）在悬停时显示手型指针 (`cursor-pointer`)。
  - 保持卡片内部背景统一，确保按钮与背景色有足够对比度（WCAG 标准），避免视觉融合。
  - 为所有用户交互（加载中、成功、失败）提供即时、明确的 Toast 反馈或 UI 状态变化。
- **暗色模式规范**：
  - **强制使用语义化颜色变量**（如 `bg-background`、`text-foreground`、`border-border`）。
  - **严禁使用 `dark:` 前缀类**（如 `dark:bg-gray-900`），暗色模式自动通过 CSS 变量切换。
  - 所有颜色相关的类都必须使用 Shadcn UI 语义变量或定义在 `globals.css` 中的变量。

  ```tsx
  {/* ✅ 正确 */}
  <div className="bg-card text-card-foreground border-border">

  {/* ❌ 错误 */}
  <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  ```

- **工程化**：使用 TypeScript 严格模式；最小化依赖并保持更新。

### Don't

- **暗色模式反模式**：
  - 严禁在组件中使用 `dark:` 前缀类（如 `dark:bg-xxx`、`dark:text-xxx`）。
  - 严禁硬编码颜色值（如 `#ffffff`、`rgb(0,0,0)`），必须使用语义化变量。
  - 严禁混合使用 Tailwind 默认颜色（如 `bg-white`、`text-gray-900`）和语义化变量。
- **路由混合**：混用 `pages` 和 `app` 目录。
- **上帝组件**：**严禁生成"上帝组件"**（单文件超过 200 行且包含混合逻辑），必须拆分为原子化组件。
- **数据获取反模式**：
  - 严禁使用 Server Actions 进行纯数据读取 (GET)。
  - 严禁在客户端组件中使用 `useEffect` + `fetch` 手动请求数据。
  - 严禁在 Server Components 中直接硬编码 `fetch` URL 和 Header，必须通过 Service 层调用。
- **状态管理误区**：严禁在表单提交后使用 `router.push` 或 `router.reload` 强制刷新数据，必须依赖 Server Actions 的 `revalidatePath` / `revalidateTag`。
- **API ID 兜底**：严禁出现 `entity.id || entity._id` 之类的双轨兼容写法（参见 §0）。
- **安全风险**：在客户端代码中暴露敏感环境变量；将包含敏感逻辑的模块导入客户端组件。
- **遗留代码**：在 App Router 项目中使用 `next/router`（应使用 `next/navigation`）。
- **样式滥用**：滥用自定义 CSS 或内联样式，除非绝对必要且无 Tailwind 替代方案。
- **过度交互**：滥用客户端组件 (`"use client"`)，应尽量将其推向组件树的末端。
- **硬编码**：硬编码 API 地址、环境变量或在 UI 中滥用 Emoji（应使用图标库）。

---

## 18. Git 提交规范

所有提交必须遵循以下格式：

```
<type>(<scope>): <description>

[可选的详细描述]
```

**类型 (Type)**

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更改
- `style`: 代码格式化（不影响代码运行的变动）
- `refactor`: 重构（既不是新增功能，也不是修改 bug 的代码变动）
- `perf`: 性能优化
- `test`: 增加测试
- `chore`: 构建过程或辅助工具的变动

**范围 (Scope)**

范围指明本次提交影响的范围，例如：

- `auth` / `db` / `ui` / `api` / `deps`
- monorepo 范围下也可使用 app 名 — `web` / `admin` / `backend` / `rich-react`

---

## 19. [backend] Rust 后端规范

> 本节仅约束 `apps/backend`。Rust 端不遵守 §1–§17 的前端规范，但需配合 §0 API ID Contract 与 §7 缓存约定。

### 19.1 单文件长度上限：350 行

- **硬性上限**：`apps/backend/src/**/*.rs` **单文件不得超过 350 行**（含注释，不含空行可放宽到 380 行作为短期缓冲）。
- **超限处置**：当文件接近上限时，必须按职责拆分到子模块（例：`handlers/post.rs` → `handlers/post/{mod, list, detail, mutate}.rs`）。
- **典型拆分维度**：
  - `handlers/<entity>/` — 按动作（list / detail / create / update / delete）拆。
  - `services/<domain>/` — 按子领域（如 `comment/{tree, spam, notify}`）拆。
  - `models/` — 按集合（collection）拆，禁止把多个实体堆在一个文件里。
- **现状基线**：`services/helpers.rs`、`handlers/note.rs`、`handlers/comment.rs` 等已逼近上限，新功能进入这些文件前**必须先拆分再添加**。

### 19.2 模块组织

- **`handlers/`** — HTTP 入口，仅做参数解析、调用 service、组装 `ApiResponse<T>`。**禁止**在 handler 里写 MongoDB 查询语句。
- **`routes/`** — 仅承载 `Router::nest()` 与中间件挂载，不写业务逻辑。
- **`services/`** — 业务规则、缓存读写、事件广播。
- **`models/`** — Mongo 文档结构体（`#[derive(Serialize, Deserialize)]`）；主键字段命名必须为 `_id`，对应 Rust 字段加 `#[serde(rename = "_id")]`。
- **`tasks/`** — `tokio::spawn` 调度的后台任务（友链健康检查、Change Stream 监听等）。
- **`realtime/`** — WebSocket 与 `tokio::sync::broadcast` 事件总线。
- **`middleware/` / `auth/` / `external/` / `config/`** — 中间件、认证、第三方集成、配置加载。

### 19.3 响应与错误

- **统一响应**：所有 handler 返回 `ApiResponse<T>`，分页固定为 §0 定义的 `pagination` 结构。
- **错误**：通过 `error.rs` 中的 `AppError` 转换；禁止在 handler 内手写 `(StatusCode::xxx, Json(json!({...})))`。
- **OpenAPI**：通过 Utoipa 宏自动生成 schema，新增 handler 必须挂 `#[utoipa::path(...)]`。

### 19.4 缓存与事件

- **Moka**：容量 10,000，TTL 5 分钟，TTI 1 分钟。读路径执行 `缓存命中 → 直接返回 / 未命中 → DB → 写缓存`。
- **写后失效**：变更操作完成后必须：1）失效相关 Moka key；2）通过 `broadcast` 推送事件；3）必要时调用前端 `/api/revalidate`。
- **事件命名**：`<entity>.<action>`，例如 `comment.created`、`post.updated`、`link.health_changed`。

---

## 20. [admin] Vue 3 后台规范

> 本节仅约束 `apps/admin`。原项目派生自 `mx-space/mx-admin`，保留其大部分约定，但需要按本仓适配。

- **API 适配优先级**：遵守 §0——遇到字段不一致时改 `apps/admin/src/api/*` 的 normalizer / 模型，不要改后端。
- **登录与鉴权**：admin 通过后端 JWT 通道登录（参见提交 `1f1d3be`），HttpOnly Cookie + 鉴权中间件由后端统一处理。
- **新增模块**：保持 mx-admin 原有目录结构（`views/` / `components/` / `store/` / `utils/`），不要把 Vue 风格的目录搬进 `apps/web`。
- **构建产物**：`pnpm build:admin` 输出至 `apps/admin/dist`，由 `apps/backend` 通过 `rust-embed` 内联进二进制；上线时无需独立部署 admin。

---

## 21. 速查表

| 我要做的事                          | 看哪节            |
| ----------------------------------- | ----------------- |
| 后端给我返回 `id` / `_id` 不一致     | §0                |
| 给前端加新页面                      | §1, §5, §7        |
| 加客户端交互组件                    | §6                |
| 调后端 API（读）                    | §7.1              |
| 提交表单 / 写数据                   | §7.2              |
| 后端写完要刷新前端缓存              | §7.4              |
| 写样式 / 暗色适配                   | §9, §10.2, §17    |
| Rust 单文件快超 350 行              | §19.1             |
| 给 admin 加接口对接                 | §0, §20           |
| 提交代码                            | §18               |
