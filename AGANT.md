## Next.js 16 (App Router), React 19, TypeScript 开发规范 (2025)

**角色定位与专业知识：**
作为一名精通 Next.js 16 (App Router)、React 19、TypeScript 的高级开发者，我将专注于生成清晰、可读、高性能的代码，并严格遵循2025年的最新最佳实践。

---

### 1. 项目结构与App Router

- **src/ 根目录结构：** 所有源代码统一放置在 `src/` 目录下，确保代码组织的清晰性和一致性。
- **App Router 优先：** 始终使用 Next.js 16 的 App Router (`src/app/` 目录) 作为核心路由和渲染机制。
- **共置原则 (Colocation)：** 将路由处理程序、加载/错误状态、页面级组件、布局及私有组件共置于 `src/app/` 目录下，与对应路由紧密关联。
- **页面角色明确（解耦核心）：** `page.tsx` **仅作为“编排者” (Orchestrator)**。其职责限制为：1. 获取数据；2. 定义元数据；3. 导入并组装各个组件。**严禁在 `page.tsx` 中编写复杂的 UI 标记或业务逻辑**，必须将其拆分为独立的组件。
- **路由组：** 使用路由组 `()` 组织路由，实现逻辑分组而不影响URL结构。
- **复杂布局：** 通过并行路由 (Parallel Routes) 或拦截路由 (Intercepting Routes) 实现复杂布局和模态框等高级UI模式。
- **组件分类组织：** 共享的、可复用的 UI 组件存放于 `src/components/` 目录，按功能域进行详细分类：
  - `src/components/ui/` - 基础组件
  - `src/components/common/` - 通用组件（如头部、主题切换等）
  - `src/components/layouts/` - 页面级布局组件（按页面功能分类）
  - `src/components/business/` - **业务组件**（封装特定业务逻辑的组件，实际上是/app路由下的客户端组件，保持 page 简洁）
- **共享逻辑/工具：** 通用工具函数、类型定义、常量等共享逻辑按功能域组织：
  - **功能域工具函数 (`@/utils/`)：** 按功能域分类的工具函数统一放置在 `src/utils/` 目录：
    - `@/utils/auth/` - 认证相关工具函数（含客户端 `client.ts`、服务器端 `server.ts` 和共享 `common.ts`）
    - `@/utils/common/` - 通用工具函数（如邮件验证等）
    - `@/utils/afdian/` - 第三方服务集成工具
  - **客户端/服务器分离：** 在同一功能域内，通过明确的文件命名和指令区分：
    - 客户端专用：`client.ts` 文件标记 `"use client"`
    - 服务器专用：`server.ts` 文件标记 `"use server"` 和 `server-only`
    - 共享函数：`common.ts` 或 `index.ts` 文件
  - **核心库函数 (`@/lib/`)：** 核心框架和基础设施相关函数：
    - `@/lib/db.ts` - 数据库操作统一封装（所有数据库操作必须通过此文件调度）
    - `@/lib/constants.ts` - 全局常量定义
    - `@/lib/config.ts` - 配置管理
    - 其他纯服务器端核心函数使用 `server-only` 包强制检查
- **类型定义：** 所有 TypeScript 类型定义按域分类放置在 `src/types/` 目录：
  - `src/types/auth/` - 认证相关类型
  - `src/types/common/` - 通用类型
  - `src/types/database/` - 数据库模型类型
  - `src/types/callback/` - 回调函数类型
- **状态管理：** 使用 Zustand 进行状态管理，状态文件放置在 `src/store/` 目录。
- **自定义 Hooks：** 自定义 React Hooks 放置在 `src/hooks/` 目录。
- **静态资源：** 图像、字体等静态资源放置在 `public/` 目录。
- **全局布局：** 应用的全局布局定义在 `src/app/layout.tsx`。
- **命名约定：**
  - 组件文件：`PascalCase.tsx` (例如 `Button.tsx`, `UserProfile.tsx`)。
  - 目录：`kebab-case` (例如 `user-profile`, `data-display`)。

### 2. 代码风格与TypeScript

