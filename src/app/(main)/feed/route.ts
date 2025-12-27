import { Feed } from "feed";
import { getCategories, getNotes, getPosts, getSiteConfig, getUserProfile } from "@/lib/api-client";

/**
 * RSS Feed 路由
 * 生成包含文章和日记的 RSS 订阅源
 */
export async function GET() {
	// 并行获取所有数据
	const [postsRes, notesRes, configRes, userRes, categoriesRes] = await Promise.all([
		getPosts(1, 50),
		getNotes(1, 30),
		getSiteConfig().catch(() => null),
		getUserProfile().catch(() => null),
		getCategories().catch(() => null),
	]);

	const posts = postsRes.data.items;
	const notes = notesRes.data.items;
	const siteConfig = configRes?.data;
	const user = userRes?.data;
	const categories = categoriesRes?.data || [];

	// 构建分类 ID -> slug 映射
	const categoryMap = new Map(categories.map(cat => [cat._id, cat.slug]));

	// 站点 URL（优先使用配置，降级到默认值）
	const siteUrl = siteConfig?.url?.webUrl || "https://blog.tnxg.moe";
	const siteTitle = siteConfig?.seo?.title || "天翔的博客";
	const siteDescription = siteConfig?.seo?.description || "明日尚未到来，希望凝于心上";

	// 作者信息
	const authorName = user?.name || "天翔TNXG";
	const authorEmail = user?.mail || "tnxg@outlook.jp";
	const authorUrl = user?.url || siteUrl;

	// 合并文章和日记，按创建时间排序
	const allItems = [
		...posts.map(post => ({
			type: "post" as const,
			title: post.title,
			id: post.slug,
			link: `${siteUrl}/posts/${categoryMap.get(post.categoryId) || "default"}/${post.slug}`,
			description: post.summary || post.aiSummary || post.text.slice(0, 200),
			content: post.text,
			date: new Date(post.created),
			tags: post.tags,
		})),
		...notes.map(note => ({
			type: "note" as const,
			title: note.title,
			id: `note-${note.nid}`,
			link: `${siteUrl}/notes/${note.nid}`,
			description: note.aiSummary || note.text.slice(0, 200),
			content: note.text,
			date: new Date(note.created),
			tags: [note.mood, note.weather, note.location].filter(Boolean) as string[],
		})),
	].sort((a, b) => b.date.getTime() - a.date.getTime());

	// 获取最新更新时间
	const latestDate = allItems.length > 0 ? allItems[0].date : new Date();

	const feed = new Feed({
		title: siteTitle,
		description: siteDescription,
		id: siteUrl,
		link: siteUrl,
		language: "zh-CN",
		image: `${siteUrl}/avatar.png`,
		favicon: `${siteUrl}/favicon.ico`,
		copyright: `All rights reserved ${new Date().getFullYear()}, ${authorName}`,
		updated: latestDate,
		feedLinks: {
			rss2: `${siteUrl}/feed`,
			atom: `${siteUrl}/feed?format=atom`,
		},
		author: {
			name: authorName,
			email: authorEmail,
			link: authorUrl,
		},
	});

	// 添加分类
	categories.forEach((cat) => {
		feed.addCategory(cat.name);
	});

	// 添加内容项
	allItems.forEach((item) => {
		feed.addItem({
			title: item.title,
			id: item.id,
			link: item.link,
			description: item.description,
			content: item.content,
			author: [
				{
					name: authorName,
					email: authorEmail,
					link: authorUrl,
				},
			],
			date: item.date,
			category: item.tags.map(tag => ({ name: tag })),
		});
	});

	return new Response(feed.rss2(), {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "s-maxage=3600, stale-while-revalidate",
		},
	});
}
