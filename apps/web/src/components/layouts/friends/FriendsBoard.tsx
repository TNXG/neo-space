"use client";

import type { Link } from "@/types/api";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { Icon } from "@/lib/inline-icon";
import { groupFriends } from "@/utils/friends";
import { FriendPostEntry, FriendQuietEntry } from "./FriendEntries";

interface FriendsBoardProps {
  friends: Link[];
  /** 申请入口，位于列表末尾 */
  apply?: React.ReactNode;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** 列表项进场：透明度 + 6px 位移，前 12 项错峰，其余同时出现避免长列表拖沓。 */
function reveal(index: number) {
  return {
    initial: { opacity: 0, transform: "translateY(6px)" },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { duration: 0.24, delay: Math.min(index, 12) * 0.035, ease: EASE_OUT },
  };
}

/** 分组标题：粗线分隔 + 图标 + 计数，右侧给出排序说明。 */
function GroupHeader({ id, icon, title, hint, count }: { id: string; icon: string; title: string; hint: string; count: number }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-4 border-b-2 border-foreground/80 pb-2">
      <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Icon icon={icon} className="size-4 text-muted-foreground" aria-hidden="true" />
        {title}
        <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">{count}</span>
      </h2>
      <span className="hidden text-xs text-muted-foreground sm:inline">{hint}</span>
    </div>
  );
}

/**
 * 内容驱动的友链版面：有最新文章的站点在前，
 * 无订阅或抓取失败的站点一起沉底；两组各自随机排序。
 * 服务端渲染使用稳定顺序，挂载后再洗牌，避免水合不一致。
 * @param props 友链与申请入口
 * @returns 友链版面
 */
export function FriendsBoard({ friends, apply }: FriendsBoardProps) {
  const t = useTranslations("friends");
  const mounted = useHasMounted();
  const { featured, quiet } = useMemo(() => groupFriends(friends, mounted ? Math.random : undefined), [friends, mounted]);

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center gap-8">
        <div className="flex w-full flex-col items-center justify-center gap-3 py-24 text-muted-foreground/60">
          <Icon icon="mingcute:ghost-line" className="size-12 opacity-40" aria-hidden="true" />
          <p>{t("empty")}</p>
        </div>
        {apply}
      </div>
    );
  }

  return (
    // key 随挂载切换：洗牌后的新顺序以一次轻量淡入替换，而不是逐卡跳位
    <motion.div key={mounted ? "shuffled" : "stable"} initial={mounted ? { opacity: 0.6 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: EASE_OUT }} className="flex flex-col gap-12">
      {featured.length === 0 && <p className="text-sm text-muted-foreground">{t("story.noFeeds")}</p>}

      {featured.length > 0 && (
        <section aria-labelledby="friends-writing">
          <GroupHeader id="friends-writing" icon="mingcute:quill-pen-line" title={t("sections.latest")} hint={t("sections.latestHint")} count={featured.length} />
          <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((link, index) => (
              <motion.li key={link._id} {...reveal(index)} className="border-b border-border/60">
                <FriendPostEntry link={link} />
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      {quiet.length > 0 && (
        <section aria-labelledby="friends-quiet">
          <GroupHeader id="friends-quiet" icon="mingcute:planet-line" title={t("sections.quiet")} hint={t("sections.quietHint")} count={quiet.length} />
          <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {quiet.map((link, index) => (
              <motion.li key={link._id} {...reveal(index)} className="border-b border-border/60">
                <FriendQuietEntry link={link} />
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      {apply}
    </motion.div>
  );
}
