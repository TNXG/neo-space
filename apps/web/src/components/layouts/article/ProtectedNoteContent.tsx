"use client";

import type { FormEvent, ReactNode } from "react";
import type { UnlockedNoteHeader } from "@/actions/note";
import { useEffect, useState } from "react";
import { unlockAndRenderProtectedNoteAction } from "@/actions/note";
import { Button } from "@/components/ui/button";
import { useTOCStore } from "@/stores/toc-store";
import { NoteHeader } from "./NoteHeader";

interface ProtectedNoteContentProps {
  nid: number;
  lang: string;
  initialHeader: UnlockedNoteHeader;
  onUnlocked?: (header: UnlockedNoteHeader) => void;
}

export function ProtectedNoteContent({ nid, lang, initialHeader, onUnlocked }: ProtectedNoteContentProps) {
  const [password, setPassword] = useState("");
  const [renderedContent, setRenderedContent] = useState<ReactNode | null>(null);
  const [header, setHeader] = useState<UnlockedNoteHeader>(initialHeader);
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const setItems = useTOCStore(state => state.setItems);

  // 解锁前先把 TOC 清空，避免上一篇遗留
  useEffect(() => {
    if (!renderedContent) {
      setItems([]);
    }
  }, [renderedContent, setItems]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsUnlocking(true);
      setError(null);

      const result = await unlockAndRenderProtectedNoteAction(nid, password, lang);

      setHeader(result.header);
      setItems(result.toc);
      setRenderedContent(result.rendered);
      onUnlocked?.(result.header);
      setPassword("");
    } catch {
      setError("密码错误，或这篇日记不能解锁。");
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <>
      <NoteHeader
        title={header.title}
        nid={header.nid}
        created={header.created}
        modified={header.modified}
        lang={header.lang}
        sourceLang={header.sourceLang}
        isAiTranslated={header.isAiTranslated}
        mood={header.mood}
        weather={header.weather}
        location={header.location}
      />
      {renderedContent || (
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
      )}
    </>
  );
}
