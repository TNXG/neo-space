import type { BlockFormat, EditorCommands } from "@neo-space/editor";

export interface SlashItem {
  id: string;
  label: string;
  hint: string;
  icon: string;
  /** 用于拼音首字母/英文关键词匹配。 */
  keywords: string;
  group: "基础" | "列表" | "插入" | "站点组件";
  run: (commands: EditorCommands, actions: { pickImage: () => void }) => void;
}

const block = (format: BlockFormat) => (commands: EditorCommands) => commands.setBlock(format);

export const SLASH_ITEMS: SlashItem[] = [
  { id: "p", label: "正文", hint: "普通段落", icon: "mingcute:paragraph-line", keywords: "text paragraph zw zhengwen p", group: "基础", run: block("paragraph") },
  { id: "h1", label: "一级标题", hint: "#", icon: "mingcute:heading-1-line", keywords: "h1 heading title bt", group: "基础", run: block("h1") },
  { id: "h2", label: "二级标题", hint: "##", icon: "mingcute:heading-2-line", keywords: "h2 heading bt", group: "基础", run: block("h2") },
  { id: "h3", label: "三级标题", hint: "###", icon: "mingcute:heading-3-line", keywords: "h3 heading bt", group: "基础", run: block("h3") },
  { id: "quote", label: "引用", hint: ">", icon: "mingcute:quote-left-line", keywords: "quote blockquote yy yinyong", group: "基础", run: block("blockquote") },
  { id: "ul", label: "无序列表", hint: "-", icon: "mingcute:list-check-line", keywords: "ul bullet list lb liebiao", group: "列表", run: block("bullet_list") },
  { id: "ol", label: "有序列表", hint: "1.", icon: "mingcute:list-ordered-line", keywords: "ol ordered number list yxlb", group: "列表", run: block("ordered_list") },
  { id: "task", label: "任务列表", hint: "- [ ]", icon: "mingcute:check-circle-line", keywords: "todo task checkbox rw renwu", group: "列表", run: block("task_list") },
  { id: "code", label: "代码块", hint: "```", icon: "mingcute:code-line", keywords: "code block dm daima", group: "插入", run: block("code_block") },
  { id: "image", label: "图片", hint: "上传或粘贴", icon: "mingcute:pic-line", keywords: "image picture img tp tupian", group: "插入", run: (_c, actions) => actions.pickImage() },
  { id: "table", label: "表格", hint: "3 × 3", icon: "mingcute:table-2-line", keywords: "table bg biaoge", group: "插入", run: commands => commands.insertTable() },
  { id: "math", label: "公式", hint: "$$", icon: "mingcute:formula-line", keywords: "math latex katex formula gs gongshi", group: "插入", run: commands => commands.insertMath() },
  { id: "hr", label: "分隔线", hint: "---", icon: "mingcute:minimize-line", keywords: "hr divider separator fgx", group: "插入", run: commands => commands.insertDivider() },
  { id: "info", label: "信息横幅", hint: "::: info", icon: "mingcute:information-line", keywords: "info banner callout tip xx xinxi", group: "站点组件", run: commands => commands.insertContainer("info", "") },
  { id: "warn", label: "警告横幅", hint: "::: warn", icon: "mingcute:warning-line", keywords: "warn warning jg jinggao", group: "站点组件", run: commands => commands.insertContainer("warn", "") },
  { id: "success", label: "成功横幅", hint: "::: success", icon: "mingcute:check-circle-line", keywords: "success cg chenggong", group: "站点组件", run: commands => commands.insertContainer("success", "") },
  { id: "error", label: "错误横幅", hint: "::: error", icon: "mingcute:close-circle-line", keywords: "error danger cw cuowu", group: "站点组件", run: commands => commands.insertContainer("error", "") },
  { id: "gallery", label: "画廊", hint: "::: gallery", icon: "mingcute:pic-2-line", keywords: "gallery album hl hualang", group: "站点组件", run: commands => commands.insertContainer("gallery", "![]()") },
  { id: "grid", label: "图片网格", hint: "::: grid", icon: "mingcute:grid-line", keywords: "grid wg wangge", group: "站点组件", run: commands => commands.insertContainer("grid", "![]()\n![]()", "cols=2") },
];

/**
 * 依据输入过滤，前缀命中排在包含命中之前。
 * @param query 斜杠后的查询
 * @returns 匹配项
 */
export const filterSlashItems = (query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  const scored = SLASH_ITEMS.map((item) => {
    const haystack = `${item.label} ${item.keywords}`.toLowerCase();
    const words = haystack.split(/\s+/);
    if (words.some(word => word.startsWith(q)) || item.label.startsWith(q)) return { item, score: 2 };
    if (haystack.includes(q)) return { item, score: 1 };
    return { item, score: 0 };
  });
  return scored.filter(entry => entry.score > 0).sort((a, b) => b.score - a.score).map(entry => entry.item);
};
