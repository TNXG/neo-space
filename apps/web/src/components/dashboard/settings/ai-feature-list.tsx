"use client";

import { AnimatePresence, motion } from "motion/react";
import type { OptionDocument, OptionValue } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { AI_FEATURES, providerLabel, resolveProvider, type AiFeature, type AiProvider } from "./ai-model";
import { readValue, type SettingsIssue } from "./settings-model";
import { SettingsSection } from "./settings-section";

const UNSET = "__unset__";

interface AiFeatureListProps {
  document: OptionDocument;
  providers: readonly AiProvider[];
  disabled: boolean;
  issues: readonly SettingsIssue[];
  onChange: (path: string, value: OptionValue | undefined) => void;
}

/** 每个 AI 功能一行：开关、服务商与模型放在一起，开关关闭时收起分配，减少无关信息。 */
export function AiFeatureList({ document, providers, disabled, issues, onChange }: AiFeatureListProps) {
  return (
    <SettingsSection title="功能与模型" icon="mingcute:sparkles-line" description="开启需要的功能，并指定由哪个服务商、哪个模型处理。" index={1}>
      {AI_FEATURES.map(feature => (
        <AiFeatureRow key={feature.key} feature={feature} document={document} providers={providers} disabled={disabled} issues={issues} onChange={onChange} />
      ))}
    </SettingsSection>
  );
}

function AiFeatureRow({ feature, document, providers, disabled, issues, onChange }: AiFeatureListProps & { feature: AiFeature }) {
  const enabled = feature.toggle ? document[feature.toggle] === true : true;
  const providerPath = `${feature.key}.providerId`;
  const modelPath = `${feature.key}.model`;
  const providerId = readValue(document, providerPath);
  const model = readValue(document, modelPath);
  const resolved = resolveProvider(document, providers, feature);
  const providerError = issues.find(issue => issue.path === providerPath)?.message;
  const modelError = issues.find(issue => issue.path === modelPath)?.message;
  const selected = typeof providerId === "string" ? providerId : "";
  const missing = Boolean(selected) && !providers.some(provider => provider.id === selected);
  const id = `ai-feature-${feature.key}`;
  const defaultLabel = feature.fallback ? "自动（第一个已启用的服务商）" : "未分配";
  const triggerLabel = missing ? "服务商已删除" : selected ? providerLabel(providers.find(provider => provider.id === selected)!) : defaultLabel;
  const modelPlaceholder = resolved?.defaultModel ? `默认：${resolved.defaultModel}` : "填写模型名称";

  return (
    <div data-path={feature.key} className="flex flex-col py-4">
      <div className="flex items-start gap-3.5">
        <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 transition-colors duration-(--motion-duration-fast)", enabled ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")} aria-hidden="true">
          <Icon icon={feature.icon} className="size-4.5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            {feature.toggle ? (
              <FieldLabel htmlFor={`${id}-toggle`} className="cursor-pointer text-sm font-medium">{feature.title}</FieldLabel>
            ) : (
              <span className="text-sm font-medium">{feature.title}</span>
            )}
            {!feature.toggle && <Badge variant={selected ? "secondary" : "outline"}>{selected ? "已分配" : "未分配"}</Badge>}
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">{feature.description}</p>
        </div>
        {feature.toggle && (
          <Switch id={`${id}-toggle`} checked={enabled} disabled={disabled} className="mt-1" onCheckedChange={next => onChange(feature.toggle!, next)} />
        )}
      </div>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:pl-12.5">
              <Field data-path={providerPath} data-invalid={Boolean(providerError) || undefined}>
                <FieldLabel htmlFor={`${id}-provider`} className="text-[0.8125rem] text-muted-foreground">服务商</FieldLabel>
                <Select
                  value={selected || UNSET}
                  disabled={disabled}
                  onValueChange={next => {
                    onChange(providerPath, next === UNSET ? undefined : next);
                    if (model) onChange(modelPath, undefined);
                  }}
                >
                  <SelectTrigger id={`${id}-provider`} aria-invalid={Boolean(providerError)} className="w-full">
                    <span className={cn("truncate", !selected && "text-muted-foreground")}>{triggerLabel}</span>
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectItem value={UNSET}>{defaultLabel}</SelectItem>
                      {missing && <SelectItem value={selected}>服务商已删除</SelectItem>}
                    </SelectGroup>
                    {providers.length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>服务商</SelectLabel>
                          {providers.map(provider => (
                            <SelectItem key={provider.id} value={provider.id} disabled={!provider.id}>
                              {providerLabel(provider)}
                              {provider.enabled !== true && <span className="text-xs text-muted-foreground">未启用</span>}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {providerError
                  ? <FieldError>{providerError}</FieldError>
                  : !selected && resolved && <p className="text-xs text-muted-foreground">当前将使用 {providerLabel(resolved)}</p>}
              </Field>
              <Field data-path={modelPath} data-invalid={Boolean(modelError) || undefined}>
                <FieldLabel htmlFor={`${id}-model`} className="text-[0.8125rem] text-muted-foreground">模型</FieldLabel>
                <Input
                  id={`${id}-model`}
                  value={typeof model === "string" ? model : ""}
                  disabled={disabled}
                  aria-invalid={Boolean(modelError)}
                  placeholder={modelPlaceholder}
                  spellCheck={false}
                  className="font-mono text-[0.8125rem]"
                  onChange={event => onChange(modelPath, event.target.value || undefined)}
                />
                {modelError && <FieldError>{modelError}</FieldError>}
              </Field>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
