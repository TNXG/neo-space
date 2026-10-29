"use client";

import { motion } from "motion/react";
import { useDashboardSession } from "@/hooks/use-dashboard-session";
import { Icon } from "@/lib/inline-icon";
import { Link } from "@/locales/navigation";
import { settingLinks } from "./DashboardNavigation";
import { useProfileDraftStore, useSettingsDrafts } from "./settings/use-settings-draft";

const CONTENT_LINKS = [
  { href: "/dashboard/posts", title: "文章", help: "写作、发布与管理文章", icon: "mingcute:document-2-line", create: "写文章" },
  { href: "/dashboard/pages", title: "页面", help: "关于等独立页面", icon: "mingcute:file-line", create: "新建页面" },
];

const greetings = [[5, "凌晨好"], [11, "早上好"], [13, "中午好"], [18, "下午好"], [24, "晚上好"]] as const;

/** 总览只展示真实可达入口与未保存草稿，不以占位统计填充。 */
export function DashboardOverview() {
  const { data: user } = useDashboardSession();
  const drafts = useSettingsDrafts();
  const profileDirty = useProfileDraftStore(state => state.draft !== undefined);
  const unsaved = settingLinks.filter(item => item.key === "profile" ? profileDirty : item.key in drafts);
  const hour = new Date().getHours();
  const greeting = greetings.find(([until]) => hour < until)?.[1] ?? "你好";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-5 lg:px-6 lg:py-8">
      <motion.header initial={{ opacity: 0, y: 8, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }} className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{greeting}，{user?.name ?? "主人"}</h2>
        <p className="text-sm text-muted-foreground">从这里继续打理你的空间。</p>
      </motion.header>

      {unsaved.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05, ease: [0.23, 1, 0.32, 1] }} aria-labelledby="overview-unsaved" className="flex flex-col gap-2">
          <h3 id="overview-unsaved" className="flex items-center gap-2 text-sm font-semibold"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />继续编辑</h3>
          <ul className="flex flex-wrap gap-2">
            {unsaved.map(item => (
              <li key={item.key}>
                <Link href={item.href} className="group/draft flex cursor-pointer items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-[0.8125rem] outline-none transition-colors duration-(--motion-duration-fast) hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring">
                  <Icon icon={item.icon} className="size-4 text-primary" aria-hidden="true" />{item.title}<span className="text-xs text-muted-foreground">有未保存修改</span>
                  <Icon icon="mingcute:arrow-right-line" className="size-3.5 text-muted-foreground transition-transform duration-(--motion-duration-fast) group-hover/draft:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <section aria-labelledby="overview-content" className="flex flex-col gap-3">
        <h3 id="overview-content" className="text-sm font-semibold">内容</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CONTENT_LINKS.map((item, index) => (
            <motion.li key={item.href} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, delay: 0.06 + index * 0.03, ease: [0.23, 1, 0.32, 1] }} className="flex items-stretch gap-2">
              <Link href={item.href} className="group/card flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-border p-3 outline-none transition-colors duration-(--motion-duration-fast) hover:border-foreground/20 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/75 transition-colors group-hover/card:text-foreground" aria-hidden="true"><Icon icon={item.icon} className="size-4.5" /></span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{item.help}</span>
                </span>
              </Link>
              <Link href={`${item.href}/new`} aria-label={item.create} title={item.create} className="flex w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border text-muted-foreground outline-none transition-colors duration-(--motion-duration-fast) hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
                <Icon icon="mingcute:add-line" className="size-4.5" aria-hidden="true" />
              </Link>
            </motion.li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="overview-settings" className="flex flex-col gap-3">
        <h3 id="overview-settings" className="text-sm font-semibold">设置</h3>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {settingLinks.map((item, index) => (
            <motion.li key={item.key} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, delay: 0.08 + Math.min(index, 8) * 0.03, ease: [0.23, 1, 0.32, 1] }}>
              <Link href={item.href} className="group/card flex h-full cursor-pointer items-center gap-3 rounded-xl border border-border p-3 outline-none transition-colors duration-(--motion-duration-fast) hover:border-foreground/20 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/75 transition-colors group-hover/card:text-foreground" aria-hidden="true"><Icon icon={item.icon} className="size-4.5" /></span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  {item.help && <span className="truncate text-xs text-muted-foreground">{item.help}</span>}
                </span>
                <Icon icon="mingcute:right-line" className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--motion-duration-fast) group-hover/card:translate-x-0.5" aria-hidden="true" />
              </Link>
            </motion.li>
          ))}
        </ul>
      </section>
    </div>
  );
}
