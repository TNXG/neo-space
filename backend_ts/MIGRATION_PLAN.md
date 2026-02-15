# Rust Backend → ElysiaJS 迁移计划

## 阶段 1: 基础设施层 (Infrastructure) ✅ 优先级最高

### 1.1 缓存系统重构
- [ ] 集成 Redis/ioredis 替代简单内存缓存
- [ ] 实现 CacheService（类似 Rust 的 Moka）
- [ ] 支持 TTL、容量管理、前缀删除

### 1.2 验证码服务
- [ ] 实现 VerificationService
- [ ] 6位数字验证码生成
- [ ] 尝试次数限制（3次）
- [ ] 10分钟过期

### 1.3 邮件服务
- [ ] 实现 EmailService（使用 nodemailer）
- [ ] 从数据库读取 SMTP 配置
- [ ] HTML 邮件模板
- [ ] 支持 TLS/STARTTLS

### 1.4 ISR 缓存刷新服务
- [ ] 实现 RevalidationService
- [ ] Next.js ISR 缓存失效通知
- [ ] HMAC 签名验证

### 1.5 Change Stream 监听
- [ ] 实现 ChangeStreamService
- [ ] MongoDB 变更监听
- [ ] 自动缓存失效
- [ ] 自动重连机制

## 阶段 2: 认证授权 (Auth & Guards) ✅ 优先级高

### 2.1 权限守卫
- [ ] 实现 OwnerGuard 中间件
- [ ] 实现 OptionalAuthGuard
- [ ] 细粒度权限控制（RBAC）

### 2.2 速率限制
- [ ] API 请求频率限制
- [ ] IP 黑名单
- [ ] 防暴力破解

### 2.3 QQ OAuth
- [ ] 补全 QQ 互联登录
- [ ] QQ OAuth 提供商实现

## 阶段 3: 实时通信 (Realtime) ✅ 优先级高

### 3.1 WebSocket 支持
- [ ] 实现 EventBus（事件总线）
- [ ] WebSocket 连接管理
- [ ] 博主桌面客户端双向通信
- [ ] 心跳检测

### 3.2 SSE 优化
- [ ] 完善 SSE 服务
- [ ] 在线人数统计
- [ ] 阅读列表广播

## 阶段 4: 安全防护 (Security) ✅ 优先级中

### 4.1 垃圾评论检测
- [ ] AI 驱动的反垃圾评论
- [ ] 内容审核
- [ ] 敏感词过滤

### 4.2 多层防护
- [ ] Turnstile 验证

## 阶段 5: AI 集成 (AI) ✅ 优先级中

### 5.1 Time Capsule
- [ ] 时间胶囊分析功能
- [ ] 内容时效性检测

### 5.2 内容摘要
- [ ] AI 自动生成摘要
- [ ] OpenAI 集成优化

## 阶段 6: 工具服务 (Tools) ✅ 优先级低

### 6.1 图片服务
- [ ] 头像缓存
- [ ] 图片处理
- [ ] CDN 集成

### 6.2 友链健康检查
- [ ] 定期检查友链
- [ ] SWR 缓存策略
- [ ] 部署服务商检测

### 6.3 IP 地理位置
- [ ] IP 查询服务
- [ ] Bilibili API 集成

## 阶段 7: 开发体验 (DX) ✅ 优先级低

### 7.1 OpenAPI 文档
- [ ] Swagger UI
- [ ] 自动生成 API 文档

### 7.2 日志与监控
- [ ] 结构化日志
- [ ] 性能监控
- [ ] 错误追踪

## 代码质量改进

### 类型安全
- [ ] 修复 SSEEvent 的 `any` 类型
- [ ] 完善类型定义

### 架构优化
- [ ] 使用成熟的缓存库
- [ ] 统一错误处理
- [ ] 依赖注入模式

## 当前进度

- ✅ 基础 API 路由（posts、notes、categories、links 等）
- ✅ 基本认证（GitHub OAuth、JWT）
- ✅ 评论系统
- ✅ 简单缓存
- ⏳ 其他功能待实现
