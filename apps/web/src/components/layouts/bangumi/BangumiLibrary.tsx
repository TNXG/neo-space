"use client";

import type { BangumiLibraryData, BangumiMediaKind } from "@/types/bangumi";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { BangumiSegmentedControl } from "./BangumiSegmentedControl";
import { MediaCollectionView } from "./MediaCollectionView";
import { PeopleCollectionView } from "./PeopleCollectionView";

type LibrarySection = BangumiMediaKind | "people";

interface BangumiLibraryProps {
  data: BangumiLibraryData;
}

/** 组织 Bangumi 收藏的一级导航与统计概览。 */
export function BangumiLibrary({ data }: BangumiLibraryProps) {
  const t = useTranslations("bangumi");
  const reduceMotion = useReducedMotion();
  const [section, setSection] = useState<LibrarySection>("anime");
  const peopleCount = data.characters.length + data.persons.length;
  const sectionOptions = [
    {
      value: "anime" as const,
      label: t("section.anime"),
      count: data.media.anime.length,
    },
    {
      value: "game" as const,
      label: t("section.game"),
      count: data.media.game.length,
    },
    {
      value: "book" as const,
      label: t("section.book"),
      count: data.media.book.length,
    },
    {
      value: "people" as const,
      label: t("section.people"),
      count: peopleCount,
    },
  ];

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/35 p-5 backdrop-blur-xl md:p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full bg-accent-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">
            {data.profile.avatar ? (
              <Image
                src={data.profile.avatar}
                alt={data.profile.nickname}
                width={56}
                height={56}
                unoptimized
                className="size-14 rounded-2xl border border-border/50 object-cover"
              />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <Icon icon="mingcute:user-3-line" className="size-6" />
              </div>
            )}
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent-600">
                @{data.profile.username}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-foreground">
                {data.profile.nickname}
              </h2>
              {data.profile.sign && (
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {data.profile.sign}
                </p>
              )}
            </div>
          </div>
          <a
            href={`https://bgm.tv/user/${data.profile.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 cursor-pointer items-center justify-center gap-2 self-start rounded-full border border-border/60 bg-background/50 px-4 text-xs font-medium text-foreground transition-colors hover:border-accent-500/40 hover:bg-accent-500/5 active:scale-[0.985] lg:self-auto"
          >
            {t("profile.open")}
            <Icon icon="mingcute:external-link-line" className="size-4" />
          </a>
        </div>
      </div>

      <BangumiSegmentedControl
        value={section}
        options={sectionOptions}
        onChange={setSection}
        label={t("section.label")}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={section}
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 12, scale: 0.985, filter: "blur(8px)" }
          }
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 12, scale: 0.985, filter: "blur(8px)" }
          }
          transition={{ duration: reduceMotion ? 0.18 : 0.3, ease: [0.23, 1, 0.32, 1] }}
          className={cn("min-h-80", section === "people" && "min-h-64")}
        >
          {section === "people" ? (
            <PeopleCollectionView
              characters={data.characters}
              persons={data.persons}
            />
          ) : (
            <MediaCollectionView kind={section} items={data.media[section]} />
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
