import type { RecentlyWithRendered } from "@/types/api";
import { useTranslations } from "next-intl";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { RecentlyItem } from "./RecentlyItem";

interface RecentlySectionProps {
  recently: RecentlyWithRendered[];
}

/**
 * Recently section component
 * Displays recent thoughts/activities
 */
export function RecentlySection({ recently }: RecentlySectionProps) {
  const t = useTranslations();

  return (
    <section id="recently">
      <SectionHeader
        title={t("home.section.thinking")}
        icon="mingcute:comment-line"
        linkText={t("home.section.viewThinking")}
        linkHref="/thinking"
      />
      <div>
        {recently.map(item => (
          <RecentlyItem key={item._id} item={item} />
        ))}
      </div>
    </section>
  );
}
