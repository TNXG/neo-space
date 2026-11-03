import { getNotes, getPosts } from "@/lib/api-client";

export const revalidate = 57600;

/** 将标题转换为单行 Markdown 链接文本。 */
function escapeTitle(title: string): string {
  return title.replace(/\s+/g, " ").replace(/[\\[\]]/g, "\\$&");
}

/** 生成公开内容索引，直接返回文本而不是渲染 React 页面。 */
export async function GET(): Promise<Response> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.example.com").replace(/\/$/, "");
  const [postsResponse, notesResponse] = await Promise.all([
    getPosts(1, 50),
    getNotes(1, 30),
  ]);
  const posts = postsResponse.data.items;
  const notes = notesResponse.data.items;
  const content = [
    "# 天翔TNXGの空间站",
    "",
    "> 天翔TNXG 的个人博客，收录技术文章、生活记录、日记与碎碎念。",
    "",
    "以下为最近发布的公开内容。引用请保留原文标题及链接，技术信息请结合原文发布时间和更新时间理解。",
    "",
    "## 内容入口",
    "",
    `- [首页](${baseUrl}/): 博主简介与最近更新。`,
    `- [文章列表](${baseUrl}/posts): 浏览全部博文。`,
    `- [日记列表](${baseUrl}/notes): 浏览日记。`,
    `- [站点地图](${baseUrl}/sitemap.xml): 发现更多公开页面。`,
    `- [RSS](${baseUrl}/feed): 内容更新订阅。`,
    "",
    "## 最近文章",
    "",
    ...posts.map(post => `- [${escapeTitle(post.title)}](${baseUrl}/posts/${encodeURIComponent(post.category?.slug || "default")}/${encodeURIComponent(post.slug)})`),
    "",
    "## 最近日记",
    "",
    ...notes.map(note => `- [${escapeTitle(note.title)}](${baseUrl}/notes/${encodeURIComponent(note.nid)})`),
    "",
    "## Optional",
    "",
    `- [分类](${baseUrl}/categories): 按分类浏览文章。`,
    `- [碎碎念](${baseUrl}/thinking): 简短想法与动态。`,
    `- [友链](${baseUrl}/friends): 朋友们的网站。`,
    `- [追番与收藏](${baseUrl}/bangumi): 个人媒体收藏记录。`,
    "",
  ].join("\n");

  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
