import { notFound } from "next/navigation";
import { MarkdownRenderer } from "@/components/common/markdown/MarkdownRenderer";
import { ArticleHeader, ArticleLayout } from "@/components/layouts/article";
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

	// 验证 category 不是 ObjectId 格式
	const isObjectId = /^[0-9a-f]{24}$/i.test(category);
	if (isObjectId) {
		notFound();
	}

	let post;
	let toc;
	try {
		const { data } = await getPostBySlug(slug);
		post = data;

		if (post.category?.slug !== category) {
			notFound();
		}

		toc = await extractTOC(post.text);
	} catch {
		notFound();
	}

	return (
		<ArticleLayout
			toc={toc}
			header={(
				<ArticleHeader
					title={post.title}
					category={post.category}
					tags={post.tags}
					created={post.created}
					modified={post.modified}
					summary={post.summary}
					typeLabel="Article"
				/>
			)}
			content={<MarkdownRenderer content={post.text} />}
		/>
	);
}
