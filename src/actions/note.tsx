"use server";

import { unstable_cache } from "next/cache";
import { MarkdownRenderer } from "@/components/common/markdown";

const renderProtectedNoteMarkdown = unstable_cache(
  async (_renderKey: string, content: string) => {
    return <MarkdownRenderer content={content} />;
  },
  ["protected-note-markdown"],
  { revalidate: 57600 },
);

export async function renderProtectedNoteMarkdownAction(renderKey: string, content: string) {
  return renderProtectedNoteMarkdown(renderKey, content);
}
