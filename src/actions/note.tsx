"use server";

import { unstable_cache } from "next/cache";
import { MarkdownRenderer } from "@/components/common/markdown";
import { unlockNoteByNid } from "@/lib/api-client";

const renderProtectedNoteMarkdown = unstable_cache(
  async (_renderKey: string, content: string) => {
    return <MarkdownRenderer content={content} />;
  },
  ["protected-note-markdown"],
  { revalidate: 57600 },
);

export async function unlockAndRenderProtectedNoteAction(nid: number, password: string, lang: string) {
  const unlockedNote = await unlockNoteByNid(nid, password, lang);
  const renderKey = [
    unlockedNote.data._id,
    unlockedNote.data.modified || unlockedNote.data.created,
    lang,
  ].join(":");

  return renderProtectedNoteMarkdown(renderKey, unlockedNote.data.text);
}
