import { notFound } from "next/navigation";
import { MarkdownRenderer } from "@/components/common/markdown/MarkdownRenderer";
import { ArticleLayout, NoteHeader, OutdatedAlert } from "@/components/layouts/article";
import { getNoteByNid } from "@/lib/api-client";
import { extractTOC } from "@/lib/toc";

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
		return { title: "日记不存在" };

	try {
		const { data: note } = await getNoteByNid(nidNum);
		return {
			title: note.title,
			description: note.text.slice(0, 100),
		};
	} catch {
		return { title: "日记不存在" };
	}
}

export default async function NotePage({ params }: PageProps) {
	const { nid } = await params;
	const nidNum = Number.parseInt(nid, 10);
	if (Number.isNaN(nidNum))
		notFound();

	let note;
	let toc;
	try {
		const { data } = await getNoteByNid(nidNum);
		note = data;
		toc = await extractTOC(note.text);
	} catch {
		notFound();
	}

	return (
		<ArticleLayout
			toc={toc}
			header={(
				<NoteHeader
					title={note.title}
					nid={note.nid}
					created={note.created}
					modified={note.modified}
					mood={note.mood}
					weather={note.weather}
					location={note.location}
				/>
			)}
			content={(
				<>
					<OutdatedAlert lastUpdated={note.modified || note.created} />
					<MarkdownRenderer content={note.text} />
				</>
			)}
		/>
	);
}
