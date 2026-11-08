import type { OptionDocument, OptionValue } from "@/types/api";
import { isDocument, readValue } from "./settings-model";

/** AI 服务商条目；字段名与后端 providers 数组保持一致。 */
export interface AiProvider {
  [key: string]: OptionValue | undefined;
  id: string;
  name?: string;
  type?: string;
  apiKey?: string;
  endpoint?: string;
  defaultModel?: string;
  enabled?: boolean;
}

/** 一个 AI 功能与其模型分配路径；开关为空表示开关不在本页。 */
export interface AiFeature {
  key: "summaryModel" | "translationModel" | "commentReviewModel";
  title: string;
  description: string;
  icon: string;
  toggle?: "enableSummary" | "enableTranslation";
  /** 未指定服务商时能否回退到第一个已启用的服务商。 */
  fallback: boolean;
}

export const AI_FEATURES: readonly AiFeature[] = [
  {
    key: "summaryModel",
    title: "文章时效提醒",
    description: "识别文章中的软件版本、时间与数据，在内容可能过时时向读者展示温和提示。",
    icon: "mingcute:time-line",
    toggle: "enableSummary",
    fallback: true,
  },
  {
    key: "translationModel",
    title: "文章与随记翻译",
    description: "支持在后台为文章与随记生成多语言译文。",
    icon: "mingcute:translate-2-line",
    toggle: "enableTranslation",
    fallback: true,
  },
  {
    key: "commentReviewModel",
    title: "评论智能审核",
    description: "自动识别广告与垃圾评论；需同时在「评论设置」中开启 AI 审核。",
    icon: "mingcute:shield-shape-line",
    fallback: false,
  },
];

/** 读取服务商列表；非对象条目不进入界面，避免渲染时崩溃。 */
export function readProviders(document: OptionDocument): AiProvider[] {
  const value = document.providers;
  if (!Array.isArray(value)) return [];
  return value.filter(isDocument).map(item => ({ ...item, id: typeof item.id === "string" ? item.id : "" }));
}

/** 未命名服务商用类型加短标识，避免列表里只剩一截 UUID。 */
export function providerLabel(provider: AiProvider): string {
  if (provider.name?.trim()) return provider.name.trim();
  const kind = provider.type === "jev" ? "Jev" : "OpenAI 兼容";
  return provider.id ? `${kind} · ${provider.id.slice(0, 6)}` : kind;
}

/** 去掉协议前缀，列表摘要只需要主机与路径。 */
export function endpointHost(endpoint?: string): string {
  return endpoint?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "";
}

/** 功能实际会调用的服务商：显式分配优先，其次按后端规则回退。 */
export function resolveProvider(document: OptionDocument, providers: readonly AiProvider[], feature: AiFeature): AiProvider | undefined {
  const id = readValue(document, `${feature.key}.providerId`);
  if (typeof id === "string" && id) return providers.find(provider => provider.id === id);
  return feature.fallback ? providers.find(provider => provider.enabled === true && supportsFeature(provider, feature)) : undefined;
}

/** Jev 是结构化判断服务，不进入文章分析与翻译的可选列表。 */
export function supportsFeature(provider: AiProvider, feature: AiFeature): boolean {
  return provider.type !== "jev" || feature.key === "commentReviewModel";
}
