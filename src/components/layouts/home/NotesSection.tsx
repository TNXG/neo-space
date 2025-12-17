import type { Note } from "@/types/api";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { NoteItem } from "./NoteItem";

interface NotesSectionProps {
	notes: Note[];
}

/**
 * Notes section component
 * Displays list of recent notes in a glassmorphic container
 */
export function NotesSection({ notes }: NotesSectionProps) {
	return (
		<section id="notes">
			<SectionHeader
				title="手记"
				icon="mingcute:pen-line"
				linkText="更多记录"
				linkHref="#"
			/>
			<div className="flex flex-col gap-1">
				{notes.map(note => (
					<NoteItem key={note._id} note={note} />
				))}
			</div>
		</section>
	);
}
