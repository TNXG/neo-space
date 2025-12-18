import type { Note } from "@/types/api";
import Link from "next/link";
import { AbbreviationText } from "@/components/common/nbnhhsh";
import { SmartDate } from "@/components/common/smart-date";

interface NoteItemProps {
	note: Note;
}

/**
 * Note list item component
 */
export function NoteItem({ note }: NoteItemProps) {
	const noteUrl = `/notes/${note.nid}`;

	return (
		<Link href={noteUrl} className="group py-2 flex cursor-pointer items-center justify-between">
			<div className="flex gap-3 items-center min-w-0 flex-1">
				<div className="rounded-full bg-muted-foreground/30 h-1.5 w-1.5 transition-colors duration-150 group-hover:bg-primary shrink-0" />
				<span className="text-base transition-colors duration-150 text-foreground/70 group-hover:text-primary truncate">
					<AbbreviationText>{note.title}</AbbreviationText>
				</span>
			</div>
			{note.created && (
				<SmartDate
					date={note.created}
					modifiedDate={note.modified}
					className="text-xs font-mono text-muted-foreground ml-3 shrink-0"
				/>
			)}
		</Link>
	);
}
