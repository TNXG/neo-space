#### 待优化项（Technical Debt）

以下组件存在不符合本规范的地方，需要在后续迭代中修复：

1. **ProfileHeader 组件**（`src/components/layouts/home/ProfileHeader.tsx:17,37`）
   - 问题：使用硬编码的 Tailwind 颜色类（`bg-stone-200`、`from-stone-200`、`text-neutral-400`）
   - 影响：不会自动适配暗色模式
   - 修复方案：替换为语义化变量
     ```tsx
     {/* 当前（错误） */}
     <div className="bg-stone-200 from-stone-200 to-stone-300 text-neutral-400">

     {/* 修复后（正确） */}
     <div className="bg-secondary from-secondary to-secondary-foreground text-muted-foreground">
     ```

2. **ArticleHeader 组件**（`src/components/layouts/article/ArticleHeader.tsx:103`）
   - 问题：标签使用 `bg-primary-100 text-primary-700`，虽能自动适配但缺乏语义
   - 修复方案：替换为 `bg-secondary text-secondary-foreground`

3. **NoteItem 组件**（`src/components/layouts/home/NoteItem.tsx:19-20`）
   - 问题：悬停时使用 `text-primary`，应使用 `text-accent-600`
   - 修复方案：`group-hover:text-accent-600`

4. **ArticlePreview 组件**（`src/components/layouts/home/ArticlePreview.tsx:20`）
   - 问题：悬停时使用 `text-primary`，应使用 `text-accent-600`
   - 修复方案：`group-hover:text-accent-600`
