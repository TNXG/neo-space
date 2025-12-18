import { notFound } from "next/navigation";
import { MarkdownRenderer } from "@/components/common/markdown/MarkdownRenderer";
import { getPageBySlug } from "@/lib/api-client";

export const revalidate = 60;

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

	return (
		<main className="container mx-auto px-4 py-8 max-w-4xl">
			<article>
				<header className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-8">
					<h1 className="text-4xl font-bold bg-linear-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent mb-4">
						{page.title}
					</h1>
					<div className="flex flex-wrap gap-4 text-sm text-gray-500">
						<span>
							更新于
							{new Date(page.created).toLocaleDateString()}
						</span>
					</div>
				</header>
				<MarkdownRenderer content={page.text} />
			</article>
		</main>
	);
}
