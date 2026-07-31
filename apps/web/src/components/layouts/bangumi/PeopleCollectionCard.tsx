"use client";

import type {
  BangumiCharacterCollection,
  BangumiCharacterType,
  BangumiPersonCollection,
  BangumiPersonType,
} from "@/types/bangumi";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { BangumiArtwork } from "./BangumiArtwork";

interface PeopleCollectionCardProps {
  index: number;
}

interface CharacterCollectionCardProps extends PeopleCollectionCardProps {
  item: BangumiCharacterCollection;
}

interface PersonCollectionCardProps extends PeopleCollectionCardProps {
  item: BangumiPersonCollection;
}

/** 返回虚构角色子类型的本地化键。 */
export function getCharacterTypeKey(type: BangumiCharacterType): string {
  return (
    { 1: "character", 2: "mechanic", 3: "ship", 4: "organization" } as const
  )[type];
}

/** 返回现实人物主体类型的本地化键。 */
export function getPersonTypeKey(type: BangumiPersonType): string {
  return ({ 1: "individual", 2: "corporation", 3: "association" } as const)[
    type
  ];
}

/** 渲染虚构人物收藏卡，并将视觉焦点稳定在头部和上半身。 */
export function CharacterCollectionCard({
  item,
  index,
}: CharacterCollectionCardProps) {
  const t = useTranslations("bangumi");
  const reduceMotion = useReducedMotion();

  return (
    <motion.a
      href={`https://bgm.tv/character/${item.id}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 10, filter: "blur(4px)" }
      }
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: 0.22,
        delay: reduceMotion ? 0 : Math.min(index, 10) * 0.025,
        ease: [0.23, 1, 0.32, 1],
      }}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-border/40 bg-card/45 backdrop-blur-xl transition-[border-color,background-color] duration-200 hover:border-accent-500/35 hover:bg-card/70 active:scale-[0.985]"
    >
      <BangumiArtwork
        src={item.images?.large || item.images?.medium}
        alt={item.name}
        className="aspect-[4/5] w-full"
        variant="portrait"
        crop={item.crop}
      />
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground">
          {item.name}
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t(`people.characterType.${getCharacterTypeKey(item.type)}`)}
        </p>
      </div>
    </motion.a>
  );
}

/** 渲染现实人物收藏卡，并展示其主体类型与职业标签。 */
export function PersonCollectionCard({
  item,
  index,
}: PersonCollectionCardProps) {
  const t = useTranslations("bangumi");
  const reduceMotion = useReducedMotion();

  return (
    <motion.a
      href={`https://bgm.tv/person/${item.id}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: 10, filter: "blur(4px)" }
      }
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: 0.22,
        delay: reduceMotion ? 0 : Math.min(index, 10) * 0.025,
        ease: [0.23, 1, 0.32, 1],
      }}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-border/40 bg-card/45 backdrop-blur-xl transition-[border-color,background-color] duration-200 hover:border-accent-500/35 hover:bg-card/70 active:scale-[0.985]"
    >
      <BangumiArtwork
        src={item.images?.large || item.images?.medium}
        alt={item.name}
        className="aspect-[4/5] w-full"
        variant="portrait"
        crop={item.crop}
      />
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground">
          {item.name}
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t(`people.personType.${getPersonTypeKey(item.type)}`)}
        </p>
        {item.careers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.careers.slice(0, 2).map((career) => (
              <span
                key={career}
                className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {t(`people.career.${career}`)}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.a>
  );
}
