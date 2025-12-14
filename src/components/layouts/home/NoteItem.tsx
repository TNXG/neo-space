import type { Note } from "@/types/api";
import { AbbreviationText } from "@/components/common/nbnhhsh";

interface NoteItemProps {
	note: Note;
}

/**
 * Note list item component
 */
export function NoteItem({ note }: NoteItemProps) {
	const formattedDate = note.created
		? new Date(note.created).toLocaleDateString("zh-CN", {
				month: "2-digit",
				day: "2-digit",
			})
		: "";

	return (
		<div className="group py-2 flex cursor-pointer items-center justify-between">
			<div className="flex gap-3 items-center">
				<div className="rounded-full bg-stone-300 dark:bg-stone-700 h-1.5 w-1.5 transition-colors duration-150 group-hover:bg-accent-500" />
				<span className="text-base transition-colors duration-150 text-primary-500 group-hover:text-accent-600">
					<AbbreviationText>{note.title}</AbbreviationText>
				</span>
			</div>
			<span className="text-xs font-mono text-neutral-500">
				{formattedDate}
			</span>
		</div>
	);
}
