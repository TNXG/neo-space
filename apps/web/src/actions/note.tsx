"use server";

import type { ReactNode } from "react";
import type { TOCItem } from "@/lib/toc";
import { unstable_cache } from "next/cache";
import { MarkdownRenderer } from "@/components/common/markdown/MarkdownRenderer";
import { unlockNoteByNid } from "@/lib/api-client";
import { extractTOC } from "@/lib/toc";

const renderProtectedNoteMarkdown = unstable_cache(
  async (_renderKey: string, content: string) => {
    return <MarkdownRenderer content={content} />;
  },
  ["protected-note-markdown"],
  { revalidate: 57600 },
);

export interface UnlockedNoteHeader {
  _id: string;
  nid: number;
  title: string;
  created: string;
  modified?: string;
  mood?: string;
  weather?: string;
  location?: string;
  lang: string;
  sourceLang: string;
  isAiTranslated: boolean;
  allowComment: boolean;
}

export interface UnlockedNoteResult {
  header: UnlockedNoteHeader;
  rendered: ReactNode;
  toc: TOCItem[];
}

export async function unlockAndRenderProtectedNoteAction(
  nid: number,
  password: string,
  lang: string,
): Promise<UnlockedNoteResult> {
  const unlockedNote = await unlockNoteByNid(nid, password, lang);
  const note = unlockedNote.data;
  const renderKey = [
    note._id,
    note.modified || note.created,
    lang,
  ].join(":");

  const [rendered, toc] = await Promise.all([
    renderProtectedNoteMarkdown(renderKey, note.text),
    extractTOC(note.text),
  ]);

  return {
    header: {
      _id: note._id,
      nid: note.nid,
      title: note.title,
      created: note.created,
      modified: note.modified,
      mood: note.mood,
      weather: note.weather,
      location: note.location,
      lang: note.lang,
      sourceLang: note.sourceLang,
      isAiTranslated: note.isAiTranslated,
      allowComment: note.allowComment,
    },
    rendered,
    toc,
  };
}
