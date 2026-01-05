import type { MetadataRoute } from "next";
import { getNotes, getPosts } from "@/lib/api-client";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe";

  try {
    // 获取所有文章和日记
    const postsResponse = await getPosts(1, 1000);
    const notesResponse = await getNotes(1, 1000);
    const posts = postsResponse.data.items;
    const notes = notesResponse.data.items;

    // 生成文章页面的 sitemap 条目
    const postEntries: MetadataRoute.Sitemap = posts.map(post => ({
      url: `${baseUrl}/posts/${post.category?.slug || "default"}/${post.slug}`,
      lastModified: post.modified ? new Date(post.modified) : new Date(post.created),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    // 生成日记页面的 sitemap 条目
    const noteEntries: MetadataRoute.Sitemap = notes.map(note => ({
      url: `${baseUrl}/notes/${note.nid}`,
      lastModified: note.modified ? new Date(note.modified) : new Date(note.created),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    // 静态页面
    const staticPages: MetadataRoute.Sitemap = [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1,
      },
      {
        url: `${baseUrl}/posts`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.9,
      },
      {
        url: `${baseUrl}/notes`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.9,
      },
      {
        url: `${baseUrl}/friends`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      },
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
