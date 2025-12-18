import { Feed } from "feed";
import { getPosts } from "@/lib/api-client";

export async function GET() {
	const { data: posts } = await getPosts(1, 20);
	const siteUrl = "https://blog.tnxg.moe"; // Should likely be from env or config

	const feed = new Feed({
		title: "天翔的博客",
		description: "明日尚未到来，希望凝于心上",
		id: siteUrl,
		link: siteUrl,
		language: "zh-CN",
		image: `${siteUrl}/avatar.png`,
		favicon: `${siteUrl}/favicon.ico`,
		copyright: `All rights reserved ${new Date().getFullYear()}, 天翔`,
		updated: posts.items.length > 0 ? new Date(posts.items[0].created) : new Date(),
		author: {
			name: "天翔TNXG",
			email: "tnxg@outlook.jp",
			link: siteUrl,
		},
	});

	posts.items.forEach((post) => {
		feed.addItem({
			title: post.title,
			id: post.slug,
			link: `${siteUrl}/posts/${post.categoryId || "default"}/${post.slug}`,
			description: post.summary,
			content: post.text,
			author: [
				{
					name: "天翔TNXG",
					email: "tnxg@outlook.jp",
					link: siteUrl,
				},
			],
			date: new Date(post.created),
		});
	});

	return new Response(feed.rss2(), {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "s-maxage=3600, stale-while-revalidate",
		},
	});
}
