import type { Note } from "@/types/api";
import { useTranslations } from "next-intl";
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
  const t = useTranslations();

  return (
    <section id="notes">
      <SectionHeader
        title={t("home.section.notes")}
        icon="mingcute:pen-line"
        linkText={t("home.section.moreNotes")}
        linkHref="/notes"
      />
      <div className="flex flex-col gap-1">
        {notes.map(note => (
          <NoteItem key={note._id} note={note} />
        ))}
      </div>
    </section>
  );
}
