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
    title: "时间胶囊分析",
    description: "识别文章里的版本号、日期与统计数据，提示内容是否可能已过时。",
    icon: "mingcute:time-line",
    toggle: "enableSummary",
    fallback: true,
  },
  {
    key: "translationModel",
    title: "内容翻译",
    description: "允许在后台为文章与日记生成译文，不会自动触发。",
    icon: "mingcute:translate-2-line",
    toggle: "enableTranslation",
    fallback: true,
  },
  {
    key: "commentReviewModel",
    title: "评论 AI 审核",
    description: "为评论反垃圾提供判定与评分；需在评论设置中同时开启反垃圾与 AI 审核。",
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
  return provider.id ? `OpenAI 兼容 · ${provider.id.slice(0, 6)}` : "OpenAI 兼容";
}

/** 去掉协议前缀，列表摘要只需要主机与路径。 */
export function endpointHost(endpoint?: string): string {
  return endpoint?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "";
}

/** 功能实际会调用的服务商：显式分配优先，其次按后端规则回退。 */
export function resolveProvider(document: OptionDocument, providers: readonly AiProvider[], feature: AiFeature): AiProvider | undefined {
  const id = readValue(document, `${feature.key}.providerId`);
  if (typeof id === "string" && id) return providers.find(provider => provider.id === id);
  return feature.fallback ? providers.find(provider => provider.enabled === true) : undefined;
}
