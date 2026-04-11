import type { AdjacentNotes } from "@/lib/api-client";
import type { TOCItem } from "@/lib/toc";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommentSectionServer, CommentSkeleton } from "@/components/comment";
import { MarkdownRenderer } from "@/components/common/markdown";
import { ArticleLayout, NoteHeader, OutdatedAlert, ProtectedNoteContent } from "@/components/layouts/article";
import { generateArticleJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { ApiClientError, getAdjacentNotes, getNoteByNid, getNotes, getSiteConfig } from "@/lib/api-client";
import { extractTOC } from "@/lib/toc";

// Static regex patterns to avoid re-compilation
const NEWLINE_REGEX = /\n/g;

// ISR 配置：16小时过期
export const revalidate = 57600;

// 预生成最新的 20 篇日记
export async function generateStaticParams() {
  try {
    const { data } = await getNotes(1, 20);
    return data.items.map(note => ({
      nid: String(note.nid),
    }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{
    locale: string;
    nid: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { nid, locale } = await params;
  const nidNum = Number.parseInt(nid, 10);
  if (Number.isNaN(nidNum))
    return { title: "日记不存在" };

  try {
    const { data: note } = await getNoteByNid(nidNum, locale);
    const description = note.text.slice(0, 150).replace(NEWLINE_REGEX, " ");
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe";

    return {
      title: note.title,
      description,
      openGraph: {
        title: note.title,
        description,
        type: "article",
        publishedTime: note.created,
        modifiedTime: note.modified || note.created,
        url: `${baseUrl}/notes/${note.nid}`,
      },
      twitter: {
        card: "summary",
        title: note.title,
        description,
      },
    };
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 403) {
      return {
        title: `加密日记 #${nidNum}`,
        description: "这篇日记已加密。",
      };
    }

    return { title: "日记不存在" };
  }
}

export default async function NotePage({ params }: PageProps) {
  const { nid, locale } = await params;
  const t = await getTranslations({ locale });
  const nidNum = Number.parseInt(nid, 10);
  if (Number.isNaN(nidNum))
    notFound();

  let note;
  let toc: TOCItem[];
  let adjacentNotes: AdjacentNotes = { prev: null, next: null };
  let authorName = "作者";
  let isProtected = false;

  try {
    const [adjacentResponse, configResponse] = await Promise.all([
      getAdjacentNotes(nidNum, locale).catch(() => null),
      getSiteConfig().catch(() => null),
    ]);

    const noteResponse = await getNoteByNid(nidNum, locale);
    note = noteResponse.data;
    adjacentNotes = adjacentResponse?.data ?? adjacentNotes;
    toc = await extractTOC(note.text);

    if (configResponse) {
      authorName = configResponse.data.seo.title;
    }
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.status !== 403) {
      notFound();
    }

    isProtected = true;
    note = {
      _id: `protected-note-${nidNum}`,
      nid: nidNum,
      title: `加密日记 #${nidNum}`,
      text: "",
      created: new Date().toISOString(),
      lang: locale,
      sourceLang: locale,
      isAiTranslated: false,
      modified: undefined,
      mood: undefined,
      weather: undefined,
      location: undefined,
      allowComment: false,
      isPublished: true,
      bookmark: false,
      images: [],
      isEncrypted: true,
    };
    toc = [];
  }

  // 生成 JSON-LD 结构化数据
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe";
  const jsonLd = isProtected
    ? null
    : generateArticleJsonLd({
        title: note.title,
        description: note.text.slice(0, 150).replace(NEWLINE_REGEX, " "),
        url: `${baseUrl}/notes/${note.nid}`,
        datePublished: note.created,
        dateModified: note.modified || note.created,
        authorName,
      });

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <ArticleLayout
        toc={toc}
        breadcrumbs={[
          { label: t("nav.home"), href: "/" },
          { label: t("nav.notes"), href: "/notes" },
          { label: note.title },
        ]}
        header={(
          <NoteHeader
            title={note.title}
            nid={note.nid}
            created={note.created}
            modified={note.modified}
            lang={note.lang}
            sourceLang={note.sourceLang}
            isAiTranslated={note.isAiTranslated}
            mood={note.mood}
            weather={note.weather}
            location={note.location}
          />
        )}
        content={(
          <>
            {!isProtected && (
              <OutdatedAlert
                refId={note._id}
                refType="note"
                lang={locale}
                lastUpdated={note.modified || note.created}
              />
            )}
            {isProtected
              ? <ProtectedNoteContent nid={nidNum} lang={locale} />
              : <MarkdownRenderer content={note.text} />}
          </>
        )}
        footer={!isProtected && note.allowComment && (
          <Suspense fallback={<CommentSkeleton />}>
            <CommentSectionServer
              refId={note._id}
              refType="notes"
            />
          </Suspense>
        )}
        navigation={{
          type: "note",
          prevLink: adjacentNotes.prev ? `/notes/${adjacentNotes.prev.nid}` : undefined,
          nextLink: adjacentNotes.next ? `/notes/${adjacentNotes.next.nid}` : undefined,
          prevTitle: adjacentNotes.prev?.title,
          nextTitle: adjacentNotes.next?.title,
        }}
      />
    </>
  );
}
