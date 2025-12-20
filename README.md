# Neo Space (Tnxg Blog) - 真实技术实现文档

Neo Space 是一个基于 **Next.js 16 (App Router)** 与 **Rust (Rocket)** 的现代化、高性能个人数字花园。本项目在设计上追求极致的 Glassmorphism (磨砂玻璃) 视觉效果，在技术上通过 RSC (React Server Components) 与 Rust 异步后端提供流畅的阅读体验。

> [!IMPORTANT]
> 本文档描述的是项目中**已完成的实际功能**，而非规划中的愿景。

## � 核心技术架构

### 前端 (Next.js 16 + React 19)

- **渲染策略**: 全面采用 App Router 模型。首页、文章页等主要页面均为 **Server Components**，实现高效的服务器端渲染与数据获取。
- **设计系统**:
  - **Tailwind CSS v4**: 构建了完整的语义化设计系统，使用 OKLCH 色彩空间定义主题色。
  - **Glassmorphism**: 深度定制的磨砂玻璃 UI（`backdrop-blur-sm`, `bg-glass`），具有 Z 轴纵深感的视觉层叠效果。
- **状态管理**: 客户端状态由 **Zustand** 驱动。
- **动效**: 使用 **Framer Motion** 实现平滑的页面切换与微交互。

### 后端 (Rust + Rocket v0.5)

- **高性能基础**: 基于 **Rust** 编写，使用 **Rocket** 框架。异步 I/O (Tokio) 确保了请求响应的高并发处理能力。
- **数据存储**: **MongoDB**。通过 `mongodb` 官方驱动与 Rust 类型系统集成，实现强类型的数据映射。
- **API 范式**: 标准的 RESTful 架构，所有接口统一使用 JSON 格式。

## 🔌 API 接口与数据模型 (当前已实现)

后端所有 API 挂载在 `/api` 路径下，采用统一的响应封包：
`{ "code": 200, "status": "success", "message": "...", "data": T }`

### 1. 内容模块 (Posts & Notes)

项目区分了 **博文 (Posts)** 与 **手记 (Notes/Micro-blog)** 两种内容形式。

- **文章接口**:
  - `GET /api/posts`: 获取博文列表（内置分页支持）。
  - `GET /api/posts/:id`: 按 ID 获取博文。
  - `GET /api/posts/slug/:slug`: 按 Slug 获取博文，自动聚合分类详情。
  - `GET /api/posts/slug/:slug/adjacent`: 获取当前文章的前后篇信息。
- **手记接口**:
  - `GET /api/notes`: 获取手记列表。
  - `GET /api/notes/nid/:nid`: 按数字 ID (nid) 获取手记。
  - `GET /api/notes/nid/:nid/adjacent`: 获取当前手记的前后篇。

### 2. AI 增强功能

后端集成了基于 OpenAI 协议的 AI 能力，并实现了结果持久化。

- **AI 摘要 (AI Summary)**:
  - 文章与手记详情接口会根据 `refId` 自动从 `ai_summaries` 集合中匹配并注入摘要内容。
- **时效性分析仪 (Time Capsule)**:
  - `POST /api/ai/time-capsule`: 动态分析文章内容的时效性风险。
    - 逻辑：计算标题+内容的 SHA1 哈希值。哈希匹配则返回 MongoDB 缓存结果；否则调用 AI 生成分析报告并持久化。
  - `GET /api/ai/time-capsule/:ref_id`: 直接获取现有的分析记录。

### 3. 特色实用工具

- **你能不能好好说话 (nbnhhsh)**:
  - `POST /api/nbnhhsh/guess`: 后端代理请求。用于解析并猜测网络缩写词，提升阅读体验。
- **站点配置**:
  - `GET /api/config`: 从 MongoDB `options` 集合中聚合 SEO、友链、评论开关、OAuth 等分项配置。已实现**字段脱敏**，仅暴露前端必要的公开字段。

## 📝 Markdown 渲染规范

前端 `MarkdownRenderer.tsx` 针对多种复杂场景进行了深度适配：

| 特性                   | 实现方式/说明                                                       |
| :--------------------- | :------------------------------------------------------------------ |
| **代码高亮**           | 基于 Shiki (Highlighter) 的服务器端组件驱动，支持多语言与暗色模式。 |
| **Mermaid**            | 通过 `remarkMermaid` 插件支持流程图、时序图渲染。                   |
| **容器组件**           | 自定义 `::: container` 语法，支持特定的 UI 块布局。                 |
| **模糊遮盖 (Spoiler)** | 支持 `!!spoiler!!` 语法，点击可见。                                 |
| **名词解析**           | 集成 `AbbreviationText` 自动匹配并解析 nbnhhsh 缩写。               |

## 📂 项目目录结构 ( As-Is )

```bash
├── src/                    # Next.js 前端源码 (TSX)
│   ├── app/                # App Router 路由 (Server/Client 分离)
│   ├── components/         # 组件库
│   │   ├── business/       # 业务逻辑组件 (PostPreview, NoteItem 等)
│   │   ├── common/         # Markdown 渲染器、布局基石
│   │   └── ui/             # 原子级 UI 组件 (Tooltip, Button 等)
│   ├── lib/                # 前端核心工具 (API 封装)
│   └── types/              # 严格的 API/业务类型定义
├── backend/                # Rust 后端源码
│   ├── src/
│   │   ├── models/         # Serde 驱动的数据解构 (serde-json / bson)
│   │   ├── routes/         # 业务路由处理 (Posts, AI, User 等)
│   │   ├── services/       # 基础设施驱动 (MongoDB、AI Service)
│   │   └── utils/          # 序列化、哈希等工具函数
│   └── Cargo.toml          # Rust 依赖声明 (Rocket 0.5, tokio, bson, async-openai)
├── scripts/                # 构建与开发自动化脚本 (dev.sh)
└── Rocket.toml             # 后端环境与数据库配置
```

## � 开发环境搭建

1. **一键安装后端关键二进制与前端依赖**:
   ```bash
   ./scripts/dev.sh install
   ```
2. **前后端并行启动**:
   ```bash
   ./scripts/dev.sh start
   ```
   _注意：将同时监听 3000 (Next.js) 与 8000 (Rust) 端口。_

---

© 2025 Neo Space | 坚持真实文档，拒绝虚构功能。
