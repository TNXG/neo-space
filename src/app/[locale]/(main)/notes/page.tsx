import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NoteInteractiveList } from "@/components/common/InteractiveList";
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
      <header className="mb-20 md:text-center max-w-2xl mx-auto flex flex-col items-center">
        {/*
                   主标题区域
                   标题按 locale 切换，英文副标固定为 Sparkle
                   配色: Teal -> Stone 渐变 (强调 Accent)
                */}
        <div className="mb-6 flex flex-col items-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-linear-to-r from-accent-600 to-primary-600 bg-clip-text text-transparent leading-tight py-2 select-none">
            {t("notes.hero.title")}
          </h1>
          <span className="text-sm md:text-base font-medium tracking-[0.3em] text-primary-500/60 uppercase mt-1 font-mono">
            {t("notes.hero.eyebrow")}
          </span>
        </div>

        {/*
                   副标题区域
                   主文案与辅助文案按 locale 分离
                */}
        <div className="text-primary-600 font-medium flex items-center justify-center gap-4 w-full">
          <span className="w-8 md:w-12 h-px bg-primary-300 inline-block opacity-70"></span>
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-lg md:text-xl tracking-wide text-primary-700">
              {t("notes.hero.subtitle")}
            </span>
            <span className="text-xs md:text-sm text-primary-400/80 font-normal italic tracking-wide mt-1 font-serif">
              {t("notes.hero.subtitleAlt")}
            </span>
          </div>
          <span className="w-8 md:w-12 h-px bg-primary-300 inline-block opacity-70"></span>
        </div>
      </header>

      <NoteInteractiveList
        items={data.items}
        emptyMessage={t("interactive.empty.note")}
      />
    </main>
  );
}
