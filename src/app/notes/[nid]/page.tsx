import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommentSectionServer, CommentSkeleton } from "@/components/comment";
import { MarkdownRenderer } from "@/components/common/markdown/MarkdownRenderer";
import { ArticleLayout, NoteHeader, OutdatedAlert } from "@/components/layouts/article";
import { getAdjacentNotes, getNoteByNid } from "@/lib/api-client";
import { extractTOC } from "@/lib/toc";

export const revalidate = false;

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
	let adjacentNotes;

	try {
		// 并行获取手记内容和相邻手记信息
		const [noteResponse, adjacentResponse] = await Promise.all([
			getNoteByNid(nidNum),
			getAdjacentNotes(nidNum),
		]);

		note = noteResponse.data;
		adjacentNotes = adjacentResponse.data;
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
					<OutdatedAlert
						refId={note._id}
						refType="note"
						lastUpdated={note.modified || note.created}
					/>
					<MarkdownRenderer content={note.text} />
				</>
			)}
			footer={note.allowComment && (
				<Suspense fallback={<CommentSkeleton />}>
					<CommentSectionServer
						refId={note._id}
						refType="notes"
					/>
				</Suspense>
			)}
			navigation={{
				type: "note",
				prevLink: adjacentNotes.prev ? `/notes/${adjacentNotes.prev.nid}` : undefined,
				nextLink: adjacentNotes.next ? `/notes/${adjacentNotes.next.nid}` : undefined,
				prevTitle: adjacentNotes.prev?.title,
				nextTitle: adjacentNotes.next?.title,
			}}
		/>
	);
}