- **TypeScript 强制：** 始终使用 TypeScript，并启用严格模式 (`strict: true`)。明确定义类型，**严禁使用 `any`**，优先使用 `unknown` 或更具体的类型。
- **组件类型：** 优先使用 React 19 函数式组件、Hooks 和 Next.js 16 服务器组件。避免使用 `React.FC`。
- **命名约定：**
  - 组件、类、类型 (Type)、接口 (Interface)：`PascalCase` (例如 `UserCard`, `IUserData`)。
  - 变量、函数、Hooks：`camelCase` (例如 `userName`, `fetchPosts`, `useActionState`, `useOptimistic`)。
  - 常量：`SCREAMING_SNAKE_CASE` (例如 `MAX_RETRIES`)。
  - 描述性名称：使用具有描述性的名称，避免无意义的缩写。
- **Props 定义：** 通过接口 (`interface`) 或类型别名 (`type`) 明确定义 props 类型，并在函数签名中进行类型化。明确包含 `children`（如果组件接收子元素）。
- **Ref 处理 (React 19)：** 在函数组件中，将 `ref` 作为常规 prop 进行接收和处理，**避免使用 `forwardRef`**。
- **函数风格：** 优先使用箭头函数 (`=>`)，特别是在回调函数和短函数体场景。
- **括号风格：** 采用 K&R 风格 (左括号不换行)。
- **缩进风格：** 强制使用 2 个空格进行缩进，保持全局一致性。
- **工具链：** 强制使用 ESLint 和 Prettier 进行代码风格和质量检查，并在提交前自动格式化。

### 3. 注释与代码组织

- **函数注释：** 每个函数都必须有明确的 JSDoc 风格注释，说明其功能、参数和返回值。
- **逻辑注释：** 复杂或非直观的逻辑部分需要添加适当的行内注释，解释代码意图和实现方式。
- **分组注释：** 不同功能或逻辑块的代码应使用注释进行适当分组和分隔。
- **结构清晰：** 代码文件的组织结构应该清晰，便于快速理解和维护。
- **封装原则：** 避免使用全局变量。尽量将数据和操作封装在函数或组件内部，遵循单一职责原则。
- **简洁性：** 循环和条件语句保持逻辑简洁，避免嵌套过深（建议不超过三层）。
- **单一职责原则与拆分：** 当组件的逻辑变得复杂或功能过多时，应立即将其拆分为更小、职责单一的子组件或Hooks，以增强可读性和复用性。

### 4. 导入规范

- **导入顺序：**
  1.  Node.js 内置模块 (例如 `path`, `fs`)。
  2.  第三方库 (例如 `react`, `next`, `lodash`)。
  3.  `@/` 绝对路径导入。
  4.  `../` 相对路径导入 (从上级目录)。
  5.  `./` 相对路径导入 (当前目录或子目录)。
  6.  样式文件。
- **路径格式：**
  - **当前目录及子目录：** 只能使用 `./文件名` 或 `./子目录/文件名` 的相对导入。
  - **同一层级或下级目录：** 统一使用 `./` 开头的相对路径，不允许出现 `../`。
  - **层数不高的上级目录：** 统一使用 `../` 开头的相对路径，**避免出现 `../../../` 这类超过两层以上的相对路径**。
  - **跨目录/公共模块：** 统一使用 `@/路径/路径` 绝对路径导入，用于公共模块、全局工具、核心组件等。
- **导入格式：** 优先使用命名导入 `import { Component } from "library"`，避免使用默认导入 `import Component from "library"`，以利于 Tree Shaking 和代码一致性。
- **禁止通配符导入：** 严禁使用 `import * as Library from "library"`，除非特殊场景（如导入大型库的所有内容）。
- **await import：** 尽量避免使用动态导入 (`await import(...)`)，除非用于代码分割或按需加载脚本。

### 5. 服务器组件 (Server Components)

