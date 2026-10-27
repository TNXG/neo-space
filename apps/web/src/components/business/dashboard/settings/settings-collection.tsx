"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { OptionDocument } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import type { SettingField } from "./settings-schema";

interface SettingsCollectionProps {
  field: SettingField;
  entries: OptionDocument[];
  pathPrefix: string;
  disabled: boolean;
  incompatible: boolean;
  issuePaths: readonly string[];
  onChange: (entries: OptionDocument[]) => void;
  renderEntry: (entry: OptionDocument, path: string) => ReactNode;
}

/** 对象列表采用独立卡片设计，卡片头部为结构化信息，非按钮嵌套。 */
export function SettingsCollection({ field, entries, pathPrefix, disabled, incompatible, issuePaths, onChange, renderEntry }: SettingsCollectionProps) {
  const [keys, setKeys] = useState(() => entries.map((_, index) => `entry-${index}`));
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  const [focusKey, setFocusKey] = useState<string>();
  const container = useRef<HTMLDivElement>(null);
  const typeField = field.fields?.find(item => item.path === "type");
  const choices = typeField?.options ?? [];
  const availableType = choices.find(choice => !entries.some(entry => entry.type === choice.value));
  const exhausted = field.uniqueBy === "type" && choices.length > 0 && !availableType;
  const itemLabel = field.itemLabel ?? field.label;

  useEffect(() => {
    if (keys.length !== entries.length) setKeys(entries.map((_, index) => `entry-${index}`));
  }, [entries.length, keys.length]);

  const errorSignature = issuePaths
    .filter(path => path.startsWith(`${pathPrefix}.`))
    .map(path => Number(path.slice(pathPrefix.length + 1).split(".")[0]))
    .filter(index => Number.isInteger(index) && index >= 0 && index < keys.length)
    .join(",");

  /** 校验失败时展开对应条目。 */
  useEffect(() => {
    if (!errorSignature) return;
    const indexes = errorSignature.split(",").map(Number);
    setOpenKeys(current => {
      const next = new Set(current);
      const before = next.size;
      for (const index of indexes) if (keys[index]) next.add(keys[index]);
      return next.size === before ? current : next;
    });
  }, [errorSignature, keys]);

  useEffect(() => {
    if (!focusKey) return;
    const frame = requestAnimationFrame(() => {
      container.current?.querySelector<HTMLElement>(`[data-row="${focusKey}"] input, [data-row="${focusKey}"] select, [data-row="${focusKey}"] textarea, [data-row="${focusKey}"] [role=switch]`)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusKey, openKeys]);

  function toggleOpen(key: string) {
    setOpenKeys(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function add() {
    if (disabled || exhausted || incompatible) return;
    const entry = structuredClone(field.defaults ?? {});
    if (field.uniqueBy === "id" && entry.id === "") entry.id = crypto.randomUUID();
    if (field.uniqueBy === "type" && typeof entry.type !== "string" && availableType) entry.type = availableType.value;
    const key = `entry-${keys.length}-${Date.now()}`;
    setKeys([...keys, key]);
    setOpenKeys(current => new Set(current).add(key));
    setFocusKey(key);
    onChange([...entries, entry]);
  }

  function remove(index: number) {
    if (disabled) return;
    const nextKeys = keys.filter((_, keyIndex) => keyIndex !== index);
    setKeys(nextKeys);
    onChange(entries.filter((_, entryIndex) => entryIndex !== index));
    requestAnimationFrame(() => {
      const triggers = container.current?.querySelectorAll<HTMLElement>("[data-entry-header]");
      (triggers?.[Math.min(index, triggers.length - 1)] ?? container.current?.querySelector<HTMLButtonElement>("[data-entry-add]"))?.focus();
    });
  }

  return (
    <div ref={container} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-foreground/70">{entries.length === 0 ? `尚未添加${itemLabel}` : `共 ${entries.length} 个${itemLabel}`}</p>
        <Button data-entry-add type="button" variant="secondary" size="sm" disabled={disabled || exhausted || incompatible} onClick={add}>
          <Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />添加{itemLabel}
        </Button>
      </div>

      {incompatible && <p role="alert" className="text-sm text-destructive">现有列表格式不兼容，已保留原值且禁止覆盖。</p>}

      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-6 text-center">
          <p className="text-sm text-muted-foreground">暂无{itemLabel}</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {entries.map((entry, index) => {
            const key = keys[index] ?? `entry-${index}`;
            const open = openKeys.has(key);
            const typeLabel = choices.find(choice => choice.value === entry.type)?.label ?? (typeof entry.type === "string" ? entry.type : "");
            const name = typeof entry.name === "string" && entry.name.trim() ? entry.name : typeLabel || `${itemLabel} ${index + 1}`;
            return (
              <Collapsible key={key} open={open} onOpenChange={() => toggleOpen(key)}>
                <Card className="gap-0 overflow-hidden py-0 shadow-xs">
                <div
                  data-row={key}
                  data-entry-header
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  aria-controls={`entry-panel-${key}`}
                  className="flex min-h-12 cursor-pointer items-center justify-between gap-3 p-3.5 outline-none transition-colors duration-[var(--motion-duration-press)] ease-[var(--motion-ease-out)] select-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted/50"
                  onClick={() => toggleOpen(key)}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleOpen(key);
                    }
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{name}</span>
                        {typeLabel && <Badge variant="outline" className="text-xs">{typeLabel}</Badge>}
                        {typeof entry.enabled === "boolean" && (
                          <Badge variant={entry.enabled ? "secondary" : "outline"} className="text-xs">
                            {entry.enabled ? "已启用" : "未启用"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled}
                      aria-label={`移除${name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Icon icon="mingcute:delete-line" aria-hidden="true" />
                    </Button>
                    <div className="p-1 text-muted-foreground">
                      <Icon
                        icon="mingcute:down-line"
                        className={cn("size-4 transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]", open && "rotate-180")}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

                <CollapsibleContent id={`entry-panel-${key}`} className="panel-collapsible">
                  <div className="divide-y divide-border/40 border-t border-border/50 bg-muted/15 p-4">
                    {renderEntry(entry, `${pathPrefix}.${index}`)}
                  </div>
                </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {exhausted && <p className="text-[13px] text-foreground/70">所有可用类型均已添加，同一类型只保留一项。</p>}
    </div>
  );
}
