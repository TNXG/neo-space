import type { MetadataRoute } from "next";
import { getNotes, getPosts } from "@/lib/api-client";
import { routing } from "@/locales";

function localizePath(path: string, locale: string) {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

function createLocalizedEntries(path: string, priority: number, lastModified: Date): MetadataRoute.Sitemap {
  return routing.locales.map(locale => ({
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe"}${localizePath(path, locale)}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: locale === routing.defaultLocale ? priority : Math.max(priority - 0.1, 0.1),
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe";

  try {
    // 获取所有文章和日记
    const postsResponse = await getPosts(1, 1000);
    const notesResponse = await getNotes(1, 1000);
    const posts = postsResponse.data.items;
    const notes = notesResponse.data.items;

    // 生成文章页面的 sitemap 条目
    const postEntries: MetadataRoute.Sitemap = posts.flatMap(post => createLocalizedEntries(
      `/posts/${post.category?.slug || "default"}/${post.slug}`,
      0.8,
      post.modified ? new Date(post.modified) : new Date(post.created),
    ));

    const noteEntries: MetadataRoute.Sitemap = notes.flatMap(note => createLocalizedEntries(
      `/notes/${note.nid}`,
      0.7,
      note.modified ? new Date(note.modified) : new Date(note.created),
    ));

    const now = new Date();
    const staticPages: MetadataRoute.Sitemap = [
      ...createLocalizedEntries("/", 1, now),
      ...createLocalizedEntries("/posts", 0.9, now),
      ...createLocalizedEntries("/notes", 0.9, now),
      ...createLocalizedEntries("/friends", 0.7, now),
      ...createLocalizedEntries("/categories", 0.7, now),
      ...createLocalizedEntries("/thinking", 0.7, now),
      ...createLocalizedEntries("/bangumi", 0.7, now),
    ];

    return [...staticPages, ...postEntries, ...noteEntries];
  } catch (error) {
    console.error("Error generating sitemap:", error);
    // 如果获取文章失败，至少返回静态页面
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1,
      },
    ];
  }
}