- **角色定位：** **编排者 (Orchestrator)**。`app/` 目录下组件默认是服务器组件，负责从后端 RESTful API 获取数据并组织页面结构。
- **瘦组件原则 (Thin Components)：** **避免**在服务器组件中堆积复杂逻辑。主要职责：1. 调用后端 RESTful API 获取数据；2. 将数据作为 props 下发给子组件（包括客户端组件）。
- **组合模式 (Composition Pattern)：** 优先使用 `children` 或 Slot 模式组合页面结构，减少深层级 Props 传递，**让布局与内容彻底解耦**。
- **数据传递：** 推荐在服务器组件中直接调用 RESTful API 获取数据，再把数据通过 props 提供给客户端组件。客户端组件只处理交互与本地状态，不负责数据获取。
- **限制：** **禁止**服务器组件使用任何客户端 Hook (`useState`, `useEffect`) 或浏览器 API (`window`, `document`)。如需交互，必须拆分为客户端组件。
- **强制检查：** 使用 `server-only` 包保证服务器组件不误导入客户端专属模块（如 UI 事件库）。
- **流式传输/加载：** 通过 `Suspense` 创建边界，实现流式渲染，加速首屏体验。
- **SEO：** 使用 `layout.tsx` 与 `page.tsx` 中的 `generateMetadata` 提供静态或动态 SEO。
- **完全动态：** 若需要完全跳过缓存，可在服务器组件的数据获取逻辑中调用 `unstable_noStore()`，确保每次都从 API 实时拉取数据。

### 6. 客户端组件 (Client Components)

- **明确标记：** 必须在文件顶部明确标记 `"use client"`。
- **职责：** **交互叶子节点**。仅用于包含用户交互（点击、输入）、浏览器特定 API（`window`, `localStorage`）以及使用 React Hooks 的逻辑。**尽量将客户端组件推向组件树的末端**，保持父组件为服务器组件以利于 SEO 和初始加载性能。
- **导航：** 使用 `next/navigation` 提供的 `useRouter`、`usePathname` 等 Hooks，**严禁使用 `next/router`**。
- **表单状态与交互：**
  - 对于涉及数据变更（Mutation）的表单，优先结合 Server Actions 使用 `useFormStatus` 和 `useFormState`。
  - 对于即时性要求极高的交互（如点赞动画、即时搜索），可使用 `useOptimistic` 实现乐观更新。（这类请求直接请求后端而不是通过 Server Actions）
- **数据获取 (Client-Side Fetching)：**
  - **场景：** 仅在需要**实时更新**、**轮询**、**无限滚动**或**用户特定且非 SEO 关键**的数据时，在客户端发起请求。
  - **工具：** **严禁**在 `useEffect` 中手动编写 `fetch` 请求。必须使用 **SWR** 或 **TanStack Query (React Query)** 等库来管理客户端数据获取、缓存和重新验证。
- **限制：** 避免在客户端组件中直接暴露敏感的 API Key。如果 API 需要鉴权且 Token 存储在 HttpOnly Cookie 中，优先考虑通过 Server Components 或 Server Actions 转发请求。

- **明确标记：** 必须在文件顶部明确标记 `"use client"`。
- **职责：** **交互叶子节点**。仅用于包含用户交互（点击、输入）、浏览器特定 API、状态管理 (`useState`, `useEffect`)。**尽量将客户端组件推向组件树的末端**。
- **导航：** 使用 `next/navigation` 提供的 `useRouter`、`usePathname` 等 Hooks。
- **数据获取 (Reads)：**
  - **严禁** 调用 Server Actions 来获取数据。
  - **推荐** 使用 **SWR** 或 **TanStack Query** 在客户端组件中直接请求后端 RESTful API（或通过 Route Handler 代理）。
  - 处理需要实时更新、轮询或与用户浏览器状态（如地理位置）相关的数据。
- **数据提交 (Mutations)：**
  - 依然通过调用 **Server Actions** 来处理表单提交和数据变更，以确保安全性和统一的错误处理。
  - 结合 `useFormStatus` (加载状态) 和 `useFormState` (结果处理) 优化体验。
- **限制：** 避免在客户端组件中硬编码敏感的 API Key。

### 7. 数据获取与缓存策略 (RESTful 架构核心)

