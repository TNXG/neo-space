"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { endpointHost, providerLabel, type AiProvider } from "./ai-model";
import { AiProviderEditor } from "./ai-provider-editor";
import type { SettingsIssue } from "./settings-model";
import { SettingsSection } from "./settings-section";

interface AiProviderListProps {
  providers: AiProvider[];
  disabled: boolean;
  issues: readonly SettingsIssue[];
  onAdd: () => string;
  onUpdate: (index: number, key: keyof AiProvider, value: string | boolean) => void;
  onRemove: (index: number) => void;
}

/** 服务商列表：启用开关直接放在行上，无需展开即可切换；展开后编辑连接信息。 */
export function AiProviderList({ providers, disabled, issues, onAdd, onUpdate, onRemove }: AiProviderListProps) {
  // 以数组位置为键：编辑技术标识时条目不会因键变化而收起或重建。
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const errorFor = (path: string) => issues.find(issue => issue.path === path)?.message;
  const invalidIndexes = issues.flatMap(issue => /^providers\.(\d+)\./.exec(issue.path)?.[1] ?? []).join(",");

  /** 校验失败时展开出问题的条目，折叠区里的错误才看得见。 */
  useEffect(() => {
    if (!invalidIndexes) return;
    setOpen(current => new Set([...current, ...invalidIndexes.split(",").map(Number)]));
  }, [invalidIndexes]);

  function toggle(index: number, next: boolean) {
    setOpen(current => {
      const copy = new Set(current);
      if (next) copy.add(index);
      else copy.delete(index);
      return copy;
    });
  }

  function add() {
    onAdd();
    setOpen(current => new Set(current).add(providers.length));
  }

  /** 删除后其后条目的位置前移，展开状态同步平移。 */
  function remove(index: number) {
    onRemove(index);
    setOpen(current => new Set([...current].filter(item => item !== index).map(item => item > index ? item - 1 : item)));
  }

  const addButton = (
    <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={add}>
      <Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />
      添加服务商
    </Button>
  );

  return (
    <SettingsSection title="服务商" icon="mingcute:server-line" description="OpenAI 兼容接口的连接信息，下方各功能从这里选择。" action={providers.length > 0 && addButton} framed={false} index={0}>
      {providers.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed border-border bg-card/60 md:p-10">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Icon icon="mingcute:sparkles-line" aria-hidden="true" /></EmptyMedia>
            <EmptyTitle className="text-base">还没有 AI 服务商</EmptyTitle>
            <EmptyDescription>添加 OpenAI 兼容接口（如 OpenAI、DeepSeek、Moonshot）后，即可为下方功能分配模型。</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{addButton}</EmptyContent>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {providers.map((provider, index) => {
              const isOpen = open.has(index);
              const name = providerLabel(provider);
              const invalid = issues.some(issue => issue.path.startsWith(`providers.${index}.`));
              const summary = [provider.defaultModel || "未设默认模型", endpointHost(provider.endpoint) || "未填接口地址"].join(" · ");
              return (
                <motion.li
                  key={index}
                  layout="position"
                  initial={{ opacity: 0, transform: "scale(0.98)" }}
                  animate={{ opacity: 1, transform: "scale(1)" }}
                  exit={{ opacity: 0, transform: "scale(0.98)" }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                >
                  <Collapsible
                    open={isOpen}
                    onOpenChange={next => toggle(index, next)}
                    className={cn("overflow-hidden rounded-2xl border bg-card shadow-xs transition-colors duration-(--motion-duration-fast)", invalid ? "border-destructive/60" : "border-border/70")}
                  >
                    <div className="flex items-center gap-2 pr-4">
                      <CollapsibleTrigger className="group/trigger flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl py-3.5 pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset lg:pl-5">
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60", provider.enabled ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")} aria-hidden="true">
                          <Icon icon="mingcute:ai-line" className="size-4.5" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-medium">{name}</span>
                            {invalid && <Badge variant="outline" className="border-destructive/50 text-destructive">需检查</Badge>}
                          </span>
                          <span className="truncate font-mono text-xs text-muted-foreground">{summary}</span>
                        </span>
                        <Icon icon="mingcute:down-line" className="size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-(--motion-duration-fast) ease-(--motion-ease-out) group-hover/trigger:text-foreground group-data-[state=open]/trigger:rotate-180" aria-hidden="true" />
                      </CollapsibleTrigger>
                      <Switch
                        checked={provider.enabled === true}
                        disabled={disabled}
                        aria-label={`启用${name}`}
                        onCheckedChange={next => onUpdate(index, "enabled", next)}
                      />
                    </div>
                    <CollapsibleContent className="panel-collapsible">
                      <AiProviderEditor
                        provider={provider}
                        index={index}
                        disabled={disabled}
                        errorFor={errorFor}
                        onUpdate={(key, value) => onUpdate(index, key, value)}
                        onRemove={() => remove(index)}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </SettingsSection>
  );
}
