import type { RecentlyWithRendered } from "@/types/api";

import CommentLine from "~icons/mingcute/comment-line";
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
  return (
    <section id="recently">
      <SectionHeader
        title="碎碎念"
        icon={CommentLine}
        linkText="查看动态"
        linkHref="#"
      />
      <div>
        {recently.map(item => (
          <RecentlyItem key={item._id} item={item} />
        ))}
      </div>
    </section>
  );
}