- **核心原则：** 严格分离 **读取 (Reads)** 与 **变更 (Mutations)**。Next.js 作为 BFF (Backend for Frontend) 层，负责聚合数据和代理变更。
- **1. 数据获取 (Reads - Server Components)：**
  - **场景：** 页面首屏渲染、SEO 关键内容。
  - **实现：** **必须**在 Server Components 中直接使用 `fetch` 调用后端 RESTful API。
  - **禁止：** **严禁**使用 Server Actions 来获取数据（Server Actions 串行化会导致不必要的性能开销）。
  - **工具封装：** 使用 `@/lib/api-client` 封装 `fetch`，统一处理 Header (如透传 `cookies` 中的 Token) 和 Base URL。

- **2. 数据变更 (Mutations - Server Actions)：**
  - **场景：** 表单提交、状态变更 (POST, PUT, DELETE)。
  - **职责：** **Server Actions 是唯一的变更入口**。
    - 接收前端参数 -> 组装鉴权 Header -> 调用后端 API -> 处理错误 -> 返回结果。
  - **状态刷新：** 变更成功后，**必须**调用 `revalidatePath` 或 `revalidateTag` 清除 Next.js 缓存，驱动页面更新。

- **3. ISR 与缓存控制 (Incremental Static Regeneration)：**
  - **基于时间的 ISR：** 在 Server Components 的 `fetch` 中明确指定缓存时间。
    - `fetch(url, { next: { revalidate: 1800 } })`：每 30分钟 重新生成一次静态页面。
  - **基于标签的缓存 (Tag-based Caching)：** 为 `fetch` 请求添加标签：
    - `fetch(url, { next: { tags: ['posts'] } })`。

- **4. 按需验证接口 (On-Demand Revalidation - 供后端调用)：**
  - **目的：** 当后端数据库发生变化（如 CMS 后台更新文章）时，后端服务需要主动通知 Next.js 刷新缓存，而不是等待时间过期。
  - **实现：** **必须**创建一个 Route Handler (如 `app/api/revalidate/route.ts`)。
    - **安全验证：** 该接口必须校验后端传递的 `Secret Token`，防止恶意刷新。
    - **逻辑：** 接收后端传来的 `tag` 或 `path`，调用 `revalidateTag(tag)` 或 `revalidatePath(path)`。
  - **示例流程：** 后端更新数据 -> 后端 Webhook 调用 Next.js `/api/revalidate` -> Next.js 清除缓存 -> 用户下次访问看到最新数据。

### 8. 代理件与Edge Runtime

- **中间件：** 使用 `proxy.ts` 进行路由拦截、认证、重定向、重写和国际化处理。
- **Edge Runtime：** 优先选择 Edge Runtime (`export const runtime = 'edge'`) 以获得更快的启动时间和更低的延迟，适用于轻量级、I/O 密集型任务。
- **处理：** 在中间件中高效处理 cookies、headers 和动态重写。
- **注意：** 留意 Edge Runtime 的约束，避免使用 Node.js 特有的 API。

### 9. 样式与资产

- **主要样式方案：** **优先且主要使用 Tailwind CSS 工具类** 进行一致性样式设计。
- **自定义 CSS：** 仅在特殊、复杂或 Tailwind 无法直接实现的场景下，才使用自定义 CSS（例如 CSS Modules）。
- **类组织：** 逻辑地组织 Tailwind 类（例如：布局、间距、颜色、排版），遵循原子化设计原则。
- **响应式与状态变体：** 在标记中广泛使用响应式 (`sm:`, `md:`, `lg:`) 和状态变体 (`hover:`, `focus:`, `active:`)
- **暗色模式样式：** **严禁使用 `dark:` 前缀类**，所有颜色通过语义化变量自动适配暗色模式
  - ✅ 正确：`className="bg-background text-foreground hover:bg-accent"`
  - ❌ 错误：`className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white"`
- **指针交互反馈：** **所有交互元素（如按钮、链接、可点击的卡片/图标）必须显式设置 `cursor-pointer`**，确保鼠标悬停时指针变为手型，提供清晰的视觉反馈。
- **统一设计语言：** **强烈依赖 Tailwind 类**，而非内联样式或独立的外部 CSS 文件，以维护统一的设计语言和可维护性。
- **图片优化：** 统一使用内置的 `<Image />` 组件进行图片优化、懒加载和响应式处理。
- **字体优化：** 使用 `@next/font` 或 React 19 新的字体 API 进行字体优化，自动处理字体加载和性能。

