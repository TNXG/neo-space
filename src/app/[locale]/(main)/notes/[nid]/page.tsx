import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommentSectionServer, CommentSkeleton } from "@/components/comment";
import { MarkdownRenderer } from "@/components/common/markdown";
import { ArticleLayout, NoteHeader, OutdatedAlert } from "@/components/layouts/article";
import { generateArticleJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { getAdjacentNotes, getNoteByNid, getNotes, getSiteConfig } from "@/lib/api-client";
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
  } catch {
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
  let toc;
  let adjacentNotes;
  let authorName = "作者";

  try {
    // 并行获取手记内容、相邻手记信息和站点配置
    const [noteResponse, adjacentResponse, configResponse] = await Promise.all([
      getNoteByNid(nidNum, locale),
      getAdjacentNotes(nidNum, locale),
      getSiteConfig().catch(() => null),
    ]);

    note = noteResponse.data;
    adjacentNotes = adjacentResponse.data;
    toc = await extractTOC(note.text);

    if (configResponse) {
      authorName = configResponse.data.seo.title;
    }
  } catch {
    notFound();
  }

  // 生成 JSON-LD 结构化数据
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe";
  const jsonLd = generateArticleJsonLd({
    title: note.title,
    description: note.text.slice(0, 150).replace(NEWLINE_REGEX, " "),
    url: `${baseUrl}/notes/${note.nid}`,
    datePublished: note.created,
    dateModified: note.modified || note.created,
    authorName,
  });

  return (
    <>
      <JsonLd data={jsonLd} />
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
            <OutdatedAlert
              refId={note._id}
              refType="note"
              lang={locale}
              lastUpdated={note.modified || note.created}
            />
            <MarkdownRenderer content={note.text} />
          </>
        )}
        footer={note.allowComment && (
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
