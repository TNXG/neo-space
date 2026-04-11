"use server";

import { MarkdownRenderer } from "@/components/common/markdown";

export async function renderProtectedNoteMarkdownAction(content: string) {
  return <MarkdownRenderer content={content} />;
}