### 10. 设计哲学与视觉体系

本文档阐述本站的核心设计哲学与视觉体系，旨在为全站提供统一、沉浸且高度一致的用户体验。

#### 设计哲学：极简通透与 Z 轴纵深感

**核心美学定位**

- **设计目标**：创建一个"轻量、通透、呼吸感"的阅读环境，减少视觉负担，让用户聚焦于内容本身
- **Z 轴层次感**：通过模糊（blur）、透明度（opacity）、圆角、阴影和缩放（scale）的组合，建立清晰的视觉层级，让界面元素在 Z 轴上呈现纵深关系
- **全站一致性价值**：
  - 通过统一的视觉语言（圆角、间距、颜色、动效），让所有页面保持一致的感知
  - 用户在任何页面都能感知到一致的空间感和设计品质，提升品牌认知度

#### 暗色模式与颜色体系

**暗色模式自动化**

- **设计原则**：暗色模式不是"补丁"，而是通过 CSS 变量系统原生支持的同等重要体验
- **强制约束**：严禁使用 `dark:` 前缀类（如 `dark:bg-gray-900`），所有颜色通过语义化变量自动切换
  - 亮色模式：`:root` 选择器定义变量
  - 暗色模式：`.dark` 选择器重新定义变量
  - 组件使用语义化变量（如 `bg-background`、`text-foreground`）即可自动适配
- **全站一致性价值**：
  - 确保亮色/暗色模式下的视觉对比度、可读性保持一致
  - 降低维护成本，避免新组件忘记适配暗色模式
  - 新增页面或组件时，只需使用语义化变量，自动继承全站色彩体系

**双色调色板策略**

- **Primary Scale（Stone 石色）**：作为中性色系，负责背景、文本、边框等基础元素
  - 主背景：`--primary-100`（浅灰），深色模式下反转
  - 主文本：`--primary-900`（深灰），深色模式下反转
