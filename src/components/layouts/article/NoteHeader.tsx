import { useTranslations } from "next-intl";
import { SmartDate } from "@/components/common/smart-date";

interface NoteHeaderProps {
  title: string;
  nid: number;
  created: string;
  modified?: string;
  lang?: string;
  sourceLang?: string;
  isAiTranslated?: boolean;
  mood?: string;
  weather?: string;
  location?: string;
}

/**
 * 日记头部组件
 * 显示标题、日期、心情、天气、地点等元信息
 */
export function NoteHeader({
  title,
  nid,
  created,
  modified,
  lang = "zh",
  sourceLang = "zh",
  isAiTranslated = false,
  mood,
  weather,
  location,
}: NoteHeaderProps) {
  const t = useTranslations();
  const sourceLanguageLabel = t.has(`article.language.${sourceLang}`)
    ? t(`article.language.${sourceLang}`)
    : sourceLang.toUpperCase();
  const targetLanguageLabel = t.has(`article.language.${lang}`)
    ? t(`article.language.${lang}`)
    : lang.toUpperCase();
  const translationType = sourceLang === lang
    ? "original"
    : isAiTranslated
      ? "ai"
      : "human";
  const originLabel = t(`article.translationType.${translationType}`);

  return (
    <header className="mb-12 pb-8 border-b border-border/50">
      {/* 类型标签 */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Note
        </span>
        <span className="text-xs text-muted-foreground/60">
          #
          {nid}
        </span>
      </div>

      {/* 标题 */}
      <h1 className="text-3xl lg:text-5xl font-bold text-foreground mb-6 leading-tight tracking-tight">
        {title}
      </h1>

      {/* 元信息 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {/* 发布日期 */}
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/60">{t("article.recordedAt")}</span>
          <SmartDate date={created} />
        </span>

        {/* 更新日期 */}
        {modified && modified !== created && (
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground/60">{t("article.updatedAt")}</span>
            <SmartDate date={modified} />
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/60">·</span>
          <span>{t("article.languageMeta", { source: sourceLanguageLabel, target: targetLanguageLabel })}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/60">·</span>
          <span>{t("article.translationMeta", { origin: originLabel })}</span>
        </span>
      </div>

      {/* 日记特有元信息：心情、天气、地点 */}
      {(mood || weather || location) && (
        <div className="flex flex-wrap gap-3 mt-4">
          {mood && (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-accent/30 text-accent-foreground">
              <span>💭</span>
              {mood}
            </span>
          )}
          {weather && (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-accent/30 text-accent-foreground">
              <span>🌤</span>
              {weather}
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-accent/30 text-accent-foreground">
              <span>📍</span>
              {location}
            </span>
          )}
        </div>
      )}
    </header>
  );
}
