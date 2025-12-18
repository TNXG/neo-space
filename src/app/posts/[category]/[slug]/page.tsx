import { notFound } from "next/navigation";
import { MarkdownRenderer } from "@/components/common/markdown/MarkdownRenderer";
import { ArticleHeader, ArticleLayout, CopyrightCard, OutdatedAlert } from "@/components/layouts/article";
import { getPostBySlug, getUserProfile } from "@/lib/api-client";
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
			return { title: "文章不存在" };
		}

		return {
			title: post.title,
			description: post.summary || post.text.slice(0, 100),
			keywords: post.tags,
		};
	} catch {
		return { title: "文章不存在" };
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
	let authorName = "作者";
	try {
		const [{ data }, { data: user }] = await Promise.all([
			getPostBySlug(slug),
			getUserProfile(),
		]);
		post = data;
		authorName = user.name;

		if (post.category?.slug !== category) {
			notFound();
		}

		toc = await extractTOC(post.text);
	} catch {
		notFound();
	}

	// 获取文章发布年份
	const postYear = new Date(post.created).getFullYear().toString();

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
					aiSummary={post.aiSummary}
					typeLabel="Article"
				/>
			)}
			content={(
				<>
					<OutdatedAlert
						refId={post._id}
						refType="post"
						lastUpdated={post.modified || post.created}
					/>
					<MarkdownRenderer content={post.text} />
				</>
			)}
			footer={post.copyright && (
				<CopyrightCard
					author={authorName}
					year={postYear}
					postTitle={post.title}
				/>
			)}
		/>
	);
}
