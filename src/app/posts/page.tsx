import type { Metadata } from "next";
import { ArticleCard } from "@/components/layouts/home/ArticleCard";
import { getPosts } from "@/lib/api-client";

export const metadata: Metadata = {
	title: "文章列表 | 天翔的博客",
	description: "这里是天翔写下的所有文章",
};

export const revalidate = 60;

export default async function PostsPage() {
	const { data } = await getPosts(1, 100); // Fetch more posts for the list page

	return (
		<main className="container mx-auto px-4 py-8 max-w-4xl">
			<header className="mb-8">
				<h1 className="text-3xl font-bold bg-linear-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
					文章列表
				</h1>
				<p className="mt-2 text-gray-500 font-medium">
					记录点滴思考与生活
				</p>
			</header>

			<div className="space-y-4">
				{data.items.map(post => (
					<ArticleCard key={post._id} article={post} />
				))}
			</div>
		</main>
	);
}
