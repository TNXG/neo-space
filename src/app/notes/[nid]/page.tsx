import { notFound } from "next/navigation";
import { MarkdownRenderer } from "@/components/common/markdown/MarkdownRenderer";
import { getNoteByNid } from "@/lib/api-client";

export const revalidate = 60;

interface PageProps {
	params: Promise<{
		nid: string;
	}>;
}

export async function generateMetadata({ params }: PageProps) {
	const { nid } = await params;
	const nidNum = Number.parseInt(nid, 10);
	if (Number.isNaN(nidNum))
		return { title: "日记不存在 | 天翔的博客" };

	try {
		const { data: note } = await getNoteByNid(nidNum);
		return {
			title: `${note.title} | 天翔的博客`,
			description: note.text.slice(0, 100),
		};
	} catch {
		return {
			title: "日记不存在 | 天翔的博客",
		};
	}
}

export default async function NotePage({ params }: PageProps) {
	const { nid } = await params;
	const nidNum = Number.parseInt(nid, 10);
	if (Number.isNaN(nidNum))
		notFound();

	let note;
	try {
		const { data } = await getNoteByNid(nidNum);
		note = data;
	} catch {
		notFound();
	}

	return (
		<main className="container mx-auto px-4 py-8 max-w-4xl">
			<article>
				<header className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-8">
					<h1 className="text-4xl font-bold bg-linear-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent mb-4">
						{note.title}
					</h1>
					<div className="flex flex-wrap gap-4 text-sm text-gray-500">
						<span>
							记录于
							{new Date(note.created).toLocaleDateString()}
						</span>
						{note.weather && (
							<span>
								天气:
								{note.weather}
							</span>
						)}
						{note.mood && (
							<span>
								心情:
								{note.mood}
							</span>
						)}
						{note.location && (
							<span>
								地点:
								{note.location}
							</span>
						)}
					</div>
				</header>
				<MarkdownRenderer content={note.text} />
			</article>
		</main>
	);
}
