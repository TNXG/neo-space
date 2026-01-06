# Neo Space Backend 架构文档

## 项目概述

Neo Space Backend 是一个基于 Rust 和 Rocket.rs 框架构建的高性能博客系统后端 API。项目采用现代化的分层架构设计，注重代码质量、类型安全和性能优化。

**技术栈：**
- **Web 框架**: Rocket.rs 0.5.1
- **数据库**: MongoDB 3.4.1
- **异步运行时**: Tokio 1.49.0
- **序列化**: Serde 1.0.228
- **HTTP 客户端**: Reqwest 0.13 (rustls)
- **AI 集成**: async-openai 0.32.1
- **缓存**: Moka 0.12.12
- **认证**: JWT (jsonwebtoken 10.2.0)
- **API 文档**: utoipa 5.2.0 + Swagger UI

## 核心特性

- ✅ RESTful API 设计
- ✅ MongoDB 数据持久化
- ✅ JWT 认证与 OAuth 集成（GitHub、QQ）
- ✅ 多级缓存系统
- ✅ AI 内容分析（OpenAI 集成）
- ✅ 实时 WebSocket 通信
- ✅ 邮件验证服务
- ✅ 友链健康检查
- ✅ ISR 缓存自动刷新
- ✅ OpenAPI/Swagger 文档
- ✅ 严格的 Clippy Lint 规则

## 项目结构

```
backend/
├── src/
│   ├── main.rs                 # 应用入口
│   ├── error.rs                # 统一错误处理
│   ├── openapi.rs              # OpenAPI 文档配置
│   │
│   ├── bootstrap/              # 应用启动与初始化
│   │   ├── app.rs              # Rocket 应用构建
│   │   ├── config.rs           # 配置加载
│   │   ├── database.rs         # 数据库初始化
│   │   └── services.rs         # 服务初始化
│   │
│   ├── config/                 # 配置管理
│   │   ├── settings.rs         # 应用配置
│   │   └── email.rs            # 邮件配置
│   │
│   ├── models/                 # 数据模型
│   │   ├── response.rs         # API 响应模型
│   │   ├── post.rs             # 文章模型
│   │   ├── note.rs             # 日记模型
│   │   ├── category.rs         # 分类模型
│   │   ├── comment.rs          # 评论模型
│   │   ├── link.rs             # 友链模型
│   │   ├── page.rs             # 页面模型
│   │   ├── recently.rs         # 动态模型
│   │   ├── user.rs             # 用户模型
│   │   ├── account.rs          # 账号模型
│   │   ├── jwt.rs              # JWT Claims
│   │   ├── time_capsule.rs     # 时光胶囊
│   │   └── ai_summary.rs       # AI 摘要
│   │
│   ├── routes/                 # 路由层（HTTP 接口）
│   │   ├── posts.rs            # 文章路由
│   │   ├── notes.rs            # 日记路由
│   │   ├── categories.rs       # 分类路由
│   │   ├── links.rs            # 友链路由
│   │   ├── pages.rs            # 页面路由
│   │   ├── recentlies.rs       # 动态路由
│   │   ├── users.rs            # 用户路由
│   │   ├── config.rs           # 配置路由
│   │   ├── ai.rs               # AI 服务路由
│   │   ├── nbnhhsh.rs          # 工具接口
│   │   ├── auth/               # 认证路由
│   │   │   └── oauth.rs        # OAuth 认证
│   │   └── comments/           # 评论路由
│   │
│   ├── services/               # 业务逻辑层
│   │   ├── options_service.rs  # 配置服务
│   │   ├── spam_detector.rs    # 垃圾内容检测
│   │   ├── auth/               # 认证服务
│   │   │   ├── jwt.rs          # JWT 服务
│   │   │   └── oauth/          # OAuth 服务
│   │   │       ├── provider.rs # OAuth 提供商接口
│   │   │       ├── github.rs   # GitHub OAuth
│   │   │       └── qq.rs       # QQ OAuth
│   │   ├── comment/            # 评论服务
│   │   │   └── service.rs      # 评论业务逻辑
│   │   └── content/            # 内容服务
│   │
│   ├── repositories/           # 数据访问层
│   │   ├── base.rs             # Repository 基类
│   │   ├── account_repository.rs   # 账号数据访问
│   │   ├── reader_repository.rs    # 读者数据访问
│   │   └── options_repository.rs   # 配置数据访问
│   │
│   ├── infrastructure/         # 基础设施层
│   │   ├── cache/              # 缓存服务
│   │   ├── database/           # 数据库服务
│   │   │   └── change_stream.rs    # MongoDB Change Stream
│   │   ├── email/              # 邮件服务
│   │   ├── revalidation/       # ISR 缓存刷新
│   │   └── verification/       # 验证码服务
│   │
│   ├── integrations/           # 第三方集成
│   │   ├── openai/             # OpenAI 集成
│   │   ├── turnstile/          # Cloudflare Turnstile
│   │   └── status/             # 状态检测服务
│   │       ├── ip.rs           # IP 地理位置
│   │       └── link_health.rs  # 友链健康检查
│   │
│   ├── guards/                 # 请求守卫
│   │   ├── auth.rs             # 认证守卫
│   │   ├── owner.rs            # 所有者守卫
│   │   └── client_ip.rs        # 客户端 IP 提取
│   │
│   ├── utils/                  # 工具模块
│   │   ├── db.rs               # 数据库工具
│   │   ├── jwt.rs              # JWT 工具
│   │   ├── detection.rs        # 检测工具
│   │   └── serializers.rs      # 序列化工具
│   │
│   └── websocket/              # WebSocket 实时通信
│       ├── event_bus.rs        # 事件总线
│       ├── handler.rs          # WebSocket 处理器
│       └── messages.rs         # 消息定义
│
├── Cargo.toml                  # 项目依赖
├── Rocket.toml                 # Rocket 配置
├── Dockerfile                  # Docker 镜像
└── .env.example                # 环境变量示例
```

