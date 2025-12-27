import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommentSectionServer, CommentSkeleton } from "@/components/comment";
import { MarkdownRenderer } from "@/components/common/markdown/MarkdownRenderer";
import { ArticleLayout } from "@/components/layouts/article";
import { getPageBySlug } from "@/lib/api-client";
import { extractTOC } from "@/lib/toc";

export const revalidate = 57600;
export const dynamicParams = true;
export function generateStaticParams() {
	return [];
}

interface PageProps {
	params: Promise<{
		slug: string;
	}>;
}

export async function generateMetadata({ params }: PageProps) {
	const { slug } = await params;
	try {
		const { data: page } = await getPageBySlug(slug);
		return {
			title: page.title,
			description: page.text.slice(0, 100),
		};
	} catch {
		return { title: "页面不存在" };
	}
}

export default async function PageDetail({ params }: PageProps) {
	const { slug } = await params;

	let page;
	try {
		const { data } = await getPageBySlug(slug);
		page = data;
	} catch {
		notFound();
	}

	// 提取 TOC
	const toc = await extractTOC(page.text);

	return (
		<ArticleLayout
			toc={toc}
			header={(
				<header className="mb-8 border-b border-primary-200 pb-8">
					<h1 className="text-4xl font-bold bg-linear-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent mb-4">
						{page.title}
					</h1>
					<div className="flex flex-wrap gap-4 text-sm text-zinc-500">
						<span>
							更新于
							{" "}
							{new Date(page.created).toLocaleDateString()}
						</span>
					</div>
				</header>
			)}
			content={<MarkdownRenderer content={page.text} />}
			footer={
				page.allowComment && (
					<div className="mt-16">
						<Suspense fallback={<CommentSkeleton />}>
							<CommentSectionServer
								refId={page._id}
								refType="pages"
							/>
						</Suspense>
					</div>
				)
			}
		/>
	);
}
