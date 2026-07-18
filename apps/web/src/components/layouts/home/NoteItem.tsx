import type { Note } from "@/types/api";
import { SmartDate } from "@/components/common/smart-date";
import { Link } from "@/locales/navigation";

interface NoteItemProps {
  note: Note;
}

/**
 * Note list item component
 */
export function NoteItem({ note }: NoteItemProps) {
  const noteUrl = `/notes/${note.nid}`;

  return (
    <Link href={noteUrl} className="group py-1.5 md:py-2 flex cursor-pointer items-center justify-between">
      <div className="flex gap-2.5 md:gap-3 items-center min-w-0 flex-1">
        <div className="rounded-full bg-muted-foreground/30 h-1.5 w-1.5 transition-colors duration-150 group-hover:bg-accent-600 shrink-0" />
        <span className="text-sm md:text-base transition-colors duration-150 text-foreground/70 group-hover:text-accent-600 truncate">
          {note.title}
        </span>
      </div>
      {note.created && (
        <SmartDate
          date={note.created}
          modifiedDate={note.modified}
          className="text-[11px] md:text-xs font-mono text-muted-foreground ml-2 md:ml-3 shrink-0"
        />
      )}
    </Link>
  );
}
