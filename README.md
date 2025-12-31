# 🚀 Neo-Space

🎯 **Neo-Space** 是一个基于 Next.js 16 和 Rust (Rocket) 构建的现代化全栈博客系统，旨在提供极致的性能与优雅的交互体验。

## 🌟 核心特性

1.  **现代化技术栈**：前端采用 Next.js 16 (React 19) + Tailwind CSS 4，后端由 Rust (Rocket) 提供高性能支持
2.  **极速交互**：利用 Next.js 的服务端渲染 (SSR) 与静态生成 (SSG)，配合 Rust 后端的毫秒级响应
3.  **多功能集成**：
    -   📝 支持 Markdown 渲染，内置 KaTeX 数学公式、Mermaid 图表、代码高亮等
    -   💬 完善的评论系统，支持 OAuth 登录（GitHub/QQ）
    -   🖼️ 图片画廊与 EXIF 信息展示
    -   🤖 AI 摘要与自动回复集成
4.  **优雅 UI**：基于 Motion 的动效与精心设计的暗色模式支持
5.  **容器化部署**：支持 Docker & Docker Compose 一键部署

## 🛠️ 技术栈

**前端 (Frontend)**

-   **框架**: [Next.js 16](https://nextjs.org/) (App Router)
-   **UI**: [Tailwind CSS 4](https://tailwindcss.com/), [Motion](https://motion.dev/), [Radix UI](https://www.radix-ui.com/)
-   **状态管理**: [Zustand](https://github.com/pmndrs/zustand), [SWR](https://swr.vercel.app/)
-   **编辑器/渲染**: [React Markdown](https://github.com/remarkjs/react-markdown), [Shiki](https://shiki.style/)

**后端 (Backend)**

-   **语言**: [Rust](https://www.rust-lang.org/)
-   **框架**: [Rocket 0.5](https://rocket.rs/)
-   **数据库**: [MongoDB](https://www.mongodb.com/)
-   **文档**: [Utoipa](https://github.com/juhaku/utoipa) (OpenAPI/Swagger)

## 📦 快速开始

### 环境依赖

-   [Rust](https://www.rust-lang.org/) (开发后端)
-   [Docker](https://www.docker.com/) & Docker Compose

### 本地开发

1.  **克隆项目**
    ```bash
    git clone https://github.com/tnxg/neo-space.git
    cd neo-space
    ```

2.  **启动前端**
    ```bash
    bun install
    bun run dev
    ```

3.  **启动后端**
    ```bash
    cd backend
    cargo run
    ```

### 生产部署

推荐使用 Docker Compose 进行一键部署：

```bash
docker-compose up -d
```

> 💡 **提示**：部署前请参考 `docker-compose.yml` 中的环境变量配置相关 Secret。

## 📂 项目结构

```plaintext
.
├── backend/            # Rust 后端源代码
├── src/                # Next.js 前端源代码
│   ├── app/           # App Router 路由
│   ├── components/    # 组件库
│   ├── lib/           # 工具函数与 Store
│   └── actions/       # Server Actions
├── public/             # 静态资源
├── scripts/            # 辅助脚本
└── docker-compose.yml  # 容器编排
```

## 📝 许可证

本项目采用 AGPL 许可证。