## 架构设计

### 分层架构

项目采用经典的分层架构模式，从上到下依次为：

```
┌─────────────────────────────────────────┐
│         Routes Layer (路由层)            │
│   HTTP 请求处理、参数验证、响应格式化      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       Services Layer (业务逻辑层)        │
│   核心业务逻辑、数据处理、权限控制         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│     Repositories Layer (数据访问层)      │
│   数据库 CRUD 操作、查询构建              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Infrastructure Layer (基础设施层)      │
│   缓存、邮件、数据库连接池等基础服务       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│    Integrations Layer (第三方集成层)     │
│   OpenAI、Turnstile、OAuth 等外部服务    │
└─────────────────────────────────────────┘
```

### 核心模块说明

#### 1. Bootstrap 模块（应用启动）

负责应用的初始化流程：

- **app.rs**: 构建 Rocket 实例，注册中间件、错误处理器和 Swagger UI
- **config.rs**: 从环境变量加载配置
- **database.rs**: 初始化 MongoDB 连接
- **services.rs**: 初始化所有应用服务（缓存、邮件、验证码等）

**启动流程：**
```rust
1. init_logging()          // 初始化日志系统
2. load_config()           // 加载 OAuth 配置
3. init_database()         // 连接 MongoDB
4. init_services()         // 初始化所有服务
5. configure_cors()        // 配置 CORS
6. build_rocket()          // 构建 Rocket 实例
7. mount routes            // 注册路由
```

#### 2. Routes 模块（路由层）

处理 HTTP 请求，负责：
- 参数验证和解析
- 调用 Service 层处理业务逻辑
- 格式化响应数据

**主要路由组：**
- `/api/posts` - 文章管理
- `/api/notes` - 日记管理
- `/api/categories` - 分类管理
- `/api/links` - 友链管理
- `/api/comments` - 评论管理
- `/api/auth` - 认证相关
- `/api/users` - 用户管理
- `/api/pages` - 页面管理
- `/api/config` - 站点配置

**统一响应格式：**
```rust
pub struct ApiResponse<T> {
    pub code: i32,
    pub status: ResponseStatus,  // "success" | "failed"
    pub message: String,
    pub data: T,
}
```

#### 3. Services 模块（业务逻辑层）

核心业务逻辑实现：

