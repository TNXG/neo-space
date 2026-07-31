"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/lib/inline-icon";
import { Link, useRouter } from "@/locales/navigation";

interface ArticleNavButtonsProps {
  prevLink?: string;
  nextLink?: string;
  prevTitle?: string;
  nextTitle?: string;
  type?: "post" | "note";
}

/**
 * 文章/手记底部导航组件
 * 包含：返回/首页 (系统导航) + 上一篇/下一篇 (内容导航)
 */
export function ArticleNavButtons({
  prevLink,
  nextLink,
  prevTitle,
  nextTitle,
  type = "post",
}: ArticleNavButtonsProps) {
  const t = useTranslations();
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/", { transitionTypes: ["nav-back"] });
    }
  };

  return (
    <nav className="w-full mt-16 pt-6 border-t border-border/40">
      <div className="flex flex-col gap-8">

        {/* 系统导航 (极简文本链接) */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
          >
            <Icon icon="mingcute:arrow-left-line" className="text-[15px]" />
            <span>{t("article.back")}</span>
          </button>
          <span className="text-border/60">/</span>
          <Link
            href="/"
            transitionTypes={["nav-back"]}
            className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
          >
            <Icon icon="mingcute:home-2-line" className="text-[15px]" />
            <span>{t("article.home")}</span>
          </Link>
        </div>

        {/* 内容导航 (左右文字排版，无卡片，无位移) */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 sm:gap-4 w-full">
          {/* Previous */}
          <div className="flex-1 min-w-0">
            {prevLink && (
              <Link
                href={prevLink}
                transitionTypes={["nav-back"]}
                className="group flex flex-col items-start gap-1.5 w-full cursor-pointer"
              >
                <div className="text-xs text-muted-foreground">
                  {t("article.previous")}
                </div>
                <div className="text-sm sm:text-base font-medium text-foreground/80 group-hover:text-accent-600 transition-colors line-clamp-2">
                  {prevTitle || t(type === "note" ? "article.previousNoteFallback" : "article.previousPostFallback")}
                </div>
              </Link>
            )}
          </div>

          {/* Next */}
          <div className="flex-1 min-w-0 sm:text-right">
            {nextLink && (
              <Link
                href={nextLink}
                transitionTypes={["nav-forward"]}
                className="group flex flex-col items-start sm:items-end gap-1.5 w-full cursor-pointer"
              >
                <div className="text-xs text-muted-foreground">
                  {t("article.next")}
                </div>
                <div className="text-sm sm:text-base font-medium text-foreground/80 group-hover:text-accent-600 transition-colors line-clamp-2">
                  {nextTitle || t(type === "note" ? "article.nextNoteFallback" : "article.nextPostFallback")}
                </div>
              </Link>
            )}
          </div>
        </div>

      </div>
    </nav>
  );
}
