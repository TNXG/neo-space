"use client";

import type { SettingPage } from "./settings-groups";
import { CacheSettings } from "./cache-settings";
import { SettingsForm } from "./settings-form";

/** 同一场景共用滚动区域，每个后端配置保留独立草稿与保存边界。 */
export function SettingsPage({ page }: { page: SettingPage }) {
  if (page.groups.length === 1) return <SettingsForm group={page.groups[0]} />;
  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-9 px-4 py-6 lg:px-6 lg:py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{page.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{page.help}</p>
          <nav aria-label="本页设置" className="flex flex-wrap gap-2 pt-2">
            {page.groups.map(group => <a key={group.key} href={`#${group.key}`} className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring">{group.title}</a>)}
            {page.slug === "site" && <a href="#public-content-cache" className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring">访问缓存</a>}
          </nav>
        </header>
        {page.groups.map(group => (
          <section key={group.key} id={group.key} aria-label={group.title} className="scroll-mt-6">
            <SettingsForm group={group} embedded />
          </section>
        ))}
        {page.slug === "site" && (
          <section id="public-content-cache" aria-label="访问缓存" className="scroll-mt-6">
            <CacheSettings index={page.groups.length} />
          </section>
        )}
      </div>
    </div>
  );
}