- **auth/**: 认证服务
  - JWT 生成与验证
  - OAuth 集成（GitHub、QQ）
  - 用户会话管理

- **comment/**: 评论服务
  - 评论 CRUD
  - 评论树构建
  - 垃圾评论检测

- **content/**: 内容服务
  - 文章/日记发布
  - 内容审核
  - AI 摘要生成

- **options_service.rs**: 站点配置管理
- **spam_detector.rs**: 垃圾内容检测

#### 4. Repositories 模块（数据访问层）

封装所有数据库操作，采用 Repository 模式：

- **base.rs**: Repository 基类，提供通用 CRUD 方法
- **account_repository.rs**: 账号数据访问
- **reader_repository.rs**: 读者数据访问
- **options_repository.rs**: 配置数据访问

**设计原则：**
- 单一职责：每个 Repository 只负责一个集合
- 无业务逻辑：只包含数据库操作，不包含业务判断
- 类型安全：使用强类型模型，避免运行时错误

#### 5. Infrastructure 模块（基础设施层）

提供基础设施服务：

- **cache/**: 缓存服务（基于 Moka）
  - 内存缓存
  - TTL 过期策略
  - LRU 淘汰算法

- **database/**: 数据库服务
  - MongoDB Change Stream 监听
  - 自动缓存失效
  - ISR 缓存刷新触发

- **email/**: 邮件服务
  - SMTP 发送
  - 邮件模板
  - 异步发送队列

- **revalidation/**: ISR 缓存刷新
  - Next.js ISR 集成
  - 自动触发重新验证
  - HMAC 签名验证

- **verification/**: 验证码服务
  - 验证码生成
  - 验证码存储
  - 过期管理

#### 6. Integrations 模块（第三方集成）

集成外部服务：

- **openai/**: OpenAI API 集成
  - Chat Completion
  - 内容摘要生成
  - 时光胶囊分析

- **turnstile/**: Cloudflare Turnstile 验证
  - 人机验证
  - 防止机器人攻击

- **status/**: 状态检测服务
  - IP 地理位置查询（Bilibili API）
  - 友链健康检查
  - 定期健康检查任务

#### 7. Guards 模块（请求守卫）

Rocket 请求守卫，用于：

- **auth.rs**: JWT 认证守卫
  - `AuthGuard`: 强制认证
  - `OptionalAuthGuard`: 可选认证

- **owner.rs**: 所有者权限守卫
  - 验证用户是否为站点所有者

- **client_ip.rs**: 客户端 IP 提取
  - 支持 X-Forwarded-For
  - 支持 X-Real-IP

#### 8. WebSocket 模块（实时通信）

提供实时通信能力：

- **event_bus.rs**: 事件总线
  - 发布/订阅模式
  - 事件分发

- **handler.rs**: WebSocket 连接处理
  - 连接管理
  - 消息路由

- **messages.rs**: 消息定义
  - 消息类型
  - 序列化/反序列化

## 数据模型

### 核心实体

#### Post（文章）
```rust
pub struct Post {
    pub _id: ObjectId,
    pub title: String,
    pub slug: String,
    pub text: String,
    pub summary: Option<String>,
    pub category_id: ObjectId,
    pub images: Vec<PostImage>,
    pub created: DateTime<Utc>,
    pub modified: DateTime<Utc>,
    pub is_published: bool,
    pub allow_comment: bool,
    pub copyright: bool,
}
```

#### Note（日记）
```rust
pub struct Note {
    pub _id: ObjectId,
    pub title: String,
    pub text: String,
    pub mood: Option<String>,
    pub weather: Option<String>,
    pub nid: i32,  // 自增 ID
    pub images: Vec<NoteImage>,
    pub created: DateTime<Utc>,
    pub modified: DateTime<Utc>,
    pub is_published: bool,
    pub allow_comment: bool,
}
```

#### Comment（评论）
```rust
pub struct Comment {
    pub _id: ObjectId,
    pub author: String,
    pub text: String,
    pub mail: String,
    pub url: Option<String>,
    pub ip: Option<String>,
    pub agent: Option<String>,
    pub ref_id: ObjectId,  // 关联的文章/日记 ID
    pub ref_type: String,  // "Post" | "Note" | "Page"
    pub state: CommentState,  // Unread | Read | Junk
    pub parent: Option<ObjectId>,  // 父评论 ID
    pub created: DateTime<Utc>,
}
```

#### Link（友链）
```rust
pub struct Link {
    pub _id: ObjectId,
    pub name: String,
    pub url: String,
    pub avatar: Option<String>,
    pub description: Option<String>,
    pub email: Option<String>,
    pub state: LinkState,  // Pending | Approved | Rejected | Outdate
    pub link_type: LinkType,  // Friend | Collection
    pub created: DateTime<Utc>,
}
```

#### User（用户）
```rust
pub struct User {
    pub _id: ObjectId,
    pub username: String,
    pub name: String,
    pub mail: Option<String>,
    pub url: Option<String>,
    pub avatar: Option<String>,
    pub introduce: Option<String>,
    pub social_ids: Option<UserSocialIds>,
    pub created: DateTime<Utc>,
}
```

## 认证与授权

### JWT 认证流程

```
1. 用户通过 OAuth 登录（GitHub/QQ）
2. 后端验证 OAuth 回调
3. 生成 JWT Token（包含 user_id）
4. 前端存储 Token
5. 后续请求携带 Token（Authorization: Bearer <token>）
6. AuthGuard 验证 Token
7. 提取用户信息，注入到 Handler
```

### OAuth 集成

支持的 OAuth 提供商：
- **GitHub**: 使用 GitHub OAuth App
- **QQ**: 使用 QQ 互联

**OAuth 流程：**
```
1. 前端跳转到 OAuth 授权页面
2. 用户授权后回调到后端
3. 后端使用 code 换取 access_token
4. 使用 access_token 获取用户信息
5. 查找或创建用户账号
6. 生成 JWT Token 返回
```

## 缓存策略

### 多级缓存架构

```
┌─────────────────────────────────────────┐
│         Application Cache (Moka)        │
│   内存缓存，TTL 过期，LRU 淘汰            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         MongoDB Change Stream           │
│   监听数据变更，自动失效缓存               │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Next.js ISR Cache               │
│   触发前端 ISR 缓存重新验证               │
└─────────────────────────────────────────┘
```

### 缓存失效策略

1. **TTL 过期**: 缓存项超过 TTL 自动失效
2. **Change Stream**: MongoDB 数据变更时主动失效
3. **手动失效**: 通过 API 手动清除缓存
4. **LRU 淘汰**: 缓存满时淘汰最少使用的项

## API 文档

### Swagger UI

访问 `/swagger-ui/` 查看完整的 API 文档。

### OpenAPI 规范

使用 `utoipa` 生成 OpenAPI 3.0 规范，包括：
- 所有路由定义
- 请求/响应模型
- 参数说明
- 错误码定义

## 性能优化

### 编译优化

```toml
[profile.release]
opt-level = "z"        # 优化体积
lto = true             # 链接时优化
codegen-units = 1      # 单个代码生成单元
panic = "abort"        # Panic 时直接终止
strip = true           # 移除调试符号
```

### 依赖优化

- 禁用不需要的 default features
- 使用 rustls 替代 OpenSSL
- 精简 Tokio 运行时
- 移除不必要的依赖

### 运行时优化

- 异步 I/O（Tokio）
- 连接池复用
- 内存缓存（Moka）
- 数据库索引优化

## 代码质量

### Clippy Lint 规则

```toml
[lints.clippy]
all = "warn"
pedantic = "warn"
perf = "warn"

# 禁止不安全操作
panic = "forbid"
unwrap_used = "forbid"
expect_used = "forbid"
indexing_slicing = "forbid"
```

### 错误处理

- 禁止使用 `unwrap()` 和 `expect()`
- 使用 `Result` 和 `Option` 处理错误
- 统一错误类型（`AuthError`）
- 错误日志记录

## 部署

### Docker 部署

```bash
# 构建镜像
docker build -t neo-space-backend .

# 运行容器
docker run -p 8000:8000 \
  -e MONGODB_URI=mongodb://host:27017/mx-space \
  -e JWT_SECRET=your-secret \
  neo-space-backend
```

### 环境变量

必需：
- `MONGODB_URI`: MongoDB 连接字符串
- `JWT_SECRET`: JWT 签名密钥

可选：
- `CACHE_MAX_CAPACITY`: 缓存最大容量（默认 10000）
- `CACHE_TTL_SECONDS`: 缓存 TTL（默认 3600）
- `NEXTJS_URL`: Next.js 前端地址
- `REVALIDATION_SECRET`: ISR 缓存刷新密钥
- `OPENAI_API_KEY`: OpenAI API 密钥
- `GITHUB_CLIENT_ID`: GitHub OAuth Client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth Client Secret
- `QQ_APP_ID`: QQ 互联 App ID
- `QQ_APP_KEY`: QQ 互联 App Key

## 开发指南

### 本地开发

```bash
# 安装依赖
cargo build

# 运行开发服务器
cargo run

# 运行测试
cargo test

# 代码检查
cargo clippy

# 格式化代码
cargo fmt
```

### 添加新路由

1. 在 `routes/` 下创建新文件
2. 定义路由处理函数
3. 在 `routes/mod.rs` 中导出
4. 在 `main.rs` 中注册路由
5. 在 `openapi.rs` 中添加文档

### 添加新服务

1. 在 `services/` 下创建新文件
2. 实现服务逻辑
3. 在 `services/mod.rs` 中导出
4. 在 `bootstrap/services.rs` 中初始化
5. 通过 `State` 注入到路由

## 未来规划

- [ ] gRPC 服务
- [ ] 全文搜索（Elasticsearch）
- [ ] 分布式追踪（OpenTelemetry）
- [ ] 性能监控（Prometheus + Grafana）
- [ ] 自动化测试覆盖
- [ ] CI/CD 流水线

## 参考资料

- [Rocket.rs 官方文档](https://rocket.rs/)
- [MongoDB Rust Driver](https://www.mongodb.com/docs/drivers/rust/)
- [Tokio 异步运行时](https://tokio.rs/)
- [utoipa OpenAPI 文档](https://github.com/juhaku/utoipa)

---

**维护者**: TNXG  
**最后更新**: 2026-01-06