- **Accent Scale（Teal 青绿）**：作为品牌色，负责行动点、强调元素、链接等交互元素
  - 主色调：`--accent-600` (#0d9488)
- **语义化变量**：必须且唯一地使用 Shadcn UI 语义映射
  - `--background` / `--foreground`：页面背景与文字
  - `--card` / `--card-foreground`：玻璃感卡片背景与文字
  - `--primary` / `--primary-foreground`：主按钮背景与文字
  - `--secondary` / `--muted`：次要元素
  - `--border` / `--ring`：边框与聚焦光环

#### 圆角体系与视觉语言

**圆角策略**

- **统一原则**：通过圆角的大小和样式，区分不同类型的元素
- **典型应用**：
  - 卡片与主要容器：适度的圆角营造温和、友好的视觉感受
  - 交互元素（按钮、标签）：可通过更圆润的角强化"可点击"的视觉暗示
- **全站一致性价值**：
  - 用户能通过圆角大小快速识别元素类型
  - 统一的圆角语言减少认知负担，提升界面的整体协调性

#### 容器效果与层次感

**Glassmorphism（可选的设计特征）**

- **适用场景**：卡片、导航胶囊、弹窗等需要突出显示的容器元素
- **技术参数**：
  - CSS 属性：`backdrop-filter: blur(8px)` 实现弱模糊
  - 背景色：使用预定义的语义化变量 `--bg-glass`
  - 玻璃卡片组合：`bg-card/30 backdrop-blur-xl border border-border/40`
- **全站一致性价值**：
  - 统一的材质感让用户感知到界面的精致度
  - 通过背景模糊自然建立视觉层级（背景层 < 内容层 < 交互层）

#### 排版与易读性

**阅读体验优先**

- **行高强制要求**：1.6（确保长文阅读的舒适度）
- **对比度最低标准**：4.5:1（WCAG AA 级，确保色弱用户可读）
- **字体单位**：使用 `rem` 或 `em` 而非 `px`，确保可访问性（用户浏览器字号设置生效）
- **全站一致性价值**：
  - 无论用户在文章页、列表页还是独立页面，都能获得一致的阅读体验
  - 建立用户对网站的信任感和专业度认知

#### 布局策略：Mobile First

**核心原则**

- **默认单列布局**：所有页面默认（移动端）采用单列垂直内容流，确保移动端体验优先
- **响应式断点**：仅在 ≥1024px 时才切换到多列布局
- **流式设计**：主内容区严禁使用固定像素宽度，必须使用百分比或 `max-width` 实现自适应
- **全站一致性价值**：
  - 无论在什么设备、什么页面，用户都能预测内容的布局方式
  - 减少因布局不一致导致的困惑和迷失感

**信息层级与视觉引导**

- **一级层级（内容板块）**：使用 `<section>` 标签分隔，通过间距建立清晰的内容区块
- **二级层级（板块标题）**：通过统一的标题样式、图标和边界处理，帮助用户快速定位内容类型
- **三级层级（列表项）**：通过视觉引导元素（如左侧小圆点、虚线分隔），引导视线流动，降低信息密度感
- **全站一致性价值**：
  - 用户在首页、文章列表页、日记列表页等高信息密度页面中，都能快速识别信息层级
  - 统一分隔和引导模式减少学习成本，提升浏览效率

#### 交互模式：非阻断式与 Z 轴动效

**次级界面策略**

- **禁用阻断式弹窗**：严禁使用 `alert()` 或模态弹窗，避免打断用户阅读流
- **次级界面规范**：桌面端使用侧边抽屉，移动端使用底部上滑面板
- **悬停预览**：桌面端列表项悬停时在固定面板显示详情，避免页面跳转
- **全站一致性价值**：
  - 用户在任何页面打开次级界面（如评论、设置、详情预览），都能获得一致的交互体验
  - 非阻断式设计保持用户的阅读心流，提升沉浸感

**Z 轴动效与反馈**

- **背景纵深**：打开新视图时，背景层执行 `scale(0.98)` + `blur(12px)`，创建视觉上的 Z 轴层次
- **动画时长统一**：所有视图切换动画统一为 300ms，使用 `ease-out` 曲线
- **进场动画组合**：模糊 + 缩放 + 透明度 + 位移，营造"从远处飞来"的空间感
- **悬停反馈**：所有可交互元素必须显示 `cursor-pointer`，并通过颜色变化、位移动画提供即时反馈
- **全站一致性价值**：
  - 用户能通过动画风格和时长，预测界面的行为方式
  - 统一的 Z 轴语言让界面感觉"有深度"，提升沉浸感和品质感

**动画库使用（Framer Motion）**

- **进场动画**：模糊 + 缩放 + 透明度组合，延时递增实现列表项依次进场
- **布局动画**：使用 `layoutId` 实现元素在组件间的平滑过渡
- **性能优化**：
  - 使用 `transform` 和 `opacity` 属性（GPU 加速），避免动画 `width/height`
  - 避免在大型列表中为每个元素添加复杂动画

#### 设计系统的可扩展性

**原则而非配方**

- 本文档阐述的是"为什么"和"是什么"（设计原则和视觉语言），而非"怎么做"（具体实现）
- 新增页面或组件时，应遵循上述设计哲学，而非复制粘贴现有组件的代码
- 例如：不说"列表项必须有左侧圆点"，而是说"列表项应通过视觉引导元素帮助用户识别信息层级"

**全站一致性的保障**

- 所有设计决策都应回答：这个选择如何帮助全站保持一致性？
- 新增功能时，应优先考虑复用现有设计模式，而非创造新的视觉语言
- 当现有模式无法满足需求时，应更新本文档，确保新模式成为全站标准

### 11. 性能优化

- **渲染优化：** 使用流式传输 (Streaming) 和 Suspense 加快初始渲染时间。
- **代码分割：** 在客户端组件中动态导入大型依赖 (`React.lazy` 和 `next/dynamic`)，减少初始加载包体积。
- **重渲染优化：** 在客户端组件中，谨慎使用 `React.useMemo` 和 `React.useCallback` 避免不必要的重渲染。
- **数据缓存：** 充分利用 Server Actions 内部的 `fetch` 缓存机制、`revalidate` 选项和 `React.cache` 进行请求去重。
- **客户端包体积：** 避免阻塞主线程，利用代码分割或将逻辑迁移到服务器组件。
- **图像/字体优化：** 使用 Next.js 内置的 `<Image />` 和 `@next/font` 进行优化。

### 12. 工具函数组织架构 (`@/utils/`)

- **功能域优先原则：** 所有工具函数按业务功能域组织在 `@/utils/` 目录下，而非按运行环境分离。
- **文件命名约定：**
  - `client.ts` - 客户端专用函数，必须标记 `"use client"`
  - `server.ts` - 服务器专用函数，必须标记 `"use server"` 和 `import "server-only"`
  - `common.ts` - 客户端/服务器共享的安全函数
  - `index.ts` - 功能域的统一导出入口
- **导入规范：**
  - 优先从功能域统一导入：`import { functionName } from "@/utils/auth"`
  - 避免直接导入具体文件：`import { functionName } from "@/utils/auth/client"`
- **与 `@/lib/` 的分工：**
  - `@/utils/` - 业务功能域的工具函数
  - `@/lib/` - 框架基础设施

### 13. SEO

- **元数据管理：** 统一使用 `generateMetadata` 函数在 `layout.tsx` 或 `page.tsx` 中进行 SEO 元数据管理，包括 `title`、`description`、`og:image` 等。
- **React 19 Head API：** 结合 React 19 的新特性，更灵活地管理 `<head>` 中的 `link` 和 `meta` 标签。
- **SSR/SSG 优势：** 充分利用 Next.js 的 SSR/SSG 能力，确保搜索引擎能抓取到完整的页面内容。
- **语义化 HTML：** 使用语义化 HTML 结构，提高内容可理解性。

### 14. 部署与开发设置

- **部署平台：** 优先考虑 Vercel 进行部署，或自托管 (Node/Docker)。
- **测试：** 彻底测试 SSR 和静态输出，确保在生产环境下的表现一致。
- **环境变量：** 区分客户端 (`NEXT_PUBLIC_`) 和服务器端环境变量，绝不在客户端代码中暴露私有值。
- **静态资产：** 所有静态资源放在 `public/` 目录。
- **工具：** 强制使用 TypeScript、ESLint、Prettier。
- **Monorepo：** 对于大型项目，考虑使用 Pnpm workspaces 或 Turborepo 进行 Monorepo 管理。

### 15. 测试与Linting

- **Linting：** 使用 `next lint` (ESLint) 并紧密集成 Prettier，确保代码质量和风格一致性。
  - 忽略一切tailwindcss相关的类名顺序警告。
- **类型检查：** 强制使用 TypeScript 编译器进行类型检查，确保无类型错误。
- **测试框架：** 优先选择 Jest 结合 React Testing Library 进行单元和集成测试，或 Cypress 进行端到端测试。
- **文件位置：** 测试文件应靠近相关组件或模块，遵循 `*.test.tsx` 或 `*.spec.tsx` 命名约定。
- **覆盖率：** 争取达到高代码覆盖率，特别是核心业务逻辑。

### 16. 路由规范

站内路由强制要求使用约定俗成的路径结构，确保一致性和可预测性。

使用 Nextjs 提供的 Link 组件进行导航，避免硬编码 URL。

> 路由的约定能很大程度保证网站因更换不同前端主题导致 SEO 异常，死链接等问题。

约定如下：

| Path                     | Descrition                      | Mark     |
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

### 17. 最佳实践 (Dos & Don'ts)

- **Do：**
  - **目录结构：** 在 `app` 目录组织路由和组件，严格遵循共置原则 (Co-location)。
  - **渲染策略：** 利用服务器组件 (Server Components) 进行初始渲染和 SEO 数据获取，但**仅作为编排者**，避免在其中编写复杂的业务计算逻辑。
  - **数据变更 (Mutations)：** **强制使用 Server Actions 处理所有数据提交、变更和表单操作**，作为后端 API 的安全代理。
  - **数据获取 (Reads)：**
    - 在服务器组件中：直接使用封装好的 `fetch` 客户端请求后端 API。
    - 在客户端组件中：对于动态数据，使用 **SWR** 或 **TanStack Query**。
  - **架构分层：** **使用组合模式 (Composition)** 构建页面，将具体业务逻辑下沉到 `@/services` 或 `@/lib` 层，Server Actions 和 Components 仅负责调用。
  - **路由与加载：** 使用 `next/link` 进行内部导航；使用 `loading.tsx` 和 `Suspense` 实现流式加载。
  - **边界分离：** 仔细分离服务器和客户端逻辑，利用 `server-only` / `client-only` 包防止代码泄露。
  - **工具函数：** 按功能域组织代码到 `@/utils/`，并通过文件名（如 `date.client.ts`）明确区分运行环境。
  - **UI 规范：**
    - **确保所有交互元素（按钮、链接、卡片）在悬停时显示手型指针 (`cursor-pointer`)。**
    - **保持卡片内部背景统一，确保按钮与背景色有足够对比度（WCAG 标准），避免视觉融合。**
    - 为所有用户交互（加载中、成功、失败）提供即时、明确的 Toast 反馈或 UI 状态变化。
  - **暗色模式规范：**
    - **强制使用语义化颜色变量**（如 `bg-background`、`text-foreground`、`border-border`）
    - **严禁使用 `dark:` 前缀类**（如 `dark:bg-gray-900`），暗色模式自动通过 CSS 变量切换
    - 所有颜色相关的类都必须使用 Shadcn UI 语义变量或定义在 `globals.css` 中的变量
    - 示例：

      ```tsx
      {/* ✅ 正确 */}
      <div className="bg-card text-card-foreground border-border">

      {/* ❌ 错误 */}
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      ```

  - **工程化：** 使用 TypeScript 严格模式；最小化依赖并保持更新。

- **Don't：**
  - **暗色模式反模式：**
    - **严禁**在组件中使用 `dark:` 前缀类（如 `dark:bg-xxx`、`dark:text-xxx`）
    - **严禁**硬编码颜色值（如 `#ffffff`、`rgb(0,0,0)`），必须使用语义化变量
    - **严禁**混合使用 Tailwind 默认颜色（如 `bg-white`、`text-gray-900`）和语义化变量
  - **路由混合：** 混用 `pages` 和 `app` 目录。
  - **上帝组件：** **严禁生成“上帝组件”**（单文件超过 200 行且包含混合逻辑），必须拆分为原子化组件。
  - **数据获取反模式：**
    - **严禁**使用 Server Actions 进行纯数据读取 (GET)，这会增加服务器负担并无法有效利用缓存。
    - **严禁**在客户端组件中使用 `useEffect` + `fetch` 手动请求数据，必须使用 SWR/React Query 等库。
    - **严禁**在 Server Components 中直接硬编码 `fetch` URL 和 Header，必须通过 Service 层调用。
  - **状态管理误区：** **严禁**在表单提交后使用 `router.push` 或 `router.reload` 强制刷新数据，必须依赖 Server Actions 的 `revalidatePath` / `revalidateTag`。
  - **安全风险：**
    - 在客户端代码中暴露敏感环境变量（如 API Secret）。
    - 将包含敏感逻辑的模块导入客户端组件。
  - **遗留代码：** 在 App Router 项目中使用 `next/router` (应使用 `next/navigation`)。
  - **样式滥用：** 滥用自定义 CSS 或内联样式，除非绝对必要且无 Tailwind 替代方案。
  - **过度交互：** 滥用客户端组件 (`"use client"`)，应尽量将其推向组件树的末端，保持父组件为服务器组件。
  - **硬编码：** 硬编码 API 地址、环境变量或在 UI 中滥用 Emoji（应使用图标库）。

### 18. Git 提交规范

所有提交必须遵循以下格式：

```
<type>(<scope>): <description>

[可选的详细描述]
```

#### 类型 (Type)

- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更改
- `style`: 代码格式化（不影响代码运行的变动）
- `refactor`: 重构（既不是新增功能，也不是修改bug的代码变动）
- `perf`: 性能优化
- `test`: 增加测试
- `chore`: 构建过程或辅助工具的变动

#### 范围 (Scope)

范围指明本次提交影响的范围，例如：

- `auth`: 认证相关
- `db`: 数据库相关
- `ui`: 用户界面
- `api`: API接口
- `deps`: 依赖项
