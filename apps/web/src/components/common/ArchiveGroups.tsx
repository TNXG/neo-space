import type { ReactNode } from "react";
import { ArchiveTitle } from "./ArchiveTitle";

interface ArchiveGroupsProps<T> {
  items: T[];
  getYear: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
}

/**
 * 将已加载的文章合并为年份分组，保留原始顺序及索引用于预加载。
 * @param props 数据、年份提取器及原有文章行渲染器
 * @returns 标题位于文章列表内部的归档分组
 */
export function ArchiveGroups<T>({ items, getYear, renderItem }: ArchiveGroupsProps<T>) {
  const groups = new Map<string, { item: T; index: number }[]>();
  for (const [index, item] of items.entries()) {
    const year = getYear(item);
    const group = groups.get(year);
    if (group) group.push({ item, index });
    else groups.set(year, [{ item, index }]);
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      {Array.from(groups, ([year, entries]) => (
        <section key={year} aria-label={year} className="group/archive relative min-w-0">
          <ArchiveTitle year={year} className="sticky top-24" />
          <div className="relative flex flex-col">{entries.map(({ item, index }) => renderItem(item, index))}</div>
        </section>
      ))}
    </div>
  );
}
