import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NoteInteractiveList } from "@/components/common/InteractiveList";
import { PageHero } from "@/components/common/PageHero";
import { getNotes } from "@/lib/api-client";

interface NotesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: NotesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: t("notes.meta.title"),
    description: t("notes.meta.description"),
  };
}

export const revalidate = 57600;

/**
 * 默认显示第一页
 * 不携带任何参数，完全静态化
 */
export default async function NotesPage({
  params,
}: NotesPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const page = 1;
  const pageSize = 10;

  const { data } = await getNotes(page, pageSize, locale);

  return (
    <main className="container mx-auto px-4 py-16 max-w-6xl">
      <PageHero
        title={t("notes.hero.title")}
        eyebrow={t("notes.hero.eyebrow")}
        subtitle={t("notes.hero.subtitle")}
        subtitleAlt={t("notes.hero.subtitleAlt")}
      />

      <NoteInteractiveList
        items={data.items}
        emptyMessage={t("interactive.empty.note")}
      />
    </main>
  );
}
