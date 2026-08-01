"use client";

import type {
  BangumiCharacterCollection,
  BangumiCharacterType,
  BangumiPersonCollection,
  BangumiPersonType,
} from "@/types/bangumi";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBangumiPeopleInfinite } from "@/hooks/useBangumiLibrary";
import { Icon } from "@/lib/inline-icon";
import { BangumiSegmentedControl } from "./BangumiSegmentedControl";
import {
  CharacterCollectionCard,
  getCharacterTypeKey,
  getPersonTypeKey,
  PersonCollectionCard,
} from "./PeopleCollectionCard";

type PeopleKind = "characters" | "persons";
type PeopleType = "all" | BangumiCharacterType | BangumiPersonType;

/** 展示人物收藏的真实二级层级：虚构角色与现实人物。 */
export function PeopleCollectionView() {
  const t = useTranslations("bangumi");
  const [kind, setKind] = useState<PeopleKind>("characters");
  const [type, setType] = useState<PeopleType>("all");
  const characterPages = useBangumiPeopleInfinite("characters");
  const personPages = useBangumiPeopleInfinite("persons");
  const characters = characterPages.items as BangumiCharacterCollection[];
  const persons = personPages.items as BangumiPersonCollection[];
  const activePages = kind === "characters" ? characterPages : personPages;
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  const kindOptions = [
    {
      value: "characters" as const,
      label: t("people.characters"),
      count: characterPages.total,
    },
    {
      value: "persons" as const,
      label: t("people.persons"),
      count: personPages.total,
    },
  ];
  const typeOptions = useMemo(() => {
    if (kind === "characters") {
      const values: BangumiCharacterType[] = [1, 2, 3, 4];
      return [
        {
          value: "all" as const,
          label: t("filter.all"),
          count: characters.length,
        },
        ...values.map((value) => ({
          value,
          label: t(`people.characterType.${getCharacterTypeKey(value)}`),
          count: characters.filter((item) => item.type === value).length,
        })),
      ];
    }

    const values: BangumiPersonType[] = [1, 2, 3];
    return [
      { value: "all" as const, label: t("filter.all"), count: persons.length },
      ...values.map((value) => ({
        value,
        label: t(`people.personType.${getPersonTypeKey(value)}`),
        count: persons.filter((item) => item.type === value).length,
      })),
    ];
  }, [characters, kind, persons, t]);
  const visibleCharacters =
    type === "all"
      ? characters
      : characters.filter((item) => item.type === type);
  const visiblePersons =
    type === "all" ? persons : persons.filter((item) => item.type === type);
  const isEmpty =
    kind === "characters"
      ? visibleCharacters.length === 0
      : visiblePersons.length === 0;

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !activePages.hasNextPage || activePages.isLoadingMore) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          activePages.loadMore();
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activePages]);

  /** 切换虚构/现实人物时重置子类型，避免保留不属于新层级的筛选值。 */
  const handleKindChange = (nextKind: PeopleKind) => {
    setKind(nextKind);
    setType("all");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <BangumiSegmentedControl
          value={kind}
          options={kindOptions}
          onChange={handleKindChange}
          label={t("people.kindLabel")}
        />
        <BangumiSegmentedControl
          value={type}
          options={typeOptions}
          onChange={setType}
          label={t("people.typeLabel")}
          compact
        />
      </div>

      {!isEmpty ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {kind === "characters"
            ? visibleCharacters.map((item, index) => (
                <CharacterCollectionCard
                  key={item.id}
                  item={item}
                  index={index}
                />
              ))
            : visiblePersons.map((item, index) => (
                <PersonCollectionCard key={item.id} item={item} index={index} />
              ))}
        </div>
      ) : (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/25 px-6 text-center">
          <Icon
            icon="mingcute:user-search-line"
            className="size-8 text-muted-foreground/50"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("empty.people")}
          </p>
        </div>
      )}

      <div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden />
    </div>
  );
}
