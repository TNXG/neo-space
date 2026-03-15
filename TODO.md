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

- [ ] 管理后台界面
  - 文章管理（创建、编辑、删除）
  - 日记管理
  - 评论管理（审核、回复）
  - 友链管理
  - 用户管理
  - 站点配置

- [ ] 管理面板的 App 化
    - 使用 Flutter 或 React Native 开发移动端 App
    - 实现文章管理、评论管理等核心功能
    - 推送通知功能（新评论）
    - 主要为了随时记录灵感和快速处理评论
