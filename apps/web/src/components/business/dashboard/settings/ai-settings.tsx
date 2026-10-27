"use client";

import { useEffect, useState } from "react";
import type { OptionDocument, OptionValue } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import type { SettingsIssue } from "./settings-model";

interface AiProvider {
  [key: string]: OptionValue | undefined;
  id: string;
  name?: string;
  type?: string;
  apiKey?: string;
  endpoint?: string;
  defaultModel?: string;
  enabled?: boolean;
}

interface ModelAssignment {
  providerId?: string;
  model?: string;
}

interface AiSettingsProps {
  document: OptionDocument;
  disabled: boolean;
  issues: readonly SettingsIssue[];
  onChange: (path: string, value: OptionValue | undefined) => void;
}

/** 未命名服务商用类型加短标识，避免选择框里只剩一截 UUID。 */
function providerLabel(provider: AiProvider): string {
  if (provider.name?.trim()) return provider.name.trim();
  const type = provider.type === "openai" ? "OpenAI" : "OpenAI 兼容";
  return provider.id ? `${type} · ${provider.id.slice(0, 8)}` : type;
}

/** 专门针对 AI 服务商与模型分配设计的管理界面，无按钮嵌套与飘窗弹层。 */
export function AiSettings({ document, disabled, issues, onChange }: AiSettingsProps) {
  const providers: AiProvider[] = Array.isArray(document.providers) ? (document.providers as unknown as AiProvider[]) : [];
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const errorSignature = issues
    .filter(issue => issue.path.startsWith("providers."))
    .map(issue => Number(issue.path.split(".")[1]))
    .filter(index => Number.isInteger(index))
    .join(",");

  /** 校验失败时展开出问题的服务商卡片，否则用户看不到折叠区里的必填错误。 */
  useEffect(() => {
    if (!errorSignature) return;
    const indexes = errorSignature.split(",").map(Number);
    setOpenIds(current => {
      const next = new Set(current);
      const before = next.size;
      for (const index of indexes) {
        const id = providers[index]?.id;
        if (id) next.add(id);
      }
      return next.size === before ? current : next;
    });
  }, [errorSignature, providers]);

  function toggleOpen(id: string) {
    setOpenIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addProvider() {
    if (disabled) return;
    const newId = crypto.randomUUID();
    const newProvider: AiProvider = {
      id: newId,
      name: "",
      type: "openai-compatible",
      apiKey: "",
      endpoint: "",
      defaultModel: "",
      enabled: true,
    };
    onChange("providers", [...providers, newProvider] as unknown as OptionDocument[]);
    setOpenIds(current => new Set(current).add(newId));
  }

  /** 移除服务商同时清空引用它的模型分配；提示条可整体恢复。 */
  function removeProvider(index: number) {
    if (disabled) return;
    const removedId = providers[index]?.id;
    const snapshot = { providers: providers as unknown as OptionDocument[], summaryModel: document.summaryModel, translationModel: document.translationModel, commentReviewModel: document.commentReviewModel };
    toast(`已移除${providerLabel(providers[index])}`, {
      action: { label: "撤销", onClick: () => { for (const [key, value] of Object.entries(snapshot)) onChange(key, value); } },
    });
    onChange("providers", providers.filter((_, i) => i !== index) as unknown as OptionDocument[]);
    if (!removedId) return;
    for (const key of ["summaryModel", "translationModel", "commentReviewModel"] as const) {
      const assignment = document[key];
      if (typeof assignment !== "object" || assignment === null || Array.isArray(assignment)) continue;
      if (assignment.providerId !== removedId) continue;
      onChange(`${key}.providerId`, undefined);
      onChange(`${key}.model`, undefined);
    }
  }

  function updateProvider(index: number, key: keyof AiProvider, value: unknown) {
    if (disabled) return;
    const next = [...providers];
    next[index] = { ...next[index], [key]: value as OptionValue };
    onChange("providers", next as unknown as OptionDocument[]);
  }

  function errorFor(path: string): string | undefined {
    return issues.find(issue => issue.path === path)?.message;
  }

  const assignments = [
    {
      key: "summaryModel",
      title: "时间胶囊分析",
      description: "用于文章时效性风险分析，检测技术版本与过时信息。",
      enabled: document.enableSummary === true,
      disabledNotice: "该功能当前未启用；分配会保留，但不会调用。",
      requireProvider: false,
    },
    {
      key: "translationModel",
      title: "内容多语言翻译",
      description: "用于后台翻译文章或日记内容。",
      enabled: document.enableTranslation === true,
      disabledNotice: "该功能当前未启用；分配会保留，但不会调用。",
      requireProvider: false,
    },
    {
      key: "commentReviewModel",
      title: "评论 AI 审核",
      description: "用于评论反垃圾检测与评分判定（需在评论设置中启用反垃圾与 AI 审核）。",
      enabled: true,
      disabledNotice: undefined,
      requireProvider: true,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* 1. 服务商列表 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold tracking-tight">AI 服务商</h2>
            <p className="text-[13px] text-foreground/75">配置 OpenAI 或兼容接口提供商，供时效性分析、翻译与审核调用。</p>
          </div>
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={addProvider}>
            <Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />
            添加服务商
          </Button>
        </div>

        {providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-8 text-center bg-card">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
              <Icon icon="mingcute:sparkles-line" className="size-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">暂无 AI 服务商</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              添加一个 OpenAI 或兼容格式（如 DeepSeek、Moonshot 等）的服务商以启用各项智能功能。
            </p>
            <Button type="button" variant="secondary" size="sm" className="mt-4" disabled={disabled} onClick={addProvider}>
              <Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" /> 添加服务商
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {providers.map((provider, index) => {
              const isOpen = openIds.has(provider.id);
              const providerName = providerLabel(provider);
              const isCompatible = provider.type === "openai-compatible";
              const isEnabled = provider.enabled === true;

              return (
                <Collapsible key={provider.id} open={isOpen} onOpenChange={() => toggleOpen(provider.id)}>
                  <Card className="gap-0 overflow-hidden py-0 shadow-xs">
                  {/* 卡片头部：非按钮容器，结构化视觉 */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    aria-controls={`provider-panel-${provider.id}`}
                    className="flex min-h-12 cursor-pointer items-center justify-between gap-3 p-3.5 outline-none transition-colors duration-[var(--motion-duration-press)] ease-[var(--motion-ease-out)] select-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted/50"
                    onClick={() => toggleOpen(provider.id)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleOpen(provider.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{providerName}</span>
                          <Badge variant={isEnabled ? "secondary" : "outline"} className="text-xs shrink-0">
                            {isEnabled ? "已启用" : "未启用"}
                          </Badge>
                          {issues.some(issue => issue.path.startsWith(`providers.${index}.`)) && (
                            <span className="shrink-0 text-xs font-medium text-destructive">需检查</span>
                          )}
                        </div>
                        <p className="text-[13px] text-muted-foreground truncate mt-0.5">
                          {provider.defaultModel ? `默认模型: ${provider.defaultModel}` : "未配置默认模型"}
                          {provider.endpoint ? ` · ${provider.endpoint}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        aria-label={`移除${providerName}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeProvider(index)}
                      >
                        <Icon icon="mingcute:delete-line" aria-hidden="true" />
                      </Button>
                      <div className="p-1 text-muted-foreground">
                        <Icon
                          icon="mingcute:down-line"
                          className={cn("size-4 transition-transform duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-out)]", isOpen && "rotate-180")}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 卡片展开配置表单 */}
                  <CollapsibleContent id={`provider-panel-${provider.id}`} className="panel-collapsible">
                    <div className="border-t border-border/50 bg-muted/30 p-4 sm:p-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5" data-path={`providers.${index}.id`}>
                          <label className="text-[13px] font-medium text-foreground">技术标识</label>
                          <Input
                            value={provider.id || ""}
                            disabled={disabled}
                            placeholder="模型分配引用的唯一 ID"
                            spellCheck={false}
                            onChange={e => updateProvider(index, "id", e.target.value)}
                          />
                          <p className="text-[13px] text-foreground/75">模型分配引用此标识；修改后需同步所有分配。</p>
                        </div>

                        <div className="flex flex-col gap-1.5" data-path={`providers.${index}.type`}>
                          <label className="text-[13px] font-medium text-foreground">服务类型</label>
                          <Select value={provider.type || "openai-compatible"} disabled={disabled} onValueChange={value => updateProvider(index, "type", value)}>
                            <SelectTrigger className="w-full">
                              <span className="truncate">{provider.type === "openai" ? "OpenAI（官方）" : "OpenAI 兼容接口（DeepSeek 等）"}</span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="openai">OpenAI（官方）</SelectItem>
                              <SelectItem value="openai-compatible">OpenAI 兼容接口（DeepSeek 等）</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-1.5" data-path={`providers.${index}.name`}>
                          <label className="text-[13px] font-medium text-foreground">显示名称</label>
                          <Input
                            value={provider.name || ""}
                            disabled={disabled}
                            placeholder="例如 DeepSeek / 官方 OpenAI"
                            onChange={e => updateProvider(index, "name", e.target.value)}
                          />
                        </div>

                        <div className="flex flex-col gap-1.5" data-path={`providers.${index}.endpoint`}>
                          <label className="text-[13px] font-medium text-foreground">
                            接口地址 (Endpoint) {isCompatible && <span className="text-destructive">*</span>}
                          </label>
                          <Input
                            type="url"
                            value={provider.endpoint || ""}
                            disabled={disabled}
                            placeholder="https://api.example.com/v1"
                            onChange={e => updateProvider(index, "endpoint", e.target.value)}
                          />
                          <p className="text-[13px] text-foreground/75">包含 /v1 的完整基础地址，后端会自动追加 /chat/completions</p>
                        </div>

                        <div className="flex flex-col gap-1.5" data-path={`providers.${index}.defaultModel`}>
                          <label className="text-[13px] font-medium text-foreground">默认模型</label>
                          <Input
                            value={provider.defaultModel || ""}
                            disabled={disabled}
                            placeholder="例如 gpt-4o / deepseek-chat"
                            onChange={e => updateProvider(index, "defaultModel", e.target.value)}
                          />
                          <p className="text-[13px] text-foreground/75">未指定功能专属模型时回退到此模型</p>
                        </div>

                        <div className="flex flex-col gap-1.5 sm:col-span-2" data-path={`providers.${index}.apiKey`}>
                          <label className="text-[13px] font-medium text-foreground">API 密钥 (API Key)</label>
                          <div className="relative">
                            <Input
                              type={showKey[provider.id] ? "text" : "password"}
                              value={provider.apiKey || ""}
                              disabled={disabled}
                              placeholder="sk-..."
                              autoComplete="new-password"
                              className="pr-10"
                              onChange={e => updateProvider(index, "apiKey", e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="absolute top-1 right-1 text-muted-foreground hover:text-foreground"
                              aria-label={showKey[provider.id] ? "隐藏密钥" : "显示密钥"}
                              onClick={() => setShowKey(cur => ({ ...cur, [provider.id]: !cur[provider.id] }))}
                            >
                              <Icon icon={showKey[provider.id] ? "mingcute:eye-close-line" : "mingcute:eye-line"} className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border/40 sm:col-span-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">启用此服务商</span>
                            <span className="text-[13px] text-foreground/75">开启后允许系统将 AI 请求分配给此服务商</span>
                          </div>
                          <Switch
                            checked={isEnabled}
                            disabled={disabled}
                            onCheckedChange={enabled => updateProvider(index, "enabled", enabled)}
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. 功能开关 */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold tracking-tight">功能开关</h2>
          <p className="text-[13px] text-foreground/75">开启或关闭全局 AI 辅助功能。</p>
        </div>

        <div className="divide-y divide-border/50 rounded-xl border border-border/80 bg-card px-4">
          <div className="flex items-start justify-between gap-4 py-3.5">
            <div className="flex min-w-0 flex-col gap-1 pr-2">
              <span className="text-sm font-medium">启用时间胶囊分析</span>
              <p className="text-[13px] text-foreground/70 leading-relaxed">
                分析文章中的技术版本、统计数据与时效性语言，提示内容是否可能已过时。
              </p>
            </div>
            <div className="flex shrink-0 items-center pt-0.5">
              <Switch
                checked={document.enableSummary === true}
                disabled={disabled}
                onCheckedChange={v => onChange("enableSummary", v)}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 py-3.5">
            <div className="flex min-w-0 flex-col gap-1 pr-2">
              <span className="text-sm font-medium">启用内容多语言翻译</span>
              <p className="text-[13px] text-foreground/70 leading-relaxed">
                允许在后台按目标语言一键生成博文和日记的翻译版本。
              </p>
            </div>
            <div className="flex shrink-0 items-center pt-0.5">
              <Switch
                checked={document.enableTranslation === true}
                disabled={disabled}
                onCheckedChange={v => onChange("enableTranslation", v)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. 模型分配 */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold tracking-tight">模型分配</h2>
          <p className="text-[13px] text-foreground/75">为各项具体功能指定使用的服务商和模型；模型留空时自动回退至服务商默认模型。</p>
        </div>

        <div className="divide-y divide-border/50 rounded-xl border border-border/80 bg-card px-4">
          {assignments.map(item => {
            const assignment = (document[item.key] as ModelAssignment) || {};
            const providerError = errorFor(`${item.key}.providerId`);
            const modelError = errorFor(`${item.key}.model`);
            const selectedProvider = providers.find(provider => provider.id === assignment.providerId);
            const providerDisabled = selectedProvider !== undefined && selectedProvider.enabled !== true;
            const isInactive = disabled;

            return (
              <div key={item.key} data-path={item.key} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-8">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {item.title}
                    {(providerError || modelError) && <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />}
                  </span>
                  <p className="text-[13px] text-foreground/70 leading-relaxed">{item.description}</p>
                  {item.disabledNotice && !item.enabled && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium leading-relaxed mt-0.5">
                      {item.disabledNotice}
                    </p>
                  )}
                  {providerDisabled && !providerError && <p className="text-xs text-amber-600 dark:text-amber-400">所选服务商未启用，保存前请在上方启用。</p>}
                  {providerError && <p className="text-xs text-destructive">{providerError}</p>}
                  {modelError && <p className="text-xs text-destructive">{modelError}</p>}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center min-w-0">
                  <div data-path={`${item.key}.providerId`} className="min-w-0 sm:shrink-0">
                  <Select
                    value={assignment.providerId || "__default__"}
                    disabled={isInactive}
                    onValueChange={value => {
                      onChange(`${item.key}.providerId`, value === "__default__" ? undefined : value);
                      if (assignment.model) onChange(`${item.key}.model`, undefined);
                    }}
                  >
                    <SelectTrigger className="w-full shrink-0 sm:w-52">
                      <span className="truncate">
                        {assignment.providerId
                          ? (() => {
                              const provider = providers.find(item => item.id === assignment.providerId);
                              return provider ? providerLabel(provider) : "服务商已删除";
                            })()
                          : item.requireProvider ? "请选择服务商" : "默认服务商"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">{item.requireProvider ? "请选择服务商" : "默认服务商"}</SelectItem>
                      {providers.map(provider => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {providerLabel(provider)}{!provider.enabled ? "（未启用）" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </div>

                  <div data-path={`${item.key}.model`} className="min-w-0 flex-1">
                  <Input
                    value={assignment.model || ""}
                    disabled={isInactive}
                    placeholder="留空使用服务商默认模型"
                    className="flex-1 min-w-[160px]"
                    onChange={e => onChange(`${item.key}.model`, e.target.value === "" ? undefined : e.target.value)}
                  />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
