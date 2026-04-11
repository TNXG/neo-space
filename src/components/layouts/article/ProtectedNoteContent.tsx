"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { renderProtectedNoteMarkdownAction } from "@/actions/note";
import { Button } from "@/components/ui/button";
import { unlockNoteByNid } from "@/lib/api-client";

interface ProtectedNoteContentProps {
  nid: number;
  lang: string;
}

export function ProtectedNoteContent({ nid, lang }: ProtectedNoteContentProps) {
  const [password, setPassword] = useState("");
  const [renderedContent, setRenderedContent] = useState<ReactNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsUnlocking(true);
      setError(null);

      const unlockedNote = await unlockNoteByNid(nid, password, lang);
      const renderKey = [
        unlockedNote.data._id,
        unlockedNote.data.modified || unlockedNote.data.created,
        lang,
      ].join(":");
      const renderedMarkdown = await renderProtectedNoteMarkdownAction(renderKey, unlockedNote.data.text);

      setRenderedContent(renderedMarkdown);
      setPassword("");
    } catch {
      setError("密码错误，或这篇日记不能解锁。");
    } finally {
      setIsUnlocking(false);
    }
  }

  if (renderedContent) {
    return renderedContent;
  }

  return (
    <section className="my-8 border border-border/60 bg-background/70 p-6 backdrop-blur-sm">
      <h2 className="text-xl font-semibold text-foreground">这篇日记已加密</h2>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        输入密码后由后端校验，正文会在服务端渲染为 HTML。
      </p>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <input
          className="min-h-10 flex-1 border border-border/60 bg-background px-3 text-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-400/30"
          type="password"
          value={password}
          autoComplete="current-password"
          placeholder="输入密码"
          onChange={event => setPassword(event.target.value)}
        />
        <Button type="submit" disabled={!password || isUnlocking}>
          {isUnlocking ? "解锁中" : "解锁"}
        </Button>
      </form>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
