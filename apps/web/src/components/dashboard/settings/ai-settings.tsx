"use client";

import { toast } from "sonner";
import type { OptionDocument, OptionValue } from "@/types/api";
import { AI_FEATURES, providerLabel, readProviders, type AiProvider } from "./ai-model";
import { AiFeatureList } from "./ai-feature-list";
import { AiProviderList } from "./ai-provider-list";
import { isDocument, type SettingsIssue } from "./settings-model";

interface AiSettingsProps {
  document: OptionDocument;
  disabled: boolean;
  issues: readonly SettingsIssue[];
  onChange: (path: string, value: OptionValue | undefined) => void;
}

/** AI 服务：先配置服务商，再为功能分配；两部分共享同一份草稿。 */
export function AiSettings({ document, disabled, issues, onChange }: AiSettingsProps) {
  const providers = readProviders(document);
  const write = (next: AiProvider[]) => onChange("providers", next as OptionDocument[]);

  function add() {
    const id = crypto.randomUUID();
    write([...providers, { id, name: "", type: "openai-compatible", apiKey: "", endpoint: "", defaultModel: "", enabled: true }]);
    return id;
  }

  /** 修改技术标识时同步引用它的分配，避免功能悄悄指向不存在的服务商。 */
  function update(index: number, key: keyof AiProvider, value: string | boolean) {
    const previous = providers[index];
    write(providers.map((provider, current) => current === index ? { ...provider, [key]: value } : provider));
    if (key !== "id" || !previous.id) return;
    for (const feature of AI_FEATURES) {
      const assignment = document[feature.key];
      if (isDocument(assignment) && assignment.providerId === previous.id) onChange(`${feature.key}.providerId`, value as string);
    }
  }

  /** 删除立即生效，并清空引用它的分配；提示条可整体撤销。 */
  function remove(index: number) {
    const removed = providers[index];
    const snapshot = Object.fromEntries(["providers", ...AI_FEATURES.map(feature => feature.key)].map(key => [key, document[key]]));
    write(providers.filter((_, current) => current !== index));
    for (const feature of AI_FEATURES) {
      const assignment = document[feature.key];
      if (!removed.id || !isDocument(assignment) || assignment.providerId !== removed.id) continue;
      onChange(`${feature.key}.providerId`, undefined);
      onChange(`${feature.key}.model`, undefined);
    }
    toast(`已移除${providerLabel(removed)}`, {
      description: "保存前可撤销。",
      action: { label: "撤销", onClick: () => { for (const [key, value] of Object.entries(snapshot)) onChange(key, value); } },
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <AiProviderList providers={providers} disabled={disabled} issues={issues} onAdd={add} onUpdate={update} onRemove={remove} />
      <AiFeatureList document={document} providers={providers} disabled={disabled} issues={issues} onChange={onChange} />
    </div>
  );
}
