import { notFound } from "next/navigation";
import { MarkdownRenderer } from "@/components/common/markdown/MarkdownRenderer";
import { TableOfContents } from "@/components/posts/TableOfContents";
import { getPostBySlug } from "@/lib/api-client";
import { extractTOC } from "@/lib/toc";

export const revalidate = 60;

interface PageProps {
	params: Promise<{
		slug: string;
		category: string;
	}>;
}

export async function generateMetadata({ params }: PageProps) {
	const { slug, category } = await params;

	try {
		const { data: post } = await getPostBySlug(slug);

		// 验证文章的分类是否与 URL 中的 category 匹配
		if (post.category?.slug !== category) {
			return {
				title: "文章不存在 | 天翔的博客",
			};
		}

		return {
			title: `${post.title} | 天翔的博客`,
			description: post.summary || post.text.slice(0, 100),
		};
	} catch {
		return {
			title: "文章不存在 | 天翔的博客",
		};
	}
}

export default async function PostPage({ params }: PageProps) {
	const { slug, category } = await params;

	// 验证 category 不是 ObjectId 格式（24位十六进制字符串）
	const isObjectId = /^[0-9a-f]{24}$/i.test(category);
	if (isObjectId) {
		notFound();
	}

	let post;
	let toc;
	try {
		const { data } = await getPostBySlug(slug);
		post = data;

		// 验证文章的分类是否与 URL 中的 category 匹配
		if (post.category?.slug !== category) {
			notFound();
		}

		toc = await extractTOC(post.text);
	} catch {
		notFound();
	}

	return (
		<main className="container mx-auto px-4 py-8 max-w-7xl">
			<div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-8 items-start">
				<article className="min-w-0">
					<header className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-8">
						<h1 className="text-4xl font-bold bg-linear-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent mb-4">
							{post.title}
						</h1>
						<div className="flex flex-wrap gap-4 text-sm text-gray-500">
							<span>
								发布于
								{new Date(post.created).toLocaleDateString()}
							</span>
							{post.category && (
								<span>
									分类:
									{post.category.name}
								</span>
							)}
							{post.tags && post.tags.length > 0 && (
								<div className="flex gap-2">
									{post.tags.map(tag => (
										<span key={tag} className="bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded text-primary-600 dark:text-primary-400">
											#
											{tag}
										</span>
									))}
								</div>
							)}
						</div>
					</header>
					<MarkdownRenderer content={post.text} />
				</article>

				<aside className="hidden lg:block sticky top-24 pt-8">
					<div>
						<TableOfContents toc={toc} />
					</div>
				</aside>
			</div>
		</main>
	);
}
